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
      const result = await runOperation("dialogue", b, repo, {
        jev: async () => jevResponse(),
        gemini: async () => {
          if (fail)
            throw new ProviderFailure(
              "Provider temporarily unavailable",
              false,
            );
          return geminiResponse("I need evidence before progressing.");
        },
      });
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
    assert.equal(repo.state.operations.length, 1);
    assert.equal(
      repo.state.operations[0].attempts.filter((a) => a.provider === "jev")
        .length,
      1,
    );
    assert.equal(localStorage.getItem(STORAGE_KEY), null);
    click("Expand Analytics");
    await screen.findByText("Decision readiness");
    await screen.findByText(/request evidence/);
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
