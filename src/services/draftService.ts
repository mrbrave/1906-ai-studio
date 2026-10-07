// Session-scoped text only: no access codes or provider credentials. Cleared on explicit lock.
export interface PendingDraft {
  id: string;
  conversationId: string;
  pitch: string;
  version: number;
}
const key = "1906-private-drafts-v1";
interface Drafts {
  texts: Record<string, string>;
  pending: PendingDraft | null;
}
let fallback: Drafts = { texts: {}, pending: null };
export function readDrafts(): Drafts {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
    const texts = Object.fromEntries(
      Object.entries(value?.texts ?? {}).filter(
        ([, v]) => typeof v === "string",
      ),
    ) as Record<string, string>;
    const p = value?.pending;
    const pending =
      p &&
      typeof p.id === "string" &&
      typeof p.conversationId === "string" &&
      typeof p.pitch === "string" &&
      Number.isSafeInteger(p.version) &&
      p.version >= 0
        ? p
        : null;
    return (fallback = { texts, pending });
  } catch {
    return fallback;
  }
}
function save(d: Drafts) {
  fallback = d;
  try {
    sessionStorage.setItem(key, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}
export function writeDraft(conversationId: string, text: string) {
  const d = readDrafts();
  d.texts[conversationId] = text;
  return save(d);
}
export function writePending(pending: PendingDraft | null) {
  const d = readDrafts();
  d.pending = pending;
  return save(d);
}
export function clearDrafts() {
  fallback = { texts: {}, pending: null };
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* In-memory drafts are still cleared. */
  }
}
