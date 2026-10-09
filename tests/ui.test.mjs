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
    await screen.findByLabelText("Your strategic message");
  }
  try {
    await open();
    const exact =
      "  Commercial proposal\n\nAUD 4,500 + GST; subject to review.  ";
    change("Your strategic message", exact);
    click("Send message");
    await screen.findByText("The bounded working context is full.");
    assert.equal(screen.getByLabelText("Your strategic message").value, exact);
    cleanup();
    await open();
    assert.equal(screen.getByLabelText("Your strategic message").value, exact);
    const shorter = "Please review the scope before accepting.";
    change("Your strategic message", shorter);
    reject = false;
    click("Send message");
    await screen.findByText("Network connection lost");
    await screen.findByText(
      "Commercial proposal received, subject to scope review.",
    );
    assert.notEqual(ids[0], ids[1]);
    assert.equal(generations, 1);
    assert.equal(repo.state.data.messages.length, 2);
    assert.equal(screen.getByLabelText("Your strategic message").value, "");
    click("Expand Analytics");
    click("Assess latest reply");
    await screen.findByText("JEV · completed exchange");
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
  change("Your strategic message", "x".repeat(4001));
  assert.equal(
    screen.getByLabelText("Your strategic message").value.length,
    4001,
  );
  assert.equal(
    screen.getByRole("button", { name: "Send message" }).disabled,
    true,
  );
  fireEvent.keyDown(screen.getByLabelText("Your strategic message"), {
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
    change("Your strategic message", "A measurable integration pitch");
    click("Send message");
    await screen.findByText(new RegExp(reply));
    click("Expand Analytics");
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
    await screen.findByRole("heading", { name: "New strategic dialogue" });
    assert.match(screen.getByText(/Usage remaining/).textContent, /100%/);
    assert.equal(screen.queryByText(/CRD/), null);
    change("Proposition", "Leadership coaching programme");
    change("Target decision", "Agree to a discovery workshop");
    click("Start dialogue");
    await screen.findByText("Agree to a discovery workshop");
    change("Your strategic message", "A six-week implementation");
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
    click("Expand Analytics");
    await screen.findByText("Decision readiness");
    await screen.findByText("JEV · completed exchange");
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
    click("New Strategic Dialogue");
    assert.equal(
      screen.queryByRole("button", { name: /Alex Updated VP/ }),
      null,
    );
    click(/Dialogue with Alex Vance/);
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
    await screen.findByRole("heading", { name: "New strategic dialogue" });
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
