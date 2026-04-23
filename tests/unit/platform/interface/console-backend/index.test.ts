import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OperatorConsoleBackendService } from "../../../../../src/platform/interface/console-backend/index.js";

describe("console-backend/index", () => {
  describe("OperatorConsoleBackendService", () => {
    it("should build snapshot with empty data sources", () => {
      const service = new OperatorConsoleBackendService({});
      const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };
      const snapshot = service.buildSnapshot(operator);
      assert.equal(snapshot.operator.operatorId, "op-1");
      assert.ok(Array.isArray(snapshot.moduleCoverage));
      assert.ok(Array.isArray(snapshot.taskBoard));
      assert.ok(Array.isArray(snapshot.findings));
    });

    it("should filter task board by tenant", () => {
      const tasks = [
        { taskId: "t-1", tenantId: "tenant-a", workspaceId: null, status: "running", riskLevel: "low" as const, updatedAt: "2024-01-01" },
        { taskId: "t-2", tenantId: "tenant-b", workspaceId: null, status: "running", riskLevel: "low" as const, updatedAt: "2024-01-01" },
      ];
      const service = new OperatorConsoleBackendService({ listTasks: () => tasks });
      const operator = { operatorId: "op-1", roles: ["operator"], tenantId: "tenant-a", workspaceId: null };
      const snapshot = service.buildSnapshot(operator);
      assert.equal(snapshot.taskBoard.length, 1);
      assert.equal(snapshot.taskBoard[0]?.taskId, "t-1");
    });

    it("should include critical approval in findings", () => {
      const approvals = [
        { approvalId: "a-1", taskId: "t-1", tenantId: null, riskLevel: "critical" as const, reason: "high risk", createdAt: "2024-01-01" },
      ];
      const service = new OperatorConsoleBackendService({ listPendingApprovals: () => approvals });
      const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };
      const snapshot = service.buildSnapshot(operator);
      assert.ok(snapshot.findings.some(f => f.includes("critical approval")));
    });

    it("should throw if operator id is empty", () => {
      const service = new OperatorConsoleBackendService({});
      const operator = { operatorId: "   ", roles: ["operator"], tenantId: null, workspaceId: null };
      assert.throws(() => service.buildSnapshot(operator), /operator_id_required/);
    });

    it("should plan human takeover action", () => {
      const service = new OperatorConsoleBackendService({});
      const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };
      const plan = service.planHumanTakeoverAction({
        actionId: "action-1",
        actionType: "take_over_task",
        taskId: "t-123",
        operator,
        reasonCode: "operator_override",
      });
      assert.equal(plan.actionId, "action-1");
      assert.equal(plan.actionType, "take_over_task");
      assert.equal(plan.taskId, "t-123");
      assert.ok(!plan.requiresPolicyEvaluation);
      assert.ok(!plan.requiresBreakGlass);
    });

    it("should require policy evaluation for high-risk actions", () => {
      const service = new OperatorConsoleBackendService({});
      const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };
      const plan = service.planHumanTakeoverAction({
        actionId: "action-1",
        actionType: "switch_worker",
        taskId: "t-123",
        operator,
        reasonCode: "rebalance",
      });
      assert.ok(plan.requiresPolicyEvaluation);
    });

    it("should require break glass for certain actions without role", () => {
      const service = new OperatorConsoleBackendService({});
      const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };
      const plan = service.planHumanTakeoverAction({
        actionId: "action-1",
        actionType: "skip_step",
        taskId: "t-123",
        operator,
        reasonCode: "debug",
      });
      assert.ok(plan.requiresBreakGlass);
    });

    it("should throw if taskId is empty in plan action", () => {
      const service = new OperatorConsoleBackendService({});
      const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };
      assert.throws(() => service.planHumanTakeoverAction({
        actionId: "action-1",
        actionType: "take_over_task",
        taskId: "   ",
        operator,
        reasonCode: "x",
      }), /task_id_required/);
    });

    it("should throw if reasonCode is empty in plan action", () => {
      const service = new OperatorConsoleBackendService({});
      const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };
      assert.throws(() => service.planHumanTakeoverAction({
        actionId: "action-1",
        actionType: "take_over_task",
        taskId: "t-123",
        operator,
        reasonCode: "  ",
      }), /reason_required/);
    });
  });
});