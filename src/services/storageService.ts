import { DEFAULT_PERSONAS } from "../data/defaultPersonas";
import type { Archetype, StudioData } from "../types/database.types";
import { archetypeFromSeed, upgradePersonaData } from "./personaCompatibility";
import {
  profileFromLegacy,
  PROFILE_SCHEMA_VERSION,
} from "../api/personaProfile";
import { publicStudioData } from "../api/publicData";
import {
  nonEmpty,
  parseDraft,
  parseTelemetry,
  record,
} from "../api/validation";
export const STORAGE_KEY = "1906_studio_v1";
const USER_ID = "00000000-0000-4000-8000-000000000001";
export function createInitialData(
  storage: Pick<Storage, "getItem">,
): StudioData {
  const now = new Date().toISOString();
  const archetypes: Archetype[] = DEFAULT_PERSONAS.map((p) =>
    archetypeFromSeed(p, USER_ID, now),
  );
  const legacy = storage.getItem("personaflow_custom_personas");
  if (legacy) {
    const rows: unknown = JSON.parse(legacy);
    if (!Array.isArray(rows))
      throw new Error(
        "Legacy archetypes could not be read. Existing data has been kept.",
      );
    for (const value of rows) {
      const p = record(value);
      const profile = profileFromLegacy(p);
      const draft = parseDraft({
        name: p.name,
        role: p.role,
        budget_sensitivity: p.budgetSensitivity,
        system_prompt: p.systemPrompt,
        ...(profile
          ? { profile, profileSchemaVersion: PROFILE_SCHEMA_VERSION }
          : {}),
      });
      archetypes.push({
        ...draft,
        id: nonEmpty(p.id),
        user_id: USER_ID,
        avatar: typeof p.avatar === "string" ? p.avatar : "🎯",
        created_at: now,
        profileRevision: 1,
      });
    }
  }
  return {
    version: 1,
    users: [
      {
        id: USER_ID,
        display_name: "Studio user",
        compute_credits: 4290,
        created_at: now,
      },
    ],
    archetypes,
    conversations: [],
    messages: [],
  };
}
export function validateData(value: unknown): StudioData {
  const d = record(value);
  if (
    d.version !== 1 ||
    !Array.isArray(d.users) ||
    d.users.length !== 1 ||
    !Array.isArray(d.archetypes) ||
    !d.archetypes.length ||
    !Array.isArray(d.conversations) ||
    !Array.isArray(d.messages)
  )
    throw new Error("Unrecognised saved studio data.");
  const date = (x: unknown) => {
    if (!Number.isFinite(Date.parse(nonEmpty(x))))
      throw new Error("Invalid saved date.");
  };
  const user = record(d.users[0]);
  nonEmpty(user.id);
  nonEmpty(user.display_name);
  date(user.created_at);
  if (
    !Number.isInteger(user.compute_credits) ||
    Number(user.compute_credits) < 0
  )
    throw new Error("Invalid credits.");
  const unique = (rows: unknown[]) => {
    const ids = rows.map((x) => nonEmpty(record(x).id));
    if (new Set(ids).size !== ids.length)
      throw new Error("Duplicate saved IDs.");
    return new Set(ids);
  };
  const archetypes = unique(d.archetypes);
  const conversations = unique(d.conversations);
  unique(d.messages);
  for (const value of d.archetypes) {
    const p = record(value);
    parseDraft(p);
    nonEmpty(p.avatar);
    date(p.created_at);
    if (p.updated_at !== undefined) date(p.updated_at);
    if (p.archived_at !== undefined) date(p.archived_at);
    if (
      p.profileRevision !== undefined &&
      (!Number.isSafeInteger(p.profileRevision) ||
        Number(p.profileRevision) < 1)
    )
      throw new Error("Invalid persona revision.");
    if (p.user_id !== user.id) throw new Error("Invalid archetype owner.");
  }
  for (const value of d.conversations) {
    const c = record(value);
    nonEmpty(c.title);
    date(c.created_at);
    date(c.updated_at);
    if (!archetypes.has(String(c.archetype_id)) || c.user_id !== user.id)
      throw new Error("Invalid conversation reference.");
  }
  for (const value of d.messages) {
    const m = record(value);
    nonEmpty(m.content);
    date(m.created_at);
    if (
      !conversations.has(String(m.conversation_id)) ||
      !["user", "assistant"].includes(String(m.role)) ||
      !["demo", "gemini", "openai"].includes(String(m.provider)) ||
      !["pending", "complete", "failed"].includes(String(m.status)) ||
      !["none", "pending", "complete", "failed"].includes(
        String(m.telemetry_status),
      ) ||
      (m.error !== null && typeof m.error !== "string")
    )
      throw new Error("Invalid saved message.");
    if (m.telemetry_status === "complete") parseTelemetry(m.telemetry);
    else if (m.telemetry !== null)
      throw new Error("Unexpected saved telemetry.");
  }
  return d as unknown as StudioData;
}
export function loadStudio(storage: Storage = localStorage): StudioData {
  const raw = storage.getItem(STORAGE_KEY);
  const data = publicStudioData(
    upgradePersonaData(
      raw ? validateData(JSON.parse(raw)) : createInitialData(storage),
    ),
  );
  // Recover interrupted requests without silently resending or charging again.
  data.messages = data.messages.map((m) =>
    m.status === "pending"
      ? { ...m, status: "failed", error: "Reply interrupted. Please retry." }
      : m.telemetry_status === "pending"
        ? {
            ...m,
            telemetry_status: "failed",
            error: "Evaluation interrupted. Please retry analytics.",
          }
        : m,
  );
  return data;
}
export function saveStudio(
  data: StudioData,
  storage: Storage = localStorage,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(publicStudioData(data)));
}
