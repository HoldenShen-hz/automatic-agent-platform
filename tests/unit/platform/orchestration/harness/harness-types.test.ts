import assert from "node:assert/strict";
import test from "node:test";

import {
  getConstraintOutputPolicy,
  getConstraintRiskPolicy,
  normalizeConstraintPack,
  type ConstraintPack,
  type HarnessDecisionAction,
  type HarnessRunStatus,
} from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: ["policy.default"],
    approvalMode: "required",
    autonomyMode: "supervised",
    tool_policy: { allowedTools: ["read", "write"] },
    risk_policy: { maxRiskScore: 0.8, escalationThreshold: 0.6 },
    output_policy: { requiredEvidence: ["artifact:1"], redactSensitiveData: false },
    budgetEnvelope: { maxSteps: 10, maxCost: 5, maxDurationMs: 60_000, maxTokens: 2048 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 5_000 },
    approvalRequirement: {
      requiredForRiskClass: ["critical"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 30_000,
    },
    ...overrides,
  };
}

test("normalizeConstraintPack preserves current snake_case contract and mirrors budget tokens", () => {
  const normalized = normalizeConstraintPack(createConstraintPack());

  assert.deepEqual(normalized.tool_policy.allowedTools, ["read", "write"]);
  assert.equal(normalized.budgetEnvelope?.maxTokens, 2048);
  assert.equal(normalized.budget?.maxSteps, 10);
  assert.equal(normalized.budget?.maxCost, 5);
  assert.equal(normalized.budget?.maxDurationMs, 60_000);
});

test("normalizeConstraintPack backfills default risk and output policies when omitted", () => {
  const normalized = normalizeConstraintPack(createConstraintPack({
    risk_policy: undefined,
    output_policy: undefined,
  }));

  assert.equal(normalized.risk_policy?.maxRiskScore, 0.8);
  assert.equal(normalized.risk_policy?.escalationThreshold, 0.7);
  assert.deepEqual(normalized.output_policy?.requiredEvidence, []);
  assert.equal(normalized.output_policy?.redactSensitiveData, false);
});

test("getConstraintRiskPolicy and getConstraintOutputPolicy return required policies", () => {
  const pack = createConstraintPack();

  assert.equal(getConstraintRiskPolicy(pack).escalationThreshold, 0.6);
  assert.deepEqual(getConstraintOutputPolicy(pack).requiredEvidence, ["artifact:1"]);
});

test("getConstraintRiskPolicy and getConstraintOutputPolicy reject missing policies", () => {
  const pack = createConstraintPack({
    risk_policy: undefined,
    output_policy: undefined,
  });

  assert.throws(() => getConstraintRiskPolicy(pack), /harness\.constraint_pack\.missing_risk_policy/);
  assert.throws(() => getConstraintOutputPolicy(pack), /harness\.constraint_pack\.missing_output_policy/);
});

test("harness action and status unions accept the current literals", () => {
  const actions: HarnessDecisionAction[] = [
    "accept",
    "retry_same_plan",
    "replan",
    "escalate_to_human",
    "downgrade_mode",
    "abort",
    "quarantine",
    "revoke_approval",
    "pause_for_external",
    "require_revalidation",
  ];
  const statuses: HarnessRunStatus[] = [
    "created",
    "admitted",
    "planning",
    "ready",
    "running",
    "pausing",
    "paused",
    "resuming",
    "replanning",
    "compensating",
    "completed",
    "failed",
    "aborted",
    "cancelled",
  ];

  assert.equal(actions.at(-1), "require_revalidation");
  assert.equal(statuses.at(-1), "cancelled");
});
