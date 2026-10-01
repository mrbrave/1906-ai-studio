import { Plus, Sparkles, MessageSquare, Zap } from "lucide-react";
import type { Provider, StudioData } from "../types/database.types";
interface Props {
  data: StudioData;
  activeId: string | null;
  provider: Provider;
  onProvider: (p: Provider) => void;
  onNew: () => void;
  onCreate: () => void;
  onSelect: (id: string) => void;
}
export function Sidebar({
  data,
  activeId,
  provider,
  onProvider,
  onNew,
  onCreate,
  onSelect,
}: Props) {
  const user = data.users[0];
  return (
    <aside className="sidebar">
      <div className="brand">
        <span>1906.au</span>
        <small>Beta</small>
      </div>
      <div className="sidebar-actions">
        <button className="primary" onClick={onNew}>
          <Plus size={18} /> New Strategic Dialogue
        </button>
        <button className="secondary" onClick={onCreate}>
          <Sparkles size={18} /> Synthesize Archetype
        </button>
      </div>
      <nav aria-label="Recent dialogues" className="history">
        <h2 className="eyebrow">Recent dialogues</h2>
        {!data.conversations.length && (
          <p className="muted text-sm px-2">Your next decision starts here.</p>
        )}
        {[...data.conversations]
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .map((c) => {
            const a = data.archetypes.find((p) => p.id === c.archetype_id)!;
            return (
              <button
                key={c.id}
                aria-current={c.id === activeId ? "page" : undefined}
                className={`history-item ${c.id === activeId ? "selected" : ""}`}
                onClick={() => onSelect(c.id)}
              >
                <span className="text-2xl" aria-hidden="true">
                  {a.avatar}
                </span>
                <span className="min-w-0">
                  <strong>{c.title}</strong>
                  <small>
                    {a.name} · {a.role}
                  </small>
                </span>
              </button>
            );
          })}
      </nav>
      <div className="engine-control">
        <label htmlFor="provider" className="eyebrow">
          Dialogue engine
        </label>
        <select
          id="provider"
          value={provider}
          onChange={(e) => onProvider(e.target.value as Provider)}
        >
          <option value="demo">Demo · illustrative only</option>
          <option value="gemini">Gemini</option>
          <option value="openai">OpenAI</option>
        </select>
      </div>
      <footer className="profile">
        <span className="profile-avatar">
          <MessageSquare size={20} />
        </span>
        <div>
          <strong>{user.display_name}</strong>
          <small>
            <Zap size={12} /> {user.compute_credits.toLocaleString()} CRD{" "}
            <span className="muted">· demo balance</span>
          </small>
        </div>
      </footer>
    </aside>
  );
}
