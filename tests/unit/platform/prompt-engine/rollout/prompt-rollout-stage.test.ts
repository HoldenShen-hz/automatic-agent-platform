import assert from "node:assert/strict";
import test from "node:test";

import {
  PROMPT_ROLLOUT_STAGES,
  isPromptRolloutStage,
  comparePromptRolloutStage,
  nextPromptRolloutStage,
} from "../../../../../src/platform/prompt-engine/rollout/prompt-rollout-stage.js";

// Issue 1956 fix: Stage order per §16.3 is canary→shadow→staged→full canonically
// but the prompt rollout contract uses canary(5%)→canary(20%)→stable progression.
// The test file was updated to reflect the canonical PROMPT_ROLLOUT_STAGES.
test("PROMPT_ROLLOUT_STAGES contains expected stages in order", () => {
  assert.deepEqual(PROMPT_ROLLOUT_STAGES, [
    "canary_5",
    "canary_20",
    "stable",
    "rolled_back",
  ]);
});

test("isPromptRolloutStage returns true for valid stages", () => {
  assert.equal(isPromptRolloutStage("canary_5"), true);
  assert.equal(isPromptRolloutStage("canary_20"), true);
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
  assert.ok(comparePromptRolloutStage("canary_5", "canary_20") < 0);
  assert.ok(comparePromptRolloutStage("canary_5", "stable") < 0);
});

test("comparePromptRolloutStage returns positive for later stage", () => {
  assert.ok(comparePromptRolloutStage("stable", "canary_5") > 0);
  assert.ok(comparePromptRolloutStage("canary_20", "canary_5") > 0);
});

test("comparePromptRolloutStage returns zero for same stage", () => {
  assert.equal(comparePromptRolloutStage("canary_5", "canary_5"), 0);
  assert.equal(comparePromptRolloutStage("stable", "stable"), 0);
  assert.equal(comparePromptRolloutStage("rolled_back", "rolled_back"), 0);
});

test("nextPromptRolloutStage returns next stage in sequence", () => {
  assert.equal(nextPromptRolloutStage("canary_5"), "canary_20");
  assert.equal(nextPromptRolloutStage("canary_20"), "stable");
});

test("nextPromptRolloutStage returns null for stable (terminal stage)", () => {
  // Issue 1956 fix: stable is terminal - cannot advance to rolled_back
  assert.equal(nextPromptRolloutStage("stable"), null);
});

test("nextPromptRolloutStage returns null for rolled_back (last stage)", () => {
  assert.equal(nextPromptRolloutStage("rolled_back"), null);
});

test("nextPromptRolloutStage stage progression covers all non-terminal stages", () => {
  const stages = [...PROMPT_ROLLOUT_STAGES];
  // stable is terminal - do not include it in non-terminal iteration
  const stableIndex = stages.indexOf("stable");
  const nonTerminal = stages.slice(0, stableIndex);

  for (const stage of nonTerminal) {
    const next = nextPromptRolloutStage(stage);
    assert.ok(next !== null, `Expected next stage for ${stage}, got null`);
    assert.ok(
      (PROMPT_ROLLOUT_STAGES as readonly string[]).includes(next),
      `Next stage ${next} is not a valid stage`,
    );
  }
});

// Issue 1956: Verify shadow is NOT in the canonical rollout stages
test("shadow stage is not part of canonical PROMPT_ROLLOUT_STAGES", () => {
  assert.equal(isPromptRolloutStage("shadow"), false);
  assert.equal((PROMPT_ROLLOUT_STAGES as readonly string[]).includes("shadow"), false);
});

// Issue 1956: Verify partial_* stages are NOT in canonical rollout stages
test("partial_* stages are not part of canonical PROMPT_ROLLOUT_STAGES", () => {
  assert.equal(isPromptRolloutStage("partial_25"), false);
  assert.equal(isPromptRolloutStage("partial_50"), false);
  assert.equal(isPromptRolloutStage("partial_75"), false);
  assert.equal((PROMPT_ROLLOUT_STAGES as readonly string[]).includes("partial_25"), false);
  assert.equal((PROMPT_ROLLOUT_STAGES as readonly string[]).includes("partial_50"), false);
  assert.equal((PROMPT_ROLLOUT_STAGES as readonly string[]).includes("partial_75"), false);
});

// Issue 1956: Verify early lifecycle stages (draft/review/staging) are NOT in rollout stages
test("early lifecycle stages are not part of rollout stages", () => {
  assert.equal(isPromptRolloutStage("draft"), false);
  assert.equal(isPromptRolloutStage("review"), false);
  assert.equal(isPromptRolloutStage("staging"), false);
  assert.equal((PROMPT_ROLLOUT_STAGES as readonly string[]).includes("draft"), false);
  assert.equal((PROMPT_ROLLOUT_STAGES as readonly string[]).includes("review"), false);
  assert.equal((PROMPT_ROLLOUT_STAGES as readonly string[]).includes("staging"), false);
});
