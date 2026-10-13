import test from "node:test";
import assert from "node:assert/strict";
import { synthesisFixture } from "./persona-fixtures.mjs";
import { parseSynthesisedPersona, SYNTHESIS_PROMPT } from "../server/persona-synthesis.ts";
import { parseDraft } from "../src/api/validation.ts";
import { avatarEmoji, DEFAULT_AVATAR } from "../src/api/avatar.ts";
test("unsupported preferred channels and tools are left blank even when labelled provided", () => {
  const data = synthesisFixture();
  data.profile.preferredChannels = ["WhatsApp", "LinkedIn"];
  data.profile.currentTools = ["Salesforce"];
  data.profile.provenance.preferredChannels = "provided";
  data.profile.provenance.currentTools = "provided";
  data.evidence = { preferredChannels: "A channel never mentioned", currentTools: "Uses CRM tools" };
  const result = parseSynthesisedPersona(data, "A Head of Growth needs credible reporting.");
  assert.equal(result.profile.preferredChannels, undefined);
  assert.equal(result.profile.currentTools, undefined);
  assert.equal(result.profile.provenance.preferredChannels, undefined);
  assert.match(result.synthesisReview.notes.at(-1), /Unsupported fields left blank/);
});
test("directly evidenced channels may be retained; generic job title does not count", () => {
  const data = synthesisFixture();
  data.profile = { preferredChannels: ["Email"], provenance: { preferredChannels: "provided" } };
  data.evidence = { preferredChannels: "Prefers email" };
  assert.deepEqual(parseSynthesisedPersona(data, "The buyer prefers email for proposals.").profile.preferredChannels, ["Email"]);
  assert.equal(parseSynthesisedPersona(data, "The buyer is a marketing manager.").profile.preferredChannels, undefined);
});
test("synthesis instructions favour omissions over plausible hallucinations", () => {
  assert.match(SYNTHESIS_PROMPT, /never invent preferred channels/i);
  assert.match(SYNTHESIS_PROMPT, /leave optional fields empty/i);
});
test("emoji selection validates one grapheme and preserves the optional legacy contract", () => {
  assert.equal(avatarEmoji("👩‍💼"), "👩‍💼");
  assert.equal(avatarEmoji("🇦🇺"), "🇦🇺");
  assert.throws(() => avatarEmoji("🎯🎯"));
  assert.throws(() => avatarEmoji("hello"));
  const data = parseDraft({ name: "Buyer", role: "Founder", budget_sensitivity: "Medium", system_prompt: "Act as the buyer.", avatar: "🐨" });
  assert.equal(data.avatar, "🐨");
  assert.equal(parseDraft({ ...data, avatar: undefined }).avatar, undefined);
  assert.equal(DEFAULT_AVATAR, "🎯");
});
