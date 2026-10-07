import { useRef, useState } from "react";
import { Sparkles, ArrowLeft } from "lucide-react";
import type { Provider } from "../types/database.types";
import type { ArchetypeDraft } from "../api/contracts";
import { synthesiseArchetype } from "../api/gemini.client";
import { parseDraft } from "../api/validation";
export function ArchetypeSynthesizer({
  provider,
  onSave,
  onBack,
  onUsageChanged,
}: {
  provider: Provider;
  onSave: (draft: ArchetypeDraft) => void;
  onBack: () => void;
  onUsageChanged?: () => void;
}) {
  const request = useRef<{ id: string; description: string } | null>(null);
  const [draft, setDraft] = useState<ArchetypeDraft>({
    name: "",
    role: "",
    budget_sensitivity: "Medium",
    system_prompt: "",
  });
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function generate() {
    if (description.length > 4000) {
      setError(
        "Source input exceeds 4,000 characters. Shorten it before synthesis; nothing has been truncated.",
      );
      return;
    }
    if (provider === "demo") {
      setError(
        "Choose Gemini + JEV private testing in the sidebar for AI generation, or configure your archetype manually.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (
        !request.current ||
        request.current.description !== description.trim()
      )
        request.current = {
          id: crypto.randomUUID(),
          description: description.trim(),
        };
      setDraft(
        await synthesiseArchetype(
          description.trim(),
          provider,
          request.current.id,
        ),
      );
      request.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setBusy(false);
      onUsageChanged?.();
    }
  }
  return (
    <div className="synthesizer">
      <header className="workspace-header">
        <h1>Synthesize Archetype</h1>
        <button className="text-button" onClick={onBack}>
          <ArrowLeft size={16} /> Back to studio
        </button>
      </header>
      <div className="synth-content">
        <p className="eyebrow">Define your audience</p>
        <h2>
          A sharper perspective.
          <br />A stronger proposition.
        </h2>
        <p className="muted">
          Build a synthetic buyer to challenge your assumptions, one
          conversation at a time.
        </p>
        <section className="ai-box">
          <h3>
            <Sparkles size={20} /> AI generation
          </h3>
          <p>
            Describe your target buyer. Review the generated profile before
            saving.
          </p>
          <label className="sr-only" htmlFor="description">
            Target buyer description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A sceptical CMO at a B2B SaaS startup struggling with lead quality…"
          />
          <p className="muted">
            {description.length.toLocaleString()} / 4,000 characters · source
            input for synthesis. The final behavioural system prompt below has a
            separate 16,000-character limit.
          </p>
          {description.length > 4000 && (
            <p role="alert">
              Source input is too long. Your full pasted text is retained;
              shorten it before synthesis.
            </p>
          )}
          <button
            disabled={busy || !description.trim() || description.length > 4000}
            onClick={generate}
            className="secondary"
          >
            {busy ? "Synthesising…" : "Synthesize"}
          </button>
        </section>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              onSave(parseDraft(draft));
            } catch (e) {
              setError(e instanceof Error ? e.message : "Check the fields.");
            }
          }}
        >
          <h3 className="eyebrow mb-6">Or configure manually</h3>
          <fieldset disabled={busy} className="form-grid">
            <label>
              Full name
              <input
                required
                maxLength={120}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Maya Lin"
              />
            </label>
            <label>
              Role
              <input
                required
                maxLength={200}
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                placeholder="Enterprise CTO"
              />
            </label>
            <fieldset className="full">
              <legend>Budget sensitivity</legend>
              <div className="budget-options">
                {(["Low", "Medium", "High"] as const).map((b) => (
                  <label key={b}>
                    <input
                      type="radio"
                      name="budget"
                      value={b}
                      checked={draft.budget_sensitivity === b}
                      onChange={() =>
                        setDraft({ ...draft, budget_sensitivity: b })
                      }
                    />
                    {b}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="full">
              System prompt
              <textarea
                required
                rows={6}
                value={draft.system_prompt}
                onChange={(e) =>
                  setDraft({ ...draft, system_prompt: e.target.value })
                }
                placeholder="You are an enterprise CTO. You care about security, integration effort and measurable ROI…"
              />
              <span className="muted">
                {draft.system_prompt.length.toLocaleString()} / 16,000
                characters · behavioural instructions used by the persona.
              </span>
            </label>
          </fieldset>
          <div className="flex justify-end mt-6">
            <button
              className="primary"
              disabled={busy || draft.system_prompt.length > 16000}
            >
              Save Archetype
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
