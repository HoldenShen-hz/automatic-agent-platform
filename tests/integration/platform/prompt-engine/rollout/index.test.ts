import assert from "node:assert/strict";
import test from "node:test";

import { PromptRolloutService } from "../../../../../src/platform/prompt-engine/rollout/index.js";
import { PromptTemplateRegistryService } from "../../../../../src/platform/prompt-engine/registry/index.js";

test("PromptRolloutService integration with PromptTemplateRegistryService creates rollout from registered template", () => {
  const registry = new PromptTemplateRegistryService();
  const rolloutService = new PromptRolloutService();

  const template = registry.registerTemplate({
    templateKey: "integration_template",
    version: "v1",
    owner: "integration@example.com",
    fixedPrefix: "Integration prefix",
    domainBlock: "Integration domain",
  });

  const record = rolloutService.createRollout({
    template,
    mode: "L1_suggest",
    owner: "integration@example.com",
    regressionSuiteId: "integration_suite",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.equal(record.templateKey, "integration_template");
  assert.equal(record.version, "v1");
  assert.equal(record.status, "ready");
  assert.equal(record.mode, "L1_suggest");
  assert.equal(record.guardrailSummary, "rollout_guardrail_passed");
});

test("PromptRolloutService integration - full lifecycle: create, activate, rollback", () => {
  const registry = new PromptTemplateRegistryService();
  const rolloutService = new PromptRolloutService();

  const template = registry.registerTemplate({
    templateKey: "lifecycle_template",
    version: "v1",
    owner: "lifecycle@example.com",
    fixedPrefix: "Lifecycle prefix",
    domainBlock: "Lifecycle domain",
  });

  const created = rolloutService.createRollout({
    template,
    mode: "L1_suggest",
    owner: "owner@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });
  assert.equal(created.status, "ready");

  const activated = rolloutService.activateRollout(created.rolloutId);
  assert.equal(activated.status, "active");

  const rolledBack = rolloutService.rollbackRollout(activated.rolloutId, "manual_rollback_reason");
  assert.equal(rolledBack.status, "rolled_back");
  assert.equal(rolledBack.guardrailSummary, "manual_rollback_reason");
});

test("PromptRolloutService integration - blocked rollout cannot be activated", () => {
  const registry = new PromptTemplateRegistryService();
  const rolloutService = new PromptRolloutService();

  const template = registry.registerTemplate({
    templateKey: "blocked_template",
    version: "v1",
    owner: "blocked@example.com",
    fixedPrefix: "Blocked prefix",
    domainBlock: "Blocked domain",
  });

  const blocked = rolloutService.createRollout({
    template,
    mode: "L2_shadow",
    owner: "owner@example.com",
    regressionSuiteId: "suite_blocked",
    regressionPassed: false,
    domainBlockCompatible: true,
  });

  assert.equal(blocked.status, "blocked");

  assert.throws(
    () => rolloutService.activateRollout(blocked.rolloutId),
    (err: unknown) => err instanceof Error && err.message.includes("cannot transition to active"),
  );
});

test("PromptRolloutService integration - multiple rollouts can be listed", () => {
  const registry = new PromptTemplateRegistryService();
  const rolloutService = new PromptRolloutService();

  const template1 = registry.registerTemplate({
    templateKey: "multi_template_1",
    version: "v1",
    owner: "multi@example.com",
    fixedPrefix: "Prefix 1",
    domainBlock: "Domain 1",
  });

  const template2 = registry.registerTemplate({
    templateKey: "multi_template_2",
    version: "v1",
    owner: "multi@example.com",
    fixedPrefix: "Prefix 2",
    domainBlock: "Domain 2",
  });

  rolloutService.createRollout({
    template: template1,
    mode: "L1_suggest",
    owner: "owner@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  rolloutService.createRollout({
    template: template2,
    mode: "L2_shadow",
    owner: "owner@example.com",
    regressionSuiteId: "suite_2",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  rolloutService.createRollout({
    template: template1,
    mode: "L0_off",
    owner: "owner@example.com",
    regressionSuiteId: "suite_3",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  const allRollouts = rolloutService.listRollouts();
  assert.equal(allRollouts.length, 3);

  const template1Rollouts = rolloutService.listRollouts("multi_template_1");
  assert.equal(template1Rollouts.length, 2);

  const template2Rollouts = rolloutService.listRollouts("multi_template_2");
  assert.equal(template2Rollouts.length, 1);
});

test("PromptRolloutService integration - guardrail evaluation blocks when regression fails", () => {
  const rolloutService = new PromptRolloutService();

  const decisionPass = rolloutService.evaluateGuardrail({
    mode: "L1_suggest",
    regressionPassed: true,
    domainBlockCompatible: true,
  });
  assert.equal(decisionPass.allowed, true);

  const decisionFail = rolloutService.evaluateGuardrail({
    mode: "L1_suggest",
    regressionPassed: false,
    domainBlockCompatible: true,
  });
  assert.equal(decisionFail.allowed, false);
  assert.equal(decisionFail.reason, "regression_gate_failed");
});

test("PromptRolloutService integration - guardrail evaluation blocks when domain block incompatible", () => {
  const rolloutService = new PromptRolloutService();

  const decision = rolloutService.evaluateGuardrail({
    mode: "L1_suggest",
    regressionPassed: true,
    domainBlockCompatible: false,
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "domain_block_incompatible");
});

test("PromptRolloutService integration - guardrail evaluation allows shadow mode", () => {
  const rolloutService = new PromptRolloutService();

  const decision = rolloutService.evaluateGuardrail({
    mode: "L2_shadow",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, "shadow_guardrail_passed");
});

test("PromptRolloutService integration - rollout not found throws error", () => {
  const rolloutService = new PromptRolloutService();

  assert.throws(
    () => rolloutService.activateRollout("nonexistent_id"),
    (err: unknown) => err instanceof Error && err.message.includes("not found"),
  );

  assert.throws(
    () => rolloutService.rollbackRollout("nonexistent_id", "reason"),
    (err: unknown) => err instanceof Error && err.message.includes("not found"),
  );
});

test("PromptRolloutService integration - trim whitespace from owner and regressionSuiteId", () => {
  const registry = new PromptTemplateRegistryService();
  const rolloutService = new PromptRolloutService();

  const template = registry.registerTemplate({
    templateKey: "trim_template",
    version: "v1",
    owner: "trim@example.com",
    fixedPrefix: "Trim prefix",
    domainBlock: "Trim domain",
  });

  const record = rolloutService.createRollout({
    template,
    mode: "L1_suggest",
    owner: "  trimmed_owner@example.com  ",
    regressionSuiteId: "  trimmed_suite_id  ",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.equal(record.owner, "trimmed_owner@example.com");
  assert.equal(record.regressionSuiteId, "trimmed_suite_id");
});