import assert from "node:assert/strict";
import test from "node:test";

import {
  ConversationTemplateRegistry,
  EvalDatasetJudgeService,
  buildPromptEngineBootstrap,
  PromptRendererService,
  PromptRolloutService,
  PromptTemplateRegistryService,
} from "../../../../src/platform/prompt-engine/index.js";

test("prompt-engine root barrel exposes prompt governance services", () => {
  assert.equal(typeof PromptTemplateRegistryService, "function");
  assert.equal(typeof PromptRendererService, "function");
  assert.equal(typeof PromptRolloutService, "function");
  assert.equal(typeof EvalDatasetJudgeService, "function");
});

test("prompt-engine root barrel preserves conversation template compatibility exports", () => {
  assert.equal(typeof ConversationTemplateRegistry, "function");
});

test("prompt-engine root barrel exposes W2 bootstrap helpers", () => {
  assert.equal(typeof buildPromptEngineBootstrap, "function");
});
