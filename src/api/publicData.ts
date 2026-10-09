import type { ArchetypeDraft } from "./contracts";
import type {
  Archetype,
  Message,
  StudioData,
  Telemetry,
} from "../types/database.types";
import type {
  DecisionState,
  LiveConversation,
  TurnResult,
} from "../types/live";
import { publicPersonaProfile } from "./personaProfile.js";
import { publicSynthesisReview } from "./synthesisReview.js";

/** Allowlisted scalars only: future object metadata cannot accidentally cross this boundary. */
function fields<T extends object, K extends keyof T>(
  value: T,
  keys: readonly K[],
): Pick<T, K> {
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    const item = value[key];
    if (item === undefined) continue;
    if (item !== null && !["string", "number", "boolean"].includes(typeof item))
      throw new Error("Invalid public record field.");
    if (typeof item === "number" && !Number.isFinite(item))
      throw new Error("Invalid public record number.");
    result[key] = item;
  }
  return result as Pick<T, K>;
}
function strings(items: string[]): string[] {
  if (!Array.isArray(items) || items.some((x) => typeof x !== "string"))
    throw new Error("Invalid public record list.");
  return [...items];
}
export function publicDraft(a: ArchetypeDraft): ArchetypeDraft {
  return {
    ...fields(a, [
      "name",
      "role",
      "budget_sensitivity",
      "system_prompt",
      "profileSchemaVersion",
    ]),
    ...(a.profile !== undefined
      ? { profile: publicPersonaProfile(a.profile) }
      : {}),
    ...(a.synthesisReview !== undefined
      ? { synthesisReview: publicSynthesisReview(a.synthesisReview) }
      : {}),
  };
}
export function publicArchetype(a: Archetype): Archetype {
  return {
    ...publicDraft(a),
    ...fields(a, [
      "id",
      "user_id",
      "avatar",
      "created_at",
      "profileRevision",
      "updated_at",
      "archived_at",
    ]),
  };
}
export function publicTelemetry(t: Telemetry): Telemetry {
  return fields(t, [
    "intentScore",
    "sentiment",
    "activeFriction",
    "suggestedTweak",
  ]);
}
export function publicDecision(d: DecisionState): DecisionState {
  return {
    ...fields(d, [
      "version",
      "readinessIndex",
      "confidence",
      "sentiment",
      "friction",
      "responseAction",
      "jevModel",
      "rubricVersion",
      "phase",
      "evaluatedThrough",
      "status",
      "unavailableReason",
      "readinessConfidence",
      "sentimentConfidence",
      "frictionConfidence",
      "evidenceSufficiency",
      "stance",
      "stanceConfidence",
    ]),
    unresolvedObjections: strings(d.unresolvedObjections),
    ...(d.remainingConditions
      ? { remainingConditions: strings(d.remainingConditions) }
      : {}),
    ...(d.missingInformation
      ? { missingInformation: strings(d.missingInformation) }
      : {}),
    ...(d.concerns
      ? {
          concerns: d.concerns.map((c) =>
            fields(c, ["category", "status", "turnId", "evidenceTurnId"]),
          ),
        }
      : {}),
  };
}
export function publicMessage(m: Message): Message {
  return {
    ...fields(m, [
      "id",
      "conversation_id",
      "role",
      "content",
      "created_at",
      "provider",
      "status",
      "telemetry_status",
      "error",
    ]),
    telemetry: m.telemetry === null ? null : publicTelemetry(m.telemetry),
    ...(m.evaluation ? { evaluation: publicDecision(m.evaluation) } : {}),
  };
}
export function publicStudioData(d: StudioData): StudioData {
  return {
    version: d.version,
    users: d.users.map((u) =>
      fields(u, ["id", "display_name", "compute_credits", "created_at"]),
    ),
    archetypes: d.archetypes.map(publicArchetype),
    conversations: d.conversations.map((c) => ({
      ...fields(c, [
        "id",
        "user_id",
        "archetype_id",
        "title",
        "created_at",
        "updated_at",
      ]),
      ...(c.archetype_snapshot
        ? { archetype_snapshot: publicArchetype(c.archetype_snapshot) }
        : {}),
    })),
    messages: d.messages.map(publicMessage),
  };
}
export function publicLiveConversation(c: LiveConversation): LiveConversation {
  return {
    ...fields(c, ["id", "version", "continuationOf", "continuationSummary"]),
    archetype: publicArchetype(c.archetype),
    intent: fields(c.intent, ["objective", "proposition", "targetDecision"]),
    state: c.state === null ? null : publicDecision(c.state),
    ...(c.observedState !== undefined
      ? {
          observedState:
            c.observedState === null ? null : publicDecision(c.observedState),
        }
      : {}),
    ...(c.memory
      ? {
          memory: {
            ...fields(c.memory, [
              "schemaVersion",
              "version",
              "lastSummarisedTurnId",
              "omittedSellerParagraphs",
            ]),
            entries: c.memory.entries.map((e) =>
              fields(e, ["turnId", "speaker", "kind", "quote"]),
            ),
          },
        }
      : {}),
  };
}
export function publicTurnResult(r: TurnResult): TurnResult {
  return {
    ...fields(r, ["text", "replyId", "version"]),
    telemetry: publicTelemetry(r.telemetry),
    state: publicDecision(r.state),
  };
}
