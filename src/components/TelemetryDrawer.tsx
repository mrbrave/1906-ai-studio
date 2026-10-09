import type { DecisionState } from "../types/live";
import { useEffect, useRef } from "react";
import { X, Radar } from "lucide-react";
import type { Message } from "../types/database.types";
const confidence = (n: number | null | undefined) =>
  n == null
    ? "Not supplied"
    : `${Math.round(n * 100)}% · model estimate, not calibrated`;
export function TelemetryDrawer({
  open,
  message,
  busy,
  onClose,
  onRetry,
  decision,
  preDecision,
  previous,
}: {
  open: boolean;
  decision?: DecisionState | null;
  message?: Message;
  previous?: Message;
  preDecision?: DecisionState | null;
  busy: boolean;
  onClose: () => void;
  onRetry: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) close.current?.focus({ preventScroll: true });
  }, [open]);
  if (!open) return null;
  const current =
    decision?.phase === "post_reply" &&
    decision.evaluatedThrough === message?.id &&
    message?.telemetry_status === "complete";
  const demo = message?.provider === "demo";
  const shown = current ? decision : previous?.evaluation;
  const t = current
    ? message?.telemetry
    : (previous?.telemetry ?? (demo ? message?.telemetry : undefined));
  const score = shown?.readinessIndex ?? t?.intentScore;
  const needsAssessment = !!message && !demo && !current;
  const pre =
    preDecision ?? (decision?.phase !== "post_reply" ? decision : null);
  return (
    <aside
      id="telemetry"
      className="telemetry"
      aria-label="Evaluator telemetry"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <header>
        <h2>
          <Radar size={18} /> Evaluator telemetry
        </h2>
        <button ref={close} onClick={onClose} aria-label="Close analytics">
          <X size={20} />
        </button>
      </header>
      <div className="telemetry-body" aria-live="polite">
        <p className="eyebrow">
          {demo
            ? "Demo fixture · not a prediction"
            : current
              ? "JEV · completed exchange"
              : shown
                ? "Previous completed assessment · not the latest reply"
                : "Completed-exchange assessment unavailable"}
        </p>
        {needsAssessment && (
          <section>
            <p role="status">
              {message.telemetry_status === "failed"
                ? `Assessment failed: ${message.error ?? "No valid result returned."}`
                : busy
                  ? "Assessing the latest exchange…"
                  : "This reply has not yet been assessed."}
            </p>
            <button disabled={busy} onClick={onRetry}>
              {message.telemetry_status === "failed"
                ? "Retry assessment"
                : "Assess latest reply"}
            </button>
            <p className="muted">
              Assessment uses JEV only and does not generate another persona
              reply.
            </p>
          </section>
        )}
        <div>
          <h3 className="eyebrow">Decision readiness</h3>
          <div className="score">
            {score ?? "Unavailable"}
            {score != null && <span>/100</span>}
          </div>
          <p>{shown?.unavailableReason}</p>
          {shown?.status === "provisional" && (
            <p>
              Provisional estimate · review confidence and assessment grounding.
            </p>
          )}
          <div className="score-track">
            <div style={{ width: `${score ?? 0}%` }} />
          </div>
        </div>
        {shown && (
          <>
            <div>
              <h3>Readiness confidence</h3>
              <p>{confidence(shown.readinessConfidence)}</p>
            </div>
            <div>
              <h3>Current stance</h3>
              <p>{shown.stance?.replaceAll("_", " ") ?? "Not established"}</p>
              <p className="muted">{confidence(shown.stanceConfidence)}</p>
            </div>
          </>
        )}
        <div>
          <h3>Evaluated sentiment</h3>
          <p>{t?.sentiment ?? "Not assessed"}</p>
          {shown && (
            <p className="muted">{confidence(shown.sentimentConfidence)}</p>
          )}
        </div>
        <section className="friction">
          <h3>Active friction</h3>
          <p>{t?.activeFriction ?? "Not assessed"}</p>
          {shown && (
            <p className="muted">{confidence(shown.frictionConfidence)}</p>
          )}
        </section>
        {shown && (
          <>
            <section>
              <h3>Remaining conditions</h3>
              {shown.remainingConditions?.length ? (
                <ul>
                  {shown.remainingConditions.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              ) : (
                <p>No specific conditions established by this assessment.</p>
              )}
            </section>
            <section>
              {shown.rubricVersion === "1906-decision-v3" ? (
                <>
                  <h3>Supporting evidence for this decision</h3>
                  <p>
                    {shown.evidenceStrength == null
                      ? "Not supplied"
                      : `${shown.evidenceStrength}/4 · evidence rubric`}
                  </p>
                  <p className="muted">
                    {shown.dimensions?.evidence_sufficiency.status} ·{" "}
                    {confidence(
                      shown.dimensions?.evidence_sufficiency.confidence,
                    )}
                  </p>
                  <h3>Assessment grounding</h3>
                  <p>
                    {shown.assessmentGrounding == null
                      ? "Not supplied"
                      : `${Math.round(shown.assessmentGrounding * 100)}% · evaluator estimate`}
                  </p>
                  <p className="muted">
                    Whether there is enough conversation to assess readiness;
                    separate from evidence supporting the offer.
                  </p>
                </>
              ) : (
                <>
                  <h3>Legacy assessment grounding</h3>
                  <p>
                    {shown.evidenceSufficiency == null
                      ? "Not supplied"
                      : `${Math.round(shown.evidenceSufficiency * 100)}% · evaluator estimate`}
                  </p>
                  <p className="muted">
                    This older field assessed available conversation, not the
                    strength of product evidence.
                  </p>
                </>
              )}
              {shown.missingInformation?.map((x) => (
                <p key={x}>{x}</p>
              ))}
            </section>
          </>
        )}
        <section className="tweak">
          <h3>Suggested next approach</h3>
          <p>
            {t?.suggestedTweak ??
              "Await the assessment of the completed exchange."}
          </p>
        </section>
        {shown && (
          <p className="muted">
            Evaluated through reply {shown.evaluatedThrough} · turn{" "}
            {shown.version} · {shown.rubricVersion}
          </p>
        )}
        {decision && (
          <details>
            <summary>Pre-reply guidance and concern history</summary>
            {pre && (
              <p>
                Pre-reply state · assessed through user turn{" "}
                {pre.evaluatedThrough ?? "legacy record"}. Readiness{" "}
                {pre.readinessIndex ?? "unavailable"}; action{" "}
                {pre.responseAction.replaceAll("_", " ")}. This did not evaluate
                the displayed reply.
              </p>
            )}
            {(shown ?? decision).concerns?.map((x, i) => (
              <p key={i}>
                {x.category}: {x.status} · {x.evidenceTurnId ?? x.turnId}
              </p>
            ))}
          </details>
        )}
        <p className="muted">
          A simulation index, not a real-world purchase probability. The 0–4
          readiness rubric maps to 0–100; conditional willingness is distinct
          from unconditional commitment. JEV guides and assesses the simulation,
          so this is not independent buyer validation.
        </p>
      </div>
    </aside>
  );
}
