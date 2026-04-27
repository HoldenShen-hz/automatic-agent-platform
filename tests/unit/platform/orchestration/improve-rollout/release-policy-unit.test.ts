/**
 * Unit tests for ReleasePolicy types
 * Tests the type definitions and validation
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { ReleasePolicy, ReleasePolicyEvaluation, PolicyCheckResult, ReleaseAction } from "../../../../../src/platform/orchestration/improve-rollout/release-policy.js";

function createMockReleasePolicy(overrides: Partial<ReleasePolicy> = {}): ReleasePolicy {
  return {
    policyId: "policy_test_1",
    name: "Test Release Policy",
    description: "Policy for testing",
    targetLevels: ["shadow", "canary_5", "partial_25"],
    trafficAllocation: {
      off: 0,
      suggest: 0,
      shadow: 10,
      canary_5: 25,
      partial_25: 50,
      partial_50: 75,
      partial_75: 100,
      stable: 100,
    },
    minimumObservationWindowMs: 300_000,
    rollbackFailureRateThreshold: 0.05,
    rollbackLatencyMultiplierThreshold: 1.5,
    requiresHumanApproval: true,
    active: true,
    ...overrides,
  };
}

function createMockPolicyCheckResult(overrides: Partial<PolicyCheckResult> = {}): PolicyCheckResult {
  return {
    checkName: "test_check",
    passed: true,
    details: "Test check passed",
    severity: "info",
    ...overrides,
  };
}

function createMockPolicyEvaluation(overrides: Partial<ReleasePolicyEvaluation> = {}): ReleasePolicyEvaluation {
  return {
    policy: createMockReleasePolicy(),
    passed: true,
    checks: [createMockPolicyCheckResult()],
    recommendedAction: "promote",
    reason: "All checks passed",
    ...overrides,
  };
}

// Tests for ReleaseAction type
test("ReleaseAction accepts promote", () => {
  const evaluation = createMockPolicyEvaluation({ recommendedAction: "promote" });
  assert.equal(evaluation.recommendedAction, "promote");
});

test("ReleaseAction accepts demote", () => {
  const evaluation = createMockPolicyEvaluation({ recommendedAction: "demote" });
  assert.equal(evaluation.recommendedAction, "demote");
});

test("ReleaseAction accepts rollback", () => {
  const evaluation = createMockPolicyEvaluation({ recommendedAction: "rollback" });
  assert.equal(evaluation.recommendedAction, "rollback");
});

test("ReleaseAction accepts hold", () => {
  const evaluation = createMockPolicyEvaluation({ recommendedAction: "hold" });
  assert.equal(evaluation.recommendedAction, "hold");
});

test("ReleaseAction accepts require_approval", () => {
  const evaluation = createMockPolicyEvaluation({ recommendedAction: "require_approval" });
  assert.equal(evaluation.recommendedAction, "require_approval");
});

// Tests for ReleasePolicy
test("ReleasePolicy can be created with all fields", () => {
  const policy = createMockReleasePolicy();
  assert.equal(policy.policyId, "policy_test_1");
  assert.equal(policy.name, "Test Release Policy");
  assert.ok(Array.isArray(policy.targetLevels));
  assert.ok(typeof policy.trafficAllocation === "object");
});

test("ReleasePolicy targetLevels can be empty", () => {
  const policy = createMockReleasePolicy({ targetLevels: [] });
  assert.equal(policy.targetLevels.length, 0);
});

test("ReleasePolicy targetLevels can have multiple values", () => {
  const policy = createMockReleasePolicy({
    targetLevels: ["shadow", "canary_5", "partial_25", "partial_50", "partial_75", "stable"],
  });
  assert.equal(policy.targetLevels.length, 6);
});

test("ReleasePolicy trafficAllocation can have custom values", () => {
  const policy = createMockReleasePolicy({
    trafficAllocation: {
      off: 0,
      suggest: 5,
      shadow: 15,
      canary_5: 30,
      partial_25: 50,
      partial_50: 70,
      partial_75: 90,
      stable: 100,
    },
  });
  assert.equal(policy.trafficAllocation["suggest"], 5);
  assert.equal(policy.trafficAllocation["canary_5"], 30);
});

test("ReleasePolicy rollbackFailureRateThreshold can be 0", () => {
  const policy = createMockReleasePolicy({ rollbackFailureRateThreshold: 0 });
  assert.equal(policy.rollbackFailureRateThreshold, 0);
});

test("ReleasePolicy rollbackFailureRateThreshold can be 1", () => {
  const policy = createMockReleasePolicy({ rollbackFailureRateThreshold: 1 });
  assert.equal(policy.rollbackFailureRateThreshold, 1);
});

test("ReleasePolicy rollbackLatencyMultiplierThreshold can be greater than 1", () => {
  const policy = createMockReleasePolicy({ rollbackLatencyMultiplierThreshold: 3.0 });
  assert.equal(policy.rollbackLatencyMultiplierThreshold, 3.0);
});

test("ReleasePolicy minimumObservationWindowMs can be 0", () => {
  const policy = createMockReleasePolicy({ minimumObservationWindowMs: 0 });
  assert.equal(policy.minimumObservationWindowMs, 0);
});

test("ReleasePolicy active can be false", () => {
  const policy = createMockReleasePolicy({ active: false });
  assert.equal(policy.active, false);
});

test("ReleasePolicy requiresHumanApproval can be false", () => {
  const policy = createMockReleasePolicy({ requiresHumanApproval: false });
  assert.equal(policy.requiresHumanApproval, false);
});

// Tests for ReleasePolicyEvaluation
test("ReleasePolicyEvaluation can be created with passed=true", () => {
  const evaluation = createMockPolicyEvaluation({
    passed: true,
    checks: [createMockPolicyCheckResult({ passed: true })],
  });
  assert.equal(evaluation.passed, true);
});

test("ReleasePolicyEvaluation can be created with passed=false", () => {
  const evaluation = createMockPolicyEvaluation({
    passed: false,
    checks: [createMockPolicyCheckResult({ passed: false })],
  });
  assert.equal(evaluation.passed, false);
});

test("ReleasePolicyEvaluation checks can be empty", () => {
  const evaluation = createMockPolicyEvaluation({ checks: [] });
  assert.equal(evaluation.checks.length, 0);
});

test("ReleasePolicyEvaluation can have multiple checks", () => {
  const evaluation = createMockPolicyEvaluation({
    checks: [
      createMockPolicyCheckResult({ checkName: "check1", passed: true }),
      createMockPolicyCheckResult({ checkName: "check2", passed: true }),
      createMockPolicyCheckResult({ checkName: "check3", passed: false, severity: "critical" }),
    ],
  });
  assert.equal(evaluation.checks.length, 3);
});

// Tests for PolicyCheckResult
test("PolicyCheckResult can have severity info", () => {
  const check = createMockPolicyCheckResult({ severity: "info" });
  assert.equal(check.severity, "info");
});

test("PolicyCheckResult can have severity warning", () => {
  const check = createMockPolicyCheckResult({ severity: "warning" });
  assert.equal(check.severity, "warning");
});

test("PolicyCheckResult can have severity critical", () => {
  const check = createMockPolicyCheckResult({ severity: "critical" });
  assert.equal(check.severity, "critical");
});

test("PolicyCheckResult passed can be false with critical severity", () => {
  const check = createMockPolicyCheckResult({
    passed: false,
    severity: "critical",
    details: "Critical failure",
  });
  assert.equal(check.passed, false);
  assert.equal(check.severity, "critical");
});

test("PolicyCheckResult passed can be true with warning severity", () => {
  const check = createMockPolicyCheckResult({
    passed: true,
    severity: "warning",
    details: "Warning but still passed",
  });
  assert.equal(check.passed, true);
  assert.equal(check.severity, "warning");
});

test("PolicyCheckResult details can be empty string", () => {
  const check = createMockPolicyCheckResult({ details: "" });
  assert.equal(check.details, "");
});

test("PolicyCheckResult checkName can be any string", () => {
  const check = createMockPolicyCheckResult({ checkName: "custom-check-name" });
  assert.equal(check.checkName, "custom-check-name");
});
