# Step 2 — Persona creation and management

This change builds on the merged persona contracts in PR #5. It preserves the Studio's cream/navy palette, typefaces, outlined cards and buttons, and responsive sidebar.

## Delivered

- **Create persona** offers **Describe the buyer** and **Build manually**, leading to the same editable profile. AI output stays a draft until saved.
- The form covers identity, background, goals, pain points, tools, constraints, buying motivations, objections, preferred evidence, budget sensitivity, decision authority/process/pace, communication style, example phrases, preferred channels and additional guidance. Age and income remain optional.
- Missing fields remain unknown. Unedited field values and provenance are preserved; changed public fields are marked `provided`. Pasted over-limit content remains visible and cannot be saved silently truncated.
- Existing custom role-play instructions remain available under Advanced. Manual creation does not require writing a system prompt: a deterministic compatibility prompt is built from the form if custom instructions are blank. Such form-derived prompts are rebuilt after subsequent edits; explicitly authored instructions are preserved.
- **Manage personas** includes profile previews, editing, reviewed duplication, archiving and restoration. Duplication creates a new ID at revision 1; it does not copy conversations or private motivational records.
- **Persona** replaces **Perspective** in the new-dialogue selector. Archived personas disappear from new-session selection. An empty active list has a clear empty state.
- Saving awaits the server result. Failed saves keep the form open. Stable IDs allow an identical retry after a lost response without creating another persona or another revision.
- Leaving an unsaved form or replacing a populated draft asks for confirmation. Navigation is disabled while a persona request is running; browser unload warns while work is unsaved.

## Persistence and API changes

No SQL, table, column, RPC, RLS, credential or environment-variable change is required. The existing private account JSON and `studio_read` / `studio_write` compare-and-swap remain the storage boundary.

| Location                                             | Additive change                                                     | Compatibility                                                                                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data.archetypes[]`                                  | Uses the step-1 profile, revision, update and archive fields        | Legacy records without a revision are treated as revision 1 on first edit; next edit saves revision 2. IDs remain unchanged.                                                                    |
| Private store `personaMutations[]`                   | Request ID and SHA-256 request hash for edit/archive/restore replay | Optional; old stores need no migration. Never included in public snapshots. Existing 8 MB store limit applies.                                                                                  |
| Local demo `data.conversations[].archetype_snapshot` | Optional public persona snapshot                                    | New conversations snapshot immediately. Before editing a persona, older demo conversations referencing it receive the pre-edit snapshot. Messages, IDs, titles and timestamps remain unchanged. |

`update_archetype` requires `id`, `expectedRevision`, `requestId` and a validated `draft`. A successful edit increments the profile revision. A stale edit returns 409 and does not overwrite the winner. The UI keeps the losing draft and refreshes the catalogue so it can be reopened with the current revision.

`archive_archetype` requires `id`, `expectedRevision`, `requestId` and boolean `archived`. Archive/restore changes availability and `updated_at`, not the behavioural profile revision. It is reversible and does not delete any row. Stored replay receipts prevent a delayed archive retry from undoing a later restore. A new dialogue rejects an archived persona; an existing dialogue or linked continuation keeps its original frozen profile.

Live dialogue snapshots, conversation state, messages, usage, receipts for paid operations and historical private persona revisions are not rewritten by persona edits. Newly edited or duplicated revisions do not automatically inherit private motivational assumptions. A future private-profile compiler must populate the new revision explicitly.

The local demo re-reads saved data before persona mutations to catch stale revisions from another tab without triggering interrupted-request recovery. If browser storage fails, the existing in-memory warning remains and subsequent mutations retain that in-memory work. Local storage is still a browser demo, not a transactional multi-user database.

## Deliberate boundary for the next step

The synthesis service still returns its existing draft contract (currently name, role, budget sensitivity and custom instructions) and retains the 4,000-character source / existing output-token limits. It can return the optional structured profile under the step-1 contract, and the editor will display it. This step does not claim to have upgraded model fidelity: richer AI-generated fields, larger synthesis budgets and the structured-profile chat compiler are step 3. In particular, editing structured fields beside an existing custom prompt stores those fields but does not rewrite that prompt automatically. Blank custom instructions use the compatibility prompt described above.

JEV questions, scoring, model selection, billing and chat response policy are unchanged.

## Verification

- 60 automated tests pass, including six new contract/server/storage tests and four new UI workflows.
- Coverage includes concurrent edit conflicts, request replay, lost create responses, reversible archive, archived selection, old conversations/continuations, reviewed duplication, manual field provenance, oversized input, synthesis replacement confirmation, failed-save draft retention, unsaved navigation and stale browser-tab edits.
- TypeScript checking, native Node ESM API route loading and production build pass. `git diff --check` is clean.
- Provider and storage integrations use deterministic test fixtures; production data and live model calls were not used for these checks.

## Review walkthrough

1. Open **Manage personas**, expand a profile and choose **Edit**. Change a goal and save.
2. Return to a conversation created before the edit: its buyer identity and profile should remain the original version.
3. Duplicate a persona, review its fields and save. It should appear as a separate persona.
4. Archive it. It should move to **Archived** and disappear from the new-dialogue selector. Restore it to make it selectable again.
5. Create a persona manually with a name, role and a few profile fields; no custom prompt is required.
6. In private Studio, describe a buyer and generate a draft. Review and edit it before saving. Confirming another generation replaces the whole draft; cancelling keeps it intact.

This PR is for review and preview. Production merge/deployment belongs to the user's review step.
