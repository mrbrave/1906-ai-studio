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
