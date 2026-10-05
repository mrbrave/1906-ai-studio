import { useEffect, useRef, useState } from "react";
import { ArrowUp, BarChart3, Menu } from "lucide-react";
import type { Archetype, Message, Provider } from "../types/database.types";
interface Props {
  archetype: Archetype;
  messages: Message[];
  provider: Provider;
  busy: boolean;
  pendingHere: boolean;
  analyticsOpen: boolean;
  onAnalytics: () => void;
  onSend: (text: string) => void;
  onRetry: (message: Message) => void;
  onMenu: () => void;
}
export function ChatWorkspace({
  archetype,
  messages,
  provider,
  busy,
  pendingHere,
  analyticsOpen,
  onAnalytics,
  onSend,
  onRetry,
  onMenu,
}: Props) {
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy]);
  function send() {
    if (text.trim() && !busy) {
      onSend(text.trim());
      setText("");
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
          <span>{analyticsOpen ? "Close Analytics" : "Expand Analytics"}</span>
        </button>
      </header>
      <div
        className="chat-stream"
        role="log"
        aria-label="Strategic dialogue"
        aria-live="polite"
      >
        <p className="session-label">
          Strategic dialogue <span> / </span>{" "}
          {provider === "demo"
            ? "Demo mode · illustrative responses and scores"
            : "Private testing · JEV decision → Gemini reply"}
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
              Start with your message, then use analytics to refine it.
            </p>
            <div className="starter-prompts">
              {[
                "Challenge my value proposition",
                "Test a pricing pitch",
                "Explore buyer objections",
              ].map((s) => (
                <button key={s} onClick={() => setText(s + ": ")}>
                  {s} ↗
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
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
              <p>{m.content}</p>
              <small>
                {m.role === "user" ? "You" : archetype.name} ·{" "}
                {m.provider === "demo" ? "Demo" : m.provider}
              </small>
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
        {pendingHere && (
          <p className="working" role="status">
            {messages.at(-1)?.role === "assistant"
              ? "Saving decision and reply…"
              : `${archetype.name} is considering your pitch…`}
          </p>
        )}
        <div ref={end} />
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
            Your strategic message
          </label>
          <textarea
            id="pitch"
            rows={3}
            maxLength={16000}
            value={text}
            disabled={busy}
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
            placeholder={`Present your proposition to ${archetype.name.split(" ")[0]}…`}
          />
          <button
            className="send"
            aria-label="Send message"
            disabled={busy || !text.trim()}
          >
            <ArrowUp size={22} />
          </button>
        </div>
        <p>
          {provider === "demo"
            ? "15 demo CRD per completed reply"
            : "JEV + Gemini usage counted against your Studio allowance"}
          <span>Enter to send · Shift + Enter for a new line</span>
        </p>
      </form>
    </div>
  );
}
