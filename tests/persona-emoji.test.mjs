import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  avatarEmoji,
  AVATAR_OPTIONS,
  DEFAULT_AVATAR,
} from "../src/api/avatar.ts";
import { parseDraft } from "../src/api/validation.ts";
import { personaEditorSession } from "../src/services/personaEditor.ts";
import { MemoryRepository, configure, conversation } from "./helpers.mjs";
import { studio } from "../server/studio.ts";

test("emoji validation supports joined, skin-tone, flag and keycap emoji and rejects text or multiple emoji", () => {
  for (const value of [...AVATAR_OPTIONS, "👩🏽‍💻", "🇦🇺", "1️⃣", "👨‍👩‍👧‍👦"])
    assert.equal(avatarEmoji(value), value);
  for (const value of [
    null,
    "",
    "abc",
    "1",
    "🏽",
    "🎯🎯",
    "🎯hello",
    "🎯\u0301",
    "<img>",
  ])
    assert.throws(() => avatarEmoji(value));
  assert.equal(avatarEmoji(" 🐨 "), "🐨");
});

test("create, replay, edit and duplicate preserve emojis and old conversations; legacy callers can omit avatar", async () => {
  configure();
  const repo = new MemoryRepository();
  await conversation(repo);
  const before = structuredClone(repo.state.conversations);
  const a = repo.state.data.archetypes[0];
  const draft = { ...parseDraft(a), avatar: "🐨" };
  await studio(
    {
      action: "update_archetype",
      id: a.id,
      expectedRevision: 1,
      requestId: randomUUID(),
      draft,
    },
    repo,
  );
  assert.equal(repo.state.data.archetypes[0].avatar, "🐨");
  assert.deepEqual(repo.state.conversations, before);
  const copy = personaEditorSession("duplicate", repo.state.data.archetypes[0]);
  assert.equal(copy.draft.avatar, "🐨");
  const create = { action: "save_archetype", id: copy.key, draft: copy.draft };
  await studio(create, repo);
  await studio(create, repo);
  assert.equal(
    repo.state.data.archetypes.find((v) => v.id === copy.key).avatar,
    "🐨",
  );
  await assert.rejects(
    studio({ ...create, draft: { ...copy.draft, avatar: "🦊" } }, repo),
    (e) => e.status === 409,
  );
  const legacy = { ...draft };
  delete legacy.avatar;
  assert.equal(parseDraft(legacy).avatar, undefined);
  await studio(
    {
      action: "update_archetype",
      id: a.id,
      expectedRevision: 2,
      requestId: randomUUID(),
      draft: legacy,
    },
    repo,
  );
  assert.equal(repo.state.data.archetypes[0].avatar, "🐨");
  const olderCreate = {
    action: "save_archetype",
    id: randomUUID(),
    draft: legacy,
  };
  await studio(olderCreate, repo);
  await studio(olderCreate, repo);
  assert.equal(repo.state.data.archetypes.at(-1).avatar, DEFAULT_AVATAR);
});

test("older non-emoji display strings remain loadable and unchanged by an unrelated edit", async () => {
  const { validateData } = await import("../src/services/storageService.ts");
  const { upgradePersonaData } =
    await import("../src/services/personaCompatibility.ts");
  const { editPersona } = await import("../src/services/personaManagement.ts");
  const repo = new MemoryRepository();
  const a = repo.state.data.archetypes[0];
  a.avatar = "Legacy portrait";
  const data = upgradePersonaData(validateData(repo.state.data));
  const editor = personaEditorSession("edit", a);
  assert.equal(editor.draft.avatar, undefined);
  const edited = editPersona(
    data,
    a.id,
    1,
    { ...editor.draft, role: "Updated role" },
    new Date().toISOString(),
  );
  assert.equal(edited.archetypes[0].avatar, "Legacy portrait");
  assert.equal(a.avatar, "Legacy portrait");
});
