import type { Archetype } from "../types/database.types";
import { PERSONA_FIELDS, sourceLabel } from "../services/personaEditor";

/** Read-only public profile, including the frozen revision used by a conversation. */
export function PersonaContext({
  persona,
  frozen = false,
}: {
  persona: Archetype;
  frozen?: boolean;
}) {
  return (
    <section
      className={`persona-context ${frozen ? "conversation-persona" : ""}`}
      aria-label={frozen ? "Conversation persona" : "Selected persona"}
    >
      {!frozen && (
        <div className="persona-card-title">
          <span className="avatar" aria-hidden="true">
            {persona.avatar}
          </span>
          <div>
            <strong>{persona.name}</strong>
            <p>{persona.profile?.industry || persona.role}</p>
          </div>
        </div>
      )}
      {!frozen && (
        <p className="persona-context-summary">
          {persona.profile?.background ||
            "Open the profile to review what is known about this buyer."}
        </p>
      )}
      <details className="persona-preview">
        <summary>View persona profile</summary>
        <div className="persona-context-body">
          {frozen && (
            <p className="persona-note">
              This conversation uses {persona.name}’s saved profile
              {persona.profileRevision
                ? `, revision ${persona.profileRevision}`
                : ""}
              . Later persona edits apply to new conversations.
            </p>
          )}
          <dl>
            <dt>Budget sensitivity</dt>
            <dd>{persona.budget_sensitivity}</dd>
            {PERSONA_FIELDS.map(({ key, label }) => {
              const value = persona.profile?.[key];
              if (!value || (Array.isArray(value) && !value.length))
                return null;
              return (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    <p className="field-hint muted">
                      {sourceLabel(persona.profile?.provenance?.[key])}
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
          {!persona.profile && (
            <p className="persona-note">
              This is an earlier persona with limited structured profile
              information.
            </p>
          )}
        </div>
      </details>
    </section>
  );
}
