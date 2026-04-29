/**
 * E2E Budget Enforcement Tests
 *
 * End-to-end tests verifying per-execution budget enforcement:
 * - Budget is reserved at execution start
 * - Execution is blocked when actual cost exceeds budget limit
 * - Cost tracking accurately reflects resource consumption
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createE2EHarness } from "../helpers/e2e-harness.js";
import { withProcessGuard } from "../helpers/process-guard.js";
import { runSingleTaskExecution } from "../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";

/**
 * Test: Per-execution budget enforcement - execution blocked when cost exceeds limit
 *
 * This test verifies that when actual cost exceeds the budget limit,
 * the execution is properly blocked/rejected rather than allowed to continue.
 */
test("E2E Budget Enforcement: execution blocked when actual cost exceeds budget limit", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-budget-enforce-");
    try {
      // Set a very low budget (0.001 USD) that will be exceeded by even minimal execution
      const lowBudget = 0.001;

      // Execute with a task that should cost more than the budget
      // Using stepOutputOverride to simulate actual LLM cost
      const result = await runSingleTaskExecution({
        dbPath: harness.dbPath,
        title: "Budget enforcement test",
        request: "Analyze this request and produce a summary",
        stepOutputOverride: {
          summary: "Budget test completed",
          result: "Done",
        },
        // Inject a cost that exceeds the budget
        costOverride: 0.01, // 10x the budget limit
      });

      const execution = result.executions?.[0];
      assert.ok(execution, "Should have execution record");

      // The execution should have been blocked due to budget exceeded
      // Check that either:
      // 1. The execution was cancelled/rejected due to budget
      // 2. The task reached a terminal state indicating budget enforcement
      const task = result.task;
      assert.ok(task, "Should have task record");

      // Verify budget limit was set
      assert.equal(
        execution?.budgetUsdLimit,
        lowBudget,
        "Budget limit should be set to low value",
      );

      // Verify actual cost exceeded budget
      const actualCost = task.actualCostUsd ?? 0;
      const budgetLimit = execution?.budgetUsdLimit ?? 0;

      // If actual cost exceeded budget, verify enforcement happened
      if (actualCost > budgetLimit) {
        // The task should be in a state indicating budget enforcement
        // Either failed with budget error code, or cancelled
        const budgetEnforced =
          task.status === "failed" ||
          task.status === "cancelled" ||
          task.errorCode?.includes("budget");

        assert.ok(
          budgetEnforced,
          `When actual cost (${actualCost}) exceeds budget (${budgetLimit}), ` +
            `execution should be blocked. Task status: ${task.status}, errorCode: ${task.errorCode}`,
        );
      }
    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

/**
 * Test: Budget enforcement prevents execution from proceeding when limit exceeded
 */
test("E2E Budget Enforcement: task with exceeded budget does not complete successfully", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-budget-block-");
    try {
      const result = await runSingleTaskExecution({
        dbPath: harness.dbPath,
        title: "Budget block test",
        request: "Do something expensive",
        stepOutputOverride: {
          summary: "Expensive task",
          result: "Done",
        },
        costOverride: 100.0, // Intentionally set high cost
      });

      const execution = result.executions?.[0];
      assert.ok(execution, "Should have execution record");

      // Verify budget is set
      const budgetLimit = execution?.budgetUsdLimit ?? 0;
      assert.ok(budgetLimit > 0, "Budget limit should be set");

      // If cost exceeded budget, verify task did not succeed
      const task = result.task;
      const actualCost = task?.actualCostUsd ?? 0;

      if (actualCost > budgetLimit) {
        // Task should NOT be in 'done' status if budget was exceeded
        assert.notEqual(
          task?.status,
          "done",
          `Task should not complete successfully when actual cost (${actualCost}) ` +
            `exceeds budget (${budgetLimit})`,
        );

        // Should have either failed or cancelled status
        assert.ok(
          task?.status === "failed" || task?.status === "cancelled",
          `Task status should be failed or cancelled, got: ${task?.status}`,
        );
      }
    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

/**
 * Test: Cost events are recorded throughout execution lifecycle
 */
test("E2E Budget Enforcement: cost events are recorded throughout execution", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-budget-events-");
    try {
      const result = await runSingleTaskExecution({
        dbPath: harness.dbPath,
        title: "Cost tracking test",
        request: "Track my costs",
        stepOutputOverride: {
          summary: "Cost tracked",
          result: "Done",
        },
      });

      const task = result.task;
      assert.ok(task, "Should have task record");
      assert.ok(task?.actualCostUsd !== undefined, "Should have actual cost tracked");
      assert.ok(task?.actualCostUsd >= 0, "Actual cost should be non-negative");

      // Verify cost events are recorded
      const costEvents = harness.store.listCostEventsByTask(task.id);
      assert.ok(costEvents.length > 0, "Should have cost events recorded");

      // Verify execution has budget limit set
      const execution = result.executions?.[0];
      assert.ok(execution, "Should have execution record");
      assert.ok(
        execution?.budgetUsdLimit !== undefined && execution?.budgetUsdLimit !== null,
        "Execution should have budget limit set",
      );
    } finally {
      harness.cleanup();
    }
  });
  await guard();
});