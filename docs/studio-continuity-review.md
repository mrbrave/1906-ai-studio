# Studio evaluation and conversation continuity review

7 October 2026. Review branch: `fix/studio-telemetry-continuity`.

## Verified baseline and diagnosis

Repository: `mrbrave/1906-ai-studio`. Main and the deployed production revision were verified as `d283fd50d3459168f1a3f7e290dfbde3e513426d`. Vercel production deployment `dpl_2B3YpErXPGLzUCU3mM8FqnmKW9yU` was READY and aliased to `www.1906.au`. The connected Sydney Supabase account was inspected read-only. No production conversation, persona, budget, credential or database configuration was modified.

| Finding | Verified cause | Change |
| --- | --- | --- |
| Persistent unavailable readiness / “Uncertain” | Baseline `server/jev.ts` combined evidence sufficiency ≥ .75 with readiness, sentiment and friction confidence ≥ .50. Failure hid otherwise valid readiness and forced clarification. | Each dimension is validated separately. Readiness remains visible as provisional when its confidence or evidence sufficiency is low. Missing/invalid/ungrounded readiness stays unavailable with a reason. |
| Credibility friction persisted | Baseline resolution prompt focused on the latest seller message, with resolution ≥ .85 required. Saved resolution values were .39, .73, .79 and .69. | Resolution questions use buyer acknowledgements in attributed history/memory. A valid buyer-turn reference is required. The .85 threshold is retained, not tuned for Rob. Active, resolved and reopened events are bounded to 32. |
| Telemetry appeared behind the reply | Baseline JEV ran before Gemini. The panel showed the state used to generate the reply, without assessing that reply. | New `POST /api/assessment` evaluates the completed exchange. The panel separates current, previous, pending/failed and pre-reply states. |
| Memory warning after four exchanges | The exact warning came from a **24,000-byte serialised JEV request guard**, including persona, intent, full history and repeated question instructions. It ran before operation admission. This was not evidence that Gemini's context window was exhausted. | Bounded exact-quote working memory, four recent verbatim messages after compaction, deduplicated evaluator instructions, 48,000-byte complete request bound and linked continuation fallback. |
| Failed/unsent draft loss | Composer cleared before acknowledgement; pending request lived only in a React ref; recovery resent rather than restoring. | Tab-scoped draft/request persistence, exact-text restoration, acknowledgement-based clearing, definitive preflight rejection recovery and explicit idempotent retries. |
| Source input limit | Synthesis input was 4,000 characters on client/server; system prompt was 16,000. Dialogue input also had a client/server mismatch. | Counters, consistent limits and disabled submission above limits. Pasted text is retained, not truncated. No new ingestion system. |

The saved eight-message Rob conversation left only **447 bytes** for a new ASCII message under the old request envelope: a one-character request measured 23,554 bytes. The original rejected commercial draft was never admitted to the database, so its exact text/size cannot be recovered from server records. A separate, explicitly hypothetical 951-character proposal reproduced the old warning locally. No hypothetical price or timeline was added to the production transcript.

## Behaviour and implementation

- `server/jev.ts`: readiness, confidence, sentiment, friction and sufficiency are independent; typed distributions, ranges, model and evidence options are checked. Missing confidence is null. Readiness conversion remains `score × 25`, rounded to one decimal. Conditions and stance are separate; contradictory unconditional agreement with unresolved conditions is represented as conditional. No Rob-specific or “proceed” keyword rule.
- `server/turn.ts`, `api/assessment.ts`, `vercel.json`: dialogue commits one reply and pre-reply guidance; the subsequent JEV-only assessment records its receipt and observed state. The reply ID is its idempotency key. Both admission and commit check version/latest reply. It never invokes Gemini. Failed assessment retains the completed reply, and retry consumes only JEV when needed. Ambiguous provider costs still require ledger reconciliation.
- `server/context.ts`, `server/provider.ts`: structured extractive memory with exact paragraph, role and turn references. Quotes are checked against the full transcript on reuse. Persona snapshot and fixed intent are retained. Newer pre-reply guidance takes precedence over an older observation; a same-version post assessment takes precedence over pre guidance.
- `server/studio.ts`, `server/repository.ts`, shared types: optional, versioned memory/evaluation fields and linked continuation within the existing access-controlled JSON store. No SQL migration or new environment variable. Existing transcripts remain readable. Legacy telemetry is labelled pre-reply until deliberately reassessed; historical scores are not rewritten.
- `LiveStudio`, `ChatWorkspace`, `TelemetryDrawer`, `draftService`, HTTP client: freshness/status, independent model confidence labels, current stance, conditions, concern references, pre-reply details, recoverable drafts and JEV-only retry. Drafts survive same-tab reload after unlocking, not device changes; explicit Lock clears them. Storage failure tells the user to copy the draft. Supabase remains the durable source for completed conversations/memory.
- `ArchetypeSynthesizer` and new-dialogue guidance: source/system-prompt distinction, character counters and one-action target guidance. Existing targets and persona specifications are unchanged.

The immutable persona system prompt remains intact. Generic Gemini control guidance no longer forces clarification merely because another evaluator dimension is uncertain; the persona is instructed to judge evidence, retain conditions and avoid manufactured objections. That conditioning change still needs live behavioural validation.

## Synthetic Rob results

Reparsing the **old saved pre-reply receipts** demonstrates the removed cross-dimension gate. These are not new model assessments of the latest buyer reply:

| Saved exchange | Raw readiness / 4 | Readiness confidence | Evidence sufficiency | Baseline display | New independent parsing |
| --- | ---: | ---: | ---: | --- | --- |
| 1 | 2.13 | .68 | .32 | Unavailable | 53.3, provisional |
| 2 | 2.79 | .81 | .61 | Unavailable | 69.8, provisional |
| 3 | 3.09 | .83 | .69 | Unavailable | 77.3, provisional |
| 4 | 3.02 | .90 | .64 | Unavailable | 75.5, provisional |

The handover's exact buyer excerpts form deterministic regression fixtures. Typed evaluator outputs are injected to verify transformations and orchestration:

| Fixture stage | Verified state behaviour |
| --- | --- |
| Intellectual quality/evidence concern | Credibility remains active. |
| Evidence controls acknowledged | Buyer evidence can resolve credibility; implementation concerns remain. |
| Review effort/interface discussion | Conditional time estimate remains conditional; operational burden is retained. |
| Paid pilot agreed in principle | Conditional agreement, commercial terms/scope/timeline pending, concise proposal suggested. Module selection remains a future buyer action. |

Rejection, politeness, sarcasm and quoted acceptance fixtures verify that the application does not override the evaluator with an acceptance keyword heuristic. They **do not prove** that live JEV will classify every such utterance correctly. No exact 75/100 output is required.

An additional private local integration replay loaded the actual saved persona, target and eight messages into an in-memory repository. The hypothetical 951-character proposal passed the new pipeline: **28,728 bytes** total JEV request; **6,467 bytes**, 20 source entries in older memory; four recent messages; four older seller background paragraphs omitted from working context. All eight original messages, the complete persona snapshot and intent were byte-for-byte unchanged. The new turn used two stubbed JEV calls and one stubbed Gemini call. Replaying the completed dialogue request added no calls or messages. The private transcript was not committed to this repository.

## Bounds and continuation

| Limit | Behaviour |
| --- | --- |
| 12,000 serialised history bytes | Triggers older-history compaction when more than four messages exist. |
| Four recent messages | Remain verbatim after compaction; the new seller message is added separately. |
| 12,000 memory bytes | Exact older evidence is bounded; overflow stops inference and offers continuation. |
| 48,000 JEV request bytes | Includes persona, intent, working context, previous state, questions and new message. |
| 32,768 Gemini input tokens | Existing official token-count guard remains; overflow offers the same continuation path. |
| 2,048 requested Gemini output tokens; 16,000 reply characters | Existing output safeguards remain. |
| 8,000 continuation-summary characters | User reviews context before a linked conversation is created. |
| 100 conversations, 2,000 operations, 8 MB archive | Existing test-store quotas remain; archive/ledger limits are not described as model memory. |

Memory is deliberately extractive: every older buyer paragraph is retained. Older seller first/last paragraphs and paragraphs containing condition, commitment, figure, timeline, proposal or evidence markers are retained. Other older seller paragraphs can be omitted **from working context only**; the UI discloses the count and exposes retained quotes. This conservative selection is not comprehensive semantic summarisation: uncommon seller details may need to be restated. No summary can turn conditional buyer text into unconditional text, because retained evidence is verbatim and validated. As mandatory buyer evidence grows, continuation is expected; this is bounded continuity, not unlimited context.

The full transcript and financial receipts are never pruned. A user-reviewed continuation summary is visibly labelled, preserves persona/target and links back to the original. Known failed work remains recorded in the original. Running/uncertain work must be recovered first. A persona or question payload that is too large by itself can still require a shorter user-reviewed context; the guard is never removed. Gemini output headroom remains governed by its separate output/reservation envelope.

## Verification and remaining release work

- **41 automated tests passed**, including independent dimensions, concern progression/reopening, invalid readiness, latest-reply inclusion, stale assessment rejection, JEV-only retry, metered idempotency, compaction/source validation, continuation, existing ledger/privacy behaviour, draft reload and failed-request recovery. The native Node ESM route test includes the new assessment route and access gate.
- `npm run lint`, `npm run build` and `git diff --check` passed.
- Chromium browser flow passed at 1440×1000 and 390×844 with injected engines: unlock, send, completed-exchange analytics, conditional stance, same-tab reload and exact draft restoration. No browser exceptions or horizontal page overflow. Desktop/mobile screenshots were inspected locally. A focus-induced workspace shift and confidence-text contrast were corrected.
- Local replay of the actual saved Rob case passed as described above. Provider outputs in that replay were stubs, so it establishes bounded orchestration and preservation, not new live semantic results.

The added completed-exchange step costs **one additional metered JEV call per completed reply** and delays final telemetry by that call plus persistence. No extra Gemini or summariser call is added. Each stage retains actual usage/receipt accounting. Rates and the Studio allocation are unchanged; no runtime cost estimate is presented as a provider credit balance. The ledger's uncertain-cost reconciliation rules remain in force. Closing the browser before assessment leaves a recoverable pending assessment; there is no background assessment worker.

Vercel environment metadata confirms all ten existing application variables are **Production-only**. No Preview credentials or isolated Preview store are configured. Thus live TypeSafe/Gemini semantic classification, latency, real receipt accounting for the new post stage and a Supabase round trip of the new optional fields remain untested. Review uses existing interfaces plus in-memory CAS tests, not a claimed production migration.

**Deployment status:** review branch/draft PR only; no production publish, merge or billing change. The local production build is reviewable. A Vercel Git preview, if generated, can serve the frontend but cannot run private Studio without its Preview configuration.

**Next release step:** configure a protected, isolated Preview Supabase store and Preview-only existing environment variables; run the Rob scenario with real providers, including conditional agreement, rejection and failed-assessment retry. Check latency and receipts, then review the diff before separately authorising production publication. Do not point Preview at the production ledger or supply provider secrets in chat.

API contract references checked: [TypeSafe API](https://docs.typesafe.ai/api), [TypeSafe confidence](https://docs.typesafe.ai/confidence). Choice/score confidence is provider-reported, not calibrated real-world purchase probability. JEV guiding and then assessing Gemini is a simulation feedback loop, not independent buyer validation.
