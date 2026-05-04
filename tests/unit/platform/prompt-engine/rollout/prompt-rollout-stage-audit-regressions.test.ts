import assert from "node:assert/strict";
import test from "node:test";

import {
  PROMPT_ROLLOUT_STAGES,
  isPromptRolloutStage,
  nextPromptRolloutStage,
} from "../../../../../src/platform/prompt-engine/rollout/prompt-rollout-stage.js";

test("PROMPT_ROLLOUT_STAGES uses the canonical canary(5%)/canary(20%) progression", () => {
  assert.deepEqual(PROMPT_ROLLOUT_STAGES, [
    "canary(5%)",
    "canary(20%)",
    "stable",
    "rolled_back",
  ]);
  assert.equal(isPromptRolloutStage("canary_5"), false);
  assert.equal(isPromptRolloutStage("partial_25"), false);
});

test("nextPromptRolloutStage treats stable as a terminal state", () => {
  assert.equal(nextPromptRolloutStage("canary(5%)"), "canary(20%)");
  assert.equal(nextPromptRolloutStage("canary(20%)"), "stable");
  assert.equal(nextPromptRolloutStage("stable"), null);
  assert.equal(nextPromptRolloutStage("rolled_back"), null);
});
