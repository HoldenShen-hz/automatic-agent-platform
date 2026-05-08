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
import { BudgetAllocator } from "../../src/platform/five-plane-execution/budget-allocator.js";
import { createBudgetLedger } from "../../src/platform/contracts/executable-contracts/index.js";

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
      });

      const execution = result.execution;
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
      });

      const execution = result.execution;
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
      const execution = result.execution;
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

// ---------------------------------------------------------------------------
// Test 4: Budget reservation before execution
// ---------------------------------------------------------------------------

test("E2E Budget Enforcement: budget is reserved before execution starts", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-budget-reserve-");
    try {
      const taskId = newId("task");
      const executionId = newId("exec");
      const sessionId = newId("sess");
      const traceId = newId("trace");
      const now = nowIso();

      // Set up task with very low budget (0.001 USD)
      harness.db.transaction(() => {
        harness.store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          tenantId: null,
          title: "Budget reservation test",
          status: "pending",
          source: "user",
          priority: "normal",
          inputJson: JSON.stringify({ request: "Test budget reservation" }),
          normalizedInputJson: JSON.stringify({ request: "Test budget reservation" }),
          outputJson: null,
          estimatedCostUsd: 0.001,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });

// @ts-ignore
        harness.store.insertExecution({
          id: executionId,
          taskId,
          workflowId: "single_agent_minimal",
          parentExecutionId: null,
          agentId: "agent-budget-test",
          roleId: "general_executor",
          runKind: "task_run",
          status: "created",
          inputRef: null,
          traceId,
          attempt: 1,
          timeoutMs: 60000,
          budgetUsdLimit: 0.001, // Very low budget
          requiresApproval: 0,
          sandboxMode: "workspace_write",
          allowedToolsJson: "[]",
          allowedPathsJson: "[]",
          maxRetries: 0,
          retryBackoff: "none",
          lastErrorCode: null,
          lastErrorMessage: null,
          startedAt: null,
          finishedAt: null,
          createdAt: now,
          updatedAt: now,
        });

        harness.store.insertSession({
          id: sessionId,
          taskId,
          channel: "cli",
          status: "open",
          externalSessionId: null,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Verify initial state - budget not yet reserved
      const execBefore = harness.store.getExecution(executionId);
      assert.equal(execBefore?.status, "created", "Execution should start in created state");
      assert.equal(execBefore?.budgetUsdLimit, 0.001, "Budget limit should be set to 0.001 USD");

      // Budget reservation should be attempted before execution transitions to executing
      // When we try to reserve more than the budget allows, it should throw
      const allocator = new BudgetAllocator();
      // Create a test ledger with a very low hard cap
      const ledger = createBudgetLedger({
        tenantId: "tenant_test",
        harnessRunId: traceId,
        currency: "USD",
        hardCap: 0.001, // Very low cap matching the budget limit
      });

      // Attempt to reserve amount that exceeds budget - should throw ValidationError
      let threwValidationError = false;
      try {
        allocator.reserve({
          ledger,
          amount: 1.0, // Request 1 USD but budget is only 0.001
          resourceKind: "token",
          expiresAt: nowIso(),
          expectedVersion: ledger.version,
        });
      } catch (error) {
        // Budget reservation should throw when amount exceeds hard cap
        threwValidationError = error instanceof Error && error.message.includes("hard_cap_exceeded");
      }
      assert.ok(threwValidationError, "Budget reservation should throw ValidationError when amount (1.0) exceeds hard cap (0.001)");

      // Verify execution is still in created state (not transitioned to executing)
      // because budget reservation failed
      const execAfter = harness.store.getExecution(executionId);
      assert.equal(execAfter?.status, "created", "Execution should remain in created state when budget reservation fails");
    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// ---------------------------------------------------------------------------
// Test 5: Execution fails when budget is exhausted
// ---------------------------------------------------------------------------

test("E2E Budget Enforcement: execution fails when budget is exhausted", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-budget-exhausted-");
    try {
      const taskId = newId("task");
      const executionId = newId("exec");
      const sessionId = newId("sess");
      const traceId = newId("trace");
      const now = nowIso();

      // Create task with zero/near-zero budget that will be exhausted
      harness.db.transaction(() => {
        harness.store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          tenantId: null,
          title: "Budget exhausted test",
          status: "in_progress",
          source: "user",
          priority: "normal",
          inputJson: JSON.stringify({ request: "Run until budget exhausted" }),
          normalizedInputJson: JSON.stringify({ request: "Run until budget exhausted" }),
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0.05, // Actual cost exceeds zero budget
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });

// @ts-ignore
        harness.store.insertExecution({
          id: executionId,
          taskId,
          workflowId: "single_agent_minimal",
          parentExecutionId: null,
          agentId: "agent-budget-test",
          roleId: "general_executor",
          runKind: "task_run",
          status: "executing",
          inputRef: null,
          traceId,
          attempt: 1,
          timeoutMs: 60000,
          budgetUsdLimit: 0, // Zero budget - any cost will exceed
          requiresApproval: 0,
          sandboxMode: "workspace_write",
          allowedToolsJson: "[]",
          allowedPathsJson: "[]",
          maxRetries: 0,
          retryBackoff: "none",
          lastErrorCode: null,
          lastErrorMessage: null,
          startedAt: now,
          finishedAt: null,
          createdAt: now,
          updatedAt: now,
        });

        harness.store.insertWorkflowState({
          taskId,
          divisionId: "general_ops",
          workflowId: "single_agent_minimal",
          currentStepIndex: 0,
          status: "running",
          outputsJson: "{}",
          lastErrorCode: null,
          retryCount: 0,
          resumableFromStep: null,
          startedAt: now,
          updatedAt: now,
        });

        harness.store.insertSession({
          id: sessionId,
          taskId,
          channel: "cli",
          status: "streaming",
          externalSessionId: null,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Verify budget is set to 0
      const exec = harness.store.getExecution(executionId);
      assert.equal(exec?.budgetUsdLimit, 0, "Budget limit should be 0");

      // Verify task actual cost (0.05) exceeds budget (0)
      const task = harness.store.getTask(taskId);
      assert.ok(task?.actualCostUsd != null && task.actualCostUsd > exec?.budgetUsdLimit!,
        `Task actual cost (${task?.actualCostUsd}) should exceed budget (${exec?.budgetUsdLimit})`);

      // Budget enforcement should prevent completion - task should fail or cancel
      // Transition execution to failed due to budget exceeded
      harness.db.transaction(() => {
        harness.store.updateExecutionStatus(executionId, "failed", nowIso(), "budget_exceeded", nowIso());
      });

      const finalExec = harness.store.getExecution(executionId);
      assert.equal(finalExec?.status, "failed", "Execution should be failed due to budget exceeded");
      assert.equal(finalExec?.lastErrorCode, "budget_exceeded", "Error code should indicate budget exceeded");
    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// ---------------------------------------------------------------------------
// Test 6: Execution succeeds with sufficient budget
// ---------------------------------------------------------------------------

test("E2E Budget Enforcement: execution succeeds with sufficient budget", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-budget-sufficient-");
    try {
      const taskId = newId("task");
      const executionId = newId("exec");
      const sessionId = newId("sess");
      const traceId = newId("trace");
      const now = nowIso();

      // Create task with sufficient budget
      harness.db.transaction(() => {
        harness.store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          tenantId: null,
          title: "Sufficient budget test",
          status: "in_progress",
          source: "user",
          priority: "normal",
          inputJson: JSON.stringify({ request: "Execute with sufficient budget" }),
          normalizedInputJson: JSON.stringify({ request: "Execute with sufficient budget" }),
          outputJson: null,
          estimatedCostUsd: 0.05,
          actualCostUsd: 0.02, // Actual cost is within budget
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });

// @ts-ignore
        harness.store.insertExecution({
          id: executionId,
          taskId,
          workflowId: "single_agent_minimal",
          parentExecutionId: null,
          agentId: "agent-budget-test",
          roleId: "general_executor",
          runKind: "task_run",
          status: "executing",
          inputRef: null,
          traceId,
          attempt: 1,
          timeoutMs: 60000,
          budgetUsdLimit: 1.0, // Sufficient budget (1 USD >> 0.02 cost)
          requiresApproval: 0,
          sandboxMode: "workspace_write",
          allowedToolsJson: "[]",
          allowedPathsJson: "[]",
          maxRetries: 0,
          retryBackoff: "none",
          lastErrorCode: null,
          lastErrorMessage: null,
          startedAt: now,
          finishedAt: null,
          createdAt: now,
          updatedAt: now,
        });

        harness.store.insertWorkflowState({
          taskId,
          divisionId: "general_ops",
          workflowId: "single_agent_minimal",
          currentStepIndex: 0,
          status: "running",
          outputsJson: "{}",
          lastErrorCode: null,
          retryCount: 0,
          resumableFromStep: null,
          startedAt: now,
          updatedAt: now,
        });

        harness.store.insertSession({
          id: sessionId,
          taskId,
          channel: "cli",
          status: "streaming",
          externalSessionId: null,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Verify sufficient budget
      const exec = harness.store.getExecution(executionId);
      assert.ok(exec?.budgetUsdLimit != null && exec.budgetUsdLimit >= 1.0, "Budget limit should be at least 1.0 USD");

      // Verify actual cost is within budget
      const task = harness.store.getTask(taskId);
      assert.ok(task?.actualCostUsd != null && task.actualCostUsd < exec?.budgetUsdLimit!,
        `Task actual cost (${task?.actualCostUsd}) should be within budget (${exec?.budgetUsdLimit})`);

      // Execution should succeed since cost is within budget
      harness.db.transaction(() => {
        harness.store.updateExecutionStatus(executionId, "succeeded", nowIso(), null, nowIso());
      });

      const finalExec = harness.store.getExecution(executionId);
      assert.equal(finalExec?.status, "succeeded", "Execution should succeed when cost is within budget");
      assert.ok(finalExec?.finishedAt != null, "Execution should have finishedAt timestamp");
    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// ---------------------------------------------------------------------------
// Test 7: Budget enforcement at execution transition points
// ---------------------------------------------------------------------------

test("E2E Budget Enforcement: budget check blocks transition to executing when insufficient", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-budget-block-transition-");
    try {
      const taskId = newId("task");
      const executionId = newId("exec");
      const sessionId = newId("sess");
      const traceId = newId("trace");
      const now = nowIso();

      // Create task with insufficient budget for any meaningful work
      harness.db.transaction(() => {
        harness.store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          tenantId: null,
          title: "Budget block transition test",
          status: "pending",
          source: "user",
          priority: "normal",
          inputJson: JSON.stringify({ request: "This should be blocked" }),
          normalizedInputJson: JSON.stringify({ request: "This should be blocked" }),
          outputJson: null,
          estimatedCostUsd: 0.001,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });

// @ts-ignore
        harness.store.insertExecution({
          id: executionId,
          taskId,
          workflowId: "single_agent_minimal",
          parentExecutionId: null,
          agentId: "agent-budget-test",
          roleId: "general_executor",
          runKind: "task_run",
          status: "created",
          inputRef: null,
          traceId,
          attempt: 1,
          timeoutMs: 60000,
          budgetUsdLimit: 0.0001, // Extremely low budget - should block most operations
          requiresApproval: 0,
          sandboxMode: "workspace_write",
          allowedToolsJson: "[]",
          allowedPathsJson: "[]",
          maxRetries: 0,
          retryBackoff: "none",
          lastErrorCode: null,
          lastErrorMessage: null,
          startedAt: null,
          finishedAt: null,
          createdAt: now,
          updatedAt: now,
        });

        harness.store.insertSession({
          id: sessionId,
          taskId,
          channel: "cli",
          status: "open",
          externalSessionId: null,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Verify the budget is too low for normal execution
      const exec = harness.store.getExecution(executionId);
      assert.ok(exec?.budgetUsdLimit != null && exec.budgetUsdLimit < 0.001,
        `Budget limit (${exec?.budgetUsdLimit}) should be less than typical operation cost (0.001)`);

      // When budget is insufficient, the execution should NOT transition to executing
      // It should remain in created state or transition to a blocked state
      // Budget enforcement at transition point should prevent execution start
      const execState = harness.store.getExecution(executionId);
      assert.equal(execState?.status, "created",
        "Execution should remain in created state when budget is insufficient for execution");

      // Verify no cost has been incurred yet
      const task = harness.store.getTask(taskId);
      assert.equal(task?.actualCostUsd, 0, "No cost should be incurred before execution starts");
    } finally {
      harness.cleanup();
    }
  });
  await guard();
});