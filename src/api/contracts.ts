import type { Archetype } from "../types/database.types";
export type ArchetypeDraft = Pick<
  Archetype,
  | "name"
  | "avatar"
  | "role"
  | "budget_sensitivity"
  | "system_prompt"
  | "profile"
  | "profileSchemaVersion"
  | "synthesisReview"
>;
