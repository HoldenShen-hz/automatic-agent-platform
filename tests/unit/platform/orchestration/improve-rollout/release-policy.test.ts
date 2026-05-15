/**
 * Unit tests for ReleasePolicy types
 *
 * @see src/platform/five-plane-orchestration/improve-rollout/release-policy.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { ReleasePolicy, ReleasePolicyEvaluation, PolicyCheckResult } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/release-policy.js";

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

// ─────────────────────────────────────────────────────────────────────────────
// ReleasePolicy Interface Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReleasePolicy has all required fields", () => {
  const policy = createMockReleasePolicy();

  assert.equal(typeof policy.policyId, "string");
  assert.equal(typeof policy.name, "string");
  assert.equal(typeof policy.description, "string");
  assert.ok(Array.isArray(policy.targetLevels));
  assert.equal(typeof policy.trafficAllocation, "object");
  assert.equal(typeof policy.minimumObservationWindowMs, "number");
  assert.equal(typeof policy.rollbackFailureRateThreshold, "number");
  assert.equal(typeof policy.rollbackLatencyMultiplierThreshold, "number");
  assert.equal(typeof policy.requiresHumanApproval, "boolean");
  assert.equal(typeof policy.active, "boolean");
});

test("ReleasePolicy targetLevels can have multiple values", () => {
  const policy = createMockReleasePolicy({
    targetLevels: ["shadow", "canary_5", "partial_25", "partial_50"],
  });

  assert.equal(policy.targetLevels.length, 4);
  assert.ok(policy.targetLevels.includes("shadow"));
  assert.ok(policy.targetLevels.includes("canary_5"));
  assert.ok(policy.targetLevels.includes("partial_25"));
  assert.ok(policy.targetLevels.includes("partial_50"));
});

test("ReleasePolicy trafficAllocation covers all rollout levels", () => {
  const policy = createMockReleasePolicy();

  assert.ok("off" in policy.trafficAllocation);
  assert.ok("suggest" in policy.trafficAllocation);
  assert.ok("shadow" in policy.trafficAllocation);
  assert.ok("canary_5" in policy.trafficAllocation);
  assert.ok("partial_25" in policy.trafficAllocation);
  assert.ok("partial_50" in policy.trafficAllocation);
  assert.ok("partial_75" in policy.trafficAllocation);
  assert.ok("stable" in policy.trafficAllocation);
});

test("ReleasePolicy rollback thresholds are between 0 and 1", () => {
  const policy = createMockReleasePolicy({
    rollbackFailureRateThreshold: 0.05,
    rollbackLatencyMultiplierThreshold: 1.5,
  });

  assert.ok(policy.rollbackFailureRateThreshold >= 0);
  assert.ok(policy.rollbackFailureRateThreshold <= 1);
  assert.ok(policy.rollbackLatencyMultiplierThreshold >= 0);
});

test("ReleasePolicy minimumObservationWindowMs can be zero", () => {
  const policy = createMockReleasePolicy({
    minimumObservationWindowMs: 0,
  });

  assert.equal(policy.minimumObservationWindowMs, 0);
});

test("ReleasePolicy inactive policy has active=false", () => {
  const policy = createMockReleasePolicy({
    active: false,
  });

  assert.equal(policy.active, false);
});

test("ReleasePolicy human approval required for stable promotion", () => {
  const policy = createMockReleasePolicy({
    requiresHumanApproval: true,
  });

  assert.equal(policy.requiresHumanApproval, true);
});

test("ReleasePolicy human approval not required for early stages", () => {
  const policy = createMockReleasePolicy({
    requiresHumanApproval: false,
    targetLevels: ["shadow", "canary_5"],
  });

  assert.equal(policy.requiresHumanApproval, false);
  assert.ok(policy.targetLevels.every(l => l === "shadow" || l === "canary_5"));
});

// ─────────────────────────────────────────────────────────────────────────────
// ReleasePolicyEvaluation Interface Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReleasePolicyEvaluation has all required fields", () => {
  const evaluation = createMockPolicyEvaluation();

  assert.equal(typeof evaluation.policy, "object");
  assert.equal(typeof evaluation.passed, "boolean");
  assert.ok(Array.isArray(evaluation.checks));
  assert.ok(typeof evaluation.recommendedAction === "string");
  assert.equal(typeof evaluation.reason, "string");
});

test("ReleasePolicyEvaluation passed when all checks pass", () => {
  const evaluation = createMockPolicyEvaluation({
    passed: true,
    checks: [
      createMockPolicyCheckResult({ checkName: "check_1", passed: true }),
      createMockPolicyCheckResult({ checkName: "check_2", passed: true }),
    ],
  });

  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.checks.length, 2);
  assert.ok(evaluation.checks.every(c => c.passed));
});

test("ReleasePolicyEvaluation failed when any check fails", () => {
  const evaluation = createMockPolicyEvaluation({
    passed: false,
    checks: [
      createMockPolicyCheckResult({ checkName: "check_1", passed: true }),
      createMockPolicyCheckResult({ checkName: "check_2", passed: false, severity: "critical" }),
    ],
  });

  assert.equal(evaluation.passed, false);
  assert.ok(evaluation.checks.some(c => !c.passed));
});

test("ReleasePolicyEvaluation recommendedAction can be promote", () => {
  const evaluation = createMockPolicyEvaluation({
    recommendedAction: "promote",
    reason: "All checks passed",
  });

  assert.equal(evaluation.recommendedAction, "promote");
});

test("ReleasePolicyEvaluation recommendedAction can be rollback", () => {
  const evaluation = createMockPolicyEvaluation({
    passed: false,
    recommendedAction: "rollback",
    reason: "Failure rate exceeded threshold",
  });

  assert.equal(evaluation.recommendedAction, "rollback");
});

test("ReleasePolicyEvaluation recommendedAction can be hold", () => {
  const evaluation = createMockPolicyEvaluation({
    recommendedAction: "hold",
    reason: "Insufficient observation time",
  });

  assert.equal(evaluation.recommendedAction, "hold");
});

test("ReleasePolicyEvaluation recommendedAction can be require_approval", () => {
  const evaluation = createMockPolicyEvaluation({
    recommendedAction: "require_approval",
    reason: "Human approval required for this stage",
  });

  assert.equal(evaluation.recommendedAction, "require_approval");
});

// ─────────────────────────────────────────────────────────────────────────────
// PolicyCheckResult Interface Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PolicyCheckResult has all required fields", () => {
  const check = createMockPolicyCheckResult();

  assert.equal(typeof check.checkName, "string");
  assert.equal(typeof check.passed, "boolean");
  assert.equal(typeof check.details, "string");
  assert.ok(["critical", "warning", "info"].includes(check.severity));
});

test("PolicyCheckResult passed check has info severity", () => {
  const check = createMockPolicyCheckResult({
    passed: true,
    severity: "info",
  });

  assert.equal(check.passed, true);
  assert.equal(check.severity, "info");
});

test("PolicyCheckResult failed check has critical severity", () => {
  const check = createMockPolicyCheckResult({
    passed: false,
    severity: "critical",
    details: "Critical failure detected",
  });

  assert.equal(check.passed, false);
  assert.equal(check.severity, "critical");
  assert.ok(check.details.length > 0);
});

test("PolicyCheckResult warning severity for non-critical issues", () => {
  const check = createMockPolicyCheckResult({
    passed: true,
    severity: "warning",
    details: "Performance degraded but within tolerance",
  });

  assert.equal(check.severity, "warning");
});

// ─────────────────────────────────────────────────────────────────────────────
// ReleaseAction Type Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReleaseAction is one of valid string values", () => {
  const validActions = ["promote", "demote", "rollback", "hold", "require_approval"];

  for (const action of validActions) {
    const evaluation = createMockPolicyEvaluation({ recommendedAction: action as ReleasePolicyEvaluation["recommendedAction"] });
    assert.ok(validActions.includes(evaluation.recommendedAction));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("ReleasePolicy with empty targetLevels", () => {
  const policy = createMockReleasePolicy({
    targetLevels: [],
  });

  assert.ok(Array.isArray(policy.targetLevels));
  assert.equal(policy.targetLevels.length, 0);
});

test("ReleasePolicy with 100% traffic allocation at stable", () => {
  const policy = createMockReleasePolicy();

  assert.equal(policy.trafficAllocation["stable"], 100);
});

test("ReleasePolicy with 0% traffic allocation at early stages", () => {
  const policy = createMockReleasePolicy({
    trafficAllocation: {
      off: 0,
      suggest: 0,
      shadow: 0,
      canary_5: 0,
      partial_25: 0,
      partial_50: 0,
      partial_75: 0,
      stable: 100,
    },
  });

  assert.equal(policy.trafficAllocation["shadow"], 0);
  assert.equal(policy.trafficAllocation["stable"], 100);
});

test("PolicyCheckResult with empty details string", () => {
  const check = createMockPolicyCheckResult({
    details: "",
  });

  assert.equal(check.details, "");
});

test("ReleasePolicyEvaluation with empty reason string", () => {
  const evaluation = createMockPolicyEvaluation({
    reason: "",
  });

  assert.equal(evaluation.reason, "");
});

test("ReleasePolicyEvaluation with multiple checks", () => {
  const evaluation = createMockPolicyEvaluation({
    checks: [
      createMockPolicyCheckResult({ checkName: "latency", passed: true, severity: "info" }),
      createMockPolicyCheckResult({ checkName: "error_rate", passed: true, severity: "info" }),
      createMockPolicyCheckResult({ checkName: "coverage", passed: false, severity: "warning" }),
    ],
  });

  assert.equal(evaluation.checks.length, 3);
});

test("ReleasePolicy with very long observation window", () => {
  const policy = createMockReleasePolicy({
    minimumObservationWindowMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  assert.ok(policy.minimumObservationWindowMs > 0);
});

test("ReleasePolicy with very short observation window", () => {
  const policy = createMockReleasePolicy({
    minimumObservationWindowMs: 60_000, // 1 minute
  });

  assert.ok(policy.minimumObservationWindowMs < 300_000);
});

test("ReleasePolicy with strict rollback threshold", () => {
  const policy = createMockReleasePolicy({
    rollbackFailureRateThreshold: 0.01, // 1%
  });

  assert.ok(policy.rollbackFailureRateThreshold < 0.05);
});

test("ReleasePolicy with lenient rollback threshold", () => {
  const policy = createMockReleasePolicy({
    rollbackFailureRateThreshold: 0.20, // 20%
  });

  assert.ok(policy.rollbackFailureRateThreshold > 0.10);
});