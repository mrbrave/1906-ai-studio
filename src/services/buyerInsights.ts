import type { Message } from "../types/database.types";
import type { DecisionState } from "../types/live";
import type { BuyerEvidence } from "../types/evaluation";

export const stanceLabels: Record<string, string> = {
  agreed: "Ready to take the next step",
  conditional_agreement: "Open to proceeding, with conditions",
  exploring: "Still exploring",
  declined: "Has declined the next step",
  unknown: "Not yet clear",
};
export const frictionLabels: Record<string, string> = {
  cost: "Cost or value for money",
  credibility: "Needs supporting evidence",
  implementation: "Effort, setup or day-to-day use",
  fit: "Fit with their needs",
  timing: "Timing or other priorities",
  authority: "Internal approval",
  identity_fit: "Fit with their professional expectations",
  commercial_terms: "Commercial terms to agree",
  other: "Another concern remains",
  none: "No material obstacle identified",
  unknown: "The remaining obstacle is not yet clear",
};

export function completedAssessment(message?: Message) {
  return message?.telemetry_status === "complete" &&
    message.evaluation?.phase === "post_reply" &&
    message.evaluation.evaluatedThrough === message.id
    ? message.evaluation
    : undefined;
}

/** Do not let a pre-reply result or a stale assessment look like a current buyer reaction. */
export function insightAssessment(
  message?: Message,
  decision?: DecisionState | null,
  previous?: Message,
  replyPending = false,
) {
  const current =
    !replyPending &&
    message?.telemetry_status === "complete" &&
    decision?.phase === "post_reply" &&
    decision.evaluatedThrough === message.id;
  const previousState = completedAssessment(previous);
  return {
    current: !!current,
    shown: current ? decision : previousState,
    assessedMessage: current ? message : previousState ? previous : undefined,
  };
}

/** Verify public evidence against the stored buyer transcript before quoting or tailoring advice. */
export function verifiedBuyerEvidence(
  state: DecisionState | null | undefined,
  messages: Message[],
): BuyerEvidence[] {
  const candidates = [
    state?.dimensions?.frictionEvidence,
    state?.dimensions?.stanceEvidence,
  ];
  const found = new Map<string, BuyerEvidence>();
  for (const dimension of candidates) {
    const evidence = dimension?.status === "complete" ? dimension.value : null;
    const source =
      evidence &&
      messages.find((m) => m.id === evidence.turnId && m.role === "assistant");
    if (!evidence || !source) continue;
    const quotes = evidence.quotes.filter(
      (q) => q.trim() && source.content.includes(q),
    );
    if (quotes.length)
      found.set(evidence.turnId, {
        ...evidence,
        quotes: [
          ...new Set([
            ...(found.get(evidence.turnId)?.quotes ?? []),
            ...quotes,
          ]),
        ],
      });
  }
  return [...found.values()];
}

export function nextExploration(
  state: DecisionState,
  evidence: BuyerEvidence[],
): string {
  if (state.stance === "declined")
    return "Acknowledge their decision. Leave the next move with them.";
  if (
    state.stance === "agreed" &&
    !state.remainingConditions?.length &&
    state.friction === "none"
  )
    return "Confirm the agreed next step and what each person needs to do.";
  const buyerWords = evidence.flatMap((e) => e.quotes).join(" ");
  if (
    state.friction === "credibility" &&
    /comparab|similar/i.test(buyerWords) &&
    /growth/i.test(buyerWords)
  )
    return "Clarify what made the earlier growth team comparable; offer an anonymised example if one exists.";
  const advice: Record<string, string> = {
    credibility:
      "Ask what evidence would help them decide. Offer a relevant, verifiable example if one is available.",
    implementation:
      "Ask what effort their team could realistically take on for this next step.",
    commercial_terms:
      "Ask which commercial term still needs agreement before they can proceed.",
    cost: "Ask what would make the cost worthwhile for this next step.",
    fit: "Ask which part of their workflow the offer still needs to address.",
    timing: "Ask when they could realistically take the next step.",
    authority: "Ask who else needs to be involved in this decision.",
    identity_fit:
      "Ask what would make the offer meet their professional expectations.",
    other: "Ask which unresolved concern matters most to their next decision.",
    none: "Ask whether they are comfortable taking the next step you are testing.",
    unknown:
      "Ask what, if anything, still needs to be resolved before the next step.",
  };
  if (
    state.remainingConditions?.length &&
    ["none", "unknown"].includes(state.friction)
  )
    return "Ask which of the remaining conditions they would like to resolve first.";
  return advice[state.friction] ?? advice.unknown;
}

export function evidenceLabel(value: number | null | undefined) {
  if (value == null) return "Not yet assessed";
  if (value < 0.5) return "No relevant support identified";
  if (value < 1.5) return "Mostly claims that still need support";
  if (value < 2.5) return "Relevant details, with an important gap";
  if (value < 3.5) return "Credible support, with a remaining gap";
  return "Enough support for this next step";
}
