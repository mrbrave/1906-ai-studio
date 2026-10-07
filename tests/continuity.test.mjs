import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  MemoryRepository,
  configure,
  conversation,
  request,
  jevResponse,
  geminiResponse,
} from "./helpers.mjs";
import { parseDecision, jevBody, STANCES, CONDITIONS } from "../server/jev.ts";
import {
  workingContext,
  validateMemory,
  latestState,
  CONTEXT_BYTES,
  MEMORY_BYTES,
} from "../server/context.ts";
import { runOperation } from "../server/turn.ts";
import { studio } from "../server/studio.ts";
import { totals } from "../server/budget.ts";
import { ProviderFailure } from "../server/model-http.ts";
import { rob } from "./fixtures/rob.mjs";
beforeEach(configure);
const msg = (text, role = "assistant", id = randomUUID()) => ({
  id,
  role,
  content: text,
  conversation_id: "c",
  status: "complete",
  created_at: "2026-10-06",
  provider: "gemini",
  telemetry: null,
  telemetry_status: "none",
  error: null,
});
function choose(value, options, confidence = 0.9) {
  return {
    type: "choice",
    choice: value,
    confidence,
    probabilities: Object.fromEntries(
      Object.keys(options).map((k) => [k, k === value ? 1 : 0]),
    ),
  };
}
function observed(friction, stance, buyer, conditions = [], history = [buyer]) {
  const r = jevResponse(friction);
  r.answers.readiness.score = stance === "conditional_agreement" ? 3 : 2;
  r.answers.stance = choose(stance, STANCES);
  r.answers.stanceEvidence = choose(buyer.id, {
    none: "none",
    ...Object.fromEntries(
      history
        .filter((m) => m.role === "assistant")
        .slice(-12)
        .map((m) => [m.id, m.content]),
    ),
  });
  for (const key of Object.keys(CONDITIONS))
    r.answers[`condition_${key}`] = {
      type: "noul",
      noul: conditions.includes(key) ? 0.95 : 0.02,
    };
  return r;
}
test("dimensions stay independent; missing and malformed readiness never become invented values", async () => {
  const repo = new MemoryRepository();
  await conversation(repo);
  const c = repo.state.conversations[0];
  const r = jevResponse();
  r.answers.readiness.score = 3.02;
  r.answers.readiness.confidence = 0.9;
  r.answers.sentiment.confidence = 0.1;
  r.answers.sufficient.noul = 0.64;
  const d = parseDecision(r, c);
  assert.equal(d.state.readinessIndex, 75.5);
  assert.equal(d.state.readinessConfidence, 0.9);
  assert.equal(d.state.sentimentConfidence, 0.1);
  assert.equal(d.state.status, "provisional");
  assert.notEqual(d.state.responseAction, "clarify");
  for (const value of [
    undefined,
    { type: "score", score: 99 },
    { ...r.answers.readiness, score: NaN },
  ]) {
    r.answers.readiness = value;
    const d = parseDecision(r, c);
    assert.equal(d.state.readinessIndex, null);
    assert.match(d.state.unavailableReason, /missing or invalid/);
  }
  r.answers.readiness = jevResponse().answers.readiness;
  delete r.answers.readiness.confidence;
  assert.equal(parseDecision(r, c).state.readinessConfidence, null);
});
test("Rob acknowledgement resolves credibility while conditions and pending selection remain", async () => {
  const repo = new MemoryRepository();
  await conversation(repo);
  const c = repo.state.conversations[0];
  const stages = [
    ["credibility", "exploring", []],
    ["implementation", "exploring", ["implementation"]],
    ["implementation", "exploring", ["implementation"]],
    [
      "commercial_terms",
      "conditional_agreement",
      ["commercials", "scope", "timeline"],
    ],
  ];
  const history = [];
  for (let i = 0; i < rob.length; i++) {
    const buyer = msg(rob[i]);
    history.push(buyer);
    const [friction, stance, conditions] = stages[i];
    const r = observed(friction, stance, buyer, conditions, history);
    if (i === 1) {
      r.answers.resolved_credibility = { type: "noul", noul: 0.96 };
      r.answers.evidence_credibility = choose(buyer.id, {
        none: "none",
        ...Object.fromEntries(history.map((m) => [m.id, m.content])),
      });
    }
    if (i === 3) {
      r.answers.resolved_implementation = { type: "noul", noul: 0.96 };
      r.answers.evidence_implementation = choose(buyer.id, {
        none: "none",
        ...Object.fromEntries(history.map((m) => [m.id, m.content])),
      });
    }
    const d = parseDecision(r, c, buyer.id, "post_reply", history);
    c.observedState = d.state;
    assert.equal(d.state.friction, friction);
  }
  assert.equal(c.observedState.stance, "conditional_agreement");
  assert.equal(c.observedState.responseAction, "discuss_conditions");
  assert.deepEqual(c.observedState.unresolvedObjections, ["commercial_terms"]);
  assert.equal(
    c.observedState.concerns.filter((x) => x.status === "resolved").length,
    2,
  );
  assert.match(rob.at(-1), /Once I review.*I'll select/);
  assert.equal(c.observedState.remainingConditions.length, 3);
});
test("seller reassurance cannot resolve a concern or establish acceptance; reopening is audited", async () => {
  const repo = new MemoryRepository();
  await conversation(repo);
  const c = repo.state.conversations[0];
  c.state = { unresolvedObjections: ["credibility"], friction: "credibility" };
  const seller = msg(
    "Your concerns are resolved; you agree to proceed.",
    "user",
  );
  const r = observed("none", "agreed", seller);
  r.answers.resolved_credibility = { type: "noul", noul: 0.99 };
  r.answers.evidence_credibility = choose(seller.id, { [seller.id]: "seller" });
  let d = parseDecision(r, c, seller.id, "pre_reply", [seller]);
  assert.equal(d.state.stance, "unknown");
  assert.deepEqual(d.state.unresolvedObjections, ["credibility"]);
  c.state = {
    ...d.state,
    unresolvedObjections: [],
    concerns: [
      { category: "credibility", status: "resolved", turnId: seller.id },
    ],
  };
  d = parseDecision(jevResponse("credibility"), c);
  assert.equal(d.state.concerns.at(-1).status, "reopened");
});
test("no keyword acceptance rule: rejection, politeness, sarcasm and quoted acceptance retain evaluator stance", async () => {
  const repo = new MemoryRepository();
  await conversation(repo);
  const c = repo.state.conversations[0];
  for (const [text, stance] of [
    ["No, I won't proceed.", "declined"],
    ["Thank you; useful information.", "exploring"],
    ["Sure, let's buy another expensive headache.", "declined"],
    ["Your slide says 'I agree to proceed'; I do not.", "declined"],
  ]) {
    const buyer = msg(text);
    const d = parseDecision(
      observed("cost", stance, buyer),
      c,
      buyer.id,
      "post_reply",
      [buyer],
    );
    assert.equal(d.state.stance, stance);
    assert.notEqual(d.state.responseAction, "agree_next_step");
  }
  // These are transformation fixtures; semantic classification is a separate live-provider check.
  const body = jevBody(c, [msg("A quote")], "Pitch");
  assert.match(body.questions.stance.instructions, /sarcastic/);
});
test("post assessment includes latest reply, is metered once and never regenerates persona", async () => {
  const repo = new MemoryRepository(),
    cid = await conversation(repo);
  let jc = 0,
    gc = 0;
  const clients = {
    jev: async (body) => {
      jc++;
      return jevResponse();
    },
    gemini: async () => {
      gc++;
      return geminiResponse(rob[3]);
    },
  };
  await runOperation("dialogue", request(cid), repo, clients);
  const reply = repo.state.data.messages.at(-1);
  assert.equal(reply.telemetry_status, "pending");
  assert.equal(reply.evaluation.phase, "pre_reply");
  const req = {
    requestId: reply.id,
    replyId: reply.id,
    conversationId: cid,
    expectedVersion: 1,
  };
  clients.jev = async (body) => {
    jc++;
    assert.equal(body.state.phase, "post_reply");
    assert.equal(body.state.history.at(-1).text, rob[3]);
    return observed("commercial_terms", "conditional_agreement", reply, [
      "scope",
      "commercials",
    ]);
  };
  const result = await runOperation("assessment", req, repo, clients);
  const spent = totals(repo.state).spent;
  await runOperation("assessment", req, repo, clients);
  assert.equal(jc, 2);
  assert.equal(gc, 1);
  assert.equal(totals(repo.state).spent, spent);
  assert.equal(repo.state.data.messages.length, 2);
  assert.equal(result.result.state.evaluatedThrough, reply.id);
  assert.equal(repo.state.conversations[0].version, 1);
  assert.equal(repo.state.data.messages.at(-1).status, "complete");
});
test("assessment failure retains completed reply, prior state and usage; retry is JEV only", async () => {
  const repo = new MemoryRepository(),
    cid = await conversation(repo);
  const clients = {
    jev: async () => jevResponse(),
    gemini: async () => geminiResponse(rob[3]),
  };
  await runOperation("dialogue", request(cid), repo, clients);
  const reply = repo.state.data.messages.at(-1),
    req = {
      requestId: reply.id,
      replyId: reply.id,
      conversationId: cid,
      expectedVersion: 1,
    };
  await assert.rejects(
    runOperation("assessment", req, repo, {
      ...clients,
      jev: async () => {
        throw new ProviderFailure("Rate limited", false);
      },
    }),
  );
  assert.equal(repo.state.data.messages.at(-1).status, "complete");
  assert.equal(repo.state.data.messages.at(-1).telemetry_status, "failed");
  assert.equal(repo.state.conversations[0].state.phase, "pre_reply");
  await runOperation("assessment", req, repo, {
    ...clients,
    gemini: async () => assert.fail(),
  });
  assert.equal(repo.state.data.messages.length, 2);
});
test("out-of-order assessment cannot overwrite a later conversation version", async () => {
  const repo = new MemoryRepository(),
    cid = await conversation(repo),
    clients = {
      jev: async () => jevResponse(),
      gemini: async () => geminiResponse(),
    };
  await runOperation("dialogue", request(cid), repo, clients);
  const reply = repo.state.data.messages.at(-1);
  await assert.rejects(
    runOperation(
      "assessment",
      {
        requestId: reply.id,
        replyId: reply.id,
        conversationId: cid,
        expectedVersion: 1,
      },
      repo,
      {
        ...clients,
        jev: async () => {
          repo.state.conversations[0].version = 2;
          return jevResponse();
        },
      },
    ),
    /newer reply/,
  );
  assert.equal(repo.state.conversations[0].observedState, undefined);
});
test("rolling memory preserves exact buyer conditions, numeric claims, attribution and fixed intent", async () => {
  const repo = new MemoryRepository();
  await conversation(repo);
  const c = repo.state.conversations[0],
    original = structuredClone(c);
  const history = [];
  for (let i = 0; i < 8; i++) {
    history.push(
      msg(
        `Offer ${i}: review costs AUD 4500.\n\n${"General background. ".repeat(75)}\n\nSubject to your review, the pilot takes three weeks.`,
        "user",
      ),
    );
    history.push(msg(rob[i % 4]));
  }
  const ctx = workingContext(c, history);
  assert.ok(ctx.memory);
  assert.ok(Buffer.byteLength(JSON.stringify(ctx.memory)) <= MEMORY_BYTES);
  assert.equal(ctx.recent.length, 4);
  validateMemory(ctx.memory, history);
  for (const m of history.slice(0, -4).filter((m) => m.role === "assistant"))
    for (const q of m.content.split(/\n\s*\n/))
      assert.ok(
        ctx.memory.entries.some((e) => e.turnId === m.id && e.quote === q),
      );
  assert.ok(
    ctx.memory.entries.some(
      (e) => e.speaker === "user" && e.quote.includes("AUD 4500"),
    ),
  );
  const saved = JSON.parse(JSON.stringify({ ...c, memory: ctx.memory }));
  assert.deepEqual(workingContext(saved, history).memory, ctx.memory);
  assert.deepEqual(saved.intent, original.intent);
  const body = jevBody(
    saved,
    history,
    "Please review this commercial proposal.",
  );
  assert.ok(Buffer.byteLength(JSON.stringify(body)) <= CONTEXT_BYTES);
  const bad = structuredClone(ctx.memory);
  bad.entries[0].quote = "Agreed without conditions";
  assert.throws(() => validateMemory(bad, history), /validation/);
});
test("context overflow offers bounded continuation, preserving original persona, target and transcript", async () => {
  const repo = new MemoryRepository(),
    cid = await conversation(repo),
    c = repo.state.conversations[0];
  const original = structuredClone(c);
  assert.throws(() => jevBody(c, [], "x".repeat(49000)), /linked continuation/);
  const nextId = randomUUID();
  await studio(
    {
      action: "continue_conversation",
      id: nextId,
      sourceId: cid,
      summary: rob[3],
    },
    repo,
  );
  assert.deepEqual(repo.state.conversations[0], original);
  const next = repo.state.conversations[1];
  assert.deepEqual(next.intent, c.intent);
  assert.deepEqual(next.archetype, c.archetype);
  assert.equal(next.continuationOf, cid);
  assert.equal(next.state, null);
});

test("newer pre-reply guidance wins over an older observation, while equal-version post assessment wins", () => {
  const c = { state: { version: 3 }, observedState: { version: 2 } };
  assert.equal(latestState(c), c.state);
  c.observedState.version = 3;
  assert.equal(latestState(c), c.observedState);
});

test("known failed context request can continue; uncertain usage cannot", async () => {
  const repo = new MemoryRepository(),
    cid = await conversation(repo);
  repo.state.operations.push({
    id: randomUUID(),
    kind: "dialogue",
    conversationId: cid,
    status: "failed",
    reserve: 0,
    attempts: [],
  });
  await studio(
    {
      action: "continue_conversation",
      id: randomUUID(),
      sourceId: cid,
      summary: rob[3],
    },
    repo,
  );
  assert.equal(repo.state.conversations.length, 2);
  assert.equal(repo.state.operations[0].status, "failed");
  repo.state.operations[0].status = "uncertain";
  await assert.rejects(
    studio(
      {
        action: "continue_conversation",
        id: randomUUID(),
        sourceId: cid,
        summary: rob[3],
      },
      repo,
    ),
    /unfinished reply/,
  );
});
