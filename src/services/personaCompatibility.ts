import { DEFAULT_PERSONAS } from "../data/defaultPersonas.js";
import type { Archetype, StudioData } from "../types/database.types";
import type { BuyerPersona } from "../types/persona";
import { parseDraft } from "../api/validation.js";
import {
  profileFromLegacy,
  PROFILE_SCHEMA_VERSION,
} from "../api/personaProfile.js";

export function archetypeFromSeed(
  p: BuyerPersona,
  userId: string,
  createdAt: string,
): Archetype {
  return {
    id: p.id,
    user_id: userId,
    name: p.name,
    role: p.role,
    avatar: p.avatar,
    budget_sensitivity: p.budgetSensitivity,
    system_prompt: p.systemPrompt,
    created_at: createdAt,
    profile: profileFromLegacy(p as unknown as Record<string, unknown>, "seed"),
    profileSchemaVersion: PROFILE_SCHEMA_VERSION,
    profileRevision: 1,
  };
}

/** Pure and idempotent. Never touch messages, conversations, prompts or custom assumptions. */
export function upgradePersonaData(data: StudioData): StudioData {
  const next = structuredClone(data);
  next.archetypes = next.archetypes.map((a) => {
    parseDraft(a); // Unsupported schemas fail explicitly; no reset or guessed conversion.
    if (
      a.profileRevision !== undefined &&
      (!Number.isSafeInteger(a.profileRevision) || a.profileRevision < 1)
    )
      throw new Error("Invalid persona revision.");
    if (a.profile !== undefined || a.profileRevision !== undefined) return a;
    const legacyKeys = [
      "id",
      "user_id",
      "name",
      "role",
      "avatar",
      "budget_sensitivity",
      "system_prompt",
      "created_at",
    ];
    if (Object.keys(a).some((key) => !legacyKeys.includes(key))) return a;
    const seed = DEFAULT_PERSONAS.find(
      (p) =>
        p.id === a.id &&
        p.name === a.name &&
        p.role === a.role &&
        p.avatar === a.avatar &&
        p.budgetSensitivity === a.budget_sensitivity &&
        p.systemPrompt === a.system_prompt,
    );
    if (!seed) return a;
    const rich = archetypeFromSeed(seed, a.user_id, a.created_at);
    return {
      ...a,
      profile: rich.profile,
      profileSchemaVersion: PROFILE_SCHEMA_VERSION,
      profileRevision: 1,
    };
  });
  return next;
}
