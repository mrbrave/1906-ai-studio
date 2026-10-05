import type { DecisionState } from "../types/live";
import { useEffect, useRef } from "react";
import { X, Radar, TriangleAlert, WandSparkles } from "lucide-react";
import type { Message } from "../types/database.types";
export function TelemetryDrawer({
  open,
  message,
  busy,
  onClose,
  onRetry,
  decision,
}: {
  open: boolean;
  decision?: DecisionState | null;
  message?: Message;
  busy: boolean;
  onClose: () => void;
  onRetry: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) close.current?.focus();
  }, [open]);
  if (!open) return null;
  const t = message?.telemetry;
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
          {message?.provider === "demo"
            ? "Demo fixture · not a prediction"
            : "JEV · state used for this reply"}
        </p>
        <div>
          <h3 className="eyebrow">Decision readiness</h3>
          <div className="score">
            {decision
              ? (decision.readinessIndex ?? "Uncertain")
              : (t?.intentScore ?? "—")}
            <span>{decision?.readinessIndex === null ? "" : "/100"}</span>
          </div>
          <div className="score-track">
            <div style={{ width: `${t?.intentScore ?? 0}%` }} />
          </div>
        </div>
        <div>
          <h3 className="eyebrow">Evaluated sentiment</h3>
          <p className="sentiment">
            {t?.sentiment ||
              (busy || message?.telemetry_status === "pending"
                ? "Evaluating…"
                : message?.telemetry_status === "failed"
                  ? "Unavailable"
                  : "Awaiting pitch")}
          </p>
        </div>
        <p className="muted">
          A simulation index, not a real-world purchase probability.
        </p>
        {decision && (
          <p className="muted">
            Response action: {decision.responseAction.replaceAll("_", " ")}
          </p>
        )}
        {t ? (
          <>
            <section className="friction">
              <h3>
                <TriangleAlert size={16} /> Active friction
              </h3>
              <p>{t.activeFriction}</p>
            </section>
            <section className="tweak">
              <h3>
                <WandSparkles size={16} /> Suggested next approach
              </h3>
              <p>{t.suggestedTweak}</p>
            </section>
          </>
        ) : (
          <p className="empty-telemetry">
            {message?.error ||
              "Send a pitch to assess the buyer’s decision state before the reply."}
          </p>
        )}
      </div>
    </aside>
  );
}
