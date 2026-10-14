# Persona and chat improvements: validation report

Date: 14 October 2026

## Baseline and release scope

Built on `main` at `3555ef3362f8e26eb08160c30651c81d901cbae7`, on the clean branch `feat/persona-chat-improvements`. The baseline passed TypeScript validation and all 99 tests.

Inspected draft PR #10 at `d5d94a230208a8795b0614171141972b4453b9bc`. Reproduced both TypeScript errors with `npm run lint`: `src/api/validation.ts:53` made an optional avatar incompatible with the required draft type; `src/components/LiveStudio.tsx:257` assigned an optional reply ID to a required message ID. No commits from that branch were merged. Its useful emoji UI changes were selectively adapted and validated; grounding and chat recovery were reworked.

This release covers the three requested improvements together. PR #10 remains open. Merge and production deployment require the owner's explicit approval.

## Changes

### Persona emoji selection and editing

- Preset picker and custom single-emoji input in the shared creation/edit/duplication form.
- Server and client validation supports joined emoji, skin tones, flags and keycaps, while rejecting plain text and multiple graphemes.
- Draft avatar is optional for compatibility. New personas default to 🎯; older callers omitting an avatar retain an existing persona's avatar when editing.
- Creation replays compare normalised defaults, so an older request omitting the default avatar remains idempotent.
- Older stored non-emoji display strings remain readable; unrelated edits preserve them. A duplicate of such a legacy record uses the default unless an emoji is selected.
- Existing conversation persona snapshots retain their original emoji and profile. No persona behavioural prompt changes.

### Source-grounded synthesis

- New synthesis requests pin `persona-synthesis-v3`; already-admitted v1/v2 requests retain their existing prompt, parser and retry behaviour.
- New drafts use conservative extraction, with exact supporting excerpts for each optional text field and every list item. The parser checks source membership and that the retained value occurs in its excerpt, with Unicode, whitespace and case normalisation and token boundaries.
- Unsupported fields are omitted together with their provenance, with review notes. Inferred optional fields are not silently accepted. Unsupported identity values become clearly labelled working placeholders.
- Existing saved personas and v2 synthesis drafts remain compatible. Manual editing stays available. No extra model call, new dependency, schema migration or model configuration change.

**Limits:** This verifies textual support, not semantic entailment or real-world truth. A model can still select an inappropriate excerpt, misunderstand negation, attribute another person's words to the buyer, or overlook a contradiction. Source text can itself be wrong. The review screen calls for checking field placement and attribution before saving. Sparse input intentionally produces sparse profiles. Live Gemini output quality and acceptance of the new schema still need a preview smoke test with configured providers; fixtures are not evidence of live model quality.

### Responsive chat and recovery

- Submitted messages appear immediately, with pending/sent status, and the submitted composer text clears.
- A successful reply renders from its response before a snapshot refresh finishes. Server IDs reconcile the displayed messages without duplication.
- Successful delivery and failed refresh are separate outcomes: a saved reply remains visible, the draft stays editable, and new sends wait for a successful status refresh.
- Lost responses are checked against the operation ledger. A completed turn is recovered without another generation; an unresolved request retains its original ID, version and exact text across retries/reload.
- A confirmed pre-admission rejection restores an editable draft. A failed admitted turn offers an explicit retry. Running/uncertain operations retain the existing account safeguards.
- Next-message drafts survive recovery and the separate insight assessment. JEV sequencing, scoring, billing and admission logic are unchanged.

## Validation results

| Check                                 | Result                                                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                              | Passed with existing lockfile; no dependency changes                                                                                     |
| `npm run lint` (`tsc --noEmit`)       | Passed                                                                                                                                   |
| `npm test`                            | 113 passed, 0 failed, 0 skipped                                                                                                          |
| `npm run build` (`tsc && vite build`) | Passed; 1,615 modules transformed                                                                                                        |
| `git diff --check`                    | Passed                                                                                                                                   |
| Configuration/JEV diff review         | No changes to `vercel.json`, `.env.example`, migrations, package manifests/lockfile, JEV implementations, reply prompts or context logic |

The suite includes React interaction tests in jsdom, native Node ESM API loading, existing Synthetic Rob/continuity/JEV regressions, provider-failure fixtures and server integration against an in-memory repository. New coverage exercises emoji edit/reopen/duplicate and legacy compatibility; fabricated/unrelated quotes, unsupported list items and identity placeholders; pinned v2 synthesis replay; immediate chat rendering; saved replies with failed refresh; lost response plus failed refresh with reload or same-ID replay; failed-turn retry; pending/uncertain operation safeguards; exact text and independent draft preservation. These tests use mocked model responses and do not consume live provider budgets or modify production data.

## Remaining checks before production approval

- Real-browser desktop/mobile visual and keyboard smoke checks were not completed: Chromium was absent and its download failed with an invalid/truncated archive. jsdom interaction tests passed but cannot establish layout or real-browser behaviour.
- Exercise the new synthesis schema and representative rich/sparse/contradictory descriptions on a configured preview with live providers. Inspect attribution and meaning, including a statement such as “does not use Salesforce”.
- Verify preview emoji save/edit/duplicate and chat send/recovery with the intended deployment settings. No production or database configuration change is needed for this PR.

No merge, production deployment or closure of PR #10 is authorised by this implementation report.
