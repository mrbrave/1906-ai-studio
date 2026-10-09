/** Public, editable context. Absent fields mean unknown, not an inferred trait. */
export interface BuyerPersonaProfile {
  industry?: string;
  companySize?: string;
  ageRange?: string;
  incomeRange?: string;
  background?: string;
  goals?: string[];
  painPoints?: string[];
  buyingMotivations?: string[];
  typicalObjections?: string[];
  preferredEvidence?: string[];
  currentTools?: string[];
  constraints?: string[];
  decisionProcess?: string;
  decisionAuthority?: string;
  decisionSpeed?: string;
  preferredChannels?: string[];
  communicationStyle?: string;
  examplePhrases?: string[];
  additionalGuidance?: string;
  provenance?: Partial<Record<PersonaProfileField, ProfileSource>>;
}
export type PersonaProfileField = Exclude<
  keyof BuyerPersonaProfile,
  "provenance"
>;
export type ProfileSource = "provided" | "inferred" | "seed" | "legacy";

/** Reviewable generation assumptions, never a hidden motivational profile. */
export interface SynthesisReview {
  version: "persona-synthesis-v2";
  identitySources: Record<
    "name" | "role" | "budget_sensitivity",
    "provided" | "inferred"
  >;
  notes: string[];
}

/** Legacy seed/import contract. Do not use this as the persisted profile. */
export interface BuyerPersona {
  id: string;
  name: string;
  role: string;
  industry: string;
  age: number;
  incomeRange: string;
  avatar: string;
  bio: string;
  goals: string[];
  painPoints: string[];
  buyingTriggers: string[];
  commonObjections: string[];
  tone: string;
  budgetSensitivity: "High" | "Medium" | "Low";
  decisionSpeed: "Impulsive" | "Moderate" | "Analytical & Slow";
  preferredChannels: string[];
  systemPrompt: string;
  isCustom?: boolean;
}
