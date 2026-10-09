import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import {
  configure,
  MemoryRepository,
  conversation,
  request,
  geminiResponse,
  jevResponse,
} from "./helpers.mjs";
import { synthesisFixture } from "./persona-fixtures.mjs";
import { runOperation } from "../server/turn.ts";
import { studio, snapshot } from "../server/studio.ts";
import { complete, completionText, geminiBody } from "../server/provider.ts";
import {
  SYNTHESIS_SCHEMA,
  SYNTHESIS_PROMPT,
  SYNTHESIS_OUTPUT_TOKENS,
  SYNTHESIS_JSON_CHARS,
  parseSynthesisedPersona,
} from "../server/persona-synthesis.ts";
import {
  buildPersonaReplyPrompt,
  replyGuidance,
} from "../server/persona-prompts.ts";
import {
  reserveFor,
  rates,
  totals,
  OUTPUT_RESERVE_TOKENS,
} from "../server/budget.ts";
import { jevBody, parseDecision } from "../server/jev.ts";
import {
  profileInputs,
  completePersonaDraft,
} from "../src/services/personaEditor.ts";
import { publicDraft } from "../src/api/publicData.ts";
beforeEach(configure);

test("20,000-character synthesis uses structured output and a separate budget, then replays without charge", async () => {
  const repo = new MemoryRepository();
  const req = { requestId: randomUUID(), description: "x".repeat(20000) };
  let calls = 0;
  const engines = {
    jev: async () => assert.fail("Synthesis must not call JEV"),
    gemini: async (body) => {
      calls++;
      assert.equal(body.contents[0].parts[0].text, req.description);
      assert.equal(body.systemInstruction.parts[0].text, SYNTHESIS_PROMPT);
      assert.deepEqual(
        body.generationConfig.responseJsonSchema,
        SYNTHESIS_SCHEMA,
      );
      assert.equal(body.generationConfig.responseMimeType, "application/json");
      assert.equal(body.generationConfig.maxOutputTokens, 6144);
      assert.equal(
        repo.state.operations[0].promptVersion,
        "persona-synthesis-v2",
      );
      assert.equal(
        repo.state.operations[0].reserve,
        reserveFor("gemini", rates("gemini")),
      );
      assert.equal(OUTPUT_RESERVE_TOKENS, 131072);
      return geminiResponse(JSON.stringify(synthesisFixture()));
    },
  };
  const first = await runOperation("archetype", req, repo, engines);
  const replay = await runOperation("archetype", req, repo, engines);
  assert.deepEqual(replay.result, first.result);
  assert.deepEqual(first.result, parseSynthesisedPersona(synthesisFixture()));
  assert.equal(calls, 1);
  assert.equal(totals(repo.state).spent, 4875000);
  assert.equal(totals(repo.state).reserved, 0);
  assert.equal(first.result.profile.decisionAuthority, undefined);
  assert.match(
    first.result.system_prompt,
    /Goals: Understand campaign performance/,
  );
  assert.doesNotMatch(
    first.result.system_prompt,
    /Provisional conversation guidance|evaluator scores/,
  );
  assert.equal(geminiBody("Reply", []).generationConfig.maxOutputTokens, 2048);
});

test("oversized descriptions fail before reservation or provider work", async () => {
  const repo = new MemoryRepository();
  const before = structuredClone(repo.state);
  await assert.rejects(
    runOperation(
      "archetype",
      {
        requestId: randomUUID(),
        description: "x".repeat(20001),
      },
      repo,
      { jev: async () => assert.fail(), gemini: async () => assert.fail() },
    ),
  );
  assert.deepEqual(repo.state, before);
});

test("generated fields, provenance and review notes are strictly validated", () => {
  const mutations = [
    (d) => {
      d.system_prompt = "Unrequested model instructions";
    },
    (d) => {
      d.profile.privateMetadata = { secret: "hidden" };
    },
    (d) => {
      delete d.profile.provenance;
    },
    (d) => {
      delete d.profile.provenance.goals;
    },
    (d) => {
      d.profile.provenance.goals = "seed";
    },
    (d) => {
      d.profile.provenance.currentTools = "provided";
    },
    (d) => {
      d.profile.background = "x".repeat(2401);
    },
    (d) => {
      d.profile.goals = Array(13).fill("A goal");
    },
    (d) => {
      d.profile.goals = ["x".repeat(501)];
    },
    (d) => {
      d.profile.goals = Array(12).fill("界".repeat(450));
    },
    (d) => {
      d.review.notes = ["x".repeat(401)];
    },
    (d) => {
      d.review.notes = Array(7).fill("Review this");
    },
    (d) => {
      d.review.identitySources.role = "legacy";
    },
    (d) => {
      d.review.hidden = "private";
    },
    (d) => {
      d.review.identitySources.hidden = "private";
    },
  ];
  for (const mutate of mutations) {
    const draft = synthesisFixture();
    mutate(draft);
    assert.throws(() => parseSynthesisedPersona(draft), mutate.toString());
  }
  const minimal = synthesisFixture();
  minimal.profile = { provenance: {} };
  assert.deepEqual(parseSynthesisedPersona(minimal).profile, {
    provenance: {},
  });
});

test("truncated or invalid synthesis retains usage and its version; explicit retry regenerates only Gemini", async () => {
  for (const invalid of [
    geminiResponse('{"name":'),
    { ...geminiResponse(), candidates: [{ finishReason: "MAX_TOKENS" }] },
    geminiResponse(JSON.stringify({ ...synthesisFixture(), hidden: "no" })),
  ]) {
    const repo = new MemoryRepository();
    const req = { requestId: randomUUID(), description: "A growth buyer" };
    await assert.rejects(
      runOperation("archetype", req, repo, {
        jev: async () => assert.fail(),
        gemini: async () => invalid,
      }),
      /usage was recorded/,
    );
    assert.equal(repo.state.operations[0].status, "failed");
    assert.equal(repo.state.operations[0].attempts[0].output, undefined);
    assert.equal(repo.state.operations[0].attempts[0].cost, 4875000);
    assert.equal(totals(repo.state).reserved, 0);
    const out = await runOperation("archetype", req, repo, {
      jev: async () => assert.fail(),
      gemini: async (body) => {
        assert.equal(body.generationConfig.maxOutputTokens, 6144);
        return geminiResponse(JSON.stringify(synthesisFixture()));
      },
    });
    assert.equal(out.result.profileSchemaVersion, 2);
    assert.equal(
      repo.state.operations[0].promptVersion,
      "persona-synthesis-v2",
    );
    assert.equal(repo.state.operations[0].attempts.length, 2);
    assert.equal(totals(repo.state).spent, 9750000);
  }
});

test("structured JSON has its own raw response limit while the saved profile remains bounded", async () => {
  const text = " ".repeat(17000) + JSON.stringify(synthesisFixture());
  assert.throws(() => completionText(geminiResponse(text)));
  const repo = new MemoryRepository();
  const out = await runOperation(
    "archetype",
    { requestId: randomUUID(), description: "A growth buyer" },
    repo,
    {
      jev: async () => assert.fail(),
      gemini: async () => geminiResponse(text),
    },
  );
  assert.deepEqual(out.result.profile, synthesisFixture().profile);
  assert.throws(() =>
    completionText(
      geminiResponse("x".repeat(SYNTHESIS_JSON_CHARS + 1)),
      SYNTHESIS_JSON_CHARS,
    ),
  );
});

test("official token preflight includes the structured schema and still blocks over-limit generation", async () => {
  const body = geminiBody(
    SYNTHESIS_PROMPT,
    [{ role: "user", content: "Buyer" }],
    true,
    {
      maxOutputTokens: SYNTHESIS_OUTPUT_TOKENS,
      responseJsonSchema: SYNTHESIS_SCHEMA,
    },
  );
  const original = globalThis.fetch;
  let count = 32768,
    generations = 0;
  globalThis.fetch = async (url, options) => {
    const sent = JSON.parse(options.body);
    if (url.endsWith(":countTokens")) {
      assert.deepEqual(sent.generateContentRequest, {
        model: "models/gemini-3.8-flash",
        ...body,
      });
      return Response.json({ totalTokens: count });
    }
    assert.ok(url.endsWith(":generateContent"));
    assert.deepEqual(sent, body);
    generations++;
    return Response.json(geminiResponse(JSON.stringify(synthesisFixture())));
  };
  try {
    await complete(body);
    count++;
    await assert.rejects(complete(body), (e) => e.status === 413);
    assert.equal(generations, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("new dialogue uses edited structured fields in both engines without forwarding private metadata or raw scores to Gemini", async () => {
  const repo = new MemoryRepository();
  const original = parseSynthesisedPersona(synthesisFixture());
  const inputs = profileInputs(original.profile);
  inputs.goals = "Understand retention by campaign";
  const draft = completePersonaDraft(
    { ...original, system_prompt: "Old goal: reduce acquisition cost." },
    inputs,
    original.profile,
  );
  Object.assign(repo.state.data.archetypes[0], draft);
  const cid = await conversation(repo),
    req = request(cid),
    c = repo.state.conversations[0];
  const secret = "HIDDEN_PROFILE_SENTINEL";
  c.archetype.privateMetadata = secret;
  c.archetype.profile.privateMetadata = secret;
  c.archetype.synthesisReview.privateMetadata = secret;
  repo.state.personaPrivateByRevision = {
    private: { latentMotivationProfile: secret },
  };
  await runOperation("dialogue", req, repo, {
    jev: async (body) => {
      assert.deepEqual(body.state.archetype.profile.goals, [inputs.goals]);
      assert.equal(JSON.stringify(body).includes(secret), false);
      return jevResponse();
    },
    gemini: async (body) => {
      const prompt = body.systemInstruction.parts[0].text;
      assert.match(prompt, /Understand retention by campaign/);
      assert.match(prompt, /Profile fields take precedence/);
      assert.match(prompt, /Example phrases illustrate voice/);
      assert.match(prompt, /not instructions for you to comply/);
      assert.match(
        prompt,
        /do not reopen them without new contradictory evidence/,
      );
      assert.match(prompt, /one to four sentences/);
      assert.match(prompt, /Ask one focused question only when/);
      assert.match(prompt, /seller claims, not verified facts/);
      assert.doesNotMatch(
        prompt,
        /readinessIndex|readinessConfidence|responseAction|HIDDEN_PROFILE_SENTINEL/,
      );
      assert.equal(body.generationConfig.maxOutputTokens, 2048);
      return geminiResponse(
        "Yes, let's try one campaign and see what it tells us.",
      );
    },
  });
  assert.equal(c.promptVersion, "persona-voice-v2");
  assert.equal(repo.state.operations[0].promptVersion, "persona-voice-v2");
  assert.equal(snapshot(repo.state).conversations[0].promptVersion, undefined);
});

test("compact guidance keeps the latest grounded concern and never turns seller reassurance into buyer resolution", () => {
  const history = [
    { id: "b1", role: "assistant", content: "I need an example first." },
    { id: "s1", role: "user", content: "That proves it works." },
    {
      id: "b2",
      role: "assistant",
      content: "That answers the reporting question. I'll try a short demo.",
    },
  ];
  const state = {
    friction: "none",
    stance: "conditional_agreement",
    readinessIndex: 99,
    remainingConditions: ["Scope invented by seller"],
    hidden: "NO_FORWARD",
    concerns: [
      { category: "credibility", status: "active", turnId: "b1" },
      {
        category: "credibility",
        status: "resolved",
        turnId: "b2",
        evidenceTurnId: "b2",
      },
      {
        category: "cost",
        status: "resolved",
        turnId: "s1",
        evidenceTurnId: "s1",
      },
    ],
  };
  const guidance = replyGuidance(state, history);
  assert.deepEqual(guidance.concerns, [
    {
      topic: "Credibility and supporting evidence",
      status: "resolved",
      buyerExcerpt: history[2].content,
    },
  ]);
  assert.deepEqual(guidance.possibleConditions, []);
  assert.doesNotMatch(
    JSON.stringify(guidance),
    /readinessIndex|NO_FORWARD|That proves/,
  );
});

test("legacy conversations retain their prompt and context, and continuations inherit the source version", async () => {
  for (const version of [undefined, "persona-voice-v1", "persona-voice-v2"]) {
    const repo = new MemoryRepository(),
      cid = await conversation(repo);
    const c = repo.state.conversations[0];
    if (version) c.promptVersion = version;
    else delete c.promptVersion;
    const state = parseDecision(
      jevResponse(),
      c,
      "turn",
      "pre_reply",
      [],
    ).state;
    const prompt = buildPersonaReplyPrompt(c, state, []);
    if (version !== "persona-voice-v2") {
      assert.ok(
        prompt.includes(`Persona definition: ${c.archetype.system_prompt}`),
      );
      assert.ok(prompt.includes(JSON.stringify(state)));
      assert.equal(jevBody(c, [], "Pitch").state.archetype.profile, undefined);
    } else {
      assert.doesNotMatch(prompt, /readinessIndex/);
      assert.deepEqual(
        jevBody(c, [], "Pitch").state.archetype.profile,
        c.archetype.profile,
      );
    }
    const nextId = randomUUID();
    await studio(
      {
        action: "continue_conversation",
        id: nextId,
        sourceId: cid,
        summary: "A reviewable continuation.",
      },
      repo,
    );
    const next = repo.state.conversations.find((v) => v.id === nextId);
    assert.equal(next.promptVersion, version);
    assert.deepEqual(next.archetype, c.archetype);
    await runOperation("dialogue", request(nextId), repo, {
      jev: async () => jevResponse(),
      gemini: async (body) => {
        assert.equal(
          body.systemInstruction.parts[0].text.includes("readinessIndex"),
          version !== "persona-voice-v2",
        );
        return geminiResponse();
      },
    });
    assert.equal(
      repo.state.operations[0].promptVersion,
      version ?? "persona-voice-v1",
    );
  }
});

test("legacy failed synthesis retries and cached receipts keep the old parser and response budget", async () => {
  for (const cached of [false, true]) {
    const repo = new MemoryRepository();
    const req = { requestId: randomUUID(), description: "An older request" };
    const request = { description: req.description };
    const legacy = {
      name: "Pat",
      role: "Buyer",
      budget_sensitivity: "High",
      system_prompt: "You are Pat.",
    };
    repo.state.operations.push({
      id: req.requestId,
      kind: "archetype",
      request,
      hash: createHash("sha256")
        .update(JSON.stringify({ kind: "archetype", request }))
        .digest("hex"),
      status: "failed",
      startedAt: new Date().toISOString(),
      reserve: 0,
      attempts: cached
        ? [
            {
              id: randomUUID(),
              provider: "gemini",
              model: "gemini-3.8-flash",
              status: "complete",
              reserve: 0,
              startedAt: new Date().toISOString(),
              rates: rates("gemini"),
              cost: 4875000,
              output: geminiResponse(JSON.stringify(legacy)),
            },
          ]
        : [],
    });
    const out = await runOperation("archetype", req, repo, {
      jev: async () => assert.fail(),
      gemini: async (body) => {
        assert.equal(cached, false);
        assert.equal(body.generationConfig.maxOutputTokens, 2048);
        assert.equal(body.generationConfig.responseJsonSchema, undefined);
        assert.match(
          body.systemInstruction.parts[0].text,
          /and system_prompt\. No other fields/,
        );
        return geminiResponse(JSON.stringify(legacy));
      },
    });
    assert.deepEqual(out.result, legacy);
    assert.equal(repo.state.operations[0].promptVersion, undefined);
    assert.equal(totals(repo.state).spent, 4875000);
  }
});

test("unsupported conversation versions fail before paid attempts, and review metadata is public only through its allowlist", async () => {
  const repo = new MemoryRepository(),
    cid = await conversation(repo);
  repo.state.conversations[0].promptVersion = "future-version";
  await assert.rejects(
    runOperation("dialogue", request(cid), repo, {
      jev: async () => assert.fail(),
      gemini: async () => assert.fail(),
    }),
    /unsupported prompt version/,
  );
  assert.equal(repo.state.operations.length, 0);
  const draft = parseSynthesisedPersona(synthesisFixture());
  draft.synthesisReview.secret = "NO_LEAK";
  draft.synthesisReview.identitySources.secret = "NO_LEAK";
  assert.equal(JSON.stringify(publicDraft(draft)).includes("NO_LEAK"), false);
});
