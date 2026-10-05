import type { Archetype, StudioData, Telemetry } from "./database.types";
export interface ConversationIntent {
  objective: string;
  proposition: string;
  targetDecision: string;
}
export interface DecisionState {
  version: number;
  readinessIndex: number | null;
  confidence: number;
  sentiment: string;
  friction: string;
  responseAction:
    "clarify" | "request_evidence" | "explore" | "decline" | "agree_next_step";
  unresolvedObjections: string[];
  jevModel: string;
  rubricVersion: string;
}
export interface LiveConversation {
  id: string;
  archetype: Archetype;
  intent: ConversationIntent;
  version: number;
  state: DecisionState | null;
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
  state: DecisionState;
  version: number;
}
