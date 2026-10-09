/** Public evaluation values. Private motivation dimensions live in server types. */
export type RubricVersion = "1906-decision-v2" | "1906-decision-v3";
export type DimensionStatus =
  "complete" | "provisional" | "missing" | "invalid" | "unavailable";
export interface Dimension<T> {
  value: T | null;
  status: DimensionStatus;
  reason?: string;
}
export interface ScoredDimension<T = number> extends Dimension<T> {
  confidence: number | null;
}
export interface BuyerEvidence {
  turnId: string;
  source: "recent" | "memory";
  quotes: string[];
}
export interface DecisionDimensions {
  readiness: ScoredDimension;
  evidence_sufficiency: ScoredDimension;
  assessment_grounding: Dimension<number>;
  friction: ScoredDimension<string>;
  sentiment: ScoredDimension<string>;
  stance: ScoredDimension<string>;
  stanceEvidence: ScoredDimension<BuyerEvidence>;
  frictionEvidence: ScoredDimension<BuyerEvidence>;
  conditions: Record<string, Dimension<number>>;
  resolutions: Record<
    string,
    {
      resolved: Dimension<number>;
      evidence: ScoredDimension<BuyerEvidence>;
    }
  >;
}
