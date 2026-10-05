import { HttpError } from "./http.js";
import { nonEmpty } from "../src/api/validation.js";
export function parseProvider(p: unknown): "gemini" | "openai" {
  if (p !== "gemini" && p !== "openai")
    throw new HttpError(400, "Choose Gemini or OpenAI.");
  return p;
}
export async function complete(
  provider: "gemini" | "openai",
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
  json = false,
): Promise<string> {
  const key =
    process.env[provider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"];
  const model =
    process.env[provider === "gemini" ? "GEMINI_MODEL" : "OPENAI_MODEL"];
  if (!key || !model)
    throw new HttpError(
      503,
      `${provider} requires a server API key and model configuration.`,
    );
  const isGemini = provider === "gemini";
  const url = isGemini
    ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
    : "https://api.openai.com/v1/chat/completions";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(isGemini
      ? { "x-goog-api-key": key }
      : { Authorization: `Bearer ${key}` }),
  };
  const body = isGemini
    ? {
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          ...(json ? { responseMimeType: "application/json" } : {}),
          maxOutputTokens: 2048,
        },
      }
    : {
        model,
        messages: [{ role: "system", content: system }, ...messages],
        ...(json ? { response_format: { type: "json_object" } } : {}),
        max_completion_tokens: 2048,
      };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(35000),
    });
    if (!response.ok)
      throw new HttpError(
        502,
        `${provider} could not complete the request (${response.status}).`,
      );
    const data = await response.json();
    const text = isGemini
      ? data.candidates?.[0]?.content?.parts
          ?.filter((p: { thought?: boolean; text?: string }) => !p.thought)
          .map((p: { text?: string }) => p.text || "")
          .join("")
      : data.choices?.[0]?.message?.content;
    return nonEmpty(text);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      502,
      `${provider} returned no usable reply or timed out. Please retry.`,
    );
  }
}
