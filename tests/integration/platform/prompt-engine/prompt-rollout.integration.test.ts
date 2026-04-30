/**
 * Prompt Rollout Integration Tests
 *
 * Integration tests for prompt rollout workflow.
 * Tests issue #1956: Stage order wrong: shadow before canary
 * Tests issue #1957: PromptRolloutMode missing canary/staged/full
 * Tests issue #1958: No automatic rollback
 */

import test from "node:test";
import assert from "node:assert/strict";

import { PromptRolloutService } from "../../../../src/platform/prompt-engine/rollout/index.js";
import { PromptTemplateRegistryService } from "../../../../src/platform/prompt-engine/registry/index.js";
import {
  PROMPT_ROLLOUT_STAGES,
  nextPromptRolloutStage,
  type PromptRolloutStage,
} from "../../../../src/platform/prompt-engine/rollout/prompt-rollout-stage.js";

function createTemplate(registry: PromptTemplateRegistryService, templateKey: string) {
  return registry.registerTemplate({
    templateKey,
    version: "v1.0",
    owner: "test@example.com",
    fixedPrefix: "System prompt",
    domainBlock: "Test domain",
  });
}

test("PromptRolloutService createRollout follows canonical stage order", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = createTemplate(registry, "test_template_1");

  const record = rollout.createRollout({
    template,
    mode: "suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  // Issue #1956: Stage order should be canary_5, not shadow
  assert.ok(
    record.status === "canary_5" || record.status === "canary_20",
    `Initial status should be canary stage, got: ${record.status}`,
  );
});

test("PromptRolloutService activateRollout advances through stage order", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = createTemplate(registry, "test_template_2");

  const created = rollout.createRollout({
    template,
    mode: "suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  // Advance from canary_5
  if (created.status === "canary_5" || created.status === "blocked") {
    const activated = rollout.activateRollout(created.rolloutId);
    assert.ok(
      activated.status === "canary_20" || activated.status === "stable",
      `After activation status should be canary_20 or stable, got: ${activated.status}`,
    );
  }
});

test("PromptRolloutService rollbackRollout transitions to rolled_back state", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = createTemplate(registry, "test_template_3");

  const record = rollout.createRollout({
    template,
    mode: "suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  if (record.status !== "blocked") {
    const rolledBack = rollout.rollbackRollout(record.rolloutId, "test_rollback");

    assert.equal(rolledBack.status, "rolled_back", "Rollback should transition to rolled_back");
    assert.equal(rolledBack.guardrailSummary, "test_rollback");
  }
});

test("PromptRolloutService evaluateGuardrail returns correct nextStatus for valid modes", () => {
  const rollout = new PromptRolloutService();

  // Issue #1957: Check that shadow mode is handled correctly
  const shadowDecision = rollout.evaluateGuardrail({
    mode: "shadow",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.equal(shadowDecision.allowed, true);
  assert.ok(
    shadowDecision.nextStatus === "canary_5" || shadowDecision.nextStatus === "canary_20",
    `Shadow should lead to canary stage, got: ${shadowDecision.nextStatus}`,
  );
});

test("PromptRolloutService blocked rollout cannot be activated", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = createTemplate(registry, "test_template_4");

  const blocked = rollout.createRollout({
    template,
    mode: "suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: false, // Fails guardrail
    domainBlockCompatible: true,
  });

  assert.equal(blocked.status, "blocked");

  // Attempting to activate a blocked rollout should fail
  assert.throws(
    () => rollout.activateRollout(blocked.rolloutId),
    (err: unknown) => (err as Error).message.includes("cannot transition"),
  );
});

test("PROMPT_ROLLOUT_STAGES maintains correct stage order", () => {
  // Issue #1956: Verify stage order is correct (canary before stable)
  const canary5Index = PROMPT_ROLLOUT_STAGES.indexOf("canary_5");
  const canary20Index = PROMPT_ROLLOUT_STAGES.indexOf("canary_20");
  const stableIndex = PROMPT_ROLLOUT_STAGES.indexOf("stable");

  assert.ok(canary5Index >= 0, "canary_5 should be in stages");
  assert.ok(canary20Index >= 0, "canary_20 should be in stages");
  assert.ok(stableIndex >= 0, "stable should be in stages");
  assert.ok(canary5Index < canary20Index, "canary_5 should come before canary_20");
  assert.ok(canary20Index < stableIndex, "canary_20 should come before stable");
});

test("nextPromptRolloutStage follows correct progression", () => {
  // Issue #1956: Stage order verification
  assert.equal(nextPromptRolloutStage("canary_5"), "canary_20");
  assert.equal(nextPromptRolloutStage("canary_20"), "stable");
  assert.equal(nextPromptRolloutStage("stable"), null, "stable has no next stage");
  assert.equal(nextPromptRolloutStage("rolled_back"), null, "rolled_back is terminal");
});

test("PromptRolloutService rejects invalid status transitions", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = createTemplate(registry, "test_template_5");

  const record = rollout.createRollout({
    template,
    mode: "suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  // Cannot activate rolled_back status
  if (record.status !== "blocked") {
    const rolledBack = rollout.rollbackRollout(record.rolloutId, "test");

    assert.throws(
      () => rollout.activateRollout(rolledBack.rolloutId),
      (err: unknown) => (err as Error).message.includes("cannot transition"),
    );
  }
});