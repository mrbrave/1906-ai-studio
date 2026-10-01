# 1906.au Strategic Studio

A single-buyer decision-intelligence studio built with React, Vite and Tailwind.

## Development

Use Node 24.

```sh
npm ci
npm run dev
npm run build
npm test
```

`npm run dev` runs the frontend with explicit demo mode. For the live server routes, use `vercel dev` with your own Vercel CLI installation, or deploy a protected Vercel preview. Select Vite as the framework, build with `npm run build`, and use `dist` as the output directory. Root `api/` contains Vercel Node functions; `src/api/` contains browser clients and shared application contracts.

## Engines

1. `/api/dialogue` calls Gemini or OpenAI with the archetype instructions, recent conversation history and new pitch. It returns `{ text: string }` with an in-character reply.
2. The UI immediately persists and displays that reply, then calls `/api/evaluate` with `{ archetype, pitch, response }`.
3. The evaluator returns exactly `{ intentScore, sentiment, activeFriction, suggestedTweak }`. Runtime validation rejects missing/extra fields, invalid strings and scores outside 0–100.
4. Evaluation failure preserves the reply, displays an unavailable state and permits evaluation-only retry. Dialogue failure permits reply retry without duplicate user messages. The analytics drawer stays closed until requested.

Copy `.env.example` to `.env.local` and configure a provider key plus an available model identifier. No secrets are accepted or stored by the browser. Live routes are disabled unless `STUDIO_ENABLE_LIVE=true`. **Use live mode only in a protected preview until authentication, server-owned balances, quotas and rate limits have been implemented.** The environment switch is a deployment guard, not authentication.

### JEV integration pending

`server/jev.ts` deliberately returns HTTP 501. The brief specifies the output but supplies no actual TypeSafe JEV API URL, authentication scheme or request schema. Provide those details plus a sample response, then implement the vendor translation in this one adapter. No guessed upstream endpoint, alternative evaluator or fabricated live score is used. The frontend pipeline is complete and tested with injected engines.

Demo mode uses a fixed illustrative response and telemetry fixture; it does not call an LLM or JEV. AI archetype generation requires a configured live dialogue provider. The local CRD counter is a demo balance only: 15 CRD are deducted once per successful demo reply, never on a failed request or an evaluation retry. Live usage is billed by the provider and does not alter this balance.

## Persistence and Supabase preparation

`src/types/database.types.ts` defines users, archetypes, conversations and messages, including timestamps, ownership, per-message telemetry and request status. Local storage serialises these exact row interfaces in a versioned envelope. Existing default and custom personas are imported once into the new format. Legacy keys (including reports and old settings) are left untouched, but their API credentials are never read or used by the new app. Remove the legacy `personaflow_llm_config` key manually if it contains old credentials you no longer need.

Corrupt/incompatible storage is not overwritten. Interrupted reply/evaluation requests become recoverable failed states on reload. Writes that fail due to storage quota are visibly reported; in-memory changes remain available in the current tab. In-flight updates target their original conversation even if navigation changes. Local persistence is intended for one active tab; cross-tab synchronisation is not implemented.

The interfaces are a preparation contract, not a deployed database or generated Supabase schema. Before the database swap: create migrations, map legacy persona IDs to UUIDs, generate types from the real schema, add foreign keys and owner-based RLS, replace the local user with Supabase Auth, move balances and request idempotency to the backend, then implement a repository adapter. Never trust client credit counts or client user IDs for authorisation.

## Checks

`npm test` runs regression tests for dialogue/evaluation ordering, evaluator failures, strict telemetry, API configuration gates, storage migration, interrupted-request recovery, and component interactions for persistence, thread switching and retries. Browser visual verification remains outstanding. `npm run build` type-checks browser/server code and builds production assets.

API references used for the provider adapters:

- https://ai.google.dev/api/generate-content
- https://developers.openai.com/api/reference/resources/chat
- https://vercel.com/docs/functions/runtimes/node-js
