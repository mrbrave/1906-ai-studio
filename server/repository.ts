import type { ArchetypeDraft } from "../src/api/contracts";
import type { LiveConversation, TurnResult } from "../src/types/live";
import type { StudioData } from "../src/types/database.types";
import { DEFAULT_PERSONAS } from "../src/data/defaultPersonas.js";
import { archetypeFromSeed } from "../src/services/personaCompatibility.js";
import { upgradePersonaStore } from "./persona-compatibility.js";
import type { PrivatePersonaRevision } from "./persona-private";
import { HttpError } from "./http.js";
export const STUDIO_USER = "00000000-0000-4000-8000-000000000001";
export interface Attempt {
  id: string;
  provider: "jev" | "gemini";
  model: string;
  startedAt: string;
  status: "started" | "complete" | "rejected" | "uncertain";
  reserve: number;
  output?: any;
  cost?: number;
  usage?: unknown;
  responseId?: string;
  rates: { input: number; output: number; cached: number; version: string };
}
export interface Operation {
  id: string;
  hash: string;
  kind: "dialogue" | "archetype" | "assessment";
  /** Pinned at admission so retries cannot silently adopt a new prompt/parser. */
  promptVersion?:
    | "persona-voice-v1"
    | "persona-voice-v2"
    | "persona-synthesis-v1"
    | "persona-synthesis-v2";
  conversationId?: string;
  status: "running" | "failed" | "complete" | "uncertain";
  startedAt: string;
  request: Record<string, unknown>;
  reserve: number;
  attempts: Attempt[];
  decision?: {
    state: NonNullable<LiveConversation["state"]>;
    telemetry: TurnResult["telemetry"];
    raw: unknown;
  };
  result?: TurnResult | ArchetypeDraft;
  error?: string;
}
export interface Store {
  schemaVersion: 1;
  data: StudioData;
  conversations: LiveConversation[];
  operations: Operation[];
  adjustments: {
    id: string;
    operationId: string;
    cost: number;
    reason: string;
    at: string;
  }[];
  /** Optional server-only data keyed by privatePersonaKey(id, profileRevision). */
  personaPrivateByRevision?: Record<string, PrivatePersonaRevision>;
  /** Idempotency receipts for free persona edits and archive/restore actions. Never public. */
  personaMutations?: { id: string; hash: string }[];
}
export interface Repository {
  read(): Promise<{ revision: number; state: Store }>;
  compareAndSwap(revision: number, state: Store): Promise<boolean>;
}
export function initialStore(): Store {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    data: {
      version: 1,
      users: [
        {
          id: STUDIO_USER,
          display_name: "Studio User",
          compute_credits: 0,
          created_at: now,
        },
      ],
      archetypes: DEFAULT_PERSONAS.map((p) =>
        archetypeFromSeed(p, STUDIO_USER, now),
      ),
      conversations: [],
      messages: [],
    },
    conversations: [],
    operations: [],
    adjustments: [],
  };
}
export function createRepository(): Repository {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new HttpError(503, "Private Studio storage is not configured.");
  const origin = new URL(url);
  if (origin.protocol !== "https:")
    throw new HttpError(503, "Private Studio storage requires HTTPS.");
  async function rpc(name: string, body: unknown): Promise<any> {
    try {
      const r = await fetch(`${origin.origin}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: {
          apikey: key!,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw new Error("Storage failure");
      return await r.json();
    } catch {
      throw new HttpError(
        503,
        "Private Studio storage is unavailable. No new model request was started by this storage action.",
      );
    }
  }
  return {
    async read() {
      const result = await rpc("studio_read", {});
      if (!result || !Number.isSafeInteger(result.revision))
        throw new HttpError(503, "Invalid Studio storage revision.");
      const state = result.state ?? initialStore();
      if (state.schemaVersion !== 1)
        throw new HttpError(503, "Studio storage needs migration.");
      try {
        return { revision: result.revision, state: upgradePersonaStore(state) };
      } catch {
        throw new HttpError(
          503,
          "Studio persona data needs review. Saved data has been kept.",
        );
      }
    },
    async compareAndSwap(revision, state) {
      // This single-account test store is intentionally bounded. No silent pruning of memory or charges.
      if (Buffer.byteLength(JSON.stringify(state)) > 8_000_000)
        throw new HttpError(
          503,
          "Test archive limit reached. Export and archive it before continuing.",
        );
      return (
        (await rpc("studio_write", {
          expected_revision: revision,
          next_state: state,
        })) === true
      );
    },
  };
}
export async function mutate<T>(
  repo: Repository,
  action: (state: Store) => T,
): Promise<T> {
  for (let i = 0; i < 8; i++) {
    const { revision, state } = await repo.read();
    const result = action(state); // Pure state changes only; never perform provider calls here.
    if (await repo.compareAndSwap(revision, state)) return result;
  }
  throw new HttpError(409, "Studio changed in another tab. Refresh and retry.");
}
