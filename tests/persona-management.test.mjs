import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MemoryRepository, configure, conversation } from "./helpers.mjs";
import { studio } from "../server/studio.ts";
import { parseDraft } from "../src/api/validation.ts";
import { publicStudioData } from "../src/api/publicData.ts";
import {
  editPersona,
  freezeDemoPersonas,
  archivePersona,
} from "../src/services/personaManagement.ts";
import {
  personaEditorSession,
  completePersonaDraft,
  profileInputs,
  editablePrompt,
} from "../src/services/personaEditor.ts";
import { loadStudio, saveStudio } from "../src/services/storageService.ts";
configure();

function editRequest(persona, overrides = {}) {
  return {
    action: "update_archetype",
    id: persona.id,
    requestId: randomUUID(),
    expectedRevision: persona.profileRevision ?? 1,
    draft: { ...parseDraft(persona), role: "Growth lead", ...overrides },
  };
}

test("persona edits are revision checked and idempotent, and freeze existing live conversations", async () => {
  const repo = new MemoryRepository();
  await conversation(repo);
  const before = structuredClone(repo.state);
  const persona = before.data.archetypes[0];
  repo.state.personaPrivateByRevision = { "old-revision": { private: true } };
  const request = editRequest(persona);
  const result = await studio(request, repo);
  assert.equal(result.data.archetypes[0].profileRevision, 2);
  assert.equal(result.data.archetypes[0].role, "Growth lead");
  assert.deepEqual(repo.state.conversations, before.conversations);
  assert.deepEqual(repo.state.data.conversations, before.data.conversations);
  assert.deepEqual(repo.state.data.messages, before.data.messages);
  assert.deepEqual(repo.state.personaPrivateByRevision, {
    "old-revision": { private: true },
  });
  assert.equal("personaMutations" in result, false);
  assert.equal("personaPrivateByRevision" in result, false);
  await studio(request, repo);
  assert.equal(repo.state.data.archetypes[0].profileRevision, 2);
  assert.equal(repo.state.personaMutations.length, 1);
  await assert.rejects(
    studio(editRequest(persona), repo),
    (e) => e.status === 409,
  );
  await assert.rejects(
    studio(
      { ...request, draft: { ...request.draft, name: "Different buyer" } },
      repo,
    ),
    (e) => e.status === 409,
  );
  await conversation(repo);
  assert.equal(repo.state.conversations[1].archetype.profileRevision, 2);
});

test("simultaneous edits have a single winner and retain the losing draft outside storage", async () => {
  const repo = new MemoryRepository();
  const persona = repo.state.data.archetypes[0];
  const requests = [
    editRequest(persona, { name: "First" }),
    editRequest(persona, { name: "Second" }),
  ];
  const results = await Promise.allSettled(
    requests.map((r) => studio(r, repo)),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.find((r) => r.status === "rejected").reason.status, 409);
  assert.equal(repo.state.data.archetypes[0].profileRevision, 2);
  assert.equal(requests[1].draft.name, "Second");
});

test("archive is reversible, blocks new sessions and keeps old conversations and continuations", async () => {
  const repo = new MemoryRepository();
  const source = await conversation(repo);
  const before = structuredClone(repo.state.conversations);
  const a = repo.state.data.archetypes[0];
  const archive = {
    action: "archive_archetype",
    id: a.id,
    expectedRevision: a.profileRevision,
    requestId: randomUUID(),
    archived: true,
  };
  await studio(archive, repo);
  const archivedAt = repo.state.data.archetypes[0].archived_at;
  await studio(archive, repo);
  assert.equal(repo.state.data.archetypes[0].archived_at, archivedAt);
  assert.equal(
    repo.state.data.archetypes[0].profileRevision,
    a.profileRevision,
  );
  await assert.rejects(conversation(repo), (e) => e.status === 409);
  await assert.rejects(studio(editRequest(a), repo), (e) => e.status === 409);
  assert.deepEqual(repo.state.conversations, before);
  await studio(
    {
      action: "continue_conversation",
      id: randomUUID(),
      sourceId: source,
      summary: "Buyer context reviewed",
    },
    repo,
  );
  assert.deepEqual(repo.state.conversations[1].archetype, before[0].archetype);
  await studio({ ...archive, requestId: randomUUID(), archived: false }, repo);
  await studio(archive, repo); // Late retry of the old archive cannot undo the restore.
  assert.equal(repo.state.data.archetypes[0].archived_at, undefined);
  await conversation(repo);
  await assert.rejects(
    studio({ ...archive, requestId: randomUUID(), expectedRevision: 0 }, repo),
    (e) => e.status === 400,
  );
});

test("duplication reviews a public draft and creates a new independent revision with no history", async () => {
  const repo = new MemoryRepository();
  const a = repo.state.data.archetypes[0];
  const before = structuredClone(a);
  const session = personaEditorSession("duplicate", a);
  assert.notEqual(session.key, a.id);
  assert.match(session.draft.name, /\(copy\)$/);
  assert.equal(session.draft.profileRevision, undefined);
  const request = {
    action: "save_archetype",
    id: session.key,
    draft: session.draft,
  };
  await studio(request, repo);
  await studio(request, repo);
  assert.deepEqual(repo.state.data.archetypes[0], before);
  const copy = repo.state.data.archetypes.find((a) => a.id === session.key);
  assert.equal(copy.profileRevision, 1);
  assert.deepEqual(copy.profile, a.profile);
  assert.deepEqual(repo.state.conversations, []);
});

test("manual profile creates usable legacy instructions and preserves field provenance on later edits", () => {
  const base = {
    name: "Marcus",
    role: "Head of Growth",
    budget_sensitivity: "Medium",
    system_prompt: "",
  };
  const inputs = profileInputs();
  inputs.industry = "SaaS";
  inputs.goals = "Useful reporting\nClear differentiation";
  inputs.communicationStyle = "Direct and measured";
  const draft = completePersonaDraft(base, inputs);
  assert.match(draft.system_prompt, /Useful reporting/);
  assert.equal(draft.profile.provenance.industry, "provided");
  assert.equal(editablePrompt(draft), "");
  const editedInputs = profileInputs(draft.profile);
  editedInputs.industry = "Consulting";
  const edited = completePersonaDraft(
    { ...draft, system_prompt: editablePrompt(draft) },
    editedInputs,
    draft.profile,
  );
  assert.match(edited.system_prompt, /Consulting/);
  assert.doesNotMatch(edited.system_prompt, /SaaS/);
  const legacy = completePersonaDraft(
    { ...base, system_prompt: "Keep my custom instructions." },
    inputs,
  );
  assert.equal(legacy.system_prompt, "Keep my custom instructions.");
  const original = {
    goals: ["  Exact wording  "],
    painPoints: [],
    provenance: { goals: "inferred", painPoints: "seed" },
  };
  assert.deepEqual(
    completePersonaDraft(base, profileInputs(original), original).profile,
    original,
  );
  editedInputs.goals = Array(13).fill("An item").join("\n");
  assert.throws(
    () => completePersonaDraft(base, editedInputs),
    /Goals allows up to 12/,
  );
});

test("legacy demo history gets a public frozen snapshot before editing and survives storage reload", () => {
  let data = new MemoryRepository().state.data;
  const a = data.archetypes[0];
  data.conversations.push({
    id: randomUUID(),
    user_id: a.user_id,
    archetype_id: a.id,
    title: "Existing demo",
    created_at: a.created_at,
    updated_at: a.created_at,
  });
  data = editPersona(
    freezeDemoPersonas(data, a.id),
    a.id,
    1,
    { ...parseDraft(a), name: "Updated name" },
    a.created_at,
  );
  data = archivePersona(data, a.id, 2, true, a.created_at);
  assert.deepEqual(data.conversations[0].archetype_snapshot, a);
  let raw = "";
  const storage = {
    getItem: () => raw,
    setItem: (_, value) => {
      raw = value;
    },
  };
  saveStudio(data, storage);
  const loaded = loadStudio(storage);
  assert.deepEqual(loaded.conversations[0].archetype_snapshot, a);
  loaded.conversations[0].archetype_snapshot.privateMetadata = { hidden: true };
  assert.equal(
    publicStudioData(loaded).conversations[0].archetype_snapshot
      .privateMetadata,
    undefined,
  );
});
