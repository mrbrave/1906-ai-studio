import type { LiveConversation } from "../src/types/live";
import type { Message } from "../src/types/database.types";
import type { RubricVersion } from "../src/types/evaluation";
import type { PrivatePersonaRevision } from "./persona-private";
import {
  jevBody as legacyBody,
  parseDecision as legacyDecision,
} from "./jev-v2.js";
import { jevBodyV3, parseDecisionV3, RUBRIC_V3 } from "./jev-v3.js";
import { HttpError } from "./http.js";
export { QUESTIONS, STANCES, CONDITIONS, evaluateWithJEV } from "./jev-v2.js";
export { FRICTIONS, QUESTIONS_V3, RUBRIC_V3 } from "./jev-v3.js";
export function rubricVersion(value?: RubricVersion): RubricVersion {
  if (value === undefined || value === "1906-decision-v2")
    return "1906-decision-v2";
  if (value === RUBRIC_V3) return value;
  throw new HttpError(409, "Unsupported evaluation version.");
}
export interface EvaluationContext {
  rubricVersion?: RubricVersion;
  privateProfile?: PrivatePersonaRevision | null;
}
export function jevBody(
  c: LiveConversation,
  history: Message[],
  pitch: string,
  phase: "pre_reply" | "post_reply" = "pre_reply",
  context?: EvaluationContext,
) {
  return rubricVersion(context?.rubricVersion ?? c.rubricVersion) === RUBRIC_V3
    ? jevBodyV3(c, history, pitch, phase, context?.privateProfile)
    : legacyBody(c, history, pitch, phase);
}
export function parseDecision(
  raw: unknown,
  c: LiveConversation,
  evaluatedThrough = "unrecorded",
  phase: "pre_reply" | "post_reply" = "pre_reply",
  history: Message[] = [],
  context?: EvaluationContext,
) {
  return rubricVersion(context?.rubricVersion ?? c.rubricVersion) === RUBRIC_V3
    ? parseDecisionV3(
        raw,
        c,
        evaluatedThrough,
        phase,
        history,
        context?.privateProfile,
      )
    : legacyDecision(raw, c, evaluatedThrough, phase, history);
}
