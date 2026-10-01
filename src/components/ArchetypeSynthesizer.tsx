import { useState } from "react";
import { Sparkles, ArrowLeft } from "lucide-react";
import type { Provider } from "../types/database.types";
import type { ArchetypeDraft } from "../api/contracts";
import { synthesiseArchetype } from "../api/gemini.client";
import { parseDraft } from "../api/validation";
export function ArchetypeSynthesizer({
  provider,
  onSave,
  onBack,
}: {
  provider: Provider;
  onSave: (draft: ArchetypeDraft) => void;
  onBack: () => void;
}) {
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
    if (provider === "demo") {
      setError(
        "Choose Gemini or OpenAI in the sidebar for AI generation, or configure your archetype manually.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      setDraft(await synthesiseArchetype(description.trim(), provider));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setBusy(false);
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
            maxLength={4000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A sceptical CMO at a B2B SaaS startup struggling with lead quality…"
          />
          <button
            disabled={busy || !description.trim()}
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
                maxLength={16000}
                rows={6}
                value={draft.system_prompt}
                onChange={(e) =>
                  setDraft({ ...draft, system_prompt: e.target.value })
                }
                placeholder="You are an enterprise CTO. You care about security, integration effort and measurable ROI…"
              />
            </label>
          </fieldset>
          <div className="flex justify-end mt-6">
            <button className="primary" disabled={busy}>
              Save Archetype
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
