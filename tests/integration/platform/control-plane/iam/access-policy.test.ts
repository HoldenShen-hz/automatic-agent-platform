/**
 * Integration Test: IAM Access Policy
 *
 * Tests the policy engine and sandbox policy functions including:
 * - Policy engine evaluation with budget guards
 * - Sandbox path validation and security enforcement
 * - Kill switch functionality
 * - Risk-based escalation
 *
 * Uses createIntegrationContext() with SQLite for integration testing.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext, createSeededIntegrationContext } from "../../../../helpers/integration-context.js";
import { PolicyEngine, mapToolRiskToPolicyCategory, type PolicyDecisionRequest } from "../../../../../src/platform/five-plane-control-plane/iam/policy-engine.js";
import { BudgetPolicy } from "../../../../../src/platform/model-gateway/cost-tracker/budget-guard.js";
import {
  checkSandboxPath,
  createWorkspaceWritePolicy,
  createScopedExternalAccessPolicy,
  createRestrictedExecPolicy,
  createConfigReadPolicy,
  type SandboxPolicy,
} from "../../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";

function makeRequest(overrides: Partial<PolicyDecisionRequest> = {}): PolicyDecisionRequest {
  return {
    decisionId: "decision-001",
    taskId: "task-001",
    subjectType: "agent",
    subjectId: "agent-001",
    action: "invoke_tool",
    riskCategory: "sensitive_data",
    mode: "auto",
    ...overrides,
  };
}

function makeBudgetPolicy(overrides: Partial<BudgetPolicy> = {}): BudgetPolicy {
  return {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "auto",
    ...overrides,
  };
}

test("access policy: PolicyEngine.evaluate throws ValidationError for empty decisionId", () => {
  const ctx = createIntegrationContext("aa-policy-engine-invalid-decision-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
    assert.throws(
      () => engine.evaluate(makeRequest({ decisionId: "" })),
      (err: any) => err.code === "policy.invalid_decision_id",
    );
  } finally {
    ctx.cleanup();
  }
});

test("access policy: PolicyEngine.evaluate throws ValidationError for empty taskId", () => {
  const ctx = createIntegrationContext("aa-policy-engine-invalid-task-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
    assert.throws(
      () => engine.evaluate(makeRequest({ taskId: "" })),
      (err: any) => err.code === "policy.invalid_task_id",
    );
  } finally {
    ctx.cleanup();
  }
});

test("access policy: PolicyEngine.evaluate throws ValidationError for empty subjectId", () => {
  const ctx = createIntegrationContext("aa-policy-engine-invalid-subject-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
    assert.throws(
      () => engine.evaluate(makeRequest({ subjectId: "" })),
      (err: any) => err.code === "policy.invalid_subject_id",
    );
  } finally {
    ctx.cleanup();
  }
});

test("access policy: PolicyEngine.evaluate returns deny when kill switch is active", () => {
  const ctx = createIntegrationContext("aa-policy-engine-killswitch-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy(), killSwitchEnabled: true });
    const result = engine.evaluate(makeRequest());
    assert.strictEqual(result.decision, "deny");
    assert.strictEqual(result.reasonCode, "policy.kill_switch_active");
    assert.strictEqual(result.killSwitchApplied, true);
  } finally {
    ctx.cleanup();
  }
});

test("access policy: PolicyEngine.evaluate returns deny when task budget would be exceeded", () => {
  const ctx = createIntegrationContext("aa-policy-engine-budget-exceeded-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 1 }) });
    const result = engine.evaluate(makeRequest({ estimatedCostUsd: 5 }));
    assert.strictEqual(result.decision, "deny");
    assert.strictEqual(result.reasonCode, "budget.task_limit_exceeded");
    assert.strictEqual(result.killSwitchApplied, false);
  } finally {
    ctx.cleanup();
  }
});

test("access policy: PolicyEngine.evaluate returns allow_with_constraints for normal execution", () => {
  const ctx = createIntegrationContext("aa-policy-engine-allow-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 10 }) });
    const result = engine.evaluate(makeRequest({ estimatedCostUsd: 1 }));
    assert.strictEqual(result.decision, "allow_with_constraints");
    assert.strictEqual(result.reasonCode, "policy.allow");
    assert.strictEqual(result.requiresApproval, false);
    assert.strictEqual(result.killSwitchApplied, false);
  } finally {
    ctx.cleanup();
  }
});

test("access policy: PolicyEngine.evaluate escalates high-risk action in supervised mode", () => {
  const ctx = createIntegrationContext("aa-policy-engine-supervised-escalate-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
    const result = engine.evaluate(
      makeRequest({ mode: "supervised", riskCategory: "destructive", estimatedCostUsd: 1 }),
    );
    assert.strictEqual(result.decision, "escalate_for_approval");
    assert.strictEqual(result.requiresApproval, true);
    assert.strictEqual(result.reasonCode, "policy.supervised_escalation");
  } finally {
    ctx.cleanup();
  }
});

test("access policy: PolicyEngine.evaluate escalates irreversible action in supervised mode", () => {
  const ctx = createIntegrationContext("aa-policy-engine-irreversible-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
    const result = engine.evaluate(
      makeRequest({ mode: "supervised", riskCategory: "irreversible", estimatedCostUsd: 1 }),
    );
    assert.strictEqual(result.decision, "escalate_for_approval");
    assert.strictEqual(result.requiresApproval, true);
  } finally {
    ctx.cleanup();
  }
});

test("access policy: PolicyEngine.evaluate escalates prod_affecting action in supervised mode", () => {
  const ctx = createIntegrationContext("aa-policy-engine-prod-affecting-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
    const result = engine.evaluate(
      makeRequest({ mode: "supervised", riskCategory: "prod_affecting", estimatedCostUsd: 1 }),
    );
    assert.strictEqual(result.decision, "escalate_for_approval");
    assert.strictEqual(result.requiresApproval, true);
  } finally {
    ctx.cleanup();
  }
});

test("access policy: PolicyEngine.evaluate escalates org_changing action in supervised mode", () => {
  const ctx = createIntegrationContext("aa-policy-engine-org-changing-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
    const result = engine.evaluate(
      makeRequest({ mode: "supervised", riskCategory: "org_changing", estimatedCostUsd: 1 }),
    );
    assert.strictEqual(result.decision, "escalate_for_approval");
    assert.strictEqual(result.requiresApproval, true);
  } finally {
    ctx.cleanup();
  }
});

test("access policy: PolicyEngine.evaluate escalates high-risk action in auto mode", () => {
  const ctx = createIntegrationContext("aa-policy-engine-auto-escalate-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
    const result = engine.evaluate(
      makeRequest({ mode: "auto", riskCategory: "destructive", estimatedCostUsd: 1 }),
    );
    assert.strictEqual(result.decision, "escalate_for_approval");
    assert.strictEqual(result.requiresApproval, true);
    assert.strictEqual(result.reasonCode, "policy.high_risk_requires_approval");
  } finally {
    ctx.cleanup();
  }
});

test("access policy: PolicyEngine.evaluate allows non-high-risk action in auto mode without escalation", () => {
  const ctx = createIntegrationContext("aa-policy-engine-auto-allow-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
    const result = engine.evaluate(
      makeRequest({ mode: "auto", riskCategory: "sensitive_data", estimatedCostUsd: 1 }),
    );
    assert.strictEqual(result.decision, "allow_with_constraints");
    assert.strictEqual(result.requiresApproval, false);
  } finally {
    ctx.cleanup();
  }
});

test("access policy: PolicyEngine.evaluate allows high-risk action in full-auto mode without approval", () => {
  const ctx = createIntegrationContext("aa-policy-engine-full-auto-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
    const result = engine.evaluate(
      makeRequest({ mode: "full-auto", riskCategory: "destructive", estimatedCostUsd: 1 }),
    );
    assert.strictEqual(result.decision, "allow_with_constraints");
    assert.strictEqual(result.requiresApproval, false);
  } finally {
    ctx.cleanup();
  }
});

test("access policy: PolicyEngine.evaluate returns allow_under_budget_warning when approaching limit", () => {
  const ctx = createIntegrationContext("aa-policy-engine-budget-warning-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 10, warnAtRatio: 0.8 }) });
    const result = engine.evaluate(makeRequest({ estimatedCostUsd: 8.5 }));
    assert.strictEqual(result.decision, "allow_with_constraints");
    assert.strictEqual(result.reasonCode, "policy.allow_under_budget_warning");
  } finally {
    ctx.cleanup();
  }
});

test("access policy: PolicyEngine.evaluate includes remainingBudgetUsd in enforcedConstraints", () => {
  const ctx = createIntegrationContext("aa-policy-engine-constraints-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 10 }) });
    const result = engine.evaluate(makeRequest({ estimatedCostUsd: 1 }));
    assert.strictEqual(typeof result.enforcedConstraints.remainingBudgetUsd, "number");
  } finally {
    ctx.cleanup();
  }
});

test("access policy: PolicyEngine.evaluate uses currentTaskCostUsd from metadata for budget check", () => {
  const ctx = createIntegrationContext("aa-policy-engine-metadata-cost-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 5 }) });
    const result = engine.evaluate(
      makeRequest({ estimatedCostUsd: 1, metadata: { currentTaskCostUsd: 4 } }),
    );
    // 4 + 1 = 5 which equals max, so still allowed but with constraints
    assert.strictEqual(result.decision, "allow_with_constraints");
  } finally {
    ctx.cleanup();
  }
});

test("access policy: PolicyEngine.evaluate includes auditPayload with action and riskCategory", () => {
  const ctx = createIntegrationContext("aa-policy-engine-audit-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
    const result = engine.evaluate(makeRequest({ action: "exec_command", riskCategory: "destructive" }));
    assert.strictEqual(result.auditPayload.action, "exec_command");
    assert.strictEqual(result.auditPayload.riskCategory, "destructive");
  } finally {
    ctx.cleanup();
  }
});

test("access policy: mapToolRiskToPolicyCategory maps critical to prod_affecting", () => {
  const ctx = createIntegrationContext("aa-policy-map-critical-");
  try {
    assert.strictEqual(mapToolRiskToPolicyCategory("critical"), "prod_affecting");
  } finally {
    ctx.cleanup();
  }
});

test("access policy: mapToolRiskToPolicyCategory maps high to destructive", () => {
  const ctx = createIntegrationContext("aa-policy-map-high-");
  try {
    assert.strictEqual(mapToolRiskToPolicyCategory("high"), "destructive");
  } finally {
    ctx.cleanup();
  }
});

test("access policy: mapToolRiskToPolicyCategory maps medium to cost_sensitive", () => {
  const ctx = createIntegrationContext("aa-policy-map-medium-");
  try {
    assert.strictEqual(mapToolRiskToPolicyCategory("medium"), "cost_sensitive");
  } finally {
    ctx.cleanup();
  }
});

test("access policy: mapToolRiskToPolicyCategory maps low to sensitive_data", () => {
  const ctx = createIntegrationContext("aa-policy-map-low-");
  try {
    assert.strictEqual(mapToolRiskToPolicyCategory("low"), "sensitive_data");
  } finally {
    ctx.cleanup();
  }
});

test("access policy: sandbox path check allows path within workspace", () => {
  const ctx = createIntegrationContext("aa-sandbox-allow-workspace-");
  try {
    const policy = createWorkspaceWritePolicy(ctx.workspace);
    const result = checkSandboxPath(policy, `${ctx.workspace}/file.txt`);
    assert.strictEqual(result.allowed, true);
    assert.ok(result.normalizedPath.includes("file.txt"));
  } finally {
    ctx.cleanup();
  }
});

test("access policy: sandbox path check denies path outside workspace", () => {
  const ctx = createIntegrationContext("aa-sandbox-deny-outside-");
  try {
    const policy = createWorkspaceWritePolicy(ctx.workspace);
    const result = checkSandboxPath(policy, "/etc/passwd");
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reasonCode, "sandbox.path_in_denied_root");
  } finally {
    ctx.cleanup();
  }
});

test("access policy: sandbox path check denies path traversal attempts", () => {
  const ctx = createIntegrationContext("aa-sandbox-deny-traversal-");
  try {
    const policy = createWorkspaceWritePolicy(ctx.workspace);
    const result = checkSandboxPath(policy, `${ctx.workspace}/../../../etc/passwd`);
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reasonCode, "sandbox.path_outside_allowed_roots");
  } finally {
    ctx.cleanup();
  }
});

test("access policy: createWorkspaceWritePolicy creates policy with correct mode", () => {
  const ctx = createIntegrationContext("aa-sandbox-workspace-mode-");
  try {
    const policy = createWorkspaceWritePolicy(ctx.workspace);
    assert.strictEqual(policy.mode, "workspace_write");
    assert.deepEqual(policy.allowedRoots, [ctx.workspace]);
    assert.strictEqual(policy.realpathEnforced, true);
    assert.strictEqual(policy.symlinkPolicy, "deny");
    assert.strictEqual(policy.processRuleMode, "allow");
  } finally {
    ctx.cleanup();
  }
});

test("access policy: createScopedExternalAccessPolicy creates policy with scoped mode", () => {
  const ctx = createIntegrationContext("aa-sandbox-scoped-mode-");
  try {
    const policy = createScopedExternalAccessPolicy(ctx.workspace);
    assert.strictEqual(policy.mode, "scoped_external_access");
    assert.deepEqual(policy.allowedRoots, [ctx.workspace]);
    assert.strictEqual(policy.realpathEnforced, true);
    assert.strictEqual(policy.symlinkPolicy, "deny");
  } finally {
    ctx.cleanup();
  }
});

test("access policy: createRestrictedExecPolicy creates policy with restricted mode", () => {
  const ctx = createIntegrationContext("aa-sandbox-restricted-mode-");
  try {
    const policy = createRestrictedExecPolicy(ctx.workspace);
    assert.strictEqual(policy.mode, "restricted_exec");
    assert.deepEqual(policy.allowedRoots, [ctx.workspace]);
    assert.strictEqual(policy.realpathEnforced, true);
  } finally {
    ctx.cleanup();
  }
});

test("access policy: createConfigReadPolicy creates read-only policy", () => {
  const ctx = createIntegrationContext("aa-sandbox-config-read-");
  try {
    const policy = createConfigReadPolicy(ctx.workspace);
    assert.strictEqual(policy.mode, "read_only");
    assert.deepEqual(policy.allowedRoots, [ctx.workspace]);
    assert.strictEqual(policy.processRuleMode, "deny");
  } finally {
    ctx.cleanup();
  }
});

test("access policy: sandbox path denies invalid encoding with null byte", () => {
  const ctx = createIntegrationContext("aa-sandbox-invalid-encoding-");
  try {
    const policy = createWorkspaceWritePolicy(ctx.workspace);
    const result = checkSandboxPath(policy, `${ctx.workspace}/file\x00.txt`);
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reasonCode, "sandbox.path_invalid_encoding");
  } finally {
    ctx.cleanup();
  }
});

test("access policy: sandbox path handles denied roots configuration", () => {
  const ctx = createIntegrationContext("aa-sandbox-denied-roots-");
  try {
    const policy: SandboxPolicy = {
      policyId: "test-denied",
      mode: "workspace_write",
      allowedRoots: [ctx.workspace],
      deniedRoots: [`${ctx.workspace}/secrets`],
      realpathEnforced: false,
      symlinkPolicy: "deny",
      processRuleMode: "allow",
    };
    const result = checkSandboxPath(policy, `${ctx.workspace}/secrets/password.txt`);
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reasonCode, "sandbox.path_in_denied_root");
  } finally {
    ctx.cleanup();
  }
});

test("access policy: sandbox path allows path within denied root sibling", () => {
  const ctx = createIntegrationContext("aa-sandbox-denied-sibling-");
  try {
    const policy: SandboxPolicy = {
      policyId: "test-denied-sibling",
      mode: "workspace_write",
      allowedRoots: [ctx.workspace],
      deniedRoots: [`${ctx.workspace}/secrets`],
      realpathEnforced: false,
      symlinkPolicy: "deny",
      processRuleMode: "allow",
    };
    const result = checkSandboxPath(policy, `${ctx.workspace}/public/file.txt`);
    assert.strictEqual(result.allowed, true);
  } finally {
    ctx.cleanup();
  }
});

test("access policy: integration with seeded context - policy evaluation with task context", () => {
  const ctx = createSeededIntegrationContext("aa-policy-seeded-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 10 }) });
    const result = engine.evaluate(
      makeRequest({
        taskId: "task-seeded-001",
        estimatedCostUsd: 1,
      }),
    );

    assert.strictEqual(result.decision, "allow_with_constraints");
    assert.strictEqual(result.killSwitchApplied, false);
  } finally {
    ctx.cleanup();
  }
});

test("access policy: integration with seeded context - supervised mode escalation", () => {
  const ctx = createSeededIntegrationContext("aa-policy-seeded-supervised-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
    const result = engine.evaluate(
      makeRequest({
        taskId: "task-seeded-001",
        mode: "supervised",
        riskCategory: "destructive",
        estimatedCostUsd: 1,
      }),
    );

    assert.strictEqual(result.decision, "escalate_for_approval");
    assert.strictEqual(result.requiresApproval, true);
  } finally {
    ctx.cleanup();
  }
});

test("access policy: integration with seeded context - full-auto mode allows destructive action", () => {
  const ctx = createSeededIntegrationContext("aa-policy-seeded-full-auto-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
    const result = engine.evaluate(
      makeRequest({
        taskId: "task-seeded-001",
        mode: "full-auto",
        riskCategory: "destructive",
        estimatedCostUsd: 1,
      }),
    );

    assert.strictEqual(result.decision, "allow_with_constraints");
    assert.strictEqual(result.requiresApproval, false);
  } finally {
    ctx.cleanup();
  }
});

test("access policy: integration with seeded context - budget guard enforcement", () => {
  const ctx = createSeededIntegrationContext("aa-policy-seeded-budget-");
  try {
    const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 5 }) });
    const result = engine.evaluate(
      makeRequest({
        taskId: "task-seeded-001",
        estimatedCostUsd: 10,
      }),
    );

    assert.strictEqual(result.decision, "deny");
    assert.strictEqual(result.reasonCode, "budget.task_limit_exceeded");
  } finally {
    ctx.cleanup();
  }
});

test("access policy: multiple policy engines can coexist with different configurations", () => {
  const ctx = createIntegrationContext("aa-policy-multiple-");
  try {
    const strictEngine = new PolicyEngine({
      budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 1 }),
      killSwitchEnabled: false,
    });
    const lenientEngine = new PolicyEngine({
      budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 100 }),
      killSwitchEnabled: false,
    });

    const strictResult = strictEngine.evaluate(makeRequest({ estimatedCostUsd: 5 }));
    const lenientResult = lenientEngine.evaluate(makeRequest({ estimatedCostUsd: 5 }));

    assert.strictEqual(strictResult.decision, "deny");
    assert.strictEqual(lenientResult.decision, "allow_with_constraints");
  } finally {
    ctx.cleanup();
  }
});

test("access policy: sandbox policy with restricted_exec mode enforces allowed_roots boundary", () => {
  const ctx = createIntegrationContext("aa-sandbox-restricted-no-boundary-");
  try {
    const policy = createRestrictedExecPolicy(ctx.workspace);
    const result = checkSandboxPath(policy, "/etc/passwd");
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reasonCode, "sandbox.path_in_denied_root");
  } finally {
    ctx.cleanup();
  }
});
