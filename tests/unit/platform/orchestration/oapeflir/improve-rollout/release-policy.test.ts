import assert from "node:assert/strict";
import test from "node:test";

import type { ReleasePolicy, ReleasePolicyEvaluation, PolicyCheckResult, ReleaseAction } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/release-policy.js";

// ---------------------------------------------------------------------------
// ReleasePolicy
// ---------------------------------------------------------------------------

test("ReleasePolicy minimal construction", () => {
  const policy: ReleasePolicy = {
    policyId: "policy_1",
    name: "Test Policy",
    description: "A test release policy",
    targetLevels: ["canary"],
    trafficAllocation: { canary: 5, staging: 20, GA: 75 },
    minimumObservationWindowMs: 60000,
    rollbackFailureRateThreshold: 0.05,
    rollbackLatencyMultiplierThreshold: 1.5,
    requiresHumanApproval: false,
    active: true,
  };
  assert.equal(policy.policyId, "policy_1");
  assert.equal(policy.name, "Test Policy");
  assert.deepEqual(policy.targetLevels, ["canary"]);
  assert.equal(policy.trafficAllocation.canary, 5);
  assert.equal(policy.requiresHumanApproval, false);
  assert.equal(policy.active, true);
});

test("ReleasePolicy with multiple targetLevels", () => {
  const policy: ReleasePolicy = {
    policyId: "policy_multi",
    name: "Multi-Level Policy",
    description: "Policy targeting multiple levels",
    targetLevels: ["canary", "staging", "GA"],
    trafficAllocation: { canary: 10, staging: 30, GA: 60 },
    minimumObservationWindowMs: 120000,
    rollbackFailureRateThreshold: 0.03,
    rollbackLatencyMultiplierThreshold: 1.3,
    requiresHumanApproval: true,
    active: true,
  };
  assert.equal(policy.targetLevels.length, 3);
  assert.equal(policy.requiresHumanApproval, true);
});

test("ReleasePolicy allows 100% traffic to single level", () => {
  const policy: ReleasePolicy = {
    policyId: "policy_full",
    name: "Full GA Policy",
    description: "All traffic to GA",
    targetLevels: ["GA"],
    trafficAllocation: { GA: 100 },
    minimumObservationWindowMs: 0,
    rollbackFailureRateThreshold: 0.1,
    rollbackLatencyMultiplierThreshold: 2.0,
    requiresHumanApproval: false,
    active: true,
  };
  assert.equal(policy.trafficAllocation.GA, 100);
});

test("ReleasePolicy inactive policy", () => {
  const policy: ReleasePolicy = {
    policyId: "policy_inactive",
    name: "Inactive Policy",
    description: "This policy is disabled",
    targetLevels: ["canary"],
    trafficAllocation: { canary: 5, staging: 20, GA: 75 },
    minimumObservationWindowMs: 60000,
    rollbackFailureRateThreshold: 0.05,
    rollbackLatencyMultiplierThreshold: 1.5,
    requiresHumanApproval: false,
    active: false,
  };
  assert.equal(policy.active, false);
});

// ---------------------------------------------------------------------------
// PolicyCheckResult
// ---------------------------------------------------------------------------

test("PolicyCheckResult passing check", () => {
  const check: PolicyCheckResult = {
    checkName: "failure_rate_check",
    passed: true,
    details: "Failure rate 0.01 is below threshold 0.05",
    severity: "info",
  };
  assert.equal(check.passed, true);
  assert.equal(check.severity, "info");
});

test("PolicyCheckResult failing critical check", () => {
  const check: PolicyCheckResult = {
    checkName: "failure_rate_check",
    passed: false,
    details: "Failure rate 0.08 exceeds threshold 0.05",
    severity: "critical",
  };
  assert.equal(check.passed, false);
  assert.equal(check.severity, "critical");
});

test("PolicyCheckResult warning severity", () => {
  const check: PolicyCheckResult = {
    checkName: "latency_check",
    passed: true,
    details: "Latency is elevated but within acceptable range",
    severity: "warning",
  };
  assert.equal(check.severity, "warning");
});

test("PolicyCheckResult info severity", () => {
  const check: PolicyCheckResult = {
    checkName: "observation_window_check",
    passed: true,
    details: "Observation window complete",
    severity: "info",
  };
  assert.equal(check.severity, "info");
});

// ---------------------------------------------------------------------------
// ReleasePolicyEvaluation
// ---------------------------------------------------------------------------

test("ReleasePolicyEvaluation passed", () => {
  const evaluation: ReleasePolicyEvaluation = {
    policy: {
      policyId: "policy_eval_1",
      name: "Eval Policy",
      description: "An evaluation test",
      targetLevels: ["canary"],
      trafficAllocation: { canary: 5, staging: 20, GA: 75 },
      minimumObservationWindowMs: 60000,
      rollbackFailureRateThreshold: 0.05,
      rollbackLatencyMultiplierThreshold: 1.5,
      requiresHumanApproval: false,
      active: true,
    },
    passed: true,
    checks: [
      {
        checkName: "failure_rate_check",
        passed: true,
        details: "OK",
        severity: "info",
      },
    ],
    recommendedAction: "promote",
    reason: "All checks passed",
  };
  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.recommendedAction, "promote");
});

test("ReleasePolicyEvaluation failed", () => {
  const evaluation: ReleasePolicyEvaluation = {
    policy: {
      policyId: "policy_eval_2",
      name: "Eval Policy 2",
      description: "An evaluation test that fails",
      targetLevels: ["canary"],
      trafficAllocation: { canary: 5, staging: 20, GA: 75 },
      minimumObservationWindowMs: 60000,
      rollbackFailureRateThreshold: 0.05,
      rollbackLatencyMultiplierThreshold: 1.5,
      requiresHumanApproval: false,
      active: true,
    },
    passed: false,
    checks: [
      {
        checkName: "failure_rate_check",
        passed: false,
        details: "Failure rate 0.08 exceeds threshold",
        severity: "critical",
      },
    ],
    recommendedAction: "rollback",
    reason: "Critical check failed: failure_rate_check",
  };
  assert.equal(evaluation.passed, false);
  assert.equal(evaluation.recommendedAction, "rollback");
});

test("ReleasePolicyEvaluation with multiple checks", () => {
  const evaluation: ReleasePolicyEvaluation = {
    policy: {
      policyId: "policy_eval_3",
      name: "Eval Policy 3",
      description: "Multiple checks",
      targetLevels: ["canary", "staging"],
      trafficAllocation: { canary: 10, staging: 40, GA: 50 },
      minimumObservationWindowMs: 120000,
      rollbackFailureRateThreshold: 0.03,
      rollbackLatencyMultiplierThreshold: 1.4,
      requiresHumanApproval: true,
      active: true,
    },
    passed: true,
    checks: [
      { checkName: "check_1", passed: true, details: "OK", severity: "info" },
      { checkName: "check_2", passed: true, details: "OK", severity: "info" },
      { checkName: "check_3", passed: true, details: "OK", severity: "warning" },
    ],
    recommendedAction: "promote",
    reason: "All checks passed",
  };
  assert.equal(evaluation.checks.length, 3);
});

// ---------------------------------------------------------------------------
// ReleaseAction
// ---------------------------------------------------------------------------

test("ReleaseAction promote", () => {
  const action: ReleaseAction = "promote";
  assert.equal(action, "promote");
});

test("ReleaseAction demote", () => {
  const action: ReleaseAction = "demote";
  assert.equal(action, "demote");
});

test("ReleaseAction rollback", () => {
  const action: ReleaseAction = "rollback";
  assert.equal(action, "rollback");
});

test("ReleaseAction hold", () => {
  const action: ReleaseAction = "hold";
  assert.equal(action, "hold");
});

test("ReleaseAction require_approval", () => {
  const action: ReleaseAction = "require_approval";
  assert.equal(action, "require_approval");
});

test("ReleaseAction all values are unique", () => {
  const actions: ReleaseAction[] = ["promote", "demote", "rollback", "hold", "require_approval"];
  const uniqueCount = new Set(actions).size;
  assert.equal(uniqueCount, 5);
});

// ---------------------------------------------------------------------------
// PolicyCheckResult severity values
// ---------------------------------------------------------------------------

test("PolicyCheckResult severity values are unique", () => {
  const severities: PolicyCheckResult["severity"][] = ["critical", "warning", "info"];
  const uniqueCount = new Set(severities).size;
  assert.equal(uniqueCount, 3);
});

test("ReleasePolicy rollback thresholds can be high", () => {
  const policy: ReleasePolicy = {
    policyId: "policy_lenient",
    name: "Lenient Policy",
    description: "High thresholds for testing",
    targetLevels: ["GA"],
    trafficAllocation: { GA: 100, canary: 0, staging: 0 },
    minimumObservationWindowMs: 0,
    rollbackFailureRateThreshold: 0.5,
    rollbackLatencyMultiplierThreshold: 5.0,
    requiresHumanApproval: false,
    active: true,
  };
  assert.equal(policy.rollbackFailureRateThreshold, 0.5);
  assert.equal(policy.rollbackLatencyMultiplierThreshold, 5.0);
});

test("ReleasePolicy rollback thresholds can be zero", () => {
  const policy: ReleasePolicy = {
    policyId: "policy_strict",
    name: "Strict Policy",
    description: "Zero tolerance",
    targetLevels: ["canary"],
    trafficAllocation: { canary: 5, staging: 20, GA: 75 },
    minimumObservationWindowMs: 300000,
    rollbackFailureRateThreshold: 0,
    rollbackLatencyMultiplierThreshold: 1.0,
    requiresHumanApproval: true,
    active: true,
  };
  assert.equal(policy.rollbackFailureRateThreshold, 0);
  assert.equal(policy.rollbackLatencyMultiplierThreshold, 1.0);
});