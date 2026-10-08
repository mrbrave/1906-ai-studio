# Step 1: persona contracts and compatibility

This change establishes the storage and API foundation for the approved buyer-persona work. It does not change the current form, synthesis limits, reply prompt, JEV rubric, model selection or visual design. Those remain subsequent implementation steps.

## Public profile

`Archetype` and `ArchetypeDraft` now support an optional `profile` with `profileSchemaVersion: 2`. The profile holds industry, company size, age/income range, background, goals, pain points, buying motivations, typical objections, preferred evidence, tools, constraints, decision process/authority/speed, preferred channels, communication style, example phrases and additional guidance.

Name, role, budget sensitivity and the existing authored `system_prompt` remain in their original fields. This avoids conflicting copies and preserves the existing API/form. A profile is not mandatory for a legacy persona. Missing profile fields mean unknown; no values are inferred from role, age or prose.

Optional field provenance distinguishes supplied, inferred, seed and legacy information. The parser accepts only supported fields, provenance labels and schema versions. Text/list limits and a 12,000-byte UTF-8 profile limit apply on the server and in the shared client parser. Oversized or unsupported input is rejected, never truncated. The larger synthesis input/output limits are not activated in this step.

The live save action assigns `profileRevision: 1` for a newly created persona and ignores client attempts to set a revision or internal metadata. Revision-aware updates and archive actions belong to the persona-management step; the current create action retains its existing idempotency rules.

## Compatibility and persistence

The physical database still uses `studio_private.account.state` and the existing `studio_read` / `studio_write` RPCs. The outer store schema and demo-data version stay at 1, as required by the current SQL write guard. There is no SQL migration, new table, new environment variable or new provider request.

New default personas retain their structured seed context instead of dropping it. On reading an existing account, the pure compatibility adapter enriches a default catalogue row only if all previously stored seed fields match exactly and the row has no custom/extra metadata. Existing rich profiles, revised profiles and custom rows are retained. Custom rows without recoverable fields remain incomplete rather than gaining invented facts.

The adapter leaves saved conversation persona snapshots, intent, messages, evaluations, memory, operations, raw receipts, adjustments and private records untouched. It never calls `initialStore()` over an existing account. It is idempotent and leaves its input unchanged.

A read does not write to Supabase. Additive catalogue fields are persisted with the next ordinary, compare-and-swap checked mutation. A conflicting revision causes the normal re-read/retry; it does not overwrite newer data. Invalid profile storage returns a recoverable 503 and is not reset. Unsupported local data is likewise reported without replacing the original.

Local legacy imports retain explicit structured fields from both the old camelCase and the supplied Base44 field names. The original legacy local-storage value is not edited. This mapping is a conversion helper, not a new Base44 importer or backend dependency.

New conversations already clone their persona; the clone now includes the structured profile and its revision. Linked continuations retain that same saved persona. Editing the catalogue later cannot change these copies. Existing conversations without a structured profile retain their old snapshot. Prompt builders do not yet consume the new profile: that wiring and behavioural comparison belong to the generation step.

## Public/private boundary

`Store.personaPrivateByRevision` is an optional server-only contract keyed by persona ID and revision. This step does not infer, populate, expose or use private motivations. The private types are in `server/`, not in the shared public persona model. There is no public endpoint for editing these priors.

`publicData.ts` explicitly selects permitted fields for profiles, persona records, messages, evaluations, concern entries, memory, conversation snapshots and operation results. Unknown nested metadata cannot be returned merely because a stored object grew a new property. It also rejects objects in scalar/list slots rather than serialising arbitrary nested values.

The projection applies to live snapshots, new generation/turn results, completed-operation replays and local persistence. This is necessary because cached results otherwise bypass generation-time parsing. Raw receipts, financial records and private profile maps remain on the server. Returned data is detached from the store; editing a returned profile does not mutate a saved conversation.

The legacy `system_prompt` is an existing user-authored public field. It is deliberately preserved. Future compiled prompts that contain private modelling information must use a separate server-only field; they must never be written into `system_prompt`. Allowlisting controls metadata exposure, not the meaning of arbitrary user-authored prose or model-generated dialogue. Reply-level non-disclosure evaluation is part of the later prompt work.

## Verification

The new test suite covers schema/provenance and UTF-8 limits, Base44/legacy field mapping, rich-profile save/replay/conversation/continuation round trips, immutable snapshots, idempotent seed enrichment, unchanged custom data and historical receipts, local storage filtering, deeply nested output filtering, cached-result filtering and Supabase RPC/CAS compatibility.

Existing API, budget, continuity, Synthetic Rob, UI and native Node ESM tests remain regression gates. Tests use deterministic provider and storage fixtures; this change makes no claim about improved live reply quality or a live production database migration.

Required checks: `npm test`, `npm run lint`, `npm run build` and `git diff --check`. Inspect the compiled browser bundle to confirm server-only private-profile runtime code is absent. No screenshot comparison is required for this step because there are no component or CSS changes.

Verified on 8 October 2026: all 50 automated tests passed (41 existing and nine new), TypeScript checks and the Vite production build passed, and `git diff --check` reported no whitespace errors. The generated browser bundle contained none of the private profile map/key identifiers or test-only secret sentinels. Supabase RPC tests used an injected storage backend; no production account was read or written and no paid model calls were made.

## Review and rollout

This step is delivered on a review branch. Production deployment is not part of the step-one review. Before promoting the completed feature, take an administrator-controlled backup and rehearse the compatibility adapter against an isolated copy of the actual account. Do not use the production ledger as a Preview test store.

Rollback of this step's application code does not require deleting profile fields: the previous outer-version-1 reader accepts extra persona properties and continues using the original system prompt. Keep the account and any newly recorded receipts; never restore an old account snapshot over newer conversations as an application rollback.

Next step: expose the structured profile through the existing design, retain AI/manual creation, and add revision-aware editing, duplication and archival. The form can then use this validated contract without introducing another persona shape.
