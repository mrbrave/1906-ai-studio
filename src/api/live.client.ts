import type {
  ConversationIntent,
  LiveSnapshot,
  TurnResult,
  UsageSummary,
} from "../types/live";
import type { ArchetypeDraft } from "./contracts";
import { postJSON } from "./http";
export async function liveSnapshot(): Promise<LiveSnapshot> {
  return (await postJSON("/api/studio", {
    action: "snapshot",
  })) as LiveSnapshot;
}
export async function createConversation(
  id: string,
  archetypeId: string,
  intent: ConversationIntent,
): Promise<LiveSnapshot> {
  return (await postJSON("/api/studio", {
    action: "create_conversation",
    id,
    archetypeId,
    intent,
  })) as LiveSnapshot;
}
export async function saveLiveArchetype(
  id: string,
  draft: ArchetypeDraft,
): Promise<LiveSnapshot> {
  return (await postJSON("/api/studio", {
    action: "save_archetype",
    id,
    draft,
  })) as LiveSnapshot;
}
export async function liveTurn(
  conversationId: string,
  pitch: string,
  expectedVersion: number,
  requestId: string,
): Promise<{ result: TurnResult; usage: UsageSummary }> {
  return (await postJSON("/api/dialogue", {
    conversationId,
    pitch,
    expectedVersion,
    requestId,
  })) as { result: TurnResult; usage: UsageSummary };
}

export async function updateLivePersona(
  id: string,
  expectedRevision: number,
  draft: ArchetypeDraft,
  requestId: string,
): Promise<LiveSnapshot> {
  return (await postJSON("/api/studio", {
    action: "update_archetype",
    id,
    expectedRevision,
    draft,
    requestId,
  })) as LiveSnapshot;
}
export async function archiveLivePersona(
  id: string,
  expectedRevision: number,
  archived: boolean,
  requestId: string,
): Promise<LiveSnapshot> {
  return (await postJSON("/api/studio", {
    action: "archive_archetype",
    id,
    expectedRevision,
    archived,
    requestId,
  })) as LiveSnapshot;
}

export async function assessReply(
  conversationId: string,
  replyId: string,
  expectedVersion: number,
) {
  return postJSON("/api/assessment", {
    conversationId,
    replyId,
    expectedVersion,
    requestId: replyId,
  });
}
export async function continueConversation(
  id: string,
  sourceId: string,
  summary: string,
): Promise<LiveSnapshot> {
  return (await postJSON("/api/studio", {
    action: "continue_conversation",
    id,
    sourceId,
    summary,
  })) as LiveSnapshot;
}
