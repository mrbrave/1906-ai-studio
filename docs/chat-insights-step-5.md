# Step 5 — chat and buyer insights

Implemented on top of merged Step 4 (`21da98d5aac03cef07f857e4fb3dded050b223f0`). This is the chat/insights UX package from the approved implementation plan. The reply prompts and JEV scoring contracts remain versioned as before.

## What changes

- **New conversation**, **Persona**, **What do you want to learn?**, **What are you offering?**, and **What next step are you testing?** replace the technical setup wording. The general example is “agree to a demo”. The fixed-next-step rule remains visible.
- The selector has a compact public profile preview. Chat has **View persona profile**, showing the saved persona revision used by that conversation and the provenance of public profile fields. It does not substitute the latest edited persona for the conversation snapshot.
- Messages show **You** or the persona name, with the existing persona avatar. The simulation label remains visible. Engine names move into **Technical details**; the workspace selector says **Private Studio · AI simulation**. New conversation titles use the same terminology; historical titles are untouched.
- **Buyer insights** prioritises where the buyer stands, decision readiness, what is holding them back, remaining conditions, supporting evidence and what to explore next. Numerical confidence, evidence score, assessment grounding, rubric/model versions, evidence references and pre-reply guidance are inside **Assessment details**, closed initially.
- Readiness remains an index out of 100, explicitly not a conversion probability. V3 supporting evidence gets a descriptive label, using the nearest rubric level (boundaries 0.5, 1.5, 2.5, 3.5), with its exact fractional score retained in details. Tentative results remain labelled. V2 grounding keeps its original meaning and units; it is never reinterpreted as supporting evidence.
- Suggestions use public decision state plus buyer quotes verified against the stored transcript. They acknowledge refusal, distinguish agreement from outstanding conditions, and never imply that case evidence exists. The Marcus comparable-growth example is used only when a verified buyer quote supports that context. This adds no model call and changes no saved evaluation.

## Reply and analysis states

The client distinguishes three real stages while retaining the account-wide operation guard:

1. **Generating**: the existing dialogue endpoint runs the evaluation/reply/persistence operation. The UI shows “{name} is replying…”. There is no fake streaming or delay.
2. **Loading the saved reply**: the client retrieves the persisted snapshot. The endpoint does not expose the instant at which generation switches to database saving; the UI deliberately does not claim to observe that internal transition.
3. **Updating insights**: the saved reply is visible, the composer accepts and retains the next draft, and sending stays disabled until the current request finishes. The existing post-reply assessment still runs once with its existing request ID.

An insights failure appears in Buyer insights, with a compact notice by the composer. **Retry insights** calls only the assessment endpoint for the same reply/request ID. It does not regenerate the buyer response. A refreshed, completed assessment takes precedence over a lost HTTP response. Draft text is never cleared by analysis completion or retry. Interrupted model requests and uncertain cost still use the existing recovery guard.

The redundant second snapshot read between reply recovery and assessment has been removed. The existing refresh sequence guard prevents an older in-flight snapshot from replacing a newer one.

## Freshness, evidence and accessibility

A result is current only when it is a completed post-reply assessment tied to the displayed reply and there is no subsequent seller message awaiting a reply. Otherwise the panel explicitly labels the last valid result **Previous insights · not the latest exchange**, or shows unavailable state. A missing readiness value never falls back to an older telemetry score. Pre-reply guidance stays in details.

Only exact, attributed buyer quotes that match the stored transcript are displayed or used to tailor suggestions. Source buttons open and focus the corresponding message. Seller claims and unmatched text are excluded.

Desktop layouts at 1,200 px and wider reserve room beside chat for insights. At narrower widths the drawer overlays the workspace with dismissal, Escape handling and a keyboard focus loop. The mobile navigation has a backdrop, focus loop, Escape and focus return. Chat preserves Enter to send, Shift+Enter for a line break, composition input, over-limit paste retention and reduced-motion behaviour. Async assessment completion does not move focus away from the current control or scroll the conversation merely because evaluation metadata changed.

The existing cream/blue palette, Epilogue/Manrope typography, marker outlines, shadows and irregular shapes are retained. No Base44 dependency, provider selector expansion or component framework is introduced.

## Data and API impact

**No SQL migration, JSON schema migration, API contract, RPC, RLS or environment-variable change.** There are no new persisted fields. Reply phases and transient analysis errors live in React state; drafts use the existing session-scoped draft store. Public profile and evaluation allowlists remain unchanged. Existing conversations, persona snapshots, prompt/rubric pins, receipts, token limits and billing rules are preserved.

The only server change is user-facing copy for newly created conversation titles and a missing-source error. No production data is modified by this PR.

## Verification

- 99 automated tests pass, including the unchanged provider/billing/privacy/legacy suites and native Node ESM route-loading checks.
- TypeScript checking, production build and `git diff --check` pass.
- Added interaction coverage: generation/snapshot/assessment transitions; drafting while analysis is pending; blocked overlapping sends; failed and lost-response assessment recovery; draft survival through retry/reload; one buyer reply; frozen profile display; mobile navigation and insights keyboard focus; Enter/Shift+Enter/composition behaviour.
- Added insight coverage: pre-reply and mismatched results rejected as current; previous results visibly labelled; missing readiness kept empty; exact buyer-only evidence; refusal and conditions respected; no invented comparable proof; confidence/details collapsed initially.
- These are deterministic tests and DOM checks. A local browser binary is unavailable, and protected preview browser access remains to be arranged. Desktop/mobile screenshot and live-provider quality review are **not** claimed as completed.

## Review walkthrough

1. Open the private Studio, choose **New conversation**, and inspect the persona preview and revised intent fields. Start a conversation and confirm its profile is the frozen revision.
2. Send a message. Watch the reply and insight statuses separately. As soon as the saved reply appears, type the next draft; sending remains disabled while insights update.
3. Open Buyer insights. Check the compact summary, expand details to inspect exact scores/references, and follow a buyer-source link. On a narrow viewport, use Tab and Escape to check the drawer and navigation.
4. Use a preview-only failed-assessment fixture to check **Retry insights**. Confirm the completed reply stays visible, the draft survives and no extra Gemini reply is generated.
5. Open a legacy conversation and confirm its grounding value appears only under **Legacy assessment grounding**. Check a pending next reply and verify previous insights are labelled as previous.

The remaining package is **Step 6 — isolated preview comparison and review**, including live response quality, latency/token measurements and desktop/mobile visual sign-off. Production merge remains with the user.
