import type { ArchetypeDraft } from "../api/contracts";
import type {
  BuyerPersonaProfile,
  PersonaProfileField,
} from "../types/persona";
import { PROFILE_SCHEMA_VERSION } from "../api/personaProfile.js";
import { parseDraft } from "../api/validation.js";
import type { Archetype } from "../types/database.types";

export interface PersonaEditorSession {
  key: string;
  mode: "create" | "edit" | "duplicate";
  persona?: Archetype;
  draft?: ArchetypeDraft;
}
export function personaEditorSession(
  mode: PersonaEditorSession["mode"],
  persona?: Archetype,
): PersonaEditorSession {
  const draft = persona ? parseDraft(persona) : undefined;
  if (draft && mode === "duplicate") {
    draft.system_prompt = editablePrompt(draft);
    draft.name = `${draft.name.slice(0, 113)} (copy)`;
    if (draft.synthesisReview)
      draft.synthesisReview.identitySources.name = "provided";
  }
  return {
    key: crypto.randomUUID(),
    mode,
    persona: persona ? structuredClone(persona) : undefined,
    draft,
  };
}

interface PersonaField {
  key: PersonaProfileField;
  label: string;
  max?: number;
  list?: boolean;
  multiline?: boolean;
}
export const PERSONA_SECTIONS: {
  title: string;
  description: string;
  fields: PersonaField[];
}[] = [
  {
    title: "About the buyer",
    description:
      "Give this person a working context. Leave details you do not know blank.",
    fields: [
      { key: "industry", label: "Industry", max: 200 },
      { key: "companySize", label: "Company size", max: 120 },
      { key: "ageRange", label: "Age range (optional)", max: 120 },
      { key: "incomeRange", label: "Income range (optional)", max: 120 },
      { key: "background", label: "Background", max: 2400, multiline: true },
    ],
  },
  {
    title: "Goals and pressures",
    description: "What are they trying to achieve, and what gets in the way?",
    fields: [
      { key: "goals", label: "Goals", list: true },
      { key: "painPoints", label: "Pain points", list: true },
      {
        key: "currentTools",
        label: "Current tools and alternatives",
        list: true,
      },
      { key: "constraints", label: "Constraints", list: true },
    ],
  },
  {
    title: "How they buy",
    description:
      "Describe the priorities and questions that shape their decisions.",
    fields: [
      { key: "buyingMotivations", label: "Buying motivations", list: true },
      { key: "typicalObjections", label: "Typical objections", list: true },
      { key: "preferredEvidence", label: "Evidence they value", list: true },
      {
        key: "decisionAuthority",
        label: "Decision authority",
        max: 500,
        multiline: true,
      },
      {
        key: "decisionProcess",
        label: "Decision process",
        max: 1200,
        multiline: true,
      },
      { key: "decisionSpeed", label: "Decision pace", max: 200 },
    ],
  },
  {
    title: "How they communicate",
    description:
      "Help their voice sound like a person you could actually meet.",
    fields: [
      {
        key: "communicationStyle",
        label: "Communication style",
        max: 1200,
        multiline: true,
      },
      { key: "examplePhrases", label: "Example phrases", list: true },
      { key: "preferredChannels", label: "Preferred channels", list: true },
      {
        key: "additionalGuidance",
        label: "Additional guidance",
        max: 2000,
        multiline: true,
      },
    ],
  },
];

export const PERSONA_FIELDS = PERSONA_SECTIONS.flatMap(
  (section) => section.fields,
);
export type ProfileInputs = Record<PersonaProfileField, string>;
export function sourceLabel(source?: string): string {
  return (
    (
      {
        provided: "Provided",
        inferred: "AI suggestion · review",
        seed: "Built-in profile",
        legacy: "Imported",
      } as Record<string, string>
    )[source ?? ""] ?? "Source not recorded"
  );
}
export function profileInputs(
  profile: BuyerPersonaProfile = {},
): ProfileInputs {
  return Object.fromEntries(
    PERSONA_FIELDS.map(({ key }) => {
      const value = profile[key];
      return [key, Array.isArray(value) ? value.join("\n") : (value ?? "")];
    }),
  ) as ProfileInputs;
}
export function profileFromInputs(
  inputs: ProfileInputs,
  original: BuyerPersonaProfile = {},
): BuyerPersonaProfile {
  const values: Record<string, unknown> = {};
  const originalInputs = profileInputs(original);
  const provenance: BuyerPersonaProfile["provenance"] = {};
  for (const field of PERSONA_FIELDS) {
    const value = inputs[field.key];
    // Preserve unedited values (including empty lists, whitespace and provenance) exactly.
    if (value === originalInputs[field.key]) {
      if (original[field.key] !== undefined)
        values[field.key] = original[field.key];
      if (original.provenance?.[field.key])
        provenance[field.key] = original.provenance[field.key];
    } else if (value.trim()) {
      values[field.key] =
        "list" in field && field.list
          ? value.split(/\r?\n/).filter((line) => line.trim())
          : value;
      provenance[field.key] = "provided";
    }
  }
  if (Object.keys(provenance).length) values.provenance = provenance;
  return values as BuyerPersonaProfile;
}
/** Public compatibility summary; the actual reply prompt is compiled on the server. */
export function profilePrompt(
  draft: Omit<ArchetypeDraft, "system_prompt">,
): string {
  const context = PERSONA_FIELDS.flatMap(({ key, label }) => {
    const value = draft.profile?.[key];
    if (value === undefined || (Array.isArray(value) && !value.length))
      return [];
    return [`${label}: ${Array.isArray(value) ? value.join("; ") : value}`];
  });
  return [
    `Role-play as ${draft.name.trim()}, ${draft.role.trim()}.`,
    `Budget sensitivity: ${draft.budget_sensitivity}.`,
    ...context,
    "Respond in character to the seller. Use the supplied context without inventing missing facts. Raise questions or objections when relevant to this conversation.",
  ].join("\n\n");
}
export function editablePrompt(draft: ArchetypeDraft): string {
  return draft.system_prompt === profilePrompt(draft)
    ? ""
    : draft.system_prompt;
}
export function completePersonaDraft(
  draft: ArchetypeDraft,
  inputs: ProfileInputs,
  original?: BuyerPersonaProfile,
): ArchetypeDraft {
  for (const field of PERSONA_FIELDS) {
    const text = inputs[field.key];
    if (field.max && text.length > field.max)
      throw new Error(
        `${field.label} exceeds ${field.max.toLocaleString()} characters. Your full text has been kept.`,
      );
    if (field.list) {
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length > 12 || lines.some((line) => line.length > 500))
        throw new Error(
          `${field.label} allows up to 12 items of 500 characters each. Your full text has been kept.`,
        );
    }
  }
  const profile = profileFromInputs(inputs, original);
  const next = {
    ...draft,
    profile,
    profileSchemaVersion: PROFILE_SCHEMA_VERSION,
  };
  return parseDraft({
    ...next,
    system_prompt: draft.system_prompt.trim() || profilePrompt(next),
  });
}
