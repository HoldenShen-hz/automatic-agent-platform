import assert from "node:assert/strict";
import test from "node:test";

import * as conversationTemplate from "../../../../src/platform/prompt-engine/conversation-template-service.js";
import * as evalModule from "../../../../src/platform/prompt-engine/eval/index.js";
import {
  listPromptEngineCapabilityBaselines,
  resolvePromptEngineCapabilityBaseline,
} from "../../../../src/platform/prompt-engine/prompt-engine-baseline.js";
import * as registry from "../../../../src/platform/prompt-engine/registry/index.js";
import * as renderer from "../../../../src/platform/prompt-engine/renderer/index.js";
import * as rollout from "../../../../src/platform/prompt-engine/rollout/index.js";

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

test("prompt-engine baseline service names resolve from canonical submodule exports", () => {
  const exportsByCapabilityId = {
    registry,
    renderer,
    rollout,
    eval: evalModule,
    "conversation-template": conversationTemplate,
  } as const;

  for (const baseline of listPromptEngineCapabilityBaselines()) {
    const exportedModule = exportsByCapabilityId[baseline.capabilityId];
    for (const serviceName of baseline.baselineServices) {
      assert.equal(
        serviceName in exportedModule,
        true,
        `expected ${serviceName} to be exported by ${baseline.entryModule}`,
      );
    }
  }
});
