/**
 * Unit tests for Console Backend Operator Action Planning
 * Tests src/platform/five-plane-interface/console-backend/index.ts - OperatorActionPlan coverage
 */

import assert from "node:assert/strict";
import test from "node:test";
import { OperatorConsoleBackendService } from "../../../../../src/platform/five-plane-interface/console-backend/index.js";

test("planHumanTakeoverAction with all action types", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-all", roles: ["operator"], tenantId: null, workspaceId: null };

  const actionTypes = [
    "take_over_task",
    "modify_next_input",
    "skip_step",
    "retry_step",
    "switch_model",
    "switch_worker",
    "attach_artifact",
    "inject_feedback",
    "create_improvement_candidate",
    "advance_rollout",
    "rollback_rollout",
    "finish_task",
  ] as const;

  for (const actionType of actionTypes) {
    const plan = service.planHumanTakeoverAction({
      actionId: `action-${actionType}`,
      actionType,
      taskId: "task-test",
      operator,
      reasonCode: "test",
    });

    assert.equal(plan.actionType, actionType, `Failed for ${actionType}`);
    assert.equal(plan.taskId, "task-test");
    assert.equal(plan.operatorId, "op-all");
  }
});

test("planHumanTakeoverAction requires task id", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-task", roles: ["operator"], tenantId: null, workspaceId: null };

  assert.throws(
    () =>
      service.planHumanTakeoverAction({
        actionId: "action-no-task",
        actionType: "take_over_task",
        taskId: "   ",
        operator,
        reasonCode: "test",
      }),
    (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "console.task_id_required",
  );
});

test("planHumanTakeoverAction requires reason code", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-reason", roles: ["operator"], tenantId: null, workspaceId: null };

  assert.throws(
    () =>
      service.planHumanTakeoverAction({
        actionId: "action-no-reason",
        actionType: "take_over_task",
        taskId: "task-123",
        operator,
        reasonCode: "   ",
      }),
    (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "console.reason_required",
  );
});

test("planHumanTakeoverAction requires operator id", () => {
  const service = new OperatorConsoleBackendService({});
  const invalidOperator = { operatorId: "   ", roles: ["operator"], tenantId: null, workspaceId: null };

  assert.throws(
    () =>
      service.planHumanTakeoverAction({
        actionId: "action-invalid-op",
        actionType: "take_over_task",
        taskId: "task-123",
        operator: invalidOperator,
        reasonCode: "test",
      }),
    (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "console.operator_id_required",
  );
});

test("planHumanTakeoverAction sets requiresPolicyEvaluation for high risk actions", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-high-risk", roles: ["operator"], tenantId: null, workspaceId: null };

  const highRiskActions = ["switch_worker", "attach_artifact", "advance_rollout", "rollback_rollout", "finish_task"] as const;

  for (const actionType of highRiskActions) {
    const plan = service.planHumanTakeoverAction({
      actionId: `action-${actionType}`,
      actionType,
      taskId: "task-test",
      operator,
      reasonCode: "test",
    });

    assert.equal(plan.requiresPolicyEvaluation, true, `Failed for ${actionType}`);
  }
});

test("planHumanTakeoverAction sets requiresBreakGlass for break glass actions without role", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-no-break-glass", roles: ["operator"], tenantId: null, workspaceId: null };

  const breakGlassActions = ["skip_step", "switch_worker", "finish_task", "rollback_rollout"] as const;

  for (const actionType of breakGlassActions) {
    const plan = service.planHumanTakeoverAction({
      actionId: `action-${actionType}`,
      actionType,
      taskId: "task-test",
      operator,
      reasonCode: "test",
    });

    assert.equal(plan.requiresBreakGlass, true, `Failed for ${actionType}`);
  }
});

test("planHumanTakeoverAction does not require break glass if operator has role", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-break-glass", roles: ["operator", "break_glass"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-break-glass",
    actionType: "skip_step",
    taskId: "task-test",
    operator,
    reasonCode: "test",
  });

  assert.equal(plan.requiresBreakGlass, false);
});

test("planHumanTakeoverAction auditPayload contains all fields", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-audit", roles: ["operator"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-audit",
    actionType: "retry_step",
    taskId: "task-audit",
    operator,
    reasonCode: "user_requested",
    beforeStateRef: "step-1",
    afterStateRef: "step-2",
  });

  assert.deepEqual(plan.auditPayload, {
    actionType: "retry_step",
    reasonCode: "user_requested",
    beforeStateRef: "step-1",
    afterStateRef: "step-2",
  });
});

test("planHumanTakeoverAction auditPayload with null state refs", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-null-state", roles: ["operator"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-null-state",
    actionType: "take_over_task",
    taskId: "task-null-state",
    operator,
    reasonCode: "operator_override",
  });

  assert.equal(plan.auditPayload.beforeStateRef, null);
  assert.equal(plan.auditPayload.afterStateRef, null);
});

test("planHumanTakeoverAction preserves tenant and workspace from input", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-preserve", roles: ["operator"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-preserve",
    actionType: "take_over_task",
    taskId: "task-preserve",
    tenantId: "tenant-preserved",
    workspaceId: "workspace-preserved",
    operator,
    reasonCode: "test",
  });

  assert.equal(plan.tenantId, "tenant-preserved");
  assert.equal(plan.workspaceId, "workspace-preserved");
});

test("planHumanTakeoverAction uses operator.tenantId when not explicitly provided", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-from-operator", roles: ["operator"], tenantId: "tenant-from-op", workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-from-op",
    actionType: "take_over_task",
    taskId: "task-from-op",
    operator,
    reasonCode: "test",
  });

  assert.equal(plan.tenantId, "tenant-from-op");
});
