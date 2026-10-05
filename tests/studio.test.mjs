import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { runDialogueTurn } from "../src/services/llmService.ts";
import { parseTelemetry } from "../src/api/validation.ts";
import {
  loadStudio,
  saveStudio,
  STORAGE_KEY,
} from "../src/services/storageService.ts";
import dialogue from "../api/dialogue.ts";
import evaluate from "../api/evaluate.ts";
class MemoryStorage {
  items = new Map();
  getItem(key) {
    return this.items.get(key) ?? null;
  }
  setItem(key, value) {
    this.items.set(key, value);
  }
}
const telemetry = {
  intentScore: 72,
  sentiment: "Interested",
  activeFriction: "Integration effort",
  suggestedTweak: "Include a deployment estimate.",
};
const storage = new MemoryStorage();
const archetype = loadStudio(storage).archetypes[0];
const input = {
  archetype,
  pitch: "Our service saves five hours a week.",
  history: [],
  provider: "gemini",
};
test("offline demo never requests live engines", async () => {
  const result = await runDialogueTurn(
    { ...input, provider: "demo" },
    () => {},
  );
  assert.match(result.telemetry.sentiment, /demo fixture/);
  await assert.rejects(
    runDialogueTurn(input, () => {}),
    /private Studio/,
  );
});
test("strict telemetry rejects malformed values instead of inventing defaults", () => {
  assert.deepEqual(parseTelemetry(telemetry), telemetry);
  for (const value of [
    { ...telemetry, intentScore: 101 },
    { ...telemetry, intentScore: -1 },
    { ...telemetry, intentScore: NaN },
    { ...telemetry, intentScore: "72" },
    { ...telemetry, sentiment: "" },
    { ...telemetry, extra: true },
    { intentScore: 50 },
    null,
  ])
    assert.throws(() => parseTelemetry(value));
});
test("legacy custom personas migrate without reading credentials or changing legacy data", () => {
  const local = new MemoryStorage();
  const legacy = JSON.stringify([
    {
      id: "custom-1",
      name: "Sam",
      role: "Founder",
      avatar: "🎯",
      budgetSensitivity: "High",
      systemPrompt: "You are a pragmatic founder.",
    },
  ]);
  local.setItem("personaflow_custom_personas", legacy);
  local.setItem("personaflow_llm_config", "not even valid JSON");
  const data = loadStudio(local);
  assert.equal(data.archetypes.at(-1).name, "Sam");
  saveStudio(data, local);
  assert.deepEqual(loadStudio(local), data);
  assert.equal(local.getItem("personaflow_custom_personas"), legacy);
});
test("corrupt storage is reported and is never overwritten", () => {
  const local = new MemoryStorage();
  local.setItem(STORAGE_KEY, "{broken");
  assert.throws(() => loadStudio(local));
  assert.equal(local.getItem(STORAGE_KEY), "{broken");
  local.setItem(STORAGE_KEY, JSON.stringify({ version: 7 }));
  assert.throws(() => loadStudio(local));
});
test("interrupted requests recover with explicit retry states", () => {
  const local = new MemoryStorage();
  const data = loadStudio(local);
  const date = new Date().toISOString();
  data.conversations.push({
    id: "c",
    user_id: data.users[0].id,
    archetype_id: data.archetypes[0].id,
    title: "Test",
    created_at: date,
    updated_at: date,
  });
  const m = {
    id: "m",
    conversation_id: "c",
    role: "user",
    content: "A pitch",
    created_at: date,
    provider: "gemini",
    status: "pending",
    telemetry_status: "none",
    telemetry: null,
    error: null,
  };
  data.messages = [m];
  saveStudio(data, local);
  assert.equal(loadStudio(local).messages[0].status, "failed");
  data.messages = [
    {
      ...m,
      role: "assistant",
      status: "complete",
      telemetry_status: "pending",
    },
  ];
  saveStudio(data, local);
  assert.equal(loadStudio(local).messages[0].telemetry_status, "failed");
  assert.equal(loadStudio(local).users[0].compute_credits, 4290);
});
test("persistence failures surface to the caller", () => {
  assert.throws(
    () =>
      saveStudio(loadStudio(new MemoryStorage()), {
        setItem() {
          throw new Error("Quota exceeded");
        },
      }),
    /Quota exceeded/,
  );
});
