import { randomUUID } from "node:crypto";
import { initialStore } from "../server/repository.ts";
import { QUESTIONS } from "../server/jev.ts";
export function configure() {
  Object.assign(process.env, {
    STUDIO_ENABLE_LIVE: "true",
    STUDIO_ACCESS_TOKEN: "private-test-access-code-32-characters",
    STUDIO_BUDGET_USD: "10",
    TYPESAFE_API_KEY: "fake-typesafe",
    JEV_MODEL: "jev-1.13.0",
    GEMINI_API_KEY: "fake-google",
    GEMINI_MODEL: "gemini-3.8-flash",
    GEMINI_BILLING_TIER: "paid",
  });
}
export class MemoryRepository {
  state = initialStore();
  revision = 0;
  async read() {
    return { state: structuredClone(this.state), revision: this.revision };
  }
  async compareAndSwap(revision, state) {
    if (revision !== this.revision) return false;
    this.state = structuredClone(state);
    this.revision++;
    return true;
  }
}
export function jevResponse(friction = "credibility") {
  const answers = {};
  for (const [name, q] of Object.entries(QUESTIONS)) {
    if (q.type === "noul") {
      answers[name] = {
        type: "noul",
        noul: name === "sufficient" ? 0.95 : 0.05,
      };
      continue;
    }
    const keys =
      q.type === "score"
        ? q.criteria.map((_, i) => String(i))
        : Object.keys(q.criteria);
    const selected =
      q.type === "score"
        ? name === "readiness"
          ? "2"
          : "1"
        : name === "friction"
          ? friction
          : "cautiously_positive";
    const probabilities = Object.fromEntries(
      keys.map((k) => [k, k === selected ? 1 : 0]),
    );
    answers[name] = {
      type: q.type,
      confidence: 1,
      probabilities,
      ...(q.type === "score"
        ? {
            score: Number(selected),
            legend: Object.fromEntries(q.criteria.map((v, i) => [i, v])),
          }
        : { choice: selected }),
    };
  }
  return {
    model: "jev-1.13.0",
    answers,
    usage: { input_tokens: 3000, output_tokens: 80 },
  };
}
export function geminiResponse(text = "Show me relevant evidence.") {
  return {
    modelVersion: "gemini-3.8-flash",
    responseId: randomUUID(),
    candidates: [{ finishReason: "STOP", content: { parts: [{ text }] } }],
    usageMetadata: {
      promptTokenCount: 4000,
      candidatesTokenCount: 400,
      thoughtsTokenCount: 100,
      totalTokenCount: 4500,
    },
  };
}
export async function conversation(repo) {
  const { studio } = await import("../server/studio.ts");
  const id = randomUUID();
  await studio(
    {
      action: "create_conversation",
      id,
      archetypeId: repo.state.data.archetypes[0].id,
      intent: {
        objective: "Assess relevance",
        proposition: "A coaching programme",
        targetDecision: "Agree to a discovery workshop",
      },
    },
    repo,
  );
  return id;
}
export function request(conversationId, expectedVersion = 0) {
  return {
    requestId: randomUUID(),
    conversationId,
    pitch: "We can support the team within six weeks.",
    expectedVersion,
  };
}
