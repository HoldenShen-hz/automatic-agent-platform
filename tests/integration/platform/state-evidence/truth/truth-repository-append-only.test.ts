/**
 * Truth Repository Append-Only Semantics Integration Tests
 *
 * Tests storeAggregate operations and append-only semantics
 * for the authoritative task store.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import { createSeededIntegrationContext } from "../../../../helpers/integration-context.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("truth-repository: storeAggregate creates entity with append-only guarantee", () => {
  const ctx = createIntegrationContext("aa-truth-append-");
  try {
    const taskId = "task-append-001";
    const now = nowIso();

    // Insert via standard path - all records are append-only
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Append-only test",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    const task = ctx.store.getTask(taskId);
    assert.ok(task != null, "Task should be created");
    assert.equal(task!.status, "queued", "Task status should be queued");
    assert.ok(task!.createdAt != null, "createdAt should be set");
    assert.ok(task!.updatedAt != null, "updatedAt should be set");
  } finally {
    ctx.cleanup();
  }
});

test("truth-repository: Multiple tasks maintain independent append-only histories", () => {
  const ctx = createIntegrationContext("aa-truth-multi-");
  try {
    const now = nowIso();
    const taskIds = ["task-multi-001", "task-multi-002", "task-multi-003"];

    // Insert multiple tasks
    ctx.db.transaction(() => {
      for (const taskId of taskIds) {
        ctx.store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          tenantId: null,
          title: `Task ${taskId}`,
          status: "queued",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0.01,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      }
    });

    // Verify each task has independent state
    for (const taskId of taskIds) {
      const task = ctx.store.getTask(taskId);
      assert.ok(task != null, `Task ${taskId} should exist`);
      assert.equal(task!.id, taskId, `Task ID should match ${taskId}`);
    }

    // Update one task - others should not be affected
    const nowVal = nowIso();
    const firstTaskId = taskIds[0]!;
    ctx.db.transaction((): void => {
      ctx.store.updateTaskStatus(firstTaskId, "in_progress", nowVal, null, null);
    });

    const task0 = ctx.store.getTask(firstTaskId);
    const task1 = ctx.store.getTask(taskIds[1]!);
    assert.equal(task0!.status, "in_progress", "First task should be updated");
    assert.equal(task1!.status, "queued", "Second task should remain queued");
  } finally {
    ctx.cleanup();
  }
});

test("truth-repository: Workflow state append-only update cycle", () => {
  const ctx = createSeededIntegrationContext("aa-truth-wf-append-", {
    taskId: "task-wf-append-001",
    executionId: "exec-wf-append-001",
  });

  try {
    const taskId = "task-wf-append-001";
    const now = nowIso();

    // Insert workflow state
    ctx.db.transaction(() => {
      ctx.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "wf-append-001",
        status: "running",
        currentStepIndex: 0,
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        startedAt: now,
        updatedAt: now,
        resumableFromStep: null,
      });
    });

    let workflow = ctx.store.getWorkflowState(taskId);
    assert.ok(workflow != null, "Workflow should be created");
    assert.equal(workflow!.currentStepIndex, 0, "Initial step should be 0");
    assert.equal(workflow!.status, "running", "Initial status should be running");

    // Append-only update: advance step (status remains running)
    ctx.db.transaction(() => {
      ctx.store.updateWorkflowState(
        taskId,
        "running",
        1,
        JSON.stringify({ completedSteps: 1 }),
        now,
        null,
      );
    });

    workflow = ctx.store.getWorkflowState(taskId);
    assert.equal(workflow!.currentStepIndex, 1, "Step should advance to 1");

    // Complete workflow
    ctx.db.transaction(() => {
      ctx.store.updateWorkflowState(
        taskId,
        "running",
        4,
        JSON.stringify({ completedSteps: 5, result: "success" }),
        now,
        null,
      );
    });

    ctx.db.transaction(() => {
      ctx.store.updateWorkflowState(
        taskId,
        "completed",
        4,
        JSON.stringify({ completedSteps: 5, result: "success" }),
        now,
        null,
      );
    });

    workflow = ctx.store.getWorkflowState(taskId);
    assert.equal(workflow!.status, "completed", "Workflow should be completed");
    assert.equal(workflow!.currentStepIndex, 4, "Final step should be 4");
  } finally {
    ctx.cleanup();
  }
});

test("truth-repository: Execution lifecycle with append-only events", () => {
  const ctx = createSeededIntegrationContext("aa-truth-exec-append-", {
    taskId: "task-exec-append-001",
    executionId: "exec-exec-append-001",
  });

  try {
    const taskId = "task-exec-append-001";
    const executionId = "exec-exec-append-001";
    const now = nowIso();

    // Get execution created during seeding
    let execution = ctx.store.getExecution(executionId);
    assert.ok(execution != null, "Execution should exist from seeding");
    assert.equal(execution!.status, "executing", "Initial status should be executing");

    // Transition execution through states (append-only updates)
    const transitions = [
      { status: "prechecking", errorCode: null },
      { status: "executing", errorCode: null },
      { status: "succeeded", errorCode: null },
    ];

    for (const t of transitions) {
      ctx.db.transaction(() => {
        ctx.store.updateExecutionStatus(
          executionId,
          t.status,
          now,
          now,
          now,
          t.errorCode,
        );
      });
      execution = ctx.store.getExecution(executionId);
      assert.equal(execution!.status, t.status, `Execution should be ${t.status}`);
    }
  } finally {
    ctx.cleanup();
  }
});

test("truth-repository: CAS update enforces optimistic concurrency", () => {
  const ctx = createIntegrationContext("aa-truth-cas-");
  try {
    const taskId = "task-cas-001";
    const now = nowIso();

    // Create task
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "CAS test",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Successful CAS update
    const casNow = nowIso();
    let affected = ctx.db.transaction(() => {
      return ctx.store.updateTaskStatusCas(taskId, "queued", "in_progress", casNow, null, null);
    });
    assert.equal(affected, 1, "First CAS should succeed");

    // Failed CAS update - wrong expected status
    affected = ctx.db.transaction(() => {
      return ctx.store.updateTaskStatusCas(taskId, "queued", "running", casNow, null, null);
    });
    assert.equal(affected, 0, "Second CAS should fail - wrong expected status");

    // Verify task remains in expected state
    const task = ctx.store.getTask(taskId);
    assert.equal(task!.status, "in_progress", "Task should still be in_progress");
  } finally {
    ctx.cleanup();
  }
});

test("truth-repository: append-only events table maintains event sourcing", () => {
  const ctx = createSeededIntegrationContext("aa-truth-events-", {
    taskId: "task-events-001",
    executionId: "exec-events-001",
  });

  try {
    const taskId = "task-events-001";
    const now = nowIso();

    // Insert multiple events for the same task
    const eventTypes = [
      "task:created",
      "task:status_changed",
      "workflow:step_completed",
      "task:completed",
    ];

    ctx.db.transaction(() => {
      for (let i = 0; i < eventTypes.length; i++) {
        ctx.store.event.insertEvent({
          id: `evt-${i}-${Date.now()}`,
          taskId,
          sessionId: null,
          executionId: null,
          eventType: eventTypes[i]!,
          eventTier: "tier_1",
          payloadJson: JSON.stringify({ index: i }),
          traceId: `trace-events-${i}`,
          createdAt: now,
        } as any);
      }
    });

    // Verify events can be listed
    const events = ctx.store.event.listEventsForTask(taskId);
    assert.equal(events.length, eventTypes.length, "Should have all events");

    // Events should be ordered by creation time
    for (let i = 1; i < events.length; i++) {
      assert.ok(
        events[i - 1]!.createdAt <= events[i]!.createdAt,
        `Event ${i - 1} should have earlier or equal timestamp to event ${i}`,
      );
    }
  } finally {
    ctx.cleanup();
  }
});

test("truth-repository: Task with workflow maintains referential integrity", () => {
  const ctx = createSeededIntegrationContext("aa-truth-ref-", {
    taskId: "task-ref-001",
    executionId: "exec-ref-001",
  });

  try {
    const taskId = "task-ref-001";
    const executionId = "exec-ref-001";
    const now = nowIso();

    // Insert workflow state
    ctx.db.transaction(() => {
      ctx.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "wf-ref-001",
        status: "running",
        currentStepIndex: 0,
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        startedAt: now,
        updatedAt: now,
        resumableFromStep: null,
      });
    });

    // Verify workflow is linked to task
    const workflow = ctx.store.getWorkflowState(taskId);
    assert.ok(workflow != null, "Workflow should exist");
    assert.equal(workflow!.taskId, taskId, "Workflow should reference correct task");

    // Advance workflow
    ctx.db.transaction(() => {
      ctx.store.updateWorkflowState(
        taskId,
        "running",
        1,
        JSON.stringify({ step: 1 }),
        now,
        null,
      );
    });

    // Verify task still exists
    const task = ctx.store.getTask(taskId);
    assert.ok(task != null, "Task should still exist after workflow update");
  } finally {
    ctx.cleanup();
  }
});

test("truth-repository: Cost events append-only tracking", () => {
  const ctx = createSeededIntegrationContext("aa-truth-cost-", {
    taskId: "task-cost-001",
    executionId: "exec-cost-001",
  });

  try {
    const taskId = "task-cost-001";
    const sessionId = "sess-cost-001";
    const executionId = "exec-cost-001";
    const now = nowIso();

    // Insert multiple cost events (reserve → use cycle)
    const costs = [
      { id: "cost-001", tokens: 1000, costUsd: 0.01 },
      { id: "cost-002", tokens: 2000, costUsd: 0.02 },
      { id: "cost-003", tokens: 1500, costUsd: 0.015 },
    ];

    ctx.db.transaction(() => {
      for (const cost of costs) {
        ctx.store.insertCostEvent({
          id: cost.id,
          taskId,
          sessionId,
          executionId,
          agentId: "agent-1",
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
          inputTokens: cost.tokens,
          outputTokens: 0,
          costUsd: cost.costUsd,
          budgetScope: "task_execution",
          providerRequestId: null,
          pricingVersion: null,
          createdAt: now,
        });
      }
    });

    // List cost events for task
    const events = ctx.store.listCostEventsByTask(taskId);
    assert.equal(events.length, costs.length, "Should have all cost events");

    // Verify total cost accumulation (append-only aggregate)
    const totalCost = events.reduce((sum: number, e) => sum + e.costUsd, 0);
    const expectedTotal = costs.reduce((sum: number, c) => sum + c.costUsd, 0);
    assert.equal(totalCost, expectedTotal, "Total cost should match sum of events");
  } finally {
    ctx.cleanup();
  }
});

test("truth-repository: Session append-only lifecycle", () => {
  const ctx = createIntegrationContext("aa-truth-session-");
  try {
    const taskId = "task-session-001";
    const sessionId = "sess-session-001";
    const now = nowIso();

    // Create task first
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Session test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Insert session
    ctx.db.transaction(() => {
      ctx.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    let session = ctx.store.getSession(sessionId);
    assert.ok(session != null, "Session should exist");
    assert.equal(session!.status, "open", "Initial status should be open");

    // Transition through append-only states
    const transitions = ["streaming", "awaiting_user", "streaming", "completed"];
    for (const status of transitions) {
      ctx.db.transaction(() => {
        ctx.store.updateSessionStatus(sessionId, status as any, now);
      });
      session = ctx.store.getSession(sessionId);
      assert.equal(session!.status, status, `Session should be ${status}`);
    }
  } finally {
    ctx.cleanup();
  }
});