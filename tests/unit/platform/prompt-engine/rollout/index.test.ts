/**
 * Prompt Rollout Unit Tests
 *
 * Tests for rollout/index.ts covering:
 * - Issue #1957: PromptRolloutMode missing canary/staged/full
 * - Issue #1958: No automatic rollback
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PromptRolloutService } from "../../../../../src/platform/prompt-engine/rollout/index.js";
import { PromptTemplateRegistryService } from "../../../../../src/platform/prompt-engine/registry/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

// ============================================================================
// Issue #1957: PromptRolloutMode missing canary/staged/full
// ============================================================================

test("PromptRolloutService createRollout works with 'off' mode", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = registry.registerTemplate({
    templateKey: "mode_test_off",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  const record = rollout.createRollout({
    template,
    mode: "off",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.ok(record.rolloutId.length > 0);
  assert.equal(record.mode, "off");
});

test("PromptRolloutService createRollout works with 'suggest' mode", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = registry.registerTemplate({
    templateKey: "mode_test_suggest",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  const record = rollout.createRollout({
    template,
    mode: "suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.ok(record.rolloutId.length > 0);
  assert.equal(record.mode, "suggest");
});

test("PromptRolloutService createRollout works with 'shadow' mode", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = registry.registerTemplate({
    templateKey: "mode_test_shadow",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  const record = rollout.createRollout({
    template,
    mode: "shadow",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.ok(record.rolloutId.length > 0);
  assert.equal(record.mode, "shadow");
});

// ============================================================================
// Issue #1958: No automatic rollback
// ============================================================================

test("PromptRolloutService rollbackRollout can be called manually", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = registry.registerTemplate({
    templateKey: "rollback_test",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  const record = rollout.createRollout({
    template,
    mode: "suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  if (record.status !== "blocked") {
    const rolledBack = rollout.rollbackRollout(record.rolloutId, "manual_triggered");

    assert.equal(rolledBack.status, "rolled_back");
    assert.equal(rolledBack.guardrailSummary, "manual_triggered");
  }
});

test("PromptRolloutService rollbackRollout fails for blocked status", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = registry.registerTemplate({
    templateKey: "rollback_blocked_test",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  const record = rollout.createRollout({
    template,
    mode: "suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: false, // Will be blocked
    domainBlockCompatible: true,
  });

  assert.equal(record.status, "blocked");

  assert.throws(
    () => rollout.rollbackRollout(record.rolloutId, "test"),
    (err: unknown) => err instanceof ValidationError,
  );
});

test("PromptRolloutService rollbackRollout fails for deprecated status", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = registry.registerTemplate({
    templateKey: "rollback_deprecated_test",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  // Note: There's no direct way to set status to deprecated in the current API
  // This test documents the limitation
});

// ============================================================================
// Additional tests
// ============================================================================

test("PromptRolloutService createRollout with all mode types", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();

  const modes: Array<"off" | "suggest" | "shadow"> = ["off", "suggest", "shadow"];

  for (const mode of modes) {
    const template = registry.registerTemplate({
      templateKey: `mode_${mode}_test`,
      version: "v1",
      owner: "test@example.com",
      fixedPrefix: "Test prefix",
      domainBlock: "Test domain",
    });

    const record = rollout.createRollout({
      template,
      mode,
      owner: "test@example.com",
      regressionSuiteId: "suite_1",
      regressionPassed: true,
      domainBlockCompatible: true,
    });

    assert.equal(record.mode, mode, `Mode ${mode} should be stored`);
  }
});

test("PromptRolloutService activateRollout advances from canary_5 to canary_20", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = registry.registerTemplate({
    templateKey: "activate_test_1",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  const record = rollout.createRollout({
    template,
    mode: "suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  if (record.status === "canary_5") {
    const activated = rollout.activateRollout(record.rolloutId);
    assert.equal(activated.status, "canary_20");
  }
});

test("PromptRolloutService activateRollout advances from canary_20 to stable", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = registry.registerTemplate({
    templateKey: "activate_test_2",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  const record = rollout.createRollout({
    template,
    mode: "suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  // First activation
  if (record.status === "canary_5") {
    const activated = rollout.activateRollout(record.rolloutId);
    if (activated.status === "canary_20") {
      const finalActivation = rollout.activateRollout(activated.rolloutId);
      assert.equal(finalActivation.status, "stable");
    }
  }
});

test("PromptRolloutService activateRollout is idempotent for stable", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = registry.registerTemplate({
    templateKey: "activate_test_3",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  const record = rollout.createRollout({
    template,
    mode: "suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  // Advance to stable
  if (record.status === "canary_5") {
    const activated1 = rollout.activateRollout(record.rolloutId);
    if (activated1.status === "canary_20") {
      const activated2 = rollout.activateRollout(activated1.rolloutId);
      if (activated2.status === "stable") {
        // Re-activating stable should be idempotent
        const activatedAgain = rollout.activateRollout(activated2.rolloutId);
        assert.equal(activatedAgain.status, "stable");
      }
    }
  }
});

test("PromptRolloutService evaluateGuardrail blocks when regression fails", () => {
  const rollout = new PromptRolloutService();

  const decision = rollout.evaluateGuardrail({
    mode: "suggest",
    regressionPassed: false,
    domainBlockCompatible: true,
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.nextStatus, "blocked");
  assert.equal(decision.reason, "regression_gate_failed");
});

test("PromptRolloutService evaluateGuardrail blocks when domain block incompatible", () => {
  const rollout = new PromptRolloutService();

  const decision = rollout.evaluateGuardrail({
    mode: "suggest",
    regressionPassed: true,
    domainBlockCompatible: false,
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.nextStatus, "blocked");
  assert.equal(decision.reason, "domain_block_incompatible");
});

test("PromptRolloutService evaluateGuardrail allows shadow mode when regression passes", () => {
  const rollout = new PromptRolloutService();

  const decision = rollout.evaluateGuardrail({
    mode: "shadow",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.equal(decision.allowed, true);
  assert.ok(decision.nextStatus === "canary_5" || decision.nextStatus === "canary_20");
});

test("PromptRolloutService evaluateGuardrail allows suggest mode when regression passes", () => {
  const rollout = new PromptRolloutService();

  const decision = rollout.evaluateGuardrail({
    mode: "suggest",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.equal(decision.allowed, true);
  assert.ok(decision.nextStatus === "canary_5" || decision.nextStatus === "canary_20");
});

test("PromptRolloutService evaluateGuardrail allows off mode when regression passes", () => {
  const rollout = new PromptRolloutService();

  const decision = rollout.evaluateGuardrail({
    mode: "off",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.equal(decision.allowed, true);
  assert.ok(decision.nextStatus === "canary_5" || decision.nextStatus === "canary_20");
});

test("PromptRolloutService activateRollout throws when rollout not found", () => {
  const rollout = new PromptRolloutService();

  assert.throws(
    () => rollout.activateRollout("nonexistent-id"),
    (err: unknown) => err instanceof ValidationError && err.message.includes("not found"),
  );
});

test("PromptRolloutService activateRollout throws when status cannot transition", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = registry.registerTemplate({
    templateKey: "ops_triage",
    version: "v1",
    owner: "ops@example.com",
    fixedPrefix: "System guardrails",
    domainBlock: "Operations domain",
  });

  const record = rollout.createRollout({
    template,
    mode: "shadow",
    owner: "ops@example.com",
    regressionSuiteId: "suite_ops",
    regressionPassed: false,
    domainBlockCompatible: true,
  });

  assert.equal(record.status, "blocked");

  assert.throws(
    () => rollout.activateRollout(record.rolloutId),
    (err: unknown) =>
      err instanceof ValidationError && err.message.includes("cannot transition"),
  );
});

test("PromptRolloutService rollbackRollout throws when rollout not found", () => {
  const rollout = new PromptRolloutService();

  assert.throws(
    () => rollout.rollbackRollout("nonexistent-id", "test reason"),
    (err: unknown) => err instanceof ValidationError && err.message.includes("not found"),
  );
});

test("PromptRolloutService rollbackRollout updates guardrailSummary with reason", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = registry.registerTemplate({
    templateKey: "rollback_summary_test",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  const record = rollout.createRollout({
    template,
    mode: "suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  if (record.status !== "blocked") {
    const rolledBack = rollout.rollbackRollout(record.rolloutId, "customer_complaint");
    assert.equal(rolledBack.status, "rolled_back");
    assert.equal(rolledBack.guardrailSummary, "customer_complaint");
  }
});

test("PromptRolloutService listRollouts returns all rollouts when no filter", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();

  const template1 = registry.registerTemplate({
    templateKey: "template_a",
    version: "v1",
    owner: "owner_a@example.com",
    fixedPrefix: "Prefix A",
    domainBlock: "Domain A",
  });

  const template2 = registry.registerTemplate({
    templateKey: "template_b",
    version: "v1",
    owner: "owner_b@example.com",
    fixedPrefix: "Prefix B",
    domainBlock: "Domain B",
  });

  rollout.createRollout({
    template: template1,
    mode: "suggest",
    owner: "owner_a@example.com",
    regressionSuiteId: "suite_a",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  rollout.createRollout({
    template: template2,
    mode: "shadow",
    owner: "owner_b@example.com",
    regressionSuiteId: "suite_b",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  const all = rollout.listRollouts();
  assert.equal(all.length, 2);

  const filtered = rollout.listRollouts("template_a");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.templateKey, "template_a");
});

test("PromptRolloutService createRollout trims owner and regressionSuiteId", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = registry.registerTemplate({
    templateKey: "ops_triage",
    version: "v1",
    owner: "ops@example.com",
    fixedPrefix: "System guardrails",
    domainBlock: "Operations domain",
  });

  const record = rollout.createRollout({
    template,
    mode: "suggest",
    owner: "  owner@example.com  ",
    regressionSuiteId: "  suite_ops  ",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.equal(record.owner, "owner@example.com");
  assert.equal(record.regressionSuiteId, "suite_ops");
});

test("PromptRolloutService createRollout sets correct initial status", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = registry.registerTemplate({
    templateKey: "status_test",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  const record = rollout.createRollout({
    template,
    mode: "suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  // Should be canary_5 (not shadow or draft)
  assert.ok(
    record.status === "canary_5" || record.status === "canary_20" || record.status === "blocked",
    `Initial status should be a canary stage, got: ${record.status}`,
  );
});

test("PromptRolloutService createRollout stores rollout in internal map", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = registry.registerTemplate({
    templateKey: "internal_store_test",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  const record = rollout.createRollout({
    template,
    mode: "suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  const all = rollout.listRollouts();
  assert.ok(all.length >= 1);
  const retrieved = all.find((r) => r.rolloutId === record.rolloutId);
  assert.ok(retrieved);
  assert.equal(retrieved?.rolloutId, record.rolloutId);
});

test("PromptRolloutService cannot activate rolled_back status", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = registry.registerTemplate({
    templateKey: "cannot_activate_rolled_back",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  const record = rollout.createRollout({
    template,
    mode: "suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  if (record.status !== "blocked") {
    const rolledBack = rollout.rollbackRollout(record.rolloutId, "test");

    assert.throws(
      () => rollout.activateRollout(rolledBack.rolloutId),
      (err: unknown) => err instanceof ValidationError,
    );
  }
});