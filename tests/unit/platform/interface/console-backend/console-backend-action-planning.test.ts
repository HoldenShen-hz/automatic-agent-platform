/**
 * Unit tests for OperatorConsoleBackendService planHumanTakeoverAction edge cases
 * Tests src/platform/interface/console-backend/index.ts action planning
 */

import assert from "node:assert/strict";
import test from "node:test";

import { OperatorConsoleBackendService } from "../../../../../src/platform/interface/console-backend/index.js";

function createOperator(overrides: Partial<{ operatorId: string; roles: string[]; tenantId: string | null; workspaceId: string | null }> = {}) {
  return {
    operatorId: "test-operator-1",
    roles: ["operator"],
    tenantId: null,
    workspaceId: null,
    ...overrides,
  };
}

test("planHumanTakeoverAction with take_over_task does not require policy evaluation", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "take_over_task",
    taskId: "task-123",
    operator: createOperator(),
    reasonCode: "user_requested",
  });

  assert.equal(plan.actionId, "action-1");
  assert.equal(plan.actionType, "take_over_task");
  assert.equal(plan.requiresPolicyEvaluation, false);
  assert.equal(plan.requiresBreakGlass, false);
  assert.equal(plan.taskId, "task-123");
});

test("planHumanTakeoverAction with switch_worker requires policy evaluation", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-2",
    actionType: "switch_worker",
    taskId: "task-456",
    operator: createOperator(),
    reasonCode: "worker_unresponsive",
  });

  assert.equal(plan.requiresPolicyEvaluation, true);
  assert.equal(plan.taskId, "task-456");
});

test("planHumanTakeoverAction with skip_step requires break_glass role", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-3",
    actionType: "skip_step",
    taskId: "task-789",
    operator: createOperator({ roles: ["operator"] }),
    reasonCode: "stuck_at_step",
  });

  assert.equal(plan.requiresBreakGlass, true);
  assert.equal(plan.actionType, "skip_step");
});

test("planHumanTakeoverAction with operator that has break_glass role does not require break glass", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-4",
    actionType: "skip_step",
    taskId: "task-breakglass",
    operator: createOperator({ roles: ["operator", "break_glass"] }),
    reasonCode: "emergency_override",
  });

  assert.equal(plan.requiresBreakGlass, false);
});

test("planHumanTakeoverAction with finish_task requires both policy and break glass", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-5",
    actionType: "finish_task",
    taskId: "task-finish",
    operator: createOperator({ roles: ["operator"] }),
    reasonCode: "complete_early",
  });

  assert.equal(plan.requiresPolicyEvaluation, true);
  assert.equal(plan.requiresBreakGlass, true);
  assert.equal(plan.actionType, "finish_task");
});

test("planHumanTakeoverAction with rollback_rollout requires policy evaluation", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-6",
    actionType: "rollback_rollout",
    taskId: "task-rollback",
    operator: createOperator(),
    reasonCode: "rollback_required",
  });

  assert.equal(plan.requiresPolicyEvaluation, true);
  assert.equal(plan.requiresBreakGlass, true);
});

test("planHumanTakeoverAction with attach_artifact requires policy evaluation", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-7",
    actionType: "attach_artifact",
    taskId: "task-attach",
    operator: createOperator(),
    reasonCode: "add_reference",
  });

  assert.equal(plan.requiresPolicyEvaluation, true);
});

test("planHumanTakeoverAction with advance_rollout requires policy evaluation", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-8",
    actionType: "advance_rollout",
    taskId: "task-advance",
    operator: createOperator(),
    reasonCode: "promote_version",
  });

  assert.equal(plan.requiresPolicyEvaluation, true);
  assert.equal(plan.requiresBreakGlass, false);
});

test("planHumanTakeoverAction includes tenantId and workspaceId in plan", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-9",
    actionType: "retry_step",
    taskId: "task-retry",
    tenantId: "tenant-abc",
    workspaceId: "workspace-xyz",
    operator: createOperator({ tenantId: "tenant-abc" }),
    reasonCode: "retry_after_error",
  });

  assert.equal(plan.tenantId, "tenant-abc");
  assert.equal(plan.workspaceId, "workspace-xyz");
  assert.equal(plan.operatorId, "test-operator-1");
});

test("planHumanTakeoverAction with null tenantId stores null", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-10",
    actionType: "modify_next_input",
    taskId: "task-modify",
    operator: createOperator(),
    reasonCode: "update_input",
  });

  assert.equal(plan.tenantId, null);
  assert.equal(plan.workspaceId, null);
});

test("planHumanTakeoverAction auditPayload contains actionType and reasonCode", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-11",
    actionType: "inject_feedback",
    taskId: "task-feedback",
    operator: createOperator(),
    reasonCode: "correction_feedback",
    beforeStateRef: "step_5",
    afterStateRef: "step_6",
  });

  assert.equal(plan.auditPayload.actionType, "inject_feedback");
  assert.equal(plan.auditPayload.reasonCode, "correction_feedback");
  assert.equal(plan.auditPayload.beforeStateRef, "step_5");
  assert.equal(plan.auditPayload.afterStateRef, "step_6");
});

test("planHumanTakeoverAction auditPayload handles null state refs", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-12",
    actionType: "create_improvement_candidate",
    taskId: "task-improve",
    operator: createOperator(),
    reasonCode: "suggest_improvement",
    beforeStateRef: null,
    afterStateRef: null,
  });

  assert.equal(plan.auditPayload.beforeStateRef, null);
  assert.equal(plan.auditPayload.afterStateRef, null);
});

test("planHumanTakeoverAction throws ValidationError for empty taskId", () => {
  const service = new OperatorConsoleBackendService({});
  assert.throws(() => {
    service.planHumanTakeoverAction({
      actionId: "action-13",
      actionType: "take_over_task",
      taskId: "   ",
      operator: createOperator(),
      reasonCode: "some_reason",
    });
  }, (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "console.task_id_required");
});

test("planHumanTakeoverAction throws ValidationError for empty reasonCode", () => {
  const service = new OperatorConsoleBackendService({});
  assert.throws(() => {
    service.planHumanTakeoverAction({
      actionId: "action-14",
      actionType: "take_over_task",
      taskId: "task-valid",
      operator: createOperator(),
      reasonCode: "",
    });
  }, (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "console.reason_required");
});

test("planHumanTakeoverAction throws ValidationError for empty operatorId", () => {
  const service = new OperatorConsoleBackendService({});
  assert.throws(() => {
    service.planHumanTakeoverAction({
      actionId: "action-15",
      actionType: "take_over_task",
      taskId: "task-valid",
      operator: createOperator({ operatorId: "" }),
      reasonCode: "some_reason",
    });
  }, (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "console.operator_id_required");
});

test("planHumanTakeoverAction with switch_model does not require break glass", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-16",
    actionType: "switch_model",
    taskId: "task-switch-model",
    operator: createOperator(),
    reasonCode: "model_upgrade",
  });

  assert.equal(plan.requiresPolicyEvaluation, false);
  assert.equal(plan.requiresBreakGlass, false);
});

test("planHumanTakeoverAction with retry_step does not require break glass", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-17",
    actionType: "retry_step",
    taskId: "task-retry-step",
    operator: createOperator(),
    reasonCode: "retry_after_timeout",
  });

  assert.equal(plan.requiresPolicyEvaluation, false);
  assert.equal(plan.requiresBreakGlass, false);
});

test("planHumanTakeoverAction with modify_next_input does not require policy", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-18",
    actionType: "modify_next_input",
    taskId: "task-modify-next",
    operator: createOperator(),
    reasonCode: "correct_input",
  });

  assert.equal(plan.requiresPolicyEvaluation, false);
  assert.equal(plan.requiresBreakGlass, false);
});

test("planHumanTakeoverAction with create_improvement_candidate does not require policy", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-19",
    actionType: "create_improvement_candidate",
    taskId: "task-improve-candidate",
    operator: createOperator(),
    reasonCode: "suggest_optimization",
  });

  assert.equal(plan.requiresPolicyEvaluation, false);
  assert.equal(plan.requiresBreakGlass, false);
});

test("planHumanTakeoverAction operator with different roles combination", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-20",
    actionType: "skip_step",
    taskId: "task-multi-role",
    operator: createOperator({ roles: ["operator", "admin", "break_glass"] }),
    reasonCode: "admin_override",
  });

  assert.equal(plan.requiresBreakGlass, false);
  assert.equal(plan.requiresPolicyEvaluation, true);
});

test("planHumanTakeoverAction actionId is preserved in response", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "unique-action-id-12345",
    actionType: "take_over_task",
    taskId: "task-preserve",
    operator: createOperator(),
    reasonCode: "preserve_test",
  });

  assert.equal(plan.actionId, "unique-action-id-12345");
});

test("planHumanTakeoverAction with inject_feedback includes all audit fields", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-inject",
    actionType: "inject_feedback",
    taskId: "task-inject",
    operator: createOperator(),
    reasonCode: "correction",
    beforeStateRef: "step_before",
    afterStateRef: "step_after",
  });

  assert.equal(plan.auditPayload.actionType, "inject_feedback");
  assert.equal(plan.auditPayload.reasonCode, "correction");
  assert.equal(plan.auditPayload.beforeStateRef, "step_before");
  assert.equal(plan.auditPayload.afterStateRef, "step_after");
});
