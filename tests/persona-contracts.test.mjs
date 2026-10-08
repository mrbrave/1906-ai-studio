import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseDraft } from "../src/api/validation.ts";
import {
  parsePersonaProfile,
  profileFromLegacy,
  PROFILE_MAX_BYTES,
} from "../src/api/personaProfile.ts";
import { publicStudioData } from "../src/api/publicData.ts";
import { upgradePersonaData } from "../src/services/personaCompatibility.ts";
import {
  loadStudio,
  saveStudio,
  STORAGE_KEY,
} from "../src/services/storageService.ts";
import { upgradePersonaStore } from "../server/persona-compatibility.ts";
import { privatePersonaKey } from "../server/persona-private.ts";
import { snapshot, studio } from "../server/studio.ts";
import { createRepository, mutate } from "../server/repository.ts";
import { runOperation } from "../server/turn.ts";
import {
  configure,
  MemoryRepository,
  conversation,
  request,
  jevResponse,
  geminiResponse,
} from "./helpers.mjs";
beforeEach(configure);

const profile = {
  industry: "B2B software",
  companySize: "80–120 employees",
  ageRange: "35–45",
  background: "  Leads a small growth team.\nKeeps a hands-on role.  ",
  goals: ["Improve qualified pipeline"],
  painPoints: ["Manual reporting"],
  buyingMotivations: ["Clearer reporting with less admin"],
  typicalObjections: ["Will the data be useful?"],
  preferredEvidence: ["A relevant worked example"],
  currentTools: ["CRM and analytics"],
  constraints: ["Limited engineering time"],
  decisionProcess: "Review before a demo",
  decisionAuthority: "Can book a demo",
  communicationStyle: "Direct, curious and brief",
  examplePhrases: ["Show me what that looks like."],
  additionalGuidance: "Answer the question directly.",
  provenance: {
    industry: "provided",
    companySize: "inferred",
    background: "provided",
  },
};
const draft = {
  name: "Casey",
  role: "Head of Growth",
  budget_sensitivity: "Medium",
  system_prompt: "You are a practical buyer.",
  profileSchemaVersion: 2,
  profile,
};
class LocalStorage {
  items = new Map();
  getItem(key) {
    return this.items.get(key) ?? null;
  }
  setItem(key, value) {
    this.items.set(key, value);
  }
}
function stripProfiles(state) {
  for (const a of state.data.archetypes) {
    delete a.profile;
    delete a.profileSchemaVersion;
    delete a.profileRevision;
  }
  return state;
}

test("public profile accepts unknowns by omission and validates schema, provenance and UTF-8 limits", () => {
  assert.deepEqual(parsePersonaProfile(profile), profile);
  assert.deepEqual(parsePersonaProfile({}), {});
  assert.equal(parsePersonaProfile({ goals: [] }).companySize, undefined);
  assert.deepEqual(parseDraft(draft).profile, profile);
  const legacy = { ...draft };
  delete legacy.profile;
  delete legacy.profileSchemaVersion;
  assert.deepEqual(parseDraft(legacy), legacy);
  for (const invalid of [
    { ...draft, profileSchemaVersion: 3 },
    { ...draft, profileSchemaVersion: undefined },
    { ...draft, profile: undefined },
    { ...draft, profile: null },
    { ...draft, budget_sensitivity: { toString: () => "Medium" } },
  ])
    assert.throws(() => parseDraft(invalid));
  for (const invalid of [
    { unknownField: "not silently discarded" },
    { goals: "not an array" },
    { goals: Array(13).fill("a") },
    { goals: ["a".repeat(501)] },
    { goals: [false] },
    { industry: null },
    { background: "a".repeat(2401) },
    { goals: ["x"], provenance: { goals: "verified-by-the-model" } },
    { provenance: { goals: "provided" } },
    { goals: Array(12).fill("界".repeat(400)) },
  ])
    assert.throws(() => parsePersonaProfile(invalid));
  assert.equal(PROFILE_MAX_BYTES, 12000);
});

test("legacy and Base44 field mapping preserves explicit content without inferring missing facts", () => {
  const result = profileFromLegacy({
    company_size: "20",
    age_range: "30–40",
    description: "A short bio",
    goals: "Goal one\nGoal two",
    pain_points: "A pain point",
    buying_motivations: "Useful data",
    objections: "Setup effort",
    communication_style: "Informal",
  });
  assert.equal(result.companySize, "20");
  assert.equal(result.ageRange, "30–40");
  assert.equal(result.background, "A short bio");
  assert.deepEqual(result.goals, ["Goal one", "Goal two"]);
  assert.deepEqual(result.painPoints, ["A pain point"]);
  assert.deepEqual(result.buyingMotivations, ["Useful data"]);
  assert.deepEqual(result.typicalObjections, ["Setup effort"]);
  assert.equal(result.communicationStyle, "Informal");
  assert.equal(result.provenance.goals, "legacy");
  assert.equal(result.decisionAuthority, undefined);
  assert.equal(profileFromLegacy({ name: "Only a name" }), undefined);
});

test("rich profile round-trips through save, snapshot and immutable conversation/continuation snapshots", async () => {
  const repo = new MemoryRepository(),
    aid = randomUUID(),
    cid = randomUUID();
  const input = {
    action: "save_archetype",
    id: aid,
    draft: { ...draft, profileRevision: 99, privateMetadata: "DO_NOT_SAVE" },
  };
  await studio(input, repo);
  await studio(input, repo);
  const a = repo.state.data.archetypes.find((a) => a.id === aid);
  assert.equal(a.profileRevision, 1);
  assert.deepEqual(a.profile, profile);
  assert.equal(a.privateMetadata, undefined);
  assert.equal(
    repo.state.data.archetypes.filter((a) => a.id === aid).length,
    1,
  );
  await studio(
    {
      action: "create_conversation",
      id: cid,
      archetypeId: aid,
      intent: {
        objective: "Explore value",
        proposition: "Reporting tool",
        targetDecision: "Agree to a demo",
      },
    },
    repo,
  );
  const frozen = structuredClone(repo.state.conversations[0]);
  // Simulate a later catalogue revision; the edit endpoint belongs to step two.
  repo.state.data.archetypes.find((a) => a.id === aid).profile.goals = [
    "Changed in the catalogue",
  ];
  assert.deepEqual(repo.state.conversations[0], frozen);
  const publicCopy = snapshot(repo.state);
  assert.deepEqual(publicCopy.conversations[0].archetype.profile, profile);
  publicCopy.conversations[0].archetype.profile.goals.push("Browser-only edit");
  assert.deepEqual(repo.state.conversations[0], frozen);
  await studio(
    {
      action: "continue_conversation",
      id: randomUUID(),
      sourceId: cid,
      summary: "Continue the same test.",
    },
    repo,
  );
  assert.deepEqual(repo.state.conversations[1].archetype, frozen.archetype);
  assert.deepEqual(repo.state.conversations[1].intent, frozen.intent);
});

test("compatibility enriches only untouched seed rows and preserves history, custom rows, priors and ledger byte-for-byte", async () => {
  const repo = new MemoryRepository();
  stripProfiles(repo.state);
  await conversation(repo);
  await runOperation(
    "dialogue",
    request(repo.state.conversations[0].id),
    repo,
    {
      jev: async () => jevResponse(),
      gemini: async () =>
        geminiResponse("  Keep this exact reply.\n\nIncluding spacing.  "),
    },
  );
  repo.state.data.archetypes[1].system_prompt += " Custom wording.";
  repo.state.data.archetypes[2].customFlag = true;
  repo.state.personaPrivateByRevision = {
    privateFixture: { neverMigrate: "PRIVATE_FIXTURE" },
  };
  const before = structuredClone(repo.state),
    encoded = JSON.stringify(before);
  const result = upgradePersonaStore(repo.state);
  assert.ok(result.data.archetypes[0].profile.goals.length);
  assert.equal(result.data.archetypes[0].profileRevision, 1);
  assert.deepEqual(result.data.archetypes[1], before.data.archetypes[1]);
  assert.deepEqual(result.data.archetypes[2], before.data.archetypes[2]);
  for (const key of [
    "conversations",
    "operations",
    "adjustments",
    "personaPrivateByRevision",
  ])
    assert.equal(JSON.stringify(result[key]), JSON.stringify(before[key]));
  assert.equal(
    JSON.stringify(result.data.messages),
    JSON.stringify(before.data.messages),
  );
  assert.equal(
    JSON.stringify(result.data.conversations),
    JSON.stringify(before.data.conversations),
  );
  assert.equal(
    result.data.archetypes[0].system_prompt,
    before.data.archetypes[0].system_prompt,
  );
  assert.equal(JSON.stringify(repo.state), encoded);
  assert.deepEqual(upgradePersonaStore(result), result);
  const invalid = structuredClone(result);
  invalid.data.archetypes[0].profileSchemaVersion = 99;
  assert.throws(() => upgradePersonaStore(invalid));
  assert.equal(invalid.data.archetypes[0].profileSchemaVersion, 99);
});

test("local persistence retains rich legacy fields and strips internal metadata on load and save", () => {
  const storage = new LocalStorage();
  const original = JSON.stringify([
    {
      id: "custom",
      name: "Casey",
      role: "Founder",
      budgetSensitivity: "High",
      systemPrompt: "You are Casey.",
      bio: "A practical founder",
      goals: ["Reliable service"],
      buyingTriggers: ["Relevant evidence"],
      commonObjections: ["Setup"],
      tone: "Plain spoken",
    },
  ]);
  storage.setItem("personaflow_custom_personas", original);
  const data = loadStudio(storage),
    custom = data.archetypes.at(-1);
  assert.equal(custom.profile.background, "A practical founder");
  assert.deepEqual(custom.profile.buyingMotivations, ["Relevant evidence"]);
  assert.equal(custom.profile.communicationStyle, "Plain spoken");
  data.privateMetadata = "INTERNAL_SENTINEL";
  custom.privateMetadata = "INTERNAL_SENTINEL";
  saveStudio(data, storage);
  assert.equal(
    storage.getItem(STORAGE_KEY).includes("INTERNAL_SENTINEL"),
    false,
  );
  assert.deepEqual(loadStudio(storage), publicStudioData(data));
  assert.equal(storage.getItem("personaflow_custom_personas"), original);
  // Existing local data is projected too; a read does not rewrite the stored bytes.
  const raw = JSON.stringify({
    ...publicStudioData(data),
    privateMetadata: "INTERNAL_SENTINEL",
  });
  storage.setItem(STORAGE_KEY, raw);
  assert.equal(
    JSON.stringify(loadStudio(storage)).includes("INTERNAL_SENTINEL"),
    false,
  );
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test("public snapshots deeply allowlist persona, evaluation, memory and operation metadata", async () => {
  const repo = new MemoryRepository(),
    cid = await conversation(repo);
  await runOperation("dialogue", request(cid), repo, {
    jev: async () => jevResponse(),
    gemini: async () => geminiResponse(),
  });
  const secret = "INTERNAL_ONLY_TEST_SENTINEL",
    c = repo.state.conversations[0];
  const attach = (v) => {
    v.internalMetadata = { secret };
  };
  [
    repo.state.data,
    ...repo.state.data.users,
    ...repo.state.data.archetypes,
    ...repo.state.data.conversations,
    ...repo.state.data.messages,
    c,
    c.archetype,
    c.intent,
    c.state,
    c.state.concerns[0],
    repo.state.operations[0],
  ]
    .filter(Boolean)
    .forEach(attach);
  c.archetype.profile.internalMetadata = secret;
  c.archetype.profile.provenance.internalMetadata = secret;
  c.observedState = { ...structuredClone(c.state), internalMetadata: secret };
  c.memory = {
    schemaVersion: 1,
    version: 1,
    lastSummarisedTurnId: "test",
    omittedSellerParagraphs: 0,
    internalMetadata: secret,
    entries: [
      {
        turnId: "test",
        speaker: "assistant",
        kind: "buyer_statement",
        quote: "Known quote",
        internalMetadata: secret,
      },
    ],
  };
  const reply = repo.state.data.messages.at(-1);
  attach(reply.evaluation);
  attach(reply.telemetry);
  repo.state.personaPrivateByRevision = {
    fixture: { latentMotivationProfile: secret },
  };
  const out = snapshot(repo.state);
  assert.equal(JSON.stringify(out).includes(secret), false);
  assert.equal(out.conversations[0].memory.entries[0].quote, "Known quote");
  assert.equal(
    out.conversations[0].archetype.profile.goals[0],
    c.archetype.profile.goals[0],
  );
  assert.equal(repo.state.conversations[0].internalMetadata.secret, secret);
});

test("fresh and replayed generation and dialogue responses cannot return extra internal fields", async () => {
  const repo = new MemoryRepository(),
    generation = { requestId: randomUUID(), description: "A practical buyer" };
  const secret = "OPERATION_PRIVATE_SENTINEL";
  const generated = await runOperation("archetype", generation, repo, {
    jev: async () => assert.fail("No JEV for synthesis"),
    gemini: async () =>
      geminiResponse(JSON.stringify({ ...draft, internalMetadata: secret })),
  });
  assert.deepEqual(generated.result.profile, profile);
  repo.state.operations[0].result.internalMetadata = secret;
  repo.state.operations[0].result.profile.internalMetadata = secret;
  const replayed = await runOperation("archetype", generation, repo, {
    jev: async () => assert.fail(),
    gemini: async () => assert.fail(),
  });
  assert.equal(JSON.stringify(replayed).includes(secret), false);
  const cid = await conversation(repo),
    req = request(cid);
  await runOperation("dialogue", req, repo, {
    jev: async () => jevResponse(),
    gemini: async () => geminiResponse(),
  });
  const op = repo.state.operations.at(-1);
  op.result.internalMetadata = secret;
  op.result.state.internalMetadata = secret;
  op.result.telemetry.internalMetadata = secret;
  const repeat = await runOperation("dialogue", req, repo, {
    jev: async () => assert.fail(),
    gemini: async () => assert.fail(),
  });
  assert.equal(JSON.stringify(repeat).includes(secret), false);
});

test("Supabase compatibility read is non-writing, survives CAS retry and persists additive data on the next mutation", async () => {
  const backend = new MemoryRepository();
  stripProfiles(backend.state);
  const original = JSON.stringify(backend.state),
    fetch = globalThis.fetch;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  let writes = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, "Bearer test-service-role");
    const body = JSON.parse(options.body);
    if (url.endsWith("studio_read")) return Response.json(await backend.read());
    assert.ok(url.endsWith("studio_write"));
    writes++;
    if (writes === 1) {
      backend.revision++;
      return Response.json(false);
    }
    return Response.json(
      await backend.compareAndSwap(body.expected_revision, body.next_state),
    );
  };
  try {
    const repo = createRepository(),
      read = await repo.read();
    assert.ok(read.state.data.archetypes[0].profile);
    assert.equal(writes, 0);
    assert.equal(JSON.stringify(backend.state), original);
    await mutate(repo, (s) => {
      s.data.users[0].display_name = "Updated display name";
    });
    assert.equal(writes, 2);
    assert.equal(backend.state.schemaVersion, 1);
    assert.equal(backend.state.data.version, 1);
    assert.ok(backend.state.data.archetypes[0].profile);
    assert.equal(
      backend.state.data.users[0].display_name,
      "Updated display name",
    );
    assert.deepEqual((await repo.read()).state, backend.state);
  } finally {
    globalThis.fetch = fetch;
  }
});

test("new seed profiles preserve useful source fields and private revision keys are unambiguous", () => {
  const repo = new MemoryRepository(),
    marcus = repo.state.data.archetypes.find((a) => a.id === "marcus-growth");
  assert.equal(marcus.budget_sensitivity, "Low");
  assert.ok(marcus.profile.goals.some((x) => x.includes("20%")));
  assert.equal(
    marcus.profile.communicationStyle,
    "Metric-obsessed, crisp, ambitious, growth-minded",
  );
  assert.equal(marcus.profile.provenance.background, "seed");
  assert.deepEqual(upgradePersonaData(repo.state.data), repo.state.data);
  assert.notEqual(privatePersonaKey("id:1", 2), privatePersonaKey("id", 12));
  assert.throws(() => privatePersonaKey("id", 0));
  assert.throws(() => privatePersonaKey("id", 1.5));
  // SQL compatibility is an explicit invariant of this step, not a live schema claim.
  const sql = readFileSync(
    new URL("../migrations/001_private_studio.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /schemaVersion.*distinct from '1'/);
});
