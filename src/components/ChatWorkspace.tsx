import { useEffect, useRef, useState } from "react";
import { PersonaContext } from "./PersonaContext";
import { ArrowUp, BarChart3, Menu } from "lucide-react";
import type { Archetype, Message, Provider } from "../types/database.types";
export type ReplyPhase = "idle" | "generating" | "saving" | "analysing";
interface Props {
  archetype: Archetype;
  messages: Message[];
  provider: Provider;
  busy: boolean;
  pendingHere: boolean;
  phase?: ReplyPhase;
  draftDisabled?: boolean;
  insightError?: boolean;
  sendBlockedReason?: string;
  analyticsOpen: boolean;
  onAnalytics: () => void;
  onSend: (text: string) => void;
  draft?: string;
  onDraft?: (text: string) => void;
  onRetry: (message: Message) => void;
  onMenu: () => void;
}
export function ChatWorkspace({
  archetype,
  messages,
  provider,
  busy,
  pendingHere,
  phase = pendingHere ? "generating" : "idle",
  draftDisabled = busy,
  insightError = false,
  sendBlockedReason,
  analyticsOpen,
  onAnalytics,
  onSend,
  onRetry,
  onMenu,
  draft,
  onDraft,
}: Props) {
  const [localText, setLocalText] = useState("");
  const text = draft ?? localText;
  const limit = provider === "demo" ? 16000 : 4000;
  const setText = onDraft ?? setLocalText;
  const composer = useRef<HTMLTextAreaElement>(null);
  const lastPhase = useRef(phase);
  useEffect(() => {
    if (
      lastPhase.current !== phase &&
      phase === "analysing" &&
      !draftDisabled
    ) {
      const active = document.activeElement;
      if (active === document.body || active?.closest(".composer"))
        composer.current?.focus();
    }
    lastPhase.current = phase;
  }, [phase, draftDisabled]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages.at(-1)?.id, phase === "generating"]);
  const failedTurn = messages.some(
    (m) => m.role === "user" && m.status === "failed",
  );
  function send() {
    if (text.trim() && !busy && !failedTurn && text.length <= limit) {
      onSend(text);
      if (!onDraft) setText("");
    }
  }
  return (
    <div className="chat-workspace">
      <header className="workspace-header">
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="mobile-menu"
            aria-label="Open navigation"
            onClick={onMenu}
          >
            <Menu />
          </button>
          <span className="avatar" aria-hidden="true">
            {archetype.avatar}
          </span>
          <div className="min-w-0">
            <h1 className="truncate">{archetype.name}</h1>
            <p className="role truncate">{archetype.role}</p>
          </div>
        </div>
        <button
          id="analytics-toggle"
          className="analytics-toggle"
          aria-expanded={analyticsOpen}
          aria-controls="telemetry"
          onClick={onAnalytics}
        >
          <BarChart3 size={16} />
          <span>Buyer insights</span>
        </button>
      </header>
      <PersonaContext persona={archetype} frozen />
      <div
        className="chat-stream"
        role="log"
        aria-label="Conversation"
        aria-live="polite"
      >
        <p className="session-label">
          Buyer simulation <span> / </span>{" "}
          {provider === "demo"
            ? "Demo mode · illustrative responses and scores"
            : "A simulated buyer, not real customer feedback"}
        </p>
        {!messages.length && (
          <div className="welcome">
            <span className="eyebrow">A conversation before the campaign.</span>
            <h2>
              Put your pitch
              <br />
              to the test.
            </h2>
            <p>
              Explore how {archetype.name} might respond to your proposition.
              Start with your message, then explore what matters to this buyer.
            </p>
            <div className="starter-prompts">
              {[
                "Here’s what we’re offering",
                "The price includes",
                "What matters most to you",
              ].map((s) => (
                <button
                  key={s}
                  disabled={draftDisabled}
                  onClick={() => {
                    setText(s + ": ");
                    composer.current?.focus();
                  }}
                >
                  {s} ↗
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            id={`message-${m.id}`}
            tabIndex={-1}
            role="article"
            aria-label={`Message from ${m.role === "user" ? "you" : archetype.name}`}
            className={`message-row ${m.role === "user" ? "user-row" : ""}`}
          >
            {m.role === "assistant" && (
              <span className="small-avatar" aria-hidden="true">
                {archetype.avatar}
              </span>
            )}
            <div
              className={`message ${m.role === "user" ? "bubble-user" : "bubble-persona"}`}
            >
              <small className="message-speaker">
                {m.role === "user" ? "You" : archetype.name}
              </small>
              <p>{m.content}</p>
              {m.role === "user" && m.status === "pending" && (
                <small className="muted">Sending…</small>
              )}
              {m.role === "user" && m.status === "complete" && (
                <small className="muted">Sent</small>
              )}
              {m.status === "failed" && (
                <div className="message-failure">
                  <p>{m.error}</p>
                  {m.id === messages.at(-1)?.id && (
                    <button disabled={busy} onClick={() => onRetry(m)}>
                      Retry reply
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {(phase === "generating" || phase === "saving") && (
          <div className="working" role="status">
            <span className="typing-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {phase === "saving"
              ? "Refreshing conversation status…"
              : `${archetype.name} is replying…`}
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="chat-status" role="status">
        {phase === "analysing"
          ? "Reply saved. Updating buyer insights… You can draft your next message."
          : insightError
            ? "Reply saved. Buyer insights need another try."
            : sendBlockedReason}
        {insightError && phase !== "analysing" && (
          <button
            type="button"
            onClick={() => {
              if (!analyticsOpen) onAnalytics();
            }}
          >
            View insights
          </button>
        )}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="composer-inner">
          <label className="sr-only" htmlFor="pitch">
            Your message
          </label>
          <textarea
            id="pitch"
            ref={composer}
            aria-describedby="composer-help"
            rows={3}
            value={text}
            disabled={draftDisabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Message ${archetype.name.split(" ")[0]}…`}
          />
          <button
            className="send"
            aria-label="Send message"
            disabled={busy || failedTurn || !text.trim() || text.length > limit}
          >
            <ArrowUp size={22} />
          </button>
        </div>
        <p id="composer-help">
          {text.length.toLocaleString()} / {limit.toLocaleString()} characters ·{" "}
          {provider === "demo"
            ? "15 demo CRD per completed reply"
            : "Usage is metered"}
          <span>Enter to send · Shift + Enter for a new line</span>
        </p>
        <details className="chat-technical">
          <summary>Technical details</summary>
          <p>
            {provider === "demo"
              ? "Demo responses and insights use illustrative fixtures."
              : "JEV provides guidance before Gemini’s reply, then assesses the saved exchange. Sending waits until the current request finishes."}
          </p>
        </details>
      </form>
    </div>
  );
}
