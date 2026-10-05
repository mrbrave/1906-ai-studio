import type { Archetype } from "../types/database.types";
export type ArchetypeDraft = Pick<
  Archetype,
  "name" | "role" | "budget_sensitivity" | "system_prompt"
>;
