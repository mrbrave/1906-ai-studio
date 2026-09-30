import type { EvaluationRequest } from "./contracts";
import { postJSON } from "./http";
import { parseTelemetry } from "./validation";
/** Application-facing JEV contract. Vendor-specific translation lives on the server. */
export async function evaluateInteraction(request: EvaluationRequest) {
  return parseTelemetry(await postJSON("/api/evaluate", request));
}
