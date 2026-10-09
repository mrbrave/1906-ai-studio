import { record } from "../src/api/validation.js";
import type { Dimension, ScoredDimension } from "../src/types/evaluation";

export function unavailable<T>(reason: string): Dimension<T> {
  return { value: null, status: "unavailable", reason };
}
const probability = (n: unknown): number => {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1)
    throw Error();
  return n;
};
function distribution(value: unknown, keys: string[]) {
  const p = record(value);
  if (Object.keys(p).sort().join("|") !== [...keys].sort().join("|"))
    throw Error();
  const values = keys.map((k) => probability(p[k]));
  if (Math.abs(values.reduce((sum, n) => sum + n, 0) - 1) > 0.015)
    throw Error();
  return values;
}
/** Independent failures: one malformed answer does not erase other dimensions. */
export function answerReader(answers: Record<string, unknown>) {
  function scored<T>(
    name: string,
    parse: (d: Record<string, unknown>) => T,
  ): ScoredDimension<T> {
    if (answers[name] === undefined)
      return {
        value: null,
        confidence: null,
        status: "missing",
        reason: "Answer not returned.",
      };
    try {
      const d = record(answers[name]),
        value = parse(d);
      const confidence =
        d.confidence === undefined ? null : probability(d.confidence);
      return {
        value,
        confidence,
        status:
          confidence !== null && confidence >= 0.5 ? "complete" : "provisional",
        ...(confidence === null
          ? { reason: "Confidence not returned." }
          : confidence < 0.5
            ? { reason: "Low evaluator confidence." }
            : {}),
      };
    } catch {
      return {
        value: null,
        confidence: null,
        status: "invalid",
        reason: "Answer failed validation.",
      };
    }
  }
  return {
    score(name: string, levels = 5): ScoredDimension {
      return scored(name, (d) => {
        if (
          d.type !== "score" ||
          typeof d.score !== "number" ||
          !Number.isFinite(d.score) ||
          d.score < 0 ||
          d.score > levels - 1
        )
          throw Error();
        const keys = Array.from({ length: levels }, (_, i) => String(i));
        const p = distribution(d.probabilities, keys);
        if (Math.abs(p.reduce((sum, n, i) => sum + n * i, 0) - d.score) > 0.03)
          throw Error();
        if (d.legend !== undefined) {
          const legend = record(d.legend);
          if (
            Object.keys(legend).sort().join() !== keys.sort().join() ||
            Object.values(legend).some((v) => typeof v !== "string")
          )
            throw Error();
        }
        return d.score;
      });
    },
    choice(
      name: string,
      options: Record<string, unknown>,
    ): ScoredDimension<string> {
      return scored(name, (d) => {
        if (
          d.type !== "choice" ||
          typeof d.choice !== "string" ||
          !Object.hasOwn(options, d.choice)
        )
          throw Error();
        const keys = Object.keys(options),
          p = distribution(d.probabilities, keys);
        if (p[keys.indexOf(d.choice)] < Math.max(...p) - 1e-8) throw Error();
        return d.choice;
      });
    },
    noul(name: string): Dimension<number> {
      if (answers[name] === undefined)
        return {
          value: null,
          status: "missing",
          reason: "Answer not returned.",
        };
      try {
        const d = record(answers[name]);
        if (d.type !== "noul") throw Error();
        // Preserve 0 and 0.5 exactly. Noul has no separate provider confidence.
        return { value: probability(d.noul), status: "complete" };
      } catch {
        return {
          value: null,
          status: "invalid",
          reason: "Answer failed validation.",
        };
      }
    },
  };
}
