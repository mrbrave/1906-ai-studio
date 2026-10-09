import { useRef, useState } from "react";
import { Archive, Copy, Pencil, Plus, RotateCcw } from "lucide-react";
import type { Archetype } from "../types/database.types";
import { PERSONA_FIELDS, sourceLabel } from "../services/personaEditor";

export function PersonaManager({
  personas,
  onCreate,
  onEdit,
  onDuplicate,
  onArchive,
  onStart,
  onMenu,
}: {
  personas: Archetype[];
  onCreate: () => void;
  onEdit: (persona: Archetype) => void;
  onDuplicate: (persona: Archetype) => void;
  onArchive: (persona: Archetype, archived: boolean) => Promise<void> | void;
  onStart: (persona: Archetype) => void;
  onMenu: () => void;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const visible = personas.filter((a) =>
    showArchived ? !!a.archived_at : !a.archived_at,
  );
  async function archive(persona: Archetype) {
    if (lock.current) return;
    const archived = !persona.archived_at;
    if (
      archived &&
      !window.confirm(
        `Archive ${persona.name}? Existing conversations will remain available. You can restore this persona later.`,
      )
    )
      return;
    lock.current = true;
    setBusy(persona.id);
    setError("");
    try {
      await onArchive(persona, archived);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not update this persona.",
      );
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }
  return (
    <div className="persona-manager">
      <header className="workspace-header">
        <h1>Buyer personas</h1>
        <button className="text-button" onClick={onMenu}>
          Navigation
        </button>
      </header>
      <div className="persona-manager-content">
        <div className="persona-list-heading">
          <div>
            <p className="eyebrow">Know who you are talking to</p>
            <h2>Your personas</h2>
            <p className="muted">
              Build and refine the buyers you want to understand.
            </p>
          </div>
          <button className="primary" disabled={!!busy} onClick={onCreate}>
            <Plus size={16} /> Create persona
          </button>
        </div>
        <div
          className="persona-methods"
          role="group"
          aria-label="Persona availability"
        >
          <button
            className="secondary"
            aria-pressed={!showArchived}
            onClick={() => setShowArchived(false)}
          >
            Active ({personas.filter((a) => !a.archived_at).length})
          </button>
          <button
            className="secondary"
            aria-pressed={showArchived}
            onClick={() => setShowArchived(true)}
          >
            Archived ({personas.filter((a) => a.archived_at).length})
          </button>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {!visible.length && (
          <div className="persona-empty">
            <h3>
              {showArchived ? "No archived personas" : "No active personas"}
            </h3>
            <p className="muted">
              {showArchived
                ? "Personas you archive will appear here."
                : "Create a persona or restore one from Archived to start a conversation."}
            </p>
          </div>
        )}
        <div className="persona-list">
          {visible.map((a) => (
            <article className="persona-card" key={a.id} aria-label={a.name}>
              <div className="persona-card-title">
                <span className="avatar" aria-hidden="true">
                  {a.avatar}
                </span>
                <div>
                  <h3>{a.name}</h3>
                  <p>{a.role}</p>
                  {a.profile?.industry && (
                    <small className="muted">{a.profile.industry}</small>
                  )}
                </div>
              </div>
              <p className="persona-card-summary">
                {a.profile?.background ||
                  "Add some background to give this buyer more context."}
              </p>
              <details className="persona-preview">
                <summary>View profile</summary>
                <dl>
                  <dt>Budget sensitivity</dt>
                  <dd>{a.budget_sensitivity}</dd>
                  {PERSONA_FIELDS.map(({ key, label }) => {
                    const value = a.profile?.[key];
                    if (
                      value === undefined ||
                      (Array.isArray(value) && !value.length)
                    )
                      return null;
                    return (
                      <div key={key}>
                        <dt>{label}</dt>
                        <dd>
                          <p className="muted field-hint">
                            {sourceLabel(a.profile?.provenance?.[key])}
                          </p>
                          {Array.isArray(value) ? (
                            <ul>
                              {value.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            value
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                {a.synthesisReview && (
                  <div className="persona-note">
                    <p>
                      Name:{" "}
                      {sourceLabel(a.synthesisReview.identitySources.name)}.
                      Role:{" "}
                      {sourceLabel(a.synthesisReview.identitySources.role)}.
                      Budget sensitivity:{" "}
                      {sourceLabel(
                        a.synthesisReview.identitySources.budget_sensitivity,
                      )}
                      .
                    </p>
                    {a.synthesisReview.notes.length > 0 && (
                      <>
                        <p>
                          Notes from the original generation; review alongside
                          any edits.
                        </p>
                        <ul>
                          {a.synthesisReview.notes.map((note, i) => (
                            <li key={i}>{note}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
                <details>
                  <summary>Custom role-play instructions</summary>
                  <p className="persona-instructions">{a.system_prompt}</p>
                </details>
              </details>
              <div className="persona-card-actions">
                {!a.archived_at && (
                  <>
                    <button
                      className="primary"
                      disabled={!!busy}
                      onClick={() => onStart(a)}
                    >
                      Start conversation
                    </button>
                    <button
                      className="text-button"
                      disabled={!!busy}
                      onClick={() => onEdit(a)}
                    >
                      <Pencil size={14} /> Edit
                    </button>
                  </>
                )}
                <button
                  className="text-button"
                  disabled={!!busy}
                  onClick={() => onDuplicate(a)}
                >
                  <Copy size={14} /> Duplicate
                </button>
                <button
                  className="text-button"
                  disabled={!!busy}
                  onClick={() => void archive(a)}
                >
                  {a.archived_at ? (
                    <RotateCcw size={14} />
                  ) : (
                    <Archive size={14} />
                  )}
                  {busy === a.id
                    ? "Saving…"
                    : a.archived_at
                      ? "Restore"
                      : "Archive"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
