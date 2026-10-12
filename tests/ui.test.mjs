import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React from "react";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "localStorage",
  "sessionStorage",
  "MutationObserver",
])
  globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
HTMLElement.prototype.scrollIntoView = () => {};
const { render, screen, fireEvent, waitFor, cleanup, act, within } =
  await import("@testing-library/react");
const { default: App } = await import("../src/App.tsx");
const { STORAGE_KEY } = await import("../src/services/storageService.ts");
const reply = "Before I commit, I need to understand";
const click = (name) => fireEvent.click(screen.getByRole("button", { name }));
const change = (label, value) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const telemetry = {
  intentScore: 81,
  sentiment: "Receptive",
  activeFriction: "Proof needed",
  suggestedTweak: "Add a case study.",
};

test("insights distinguish v3 supporting evidence from grounding and label the old field honestly", async () => {
  const { TelemetryDrawer } =
    await import("../src/components/TelemetryDrawer.tsx");
  const decision = {
    rubricVersion: "1906-decision-v3",
    phase: "post_reply",
    evaluatedThrough: "reply",
    version: 1,
    readinessIndex: 75,
    readinessConfidence: 0.8,
    status: "complete",
    sentiment: "positive",
    friction: "credibility",
    evidenceStrength: 2,
    assessmentGrounding: 0.9,
    remainingConditions: [],
    concerns: [],
    dimensions: {
      evidence_sufficiency: { value: 2, confidence: 0.8, status: "complete" },
    },
    privateEvaluation: { profileRelevance: 0.78, taxonomy: "PRIVATE_SENTINEL" },
  };
  const props = {
    open: true,
    busy: false,
    onClose() {},
    onRetry() {},
    decision,
    message: {
      id: "reply",
      provider: "gemini",
      telemetry_status: "complete",
      telemetry,
    },
  };
  try {
    render(React.createElement(TelemetryDrawer, props));
    assert.ok(screen.getByText("Supporting evidence for this decision"));
    assert.ok(screen.getByText("2/4 · evidence rubric"));
    assert.ok(screen.getByText("Assessment grounding"));
    assert.ok(screen.getByText("90% · evaluator estimate"));
    assert.equal(document.body.textContent.includes("PRIVATE_SENTINEL"), false);
    cleanup();
    render(
      React.createElement(TelemetryDrawer, {
        ...props,
        decision: {
          ...decision,
          rubricVersion: "1906-decision-v2",
          dimensions: undefined,
          evidenceStrength: undefined,
          assessmentGrounding: undefined,
          evidenceSufficiency: 0.9,
        },
      }),
    );
    assert.ok(screen.getByText("Legacy assessment grounding"));
    assert.equal(
      screen.queryByText("Supporting evidence for this decision"),
      null,
    );
    assert.ok(screen.getByText("90% · evaluator estimate"));
  } finally {
    cleanup();
  }
});

test("rich synthesis stays a reviewable draft and preserves or updates field sources through save and reopen", async () => {
  const { ArchetypeSynthesizer } =
    await import("../src/components/ArchetypeSynthesizer.tsx");
  const { synthesisFixture } = await import("./persona-fixtures.mjs");
  const { parseSynthesisedPersona } =
    await import("../server/persona-synthesis.ts");
  const result = parseSynthesisedPersona(synthesisFixture());
  const original = globalThis.fetch;
  let saved,
    calls = 0;
  globalThis.fetch = async (url, opts) => {
    assert.equal(url, "/api/archetype");
    assert.equal(JSON.parse(opts.body).description.length, 20000);
    calls++;
    return Response.json({ result });
  };
  try {
    render(
      React.createElement(ArchetypeSynthesizer, {
        provider: "gemini",
        onBack() {},
        onSave(d) {
          saved = d;
        },
      }),
    );
    change("Target buyer description", "x".repeat(20000));
    assert.equal(
      screen.getByRole("button", { name: "Generate draft" }).disabled,
      false,
    );
    click("Generate draft");
    await screen.findByText(/Draft generated/);
    assert.equal(saved, undefined);
    assert.equal(calls, 1);
    assert.ok(screen.getByRole("region", { name: "Draft review" }));
    assert.ok(
      screen.getByText(
        "Current tools and internal approval requirements are unknown.",
      ),
    );
    const voice = screen.getByLabelText("Communication style");
    assert.match(voice.parentElement.textContent, /AI suggestion/);
    assert.equal(
      screen.getByLabelText("Current tools and alternatives").value,
      "",
    );
    assert.equal(
      screen.getByLabelText(/Custom role-play instructions/).value,
      "",
    );
    change("Communication style", "Warm, brief and informal.");
    assert.match(voice.parentElement.textContent, /Provided/);
    fireEvent.click(screen.getByRole("radio", { name: "Low" }));
    click("Save persona");
    await waitFor(() => assert.ok(saved));
    assert.equal(saved.profile.provenance.communicationStyle, "provided");
    assert.equal(saved.profile.provenance.examplePhrases, "inferred");
    assert.equal(
      saved.synthesisReview.identitySources.budget_sensitivity,
      "provided",
    );
    assert.equal(saved.profile.currentTools, undefined);
    assert.match(saved.system_prompt, /Warm, brief and informal/);
    assert.deepEqual(saved.synthesisReview.notes, result.synthesisReview.notes);
    cleanup();
    render(
      React.createElement(ArchetypeSynthesizer, {
        provider: "gemini",
        mode: "edit",
        initialDraft: saved,
        onBack() {},
        onSave() {},
      }),
    );
    assert.equal(
      screen.getByLabelText("Communication style").value,
      "Warm, brief and informal.",
    );
    assert.match(
      screen.getByLabelText("Example phrases").parentElement.textContent,
      /AI suggestion/,
    );
    assert.ok(
      screen.getByText(
        "Current tools and internal approval requirements are unknown.",
      ),
    );
  } finally {
    cleanup();
    globalThis.fetch = original;
  }
});

test("draft survives a preflight rejection and reload, can be edited, and an ambiguous response replays once", async () => {
  const {
    MemoryRepository,
    configure,
    conversation,
    jevResponse,
    geminiResponse,
  } = await import("./helpers.mjs");
  const { studio } = await import("../server/studio.ts");
  const { runOperation } = await import("../server/turn.ts");
  configure();
  sessionStorage.clear();
  localStorage.clear();
  window.location.hash = "#private";
  const repo = new MemoryRepository();
  await conversation(repo);
  const original = globalThis.fetch;
  let reject = true,
    loseResponse = true,
    generations = 0;
  const ids = [];
  globalThis.fetch = async (url, opts) => {
    const b = JSON.parse(opts.body);
    if (url === "/api/studio") return Response.json(await studio(b, repo));
    if (url === "/api/dialogue") {
      ids.push(b.requestId);
      if (reject)
        return Response.json(
          { error: "The bounded working context is full." },
          { status: 413 },
        );
    }
    const result = await runOperation(
      url === "/api/assessment" ? "assessment" : "dialogue",
      b,
      repo,
      {
        jev: async () => jevResponse(),
        gemini: async () => {
          generations++;
          return geminiResponse(
            "Commercial proposal received, subject to scope review.",
          );
        },
      },
    );
    if (url === "/api/dialogue" && loseResponse) {
      loseResponse = false;
      throw new TypeError("Network connection lost");
    }
    return Response.json(result);
  };
  async function open() {
    render(React.createElement(App));
    change("Studio access code", "private-test-access-code-32-characters");
    click("Open Studio");
    await screen.findByLabelText("Your message");
  }
  try {
    await open();
    const exact =
      "  Commercial proposal\n\nAUD 4,500 + GST; subject to review.  ";
    change("Your message", exact);
    click("Send message");
    await screen.findByText("The bounded working context is full.");
    assert.equal(screen.getByLabelText("Your message").value, exact);
    cleanup();
    await open();
    assert.equal(screen.getByLabelText("Your message").value, exact);
    const shorter = "Please review the scope before accepting.";
    change("Your message", shorter);
    reject = false;
    click("Send message");
    await screen.findByText("Network connection lost");
    await screen.findByText(
      "Commercial proposal received, subject to scope review.",
    );
    assert.notEqual(ids[0], ids[1]);
    assert.equal(generations, 1);
    assert.equal(repo.state.data.messages.length, 2);
    assert.equal(screen.getByLabelText("Your message").value, "");
    click("Buyer insights");
    click("Update insights");
    await screen.findByText("Latest reply assessed");
    assert.equal(generations, 1);
    assert.equal(repo.state.data.messages.length, 2);
  } finally {
    cleanup();
    sessionStorage.clear();
    globalThis.fetch = original;
    window.location.hash = "";
  }
});

test("over-limit pasted synthesis and dialogue text remains visible and cannot be submitted", async () => {
  const { ChatWorkspace } = await import("../src/components/ChatWorkspace.tsx");
  const { ArchetypeSynthesizer } =
    await import("../src/components/ArchetypeSynthesizer.tsx");
  const { MemoryRepository } = await import("./helpers.mjs");
  let sent = 0;
  render(
    React.createElement(ChatWorkspace, {
      archetype: new MemoryRepository().state.data.archetypes[0],
      messages: [],
      provider: "gemini",
      busy: false,
      pendingHere: false,
      analyticsOpen: false,
      onAnalytics() {},
      onSend() {
        sent++;
      },
      onRetry() {},
      onMenu() {},
    }),
  );
  change("Your message", "x".repeat(4001));
  assert.equal(screen.getByLabelText("Your message").value.length, 4001);
  assert.equal(
    screen.getByRole("button", { name: "Send message" }).disabled,
    true,
  );
  fireEvent.keyDown(screen.getByLabelText("Your message"), {
    key: "Enter",
  });
  assert.equal(sent, 0);
  cleanup();
  render(
    React.createElement(ArchetypeSynthesizer, {
      provider: "gemini",
      onBack() {},
      onSave() {},
    }),
  );
  const input = screen.getByRole("textbox", {
    name: "Target buyer description",
  });
  fireEvent.change(input, { target: { value: "x".repeat(20001) } });
  assert.equal(input.value.length, 20001);
  assert.equal(
    screen.getByRole("button", { name: "Generate draft" }).disabled,
    true,
  );
  cleanup();
});

test("offline demo keeps its history and illustrative credits", async () => {
  localStorage.clear();
  window.location.hash = "";
  try {
    render(React.createElement(App));
    click(/Alex Vance/);
    change("Your message", "A measurable integration pitch");
    click("Send message");
    await screen.findByText(new RegExp(reply));
    click("Buyer insights");
    await screen.findByText("Sceptical · demo fixture");
    assert.equal(
      JSON.parse(localStorage.getItem(STORAGE_KEY)).users[0].compute_credits,
      4275,
    );
    cleanup();
    render(React.createElement(App));
    await screen.findByText(new RegExp(reply));
  } finally {
    cleanup();
  }
});

test("corrupt saved data presents a non-destructive error", () => {
  localStorage.setItem(STORAGE_KEY, "{broken");
  render(React.createElement(App));
  assert.match(
    screen.getByRole("alert").textContent,
    /has not been overwritten/,
  );
  assert.equal(localStorage.getItem(STORAGE_KEY), "{broken");
  cleanup();
  localStorage.clear();
});

test("private Studio unlocks, fixes intent, shows percentage and preserves request ID after failure", async () => {
  const { MemoryRepository, configure, geminiResponse, jevResponse } =
    await import("./helpers.mjs");
  const { studio } = await import("../server/studio.ts");
  const { runOperation } = await import("../server/turn.ts");
  const { ProviderFailure } = await import("../server/model-http.ts");
  configure();
  const repo = new MemoryRepository(),
    original = globalThis.fetch;
  let fail = true;
  const ids = [];
  window.location.hash = "#private";
  localStorage.clear();
  globalThis.fetch = async (url, opts) => {
    assert.equal(
      opts.headers.Authorization,
      "Bearer private-test-access-code-32-characters",
    );
    const b = JSON.parse(opts.body);
    try {
      if (url === "/api/studio") return Response.json(await studio(b, repo));
      ids.push(b.requestId);
      const result = await runOperation(
        url === "/api/assessment" ? "assessment" : "dialogue",
        b,
        repo,
        {
          jev: async () => jevResponse(),
          gemini: async () => {
            if (fail)
              throw new ProviderFailure(
                "Provider temporarily unavailable",
                false,
              );
            return geminiResponse("I need evidence before progressing.");
          },
        },
      );
      return Response.json(result);
    } catch (e) {
      return Response.json({ error: e.message }, { status: e.status ?? 500 });
    }
  };
  try {
    render(React.createElement(App));
    change("Studio access code", "private-test-access-code-32-characters");
    click("Open Studio");
    await screen.findByRole("heading", { name: "New conversation" });
    assert.match(screen.getByText(/Usage remaining/).textContent, /100%/);
    assert.equal(screen.queryByText(/CRD/), null);
    change("What are you offering?", "Leadership coaching programme");
    change("What next step are you testing?", "Agree to a discovery workshop");
    click("Start conversation");
    await screen.findByText("Agree to a discovery workshop");
    change("Your message", "A six-week implementation");
    click("Send message");
    await screen.findAllByText("Provider temporarily unavailable");
    fail = false;
    click("Retry reply");
    await screen.findByText("I need evidence before progressing.");
    assert.equal(ids[0], ids[1]);
    await waitFor(() => assert.equal(repo.state.operations.length, 2));
    assert.equal(
      repo.state.operations[0].attempts.filter((a) => a.provider === "jev")
        .length,
      1,
    );
    assert.equal(localStorage.getItem(STORAGE_KEY), null);
    click("Buyer insights");
    await screen.findByText("Decision readiness");
    await screen.findByText("Latest reply assessed");
    click("Lock Studio");
    assert.equal(
      screen.queryByText("I need evidence before progressing."),
      null,
    );
  } finally {
    cleanup();
    globalThis.fetch = original;
    window.location.hash = "";
  }
});

test("persona manager creates, edits, duplicates and archives while demo conversations keep their original buyer", async () => {
  localStorage.clear();
  window.location.hash = "";
  const originalConfirm = window.confirm;
  window.confirm = () => true;
  try {
    render(React.createElement(App));
    click(/Alex Vance/);
    const old = JSON.parse(localStorage.getItem(STORAGE_KEY)).conversations[0];
    click("Manage personas");
    const alex = screen.getByRole("article", { name: "Alex Vance" });
    fireEvent.click(within(alex).getByRole("button", { name: "Edit" }));
    change("Full name", "Alex Updated");
    change("Goals", "One edited goal\nAnother goal");
    click("Save persona");
    await screen.findByRole("heading", { name: "Your personas" });
    let data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert.equal(data.archetypes[0].profileRevision, 2);
    assert.equal(data.archetypes[0].profile.provenance.goals, "provided");
    assert.deepEqual(data.conversations[0], old);
    let card = screen.getByRole("article", { name: "Alex Updated" });
    fireEvent.click(within(card).getByRole("button", { name: "Duplicate" }));
    assert.equal(
      screen.getByLabelText("Full name").value,
      "Alex Updated (copy)",
    );
    click("Save persona");
    await screen.findByRole("article", { name: "Alex Updated (copy)" });
    card = screen.getByRole("article", { name: "Alex Updated" });
    fireEvent.click(within(card).getByRole("button", { name: "Archive" }));
    await waitFor(() =>
      assert.equal(
        screen.queryByRole("article", { name: "Alex Updated" }),
        null,
      ),
    );
    click("New conversation");
    assert.equal(
      screen.queryByRole("button", { name: /Alex Updated VP/ }),
      null,
    );
    click(/Conversation with Alex Vance/);
    assert.ok(screen.getByRole("heading", { name: "Alex Vance" }));
    click("Manage personas");
    click("Archived (1)");
    fireEvent.click(
      within(screen.getByRole("article", { name: "Alex Updated" })).getByRole(
        "button",
        { name: "Restore" },
      ),
    );
    await screen.findByText("No archived personas");
    click(/^Active \(/);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Create persona", exact: true })[0],
    );
    click("Build manually");
    change("Full name", "Jamie Test");
    change("Role", "Founder");
    change("Industry", "Professional services");
    click("Save persona");
    await screen.findByRole("article", { name: "Jamie Test" });
    data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert.match(
      data.archetypes.find((a) => a.name === "Jamie Test").system_prompt,
      /Professional services/,
    );
    cleanup();
    render(React.createElement(App));
    click("Manage personas");
    assert.ok(screen.getByRole("article", { name: "Jamie Test" }));
  } finally {
    cleanup();
    window.confirm = originalConfirm;
  }
});

test("persona form retains failed saves and oversized text, and replacement requires consent", async () => {
  const { ArchetypeSynthesizer } =
    await import("../src/components/ArchetypeSynthesizer.tsx");
  const original = globalThis.fetch,
    confirm = window.confirm;
  let calls = 0,
    saves = 0,
    saved;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({
      result: {
        name: "Generated buyer",
        role: "Buyer",
        budget_sensitivity: "Low",
        system_prompt: "Keep the generated voice.",
      },
    });
  };
  window.confirm = () => false;
  try {
    render(
      React.createElement(ArchetypeSynthesizer, {
        provider: "gemini",
        onBack() {},
        async onSave(d) {
          saves++;
          saved = d;
          throw new Error("Storage unavailable");
        },
      }),
    );
    change("Full name", "Manual buyer");
    change("Role", "Growth lead");
    change("Goals", "Keep my goal");
    change("Target buyer description", "A practical buyer");
    click("Generate draft");
    assert.equal(calls, 0);
    assert.equal(screen.getByLabelText("Goals").value, "Keep my goal");
    window.confirm = () => true;
    click("Generate draft");
    await screen.findByText(/Draft generated/);
    assert.equal(saves, 0);
    assert.equal(screen.getByLabelText("Full name").value, "Generated buyer");
    change("Background", "x".repeat(2401));
    click("Save persona");
    await screen.findByRole("alert");
    assert.equal(saves, 0);
    assert.equal(screen.getByLabelText("Background").value.length, 2401);
    change("Background", "Reviewable background");
    click("Save persona");
    await screen.findByText("Storage unavailable");
    assert.equal(
      screen.getByLabelText("Background").value,
      "Reviewable background",
    );
    assert.equal(saved.system_prompt, "Keep the generated voice.");
    assert.equal(saved.profile.provenance.background, "provided");
  } finally {
    cleanup();
    globalThis.fetch = original;
    window.confirm = confirm;
  }
});

test("unsaved persona navigation is guarded and stale demo edits cannot overwrite another tab", async () => {
  const confirm = window.confirm;
  window.confirm = () => false;
  localStorage.clear();
  window.location.hash = "";
  try {
    render(React.createElement(App));
    click("Create persona");
    change("Full name", "Keep this draft");
    click("Manage personas");
    assert.equal(screen.getByLabelText("Full name").value, "Keep this draft");
    window.confirm = () => true;
    click("Manage personas");
    const alex = screen.getByRole("article", { name: "Alex Vance" });
    fireEvent.click(within(alex).getByRole("button", { name: "Edit" }));
    change("Full name", "My stale edit");
    const { createInitialData } =
      await import("../src/services/storageService.ts");
    const external = createInitialData(localStorage);
    external.archetypes[0].name = "Changed in another tab";
    external.archetypes[0].profileRevision = 2;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(external));
    click("Save persona");
    await screen.findByText(/This persona changed in another tab/);
    assert.equal(screen.getByLabelText("Full name").value, "My stale edit");
    assert.equal(
      JSON.parse(localStorage.getItem(STORAGE_KEY)).archetypes[0].name,
      "Changed in another tab",
    );
    click("Back to personas");
    assert.ok(screen.getByRole("article", { name: "Changed in another tab" }));
  } finally {
    cleanup();
    window.confirm = confirm;
  }
});

test("private persona saves retry with the same identity and stale edits keep their draft", async () => {
  const { MemoryRepository, configure } = await import("./helpers.mjs");
  const { studio } = await import("../server/studio.ts");
  configure();
  const repo = new MemoryRepository();
  const original = globalThis.fetch,
    confirm = window.confirm;
  const requests = [];
  let loseCreateResponse = true;
  window.confirm = () => true;
  window.location.hash = "#private";
  sessionStorage.clear();
  globalThis.fetch = async (url, opts) => {
    const b = JSON.parse(opts.body);
    requests.push(b);
    try {
      const result = await studio(b, repo);
      if (b.action === "save_archetype" && loseCreateResponse) {
        loseCreateResponse = false;
        throw new Error("Save response lost");
      }
      return Response.json(result);
    } catch (e) {
      return Response.json({ error: e.message }, { status: e.status ?? 503 });
    }
  };
  try {
    render(React.createElement(App));
    change("Studio access code", "private-test-access-code-32-characters");
    click("Open Studio");
    await screen.findByRole("heading", { name: "New conversation" });
    assert.ok(screen.getByLabelText("Persona"));
    click("Create persona");
    click("Build manually");
    change("Full name", "New private buyer");
    change("Role", "Founder");
    click("Save persona");
    await screen.findByText("Save response lost");
    assert.equal(screen.getByLabelText("Full name").value, "New private buyer");
    click("Save persona");
    await screen.findByRole("heading", { name: "Your personas" });
    const creates = requests.filter((r) => r.action === "save_archetype");
    assert.equal(creates[0].id, creates[1].id);
    assert.equal(
      repo.state.data.archetypes.filter((a) => a.name === "New private buyer")
        .length,
      1,
    );
    const card = screen.getByRole("article", { name: "New private buyer" });
    fireEvent.click(within(card).getByRole("button", { name: "Edit" }));
    change("Role", "My revised role");
    const stored = repo.state.data.archetypes.find(
      (a) => a.name === "New private buyer",
    );
    stored.profileRevision = 2;
    stored.role = "Other tab's role";
    click("Save persona");
    await screen.findByText(/This persona changed in another tab/);
    assert.equal(screen.getByLabelText("Role").value, "My revised role");
    assert.equal(
      repo.state.data.archetypes.find((a) => a.id === stored.id).role,
      "Other tab's role",
    );
    click("Back to personas");
    assert.ok(
      within(
        screen.getByRole("article", { name: "New private buyer" }),
      ).getByText("Other tab's role"),
    );
  } finally {
    cleanup();
    globalThis.fetch = original;
    window.confirm = confirm;
    window.location.hash = "";
    sessionStorage.clear();
  }
});

test("saved replies unlock drafting while insights remain serialised; an analysis-only retry preserves the draft and bills once", async () => {
  const {
    MemoryRepository,
    configure,
    conversation,
    jevResponse,
    geminiResponse,
  } = await import("./helpers.mjs");
  const { studio } = await import("../server/studio.ts");
  const { runOperation } = await import("../server/turn.ts");
  const { clearDrafts, readDrafts } =
    await import("../src/services/draftService.ts");
  const deferred = () => {
    let resolve;
    const promise = new Promise((r) => {
      resolve = r;
    });
    return { promise, resolve };
  };
  const generation = deferred(),
    savedSnapshot = deferred(),
    assessment = deferred();
  configure();
  clearDrafts();
  localStorage.clear();
  const repo = new MemoryRepository();
  const c = await conversation(repo);
  const original = globalThis.fetch;
  let generations = 0,
    holdSnapshot = false,
    assessmentRequests = 0;
  const dialogueIds = [],
    assessmentIds = [];
  window.location.hash = "#private";
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (url === "/api/studio") {
      const result = await studio(body, repo);
      if (holdSnapshot) {
        holdSnapshot = false;
        await savedSnapshot.promise;
      }
      return Response.json(result);
    }
    if (url === "/api/dialogue") dialogueIds.push(body.requestId);
    if (url === "/api/assessment") {
      assessmentRequests++;
      assessmentIds.push(body.requestId);
      if (assessmentRequests === 1) {
        await assessment.promise;
        return Response.json(
          { error: "Analysis service temporarily unavailable" },
          { status: 503 },
        );
      }
    }
    const result = await runOperation(
      url === "/api/dialogue" ? "dialogue" : "assessment",
      body,
      repo,
      {
        jev: async () => jevResponse(),
        gemini: async () => {
          generations++;
          await generation.promise;
          holdSnapshot = true;
          return geminiResponse("Yes, subject to reviewing the scope.");
        },
      },
    );
    // An assessment response may be lost even though it was saved. Refresh is authoritative.
    if (url === "/api/assessment")
      throw new TypeError("Assessment response lost");
    return Response.json(result);
  };
  try {
    render(React.createElement(App));
    change("Studio access code", "private-test-access-code-32-characters");
    click("Open Studio");
    await screen.findByLabelText("Your message");
    change("Your message", "Review this proposal.");
    click("Send message");
    await screen.findByText(/is replying/);
    assert.equal(screen.getByLabelText("Your message").disabled, true);
    await act(async () => generation.resolve());
    await screen.findByText("Loading the saved reply…");
    assert.equal(
      screen.queryByText("Yes, subject to reviewing the scope."),
      null,
    );
    await act(async () => savedSnapshot.resolve());
    await screen.findByText("Yes, subject to reviewing the scope.");
    await screen.findByText(/Reply saved. Updating buyer insights/);
    assert.equal(screen.getByLabelText("Your message").disabled, false);
    const draft = "  Here is the scope\n\nwith a clear handover.  ";
    change("Your message", draft);
    assert.equal(
      screen.getByRole("button", { name: "Send message" }).disabled,
      true,
    );
    fireEvent.keyDown(screen.getByLabelText("Your message"), { key: "Enter" });
    fireEvent.submit(document.querySelector(".composer"));
    assert.equal(dialogueIds.length, 1);
    assert.equal(readDrafts().texts[c], draft);
    click("Buyer insights");
    await screen.findByText("Updating insights for the saved reply…");
    await act(async () => assessment.resolve());
    await screen.findByText(
      "Your reply is saved. Insights could not be updated.",
    );
    assert.equal(document.querySelector(".workspace > .error"), null);
    assert.equal(screen.getByLabelText("Your message").value, draft);
    click("Retry insights");
    await screen.findByText("Latest reply assessed");
    await waitFor(() =>
      assert.equal(
        screen.getByRole("button", { name: "Send message" }).disabled,
        false,
      ),
    );
    assert.equal(
      screen.queryByText("Reply saved. Buyer insights need another try."),
      null,
    );
    assert.equal(generations, 1);
    assert.equal(repo.state.data.messages.length, 2);
    assert.equal(repo.state.operations.length, 2);
    assert.equal(assessmentRequests, 2);
    assert.equal(assessmentIds[0], assessmentIds[1]);
    assert.equal(readDrafts().texts[c], draft);
    cleanup();
    render(React.createElement(App));
    change("Studio access code", "private-test-access-code-32-characters");
    click("Open Studio");
    await screen.findByLabelText("Your message");
    assert.equal(screen.getByLabelText("Your message").value, draft);
  } finally {
    generation.resolve();
    savedSnapshot.resolve();
    assessment.resolve();
    cleanup();
    globalThis.fetch = original;
    window.location.hash = "";
    clearDrafts();
  }
});

test("chat profiles use the frozen buyer; insights and mobile navigation restore keyboard focus", async () => {
  localStorage.clear();
  window.location.hash = "";
  try {
    render(React.createElement(App));
    click(/Alex Vance/);
    const profile = screen.getByRole("region", {
      name: "Conversation persona",
    });
    fireEvent.click(within(profile).getByText("View persona profile"));
    assert.match(
      profile.textContent,
      /Later persona edits apply to new conversations/,
    );
    assert.match(profile.textContent, /VP|Budget sensitivity/);
    change("Your message", "A practical proposal.");
    click("Send message");
    await screen.findByText(new RegExp(reply));
    const bubble = screen.getByRole("article", {
      name: "Message from Alex Vance",
    });
    assert.ok(within(bubble).getByText("Alex Vance"));
    assert.doesNotMatch(bubble.textContent, /gemini|JEV|· Demo/);
    const insights = screen.getByRole("button", { name: "Buyer insights" });
    insights.focus();
    fireEvent.click(insights);
    assert.equal(
      document.activeElement,
      screen.getByRole("button", { name: "Close insights" }),
    );
    fireEvent.keyDown(document.activeElement, { key: "Escape" });
    assert.equal(document.activeElement, insights);
    const nav = screen.getByRole("button", { name: "Open navigation" });
    nav.focus();
    fireEvent.click(nav);
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    const close = within(dialog).getByRole("button", {
      name: "Close navigation",
    });
    assert.equal(document.activeElement, close);
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    assert.equal(
      document.activeElement,
      within(dialog).getByRole("combobox", { name: "Workspace mode" }),
    );
    fireEvent.keyDown(document.activeElement, { key: "Tab" });
    assert.equal(document.activeElement, close);
    fireEvent.keyDown(close, { key: "Escape" });
    assert.equal(screen.queryByRole("dialog"), null);
    assert.equal(document.activeElement, nav);
  } finally {
    cleanup();
  }
});

test("insights mark earlier results, keep missing readiness empty, and link only verified buyer quotes", async () => {
  const { TelemetryDrawer } =
    await import("../src/components/TelemetryDrawer.tsx");
  const state = {
    version: 2,
    phase: "post_reply",
    evaluatedThrough: "old",
    rubricVersion: "1906-decision-v3",
    readinessIndex: null,
    status: "unavailable",
    stance: "conditional_agreement",
    friction: "credibility",
    remainingConditions: ["Comparable evidence"],
    responseAction: "request_evidence",
    evidenceStrength: 2.3,
    dimensions: {
      evidence_sufficiency: { value: 2.3, confidence: 0.8, status: "complete" },
      frictionEvidence: {
        status: "complete",
        value: {
          turnId: "old",
          source: "memory",
          quotes: [
            "Has it worked in a comparable growth environment?",
            "UNVERIFIED_QUOTE",
          ],
        },
      },
    },
  };
  const old = {
    id: "old",
    role: "assistant",
    content: "Has it worked in a comparable growth environment?",
    provider: "gemini",
    telemetry_status: "complete",
    evaluation: state,
    telemetry,
  };
  const latest = {
    ...old,
    id: "new",
    evaluation: undefined,
    telemetry_status: "pending",
  };
  const props = {
    open: true,
    busy: false,
    onClose() {},
    onRetry() {},
    previous: old,
    message: latest,
    messages: [old],
    decision: { ...state, phase: "pre_reply", readinessIndex: 95 },
  };
  try {
    render(React.createElement(TelemetryDrawer, props));
    assert.ok(screen.getByText("Previous insights · not the latest exchange"));
    assert.ok(screen.getByText("Not yet clear"));
    assert.equal(screen.queryByText("81"), null);
    assert.equal(screen.queryByText("95"), null);
    assert.ok(
      screen.getByText(/Clarify what made the earlier growth team comparable/),
    );
    assert.equal(document.body.textContent.includes("UNVERIFIED_QUOTE"), false);
    const details = screen.getByText("Assessment details").closest("details");
    assert.equal(details.open, false);
    fireEvent.click(screen.getByText("Assessment details"));
    assert.ok(screen.getByRole("button", { name: "View buyer message" }));
    cleanup();
    render(
      React.createElement(TelemetryDrawer, {
        ...props,
        message: old,
        decision: state,
        replyPending: true,
      }),
    );
    assert.ok(screen.getByText("Previous insights · not the latest exchange"));
    assert.equal(screen.queryByText("Latest reply assessed"), null);
    assert.equal(
      screen.queryByRole("button", { name: "Update insights" }),
      null,
    );
    cleanup();
    function SourceFixture() {
      const [open, setOpen] = React.useState(false);
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "button",
          { id: "analytics-toggle", onClick: () => setOpen(true) },
          "Open source insights",
        ),
        React.createElement(
          "article",
          { id: "message-old", tabIndex: -1 },
          old.content,
        ),
        React.createElement(TelemetryDrawer, {
          ...props,
          open,
          message: old,
          decision: state,
          onClose: () => setOpen(false),
        }),
      );
    }
    render(React.createElement(SourceFixture));
    const trigger = screen.getByRole("button", {
      name: "Open source insights",
    });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText("Assessment details"));
    click("View buyer message");
    await waitFor(() =>
      assert.equal(document.activeElement?.id, "message-old"),
    );
    assert.equal(
      screen.queryByRole("complementary", { name: "Buyer insights" }),
      null,
    );
  } finally {
    cleanup();
  }
});

test("Enter sends once while Shift+Enter and composition preserve editing", async () => {
  const { ChatWorkspace } = await import("../src/components/ChatWorkspace.tsx");
  const { createInitialData } =
    await import("../src/services/storageService.ts");
  localStorage.clear();
  const sent = [];
  try {
    render(
      React.createElement(ChatWorkspace, {
        archetype: createInitialData(localStorage).archetypes[0],
        messages: [],
        provider: "demo",
        busy: false,
        pendingHere: false,
        analyticsOpen: false,
        onAnalytics() {},
        onSend(t) {
          sent.push(t);
        },
        onRetry() {},
        onMenu() {},
      }),
    );
    change("Your message", "A question\nwith context");
    const input = screen.getByLabelText("Your message");
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    assert.equal(sent.length, 0);
    assert.equal(input.value, "A question\nwith context");
    fireEvent.keyDown(input, { key: "Enter" });
    assert.deepEqual(sent, ["A question\nwith context"]);
  } finally {
    cleanup();
  }
});

test("narrow-screen insights trap keyboard focus until dismissed and hide numerical details initially", async () => {
  const { TelemetryDrawer } =
    await import("../src/components/TelemetryDrawer.tsx");
  const original = window.matchMedia;
  window.matchMedia = () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  });
  let dismissed = 0;
  try {
    render(
      React.createElement(TelemetryDrawer, {
        open: true,
        busy: false,
        message: { id: "demo", provider: "demo", telemetry },
        onClose() {
          dismissed++;
        },
        onRetry() {},
      }),
    );
    const dialog = screen.getByRole("dialog", { name: "Buyer insights" });
    const close = within(dialog).getByRole("button", {
      name: "Close insights",
    });
    assert.equal(document.activeElement, close);
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    const summary = within(dialog).getByText("Assessment details");
    assert.equal(document.activeElement, summary);
    assert.equal(summary.parentElement.open, false);
    fireEvent.keyDown(summary, { key: "Tab" });
    assert.equal(document.activeElement, close);
    fireEvent.keyDown(close, { key: "Escape" });
    assert.equal(dismissed, 1);
  } finally {
    cleanup();
    window.matchMedia = original;
  }
});
