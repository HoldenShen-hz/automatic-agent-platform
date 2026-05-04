import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import { PromptTemplateRegistryService } from "../../../../../src/platform/prompt-engine/registry/index.js";
import { PromptRolloutService } from "../../../../../src/platform/prompt-engine/rollout/index.js";

function createTemplate(templateKey: string, version = 1) {
  const registry = new PromptTemplateRegistryService();
  return registry.registerTemplate({
    templateKey,
    version,
    displayVersion: `v${version}.0.0`,
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });
}

function rewindStatusEnteredAt(service: PromptRolloutService, rolloutId: string, hours = 25): void {
  const record = service.listRollouts().find((item) => item.rolloutId === rolloutId);
  if (!record) {
    throw new Error(`Missing rollout ${rolloutId}`);
  }
  record.statusEnteredAt = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

test("PromptRolloutService accepts canary mode and starts at canary_5", () => {
  const rollout = new PromptRolloutService();
  const record = rollout.createRollout({
    template: createTemplate("mode_test_canary"),
    mode: "canary",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.equal(record.mode, "canary");
  assert.equal(record.status, "canary_5");
});

test("PromptRolloutService blocks rollout when regression gate fails", () => {
  const rollout = new PromptRolloutService();
  const record = rollout.createRollout({
    template: createTemplate("mode_test_blocked"),
    mode: "suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_2",
    regressionPassed: false,
    domainBlockCompatible: true,
  });

  assert.equal(record.status, "blocked");
});

test("PromptRolloutService enforces dwell time before activation", () => {
  const rollout = new PromptRolloutService();
  const record = rollout.createRollout({
    template: createTemplate("dwell_guard"),
    mode: "canary",
    owner: "test@example.com",
    regressionSuiteId: "suite_3",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.throws(
    () => rollout.activateRollout(record.rolloutId),
    (error: unknown) => error instanceof ValidationError && error.code.startsWith("prompt_rollout.dwell_time_not_met"),
  );
});

test("PromptRolloutService advances canary_5 to canary_20 after dwell time", () => {
  const rollout = new PromptRolloutService();
  const record = rollout.createRollout({
    template: createTemplate("advance_to_canary_20"),
    mode: "canary",
    owner: "test@example.com",
    regressionSuiteId: "suite_4",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  rewindStatusEnteredAt(rollout, record.rolloutId);
  const updated = rollout.activateRollout(record.rolloutId);

  assert.equal(updated.status, "canary_20");
});

test("PromptRolloutService advances canary_20 to stable after a second dwell window", () => {
  const rollout = new PromptRolloutService();
  const record = rollout.createRollout({
    template: createTemplate("advance_to_stable"),
    mode: "canary",
    owner: "test@example.com",
    regressionSuiteId: "suite_5",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  rewindStatusEnteredAt(rollout, record.rolloutId);
  rollout.activateRollout(record.rolloutId);
  rewindStatusEnteredAt(rollout, record.rolloutId);
  const stable = rollout.activateRollout(record.rolloutId);

  assert.equal(stable.status, "stable");
});

test("PromptRolloutService does not advance stable via activateRollout", () => {
  const rollout = new PromptRolloutService();
  const record = rollout.createRollout({
    template: createTemplate("stable_is_terminal"),
    mode: "canary",
    owner: "test@example.com",
    regressionSuiteId: "suite_6",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  rewindStatusEnteredAt(rollout, record.rolloutId);
  rollout.activateRollout(record.rolloutId);
  rewindStatusEnteredAt(rollout, record.rolloutId);
  rollout.activateRollout(record.rolloutId);

  assert.throws(
    () => rollout.activateRollout(record.rolloutId),
    (error: unknown) => error instanceof ValidationError && error.code.startsWith("prompt_rollout.invalid_transition"),
  );
});

test("PromptRolloutService rollbackRollout only applies to active rollout states", () => {
  const rollout = new PromptRolloutService();
  const active = rollout.createRollout({
    template: createTemplate("rollback_active"),
    mode: "canary",
    owner: "test@example.com",
    regressionSuiteId: "suite_7",
    regressionPassed: true,
    domainBlockCompatible: true,
  });
  const blocked = rollout.createRollout({
    template: createTemplate("rollback_blocked"),
    mode: "canary",
    owner: "test@example.com",
    regressionSuiteId: "suite_8",
    regressionPassed: false,
    domainBlockCompatible: true,
  });

  const rolledBack = rollout.rollbackRollout(active.rolloutId, "manual_triggered");
  assert.equal(rolledBack.status, "rolled_back");
  assert.equal(rolledBack.guardrailSummary, "manual_triggered");

  assert.throws(
    () => rollout.rollbackRollout(blocked.rolloutId, "should_fail"),
    (error: unknown) => error instanceof ValidationError && error.code.startsWith("prompt_rollout.invalid_transition"),
  );
});
