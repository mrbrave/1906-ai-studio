import test from "node:test";
import assert from "node:assert/strict";
import {
  nextExploration,
  verifiedBuyerEvidence,
  insightAssessment,
  evidenceLabel,
} from "../src/services/buyerInsights.ts";

test("next approach respects refusals and agreement, distinguishes unknown from none, and never invents comparable proof", () => {
  const state = {
    stance: "conditional_agreement",
    friction: "credibility",
    remainingConditions: ["Evidence"],
  };
  assert.match(nextExploration(state, []), /if one is available/);
  assert.doesNotMatch(nextExploration(state, []), /growth/);
  const buyer = {
    id: "buyer",
    role: "assistant",
    content: "I need evidence from a comparable growth environment.",
  };
  const ref = {
    status: "complete",
    value: { turnId: buyer.id, source: "memory", quotes: [buyer.content] },
  };
  const evidence = verifiedBuyerEvidence(
    { dimensions: { frictionEvidence: ref } },
    [buyer],
  );
  assert.match(
    nextExploration(state, evidence),
    /an anonymised example if one exists/,
  );
  assert.deepEqual(
    verifiedBuyerEvidence({ dimensions: { frictionEvidence: ref } }, [
      { ...buyer, role: "user" },
    ]),
    [],
  );
  assert.deepEqual(
    verifiedBuyerEvidence(
      { dimensions: { frictionEvidence: { ...ref, status: "provisional" } } },
      [buyer],
    ),
    [],
  );
  assert.match(
    nextExploration({ ...state, stance: "declined" }, evidence),
    /Acknowledge their decision/,
  );
  assert.match(
    nextExploration(
      { stance: "agreed", friction: "none", remainingConditions: [] },
      [],
    ),
    /Confirm the agreed next step/,
  );
  assert.match(
    nextExploration(
      {
        stance: "conditional_agreement",
        friction: "none",
        remainingConditions: ["Commercials"],
      },
      [],
    ),
    /remaining conditions/,
  );
  assert.notEqual(
    nextExploration({ friction: "none" }, []),
    nextExploration({ friction: "unknown" }, []),
  );
});

test("mismatched and pre-reply assessments cannot masquerade as completed buyer observations", () => {
  const message = { id: "reply", telemetry_status: "complete" };
  const state = {
    phase: "post_reply",
    evaluatedThrough: "reply",
    readinessIndex: 75,
  };
  assert.equal(insightAssessment(message, state).current, true);
  assert.equal(
    insightAssessment(message, { ...state, phase: "pre_reply" }).shown,
    undefined,
  );
  assert.equal(
    insightAssessment(message, { ...state, evaluatedThrough: "another" }).shown,
    undefined,
  );
  assert.equal(
    insightAssessment(
      message,
      state,
      { ...message, evaluation: { ...state, evaluatedThrough: "another" } },
      true,
    ).shown,
    undefined,
  );
  assert.equal(
    insightAssessment(message, state, { ...message, evaluation: state }, true)
      .current,
    false,
  );
  assert.equal(evidenceLabel(null), "Not yet assessed");
  assert.equal(evidenceLabel(0), "No relevant support identified");
  assert.equal(evidenceLabel(4), "Enough support for this next step");
});
