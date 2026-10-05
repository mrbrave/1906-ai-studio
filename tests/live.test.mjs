import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  MemoryRepository,
  configure,
  conversation,
  request,
  jevResponse,
  geminiResponse,
} from "./helpers.mjs";
import { runOperation } from "../server/turn.ts";
import { cost, dollars, rates, totals, usage } from "../server/budget.ts";
import { parseDecision, jevBody } from "../server/jev.ts";
import { ProviderFailure } from "../server/model-http.ts";
import { snapshot } from "../server/studio.ts";
import { createRepository } from "../server/repository.ts";
beforeEach(configure);
const success = {
  jev: async () => jevResponse(),
  gemini: async () => geminiResponse(),
};
test("costs retain sub-cent JEV amounts, cache discount and thinking without double counting", () => {
  assert.equal(dollars("10.000000001"), 10000000001);
  assert.throws(() => dollars("-1"));
  assert.throws(() => dollars("10001"));
  assert.throws(() => dollars("1e3"));
  assert.equal(cost("jev", jevResponse(), rates("jev")).amount, 126000);
  const raw = geminiResponse();
  raw.usageMetadata.cachedContentTokenCount = 1000;
  assert.equal(
    cost("gemini", raw, rates("gemini", new Date("2026-10-05"))).amount,
    4200000,
  );
  assert.equal(rates("gemini", new Date("2027-01-01")).input, 1500);
  delete raw.usageMetadata;
  assert.throws(() => cost("gemini", raw, rates("gemini")));
  process.env.GEMINI_BILLING_TIER = "free";
  assert.equal(cost("gemini", geminiResponse(), rates("gemini")).amount, 0);
  process.env.GEMINI_MODEL = "unknown";
  assert.throws(() => rates("gemini"));
});
test("JEV runs before Gemini, receives intent and memory; state and reply commit together", async () => {
  const repo = new MemoryRepository(),
    cid = await conversation(repo),
    req = request(cid),
    events = [];
  const clients = {
    jev: async (body) => {
      events.push("jev");
      assert.equal(body.state.previousState, null);
      assert.equal(
        body.state.conversationIntent.targetDecision,
        "Agree to a discovery workshop",
      );
      assert.equal(repo.state.data.messages[0].status, "pending");
      return jevResponse();
    },
    gemini: async (body) => {
      events.push("gemini");
      assert.match(body.systemInstruction.parts[0].text, /request_evidence/);
      assert.match(body.systemInstruction.parts[0].text, /credibility/);
      return geminiResponse();
    },
  };
  const out = await runOperation("dialogue", req, repo, clients);
  assert.deepEqual(events, ["jev", "gemini"]);
  assert.equal(out.result.version, 1);
  assert.equal(repo.state.conversations[0].version, 1);
  assert.equal(repo.state.data.messages.length, 2);
  assert.equal(totals(repo.state).spent, 5001000);
  assert.equal(totals(repo.state).reserved, 0);
  const again = await runOperation("dialogue", req, repo, {
    jev: async () => assert.fail(),
    gemini: async () => assert.fail(),
  });
  assert.deepEqual(again.result, out.result);
  await runOperation("dialogue", request(cid, 1), repo, {
    ...success,
    jev: async (body) => {
      assert.equal(body.state.previousState.version, 1);
      assert.equal(body.state.history.length, 2);
      assert.deepEqual(body.state.previousState.unresolvedObjections, [
        "credibility",
      ]);
      return jevResponse();
    },
  });
  assert.equal(repo.state.conversations[0].version, 2);
});
test("public snapshot excludes financial records, receipts and dollar allowance", async () => {
  const repo = new MemoryRepository(),
    cid = await conversation(repo);
  await runOperation("dialogue", request(cid), repo, success);
  const s = snapshot(repo.state);
  assert.deepEqual(Object.keys(s).sort(), [
    "conversations",
    "data",
    "operations",
    "usage",
  ]);
  assert.deepEqual(Object.keys(s.usage).sort(), [
    "remainingPercentage",
    "status",
    "updatedAt",
  ]);
  assert.equal(s.operations[0].attempts, undefined);
  assert.equal(s.operations[0].request, undefined);
  assert.equal(JSON.stringify(s).includes("fake-typesafe"), false);
  assert.equal(s.data.users[0].compute_credits, 0);
});
test("invalid JEV answer records its usage, blocks Gemini and does not advance state", async () => {
  const repo = new MemoryRepository(),
    cid = await conversation(repo);
  const raw = jevResponse();
  raw.answers.friction.choice = "fabricated";
  await assert.rejects(
    runOperation("dialogue", request(cid), repo, {
      jev: async () => raw,
      gemini: async () => assert.fail("Gemini must not run"),
    }),
  );
  assert.equal(repo.state.conversations[0].state, null);
  assert.equal(totals(repo.state).spent, 126000);
  assert.equal(repo.state.operations[0].status, "failed");
});
test("known Gemini failure reuses JEV on retry and charges each actual attempt once", async () => {
  const repo = new MemoryRepository(),
    cid = await conversation(repo),
    req = request(cid);
  let jevCalls = 0;
  await assert.rejects(
    runOperation("dialogue", req, repo, {
      jev: async () => {
        jevCalls++;
        return jevResponse();
      },
      gemini: async () => {
        throw new ProviderFailure("Rate limited", false);
      },
    }),
  );
  assert.equal(repo.state.conversations[0].version, 0);
  assert.equal(totals(repo.state).spent, 126000);
  await runOperation("dialogue", req, repo, {
    jev: async () => assert.fail("Reuse prior state"),
    gemini: success.gemini,
  });
  assert.equal(jevCalls, 1);
  assert.equal(totals(repo.state).spent, 5001000);
  assert.equal(repo.state.data.messages.length, 2);
});
test("invalid Gemini text keeps known cost and a deliberate retry regenerates only Gemini", async () => {
  const repo = new MemoryRepository(),
    cid = await conversation(repo),
    req = request(cid);
  const raw = geminiResponse();
  raw.candidates[0].finishReason = "MAX_TOKENS";
  await assert.rejects(
    runOperation("dialogue", req, repo, {
      ...success,
      gemini: async () => raw,
    }),
  );
  assert.equal(totals(repo.state).spent, 5001000);
  await runOperation("dialogue", req, repo, {
    jev: async () => assert.fail(),
    gemini: success.gemini,
  });
  assert.equal(totals(repo.state).spent, 9876000);
});
test("ambiguous provider interruption holds the reserve and blocks other paid operations", async () => {
  const repo = new MemoryRepository(),
    cid = await conversation(repo),
    req = request(cid);
  await assert.rejects(
    runOperation("dialogue", req, repo, {
      jev: async () => {
        throw new ProviderFailure("Connection lost", true);
      },
      gemini: async () => assert.fail(),
    }),
  );
  assert.equal(repo.state.operations[0].status, "uncertain");
  assert.ok(totals(repo.state).reserved > 0);
  assert.equal(usage(repo.state).status, "review_required");
  await assert.rejects(
    runOperation(
      "archetype",
      { requestId: randomUUID(), description: "A buyer" },
      repo,
      success,
    ),
    /still running or needs review/,
  );
});
test("missing usage is never recorded as a free request", async () => {
  const repo = new MemoryRepository(),
    cid = await conversation(repo);
  const raw = jevResponse();
  delete raw.usage;
  await assert.rejects(
    runOperation("dialogue", request(cid), repo, {
      jev: async () => raw,
      gemini: async () => assert.fail(),
    }),
    /usage was missing/,
  );
  assert.equal(repo.state.operations[0].status, "uncertain");
  assert.ok(repo.state.operations[0].reserve > 0);
});
test("atomic admission serialises concurrent requests and identical replays do not duplicate calls", async () => {
  const repo = new MemoryRepository(),
    cid = await conversation(repo),
    req = request(cid);
  let calls = 0,
    release;
  const wait = new Promise((r) => (release = r));
  const clients = {
    jev: async () => {
      calls++;
      await wait;
      return jevResponse();
    },
    gemini: success.gemini,
  };
  const first = runOperation("dialogue", req, repo, clients);
  while (calls === 0) await new Promise((r) => setImmediate(r));
  await assert.rejects(
    runOperation("dialogue", req, repo, clients),
    /still running/,
  );
  release();
  await first;
  assert.equal(calls, 1);
  assert.equal(repo.state.operations.length, 1);
  assert.equal(repo.state.data.messages.length, 2);
});
test("budget, stale version and idempotency conflicts reject before inference", async () => {
  const repo = new MemoryRepository(),
    cid = await conversation(repo),
    req = request(cid);
  process.env.STUDIO_BUDGET_USD = "0";
  await assert.rejects(
    runOperation("dialogue", req, repo, success),
    /Not enough/,
  );
  assert.equal(repo.state.operations.length, 0);
  configure();
  await runOperation("dialogue", req, repo, success);
  await assert.rejects(
    runOperation("dialogue", { ...req, pitch: "Different" }, repo, success),
    /different content/,
  );
  await assert.rejects(
    runOperation("dialogue", request(cid, 0), repo, success),
    /Conversation changed/,
  );
});
test("archetype generation is metered and repeated request IDs reuse the saved result", async () => {
  const repo = new MemoryRepository(),
    req = { requestId: randomUUID(), description: "A careful buyer" };
  const draft = {
    name: "Pat",
    role: "Buyer",
    budget_sensitivity: "High",
    system_prompt: "You are Pat.",
  };
  let calls = 0;
  const clients = {
    jev: async () => assert.fail(),
    gemini: async () => {
      calls++;
      return geminiResponse(JSON.stringify(draft));
    },
  };
  const first = await runOperation("archetype", req, repo, clients);
  await runOperation("archetype", req, repo, clients);
  assert.deepEqual(first.result, draft);
  assert.equal(calls, 1);
  assert.equal(totals(repo.state).spent, 4875000);
});
test("low confidence expresses uncertainty and does not silently resolve old objections", async () => {
  const repo = new MemoryRepository(),
    cid = await conversation(repo),
    c = repo.state.conversations[0];
  c.state = {
    unresolvedObjections: ["implementation"],
    friction: "implementation",
  };
  const raw = jevResponse("none");
  raw.answers.sufficient.noul = 0.4;
  const d = parseDecision(raw, c);
  assert.equal(d.state.readinessIndex, null);
  assert.equal(d.state.responseAction, "clarify");
  assert.deepEqual(d.state.unresolvedObjections, ["implementation"]);
  assert.throws(() => jevBody(c, [], "x".repeat(25000)), /memory limit/);
});
test("Supabase adapter uses only authenticated RPC and CAS conflicts are preserved", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-only";
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, opts) => {
      assert.equal(opts.headers.Authorization, "Bearer server-only");
      if (url.endsWith("studio_read"))
        return Response.json({ revision: 3, state: null });
      assert.equal(JSON.parse(opts.body).expected_revision, 3);
      return Response.json(false);
    };
    const repo = createRepository(),
      s = await repo.read();
    assert.equal(s.revision, 3);
    assert.equal(await repo.compareAndSwap(3, s.state), false);
  } finally {
    globalThis.fetch = original;
  }
});

test("a saved Gemini receipt survives a commit failure and is reused without a new reservation", async () => {
  const repo = new MemoryRepository(),
    cid = await conversation(repo),
    req = request(cid);
  const write = repo.compareAndSwap.bind(repo);
  let failCommit = true;
  repo.compareAndSwap = async (revision, state) => {
    if (failCommit && state.operations[0]?.status === "complete") {
      failCommit = false;
      throw new Error("Simulated database commit outage");
    }
    return write(revision, state);
  };
  await assert.rejects(runOperation("dialogue", req, repo, success));
  assert.equal(repo.state.conversations[0].version, 0);
  assert.equal(totals(repo.state).spent, 5001000);
  process.env.STUDIO_BUDGET_USD = "0.005001";
  await runOperation("dialogue", req, repo, {
    jev: async () => assert.fail(),
    gemini: async () => assert.fail(),
  });
  assert.equal(repo.state.conversations[0].version, 1);
  assert.equal(totals(repo.state).spent, 5001000);
});

test("a fully reserved allowance permits its reserved stages to finish", async () => {
  const { reserveFor } = await import("../server/budget.ts");
  const repo = new MemoryRepository(),
    cid = await conversation(repo);
  const allocation =
    reserveFor("jev", rates("jev")) + reserveFor("gemini", rates("gemini"));
  process.env.STUDIO_BUDGET_USD = (allocation / 1e9).toFixed(9);
  const raw = jevResponse();
  raw.usage.input_tokens = 65536;
  const result = await runOperation("dialogue", request(cid), repo, {
    ...success,
    jev: async () => raw,
  });
  assert.equal(result.result.version, 1);
});
