# Step 3 — Rich persona synthesis and conversational voice

Builds on merged PR #5 (contracts) and PR #6 (persona management). The saved structured profile now drives new live conversations, including edits made alongside an older custom prompt. Synthesis produces that profile directly instead of asking the model to write a short role-play prompt.

## Delivered

- A structured Gemini response includes identity, relevant profile fields, field provenance and bounded review notes. Server validation rejects unsupported fields, missing sources, invalid enums and oversized content. The server creates the public compatibility `system_prompt`; the model no longer authors it for new synthesis requests.
- The synthesis instructions preserve supplied detail, label plausible additions as inferred, leave unknown fields absent and surface contradictions for review. They explicitly avoid inventing credentials, achievements, customer results, authority or demographic assumptions. These are generation instructions, not a guarantee of factual or psychological accuracy.
- The form accepts longer source descriptions, displays provided/inferred/unknown field status and shows generation notes. AI output remains an editable draft until saved. Changing a field marks its source as provided; untouched sources survive save/reopen. Notes remain labelled as notes from the original generation, so they are not presented as a fresh assessment of later edits.
- New live conversations use a server-built prompt with the full public profile, fixed intent, attributed memory, recent transcript and concise provisional guidance. Ordinary short replies, optional focused questions, conditional acceptance, refusal and resolved concerns are explicitly supported. Seller claims are not promoted into verified evidence or buyer acceptance.
- The new Gemini prompt receives readable concern/stance hints, with grounded buyer excerpts for concern history. It does not receive raw scores, probability distributions, internal motivational records or an instruction derived from `responseAction`. JEV still receives its existing evaluation state and questions; its rubric and scoring are unchanged in this step.
- Structured profile edits take precedence over conflicting supplementary custom instructions. Form-generated compatibility text is omitted from the new engine context when it would duplicate the profile. Explicitly authored custom instructions remain available as supplementary context.
- The existing palette, typography, layout classes and components are retained. No new UI library or provider SDK is introduced.

## Task limits and accounting

| Limit | New synthesis | Chat replies | Compatibility |
| --- | --- | --- | --- |
| Source input | 20,000 characters | 4,000-character seller message | Over-limit text stays visible; server rejects before reservation |
| Requested Gemini output | 6,144 tokens | 2,048 tokens | Existing failed synthesis requests keep their 2,048-token path |
| Raw generated text parser | 32,768 characters of JSON | 16,000 reply characters | Non-STOP and invalid output fail validation |
| Saved profile | 12,000 UTF-8 bytes, existing field/list limits | Same profile contract | No truncation or automatic data rewrite |

The 32,768-token counted Gemini input guard, 48,000-byte total JEV request guard, 12,000-byte memory bound and 8 MB account bound remain. The structured response schema is included in the official token-count request. Richer profiles consume context; exceeding a bound still stops work with the existing recovery path rather than discarding evidence.

The conservative **131,072-token output reservation remains unchanged**, including its reasoning allowance. Increasing the requested synthesis output does not replace that envelope with 6,144. Actual returned input, cached, output and thinking usage is still charged using the attempt's pinned rate card. Receipts are recorded before parsing. Invalid output retains its charge; an explicit retry regenerates Gemini output, while completed request IDs replay without another call. Unknown charges retain their existing review/blocking behaviour. Models remain `gemini-3.8-flash` and `jev-1.13.0`.

## Storage and compatibility

No SQL migration, table, column, RPC, RLS, environment variable or credential change is required. All additions fit the existing JSON store and compare-and-swap mechanism.

| Record | Additive field | Behaviour |
| --- | --- | --- |
| Persona/draft and frozen snapshots | `synthesisReview?: { version, identitySources, notes }` | Public, validated generation metadata. `version` is `persona-synthesis-v2`; notes are limited to six entries of 400 characters. Deep public projection strips extra stored metadata. |
| Private live conversation | `promptVersion?` | New conversations use `persona-voice-v2`; absence or `persona-voice-v1` preserves the previous prompt. A continuation inherits its source's version and frozen persona. Not returned in the public snapshot. |
| Private operation | `promptVersion?` | Pins synthesis/voice version at admission. A legacy operation without a version retains its old parser and generation path on retry. Completed cached results are projected and returned without regeneration. |

Profile schema version remains 2 and store schema version remains 1. Historical personas, transcripts, scores, receipts and conversation snapshots are not backfilled or rewritten. An explicit persona replacement without synthesis review metadata clears an earlier review block rather than leaving stale metadata attached. Unsupported conversation/request prompt versions reject before paid work.

The actual compiled voice prompt stays in server modules. Public `system_prompt` remains a compatibility summary or the user's custom instructions, not a copy of the internal reply policy. No private motivational taxonomy is added to public records or engine prompts.

## Verification and limits

- 72 automated tests pass, including the existing 60 tests and 12 new cases/workflows. Coverage includes rich generation through the operation ledger, exact input bounds, structured schema forwarding to token preflight, independent JSON size limits, malformed/truncated output, charge retention, explicit retries, cached legacy receipts, profile edits in both engine contexts, concern attribution, prompt-version continuity and UI review/save/reopen.
- TypeScript checking, native Node ESM route loading, production build and `git diff --check` pass.
- Tests use deterministic provider and storage fixtures. They verify contracts and orchestration, not that a live model is more human or equally faithful to the Base44 comparison. No production state or live provider allowance was used.
- Desktop/mobile visual review and live response comparison remain part of the isolated preview evaluation. Existing deployment protection is unchanged.

## Review walkthrough

1. Create a persona with **Describe the buyer**. Supply role, goals, pressures, decision context and a few examples of their voice; omit details you do not know.
2. Generate a draft. Check the review notes and inferred labels, edit a field and save. Reopen it: the edited field is provided, untouched suggestions remain inferred, and unknowns remain blank.
3. Start a new conversation. Check that changed profile details affect the buyer's concerns and phrasing even when older custom instructions exist.
4. Compare with a conversation created before this release: it keeps the old prompt path. Its linked continuation does too.
5. In isolated preview testing, replay the Marcus scenario alongside other personas. Compare voice distinction, repetition, resolved objections, conditional willingness, invented evidence and response length. Do not grade only whether the buyer accepts the demo.

## Remaining approved sequence

| Step | Status |
| --- | --- |
| 1. Persona contracts and compatibility | Merged in PR #5 |
| 2. Persona creation and management | Merged in PR #6 |
| 3. Rich synthesis and conversational voice | Implemented in this review branch |
| 4. JEV v3 evaluation | Next: separate readiness, motivational alignment and evidence sufficiency; decision-relative friction and profile relevance |
| 5. Chat and insights UX | Pending |
| 6. Isolated preview evaluation | Pending: live-provider comparison, usage reconciliation and desktop/mobile visual review |

Official Gemini references checked on 9 October 2026: [structured output](https://ai.google.dev/gemini-api/docs/structured-output) and [GenerateContent / GenerationConfig](https://ai.google.dev/api/generate-content). This implementation retains the existing `generateContent` REST API and adds `responseMimeType` / `responseJsonSchema`; semantic and size validation remain application responsibilities.
