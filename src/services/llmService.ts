import type {
  Archetype,
  Message,
  Provider,
  Telemetry,
} from "../types/database.types";
/** Offline demo only. Live turns are server-orchestrated through live.client.ts. */
export async function runDialogueTurn(
  input: {
    archetype: Archetype;
    pitch: string;
    history: Message[];
    provider: Provider;
  },
  onReply: (reply: string) => void,
): Promise<{ telemetry: Telemetry | null; error: string | null }> {
  if (input.provider !== "demo")
    throw new Error("Open the private Studio for JEV → Gemini conversations.");
  onReply(
    `Before I commit, I need to understand the impact on my team as ${input.archetype.role}. What evidence supports your claim, and what would implementation cost?`,
  );
  return {
    telemetry: {
      intentScore: 40,
      sentiment: "Sceptical · demo fixture",
      activeFriction: "Unproven value and implementation cost (illustrative).",
      suggestedTweak:
        "Add a measurable outcome, supporting evidence and a clear implementation plan.",
    },
    error: null,
  };
}
