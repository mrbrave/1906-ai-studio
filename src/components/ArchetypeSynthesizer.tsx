import { useEffect, useRef, useState } from "react";
import { Sparkles, ArrowLeft } from "lucide-react";
import type { Provider } from "../types/database.types";
import type { ArchetypeDraft } from "../api/contracts";
import { synthesiseArchetype } from "../api/gemini.client";
import {
  completePersonaDraft,
  editablePrompt,
  PERSONA_SECTIONS,
  profileInputs,
} from "../services/personaEditor";

const EMPTY: ArchetypeDraft = {
  name: "",
  role: "",
  budget_sensitivity: "Medium",
  system_prompt: "",
};
export function ArchetypeSynthesizer({
  provider,
  initialDraft,
  mode = "create",
  onSave,
  onBack,
  onUsageChanged,
  onStateChange,
}: {
  provider: Provider;
  initialDraft?: ArchetypeDraft;
  mode?: "create" | "edit" | "duplicate";
  onSave: (draft: ArchetypeDraft) => void | Promise<void>;
  onBack: () => void;
  onUsageChanged?: () => void;
  onStateChange?: (state: { dirty: boolean; busy: boolean }) => void;
}) {
  const [baseline] = useState(() => ({
    ...(initialDraft ?? EMPTY),
    system_prompt: initialDraft ? editablePrompt(initialDraft) : "",
  }));
  const [draft, setDraft] = useState(baseline);
  const [originalProfile, setOriginalProfile] = useState(initialDraft?.profile);
  const [inputs, setInputs] = useState(() =>
    profileInputs(initialDraft?.profile),
  );
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState<"describe" | "manual">("describe");
  const [busy, setBusy] = useState<"generate" | "save" | null>(null);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState(false);
  const request = useRef<{ id: string; description: string } | null>(null);
  const inFlight = useRef(false);
  const dirty =
    generated ||
    !!description ||
    JSON.stringify(draft) !== JSON.stringify(baseline) ||
    JSON.stringify(inputs) !==
      JSON.stringify(profileInputs(initialDraft?.profile));
  useEffect(() => {
    onStateChange?.({ dirty, busy: !!busy });
  }, [dirty, busy, onStateChange]);
  useEffect(
    () => () => {
      onStateChange?.({ dirty: false, busy: false });
    },
    [onStateChange],
  );
  async function generate() {
    if (inFlight.current || !description.trim() || description.length > 4000)
      return;
    if (provider === "demo") {
      setError(
        "Choose Gemini + JEV private testing in the sidebar to generate a draft, or build your persona manually.",
      );
      return;
    }
    const hasContent =
      draft.name ||
      draft.role ||
      draft.system_prompt ||
      Object.values(inputs).some(Boolean);
    if (
      hasContent &&
      !window.confirm(
        "Replace this entire draft with a newly generated persona? Your current field edits will be replaced after generation succeeds.",
      )
    )
      return;
    inFlight.current = true;
    setBusy("generate");
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
      const result = await synthesiseArchetype(
        description.trim(),
        provider,
        request.current.id,
      );
      setDraft({ ...result, system_prompt: editablePrompt(result) });
      setOriginalProfile(result.profile);
      setInputs(profileInputs(result.profile));
      setGenerated(true);
      request.current = null;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Generation failed. Your draft has been kept.",
      );
    } finally {
      inFlight.current = false;
      setBusy(null);
      onUsageChanged?.();
    }
  }
  async function save() {
    if (inFlight.current) return;
    setError("");
    try {
      const next = completePersonaDraft(draft, inputs, originalProfile);
      inFlight.current = true;
      setBusy("save");
      await onSave(next);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save your persona. Your draft has been kept.",
      );
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }
  const title =
    mode === "edit"
      ? "Edit persona"
      : mode === "duplicate"
        ? "Duplicate persona"
        : "Create persona";
  return (
    <div className="synthesizer">
      <header className="workspace-header">
        <h1>{title}</h1>
        <button className="text-button" disabled={!!busy} onClick={onBack}>
          <ArrowLeft size={16} /> Back to personas
        </button>
      </header>
      <div className="synth-content">
        <p className="eyebrow">Understand your buyer</p>
        <h2>Start with the person.</h2>
        <p className="muted">
          Capture what matters to them, what makes them hesitate and how they
          talk.
        </p>
        {mode === "edit" && (
          <p className="persona-note">
            Changes apply to new conversations. Existing conversations keep the
            persona they started with.
          </p>
        )}
        {mode === "duplicate" && (
          <p className="persona-note">
            You are creating a separate persona. Review the name and profile
            before saving.
          </p>
        )}
        <div
          className="persona-methods"
          role="group"
          aria-label="How to build your persona"
        >
          <button
            className="secondary"
            aria-pressed={method === "describe"}
            disabled={!!busy}
            onClick={() => setMethod("describe")}
          >
            <Sparkles size={16} /> Describe the buyer
          </button>
          <button
            className="secondary"
            aria-pressed={method === "manual"}
            disabled={!!busy}
            onClick={() => setMethod("manual")}
          >
            Build manually
          </button>
        </div>
        {method === "describe" && (
          <section className="ai-box">
            <h3>
              <Sparkles size={20} /> Turn a description into a draft
            </h3>
            <p>
              Tell us about the buyer, their priorities and their usual
              objections. Review the result in the fields below before saving.
            </p>
            <label htmlFor="description">Target buyer description</label>
            <textarea
              id="description"
              value={description}
              disabled={!!busy}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A Head of Growth at a B2B SaaS company who needs credible reporting without adding more work for the team…"
            />
            <p className="muted">
              {description.length.toLocaleString()} / 4,000 characters
            </p>
            {description.length > 4000 && (
              <p role="alert">
                Source input is too long. Your full pasted text is retained;
                shorten it before synthesis.
              </p>
            )}
            <button
              className="secondary"
              disabled={
                !!busy || !description.trim() || description.length > 4000
              }
              onClick={() => void generate()}
            >
              {busy === "generate" ? "Synthesising…" : "Generate draft"}
            </button>
          </section>
        )}
        {generated && (
          <p role="status" className="persona-note">
            Draft generated. Check the details and add any missing context
            before saving.
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={!!busy} className="persona-fields">
            <section className="persona-section">
              <h3>Identity</h3>
              <p className="muted">
                Name and role are required. Everything else can be refined over
                time.
              </p>
              <div className="form-grid">
                <label>
                  Full name
                  <input
                    required
                    maxLength={120}
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                    placeholder="Marcus Vance-Ross"
                  />
                </label>
                <label>
                  Role
                  <input
                    required
                    maxLength={200}
                    value={draft.role}
                    onChange={(e) =>
                      setDraft({ ...draft, role: e.target.value })
                    }
                    placeholder="Head of Growth Marketing"
                  />
                </label>
              </div>
            </section>
            {PERSONA_SECTIONS.map((section) => (
              <section key={section.title} className="persona-section">
                <h3>{section.title}</h3>
                <p className="muted">{section.description}</p>
                <div className="form-grid">
                  {section.fields.map((field) => {
                    const list = "list" in field && field.list;
                    const multiline =
                      list || ("multiline" in field && field.multiline);
                    const hintId = `hint-${field.key}`;
                    return (
                      <label
                        key={field.key}
                        className={
                          field.key === "background" ||
                          field.key === "additionalGuidance"
                            ? "full"
                            : ""
                        }
                      >
                        {field.label}
                        {multiline ? (
                          <textarea
                            rows={3}
                            value={inputs[field.key]}
                            aria-label={field.label}
                            aria-describedby={hintId}
                            onChange={(e) =>
                              setInputs({
                                ...inputs,
                                [field.key]: e.target.value,
                              })
                            }
                          />
                        ) : (
                          <input
                            value={inputs[field.key]}
                            aria-label={field.label}
                            aria-describedby={hintId}
                            onChange={(e) =>
                              setInputs({
                                ...inputs,
                                [field.key]: e.target.value,
                              })
                            }
                          />
                        )}
                        <span id={hintId} className="muted field-hint">
                          {list
                            ? "One per line · up to 12 items, 500 characters each"
                            : `${inputs[field.key].length.toLocaleString()} / ${"max" in field ? field.max?.toLocaleString() : ""} characters`}
                        </span>
                      </label>
                    );
                  })}
                  {section.title === "How they buy" && (
                    <fieldset className="full">
                      <legend>Budget sensitivity</legend>
                      <div className="budget-options">
                        {(["Low", "Medium", "High"] as const).map((value) => (
                          <label key={value}>
                            <input
                              type="radio"
                              name="budget"
                              checked={draft.budget_sensitivity === value}
                              onChange={() =>
                                setDraft({
                                  ...draft,
                                  budget_sensitivity: value,
                                })
                              }
                            />
                            {value}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </div>
              </section>
            ))}
            <details className="persona-section">
              <summary>Advanced: custom role-play instructions</summary>
              <p className="muted">
                Existing instructions are preserved here. Leave blank to build
                instructions from the profile when you save.
              </p>
              <label className="persona-prompt">
                Custom role-play instructions
                <textarea
                  rows={7}
                  value={draft.system_prompt}
                  onChange={(e) =>
                    setDraft({ ...draft, system_prompt: e.target.value })
                  }
                />
                <span className="muted field-hint">
                  {draft.system_prompt.length.toLocaleString()} / 16,000
                  characters
                </span>
              </label>
            </details>
          </fieldset>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="persona-save">
            <button
              type="button"
              className="secondary"
              disabled={!!busy}
              onClick={onBack}
            >
              Cancel
            </button>
            <button
              className="primary"
              disabled={!!busy || draft.system_prompt.length > 16000}
            >
              {busy === "save" ? "Saving…" : "Save persona"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
