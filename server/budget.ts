import type { Store, Attempt } from "./repository";
import type { UsageSummary } from "../src/types/live";
import { HttpError } from "./http.js";
// Integer nanodollars: one USD = 1e9 units, no per-call cent rounding.
export function dollars(value: string | undefined): number {
  if (!value || !/^\d{1,5}(\.\d{1,9})?$/.test(value))
    throw new HttpError(503, "Set the private Studio allowance in USD.");
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 1e9 + Number(fraction.padEnd(9, "0"));
  if (!Number.isSafeInteger(amount) || amount > 10_000 * 1e9)
    throw new HttpError(503, "Test allowance must not exceed USD 10,000.");
  return amount;
}
export function totals(s: Store) {
  const spent =
    s.operations
      .flatMap((o) => o.attempts)
      .reduce((sum, a) => sum + (a.cost ?? 0), 0) +
    s.adjustments.reduce((sum, a) => sum + a.cost, 0);
  const reserved = s.operations.reduce((sum, o) => sum + o.reserve, 0);
  if (![spent, reserved].every((n) => Number.isSafeInteger(n) && n >= 0))
    throw new HttpError(503, "Usage ledger needs review.");
  return { spent, reserved };
}
export function usage(
  s: Store,
  allowance = dollars(process.env.STUDIO_BUDGET_USD),
): UsageSummary {
  const { spent, reserved } = totals(s);
  const remaining = Math.max(0, allowance - spent - reserved);
  return {
    remainingPercentage: allowance
      ? Math.min(100, (remaining / allowance) * 100)
      : 0,
    status: s.operations.some(
      (o) =>
        o.status === "uncertain" ||
        (o.status === "running" &&
          Date.now() - Date.parse(o.startedAt) > 120000),
    )
      ? "review_required"
      : remaining === 0
        ? "exhausted"
        : reserved > 0
          ? "pending"
          : "available",
    updatedAt: new Date().toISOString(),
  };
}
export function assertFunds(s: Store, reserve: number, allowance: number) {
  const { spent, reserved } = totals(s);
  if (allowance - spent - reserved < reserve)
    throw new HttpError(
      402,
      "Not enough usage remains for this request. Ask the Studio administrator to increase the allowance.",
    );
}
export function rates(
  provider: "jev" | "gemini",
  now = new Date(),
): Attempt["rates"] {
  if (provider === "jev") {
    if (process.env.JEV_MODEL !== "jev-1.13.0")
      throw new HttpError(
        503,
        "Set JEV_MODEL=jev-1.13.0 for this tested integration.",
      );
    return {
      input: 42,
      output: 0,
      cached: 42,
      version: "jev-1.13.0/2026-10-05",
    };
  }
  if (process.env.GEMINI_MODEL !== "gemini-3.8-flash")
    throw new HttpError(
      503,
      "This test rate card supports GEMINI_MODEL=gemini-3.8-flash. Add and verify a rate card before changing model.",
    );
  if (process.env.GEMINI_BILLING_TIER === "free")
    return { input: 0, output: 0, cached: 0, version: "gemini-3.8-flash/free" };
  if (process.env.GEMINI_BILLING_TIER !== "paid")
    throw new HttpError(
      503,
      "Set GEMINI_BILLING_TIER to paid or free to match your Google project.",
    );
  const factor = now.toISOString() < "2027-01-01" ? 1 : 2;
  return {
    input: 750 * factor,
    output: 3750 * factor,
    cached: 75 * factor,
    version: `gemini-3.8-flash/standard/${factor === 1 ? "2026" : "2027"}`,
  };
}
export const MAX_INPUT_TOKENS = 32768;
export const MAX_OUTPUT_TOKENS = 2048;
// Conservative full-model output envelope, including reasoning. Not an invoice guarantee.
export const OUTPUT_RESERVE_TOKENS = 131072;
export function reserveFor(provider: "jev" | "gemini", r: Attempt["rates"]) {
  return provider === "jev"
    ? 65536 * r.input
    : MAX_INPUT_TOKENS * r.input + OUTPUT_RESERVE_TOKENS * r.output;
}
export function cost(
  provider: "jev" | "gemini",
  raw: any,
  r: Attempt["rates"],
): { amount: number; usage: unknown } {
  const u = provider === "jev" ? raw?.usage : raw?.usageMetadata;
  const count = (n: unknown): number => {
    if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0)
      throw new Error("Missing or invalid provider usage.");
    return n;
  };
  let amount: number;
  if (provider === "jev")
    amount =
      count(u?.input_tokens) * r.input + count(u?.output_tokens) * r.output;
  else {
    const input = count(u?.promptTokenCount),
      cache = count(u?.cachedContentTokenCount ?? 0);
    const output = count(u?.candidatesTokenCount ?? 0),
      thoughts = count(u?.thoughtsTokenCount ?? 0);
    const total = count(u?.totalTokenCount);
    if (cache > input || total !== input + output + thoughts)
      throw new Error("Inconsistent Gemini usage.");
    amount =
      (input - cache) * r.input +
      cache * r.cached +
      (output + thoughts) * r.output;
  }
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new Error("Invalid calculated cost.");
  return { amount, usage: u };
}
