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

test("studio interactions persist history, isolate async turns, and recover both engine failures", async () => {
  localStorage.clear();
  const originalFetch = globalThis.fetch;
  let mode = "held";
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  globalThis.fetch = async (url) => {
    if (url === "/api/dialogue") {
      if (mode === "held") {
        await held;
        return new Response(
          JSON.stringify({ text: "Mocked reply for Jordan." }),
        );
      }
      if (mode === "dialogue-fail")
        return new Response(JSON.stringify({ error: "Provider failed" }), {
          status: 502,
        });
      return new Response(JSON.stringify({ text: "Recovered reply." }));
    }
    if (mode === "held")
      return new Response(
        JSON.stringify({ error: "JEV temporarily unavailable" }),
        { status: 503 },
      );
    return new Response(JSON.stringify(telemetry));
  };
  try {
    render(React.createElement(App));
    click(/Alex Vance/);
    change("Your strategic message", "A measurable integration pitch");
    click("Send message");
    await screen.findByText(new RegExp(reply));
    assert.equal(screen.queryByLabelText("Evaluator telemetry"), null);
    click("Expand Analytics");
    await screen.findByText("Sceptical · demo fixture");
    click("Close analytics");
    assert.equal(
      JSON.parse(localStorage.getItem(STORAGE_KEY)).users[0].compute_credits,
      4275,
    );
    cleanup();
    render(React.createElement(App));
    await screen.findByText(new RegExp(reply));
    click("Synthesize Archetype");
    change("Full name", "Jordan Test");
    change("Role", "Operations director");
    change(
      "System prompt",
      "You are an analytical operations director focused on cost.",
    );
    click("Save Archetype");
    await screen.findByRole("heading", { name: "Jordan Test" });
    change("Dialogue engine", "gemini");
    change("Your strategic message", "Jordan pitch");
    click("Send message");
    click(/A measurable integration pitch/);
    await act(async () => {
      release();
    });
    await waitFor(() =>
      assert.equal(
        JSON.parse(localStorage.getItem(STORAGE_KEY)).messages.at(-1)
          .telemetry_status,
        "failed",
      ),
    );
    assert.equal(screen.queryByText("Mocked reply for Jordan."), null);
    click(/Jordan pitch/);
    await screen.findByText("Mocked reply for Jordan.");
    click("Expand Analytics");
    await screen.findByText("JEV temporarily unavailable");
    mode = "success";
    click("Retry analytics");
    await screen.findByText("Receptive");
    assert.equal(screen.getAllByText("Mocked reply for Jordan.").length, 1);
    click("Close analytics");
    mode = "dialogue-fail";
    change("Your strategic message", "Retry this pitch");
    click("Send message");
    await screen.findByText("Provider failed");
    click("Expand Analytics");
    assert.equal(screen.queryByText("Receptive"), null);
    click("Close analytics");
    mode = "success";
    click("Retry reply");
    await screen.findByText("Recovered reply.");
    assert.equal(
      within(screen.getByRole("log")).getAllByText("Retry this pitch").length,
      1,
    );
    await waitFor(() =>
      assert.equal(
        JSON.parse(localStorage.getItem(STORAGE_KEY)).messages.at(-1)
          .telemetry_status,
        "complete",
      ),
    );
    assert.equal(
      JSON.parse(localStorage.getItem(STORAGE_KEY)).users[0].compute_credits,
      4275,
    );
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
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
