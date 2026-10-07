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
  fireEvent.change(input, { target: { value: "x".repeat(4001) } });
  assert.equal(input.value.length, 4001);
  assert.equal(
    screen.getByRole("button", { name: /Synthesize/ }).disabled,
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
