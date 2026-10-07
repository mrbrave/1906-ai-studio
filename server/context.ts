import type {
  ConversationMemory,
  LiveConversation,
  MemoryEntry,
} from "../src/types/live";
import type { Message } from "../src/types/database.types";
import { HttpError } from "./http.js";
export const CONTEXT_BYTES = 48000;
export const MEMORY_BYTES = 12000;
export const RECENT_MESSAGES = 4;
export const COMPACT_AFTER_BYTES = 12000;
export const CONTINUATION_ERROR =
  "The bounded working context is full. Your transcript and draft are preserved. Review a linked continuation summary to continue with the same target decision.";
const bytes = (v: unknown) => Buffer.byteLength(JSON.stringify(v));
// Extractive, never generative: retain exact paragraphs, attribution and turn references.
// Every older buyer paragraph and seller paragraph containing a condition, question,
// figure or commitment is mandatory. No repeated rewriting of prior evidence.
const decisive =
  /\d|[$€£]|\?|\b(if|unless|subject to|provided|only|must|shall|will|won't|cannot|can't|not|never|agree|accept|reject|condition|confidential|nda|scope|timeline|ownership|approval|guarantee|price|cost|fee|aud|usd|gst|days?|weeks?|months?|hours?|minutes?|delivery|deadline|pilot|module|review|evidence)\b/i;
export function latestState(c: LiveConversation) {
  return c.observedState && c.observedState.version >= (c.state?.version ?? 0)
    ? c.observedState
    : c.state;
}
export function workingContext(c: LiveConversation, history: Message[]) {
  let memory = c.memory ? structuredClone(c.memory) : undefined;
  let remaining = history;
  if (memory) {
    const index = history.findIndex(
      (m) => m.id === memory!.lastSummarisedTurnId,
    );
    if (index < 0)
      throw new HttpError(
        409,
        "Saved context reference is missing. Restore the transcript before continuing.",
      );
    validateMemory(memory, history);
    remaining = history.slice(index + 1);
  }
  if (
    bytes(remaining.map((m) => m.content)) > COMPACT_AFTER_BYTES &&
    remaining.length > RECENT_MESSAGES
  ) {
    const older = remaining.slice(0, -RECENT_MESSAGES);
    const entries = memory?.entries ?? [];
    let omitted = memory?.omittedSellerParagraphs ?? 0;
    for (const m of older) {
      const paragraphs = m.content.split(/\n\s*\n/).filter((x) => x.trim());
      paragraphs.forEach((quote, i) => {
        if (
          m.role === "assistant" ||
          i === 0 ||
          i === paragraphs.length - 1 ||
          decisive.test(quote)
        )
          entries.push({
            turnId: m.id,
            speaker: m.role,
            kind: m.role === "assistant" ? "buyer_statement" : "seller_claim",
            quote,
          });
        else omitted++;
      });
    }
    memory = {
      schemaVersion: 1,
      version: (memory?.version ?? 0) + 1,
      lastSummarisedTurnId: older.at(-1)!.id,
      entries,
      omittedSellerParagraphs: omitted,
    };
    remaining = remaining.slice(-RECENT_MESSAGES);
  }
  if (memory && bytes(memory) > MEMORY_BYTES)
    throw new HttpError(413, CONTINUATION_ERROR);
  return { memory, recent: remaining };
}
export function validateMemory(memory: ConversationMemory, history: Message[]) {
  if (memory.schemaVersion !== 1)
    throw new HttpError(409, "Unsupported context version.");
  for (const entry of memory.entries) {
    const m = history.find((m) => m.id === entry.turnId);
    if (
      !m ||
      m.role !== entry.speaker ||
      !m.content.split(/\n\s*\n/).includes(entry.quote) ||
      entry.kind !==
        (m.role === "assistant" ? "buyer_statement" : "seller_claim")
    )
      throw new HttpError(
        409,
        "Context evidence failed transcript validation.",
      );
  }
}
export function contextData(
  c: LiveConversation,
  history: Message[],
  pitch: string,
  phase: string,
) {
  const { memory, recent } = workingContext(c, history);
  return {
    archetype: {
      name: c.archetype.name,
      role: c.archetype.role,
      system_prompt: c.archetype.system_prompt,
      budget_sensitivity: c.archetype.budget_sensitivity,
    },
    conversationIntent: c.intent,
    previousState: latestState(c),
    phase,
    memory,
    continuationSummary: c.continuationSummary
      ? {
          sourceConversationId: c.continuationOf,
          text: c.continuationSummary,
          provenance:
            "User-reviewed summary; claims are not independently verified",
        }
      : undefined,
    history: recent.map((m) => ({
      id: m.id,
      speaker: m.role === "user" ? "marketer" : "synthetic_buyer",
      text: m.content,
    })),
    newMessage: pitch,
  };
}
export function assertContext(body: unknown) {
  if (bytes(body) > CONTEXT_BYTES) throw new HttpError(413, CONTINUATION_ERROR);
}
