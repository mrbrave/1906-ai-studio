import type { EvaluationRequest } from "../src/api/contracts";
import type { Telemetry } from "../src/types/database.types";
import { HttpError } from "./http";
/** Integration seam: supply the actual TypeSafe JEV endpoint/auth/payload mapping here.
 * Do not guess a vendor contract or substitute conversational-model scores.
 * Validate the vendor response with parseTelemetry before returning it.
 */
export async function evaluateWithJEV(
  _request: EvaluationRequest,
): Promise<Telemetry> {
  throw new HttpError(
    501,
    "JEV is not connected yet. Its endpoint, authentication and request schema are required. Your buyer reply has been saved.",
  );
}
