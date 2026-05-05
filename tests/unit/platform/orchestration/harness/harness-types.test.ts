import assert from "node:assert/strict";
import test from "node:test";

import type { ConstraintPack, HarnessDecisionAction, HarnessRunStatus } from "../../../../../src/platform/orchestration/harness/index.js";

test("ConstraintPack interface structure", () => {
  const pack: ConstraintPack = {
    policyIds: ["policy_1", "policy_2"],
    approvalMode: "required",
    autonomyMode: "supervised",
    tool_policy: {
      allowedTools: ["read", "write", "shell"],
    },
    risk_policy: {
      maxRiskScore: 80,
      escalationThreshold: 60,
    },
    output_policy: {
      requiredEvidence: ["artifact_ref_1"],
      redactSensitiveData: true,
    },
    budget: {
      maxSteps: 10,
      maxCost: 5.0,
      maxDurationMs: 60000,
    },
  };

  assert.equal(pack.policyIds.length, 2);
  assert.equal(pack.approvalMode, "required");
  assert.equal(pack.autonomyMode, "supervised");
  assert.equal(pack.tool_policy.allowedTools.length, 3);
  assert.equal(pack.risk_policy.maxRiskScore, 80);
  assert.equal(pack.budget.maxSteps, 10);
});

test("ConstraintPack allows readonly arrays", () => {
  const pack: ConstraintPack = {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "auto",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 50, escalationThreshold: 30 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 5, maxCost: 1.0, maxDurationMs: 30000 },
  };

  assert.deepEqual(pack.policyIds, []);
  assert.equal(pack.approvalMode, "none");
});

test("HarnessDecisionAction accepts all valid values", () => {
  const validActions: HarnessDecisionAction[] = [
    "accept",
    "retry_same_plan",
    "replan",
    "escalate_to_human",
    "downgrade_mode",
    "abort",
  ];

  for (const action of validActions) {
    const pack: ConstraintPack = {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      tool_policy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 50, escalationThreshold: 30 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 5, maxCost: 1.0, maxDurationMs: 30000 },
    };
    assert.ok(pack);
  }
});

test("HarnessRunStatus accepts all valid values", () => {
  const validStatuses: HarnessRunStatus[] = [
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
  ];

  for (const status of validStatuses) {
    assert.ok(typeof status === "string");
  }
});

test("ConstraintPack budget has correct structure", () => {
  const pack: ConstraintPack = {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "full_auto",
    tool_policy: { allowedTools: ["shell"] },
    risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
    output_policy: { requiredEvidence: ["evidence_1", "evidence_2"], redactSensitiveData: true },
    budget: {
      maxSteps: 20,
      maxCost: 10.0,
      maxDurationMs: 120000,
    },
  };

  assert.equal(pack.budget.maxSteps, 20);
  assert.equal(pack.budget.maxCost, 10.0);
  assert.equal(pack.budget.maxDurationMs, 120000);
});

test("ConstraintPack approvalMode accepts all valid values", () => {
  const modes: ConstraintPack["approvalMode"][] = ["none", "required", "supervised"];
  for (const mode of modes) {
    const pack: ConstraintPack = {
      policyIds: [],
      approvalMode: mode,
      autonomyMode: "auto",
      tool_policy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 50, escalationThreshold: 30 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 5, maxCost: 1.0, maxDurationMs: 30000 },
    };
    assert.equal(pack.approvalMode, mode);
  }
});

test("ConstraintPack autonomyMode accepts all valid values", () => {
  const modes: ConstraintPack["autonomyMode"][] = ["manual", "supervised", "auto", "full_auto"];
  for (const mode of modes) {
    const pack: ConstraintPack = {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: mode,
      tool_policy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 50, escalationThreshold: 30 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 5, maxCost: 1.0, maxDurationMs: 30000 },
    };
    assert.equal(pack.autonomyMode, mode);
  }
});
