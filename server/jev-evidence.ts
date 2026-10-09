import type { LiveConversation } from "../src/types/live";
import type { Message } from "../src/types/database.types";
import type { BuyerEvidence } from "../src/types/evaluation";
import { workingContext, latestState } from "./context.js";

export const MAX_BUYER_EVIDENCE_CANDIDATES = 48;
/** Quotes already live in the bounded request context, so choices contain IDs only. */
export function buyerEvidenceCandidates(
  c: LiveConversation,
  history: Message[],
): BuyerEvidence[] {
  const { memory, recent } = workingContext(c, history);
  const byId = new Map<string, BuyerEvidence>();
  for (const e of memory?.entries ?? []) {
    if (e.speaker !== "assistant" || e.kind !== "buyer_statement") continue;
    const item = byId.get(e.turnId) ?? {
      turnId: e.turnId,
      source: "memory" as const,
      quotes: [],
    };
    item.quotes.push(e.quote);
    byId.set(e.turnId, item);
  }
  for (const m of recent)
    if (m.role === "assistant")
      byId.set(m.id, { turnId: m.id, source: "recent", quotes: [m.content] });
  const recentIds = history
    .filter((m) => m.role === "assistant")
    .slice(-12)
    .reverse()
    .map((m) => m.id);
  const previous = latestState(c);
  const referenced = [
    previous?.dimensions?.stanceEvidence.value?.turnId,
    previous?.dimensions?.frictionEvidence.value?.turnId,
    ...(previous?.concerns ?? [])
      .slice()
      .reverse()
      .map((x) => x.evidenceTurnId),
  ];
  const older = [...byId.keys()].filter((id) => !recentIds.includes(id));
  const priority = [...recentIds, ...referenced, older[0], ...older.reverse()];
  const selected = [...new Set(priority)]
    .filter((id): id is string => !!id && byId.has(id))
    .slice(0, MAX_BUYER_EVIDENCE_CANDIDATES);
  return selected.map((id) => byId.get(id)!);
}
export function evidenceChoices(candidates: BuyerEvidence[]) {
  return {
    none: "No supporting buyer statement",
    ...Object.fromEntries(candidates.map((e) => [e.turnId, null])),
  };
}
