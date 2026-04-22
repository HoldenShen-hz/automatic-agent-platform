import assert from "node:assert/strict";
import test from "node:test";

import {
  listPromptEngineCapabilityBaselines,
  resolvePromptEngineCapabilityBaseline,
} from "../../../../src/platform/prompt-engine/prompt-engine-baseline.js";

test("prompt-engine baseline covers canonical prompt governance services", () => {
  const baselines = listPromptEngineCapabilityBaselines();
  assert.deepEqual(
    baselines.map((item) => item.capabilityId),
    ["registry", "renderer", "rollout", "eval", "conversation-template"],
  );
  assert.equal(
    resolvePromptEngineCapabilityBaseline("conversation-template").entryModule,
    "src/platform/prompt-engine/conversation-template-service.ts",
  );
});
