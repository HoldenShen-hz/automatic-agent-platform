import test from "node:test";
import assert from "node:assert/strict";
import {
  getConstraintOutputPolicy,
  getConstraintRiskPolicy,
  normalizeConstraintPack,
  type ConstraintPack,
} from "../../../../../src/platform/orchestration/harness/constraints/index.js";

test("ConstraintPack type is exported and can be constructed", () => {
  const pack: ConstraintPack = {
    policyIds: ["policy-1"],
    approvalMode: "none",
    autonomyMode: "suggestion",
    tool_policy: {
      allowedTools: ["tool-a", "tool-b"],
    },
    risk_policy: {
      maxRiskScore: 10,
      escalationThreshold: 8,
    },
    output_policy: {
      requiredEvidence: ["evidence-1"],
      redactSensitiveData: false,
    },
    sandboxRequirement: {
      sandboxMode: "none",
      timeoutMs: 60000,
    },
    approvalRequirement: {
      requiredForRiskClass: ["low", "medium", "high", "critical"],
      approverRoles: ["admin"],
      escalationTimeoutMs: 60000,
    },
    budget: {
      maxSteps: 100,
      maxCost: 1000,
      maxDurationMs: 60000,
    },
  };

  assert.equal(pack.policyIds.length, 1);
  assert.equal(pack.approvalMode, "none");
  assert.equal(pack.autonomyMode, "suggestion");
  assert.equal(pack.tool_policy.allowedTools.length, 2);
  assert.equal(pack.risk_policy.maxRiskScore, 10);
  assert.equal(pack.output_policy.requiredEvidence.length, 1);
  assert.equal(pack.budget.maxSteps, 100);
});

test("ConstraintPack allows different approval modes", () => {
  const packNone: ConstraintPack = {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "suggestion",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    sandboxRequirement: { sandboxMode: "none", timeoutMs: 60000 },
    approvalRequirement: {
      requiredForRiskClass: ["low", "medium", "high", "critical"],
      approverRoles: ["admin"],
      escalationTimeoutMs: 60000,
    },
    budget: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
  };
  assert.equal(packNone.approvalMode, "none");

  const packRequired: ConstraintPack = {
    policyIds: [],
    approvalMode: "required",
    autonomyMode: "suggestion",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    sandboxRequirement: { sandboxMode: "none", timeoutMs: 60000 },
    approvalRequirement: {
      requiredForRiskClass: ["low", "medium", "high", "critical"],
      approverRoles: ["admin"],
      escalationTimeoutMs: 60000,
    },
    budget: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
  };
  assert.equal(packRequired.approvalMode, "required");

  const packSupervised: ConstraintPack = {
    policyIds: [],
    approvalMode: "supervised",
    autonomyMode: "suggestion",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    sandboxRequirement: { sandboxMode: "none", timeoutMs: 60000 },
    approvalRequirement: {
      requiredForRiskClass: ["low", "medium", "high", "critical"],
      approverRoles: ["admin"],
      escalationTimeoutMs: 60000,
    },
    budget: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
  };
  assert.equal(packSupervised.approvalMode, "supervised");
});

test("ConstraintPack allows different autonomy modes", () => {
  const modes: Array<ConstraintPack["autonomyMode"]> = ["suggestion", "supervised", "semi_auto", "full_auto"];
  for (const mode of modes) {
    const pack: ConstraintPack = {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: mode,
      tool_policy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      sandboxRequirement: { sandboxMode: "none", timeoutMs: 60000 },
      approvalRequirement: {
        requiredForRiskClass: ["low", "medium", "high", "critical"],
        approverRoles: ["admin"],
        escalationTimeoutMs: 60000,
      },
      budget: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
    };
    assert.equal(pack.autonomyMode, mode);
  }
});

test("normalizeConstraintPack canonicalizes legacy snake_case policy fields", () => {
  const pack: ConstraintPack = {
    policyIds: ["policy-1"],
    approvalMode: "required",
    autonomyMode: "supervised",
    tool_policy: { allowedTools: ["read"] },
    risk_policy: { maxRiskScore: 9, escalationThreshold: 7 },
    output_policy: { requiredEvidence: ["evidence-1"], redactSensitiveData: true },
    sandboxRequirement: { sandboxMode: "none", timeoutMs: 60000 },
    approvalRequirement: {
      requiredForRiskClass: ["low", "medium", "high", "critical"],
      approverRoles: ["admin"],
      escalationTimeoutMs: 60000,
    },
    budget: { maxSteps: 12, maxCost: 3, maxDurationMs: 30_000 },
  };

  const normalized = normalizeConstraintPack(pack);

  assert.deepEqual(normalized.risk_policy, { maxRiskScore: 9, escalationThreshold: 7 });
  assert.deepEqual(normalized.output_policy, {
    requiredEvidence: ["evidence-1"],
    redactSensitiveData: true,
  });
  assert.equal("risk_policy" in normalized, false);
  assert.equal("output_policy" in normalized, false);
});

test("ConstraintPack helpers accept both canonical and legacy policy fields", () => {
  const canonical: ConstraintPack = {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "full_auto",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 5, escalationThreshold: 4 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    sandboxRequirement: { sandboxMode: "none", timeoutMs: 60000 },
    approvalRequirement: {
      requiredForRiskClass: ["low", "medium", "high", "critical"],
      approverRoles: ["admin"],
      escalationTimeoutMs: 60000,
    },
    budget: { maxSteps: 5, maxCost: 1, maxDurationMs: 1_000 },
  };

  assert.equal(getConstraintRiskPolicy(canonical).maxRiskScore, 5);
  assert.equal(getConstraintOutputPolicy(canonical).requiredEvidence.length, 0);
});
