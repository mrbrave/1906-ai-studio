import type { Archetype, Message, Provider } from "../types/database.types";
export interface DialogueRequest {
  archetype: Archetype;
  pitch: string;
  history: Pick<Message, "role" | "content">[];
  provider: Exclude<Provider, "demo">;
}
export interface EvaluationRequest {
  archetype: Archetype;
  pitch: string;
  response: string;
}
export type ArchetypeDraft = Pick<
  Archetype,
  "name" | "role" | "budget_sensitivity" | "system_prompt"
>;
