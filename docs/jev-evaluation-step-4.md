# Step 4 — Decision-relative JEV v3 evaluation

Implements the approved evaluation package on top of merged PR #7. New conversations use `1906-decision-v3`. Existing conversations, their continuations and previously admitted requests retain their earlier rubric. The JEV → Gemini → saved reply → JEV completed-exchange assessment sequence is unchanged.

## What changed

The old `evidenceSufficiency` value came from a question about whether JEV had enough conversation to estimate readiness. It did not measure support for the seller's proposition. V3 gives those concepts separate questions, values and statuses, removes unused duplicate questions, and keeps motivational appeal independent from readiness.

| Dimension | Meaning and scale | Visibility |
| --- | --- | --- |
| `readiness` | Willingness to take the fixed next decision; native fractional score 0–4, index ×25 | Public |
| `evidence_sufficiency` | Supporting evidence required for this particular next step; five levels from no relevant support to adequate support | Public |
| `assessment_grounding` | Whether the conversation supports a readiness assessment; Noul probability 0–1 | Public |
| `friction` | Dominant supported material obstacle to this next step, including `identity_fit`, existing commercial conditions, `none` and `unknown` | Public |
| Sentiment, stance and conditions | Buyer tone, evidenced position and outstanding requirements, assessed independently | Public |
| `motivational_alignment` | Fit with a configured hypothetical private profile; score 0–4 | Private operation record only |
| `profile_relevance` | Consistency between observed reactions and at least one configured motive; Noul probability 0–1 | Private operation record only |
| Per-motive observations | Independent primary/secondary relevance, supporting and contrary buyer references, and a bounded alternative-explanation choice | Private operation record only |

A specific seller-reported comparable case remains unverified supporting detail. Repetition does not create independent evidence. A buyer can accept a low-commitment demonstration without establishing that the seller's claims are true. Neither a high alignment score nor a readiness threshold generates agreement. Actual supported stance governs the action hint; Gemini still receives provisional guidance, not a command to agree.

The original V2 evaluator is preserved byte-for-byte in `server/jev-v2.ts`. `server/jev.ts` selects the version; `server/jev-v3.ts`, `server/jev-answers.ts` and `server/jev-evidence.ts` implement the new contract. Shared public types and output projection are separate from private evaluation types.

## Status and interpretation

Each requested dimension is parsed independently with `complete`, `provisional`, `missing`, `invalid` or `unavailable` status. An invalid readiness answer does not discard a valid sentiment or evidence score. Native values, including fractional scores, are retained. Score/Choice distributions must contain all expected keys, finite probabilities within range and a total within tolerance. Scores must agree with their weighted distribution; Choice must select a highest-probability option. Missing confidence makes an otherwise valid answer provisional.

Noul remains a probability. Values 0, 0.5 and 1 are preserved; none are cast to Boolean and no separate provider confidence is invented. `complete` on a Noul dimension means a valid returned probability, not certainty that its proposition is true. Missing private profiles produce unavailable private dimensions, not false values. A primary-only private profile can achieve the highest alignment level.

Operational thresholds remain explicit and are not calibrated psychological measurements: Score/Choice confidence below 0.5 is provisional; readiness grounding below 0.75 is provisional and zero grounding makes readiness unavailable; concern resolution needs at least 0.85 plus buyer evidence. Conditions at or above 0.75 are supported requirements; a prior condition is not cleared by missing or ambiguous results. Unconditional next-step guidance requires all condition probabilities at or below 0.25, evidenced agreement and no unresolved obstacle. These bands need live evaluation before being treated as release-quality calibration.

The minimal insights-panel update labels V3 evidence as a 0–4 rubric and grounding separately. Historical `evidenceSufficiency` values are labelled **Legacy assessment grounding**. Existing values are not converted, recalculated or relabelled as product evidence. The broader Buyer insights redesign remains Step 5.

## Evidence and continuity

Evidence choices now include recent buyer messages and validated retained buyer-memory entries. The maximum is 48 candidate turn IDs. Priority goes to the latest 12 buyer turns, previously referenced stance/concern evidence, the oldest retained candidate and the remaining retained candidates in reverse order. This improves access to older acknowledgements without promising that every turn can be selectable beyond the cap.

Question criteria refer to IDs; exact quotes are already in the bounded history/memory context. Parsed references preserve the source ID, `recent`/`memory` provenance and exact text. Seller IDs and user-reviewed continuation summaries cannot masquerade as buyer evidence. Tampered memory fails validation before provider work. The complete request still has the existing 48,000-byte cap.

Material friction and buyer stance require confident buyer references. Resolution requires an acknowledgement at or after the recorded concern; an older objection cannot reopen a later resolution. A genuinely later objection records a reopening. Outstanding commercial conditions remain distinct from a rejected price. Missing resolution or condition answers do not silently clear prior concerns.

The pre-reply evaluation cannot observe the buyer's response to a new seller claim. Post-reply assessment still includes the committed buyer reply and is tied to that reply ID and conversation version. Existing stale-assessment guards, JEV-only assessment retries and idempotency remain in place.

## Private modelling data

Private profiles remain optional records in `personaPrivateByRevision`, keyed by persona ID and exact public profile revision. They must be explicitly authored or supplied as labelled modelling assumptions; this implementation does not invent them from a role or silently generate them for every persona. The Marcus profile in the tests comes from the supplied example and is not installed in production.

New conversations freeze a validated copy of the matching private revision, or `null` when none exists. Later catalogue/private-map edits do not change an existing conversation. Editing a public persona creates a new revision that cannot implicitly inherit old private assumptions. A continuation keeps its source's frozen private profile and rubric.

Configured strengths are retained independently; they need not sum to one. They are not calibrated probabilities. Primary and secondary relevance are assessed independently, with support, counter-evidence and plausible ordinary explanations such as professional due diligence. Overall relevance does not validate each motive and is not causal proof or diagnosis.

JEV receives the configured private profile for evaluation. Gemini's reply context does not receive the private profile, codes, weights, alignment scores or relevance results. Those results stay in `operations[].decision.privateEvaluation`; raw provider responses stay private as before. Explicit recursive allowlists project public decision dimensions, references, snapshots, operation results and local/demo exports. No private taxonomy is bundled into the frontend.

## Database and API impact

**No SQL migration, table, RPC, RLS, credential or environment-variable change is required.** Store schema version and public data version remain 1. These are additive JSON fields in the existing private account and compare-and-swap workflow.

| Stored record | Addition | Compatibility |
| --- | --- | --- |
| Private live conversation | Optional `rubricVersion`, optional frozen `privatePersonaRevision` or `null` | New conversations use V3. Missing rubric means V2. Continuations inherit the source. Neither new field is returned by the conversation snapshot projection. |
| Private operation | Optional `rubricVersion` | Pinned at admission. An old failed request without a pin still uses V2; completed results replay without new evaluation. |
| Public decision/evaluation | Optional `dimensions`, `evidenceStrength` (0–4), `assessmentGrounding` (0–1) | V2 `evidenceSufficiency` retains its original semantics; it is not populated with a different unit in V3. |
| Private decision receipt | Optional `privateEvaluation` | Holds alignment, profile/per-motive relevance and evidence. Never returned as part of `TurnResult`, a message or a snapshot. |

The existing API request shapes are unchanged. To test V3 after deployment, start a new conversation. Opening or continuing an older conversation intentionally keeps V2. Reassessment remains an explicit assessment operation: a fresh request ID evaluates the latest eligible reply, while replaying the same ID returns its previous result. Earlier operation receipts retain the prior assessment and version; there is no automatic bulk reassessment.

The provider models, prices, actual usage arithmetic, conservative reservation envelope, serialised operation guard and uncertain-charge handling are unchanged. Known usage is recorded before parsing. The new rubric can use more JEV input tokens; actual returned usage still determines the ledger entry. The 8 MB account, 100-conversation, 2,000-operation, memory and request caps remain.

## Verification

- **92 automated tests pass:** the 72 existing regressions plus 19 V3 contract/scenario/integration cases and one insights-label test.
- TypeScript checking, native Node ESM route loading, production build and `git diff --check` pass.
- Verified V2 evaluator source preservation byte-for-byte.
- Tests cover fractional scores, malformed distributions, Noul 0/0.5/1, dimension independence, unavailable private profiles, primary-only alignment, separate motive relevance, exact older evidence, false seller acceptance, conditional agreements, reopening, privacy projections, versioned continuation/retries and unchanged metering.
- Marcus fixtures exercise high alignment alongside conditional openness and an unverified comparable example. Rob fixtures progress from credibility/implementation questions to commercial conditions. These are authored transformation fixtures, **not live JEV classifications or measured buyer behaviour**.
- No production state or live provider allowance was used. Live qualitative comparison, calibration, latency/token measurements and desktop/mobile visual review remain part of the isolated preview evaluation in Step 6.

## Review and rollout

1. Start a new dialogue after deploying this branch to the protected preview and confirm completed assessments identify `1906-decision-v3`.
2. Check that supporting evidence and assessment grounding use separate labels and units. Inspect a legacy dialogue to confirm the legacy label and version.
3. In isolated testing, replay Marcus and Rob with vague claims, reported cases, inspectable synthetic evidence, refusal and conditional acceptance. Keep the target decision fixed; compare demo versus purchase in separate conversations.
4. Confirm public responses and Gemini requests contain no private modelling data. If a private profile is absent, inspect the private receipt for unavailable values rather than inferring a false result.
5. Review actual usage receipts and timing before production promotion.

For rollback, preserve the account and all receipts. A reviewed forward-compatible patch can select V2 for newly created conversations while retaining both parsers for existing versioned conversations. Do not deploy a pre-V3 backend over active V3 conversations: older code does not understand the rubric pins. Suspend live requests first if a full older-code rollback is necessary. No production merge or database mutation was performed for this implementation.

Remaining sequence: **Step 5 — chat and insights UX**, then **Step 6 — isolated preview comparison and review**.

Official references verified 9 October 2026: [TypeSafe API](https://docs.typesafe.ai/api) and [confidence semantics](https://docs.typesafe.ai/confidence). The implementation retains `POST /v1/systemone` with `jev-1.13.0`, native Score/Choice distributions and Noul probabilities.
