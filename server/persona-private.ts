import { nonEmpty, record } from "../src/api/validation.js";
/** Server-only modelling data. No runtime import of this module from src/. */
export interface MotivationPrior {
  code: string;
  /** Authored strength, not a calibrated probability or share of a total. */
  weight: number;
  needs: string[];
  threats: string[];
  preferredEvidence?: string[];
}
export interface PrivatePersonaRevision {
  personaId: string;
  profileRevision: number;
  schemaVersion: 1;
  source: "authored" | "inferred";
  latentMotivationProfile: {
    internalOnly: true;
    primary: MotivationPrior;
    secondary?: MotivationPrior;
  };
}
export function privatePersonaKey(
  personaId: string,
  profileRevision: number,
): string {
  if (
    !personaId ||
    !Number.isSafeInteger(profileRevision) ||
    profileRevision < 1
  )
    throw new Error("Invalid private persona revision reference.");
  return JSON.stringify([personaId, profileRevision]);
}

/** Validate and project authored modelling data; never infer it from a public role. */
export function parsePrivatePersonaRevision(
  value: unknown,
  personaId: string,
  profileRevision: number,
): PrivatePersonaRevision {
  const v = record(value),
    p = record(v.latentMotivationProfile);
  if (
    Buffer.byteLength(JSON.stringify(v)) > 6000 ||
    v.personaId !== personaId ||
    v.profileRevision !== profileRevision ||
    v.schemaVersion !== 1 ||
    !["authored", "inferred"].includes(String(v.source)) ||
    p.internalOnly !== true
  )
    throw new Error("Invalid private persona revision.");
  const list = (value: unknown): string[] => {
    if (!Array.isArray(value) || value.length > 8)
      throw new Error("Invalid private motive list.");
    return value.map((s) => nonEmpty(s, 200));
  };
  const prior = (value: unknown): MotivationPrior => {
    const m = record(value);
    if (
      typeof m.weight !== "number" ||
      !Number.isFinite(m.weight) ||
      m.weight < 0 ||
      m.weight > 1
    )
      throw new Error("Invalid authored motive strength.");
    return {
      code: nonEmpty(m.code, 80),
      weight: m.weight,
      needs: list(m.needs),
      threats: list(m.threats),
      ...(m.preferredEvidence !== undefined
        ? { preferredEvidence: list(m.preferredEvidence) }
        : {}),
    };
  };
  return {
    personaId,
    profileRevision,
    schemaVersion: 1,
    source: v.source as PrivatePersonaRevision["source"],
    latentMotivationProfile: {
      internalOnly: true,
      primary: prior(p.primary),
      ...(p.secondary !== undefined ? { secondary: prior(p.secondary) } : {}),
    },
  };
}
