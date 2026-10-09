import type { SynthesisReview } from "../types/persona";

export const IDENTITY_FIELDS = ["name", "role", "budget_sensitivity"] as const;
export function parseSynthesisReview(value: unknown): SynthesisReview {
  const r = value as SynthesisReview;
  if (
    !r ||
    typeof r !== "object" ||
    Array.isArray(r) ||
    Object.keys(r).some(
      (k) => !["version", "identitySources", "notes"].includes(k),
    ) ||
    r.version !== "persona-synthesis-v2" ||
    !r.identitySources ||
    Object.keys(r.identitySources).sort().join(",") !==
      [...IDENTITY_FIELDS].sort().join(",") ||
    IDENTITY_FIELDS.some(
      (k) => !["provided", "inferred"].includes(r.identitySources[k]),
    ) ||
    !Array.isArray(r.notes) ||
    r.notes.length > 6 ||
    r.notes.some((n) => typeof n !== "string" || !n.trim() || n.length > 400)
  )
    throw new Error("Invalid persona synthesis review.");
  return {
    version: r.version,
    identitySources: { ...r.identitySources },
    notes: [...r.notes],
  };
}
/** Output projection does not expose extra stored metadata. */
export function publicSynthesisReview(r: SynthesisReview): SynthesisReview {
  return parseSynthesisReview({
    version: r.version,
    identitySources: Object.fromEntries(
      IDENTITY_FIELDS.map((k) => [k, r.identitySources?.[k]]),
    ),
    notes: r.notes,
  });
}
