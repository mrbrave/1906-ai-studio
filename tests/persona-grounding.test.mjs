import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import {
  groundedFixture,
  groundedDescription,
  synthesisFixture,
} from "./persona-fixtures.mjs";
import { parseGroundedPersona } from "../server/persona-grounding.ts";
import {
  parseSynthesisedPersona,
  SYNTHESIS_SCHEMA,
  SYNTHESIS_PROMPT,
} from "../server/persona-synthesis.ts";
import { runOperation } from "../server/turn.ts";
import { MemoryRepository, configure, geminiResponse } from "./helpers.mjs";

test("grounding retains supported detail, removes unsupported items and never mutates source output", () => {
  const input = groundedFixture();
  input.profile.currentTools = ["Salesforce"];
  input.profile.preferredChannels = ["Email", "WhatsApp"];
  input.profile.provenance.currentTools = "provided";
  input.profile.provenance.preferredChannels = "provided";
  input.evidence.currentTools = ["Leads a growth team."];
  input.evidence.preferredChannels = ["Prefers Email.", "Prefers Email."];
  const before = structuredClone(input);
  const result = parseGroundedPersona(
    input,
    groundedDescription() + ". Prefers Email.",
  );
  assert.equal(result.profile.currentTools, undefined);
  assert.equal(result.profile.preferredChannels, undefined);
  assert.equal(result.profile.provenance.currentTools, undefined);
  assert.deepEqual(result.profile.goals, input.profile.goals);
  assert.equal(
    result.profile.communicationStyle,
    input.profile.communicationStyle,
  );
  assert.match(result.synthesisReview.notes.join(" "), /left blank/);
  assert.equal(result.synthesisReview.version, "persona-synthesis-v3");
  assert.deepEqual(input, before);
});

test("fabricated quotes, unrelated real quotes, substring matches and inferred stereotypes fail closed", () => {
  for (const [value, quote, description, source] of [
    ["LinkedIn", "Prefers LinkedIn", "A marketing manager", "provided"],
    ["WhatsApp", "A marketing manager", "A marketing manager", "provided"],
    ["mail", "Prefers email", "Prefers email", "provided"],
    ["LinkedIn", "Prefers LinkedIn", "Prefers LinkedIn", "inferred"],
    ["Email and WhatsApp", "Prefers Email", "Prefers Email", "provided"],
  ]) {
    const input = groundedFixture();
    input.profile = {
      preferredChannels: [value],
      provenance: { preferredChannels: source },
    };
    input.evidence = { preferredChannels: [quote] };
    assert.equal(
      parseGroundedPersona(input, description).profile.preferredChannels,
      undefined,
    );
  }
});

test("unknowns and fabricated identity cannot silently become facts; user wording can be retained", () => {
  const input = groundedFixture();
  input.profile = {
    preferredChannels: ["Email"],
    provenance: { preferredChannels: "provided" },
  };
  input.evidence = { preferredChannels: ["Prefers email for proposals."] };
  const result = parseGroundedPersona(input, "Prefers  email\nfor proposals.");
  assert.deepEqual(result.profile.preferredChannels, ["Email"]);
  assert.equal(result.name, "Synthetic buyer");
  assert.equal(result.role, "Buyer");
  assert.equal(result.budget_sensitivity, "Medium");
  assert.deepEqual(Object.values(result.synthesisReview.identitySources), [
    "inferred",
    "inferred",
    "inferred",
  ]);
  assert.throws(() =>
    parseGroundedPersona({ ...input, evidence: undefined }, "Buyer"),
  );
  assert.throws(() =>
    parseGroundedPersona({ ...input, evidence: { secret: "no" } }, "Buyer"),
  );
});

test("already-admitted v2 synthesis retains the v2 prompt, schema and parser on retry and replay", async () => {
  configure();
  const repo = new MemoryRepository();
  const request = { description: "Legacy source" };
  const id = randomUUID();
  repo.state.operations.push({
    id,
    kind: "archetype",
    request,
    promptVersion: "persona-synthesis-v2",
    hash: createHash("sha256")
      .update(JSON.stringify({ kind: "archetype", request }))
      .digest("hex"),
    status: "failed",
    startedAt: new Date().toISOString(),
    reserve: 0,
    attempts: [],
  });
  let calls = 0;
  const engines = {
    jev: async () => assert.fail(),
    gemini: async (body) => {
      calls++;
      assert.equal(body.systemInstruction.parts[0].text, SYNTHESIS_PROMPT);
      assert.deepEqual(
        body.generationConfig.responseJsonSchema,
        SYNTHESIS_SCHEMA,
      );
      return geminiResponse(JSON.stringify(synthesisFixture()));
    },
  };
  const result = await runOperation(
    "archetype",
    { ...request, requestId: id },
    repo,
    engines,
  );
  assert.deepEqual(result.result, parseSynthesisedPersona(synthesisFixture()));
  await runOperation("archetype", { ...request, requestId: id }, repo, engines);
  assert.equal(calls, 1);
});
