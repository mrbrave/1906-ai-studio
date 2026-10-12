import type { DecisionState } from "../types/live";
import { useEffect, useRef, useState } from "react";
import { X, Radar } from "lucide-react";
import type { Message } from "../types/database.types";
import {
  evidenceLabel,
  frictionLabels,
  insightAssessment,
  nextExploration,
  stanceLabels,
  verifiedBuyerEvidence,
} from "../services/buyerInsights";
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
  messages = [],
  replyPending = false,
  analysing = false,
  assessmentError,
  targetDecision,
}: {
  open: boolean;
  decision?: DecisionState | null;
  message?: Message;
  previous?: Message;
  preDecision?: DecisionState | null;
  messages?: Message[];
  replyPending?: boolean;
  analysing?: boolean;
  assessmentError?: string;
  targetDecision?: string;
  busy: boolean;
  onClose: () => void;
  onRetry: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const [overlay, setOverlay] = useState(
    () => window.matchMedia?.("(max-width: 1199px)").matches ?? false,
  );
  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 1199px)");
    if (!media) return;
    const update = () => setOverlay(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!open) return;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    close.current?.focus({ preventScroll: true });
    return () => {
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      else
        document
          .getElementById("analytics-toggle")
          ?.focus({ preventScroll: true });
    };
  }, [open, overlay]);
  if (!open) return null;
  const { current, shown, assessedMessage } = insightAssessment(
    message,
    decision,
    previous,
    replyPending,
  );
  const demo = message?.provider === "demo";
  const t =
    assessedMessage?.telemetry ??
    (demo && !replyPending ? message?.telemetry : undefined);
  const score = shown ? shown.readinessIndex : t?.intentScore;
  const needsAssessment = !!message && !demo && !current && !replyPending;
  const pre =
    preDecision ?? (decision?.phase !== "post_reply" ? decision : null);
  const evidence = verifiedBuyerEvidence(shown, messages);
  const failed = !!assessmentError || message?.telemetry_status === "failed";
  const stale = !!shown && !current;
  return (
    <>
      {overlay && (
        <button
          className="insights-backdrop"
          tabIndex={-1}
          aria-label="Dismiss insights"
          onClick={onClose}
        />
      )}
      <aside
        ref={panel}
        role={overlay ? "dialog" : undefined}
        aria-modal={overlay || undefined}
        id="telemetry"
        className="telemetry"
        aria-label="Buyer insights"
        onKeyDown={(e) => {
          if (overlay && e.key === "Tab") {
            const targets = Array.from(
              panel.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled), summary, a[href]",
              ) ?? [],
            ).filter((element) => {
              // Closed details keep their summary reachable, but hide descendants.
              let ancestor = element.parentElement;
              while (ancestor && ancestor !== panel.current) {
                if (
                  ancestor.tagName === "DETAILS" &&
                  !ancestor.hasAttribute("open") &&
                  ancestor.firstElementChild !== element
                )
                  return false;
                ancestor = ancestor.parentElement;
              }
              return true;
            });
            const first = targets[0],
              last = targets.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            }
            if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <header>
          <h2>
            <Radar size={18} /> Buyer insights
          </h2>
          <button ref={close} onClick={onClose} aria-label="Close insights">
            <X size={20} />
          </button>
        </header>
        <div className="telemetry-body">
          <div className="insight-freshness" role="status">
            <p className="eyebrow">
              {demo
                ? "Illustrative demo insights"
                : current
                  ? "Latest reply assessed"
                  : stale
                    ? "Previous insights · not the latest exchange"
                    : "Insights not yet available"}
            </p>
            {replyPending && (
              <p>The latest message has no assessed buyer reply yet.</p>
            )}
            {targetDecision && (
              <p>
                <strong>Next step:</strong> {targetDecision}
              </p>
            )}
          </div>
          {needsAssessment && (
            <section className="insight-update" aria-label="Insights update">
              <p role={failed ? "alert" : "status"}>
                {analysing
                  ? "Updating insights for the saved reply…"
                  : failed
                    ? "Your reply is saved. Insights could not be updated."
                    : "This reply is saved and ready to assess."}
              </p>
              {!analysing && (
                <button disabled={busy} onClick={onRetry}>
                  {failed ? "Retry insights" : "Update insights"}
                </button>
              )}
              <p className="muted">
                You can keep drafting. This only updates insights and uses
                metered analysis; it does not generate another reply.
              </p>
              {failed && !analysing && (
                <details>
                  <summary>Error details</summary>
                  <p>
                    {assessmentError ??
                      message?.error ??
                      "No valid result returned."}
                  </p>
                </details>
              )}
            </section>
          )}
          <section>
            <h3>Where they stand</h3>
            <p className="stance-label">
              {shown
                ? (stanceLabels[shown.stance ?? "unknown"] ?? "Not yet clear")
                : demo
                  ? "Illustrative response"
                  : "Not yet assessed"}
            </p>
          </section>
          <section>
            <h3>Decision readiness</h3>
            <div
              className={`score ${score == null ? "score-unavailable" : ""}`}
            >
              {score ?? "Not yet clear"}
              {score != null && <span>/100</span>}
            </div>
            <p className="muted">
              A simulation index for this next step, not a conversion
              probability.
            </p>
            {shown?.status === "provisional" && (
              <p className="insight-caveat">
                Tentative estimate — see assessment details.
              </p>
            )}
            {shown?.unavailableReason && <p>{shown.unavailableReason}</p>}
            <div className="score-track" aria-hidden="true">
              <div style={{ width: `${score ?? 0}%` }} />
            </div>
          </section>
          <section className="friction">
            <h3>What’s holding them back?</h3>
            <p>
              {shown
                ? (frictionLabels[shown.friction] ?? "Not yet clear")
                : (t?.activeFriction ?? "Not yet assessed")}
            </p>
            {!!shown?.remainingConditions?.length && (
              <>
                <h4>Still to resolve</h4>
                <ul>
                  {shown.remainingConditions.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
          <section>
            <h3>Supporting evidence</h3>
            <p>
              {shown?.rubricVersion === "1906-decision-v3"
                ? evidenceLabel(shown.evidenceStrength)
                : shown
                  ? "This earlier assessment did not score supporting evidence separately."
                  : demo
                    ? "Illustrative only"
                    : "Not yet assessed"}
            </p>
            {shown?.dimensions?.evidence_sufficiency.status ===
              "provisional" && <p className="muted">Tentative assessment</p>}
          </section>
          <section>
            <h3>How they’re responding</h3>
            <p>{t?.sentiment ?? shown?.sentiment ?? "Not yet assessed"}</p>
          </section>
          <section className="tweak">
            <h3>What to explore next</h3>
            {stale && <p>Based on the previous assessed reply:</p>}
            <p>
              {shown
                ? nextExploration(shown, evidence)
                : (t?.suggestedTweak ??
                  "Start with a message to learn what matters to this buyer.")}
            </p>
          </section>
          <details className="insight-details">
            <summary>Assessment details</summary>
            <div>
              {shown && (
                <>
                  <h3>Readiness confidence</h3>
                  <p>{confidence(shown.readinessConfidence)}</p>
                  <h3>Stance confidence</h3>
                  <p>{confidence(shown.stanceConfidence)}</p>
                  <h3>Sentiment confidence</h3>
                  <p>{confidence(shown.sentimentConfidence)}</p>
                  <h3>Obstacle confidence</h3>
                  <p>{confidence(shown.frictionConfidence)}</p>
                  {shown.rubricVersion === "1906-decision-v3" ? (
                    <>
                      <h3>Supporting evidence for this decision</h3>
                      <p>
                        {shown.evidenceStrength == null
                          ? "Not supplied"
                          : `${shown.evidenceStrength}/4 · evidence rubric`}
                      </p>
                      <p>
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
                      <p>
                        Whether there is enough conversation to assess
                        readiness; separate from evidence supporting the offer.
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
                      <p>
                        This older field assessed available conversation, not
                        the strength of product evidence.
                      </p>
                    </>
                  )}
                  {shown.missingInformation?.map((x) => (
                    <p key={x}>{x}</p>
                  ))}
                  <h3>Assessment source</h3>
                  <p>
                    Completed exchange · turn {shown.version} ·{" "}
                    {shown.rubricVersion} · {shown.jevModel}
                  </p>
                  <p>Evaluated through reply {shown.evaluatedThrough}</p>
                  <h3>Buyer statements used</h3>
                  {evidence.length ? (
                    evidence.map((e) => (
                      <div key={e.turnId}>
                        {e.quotes.map((q, i) => (
                          <blockquote key={i}>{q}</blockquote>
                        ))}
                        <button
                          className="source-link"
                          onClick={() => {
                            onClose();
                            queueMicrotask(() => {
                              const source = document.getElementById(
                                `message-${e.turnId}`,
                              );
                              source?.focus({ preventScroll: true });
                              source?.scrollIntoView({ block: "center" });
                            });
                          }}
                        >
                          View buyer message
                        </button>
                        <p className="muted">
                          {e.source === "memory"
                            ? "Retained earlier statement"
                            : "Recent statement"}{" "}
                          · {e.turnId}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p>
                      No verified buyer quote is attached to these insights.
                    </p>
                  )}
                </>
              )}
              {pre && (
                <>
                  <h3>Before the reply</h3>
                  <p>
                    Pre-reply guidance · through user turn{" "}
                    {pre.evaluatedThrough ?? "legacy record"}. Readiness{" "}
                    {pre.readinessIndex ?? "unavailable"}; action{" "}
                    {pre.responseAction.replaceAll("_", " ")}. This did not
                    evaluate the buyer’s reply.
                  </p>
                </>
              )}
              {!!shown?.concerns?.length && (
                <>
                  <h3>Concern history</h3>
                  {shown.concerns.map((x, i) => (
                    <p key={i}>
                      {frictionLabels[x.category] ?? x.category}: {x.status} ·{" "}
                      {x.evidenceTurnId ?? x.turnId}
                    </p>
                  ))}
                </>
              )}
              <p>
                JEV guides and assesses the simulation; it is not independent
                customer validation. Numerical confidence is a model estimate,
                not a calibrated probability of buyer behaviour.
              </p>
            </div>
          </details>
        </div>
      </aside>
    </>
  );
}
