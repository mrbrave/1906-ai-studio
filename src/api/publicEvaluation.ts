import type {
  BuyerEvidence,
  DecisionDimensions,
  Dimension,
  ScoredDimension,
} from "../types/evaluation";

const CONDITION_KEYS = [
  "commercials",
  "scope",
  "timeline",
  "evidence",
  "implementation",
  "authority",
  "confidentiality",
];
const FRICTION_KEYS = [
  "cost",
  "commercial_terms",
  "credibility",
  "implementation",
  "fit",
  "timing",
  "authority",
  "identity_fit",
  "other",
];
function dimension<T>(d: Dimension<T>, project: (v: T) => T): Dimension<T> {
  if (
    !["complete", "provisional", "missing", "invalid", "unavailable"].includes(
      d.status,
    ) ||
    (d.reason !== undefined && typeof d.reason !== "string")
  )
    throw new Error("Invalid public dimension.");
  return {
    value: d.value === null ? null : project(d.value),
    status: d.status,
    ...(d.reason !== undefined ? { reason: d.reason } : {}),
  };
}
function scalar<T>(v: T): T {
  if (
    !["number", "string"].includes(typeof v) ||
    (typeof v === "number" && !Number.isFinite(v))
  )
    throw new Error("Invalid public evaluation value.");
  return v;
}
function scored<T>(
  d: ScoredDimension<T>,
  project: (v: T) => T = scalar,
): ScoredDimension<T> {
  if (
    d.confidence !== null &&
    (typeof d.confidence !== "number" ||
      !Number.isFinite(d.confidence) ||
      d.confidence < 0 ||
      d.confidence > 1)
  )
    throw new Error("Invalid public confidence.");
  return { ...dimension(d, project), confidence: d.confidence };
}
function evidence(e: BuyerEvidence): BuyerEvidence {
  if (
    typeof e.turnId !== "string" ||
    !["recent", "memory"].includes(e.source) ||
    !Array.isArray(e.quotes) ||
    e.quotes.some((q) => typeof q !== "string")
  )
    throw new Error("Invalid public evidence.");
  return { turnId: e.turnId, source: e.source, quotes: [...e.quotes] };
}
/** Whitelist at every depth: motivation results never cross this boundary. */
export function publicDimensions(d: DecisionDimensions): DecisionDimensions {
  return {
    readiness: scored(d.readiness),
    evidence_sufficiency: scored(d.evidence_sufficiency),
    assessment_grounding: dimension(d.assessment_grounding, scalar),
    friction: scored(d.friction),
    sentiment: scored(d.sentiment),
    stance: scored(d.stance),
    stanceEvidence: scored(d.stanceEvidence, evidence),
    frictionEvidence: scored(d.frictionEvidence, evidence),
    conditions: Object.fromEntries(
      CONDITION_KEYS.filter((k) => d.conditions[k] !== undefined).map((k) => [
        k,
        dimension(d.conditions[k], scalar),
      ]),
    ),
    resolutions: Object.fromEntries(
      FRICTION_KEYS.filter((k) => d.resolutions[k] !== undefined).map((k) => [
        k,
        {
          resolved: dimension(d.resolutions[k].resolved, scalar),
          evidence: scored(d.resolutions[k].evidence, evidence),
        },
      ]),
    ),
  };
}
