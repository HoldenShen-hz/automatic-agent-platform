import assert from "node:assert/strict";
import test from "node:test";

import {
  PROMPT_ROLLOUT_STAGES,
  isPromptRolloutStage,
  nextPromptRolloutStage,
} from "../../../../../src/platform/prompt-engine/rollout/prompt-rollout-stage.js";

test("PROMPT_ROLLOUT_STAGES uses the canonical canary_5/canary_20 progression", () => {
  assert.deepEqual(PROMPT_ROLLOUT_STAGES, [
    "canary_5",
    "canary_20",
    "stable",
    "rolled_back",
  ]);
  assert.equal(isPromptRolloutStage("canary_5"), true);
  assert.equal(isPromptRolloutStage("canary_20"), true);
  assert.equal(isPromptRolloutStage("partial_25"), false);
});

test("nextPromptRolloutStage treats stable as a terminal state", () => {
  assert.equal(nextPromptRolloutStage("canary_5"), "canary_20");
  assert.equal(nextPromptRolloutStage("canary_20"), "stable");
  assert.equal(nextPromptRolloutStage("stable"), null);
  assert.equal(nextPromptRolloutStage("rolled_back"), null);
});
