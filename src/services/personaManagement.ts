import type { Archetype, StudioData } from "../types/database.types";
import type { ArchetypeDraft } from "../api/contracts";
import { parseDraft } from "../api/validation.js";

export class PersonaError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function personaRevision(persona: Archetype) {
  return persona.profileRevision ?? 1;
}
function matchingPersona(
  data: StudioData,
  id: string,
  expectedRevision: number,
): Archetype {
  const persona = data.archetypes.find((a) => a.id === id);
  if (!persona) throw new PersonaError(404, "Persona not found.");
  if (personaRevision(persona) !== expectedRevision)
    throw new PersonaError(
      409,
      "This persona changed in another tab. Your draft is kept. Return to Personas and reopen it before saving.",
    );
  return persona;
}
export function editPersona(
  data: StudioData,
  id: string,
  expectedRevision: number,
  draft: ArchetypeDraft,
  at: string,
): StudioData {
  const persona = matchingPersona(data, id, expectedRevision);
  if (persona.archived_at)
    throw new PersonaError(409, "Restore this persona before editing it.");
  if (personaRevision(persona) >= Number.MAX_SAFE_INTEGER)
    throw new PersonaError(
      409,
      "This persona has reached its revision limit. Duplicate it to make further changes.",
    );
  const updated: Archetype = {
    ...persona,
    ...parseDraft(draft),
    profileRevision: personaRevision(persona) + 1,
    updated_at: at,
  };
  // A legacy-only replacement must not accidentally retain a previous structured profile.
  if (!draft.profile) {
    delete updated.profile;
    delete updated.profileSchemaVersion;
  }
  if (!draft.synthesisReview) delete updated.synthesisReview;
  return {
    ...data,
    archetypes: data.archetypes.map((a) => (a.id === id ? updated : a)),
  };
}
export function archivePersona(
  data: StudioData,
  id: string,
  expectedRevision: number,
  archived: boolean,
  at: string,
): StudioData {
  const persona = matchingPersona(data, id, expectedRevision);
  if (!!persona.archived_at === archived) return data;
  const updated = { ...persona, updated_at: at };
  if (archived) updated.archived_at = at;
  else delete updated.archived_at;
  // Archiving changes availability, not the behavioural profile revision.
  return {
    ...data,
    archetypes: data.archetypes.map((a) => (a.id === id ? updated : a)),
  };
}
export function freezeDemoPersonas(data: StudioData, id: string): StudioData {
  const persona = data.archetypes.find((a) => a.id === id)!;
  return {
    ...data,
    conversations: data.conversations.map((c) =>
      c.archetype_id === id && !c.archetype_snapshot
        ? { ...c, archetype_snapshot: structuredClone(persona) }
        : c,
    ),
  };
}
