import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import dialogue from "../api/dialogue.ts";
import archetype from "../api/archetype.ts";
import evaluate from "../api/evaluate.ts";
import studio from "../api/studio.ts";
import { complete, geminiBody } from "../server/provider.ts";
import { evaluateWithJEV } from "../server/jev.ts";
import {
  configure,
  geminiResponse,
  jevResponse,
  MemoryRepository,
} from "./helpers.mjs";
import { randomUUID } from "node:crypto";
beforeEach(configure);
async function invoke(
  handler,
  body = {},
  token = process.env.STUDIO_ACCESS_TOKEN,
  method = "POST",
) {
  let data;
  const res = {
    setHeader() {},
    end(x) {
      data = JSON.parse(x);
    },
  };
  await handler(
    {
      method,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body,
    },
    res,
  );
  return { status: res.statusCode, data };
}
test("all routes require live gate and access code before parsing requests or spending", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => assert.fail("No upstream request expected");
  try {
    for (const h of [dialogue, archetype, evaluate, studio]) {
      assert.equal((await invoke(h, {}, "", "GET")).status, 405);
      assert.equal((await invoke(h, {}, "wrong")).status, 401);
      assert.equal((await invoke(h, "{bad")).status, 400);
    }
    assert.equal((await invoke(evaluate)).status, 410);
    process.env.STUDIO_ENABLE_LIVE = "false";
    assert.equal((await invoke(dialogue)).status, 503);
  } finally {
    globalThis.fetch = original;
  }
});
test("provider adapters use official endpoints, server secrets and real token counting", async () => {
  const original = globalThis.fetch,
    urls = [];
  globalThis.fetch = async (url, options) => {
    urls.push(url);
    const b = JSON.parse(options.body);
    if (url.endsWith("countTokens")) {
      assert.equal(
        b.generateContentRequest.systemInstruction.parts[0].text,
        "Stay in character",
      );
      return Response.json({ totalTokens: 1234 });
    }
    if (url.includes("googleapis")) {
      assert.equal(options.headers["x-goog-api-key"], "fake-google");
      assert.equal(b.generationConfig.maxOutputTokens, 2048);
      return Response.json(geminiResponse());
    }
    assert.equal(url, "https://api.typesafe.ai/v1/systemone");
    assert.equal(options.headers.Authorization, "Bearer fake-typesafe");
    return Response.json(jevResponse());
  };
  try {
    await evaluateWithJEV({ model: "jev-1.13.0", state: {}, questions: {} });
    await complete(
      geminiBody("Stay in character", [{ role: "user", content: "A pitch" }]),
    );
    assert.equal(urls.length, 3);
  } finally {
    globalThis.fetch = original;
  }
});
test("full HTTP handlers persist through Supabase RPC, meter JEV then Gemini and return only public data", async () => {
  const original = globalThis.fetch,
    repo = new MemoryRepository();
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-secret";
  let jevCalls = 0,
    geminiCalls = 0;
  globalThis.fetch = async (url, options) => {
    const b = JSON.parse(options.body);
    if (url.endsWith("studio_read")) return Response.json(await repo.read());
    if (url.endsWith("studio_write"))
      return Response.json(
        await repo.compareAndSwap(b.expected_revision, b.next_state),
      );
    if (url.includes("typesafe")) {
      jevCalls++;
      return Response.json(jevResponse());
    }
    if (url.endsWith("countTokens"))
      return Response.json({ totalTokens: 4000 });
    geminiCalls++;
    assert.equal(jevCalls, 1);
    return Response.json(geminiResponse());
  };
  try {
    const initial = await invoke(studio, { action: "snapshot" });
    assert.equal(initial.status, 200);
    const cid = randomUUID();
    await invoke(studio, {
      action: "create_conversation",
      id: cid,
      archetypeId: initial.data.data.archetypes[0].id,
      intent: {
        objective: "Test",
        proposition: "Coaching",
        targetDecision: "Book a workshop",
      },
    });
    const req = {
      requestId: randomUUID(),
      conversationId: cid,
      pitch: "Show interest in this programme",
      expectedVersion: 0,
    };
    const result = await invoke(dialogue, req);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.ok(result.data.result.text);
    const repeat = await invoke(dialogue, req);
    assert.deepEqual(repeat.data.result, result.data.result);
    assert.equal(geminiCalls, 1);
    const saved = await invoke(studio, { action: "snapshot" });
    assert.equal(saved.data.data.messages.length, 2);
    assert.ok(saved.data.usage.remainingPercentage < 100);
    assert.equal(saved.data.operations[0].attempts, undefined);
    assert.equal(JSON.stringify(saved.data).includes("service-secret"), false);
  } finally {
    globalThis.fetch = original;
  }
});
