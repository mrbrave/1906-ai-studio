import type { Telemetry } from "../types/database.types";
import type { ArchetypeDraft } from "./contracts";
import { parseSynthesisReview } from "./synthesisReview.js";
import {
  parsePersonaProfile,
  PROFILE_SCHEMA_VERSION,
} from "./personaProfile.js";
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected an object.");
  return value as Record<string, unknown>;
}
export function nonEmpty(value: unknown, max = 16000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error("Missing or invalid text.");
  return value.trim();
}
export function parseTelemetry(value: unknown): Telemetry {
  const d = record(value);
  if (
    Object.keys(d).sort().join(",") !==
      "activeFriction,intentScore,sentiment,suggestedTweak" ||
    (d.intentScore !== null &&
      (typeof d.intentScore !== "number" ||
        !Number.isFinite(d.intentScore) ||
        d.intentScore < 0 ||
        d.intentScore > 100))
  )
    throw new Error(
      "Invalid JEV telemetry: expected a score from 0 to 100 (or null for uncertainty) and exactly four fields.",
    );
  return {
    intentScore: d.intentScore as number | null,
    sentiment: nonEmpty(d.sentiment, 200),
    activeFriction: nonEmpty(d.activeFriction, 4000),
    suggestedTweak: nonEmpty(d.suggestedTweak, 4000),
  };
}
export function parseDraft(value: unknown): ArchetypeDraft {
  const d = record(value);
  if (
    typeof d.budget_sensitivity !== "string" ||
    !["Low", "Medium", "High"].includes(d.budget_sensitivity)
  )
    throw new Error("Invalid budget sensitivity.");
  if (
    (d.profile === undefined) !== (d.profileSchemaVersion === undefined) ||
    (d.profileSchemaVersion !== undefined &&
      d.profileSchemaVersion !== PROFILE_SCHEMA_VERSION)
  )
    throw new Error("Persona profile requires supported schema version 2.");
  return {
    name: nonEmpty(d.name, 120),
    role: nonEmpty(d.role, 200),
    budget_sensitivity:
      d.budget_sensitivity as ArchetypeDraft["budget_sensitivity"],
    system_prompt: nonEmpty(d.system_prompt),
    ...(d.synthesisReview !== undefined
      ? { synthesisReview: parseSynthesisReview(d.synthesisReview) }
      : {}),
    ...(d.profile !== undefined
      ? {
          profile: parsePersonaProfile(d.profile),
          profileSchemaVersion: PROFILE_SCHEMA_VERSION,
        }
      : {}),
  };
}
