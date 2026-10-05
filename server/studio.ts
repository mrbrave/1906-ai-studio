import { nonEmpty, parseDraft, record } from "../src/api/validation.js";
import type { ConversationIntent, LiveSnapshot } from "../src/types/live";
import { usage } from "./budget.js";
import {
  mutate,
  STUDIO_USER,
  type Repository,
  type Store,
} from "./repository.js";
import { HttpError } from "./http.js";
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
    data: s.data,
    conversations: s.conversations,
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
  if (b.action === "snapshot") return snapshot((await repo.read()).state);
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
      if (s.conversations.length >= 100)
        throw new HttpError(
          409,
          "Test conversation limit reached. Archive the test store before continuing.",
        );
      const now = new Date().toISOString();
      s.conversations.push({
        id: key,
        archetype: structuredClone(a),
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
