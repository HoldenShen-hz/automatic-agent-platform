import assert from "node:assert/strict";
import test from "node:test";

import {
  PROMPT_ROLLOUT_STAGES,
  isPromptRolloutStage,
  comparePromptRolloutStage,
  nextPromptRolloutStage,
} from "../../../../../src/platform/prompt-engine/rollout/prompt-rollout-stage.js";

test("PROMPT_ROLLOUT_STAGES contains expected stages in order", () => {
  assert.deepEqual(PROMPT_ROLLOUT_STAGES, [
    "draft",
    "review",
    "staging",
    "shadow",
    "canary_5",
    "partial_25",
    "partial_50",
    "partial_75",
    "stable",
    "rolled_back",
  ]);
});

test("isPromptRolloutStage returns true for valid stages", () => {
  assert.equal(isPromptRolloutStage("draft"), true);
  assert.equal(isPromptRolloutStage("review"), true);
  assert.equal(isPromptRolloutStage("staging"), true);
  assert.equal(isPromptRolloutStage("shadow"), true);
  assert.equal(isPromptRolloutStage("canary_5"), true);
  assert.equal(isPromptRolloutStage("partial_25"), true);
  assert.equal(isPromptRolloutStage("partial_50"), true);
  assert.equal(isPromptRolloutStage("partial_75"), true);
  assert.equal(isPromptRolloutStage("stable"), true);
  assert.equal(isPromptRolloutStage("rolled_back"), true);
});

test("isPromptRolloutStage returns false for invalid values", () => {
  assert.equal(isPromptRolloutStage("invalid"), false);
  assert.equal(isPromptRolloutStage(""), false);
  assert.equal(isPromptRolloutStage("ACTIVE"), false);
  assert.equal(isPromptRolloutStage("stable_"), false);
});

test("comparePromptRolloutStage returns negative for earlier stage", () => {
  assert.ok(comparePromptRolloutStage("draft", "review") < 0);
  assert.ok(comparePromptRolloutStage("draft", "stable") < 0);
  assert.ok(comparePromptRolloutStage("shadow", "canary_5") < 0);
});

test("comparePromptRolloutStage returns positive for later stage", () => {
  assert.ok(comparePromptRolloutStage("stable", "draft") > 0);
  assert.ok(comparePromptRolloutStage("partial_50", "shadow") > 0);
  assert.ok(comparePromptRolloutStage("canary_5", "draft") > 0);
});

test("comparePromptRolloutStage returns zero for same stage", () => {
  assert.equal(comparePromptRolloutStage("draft", "draft"), 0);
  assert.equal(comparePromptRolloutStage("stable", "stable"), 0);
  assert.equal(comparePromptRolloutStage("rolled_back", "rolled_back"), 0);
});

test("nextPromptRolloutStage returns next stage in sequence", () => {
  assert.equal(nextPromptRolloutStage("draft"), "review");
  assert.equal(nextPromptRolloutStage("review"), "staging");
  assert.equal(nextPromptRolloutStage("staging"), "shadow");
  assert.equal(nextPromptRolloutStage("shadow"), "canary_5");
  assert.equal(nextPromptRolloutStage("canary_5"), "partial_25");
  assert.equal(nextPromptRolloutStage("partial_25"), "partial_50");
  assert.equal(nextPromptRolloutStage("partial_50"), "partial_75");
  assert.equal(nextPromptRolloutStage("partial_75"), "stable");
});

test("nextPromptRolloutStage returns null for last stage", () => {
  assert.equal(nextPromptRolloutStage("rolled_back"), null);
});

test("nextPromptRolloutStage returns null for rolled_back", () => {
  assert.equal(nextPromptRolloutStage("rolled_back"), null);
});

test("nextPromptRolloutStage stage progression covers all non-terminal stages", () => {
  const stages = [...PROMPT_ROLLOUT_STAGES];
  const nonTerminal = stages.slice(0, stages.length - 1); // all except rolled_back

  for (const stage of nonTerminal) {
    const next = nextPromptRolloutStage(stage);
    assert.ok(next !== null, `Expected next stage for ${stage}, got null`);
    assert.ok(
      (PROMPT_ROLLOUT_STAGES as readonly string[]).includes(next),
      `Next stage ${next} is not a valid stage`,
    );
  }
});
