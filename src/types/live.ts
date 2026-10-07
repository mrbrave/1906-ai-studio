import type { Archetype, StudioData, Telemetry } from "./database.types";
export interface ConversationIntent {
  objective: string;
  proposition: string;
  targetDecision: string;
}
export interface DecisionState {
  version: number;
  readinessIndex: number | null;
  confidence: number | null;
  sentiment: string;
  friction: string;
  responseAction:
    | "clarify"
    | "request_evidence"
    | "explore"
    | "decline"
    | "agree_next_step"
    | "discuss_conditions";
  unresolvedObjections: string[];
  jevModel: string;
  rubricVersion: string;
  phase?: "pre_reply" | "post_reply";
  evaluatedThrough?: string;
  status?: "complete" | "provisional" | "unavailable";
  unavailableReason?: string;
  readinessConfidence?: number | null;
  sentimentConfidence?: number | null;
  frictionConfidence?: number | null;
  evidenceSufficiency?: number | null;
  stance?: string;
  stanceConfidence?: number | null;
  remainingConditions?: string[];
  missingInformation?: string[];
  concerns?: Concern[];
}
export interface Concern {
  category: string;
  status: "active" | "resolved" | "reopened";
  turnId: string;
  evidenceTurnId?: string;
}
export interface MemoryEntry {
  turnId: string;
  speaker: "user" | "assistant";
  kind: "seller_claim" | "buyer_statement";
  quote: string;
}
export interface ConversationMemory {
  schemaVersion: 1;
  version: number;
  lastSummarisedTurnId: string;
  entries: MemoryEntry[];
  omittedSellerParagraphs: number;
}
export interface LiveConversation {
  id: string;
  archetype: Archetype;
  intent: ConversationIntent;
  version: number;
  state: DecisionState | null;
  observedState?: DecisionState | null;
  memory?: ConversationMemory;
  continuationOf?: string;
  continuationSummary?: string;
}
export interface UsageSummary {
  remainingPercentage: number;
  status: "available" | "exhausted" | "pending" | "review_required";
  updatedAt: string;
}
export interface LiveSnapshot {
  data: StudioData;
  conversations: LiveConversation[];
  usage: UsageSummary;
  operations: {
    id: string;
    conversationId?: string;
    status: string;
    error?: string;
  }[];
}
export interface TurnResult {
  text: string;
  telemetry: Telemetry;
  replyId?: string;
  state: DecisionState;
  version: number;
}
