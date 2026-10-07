import { HttpError } from "./http.js";
import { nonEmpty } from "../src/api/validation.js";
import { MAX_INPUT_TOKENS, MAX_OUTPUT_TOKENS } from "./budget.js";
import { modelPost } from "./model-http.js";
import { CONTINUATION_ERROR } from "./context.js";
export type ChatMessage = { role: "user" | "assistant"; content: string };
export function geminiBody(
  system: string,
  messages: ChatMessage[],
  json = false,
) {
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      thinkingConfig: { thinkingLevel: "low" },
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  };
}
export async function complete(body: ReturnType<typeof geminiBody>) {
  const key = process.env.GEMINI_API_KEY,
    model = process.env.GEMINI_MODEL;
  if (!key || !model)
    throw new HttpError(
      503,
      "Gemini requires a server API key and model configuration.",
    );
  const base = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`;
  // Official token counting, including the system instruction. No character/token guessing.
  let count: any;
  try {
    const r = await fetch(`${base}:countTokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        generateContentRequest: { model: `models/${model}`, ...body },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error();
    count = await r.json();
  } catch {
    throw new HttpError(
      502,
      "Gemini input counting failed. No generation was requested.",
    );
  }
  if (!Number.isSafeInteger(count.totalTokens) || count.totalTokens < 0)
    throw new HttpError(
      502,
      "Gemini input count was invalid. No generation was requested.",
    );
  if (count.totalTokens > MAX_INPUT_TOKENS)
    throw new HttpError(413, CONTINUATION_ERROR);
  return modelPost(`${base}:generateContent`, { "x-goog-api-key": key }, body);
}
export function completionText(raw: any): string {
  if (raw?.candidates?.[0]?.finishReason !== "STOP")
    throw new Error(
      "Gemini did not finish a usable reply. Retry with a shorter message.",
    );
  return nonEmpty(
    raw.candidates[0].content?.parts
      ?.filter((p: any) => !p.thought)
      .map((p: any) => p.text || "")
      .join(""),
    16000,
  );
}
