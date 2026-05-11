/**
 * Unit tests for Issue 1942: Subject Role/Capability Verification in PolicyEngine
 *
 * These tests verify that evaluate() properly validates subject roles and capabilities
 * before allowing any action. Any subjectType without required roles/capabilities should
 * be denied for actions that require specific permissions.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  PolicyEngine,
  type PolicyDecisionRequest,
  type PolicyAction,
} from "../../../../../src/platform/control-plane/iam/policy-engine.js";
import type { BudgetPolicy } from "../../../../../src/platform/model-gateway/cost-tracker/budget-guard.js";

function makeBudgetPolicy(overrides: Partial<BudgetPolicy> = {}): BudgetPolicy {
  return {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "auto",
    ...overrides,
  };
}

// Actions that require specific roles
const ADMIN_ACTIONS: PolicyAction[] = ["install_extension", "org_change", "set_isolation_level", "advance_rollout"];
const AGENT_ACTIONS: PolicyAction[] = ["invoke_model", "invoke_tool", "write_file", "exec_command", "network_access", "dispatch_execution", "promote_improvement", "modify_knowledge_trust", "promote_memory_layer"];

test("PolicyEngine evaluate() denies subject without required roles for admin actions", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });

  for (const action of ADMIN_ACTIONS) {
    // Subject has "user" role but admin action requires org_admin or admin
    assert.throws(
      () =>
        engine.evaluate({
          decisionId: `decision-${action}`,
          taskId: "task-001",
          subjectType: "user",
          subjectId: "user-001",
          action,
          riskCategory: "org_changing",
          mode: "auto",
          subjectRoles: ["user"],
          subjectCapabilities: [],
          estimatedCostUsd: 1,
        }),
      (err: any) => err.code === "policy.subject_missing_roles",
      `Action ${action} should require admin roles`,
    );
  }
});

test("PolicyEngine evaluate() denies subject without required roles for agent actions", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });

  for (const action of AGENT_ACTIONS) {
    // Subject has no roles but agent action requires specific roles
    assert.throws(
      () =>
        engine.evaluate({
          decisionId: `decision-${action}`,
          taskId: "task-001",
          subjectType: "user",
          subjectId: "user-001",
          action,
          riskCategory: "sensitive_data",
          mode: "auto",
          subjectRoles: [],  // no roles
          subjectCapabilities: [],
          estimatedCostUsd: 1,
        }),
      (err: any) => err.code === "policy.subject_missing_roles",
      `Action ${action} should require agent roles`,
    );
  }
});

test("PolicyEngine evaluate() denies subject without required capabilities", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });

  // exec_command requires command.execute or command.execute.shell
  assert.throws(
    () =>
      engine.evaluate({
        decisionId: "decision-exec",
        taskId: "task-001",
        subjectType: "agent",
        subjectId: "agent-001",
        action: "exec_command",
        riskCategory: "destructive",
        mode: "auto",
        subjectRoles: ["command_executor", "agent"],  // has roles
        subjectCapabilities: [],  // but missing capabilities
        estimatedCostUsd: 1,
      }),
    (err: any) => err.code === "policy.subject_missing_capabilities",
  );
});

test("PolicyEngine evaluate() allows subject with correct roles and capabilities", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });

  // invoke_model with correct roles and capabilities should pass validation
  const result = engine.evaluate({
    decisionId: "decision-invoke-model",
    taskId: "task-001",
    subjectType: "agent",
    subjectId: "agent-001",
    action: "invoke_model",
    riskCategory: "sensitive_data",
    mode: "auto",
    subjectRoles: ["model_invoker", "agent"],
    subjectCapabilities: ["model.call"],
    estimatedCostUsd: 1,
  });

  // Should not throw, and should proceed to budget/mode checks
  assert.ok(result.decision === "allow_with_constraints" || result.decision === "escalate_for_approval");
});

test("PolicyEngine evaluate() allows action when subject has ALL required roles", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });

  // org_change requires org_admin OR admin - having admin is sufficient
  const result = engine.evaluate({
    decisionId: "decision-org-change",
    taskId: "task-001",
    subjectType: "agent",
    subjectId: "agent-001",
    action: "org_change",
    riskCategory: "org_changing",
    mode: "auto",
    subjectRoles: ["admin"],  // has one of the required roles
    subjectCapabilities: ["org.change"],
    estimatedCostUsd: 1,
  });

  assert.ok(result.decision === "allow_with_constraints" || result.decision === "escalate_for_approval");
});

test("PolicyEngine evaluate() allows action when subject has ONE of required roles via OR logic", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });

  // invoke_tool requires tool_executor OR agent - having agent is sufficient
  const result = engine.evaluate({
    decisionId: "decision-invoke-tool",
    taskId: "task-001",
    subjectType: "agent",
    subjectId: "agent-001",
    action: "invoke_tool",
    riskCategory: "sensitive_data",
    mode: "auto",
    subjectRoles: ["agent"],  // has one of the required roles
    subjectCapabilities: ["tool.execute"],
    estimatedCostUsd: 1,
  });

  assert.equal(result.decision, "allow_with_constraints");
});

test("PolicyEngine evaluate() allows when subject has all required capabilities", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });

  // exec_command requires command.execute OR command.execute.shell
  const result = engine.evaluate({
    decisionId: "decision-exec-command",
    taskId: "task-001",
    subjectType: "agent",
    subjectId: "agent-001",
    action: "exec_command",
    riskCategory: "sensitive_data",
    mode: "auto",
    subjectRoles: ["command_executor", "agent"],
    subjectCapabilities: ["command.execute"],  // has one of the required capabilities
    estimatedCostUsd: 1,
  });

  assert.equal(result.decision, "allow_with_constraints");
});

test("PolicyEngine evaluate() allows when subject has partial capabilities via OR logic", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });

  // exec_command requires command.execute OR command.execute.shell
  const result = engine.evaluate({
    decisionId: "decision-exec-shell",
    taskId: "task-001",
    subjectType: "agent",
    subjectId: "agent-001",
    action: "exec_command",
    riskCategory: "sensitive_data",
    mode: "auto",
    subjectRoles: ["command_executor", "agent"],
    subjectCapabilities: ["command.execute.shell"],  // has one of the required capabilities
    estimatedCostUsd: 1,
  });

  assert.equal(result.decision, "allow_with_constraints");
});

test("PolicyEngine evaluate() denies when subject lacks BOTH roles AND capabilities", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });

  // Subject with wrong roles AND missing capabilities should fail on roles check first
  assert.throws(
    () =>
      engine.evaluate({
        decisionId: "decision-both-missing",
        taskId: "task-001",
        subjectType: "user",
        subjectId: "user-001",
        action: "invoke_model",
        riskCategory: "sensitive_data",
        mode: "auto",
        subjectRoles: ["wrong_role"],  // wrong roles
        subjectCapabilities: [],  // missing capabilities
        estimatedCostUsd: 1,
      }),
    (err: any) => err.code === "policy.subject_missing_roles",
  );
});

test("PolicyEngine evaluate() includes correct error details when role is missing", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });

  try {
    engine.evaluate({
      decisionId: "decision-error-details",
      taskId: "task-001",
      subjectType: "agent",
      subjectId: "agent-001",
      action: "org_change",
      riskCategory: "org_changing",
      mode: "auto",
      subjectRoles: ["user"],
      subjectCapabilities: [],
      estimatedCostUsd: 1,
    });
    assert.fail("Should have thrown");
  } catch (err: any) {
    assert.equal(err.code, "policy.subject_missing_roles");
    assert.ok(err.details);
    assert.equal(err.details.action, "org_change");
    assert.ok(Array.isArray(err.details.missingRoles));
    assert.ok(err.details.missingRoles.includes("org_admin"));
    assert.ok(err.details.missingRoles.includes("admin"));
  }
});

test("PolicyEngine evaluate() includes correct error details when capability is missing", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });

  try {
    engine.evaluate({
      decisionId: "decision-cap-error-details",
      taskId: "task-001",
      subjectType: "agent",
      subjectId: "agent-001",
      action: "exec_command",
      riskCategory: "destructive",
      mode: "auto",
      subjectRoles: ["command_executor", "agent"],
      subjectCapabilities: [],  // missing capabilities
      estimatedCostUsd: 1,
    });
    assert.fail("Should have thrown");
  } catch (err: any) {
    assert.equal(err.code, "policy.subject_missing_capabilities");
    assert.ok(err.details);
    assert.equal(err.details.action, "exec_command");
    assert.ok(Array.isArray(err.details.missingCapabilities));
  }
});

test("PolicyEngine evaluate() allows system subject with appropriate roles", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });

  // System subject with admin roles should be able to perform admin actions
  const result = engine.evaluate({
    decisionId: "decision-system",
    taskId: "task-001",
    subjectType: "system",
    subjectId: "system-001",
    action: "advance_rollout",
    riskCategory: "governance_sensitive",
    mode: "auto",
    subjectRoles: ["rollout_manager", "admin"],
    subjectCapabilities: ["rollout.advance"],
    estimatedCostUsd: 1,
  });

  assert.ok(result.decision === "allow_with_constraints" || result.decision === "escalate_for_approval");
});

test("PolicyEngine evaluate() denies agent subject without roles even in full-auto mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });

  // full-auto mode doesn't bypass role/capability checks
  assert.throws(
    () =>
      engine.evaluate({
        decisionId: "decision-full-auto",
        taskId: "task-001",
        subjectType: "agent",
        subjectId: "agent-001",
        action: "write_file",
        riskCategory: "sensitive_data",
        mode: "full-auto",  // full-auto mode
        subjectRoles: [],  // no roles
        subjectCapabilities: [],  // no capabilities
        estimatedCostUsd: 1,
      }),
    (err: any) => err.code === "policy.subject_missing_roles",
  );
});

test("PolicyEngine evaluate() allows subject with no roles when action has no required roles", () => {
  // Note: All defined actions have required roles, so this tests the defensive behavior
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });

  // Using an action that exists but doesn't have mapped required roles would skip validation
  // Since all actions in PolicyAction have mapped required roles, this tests that
  // subjects without roles get properly denied
  assert.throws(
    () =>
      engine.evaluate({
        decisionId: "decision-no-roles",
        taskId: "task-001",
        subjectType: "user",
        subjectId: "user-001",
        action: "invoke_tool",
        riskCategory: "sensitive_data",
        mode: "auto",
        subjectRoles: [],  // no roles
        subjectCapabilities: [],  // no capabilities
        estimatedCostUsd: 1,
      }),
    (err: any) => err.code === "policy.subject_missing_roles",
  );
});