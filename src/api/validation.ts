import type { Telemetry } from "../types/database.types";
import type { ArchetypeDraft } from "./contracts";
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
    typeof d.intentScore !== "number" ||
    !Number.isFinite(d.intentScore) ||
    d.intentScore < 0 ||
    d.intentScore > 100
  )
    throw new Error(
      "Invalid JEV telemetry: expected a score from 0 to 100 and exactly four fields.",
    );
  return {
    intentScore: d.intentScore,
    sentiment: nonEmpty(d.sentiment, 200),
    activeFriction: nonEmpty(d.activeFriction, 4000),
    suggestedTweak: nonEmpty(d.suggestedTweak, 4000),
  };
}
export function parseDraft(value: unknown): ArchetypeDraft {
  const d = record(value);
  if (!["Low", "Medium", "High"].includes(String(d.budget_sensitivity)))
    throw new Error("Invalid budget sensitivity.");
  return {
    name: nonEmpty(d.name, 120),
    role: nonEmpty(d.role, 200),
    budget_sensitivity:
      d.budget_sensitivity as ArchetypeDraft["budget_sensitivity"],
    system_prompt: nonEmpty(d.system_prompt),
  };
}
