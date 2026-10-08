import { PersonaManager } from "./PersonaManager";
import { usePersonaNavigation } from "./usePersonaNavigation";
import {
  personaEditorSession,
  type PersonaEditorSession,
} from "../services/personaEditor";
import { personaRevision } from "../services/personaManagement";
import { useRef, useState } from "react";
import type { ArchetypeDraft } from "../api/contracts";
import type { Archetype, Message } from "../types/database.types";
import type { ConversationIntent, LiveSnapshot } from "../types/live";
import {
  liveSnapshot,
  createConversation,
  saveLiveArchetype,
  updateLivePersona,
  archiveLivePersona,
  liveTurn,
  assessReply,
  continueConversation,
} from "../api/live.client";
import {
  readDrafts,
  writeDraft,
  writePending,
  clearDrafts,
} from "../services/draftService";
import { ResponseError, setStudioAccessCode } from "../api/http";
import { Sidebar } from "./Sidebar";
import { ChatWorkspace } from "./ChatWorkspace";
import { TelemetryDrawer } from "./TelemetryDrawer";
import { ArchetypeSynthesizer } from "./ArchetypeSynthesizer";
export function LiveStudio({ onExit }: { onExit: () => void }) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [drafts, setDrafts] = useState(() => readDrafts().texts);
  const [draftWarning, setDraftWarning] = useState(false);
  const [continuation, setContinuation] = useState<string | null>(null);
  function draft(id: string, text: string) {
    setDraftWarning(!writeDraft(id, text));
    setDrafts((d) => ({ ...d, [id]: text }));
  }
  const refreshSequence = useRef(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "new" | "create" | "personas">(
    "new",
  );
  const [editor, setEditor] = useState<PersonaEditorSession>(() =>
    personaEditorSession("create"),
  );
  const { canLeave, setEditorState, editorBusy } = usePersonaNavigation();
  const personaRequest = useRef<{ payload: string; id: string } | null>(null);
  function navigate(work: () => void) {
    if (!lock.current && canLeave()) {
      work();
      setMobile(false);
    }
  }
  function openEditor(mode: PersonaEditorSession["mode"], persona?: Archetype) {
    navigate(() => {
      setEditor(personaEditorSession(mode, persona));
      setView("create");
      setDrawer(false);
    });
  }
  function mutationId(payload: unknown) {
    const serialised = JSON.stringify(payload);
    if (personaRequest.current?.payload !== serialised)
      personaRequest.current = { payload: serialised, id: crypto.randomUUID() };
    return personaRequest.current.id;
  }
  async function managePersona(work: () => Promise<LiveSnapshot>) {
    if (lock.current)
      throw new Error(
        "Wait for the current Studio request to finish, then try again.",
      );
    lock.current = true;
    setBusy(true);
    setError("");
    ++refreshSequence.current;
    try {
      const next = await work();
      ++refreshSequence.current;
      setSnapshot(next);
    } catch (e) {
      if (e instanceof ResponseError && e.status === 409)
        await refresh().catch(() => {});
      throw e;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function savePersona(draft: ArchetypeDraft) {
    await managePersona(() =>
      editor.mode === "edit" && editor.persona
        ? updateLivePersona(
            editor.persona.id,
            personaRevision(editor.persona),
            draft,
            mutationId({ editor: editor.key, draft }),
          )
        : saveLiveArchetype(editor.key, draft),
    );
    if (editor.mode !== "edit") setArchetypeId(editor.key);
    setView("personas");
  }
  const [drawer, setDrawer] = useState(false),
    [mobile, setMobile] = useState(false);
  const [archetypeId, setArchetypeId] = useState("");
  const [intent, setIntent] = useState<ConversationIntent>({
    objective: "Assess the response to this proposition",
    proposition: "",
    targetDecision: "",
  });
  const pending = useRef<{
    id: string;
    conversationId: string;
    pitch: string;
    version: number;
  } | null>(readDrafts().pending);
  async function refresh() {
    const sequence = ++refreshSequence.current;
    const next = await liveSnapshot();
    if (sequence === refreshSequence.current) setSnapshot(next);
    return next;
  }
  async function act(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Studio request failed.");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  function exit() {
    if (lock.current || !canLeave()) return;
    setStudioAccessCode("");
    setSnapshot(null);
    setCode("");
    clearDrafts();
    onExit();
  }
  async function unlock() {
    await act(async () => {
      setStudioAccessCode(code);
      try {
        const next = await refresh();
        setCode("");
        setArchetypeId(
          next.data.archetypes.find((a) => !a.archived_at)?.id ?? "",
        );
        const first =
          pending.current?.conversationId ?? next.conversations[0]?.id ?? null;
        setActiveId(first);
        setView(first ? "chat" : "new");
      } catch (e) {
        setStudioAccessCode("");
        throw e;
      }
    });
  }
  async function send(pitch: string, retry?: Message) {
    const c = snapshot?.conversations.find((c) => c.id === activeId);
    if (!c) return;
    if (
      pending.current &&
      (pending.current.conversationId !== c.id ||
        pending.current.pitch !== pitch)
    ) {
      setError(
        "Recover the previous request in its original dialogue before sending a different message.",
      );
      return;
    }
    const attempt = retry
      ? {
          id: retry.id,
          conversationId: c.id,
          pitch: retry.content,
          version: c.version,
        }
      : (pending.current ?? {
          id: crypto.randomUUID(),
          conversationId: c.id,
          pitch,
          version: c.version,
        });
    pending.current = attempt;
    writePending(attempt);
    if (!retry) draft(c.id, attempt.pitch);
    await act(async () => {
      let rejectedBeforeAdmission = false;
      try {
        await liveTurn(
          attempt.conversationId,
          attempt.pitch,
          attempt.version,
          attempt.id,
        );
        pending.current = null;
        writePending(null);
        draft(c.id, "");
      } catch (e) {
        rejectedBeforeAdmission =
          e instanceof ResponseError && e.status >= 400 && e.status < 500;
        throw e;
      } finally {
        const next = await refresh();
        if (
          (rejectedBeforeAdmission &&
            !next.operations.some((o) => o.id === attempt.id)) ||
          next.operations.some(
            (o) =>
              o.id === attempt.id && ["complete", "failed"].includes(o.status),
          )
        ) {
          pending.current = null;
          writePending(null);
          if (
            next.operations.find((o) => o.id === attempt.id)?.status ===
            "complete"
          )
            draft(c.id, "");
        }
      }
      const current = await refresh();
      const reply = current.data.messages
        .filter((m) => m.conversation_id === c.id && m.role === "assistant")
        .at(-1);
      if (reply && reply.telemetry_status !== "complete") {
        try {
          await assessReply(
            c.id,
            reply.id,
            current.conversations.find((x) => x.id === c.id)!.version,
          );
        } finally {
          await refresh();
        }
      }
    });
  }
  if (!snapshot)
    return (
      <main className="private-login">
        <p className="eyebrow">1906.au / Private testing</p>
        <h1>Studio User</h1>
        <p>
          Enter your shared Studio access code to open the private test
          workspace.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void unlock();
          }}
        >
          <label>
            Studio access code
            <input
              type="password"
              autoComplete="current-password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </label>
          <button className="primary" disabled={busy || !code.trim()}>
            {busy ? "Opening…" : "Open Studio"}
          </button>
        </form>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="text-button" onClick={exit}>
          Back to demo
        </button>
      </main>
    );
  const c = snapshot.conversations.find((c) => c.id === activeId);
  const activePersonas = snapshot.data.archetypes.filter((a) => !a.archived_at);
  const selectedPersona =
    activePersonas.find((a) => a.id === archetypeId) ?? activePersonas[0];
  const messages = snapshot.data.messages.filter(
    (m) => m.conversation_id === activeId,
  );
  const latest = messages.filter((m) => m.role === "assistant").at(-1);
  const previousAssessment = messages
    .filter(
      (m) =>
        m.evaluation?.phase === "post_reply" &&
        m.telemetry_status === "complete",
    )
    .at(-1);
  const unfinished = snapshot.operations.find(
    (o) => o.status === "running" || o.status === "uncertain",
  );
  return (
    <div className="studio">
      <div className={`navigation ${mobile ? "mobile-open" : ""}`}>
        <button
          className="nav-close"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          Close
        </button>
        <Sidebar
          data={snapshot.data}
          disabled={busy || editorBusy}
          conversationPersonas={Object.fromEntries(
            snapshot.conversations.map((c) => [c.id, c.archetype]),
          )}
          activeId={view === "chat" ? activeId : null}
          provider="gemini"
          usage={snapshot.usage}
          onProvider={(p) => {
            if (p === "demo") exit();
          }}
          onNew={() => navigate(() => setView("new"))}
          onCreate={() => openEditor("create")}
          onManage={() =>
            navigate(() => {
              setView("personas");
              setDrawer(false);
            })
          }
          onSelect={(id) =>
            navigate(() => {
              setActiveId(id);
              setView("chat");
              setMobile(false);
              setDrawer(false);
            })
          }
        />
      </div>
      <main className="workspace">
        <div className="private-toolbar">
          <span>Private testing · Studio User</span>
          <button
            disabled={busy}
            onClick={() =>
              void act(async () => {
                const next = await refresh();
                if (
                  pending.current &&
                  next.operations.some(
                    (o) =>
                      o.id === pending.current!.id &&
                      ["complete", "failed"].includes(o.status),
                  )
                ) {
                  draft(
                    pending.current.conversationId,
                    next.operations.find((o) => o.id === pending.current!.id)
                      ?.status === "complete"
                      ? ""
                      : pending.current.pitch,
                  );
                  pending.current = null;
                  writePending(null);
                }
              })
            }
          >
            Refresh status
          </button>
          <button disabled={busy || editorBusy} onClick={exit}>
            Lock Studio
          </button>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {unfinished && (
          <p role="status" className="error">
            {snapshot.usage.status === "review_required"
              ? "An interrupted request needs administrator review before new model calls."
              : "A request is still running. Refresh its status before retrying."}
          </p>
        )}
        {draftWarning && (
          <p role="alert">
            Browser draft storage is unavailable. Copy your draft before
            refreshing or leaving this tab.
          </p>
        )}
        {pending.current && !busy && !unfinished && (
          <button
            className="secondary"
            onClick={() => {
              const p = pending.current!;
              setActiveId(p.conversationId);
              setView("chat");
              draft(p.conversationId, p.pitch);
            }}
          >
            Recover last request
          </button>
        )}
        {view === "create" ? (
          <ArchetypeSynthesizer
            key={editor.key}
            initialDraft={editor.draft}
            mode={editor.mode}
            onStateChange={setEditorState}
            provider="gemini"
            onBack={() => navigate(() => setView("personas"))}
            onUsageChanged={() =>
              void refresh().catch((e) => setError(e.message))
            }
            onSave={savePersona}
          />
        ) : view === "personas" ? (
          <PersonaManager
            personas={snapshot.data.archetypes}
            onCreate={() => openEditor("create")}
            onEdit={(a) => openEditor("edit", a)}
            onDuplicate={(a) => openEditor("duplicate", a)}
            onMenu={() => setMobile(true)}
            onStart={(a) => {
              setArchetypeId(a.id);
              setView("new");
            }}
            onArchive={(a, archived) =>
              managePersona(() =>
                archiveLivePersona(
                  a.id,
                  personaRevision(a),
                  archived,
                  mutationId({
                    id: a.id,
                    revision: personaRevision(a),
                    archived,
                    updatedAt: a.updated_at,
                  }),
                ),
              )
            }
          />
        ) : view === "new" || !c ? (
          <div className="new-dialogue">
            <button className="text-button" onClick={() => setMobile(true)}>
              Navigation
            </button>
            <p className="eyebrow">Set the decision you want to test</p>
            <h1>New strategic dialogue</h1>
            <form
              className="intent-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!selectedPersona) return;
                void act(async () => {
                  const id = crypto.randomUUID();
                  setSnapshot(
                    await createConversation(id, selectedPersona!.id, intent),
                  );
                  setActiveId(id);
                  setView("chat");
                  setDrawer(false);
                });
              }}
            >
              <label>
                Persona
                <select
                  disabled={!selectedPersona}
                  value={selectedPersona?.id ?? ""}
                  onChange={(e) => setArchetypeId(e.target.value)}
                >
                  {!selectedPersona && (
                    <option value="">No active personas</option>
                  )}
                  {activePersonas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.role}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Conversation objective
                <input
                  required
                  maxLength={1000}
                  value={intent.objective}
                  onChange={(e) =>
                    setIntent({ ...intent, objective: e.target.value })
                  }
                />
              </label>
              <p className="muted">
                What do you want to learn from the conversation?
              </p>
              <label>
                Proposition
                <textarea
                  required
                  maxLength={2000}
                  value={intent.proposition}
                  placeholder="What offer or idea are you testing?"
                  onChange={(e) =>
                    setIntent({ ...intent, proposition: e.target.value })
                  }
                />
              </label>
              <p className="muted">
                Describe the offer, relevant details and success criteria.
              </p>
              <label>
                Target decision
                <input
                  required
                  maxLength={1000}
                  value={intent.targetDecision}
                  placeholder="For example: agree to a paid pilot using one RDL-owned module"
                  onChange={(e) =>
                    setIntent({ ...intent, targetDecision: e.target.value })
                  }
                />
              </label>
              <p className="muted">
                Ask for one clear action. Put success criteria in the
                proposition. This intent stays fixed for the conversation. Start
                a new dialogue to test a different decision.
              </p>
              {!selectedPersona && (
                <p className="persona-note">
                  Create a persona or restore one from Manage personas to start
                  a conversation.
                </p>
              )}
              <button className="primary" disabled={busy || !selectedPersona}>
                Start dialogue
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="intent-summary">
              <strong>Target decision:</strong> {c.intent.targetDecision}
            </div>
            {c.memory && (
              <details className="intent-summary">
                <summary>
                  Working memory · version {c.memory.version} · full transcript
                  retained
                </summary>
                <p>
                  Summarised through {c.memory.lastSummarisedTurnId}.{" "}
                  {c.memory.omittedSellerParagraphs} older seller paragraphs
                  omitted from working context. Buyer statements, conditions and
                  figures are retained as exact evidence.
                </p>
                {c.memory.entries.map((e, i) => (
                  <p key={i}>
                    <strong>
                      {e.speaker} · {e.turnId}:
                    </strong>{" "}
                    {e.quote}
                  </p>
                ))}
              </details>
            )}
            {c.continuationOf && (
              <details className="intent-summary">
                <summary>Reviewed continuation context</summary>
                <p>{c.continuationSummary}</p>
                <button onClick={() => setActiveId(c.continuationOf!)}>
                  Open original dialogue
                </button>
              </details>
            )}
            {error.includes("bounded working context") && (
              <button
                disabled={busy}
                onClick={() =>
                  setContinuation(
                    `Buyer’s latest statement (quote):\n${latest?.content ?? "No completed reply"}\n\nRemaining conditions and proposal details to carry forward (review and complete):\n`,
                  )
                }
              >
                Review linked continuation
              </button>
            )}
            {continuation !== null && (
              <section className="intent-summary">
                <label>
                  Continuation summary
                  <textarea
                    rows={8}
                    value={continuation}
                    onChange={(e) => setContinuation(e.target.value)}
                  />
                </label>
                <p>
                  Review accepted points, unresolved concerns, figures and
                  conditions. The persona and target stay fixed. This summary is
                  labelled as user-reviewed context.
                </p>
                <button
                  disabled={
                    busy || !continuation.trim() || continuation.length > 8000
                  }
                  onClick={() =>
                    void act(async () => {
                      const nextId = crypto.randomUUID();
                      const next = await continueConversation(
                        nextId,
                        c.id,
                        continuation,
                      );
                      draft(nextId, drafts[c.id] ?? "");
                      pending.current = null;
                      writePending(null);
                      setSnapshot(next);
                      setActiveId(nextId);
                      setContinuation(null);
                    })
                  }
                >
                  Create linked continuation
                </button>
                <button onClick={() => setContinuation(null)}>Cancel</button>
              </section>
            )}
            <ChatWorkspace
              draft={drafts[c.id] ?? ""}
              onDraft={(text) => draft(c.id, text)}
              key={activeId}
              archetype={c.archetype}
              messages={messages}
              provider="gemini"
              busy={
                busy || !!unfinished || snapshot.usage.status === "exhausted"
              }
              pendingHere={busy}
              analyticsOpen={drawer}
              onAnalytics={() => setDrawer(!drawer)}
              onSend={(text) => void send(text)}
              onRetry={(m) => void send(m.content, m)}
              onMenu={() => setMobile(true)}
            />
            <TelemetryDrawer
              open={drawer}
              message={latest}
              decision={latest?.evaluation ?? (latest ? c.state : null)}
              preDecision={c.state}
              previous={previousAssessment}
              busy={busy}
              onClose={() => setDrawer(false)}
              onRetry={() =>
                void act(async () => {
                  if (!latest) return;
                  try {
                    await assessReply(c.id, latest.id, c.version);
                  } finally {
                    await refresh();
                  }
                })
              }
            />
          </>
        )}
      </main>
    </div>
  );
}
