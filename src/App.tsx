import { LiveStudio } from "./components/LiveStudio";
import { useRef, useState } from "react";
import { X, ArrowLeft } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { ChatWorkspace } from "./components/ChatWorkspace";
import { TelemetryDrawer } from "./components/TelemetryDrawer";
import { ArchetypeSynthesizer } from "./components/ArchetypeSynthesizer";
import { loadStudio, saveStudio } from "./services/storageService";
import { runDialogueTurn } from "./services/llmService";
import type { ArchetypeDraft } from "./api/contracts";
import type {
  Archetype,
  Conversation,
  Message,
  Provider,
  StudioData,
} from "./types/database.types";
const now = () => new Date().toISOString();
function initial(): { data: StudioData | null; error: string } {
  try {
    return { data: loadStudio(), error: "" };
  } catch {
    return {
      data: null,
      error:
        "Saved studio data could not be loaded. It has not been overwritten. Check browser storage access or export the existing data before repairing it.",
    };
  }
}
export default function App() {
  const [live, setLive] = useState(() => window.location.hash === "#private");
  const change = (enabled: boolean) => {
    window.location.hash = enabled ? "private" : "";
    setLive(enabled);
  };
  return live ? (
    <LiveStudio onExit={() => change(false)} />
  ) : (
    <DemoApp onLive={() => change(true)} />
  );
}
function DemoApp({ onLive }: { onLive: () => void }) {
  const [loaded] = useState(initial);
  const [data, setData] = useState(loaded.data);
  const dataRef = useRef(data);
  const [activeId, setActiveId] = useState<string | null>(
    loaded.data?.conversations[0]?.id ?? null,
  );
  const [view, setView] = useState<"chat" | "create" | "new">(
    activeId ? "chat" : "new",
  );
  const [provider, setProvider] = useState<Provider>("demo");
  const [drawer, setDrawer] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const lock = useRef(false);
  const [error, setError] = useState(loaded.error);
  const [storageError, setStorageError] = useState("");
  function update(fn: (d: StudioData) => StudioData) {
    const next = fn(dataRef.current!);
    dataRef.current = next;
    setData(next);
    try {
      saveStudio(next);
      setStorageError("");
    } catch {
      setStorageError(
        "Changes are only in memory: browser storage is unavailable or full. Keep this tab open and free space before reloading.",
      );
    }
  }
  function start(archetype: Archetype) {
    const c: Conversation = {
      id: crypto.randomUUID(),
      user_id: data!.users[0].id,
      archetype_id: archetype.id,
      title: `Dialogue with ${archetype.name}`,
      created_at: now(),
      updated_at: now(),
    };
    update((d) => ({ ...d, conversations: [c, ...d.conversations] }));
    setActiveId(c.id);
    setView("chat");
    setDrawer(false);
    setMobileNav(false);
    setError("");
  }
  function saveArchetype(draft: ArchetypeDraft) {
    const a: Archetype = {
      ...draft,
      id: crypto.randomUUID(),
      user_id: data!.users[0].id,
      avatar: "🎯",
      created_at: now(),
    };
    update((d) => ({ ...d, archetypes: [...d.archetypes, a] }));
    start(a);
  }
  async function send(text: string, retry?: Message) {
    if (lock.current || !activeId) return;
    const snapshot = dataRef.current!;
    const c = snapshot.conversations.find((c) => c.id === activeId)!;
    const a = snapshot.archetypes.find((a) => a.id === c.archetype_id)!;
    const mode = retry?.provider ?? provider;
    if (mode === "demo" && snapshot.users[0].compute_credits < 15) {
      setError(
        "No demo credits remaining. Select a configured live provider to continue.",
      );
      return;
    }
    lock.current = true;
    setPending(c.id);
    setError("");
    const userMessage: Message = retry
      ? { ...retry, status: "pending", error: null }
      : {
          id: crypto.randomUUID(),
          conversation_id: c.id,
          role: "user",
          content: text,
          created_at: now(),
          provider: mode,
          status: "pending",
          telemetry_status: "none",
          telemetry: null,
          error: null,
        };
    const replyId = crypto.randomUUID();
    update((d) => ({
      ...d,
      messages: retry
        ? d.messages.map((m) => (m.id === retry.id ? userMessage : m))
        : [...d.messages, userMessage],
      conversations: d.conversations.map((row) =>
        row.id === c.id
          ? { ...row, title: text.slice(0, 48), updated_at: now() }
          : row,
      ),
    }));
    try {
      const history = snapshot.messages.filter(
        (m) => m.conversation_id === c.id && m.id !== retry?.id,
      );
      const result = await runDialogueTurn(
        { archetype: a, pitch: text, history, provider: mode },
        (reply) => {
          const assistant: Message = {
            id: replyId,
            conversation_id: c.id,
            role: "assistant",
            content: reply,
            created_at: now(),
            provider: mode,
            status: "complete",
            telemetry_status: "pending",
            telemetry: null,
            error: null,
          };
          update((d) => ({
            ...d,
            messages: [
              ...d.messages.map((m) =>
                m.id === userMessage.id
                  ? { ...m, status: "complete" as const }
                  : m,
              ),
              assistant,
            ],
            users: d.users.map((u) => ({
              ...u,
              compute_credits: u.compute_credits - (mode === "demo" ? 15 : 0),
            })),
          }));
        },
      );
      update((d) => ({
        ...d,
        messages: d.messages.map((m) =>
          m.id === replyId
            ? {
                ...m,
                telemetry: result.telemetry,
                telemetry_status: result.error ? "failed" : "complete",
                error: result.error,
              }
            : m,
        ),
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Dialogue failed.";
      update((d) => ({
        ...d,
        messages: d.messages.map((m) =>
          m.id === userMessage.id
            ? { ...m, status: "failed", error: message }
            : m,
        ),
      }));
    } finally {
      lock.current = false;
      setPending(null);
    }
  }
  if (!data)
    return (
      <main className="fatal">
        <h1>Studio data needs attention</h1>
        <p role="alert">{error}</p>
      </main>
    );
  const conversation = data.conversations.find((c) => c.id === activeId);
  const archetype = data.archetypes.find(
    (a) => a.id === conversation?.archetype_id,
  );
  const messages = data.messages.filter((m) => m.conversation_id === activeId);
  const latest = [...messages].reverse().find((m) => m.role === "assistant");
  // Never show the previous turn's score while the new reply is still pending or failed.
  const currentTelemetry =
    messages.at(-1)?.role === "assistant" ? latest : undefined;
  function closeDrawer() {
    setDrawer(false);
    document.getElementById("analytics-toggle")?.focus();
  }
  return (
    <div className="studio">
      <div className={`navigation ${mobileNav ? "mobile-open" : ""}`}>
        <button
          className="nav-close"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation"
        >
          <X />
        </button>
        <Sidebar
          data={data}
          activeId={view === "chat" ? activeId : null}
          provider={provider}
          onProvider={(p) => (p === "demo" ? setProvider(p) : onLive())}
          onNew={() => {
            setView("new");
            setDrawer(false);
            setMobileNav(false);
          }}
          onCreate={() => {
            setView("create");
            setDrawer(false);
            setMobileNav(false);
          }}
          onSelect={(id) => {
            setActiveId(id);
            setView("chat");
            setMobileNav(false);
          }}
        />
      </div>
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <main className="workspace">
        {(error || storageError) && (
          <div role="alert" className="error">
            {error || storageError}
          </div>
        )}
        {view === "create" ? (
          <ArchetypeSynthesizer
            provider={provider}
            onSave={saveArchetype}
            onBack={() => setView(activeId ? "chat" : "new")}
          />
        ) : view === "new" || !archetype ? (
          <div className="new-dialogue">
            <button className="text-button" onClick={() => setMobileNav(true)}>
              <ArrowLeft size={16} /> Navigation
            </button>
            <p className="eyebrow">1906.au / Strategic studio</p>
            <h1>
              Good decisions start
              <br />
              with better questions.
            </h1>
            <p className="muted">
              Choose a perspective. Pressure-test your next proposition.
            </p>
            <div className="archetype-grid">
              {data.archetypes.map((a) => (
                <button
                  key={a.id}
                  onClick={() => start(a)}
                  className="archetype-card"
                >
                  <span className="text-4xl">{a.avatar}</span>
                  <h2>{a.name}</h2>
                  <p>{a.role}</p>
                  <small>
                    {a.budget_sensitivity} budget sensitivity <span>↗</span>
                  </small>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <ChatWorkspace
              key={activeId}
              archetype={archetype}
              messages={messages}
              provider={provider}
              busy={pending !== null}
              pendingHere={pending === activeId}
              analyticsOpen={drawer}
              onAnalytics={() => (drawer ? closeDrawer() : setDrawer(true))}
              onSend={(text) => void send(text)}
              onRetry={(m) => void send(m.content, m)}
              onMenu={() => setMobileNav(true)}
            />
            <TelemetryDrawer
              open={drawer}
              message={currentTelemetry}
              busy={pending === activeId}
              onClose={closeDrawer}
              onRetry={() => {}}
            />
          </>
        )}
      </main>
    </div>
  );
}
