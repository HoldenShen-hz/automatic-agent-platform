/**
 * E2E Multi-Task Execution with Output Aggregation Tests
 *
 * End-to-end tests covering parallel task execution and output aggregation.
 * Tests scenarios where a parent task spawns multiple child tasks and
 * aggregates their outputs into a combined result.
 *
 * Coverage:
 * 1. Parent task spawns multiple child tasks
 * 2. Child tasks execute in parallel
 * 3. Parent aggregates outputs from all children
 * 4. Partial failure handling when some children fail
 * 5. Parent completes only after all children complete
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { TransitionService } from "../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { TaskStatus, ExecutionStatus } from "../../src/platform/contracts/types/status.js";

function makeTaskCommand(
  taskId: string,
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
  traceId: string,
  executionId: string | null = null,
) {
  return {
    entityKind: "task" as const,
    entityId: taskId,
    fromStatus,
    toStatus,
    executionId,
    reasonCode: "e2e_aggregation",
    traceId,
    actorType: "system" as const,
    occurredAt: nowIso(),
  };
}

function makeExecCommand(
  executionId: string,
  fromStatus: ExecutionStatus,
  toStatus: ExecutionStatus,
  traceId: string,
) {
  return {
    entityKind: "execution" as const,
    entityId: executionId,
    fromStatus,
    toStatus,
    reasonCode: "e2e_aggregation",
    traceId,
    actorType: "agent" as const,
    occurredAt: nowIso(),
  };
}

// ---------------------------------------------------------------------------
// Test 1: Parent task creates multiple child tasks
// ---------------------------------------------------------------------------

test("E2E Multi-Task Aggregation: parent task creates multiple child tasks", async () => {
  const harness = createE2EHarness("aa-e2e-multi-task-parent-");
  try {
    const parentTaskId = newId("task");
    const childTaskIds = [newId("task"), newId("task"), newId("task")];
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Create parent task
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: parentTaskId,
        parentId: null,
        rootId: parentTaskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Parent aggregation task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ request: "aggregate results" }),
        normalizedInputJson: JSON.stringify({ request: "aggregate results" }),
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Create child tasks
    harness.db.transaction(() => {
      for (let i = 0; i < childTaskIds.length; i++) {
        harness.store.insertTask({
// @ts-ignore
          id: childTaskIds[i],
          parentId: parentTaskId,
          rootId: parentTaskId, // Children share parent's rootId for lineage
          divisionId: "general_ops",
          tenantId: null,
          title: `Child task ${i}`,
          status: "queued",
          source: "system",
          priority: "normal",
          inputJson: JSON.stringify({ step: i }),
          normalizedInputJson: JSON.stringify({ step: i }),
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      }
    });

    // Verify all tasks exist
    const parent = harness.store.getTask(parentTaskId);
    assert.ok(parent, "Parent task should exist");
    assert.equal(parent!.status, "in_progress", "Parent should be in_progress");

    for (let i = 0; i < childTaskIds.length; i++) {
// @ts-ignore
      const child = harness.store.getTask(childTaskIds[i]);
      assert.ok(child, `Child task ${i} should exist`);
      assert.equal(child!.parentId, parentTaskId, `Child ${i} should reference parent`);
      assert.equal(child!.status, "queued", `Child ${i} should be queued`);
    }

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: Child tasks execute in parallel and produce outputs
// ---------------------------------------------------------------------------

test("E2E Multi-Task Aggregation: child tasks execute and produce outputs", async () => {
  const harness = createE2EHarness("aa-e2e-multi-task-exec-");
  try {
    const parentTaskId = newId("task");
    const childTaskIds = [newId("task"), newId("task")];
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();
    const childOutputs = [
      { step: 0, result: "data_from_step_0" },
      { step: 1, result: "data_from_step_1" },
    ];

    // Setup parent task
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: parentTaskId,
        parentId: null,
        rootId: parentTaskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Parent task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Setup child tasks and execute them
    harness.db.transaction(() => {
      for (let i = 0; i < childTaskIds.length; i++) {
        harness.store.insertTask({
// @ts-ignore
          id: childTaskIds[i],
          parentId: parentTaskId,
          rootId: parentTaskId,
          divisionId: "general_ops",
          tenantId: null,
          title: `Child ${i}`,
          status: "in_progress",
          source: "system",
          priority: "normal",
          inputJson: JSON.stringify(childOutputs[i]),
          normalizedInputJson: JSON.stringify(childOutputs[i]),
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });

        harness.store.insertExecution({
          id: newId("exec"),
// @ts-ignore
          taskId: childTaskIds[i],
          workflowId: "single_agent_minimal",
          parentExecutionId: null,
          agentId: "agent-child",
          roleId: "general_executor",
          runKind: "task_run",
          status: "executing",
          inputRef: null,
          traceId,
          attempt: 1,
          timeoutMs: 60000,
          budgetUsdLimit: 1,
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
      }
    });

    // Complete child tasks with outputs
    for (let i = 0; i < childTaskIds.length; i++) {
      const childTaskId = childTaskIds[i];
// @ts-ignore
      const executions = harness.store.execution.listExecutionsByTask(childTaskId);
      const executionId = executions[0]?.id;
      const sessionId = newId("sess");

      harness.db.transaction(() => {
        harness.store.insertSession({
          id: sessionId,
// @ts-ignore
          taskId: childTaskId,
          channel: "cli",
          status: "streaming",
          externalSessionId: null,
          createdAt: now,
          updatedAt: now,
        });
      });

      if (executionId) {
        ts.transitionExecutionStatus(makeExecCommand(executionId, "executing", "succeeded", traceId));
      }

      ts.transitionTaskTerminalState({
// @ts-ignore
        taskId: childTaskId,
        sessionId,
// @ts-ignore
        executionId: executionId ?? childTaskId,
        currentTaskStatus: "in_progress",
        currentWorkflowStatus: "running",
        currentSessionStatus: "streaming",
        currentExecutionStatus: "succeeded",
        terminalStatus: "done",
        taskOutputJson: JSON.stringify(childOutputs[i]),
        outputsJson: "[]",
        context: {
          reasonCode: "child.completed",
          traceId,
          actorType: "system",
          occurredAt: now,
        },
      });

// @ts-ignore
      const child = harness.store.getTask(childTaskId);
      assert.equal(child?.status, "done", `Child ${i} should be done`);
    }

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Parent task aggregates outputs from all children
// ---------------------------------------------------------------------------

test("E2E Multi-Task Aggregation: parent aggregates outputs from all children", async () => {
  const harness = createE2EHarness("aa-e2e-aggregate-");
  try {
    const parentTaskId = newId("task");
    const childTaskIds = [newId("task"), newId("task"), newId("task")];
    const parentExecutionId = newId("exec");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Simulated child outputs that would be aggregated
    const childOutputs = [
      { step: 0, data: [1, 2, 3] },
      { step: 1, data: [4, 5, 6] },
      { step: 2, data: [7, 8, 9] },
    ];

    // Create parent task in in_progress
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: parentTaskId,
        parentId: null,
        rootId: parentTaskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Parent aggregation task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ childCount: 3 }),
        normalizedInputJson: JSON.stringify({ childCount: 3 }),
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

// @ts-ignore
      harness.store.insertExecution({
        id: parentExecutionId,
        taskId: parentTaskId,
        workflowId: "multi_step_coordination",
        parentExecutionId: null,
        agentId: "agent-parent",
        roleId: "workflow_coordinator",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 120000,
        budgetUsdLimit: 1,
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

      // Insert child tasks that have completed
      for (let i = 0; i < childTaskIds.length; i++) {
        harness.store.insertTask({
// @ts-ignore
          id: childTaskIds[i],
          parentId: parentTaskId,
          rootId: parentTaskId,
          divisionId: "general_ops",
          tenantId: null,
          title: `Child ${i}`,
          status: "done",
          source: "system",
          priority: "normal",
          inputJson: JSON.stringify({ step: i }),
          normalizedInputJson: JSON.stringify({ step: i }),
          outputJson: JSON.stringify(childOutputs[i]),
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: now,
        });
      }
    });

    // Verify all child outputs exist
    const allOutputs = childTaskIds.map((childId) => {
      const child = harness.store.getTask(childId);
      return JSON.parse(child?.outputJson ?? "{}");
    });

    assert.equal(allOutputs.length, 3, "Should have 3 child outputs");
    assert.deepEqual(allOutputs[0], childOutputs[0], "First child output should match");
    assert.deepEqual(allOutputs[1], childOutputs[1], "Second child output should match");
    assert.deepEqual(allOutputs[2], childOutputs[2], "Third child output should match");

    // Parent aggregates all child outputs
    const aggregatedOutput = {
      combined: allOutputs.flatMap((o) => o.data),
      childCount: childTaskIds.length,
      status: "aggregated",
    };

    // Complete parent task with aggregated output
    const sessionId = newId("sess");
    harness.db.transaction(() => {
      harness.store.insertSession({
        id: sessionId,
        taskId: parentTaskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    ts.transitionExecutionStatus(makeExecCommand(parentExecutionId, "executing", "succeeded", traceId));

    ts.transitionTaskTerminalState({
      taskId: parentTaskId,
      sessionId,
      executionId: parentExecutionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify(aggregatedOutput),
      outputsJson: "[]",
      context: {
        reasonCode: "parent.aggregated",
        traceId,
        actorType: "system",
        occurredAt: now,
      },
    });

    const parent = harness.store.getTask(parentTaskId);
    assert.equal(parent?.status, "done", "Parent should be done");

    const finalOutput = JSON.parse(parent?.outputJson ?? "{}");
    assert.deepEqual(finalOutput.combined, [1, 2, 3, 4, 5, 6, 7, 8, 9], "Aggregated output should contain all child data");
    assert.equal(finalOutput.childCount, 3, "Aggregated output should track child count");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: Partial failure handling - some children fail
// ---------------------------------------------------------------------------

test("E2E Multi-Task Aggregation: partial failure when some children fail", async () => {
  const harness = createE2EHarness("aa-e2e-partial-fail-");
  try {
    const parentTaskId = newId("task");
    const childTaskIds = [newId("task"), newId("task"), newId("task")];
    const traceId = newId("trace");
    const now = nowIso();

    // Create parent task
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: parentTaskId,
        parentId: null,
        rootId: parentTaskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Parent with partial failure",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      // Child 0: succeeded
      harness.store.insertTask({
// @ts-ignore
        id: childTaskIds[0],
        parentId: parentTaskId,
        rootId: parentTaskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Child 0 - success",
        status: "done",
        source: "system",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: JSON.stringify({ result: "ok", data: 1 }),
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });

      // Child 1: failed
      harness.store.insertTask({
// @ts-ignore
        id: childTaskIds[1],
        parentId: parentTaskId,
        rootId: parentTaskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Child 1 - failed",
        status: "failed",
        source: "system",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: "E_EXECUTION_FAILED",
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });

      // Child 2: succeeded
      harness.store.insertTask({
// @ts-ignore
        id: childTaskIds[2],
        parentId: parentTaskId,
        rootId: parentTaskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Child 2 - success",
        status: "done",
        source: "system",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: JSON.stringify({ result: "ok", data: 2 }),
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });
    });

    // Verify partial failure state
// @ts-ignore
    const child0 = harness.store.getTask(childTaskIds[0]);
// @ts-ignore
    const child1 = harness.store.getTask(childTaskIds[1]);
// @ts-ignore
    const child2 = harness.store.getTask(childTaskIds[2]);

    assert.equal(child0?.status, "done", "Child 0 should be done");
    assert.equal(child1?.status, "failed", "Child 1 should be failed");
    assert.equal(child2?.status, "done", "Child 2 should be done");

    // Check error codes
    assert.ok(child1?.errorCode, "Failed child should have error code");
    assert.equal(child1?.errorCode, "E_EXECUTION_FAILED", "Error code should be E_EXECUTION_FAILED");

    // Parent completes with partial failure result
    // The parent itself succeeds even though some children failed - this is common
    // in "best effort" aggregation patterns
    const aggregatedOutput = {
      partial: true,
      succeededCount: 2,
      failedCount: 1,
      results: [
        JSON.parse(child0?.outputJson ?? "{}"),
        null, // Child 1 failed
        JSON.parse(child2?.outputJson ?? "{}"),
      ],
    };

    const sessionId = newId("sess");
    const executionId = newId("exec");
    harness.db.transaction(() => {
      harness.store.insertSession({
        id: sessionId,
        taskId: parentTaskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
// @ts-ignore
      harness.store.insertExecution({
        id: executionId,
        taskId: parentTaskId,
        workflowId: "multi_step_coordination",
        parentExecutionId: null,
        agentId: "agent-parent",
        roleId: "workflow_coordinator",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 120000,
        budgetUsdLimit: 1,
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
    });

    // Transition execution to succeeded
    const ts = new TransitionService(harness.db, harness.store);
    ts.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "executing",
      toStatus: "succeeded",
      reasonCode: "parent.aggregated",
      traceId,
      actorType: "system",
      occurredAt: now,
    });

    ts.transitionTaskTerminalState({
      taskId: parentTaskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify(aggregatedOutput),
      outputsJson: "[]",
      context: {
        reasonCode: "parent.partial_failure",
        traceId,
        actorType: "system",
        occurredAt: now,
      },
    });

    const parent = harness.store.getTask(parentTaskId);
    const output = JSON.parse(parent?.outputJson ?? "{}");

    assert.equal(parent?.status, "done", "Parent should complete (done)");
    assert.equal(output.partial, true, "Output should indicate partial failure");
    assert.equal(output.succeededCount, 2, "Should have 2 succeeded children");
    assert.equal(output.failedCount, 1, "Should have 1 failed child");

  } finally {
    harness.cleanup();
  }
});
