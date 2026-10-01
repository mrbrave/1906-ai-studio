// Same-origin clients only: provider keys belong in server environment variables.
import type { DialogueRequest } from "./contracts";
import type { Provider } from "../types/database.types";
import { postJSON } from "./http";
import { nonEmpty, parseDraft, record } from "./validation";
export async function generateDialogue(
  request: DialogueRequest,
): Promise<string> {
  return nonEmpty(record(await postJSON("/api/dialogue", request)).text);
}
export async function synthesiseArchetype(
  description: string,
  provider: Exclude<Provider, "demo">,
) {
  return parseDraft(
    await postJSON("/api/archetype", { description, provider }),
  );
}
