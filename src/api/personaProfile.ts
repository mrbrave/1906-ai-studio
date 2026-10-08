import type {
  BuyerPersonaProfile,
  PersonaProfileField,
  ProfileSource,
} from "../types/persona";

export const PROFILE_SCHEMA_VERSION = 2 as const;
export const PROFILE_MAX_BYTES = 12000;
const textLimits = {
  industry: 200,
  companySize: 120,
  ageRange: 120,
  incomeRange: 120,
  background: 2400,
  decisionProcess: 1200,
  decisionAuthority: 500,
  decisionSpeed: 200,
  communicationStyle: 1200,
  additionalGuidance: 2000,
} as const;
const listFields = [
  "goals",
  "painPoints",
  "buyingMotivations",
  "typicalObjections",
  "preferredEvidence",
  "currentTools",
  "constraints",
  "preferredChannels",
  "examplePhrases",
] as const;
export const PROFILE_FIELDS = [
  ...Object.keys(textLimits),
  ...listFields,
] as PersonaProfileField[];
const sources: ProfileSource[] = ["provided", "inferred", "seed", "legacy"];
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected a persona profile object.");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error("Missing or oversized persona profile text.");
  return value; // Preserve supplied wording and whitespace.
}
/** Reject unknown input fields rather than silently claiming to save them. */
export function parsePersonaProfile(value: unknown): BuyerPersonaProfile {
  const input = object(value);
  if (
    new TextEncoder().encode(JSON.stringify(input)).length > PROFILE_MAX_BYTES
  )
    throw new Error("Persona profile exceeds 12,000 UTF-8 bytes.");
  for (const key of Object.keys(input))
    if (
      key !== "provenance" &&
      !PROFILE_FIELDS.includes(key as PersonaProfileField)
    )
      throw new Error("Unsupported persona profile field.");
  const result: Record<string, unknown> = {};
  for (const [key, max] of Object.entries(textLimits))
    if (input[key] !== undefined) result[key] = text(input[key], max);
  for (const key of listFields) {
    const items = input[key];
    if (items === undefined) continue;
    if (!Array.isArray(items) || items.length > 12)
      throw new Error("Persona profile lists allow at most 12 items.");
    result[key] = items.map((item) => text(item, 500));
  }
  if (input.provenance !== undefined) {
    const provenance = object(input.provenance),
      clean: Record<string, ProfileSource> = {};
    for (const key of Object.keys(provenance)) {
      if (
        !PROFILE_FIELDS.includes(key as PersonaProfileField) ||
        result[key] === undefined ||
        !sources.includes(provenance[key] as ProfileSource)
      )
        throw new Error("Invalid persona field provenance.");
      clean[key] = provenance[key] as ProfileSource;
    }
    result.provenance = clean;
  }
  return result as BuyerPersonaProfile;
}

/** Output allowlist also removes unrecognised nested metadata from stored records. */
export function publicPersonaProfile(
  value: BuyerPersonaProfile,
): BuyerPersonaProfile {
  const clean: Record<string, unknown> = {};
  for (const key of PROFILE_FIELDS)
    if (value[key] !== undefined) clean[key] = value[key];
  if (value.provenance) {
    clean.provenance = Object.fromEntries(
      PROFILE_FIELDS.filter((key) => value.provenance?.[key] !== undefined).map(
        (key) => [key, value.provenance![key]],
      ),
    );
  }
  return parsePersonaProfile(clean);
}

/** Recover only explicit fields from known legacy/Base44 shapes; never infer from prose. */
export function profileFromLegacy(
  value: Record<string, unknown>,
  source: ProfileSource = "legacy",
): BuyerPersonaProfile | undefined {
  const result: Record<string, unknown> = {};
  const aliases: Partial<Record<PersonaProfileField, string[]>> = {
    companySize: ["company_size"],
    ageRange: ["age_range"],
    background: ["description", "bio"],
    painPoints: ["pain_points"],
    buyingMotivations: ["buying_motivations", "buyingTriggers"],
    typicalObjections: ["objections", "commonObjections"],
    communicationStyle: ["communication_style", "tone"],
  };
  for (const key of PROFILE_FIELDS) {
    const candidate = [key, ...(aliases[key] ?? [])]
      .map((alias) => value[alias])
      .find((x) => x !== undefined && x !== null && x !== "");
    if (candidate === undefined) continue;
    result[key] =
      (listFields as readonly string[]).includes(key) &&
      typeof candidate === "string"
        ? candidate.split(/\r?\n/).filter((line) => line.trim())
        : candidate;
  }
  if (
    result.ageRange === undefined &&
    Number.isInteger(value.age) &&
    Number(value.age) >= 0
  )
    result.ageRange = String(value.age);
  if (!Object.keys(result).length) return undefined;
  result.provenance = Object.fromEntries(
    Object.keys(result).map((key) => [key, source]),
  );
  return parsePersonaProfile(result);
}
