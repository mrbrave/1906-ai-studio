// Same-origin clients only: provider keys belong in server environment variables.
import type { Provider } from "../types/database.types";
import { postJSON } from "./http";
import { parseDraft, record } from "./validation";
export async function synthesiseArchetype(
  description: string,
  provider: Exclude<Provider, "demo">,
  requestId: string,
) {
  if (provider !== "gemini")
    throw new Error("Private testing uses Gemini with JEV.");
  return parseDraft(
    record(await postJSON("/api/archetype", { description, requestId })).result,
  );
}
