import { nonEmpty, parseDraft, record } from "../src/api/validation.js";
import { createHash } from "node:crypto";
import {
  archivePersona,
  editPersona,
  PersonaError,
} from "../src/services/personaManagement.js";
import type { ConversationIntent, LiveSnapshot } from "../src/types/live";
import { usage } from "./budget.js";
import {
  mutate,
  STUDIO_USER,
  type Repository,
  type Store,
} from "./repository.js";
import { HttpError } from "./http.js";
import {
  publicLiveConversation,
  publicStudioData,
} from "../src/api/publicData.js";
export function id(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new HttpError(400, "Invalid request identifier.");
  return value;
}
export function intent(value: unknown): ConversationIntent {
  const v = record(value);
  return {
    objective: nonEmpty(v.objective, 1000),
    proposition: nonEmpty(v.proposition, 2000),
    targetDecision: nonEmpty(v.targetDecision, 1000),
  };
}
export function snapshot(s: Store): LiveSnapshot {
  // Explicit public projection: never expose dollar amounts, attempts, raw receipts or rates.
  return {
    data: publicStudioData(s.data),
    conversations: s.conversations.map(publicLiveConversation),
    usage: usage(s),
    operations: s.operations.map((o) => ({
      id: o.id,
      conversationId: o.conversationId,
      status: o.status,
      error: o.error,
    })),
  };
}
export async function studio(value: unknown, repo: Repository) {
  const b = record(value);
  if (b.action === "continue_conversation") {
    const key = id(b.id),
      sourceId = id(b.sourceId),
      summary = nonEmpty(b.summary, 8000);
    await mutate(repo, (s) => {
      const source = s.conversations.find((c) => c.id === sourceId);
      if (!source) throw new HttpError(404, "Source dialogue not found.");
      const existing = s.conversations.find((c) => c.id === key);
      if (existing) {
        if (
          existing.continuationOf !== sourceId ||
          existing.continuationSummary !== summary
        )
          throw new HttpError(409, "Continuation ID conflict.");
        return;
      }
      if (s.conversations.length >= 100)
        throw new HttpError(
          409,
          "Test conversation quota reached. Archive before creating a continuation.",
        );
      if (
        s.operations.some(
          (o) =>
            o.conversationId === sourceId &&
            ["running", "uncertain"].includes(o.status) &&
            o.kind === "dialogue",
        )
      )
        throw new HttpError(
          409,
          "Recover the unfinished reply before creating a continuation.",
        );
      s.conversations.push({
        id: key,
        archetype: structuredClone(source.archetype),
        intent: structuredClone(source.intent),
        version: 0,
        state: null,
        continuationOf: sourceId,
        continuationSummary: summary,
        ...(source.promptVersion
          ? { promptVersion: source.promptVersion }
          : {}),
      });
      const now = new Date().toISOString();
      s.data.conversations.unshift({
        id: key,
        user_id: STUDIO_USER,
        archetype_id: source.archetype.id,
        title: `Continuation · ${source.archetype.name}`,
        created_at: now,
        updated_at: now,
      });
    });
    return snapshot((await repo.read()).state);
  }
  if (b.action === "snapshot") return snapshot((await repo.read()).state);
  if (b.action === "update_archetype" || b.action === "archive_archetype") {
    const requestId = id(b.requestId),
      personaId = nonEmpty(b.id, 100);
    if (
      !Number.isSafeInteger(b.expectedRevision) ||
      Number(b.expectedRevision) < 1
    )
      throw new HttpError(400, "A valid persona revision is required.");
    const draft =
      b.action === "update_archetype" ? parseDraft(b.draft) : undefined;
    if (b.action === "archive_archetype" && typeof b.archived !== "boolean")
      throw new HttpError(
        400,
        "Choose whether to archive or restore the persona.",
      );
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          action: b.action,
          personaId,
          revision: b.expectedRevision,
          draft,
          archived: b.action === "archive_archetype" ? b.archived : undefined,
        }),
      )
      .digest("hex");
    await mutate(repo, (s) => {
      const receipt = s.personaMutations?.find((r) => r.id === requestId);
      if (receipt) {
        if (receipt.hash !== hash)
          throw new HttpError(409, "Persona request ID already used.");
        return;
      }
      try {
        s.data = draft
          ? editPersona(
              s.data,
              personaId,
              Number(b.expectedRevision),
              draft,
              new Date().toISOString(),
            )
          : archivePersona(
              s.data,
              personaId,
              Number(b.expectedRevision),
              b.archived as boolean,
              new Date().toISOString(),
            );
      } catch (e) {
        if (e instanceof PersonaError) throw new HttpError(e.status, e.message);
        throw e;
      }
      (s.personaMutations ??= []).push({ id: requestId, hash });
    });
    return snapshot((await repo.read()).state);
  }
  if (b.action === "save_archetype") {
    const draft = parseDraft(b.draft),
      key = id(b.id);
    await mutate(repo, (s) => {
      const existing = s.data.archetypes.find((a) => a.id === key);
      if (existing) {
        if (JSON.stringify(parseDraft(existing)) !== JSON.stringify(draft))
          throw new HttpError(409, "Archetype ID already used.");
        return;
      }
      s.data.archetypes.push({
        ...draft,
        id: key,
        user_id: STUDIO_USER,
        avatar: "🎯",
        created_at: new Date().toISOString(),
        profileRevision: 1,
      });
    });
  } else if (b.action === "create_conversation") {
    const target = intent(b.intent),
      key = id(b.id),
      archetypeId = nonEmpty(b.archetypeId, 100);
    await mutate(repo, (s) => {
      const existing = s.conversations.find((c) => c.id === key);
      if (existing) {
        if (
          existing.archetype.id !== archetypeId ||
          JSON.stringify(existing.intent) !== JSON.stringify(target)
        )
          throw new HttpError(409, "Conversation ID already used.");
        return;
      }
      const a = s.data.archetypes.find((a) => a.id === archetypeId);
      if (!a) throw new HttpError(404, "Archetype not found.");
      if (a.archived_at)
        throw new HttpError(
          409,
          "This persona is archived. Restore it before starting a new conversation.",
        );
      if (s.conversations.length >= 100)
        throw new HttpError(
          409,
          "Test conversation limit reached. Archive the test store before continuing.",
        );
      const now = new Date().toISOString();
      s.conversations.push({
        id: key,
        archetype: structuredClone(a),
        promptVersion: "persona-voice-v2",
        intent: target,
        version: 0,
        state: null,
      });
      s.data.conversations.unshift({
        id: key,
        user_id: STUDIO_USER,
        archetype_id: a.id,
        title: `Dialogue with ${a.name}`,
        created_at: now,
        updated_at: now,
      });
    });
  } else throw new HttpError(400, "Unknown Studio action.");
  return snapshot((await repo.read()).state);
}
