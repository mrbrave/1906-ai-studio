import type { BuyerPersonaProfile } from "./persona";
/** Logical records stored inside the private account JSON and local demo data.
 * All timestamps are ISO 8601; IDs for new rows are UUIDs.
 */
export interface User {
  id: string;
  display_name: string;
  compute_credits: number;
  created_at: string;
}
export type BudgetSensitivity = "Low" | "Medium" | "High";
export interface Archetype {
  id: string;
  user_id: string;
  name: string;
  role: string;
  avatar: string;
  budget_sensitivity: BudgetSensitivity;
  system_prompt: string;
  created_at: string;
  profile?: BuyerPersonaProfile;
  profileSchemaVersion?: 2;
  /** Assigned by the server; missing on legacy records. */
  profileRevision?: number;
  updated_at?: string;
  archived_at?: string;
}
export interface Conversation {
  id: string;
  user_id: string;
  archetype_id: string;
  /** Local demo snapshot. Live dialogues have their own frozen archetype. */
  archetype_snapshot?: Archetype;
  title: string;
  created_at: string;
  updated_at: string;
}
export interface Telemetry {
  intentScore: number | null;
  sentiment: string;
  activeFriction: string;
  suggestedTweak: string;
}
export type Provider = "demo" | "gemini" | "openai";
export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  provider: Provider;
  status: "pending" | "complete" | "failed";
  telemetry_status: "none" | "pending" | "complete" | "failed";
  telemetry: Telemetry | null;
  error: string | null;
  evaluation?: import("./live").DecisionState;
}
export interface StudioData {
  version: 1;
  users: User[];
  archetypes: Archetype[];
  conversations: Conversation[];
  messages: Message[];
}
type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};
/** Future normalised adapter contract, NOT the deployed Supabase table layout. */
export interface Database {
  public: {
    Tables: {
      users: Table<User, "id" | "display_name">;
      archetypes: Table<
        Archetype,
        "user_id" | "name" | "role" | "system_prompt" | "budget_sensitivity"
      >;
      conversations: Table<Conversation, "user_id" | "archetype_id" | "title">;
      messages: Table<
        Message,
        "conversation_id" | "role" | "content" | "provider"
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
