/**
 * Integration tests for prompt rollout stage
 * Tests the full rollout lifecycle: create -> activate -> rollback
 *
 * These tests are updated to match the R16-04 state machine:
 * - Initial status is set by evaluateGuardrail based on rollout mode
 * - Stage progression: canary_5 -> canary_20 -> stable
 * - blocked status cannot be rolled back
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  PromptRolloutService,
  type PromptRolloutMode,
  type PromptRolloutStatus,
} from "../../../../src/platform/prompt-engine/rollout/index.js";
import type { PromptTemplateRecord } from "../../../../src/platform/prompt-engine/registry/index.js";

<<<<<<< Updated upstream
test("PromptRolloutService.createRollout creates a canary_5 rollout when regression passes", () => {
=======
test("PromptRolloutService.createRollout creates canary_5 rollout with L1_suggest mode when regression passes", () => {
>>>>>>> Stashed changes
  const service = new PromptRolloutService();

  const template = createMockTemplate("tpl_test_1", "v1.0");
  const record = service.createRollout({
    template,
    mode: "L1_suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_123",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.equal(record.status, "canary_5");
  assert.equal(record.templateKey, "tpl_test_1");
  assert.equal(record.version, "v1.0");
  assert.ok(record.rolloutId.startsWith("prompt_rollout_"));
});

test("PromptRolloutService.createRollout creates a blocked rollout when regression fails", () => {
  const service = new PromptRolloutService();

  const template = createMockTemplate("tpl_test_2", "v1.0");
  const record = service.createRollout({
    template,
    mode: "L1_suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_456",
    regressionPassed: false,
    domainBlockCompatible: true,
  });

  assert.equal(record.status, "blocked");
  assert.ok(record.guardrailSummary.includes("regression_gate_failed"));
});

test("PromptRolloutService.createRollout blocks when domain block incompatible", () => {
  const service = new PromptRolloutService();

  const template = createMockTemplate("tpl_test_3", "v1.0");
  const record = service.createRollout({
    template,
    mode: "L1_suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_789",
    regressionPassed: true,
    domainBlockCompatible: false,
  });

  assert.equal(record.status, "blocked");
  assert.ok(record.guardrailSummary.includes("domain_block_incompatible"));
});

test("PromptRolloutService.activateRollout transitions canary_5 to canary_20", () => {
  const service = new PromptRolloutService();

  const template = createMockTemplate("tpl_test_4", "v1.0");
  const created = service.createRollout({
    template,
    mode: "L1_suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_abc",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.equal(created.status, "canary_5");

  const activated = service.activateRollout(created.rolloutId);
  assert.equal(activated.status, "canary_20");
});

<<<<<<< Updated upstream
test("PromptRolloutService.activateRollout transitions canary_20 to stable", () => {
=======
test("PromptRolloutService.activateRollout throws for stable rollout (already fully deployed)", () => {
>>>>>>> Stashed changes
  const service = new PromptRolloutService();

  const template = createMockTemplate("tpl_test_5", "v1.0");
  // L5_stable creates rollout directly in stable status
  const created = service.createRollout({
    template,
    mode: "L5_stable",
    owner: "test@example.com",
    regressionSuiteId: "suite_def",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

<<<<<<< Updated upstream
  // Activate from canary_5 to canary_20
  const canary20 = service.activateRollout(created.rolloutId);
  assert.equal(canary20.status, "canary_20");

  // Activate again from canary_20 -> stable
  const stable = service.activateRollout(created.rolloutId);
  assert.equal(stable.status, "stable");
=======
  assert.equal(created.status, "stable");

  // Try to activate stable - should throw
  assert.throws(
    () => service.activateRollout(created.rolloutId),
    /cannot transition to active/,
  );
>>>>>>> Stashed changes
});

test("PromptRolloutService.rollbackRollout sets status to rolled_back", () => {
  const service = new PromptRolloutService();

  const template = createMockTemplate("tpl_test_6", "v1.0");
  const created = service.createRollout({
    template,
    mode: "L2_shadow",
    owner: "test@example.com",
    regressionSuiteId: "suite_ghi",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  const rolledBack = service.rollbackRollout(created.rolloutId, "Test rollback reason");

  assert.equal(rolledBack.status, "rolled_back");
  assert.equal(rolledBack.guardrailSummary, "Test rollback reason");
});

<<<<<<< Updated upstream
test("PromptRolloutService.rollbackRollout works on canary_5 status", () => {
=======
test("PromptRolloutService.rollbackRollout works on canary_5, canary_20, and stable statuses", () => {
>>>>>>> Stashed changes
  const service = new PromptRolloutService();

  // L3_canary creates canary_5 status
  const template = createMockTemplate("tpl_test_7", "v1.0");
  const created = service.createRollout({
    template,
<<<<<<< Updated upstream
    mode: "L1_suggest",
=======
    mode: "L3_canary",
>>>>>>> Stashed changes
    owner: "test@example.com",
    regressionSuiteId: "suite_jkl",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

<<<<<<< Updated upstream
  // Rollback directly from canary_5 status
  assert.equal(created.status, "canary_5");
  const rolledBack = service.rollbackRollout(created.rolloutId, "Emergency rollback");
=======
  assert.equal(created.status, "canary_5");
>>>>>>> Stashed changes

  // Rollback from canary_5 works
  const rolledBack = service.rollbackRollout(created.rolloutId, "Emergency rollback");
  assert.equal(rolledBack.status, "rolled_back");
});

test("PromptRolloutService.rollbackRollout throws for blocked rollout", () => {
  const service = new PromptRolloutService();

  const template = createMockTemplate("tpl_test_8", "v1.0");
  // L0_off creates blocked rollout
  const created = service.createRollout({
    template,
    mode: "L0_off",
    owner: "test@example.com",
    regressionSuiteId: "suite_mno",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.equal(created.status, "blocked");

  // Rollback from blocked should throw
  assert.throws(
    () => service.rollbackRollout(created.rolloutId, "rollback reason"),
    /cannot be rolled back/,
  );
});

test("PromptRolloutService.listRollouts returns all rollouts when no filter", () => {
  const service = new PromptRolloutService();

  const tpl1 = createMockTemplate("tpl_list_1", "v1.0");
  const tpl2 = createMockTemplate("tpl_list_2", "v1.0");

  service.createRollout({
    template: tpl1,
    mode: "L0_off",
    owner: "owner1@example.com",
    regressionSuiteId: "s1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  service.createRollout({
    template: tpl2,
    mode: "L1_suggest",
    owner: "owner2@example.com",
    regressionSuiteId: "s2",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  const all = service.listRollouts();
  assert.ok(all.length >= 2);
});

test("PromptRolloutService.listRollouts filters by templateKey", () => {
  const service = new PromptRolloutService();

  const tplA = createMockTemplate("tpl_filter_a", "v1.0");
  const tplB = createMockTemplate("tpl_filter_b", "v1.0");

  service.createRollout({
    template: tplA,
    mode: "L0_off",
    owner: "owner@example.com",
    regressionSuiteId: "sA",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  service.createRollout({
    template: tplB,
    mode: "L1_suggest",
    owner: "owner@example.com",
    regressionSuiteId: "sB",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  const filtered = service.listRollouts("tpl_filter_a");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]!.templateKey, "tpl_filter_a");
});

test("PromptRolloutService.evaluateGuardrail allows shadow mode with passing regression", () => {
  const service = new PromptRolloutService();

  const decision = service.evaluateGuardrail({
    mode: "L2_shadow",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.nextStatus, "canary_5");
  assert.ok(decision.reason.includes("shadow"));
});

test("PromptRolloutService.evaluateGuardrail blocks failed regression", () => {
  const service = new PromptRolloutService();

  const decision = service.evaluateGuardrail({
    mode: "L0_off",
    regressionPassed: false,
    domainBlockCompatible: true,
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.nextStatus, "blocked");
  assert.ok(decision.reason.includes("regression"));
});

test("PromptRolloutService evaluateGuardrail blocks incompatible domain", () => {
  const service = new PromptRolloutService();

  const decision = service.evaluateGuardrail({
    mode: "L1_suggest",
    regressionPassed: true,
    domainBlockCompatible: false,
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.nextStatus, "blocked");
  assert.ok(decision.reason.includes("domain_block"));
});

test("PromptRolloutService multiple rollouts can coexist", () => {
  const service = new PromptRolloutService();

  const rollouts = [];
  for (let i = 0; i < 5; i++) {
    const tpl = createMockTemplate(`tpl_multi_${i}`, "v1.0");
    const record = service.createRollout({
      template: tpl,
      mode: "L1_suggest",
      owner: `owner${i}@example.com`,
      regressionSuiteId: `suite_${i}`,
      regressionPassed: true,
      domainBlockCompatible: true,
    });
    rollouts.push(record);
  }

  const all = service.listRollouts();
  assert.ok(all.length >= 5);
});

test("PromptRolloutService L4_partial creates canary_20 status directly", () => {
  const service = new PromptRolloutService();

  const template = createMockTemplate("tpl_partial_test", "v1.0");
  const record = service.createRollout({
    template,
    mode: "L4_partial",
    owner: "test@example.com",
    regressionSuiteId: "suite_partial",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.equal(record.status, "canary_20");
});

test("PromptRolloutService L5_stable creates stable status directly", () => {
  const service = new PromptRolloutService();

  const template = createMockTemplate("tpl_stable_test", "v1.0");
  const record = service.createRollout({
    template,
    mode: "L5_stable",
    owner: "test@example.com",
    regressionSuiteId: "suite_stable",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.equal(record.status, "stable");
});

// Helper
function createMockTemplate(key: string, version: string): PromptTemplateRecord {
  return {
    templateKey: key,
    version,
    owner: "test@example.com",
    channel: "system",
    role: "system",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
    variableSuffixTemplate: "",
    variableSpecs: [],
    compatibilityTags: [],
    fixedPrefixHash: "abc123def456",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}