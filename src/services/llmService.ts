import type {
  Archetype,
  Message,
  Provider,
  Telemetry,
} from "../types/database.types";
import { generateDialogue } from "../api/gemini.client";
import { evaluateInteraction } from "../api/typesafe.client";
import type { DialogueRequest, EvaluationRequest } from "../api/contracts";
export interface Engines {
  dialogue: (request: DialogueRequest) => Promise<string>;
  evaluate: (request: EvaluationRequest) => Promise<Telemetry>;
}
export const engines: Engines = {
  dialogue: generateDialogue,
  evaluate: evaluateInteraction,
};
/** Publish dialogue immediately; the evaluator depends on that actual reply.
 * Evaluation failure never discards dialogue or fabricates a score.
 */
export async function runDialogueTurn(
  input: {
    archetype: Archetype;
    pitch: string;
    history: Message[];
    provider: Provider;
  },
  onReply: (reply: string) => void,
  clients: Engines = engines,
): Promise<{ telemetry: Telemetry | null; error: string | null }> {
  const { archetype, pitch, provider } = input;
  let remaining = 60000;
  const history = input.history
    .filter((m) => m.status === "complete")
    .slice(-20)
    .reverse()
    .filter((m) => {
      remaining -= m.content.length;
      return remaining >= 0;
    })
    .reverse()
    .map(({ role, content }) => ({ role, content }));
  const reply =
    provider === "demo"
      ? `Before I commit, I need to understand the impact on my team as ${archetype.role}. What evidence supports your claim, and what would implementation cost?`
      : await clients.dialogue({ archetype, pitch, history, provider });
  onReply(reply);
  try {
    const telemetry =
      provider === "demo"
        ? {
            intentScore: 40,
            sentiment: "Sceptical · demo fixture",
            activeFriction:
              "Unproven value and implementation cost (illustrative).",
            suggestedTweak:
              "Add a measurable outcome, supporting evidence and a clear implementation plan.",
          }
        : await clients.evaluate({ archetype, pitch, response: reply });
    return { telemetry, error: null };
  } catch (error) {
    return {
      telemetry: null,
      error:
        error instanceof Error ? error.message : "Telemetry is unavailable.",
    };
  }
}
