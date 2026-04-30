/**
 * Unit tests for tests/helpers/fixtures/composite.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createBlockedTask,
  createApprovalRequest,
  createCompletedTask,
  createFailedTask,
  createCompleteHarnessRun,
  createBudgetReservedHarnessRun,
} from "../../helpers/fixtures/composite.js";

describe("fixtures/composite", () => {
  describe("createBlockedTask", () => {
    it("should create a task in pending status", () => {
      const { task, execution } = createBlockedTask("task-1", "exec-1");
      assert.strictEqual(task.id, "task-1");
      assert.strictEqual(task.status, "pending");
      assert.strictEqual(task.title, "Blocked task");
    });

    it("should create an execution that requires approval", () => {
      const { task, execution } = createBlockedTask("task-1", "exec-1");
      assert.strictEqual(execution.id, "exec-1");
      assert.strictEqual(execution.taskId, "task-1");
      assert.strictEqual(execution.requiresApproval, 1);
      assert.strictEqual(execution.status, "executing");
    });

    it("should use provided overrides", () => {
      const { task } = createBlockedTask("task-2", "exec-2", {
        title: "Custom blocked task",
        priority: "high",
      });
      assert.strictEqual(task.title, "Custom blocked task");
      assert.strictEqual(task.priority, "high");
    });
  });

  describe("createApprovalRequest", () => {
    it("should create an approval with requested status", () => {
      const approval = createApprovalRequest("approval-1", "task-1", "exec-1");
      assert.strictEqual(approval.id, "approval-1");
      assert.strictEqual(approval.taskId, "task-1");
      assert.strictEqual(approval.executionId, "exec-1");
      assert.strictEqual(approval.status, "requested");
    });

    it("should use provided overrides", () => {
      const approval = createApprovalRequest("approval-2", "task-2", "exec-2", {
        status: "approved",
      });
      assert.strictEqual(approval.status, "approved");
    });
  });

  describe("createCompletedTask", () => {
    it("should create a task in done status", () => {
      const { task, execution } = createCompletedTask("task-1", "exec-1");
      assert.strictEqual(task.id, "task-1");
      assert.strictEqual(task.status, "done");
      assert.strictEqual(task.title, "Completed task");
      assert.ok(task.completedAt !== null);
    });

    it("should create an execution with succeeded status", () => {
      const { task, execution } = createCompletedTask("task-1", "exec-1");
      assert.strictEqual(execution.id, "exec-1");
      assert.strictEqual(execution.taskId, "task-1");
      assert.strictEqual(execution.status, "succeeded");
      assert.ok(execution.finishedAt !== null);
    });

    it("should have output json set", () => {
      const { task } = createCompletedTask("task-1", "exec-1");
      assert.ok(task.outputJson !== null);
    });

    it("should use provided overrides", () => {
      const { task } = createCompletedTask("task-2", "exec-2", {
        title: "Custom completed task",
      });
      assert.strictEqual(task.title, "Custom completed task");
    });
  });

  describe("createFailedTask", () => {
    it("should create a task in failed status", () => {
      const { task, execution } = createFailedTask("task-1", "exec-1");
      assert.strictEqual(task.id, "task-1");
      assert.strictEqual(task.status, "failed");
      assert.strictEqual(task.title, "Failed task");
      assert.ok(task.completedAt !== null);
    });

    it("should create an execution with failed status", () => {
      const { task, execution } = createFailedTask("task-1", "exec-1");
      assert.strictEqual(execution.id, "exec-1");
      assert.strictEqual(execution.taskId, "task-1");
      assert.strictEqual(execution.status, "failed");
      assert.strictEqual(execution.lastErrorCode, "task.execution_failed");
      assert.ok(execution.finishedAt !== null);
    });

    it("should use custom error code", () => {
      const { task, execution } = createFailedTask(
        "task-1",
        "exec-1",
        "custom.error_code",
      );
      assert.strictEqual(execution.lastErrorCode, "custom.error_code");
      assert.strictEqual(task.errorCode, "custom.error_code");
    });

    it("should use provided overrides", () => {
      const { task } = createFailedTask("task-2", "exec-2", "ERR", {
        title: "Custom failed task",
      });
      assert.strictEqual(task.title, "Custom failed task");
    });
  });

  describe("createCompleteHarnessRun", () => {
    it("should create harness run with plan graph bundle and budget ledger", () => {
      const result = createCompleteHarnessRun("hrun-1", "ctspec-1");
      assert.ok(result.harnessRun);
      assert.ok(result.planGraphBundle);
      assert.ok(result.budgetLedger);
      assert.ok(result.nodeRuns);
    });

    it("should set harness run id correctly", () => {
      const result = createCompleteHarnessRun("hrun-custom", "ctspec-1");
      assert.strictEqual(result.harnessRun.harnessRunId, "hrun-custom");
      assert.strictEqual(result.planGraphBundle.harnessRunId, "hrun-custom");
      assert.strictEqual(result.budgetLedger.harnessRunId, "hrun-custom");
    });

    it("should create node runs for each node in graph", () => {
      const result = createCompleteHarnessRun("hrun-1", "ctspec-1", {
        nodeIds: ["init", "process", "final"],
      });
      assert.strictEqual(result.nodeRuns.length, 3);
    });

    it("should use default node ids when not provided", () => {
      const result = createCompleteHarnessRun("hrun-1", "ctspec-1");
      assert.strictEqual(result.nodeRuns.length, 3); // ["init", "process", "final"]
    });

    it("should set status when provided", () => {
      const result = createCompleteHarnessRun("hrun-1", "ctspec-1", {
        status: "running",
      });
      assert.strictEqual(result.harnessRun.status, "running");
    });

    it("should link plan graph bundle to harness run", () => {
      const result = createCompleteHarnessRun("hrun-1", "ctspec-1");
      assert.strictEqual(
        result.harnessRun.planGraphBundleId,
        result.planGraphBundle.planGraphBundleId,
      );
    });
  });

  describe("createBudgetReservedHarnessRun", () => {
    it("should create harness run with budget reservation", () => {
      const result = createBudgetReservedHarnessRun("hrun-1", "nrun-1");
      assert.ok(result.harnessRun);
      assert.ok(result.planGraphBundle);
      assert.ok(result.budgetLedger);
      assert.ok(result.budgetReservation);
    });

    it("should set harness run to running status", () => {
      const result = createBudgetReservedHarnessRun("hrun-1", "nrun-1");
      assert.strictEqual(result.harnessRun.status, "running");
    });

    it("should set budget ledger reserved amount", () => {
      const result = createBudgetReservedHarnessRun("hrun-1", "nrun-1", {
        amount: 500,
      });
      assert.strictEqual(result.budgetLedger.reservedAmount, 500);
      assert.strictEqual(result.budgetReservation.amount, 500);
    });

    it("should link budget reservation to node run", () => {
      const result = createBudgetReservedHarnessRun("hrun-1", "nrun-custom");
      assert.strictEqual(result.budgetReservation.nodeRunId, "nrun-custom");
    });

    it("should use default amount and resource kind", () => {
      const result = createBudgetReservedHarnessRun("hrun-1", "nrun-1");
      assert.strictEqual(result.budgetReservation.amount, 100);
      assert.strictEqual(result.budgetReservation.resourceKind, "token");
    });

    it("should allow custom resource kind", () => {
      const result = createBudgetReservedHarnessRun("hrun-1", "nrun-1", {
        resourceKind: "compute",
      });
      assert.strictEqual(result.budgetReservation.resourceKind, "compute");
    });
  });
});
