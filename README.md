# 1906.au Strategic Studio

Private single-user testing with **JEV guidance → Gemini reply → saved reply → JEV completed-exchange assessment**. The offline demo remains separate. Live mode has one shared **Studio User**, a private access code, durable Supabase storage and a remaining-usage percentage. There is no registration or multi-user billing.

## Local development

Use Node 24. `npm ci`, `npm test`, `npm run build`. `npm run dev` serves the offline demo; use `vercel dev` to exercise server endpoints with local server environment variables.

## Set up the private test environment

1. Create/use a dedicated Supabase test project. In its SQL Editor, run [`migrations/001_private_studio.sql`](migrations/001_private_studio.sql). It creates one private account row and two service-role-only RPC functions. There are no browser database credentials and no Supabase Auth accounts to create for this release.
2. In **Vercel → project → Settings → Environment Variables**, configure the values below for the intended test environment. Use a separate Supabase project and allowance for Preview versus Production if both will run, so tests cannot consume the same ledger unintentionally.
3. Redeploy the branch. Keep Vercel deployment protection enabled for private testing. The application access code also protects every paid API and saved conversation independently of deployment protection.
4. Open the app, select **Gemini + JEV · private testing**, enter the Studio access code, then create a conversation with its proposition, objective and target decision.
5. Send a controlled message, check its decision readiness and verify both providers' usage in the private database. An actual provider smoke test and billing reconciliation are required before treating the test setup as verified.

| Variable                    | Value                                                                         |
| --------------------------- | ----------------------------------------------------------------------------- |
| `STUDIO_ENABLE_LIVE`        | `true` for the private test deployment                                        |
| `STUDIO_ACCESS_TOKEN`       | A random secret of at least 32 characters; shared only with the testers       |
| `STUDIO_BUDGET_USD`         | Your chosen lifetime allocation, e.g. `10` means US$10; no default is applied |
| `SUPABASE_URL`              | Supabase project's HTTPS URL                                                  |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server service-role key; never a browser/publishable key             |
| `TYPESAFE_API_KEY`          | Direct TypeSafe API key                                                       |
| `JEV_MODEL`                 | `jev-1.13.0`                                                                  |
| `GEMINI_API_KEY`            | Gemini Developer API key                                                      |
| `GEMINI_MODEL`              | `gemini-3.8-flash`                                                            |
| `GEMINI_BILLING_TIER`       | `paid` or `free`, matching the Google project                                 |

Never use `VITE_` for secrets, the allocation or service credentials. The access code is kept only in browser memory; a refresh requires unlocking again, then restores server history and usage. Locking clears it. This is a shared test workspace, not individual identity management. Anyone given that code can read all Studio User conversations and consume that allowance. Use a strong random code and deployment protection; add individual authentication/rate limiting before public access.

The `10` above is an example, not an allocated amount. Increase `STUDIO_BUDGET_USD` to a **new total lifetime allocation**, then redeploy, to replenish usage. It does not reset recorded spending. All deployments pointing at one database must use the same total. Allocation changes are recorded in Vercel configuration history; an in-app grants interface is deferred.

## Turn behaviour

`POST /api/studio` loads saved state, saves an archetype or creates a conversation. `POST /api/dialogue` accepts a conversation ID, pitch, expected version and request ID. It loads the immutable persona snapshot and intent, reserves usage, calls JEV, validates its typed answers, then sends the updated decision state to Gemini. Only a committed reply advances the conversation version. State snapshots and raw JEV answers are retained in the private operation records.

The buyer's immutable persona and intent, bounded working context and latest decision state reach JEV on every turn. Readiness (0–4 × 25), sentiment, friction, evidence sufficiency and confidence are independent fields. Low-confidence readiness is provisional; missing/invalid readiness is unavailable with a reason. Buyer-turn evidence is required for stance and concern resolution. Seller reassurance alone cannot establish acceptance. These private-test rubrics are not a validated model of real-world conversion.

After the reply is committed, the browser calls `POST /api/assessment` with the latest reply ID and conversation version. This metered JEV-only call sees the completed exchange and updates observed telemetry without generating another reply. Pending/failed telemetry labels the previous completed assessment, and assessment can be retried independently. Stale results cannot overwrite newer versions. Pre-reply guidance remains available separately. Closing the tab before assessment requires **Assess latest reply** after unlocking; there is no background job.

`/api/evaluate` is retired (410); live dialogue cannot bypass JEV. AI archetype generation also uses the ledger and access gate. OpenAI live selection has been removed for this Gemini/JEV test stage. Manual archetype configuration is still available.

Demo/local histories are not imported or overwritten. Live conversations start with a new baseline. Intent is fixed per conversation; create another conversation to test a different decision. The full transcript remains in Supabase. Working context uses validated, attributed, exact older paragraphs plus the latest four verbatim messages once history exceeds 12,000 serialised bytes. Every older buyer paragraph is retained; seller selection retains first/last paragraphs and condition, figure, proposal and evidence markers. The UI discloses omissions and shows the retained quotes. This is conservative extractive memory, not a semantic guarantee that every seller detail survives. Memory has a 12,000-byte bound and the complete JEV request a 48,000-byte bound. If either cannot fit, review a visible linked-continuation summary; it preserves the persona, target and original conversation. No automatic narrative summarisation or additional summariser call is used.

## Usage accounting

The browser sees **Usage remaining — N%**. Dollars, rates, receipts and the ledger remain server-only. Calculation:

`remaining = max(0, allocation − metered cost − active reservations) / allocation × 100`

Costs use actual returned token counts and published rate cards, stored as integer nanodollars (one USD = 1,000,000,000 units). This is a metered cost estimate, not a provider-balance API or invoice. Promotional credits, account discounts and taxes require reconciliation; they are not inferred. JEV 1.13 uses $0.042 per million input tokens and zero output cost. Gemini's rate card counts uncached input, cached input once, and generated plus thinking tokens. Standard paid Gemini 3.8 Flash rates change from 1 January 2027; each attempt records the rate version used. Unknown models fail closed until their pricing and contract are explicitly added.

One account-wide compare-and-swap lock serialises paid operations across tabs/functions. It is intentionally simple for one tester. Reservations cover the full supported JEV request and a conservative Gemini input/output envelope, rather than estimating from visible characters. Gemini also runs official token counting before generation. The conservative reservation can prevent a request when a small positive percentage remains. The percentage can rise when unused reserved funds are released. Provider behaviour beyond the envelope remains a reconciliation risk; no absolute invoice cap is promised.

Changing browser storage cannot change live usage. Known usage remains charged even if subsequent output parsing or Gemini fails. JEV is reused when a reply is retried. Completed request IDs return stored results. Unknown network outcomes or missing usage retain reservations and block further paid work until reviewed. There are no automatic model-call retries.

Free Gemini tier usage contributes zero to the estimate, but its request/token quota still applies. JEV remains separately metered. Provider quota/funding failures do not turn the private allocation into a claim about provider credit balances.

## Recovery and operator inspection

Use **Refresh status** before retrying an interrupted request. A completed result is loaded without another provider call. Retry a failed message using its existing request ID. A failed dialogue turn must be resolved before sending another message in that conversation. A failed assessment keeps the completed reply and does not block a later dialogue unless its provider cost is uncertain. Drafts and pending request IDs survive reload within the same browser tab using session storage; unlock again to recover. Explicit locking clears them. Recover last request restores text without sending it. Definitively rejected, unadmitted requests can be edited; ambiguous requests keep their original ID until status is known.

The private account JSON is in `studio_private.account`. Read it through the Supabase SQL Editor (administrator only). `state.operations` contains attempt IDs, model/rate versions, token usage, costs, raw receipts and request status. Costs/reservations use nanodollars. Do not share this JSON with end users or expose the table through the Data API.

If a request remains running after the function has stopped, or is uncertain, reconcile the **unrecorded** provider cost first. The operator-only script releases the held reservation and makes the saved request retryable:

```sh
npx tsx scripts/reconcile-operation.ts <<'JSON'
{"operationId":"REPLACE_WITH_OPERATION_UUID","unknownCostUsd":"0","reason":"Verified with provider reporting: no additional unrecorded charge"}
JSON
```

Load server environment variables securely before running the script. The amount must be the independently checked _additional_ charge, excluding costs already recorded on completed attempts. `0` above is only an example after verification. The script waits at least three minutes before recovering a running operation, retains known charges and records a reconciliation reason. Do not release a reservation just because a browser timed out. Provider calls are not guaranteed exactly-once after ambiguous network failure.

## Test-stage limits and deployment

The store uses one bounded JSON account with optimistic concurrency, not a multi-user schema. Limits: 100 conversations, 2,000 operations, an 8 MB serialised archive and a 48,000-byte JEV request payload (including all questions and context), with 12,000 bytes of older structured memory. Reaching a limit stops new work; no financial or memory records are silently deleted. Archive before resetting a test database. Vercel functions request a 120-second maximum duration; verify that your plan/project supports it. The browser waits 125 seconds and instructs status recovery after a timeout.

The Gemini state-conditioning prompt is tested structurally. It does not mathematically guarantee every generated reply obeys the rubric; assess live examples before expanding use. The additional post-reply JEV assessment is a simulation feedback loop, not independent buyer validation. It adds one JEV call and its latency per completed exchange; it has its own reservation and receipt. Provider pricing and the allocation are unchanged.

Tests cover orchestration order, state continuity, budget arithmetic, private projections, duplicate/retry handling, concurrency, failure charging, access checks and browser workflows. Native-Node compiled-route checks retain the ESM import regression protection. Real provider access and a live Supabase migration cannot be verified without configured credentials.

Official references verified 5 October 2026:

- https://docs.typesafe.ai/api
- https://docs.typesafe.ai/models
- https://docs.typesafe.ai/confidence
- https://docs.typesafe.ai/model-jaggedness/jev-1.13
- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/tokens
- https://ai.google.dev/gemini-api/docs/pricing
- https://supabase.com/docs/guides/database/functions

## Evaluation and continuity review

See [the implementation review](docs/studio-continuity-review.md) for verified causes, Synthetic Rob replay evidence, bounded-memory trade-offs, test results and remaining live-provider checks. Existing stores require no SQL migration or new environment variables for this change. A protected preview must use isolated test storage before provider testing.
