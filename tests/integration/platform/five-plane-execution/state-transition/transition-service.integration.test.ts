/**
 * Integration Tests: State Transition Service with Real Store
 *
 * Tests the TransitionService with actual SQLite database and store,
 * verifying end-to-end state transitions for tasks, workflows, sessions,
 * and executions with event emission.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import { TransitionService } from "../../../../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { createRuntimeLifecycleRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/repositories/runtime-lifecycle-repository.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("state-transition: TransitionService updates task status with real store", () => {
  const ctx = createIntegrationContext("aa-ts-task-");
  try {
    const repository = createRuntimeLifecycleRepository(ctx.store);
    const transitions = new TransitionService(ctx.db, ctx.store, repository);

    const taskId = "ts-task-001";
    const executionId = "ts-exec-001";
    const traceId = "ts-trace-001";
    const now = nowIso();

    // Seed task in queued state
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        tenantId: null,
        title: "TransitionService test task",
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
      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        harnessRunId: null,
        budgetReservationId: null,
        budgetLedgerId: null,
        agentId: "agent-ts",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
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
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Transition task: queued -> in_progress
    transitions.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "queued",
      toStatus: "in_progress",
      executionId,
      reasonCode: "task.started",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    const taskAfterFirst = ctx.store.getTask(taskId);
    assert.equal(taskAfterFirst?.status, "in_progress", "Task should be in_progress after transition");

    // Transition execution: created -> prechecking
    transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "created",
      toStatus: "prechecking",
      reasonCode: "execution.precheck_started",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    const execAfterFirst = ctx.store.getExecution(executionId);
    assert.equal(execAfterFirst?.status, "prechecking", "Execution should be in prechecking");

    // Verify events were created
    const events = ctx.store.listEventsForTask(taskId);
    const statusEvents = events.filter((e) => e.eventType === "task:status_changed");
    assert.ok(statusEvents.length >= 1, "Should have at least one task status changed event");
  } finally {
    ctx.cleanup();
  }
});

test("state-transition: TransitionService cascades terminal state to all entities", () => {
  const ctx = createIntegrationContext("aa-ts-cascade-");
  try {
    const repository = createRuntimeLifecycleRepository(ctx.store);
    const transitions = new TransitionService(ctx.db, ctx.store, repository);

    const taskId = "ts-cascade-001";
    const sessionId = "ts-sess-001";
    const executionId = "ts-exec-002";
    const now = nowIso();

    // Seed all entities
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        tenantId: null,
        title: "Cascade test task",
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
      ctx.store.insertWorkflowState({
        taskId,
        divisionId: "general-ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 1,
        status: "running",
        outputsJson: JSON.stringify({}),
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
      ctx.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        harnessRunId: null,
        budgetReservationId: null,
        budgetLedgerId: null,
        agentId: "agent-cascade",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-cascade",
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
    });

    // Trigger cascade terminal transition
    transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "cascade_success" }),
      outputsJson: JSON.stringify({}),
      context: {
        reasonCode: "task.completed",
        traceId: "trace-cascade",
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    // Verify all entities reached terminal states
    const task = ctx.store.getTask(taskId);
    const workflow = ctx.store.getWorkflowState(taskId);
    const session = ctx.store.getSession(sessionId);
    const execution = ctx.store.getExecution(executionId);

    assert.equal(task?.status, "done", "Task should be done");
    assert.equal(workflow?.status, "completed", "Workflow should be completed");
    assert.equal(session?.status, "completed", "Session should be completed");
    assert.equal(execution?.status, "succeeded", "Execution should be succeeded");

    // Verify output was persisted
    assert.ok(task?.outputJson != null, "Task output should be persisted");
    const output = JSON.parse(task!.outputJson!);
    assert.equal(output.result, "cascade_success", "Output result should match");
  } finally {
    ctx.cleanup();
  }
});

test("state-transition: TransitionService handles failed terminal state", () => {
  const ctx = createIntegrationContext("aa-ts-failed-");
  try {
    const repository = createRuntimeLifecycleRepository(ctx.store);
    const transitions = new TransitionService(ctx.db, ctx.store, repository);

    const taskId = "ts-failed-001";
    const sessionId = "ts-sess-failed-001";
    const executionId = "ts-exec-failed-001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        tenantId: null,
        title: "Failed test task",
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
      ctx.store.insertWorkflowState({
        taskId,
        divisionId: "general-ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 1,
        status: "running",
        outputsJson: JSON.stringify({}),
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
      ctx.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        harnessRunId: null,
        budgetReservationId: null,
        budgetLedgerId: null,
        agentId: "agent-failed",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-failed",
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
    });

    // Trigger cascade with failed status
    transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: "failed",
      taskOutputJson: JSON.stringify({ error: "workflow.step_failed" }),
      outputsJson: JSON.stringify({}),
      context: {
        reasonCode: "workflow.step_failed",
        traceId: "trace-failed",
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = ctx.store.getTask(taskId);
    const workflow = ctx.store.getWorkflowState(taskId);
    const execution = ctx.store.getExecution(executionId);

    assert.equal(task?.status, "failed", "Task should be failed");
    assert.equal(task?.errorCode, "workflow.step_failed", "Task should have error code");
    assert.equal(workflow?.status, "failed", "Workflow should be failed");
    assert.equal(execution?.status, "failed", "Execution should be failed");
  } finally {
    ctx.cleanup();
  }
});

test("state-transition: TransitionService closes task without execution record", () => {
  const ctx = createIntegrationContext("aa-ts-no-exec-");
  try {
    const repository = createRuntimeLifecycleRepository(ctx.store);
    const transitions = new TransitionService(ctx.db, ctx.store, repository);

    const taskId = "ts-no-exec-001";
    const sessionId = "ts-no-exec-sess-001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        tenantId: null,
        title: "No execution record terminal transition",
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
      ctx.store.insertWorkflowState({
        taskId,
        divisionId: "general-ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 0,
        status: "running",
        outputsJson: JSON.stringify({}),
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
      ctx.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId: null,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "ok" }),
      outputsJson: JSON.stringify({ result: "ok" }),
      context: {
        reasonCode: "task.completed_without_execution",
        traceId: "trace-no-exec",
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    assert.equal(ctx.store.getTask(taskId)?.status, "done");
    assert.equal(ctx.store.getWorkflowState(taskId)?.status, "completed");
    assert.equal(ctx.store.getSession(sessionId)?.status, "completed");
    const statusEvent = ctx.store.listEventsForTask(taskId).find((event) => event.eventType === "task:status_changed");
    assert.equal(statusEvent?.executionId ?? null, null);
  } finally {
    ctx.cleanup();
  }
});

test("state-transition: TransitionService workflow pause and resume cycle", () => {
  const ctx = createIntegrationContext("aa-ts-workflow-");
  try {
    const repository = createRuntimeLifecycleRepository(ctx.store);
    const transitions = new TransitionService(ctx.db, ctx.store, repository);

    const taskId = "ts-wf-001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        tenantId: null,
        title: "Workflow pause test",
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
      ctx.store.insertWorkflowState({
        taskId,
        divisionId: "general-ops",
        workflowId: "multi_step_workflow",
        currentStepIndex: 2,
        status: "running",
        outputsJson: JSON.stringify({ step1: { result: "ok" }, step2: { result: "ok" } }),
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
    });

    // Pause workflow
    transitions.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "running",
      toStatus: "paused",
      currentStepIndex: 2,
      outputsJson: JSON.stringify({ step1: { result: "ok" }, step2: { result: "ok" } }),
      reasonCode: "workflow.paused",
      traceId: "trace-wf",
      actorType: "system",
      occurredAt: nowIso(),
    });

    let workflow = ctx.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "paused", "Workflow should be paused");

    // Resume workflow: paused -> resuming -> running
    transitions.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "paused",
      toStatus: "resuming",
      currentStepIndex: 2,
      outputsJson: JSON.stringify({ step1: { result: "ok" }, step2: { result: "ok" } }),
      reasonCode: "workflow.resuming",
      traceId: "trace-wf",
      actorType: "system",
      occurredAt: nowIso(),
    });

    workflow = ctx.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "resuming", "Workflow should be resuming");

    transitions.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "resuming",
      toStatus: "running",
      currentStepIndex: 2,
      outputsJson: JSON.stringify({ step1: { result: "ok" }, step2: { result: "ok" } }),
      reasonCode: "workflow.resumed",
      traceId: "trace-wf",
      actorType: "system",
      occurredAt: nowIso(),
    });

    workflow = ctx.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "running", "Workflow should be running after resume");
  } finally {
    ctx.cleanup();
  }
});

test("state-transition: TransitionService execution lifecycle precheck -> execute -> succeed", () => {
  const ctx = createIntegrationContext("aa-ts-exec-");
  try {
    const repository = createRuntimeLifecycleRepository(ctx.store);
    const transitions = new TransitionService(ctx.db, ctx.store, repository);

    const executionId = "ts-exec-lifecycle-001";
    const taskId = "ts-exec-task-001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        tenantId: null,
        title: "Execution lifecycle test",
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
      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        harnessRunId: null,
        budgetReservationId: null,
        budgetLedgerId: null,
        agentId: "agent-exec",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "trace-exec",
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
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // created -> prechecking
    transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "created",
      toStatus: "prechecking",
      reasonCode: "execution.precheck_started",
      traceId: "trace-exec",
      actorType: "system",
      occurredAt: nowIso(),
    });

    let execution = ctx.store.getExecution(executionId);
    assert.equal(execution?.status, "prechecking", "Execution should be in prechecking");
    assert.ok(execution?.startedAt != null, "StartedAt should be set on prechecking");

    // prechecking -> executing
    transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "prechecking",
      toStatus: "executing",
      reasonCode: "execution.started",
      traceId: "trace-exec",
      actorType: "system",
      occurredAt: nowIso(),
    });

    execution = ctx.store.getExecution(executionId);
    assert.equal(execution?.status, "executing", "Execution should be executing");

    // executing -> succeeded
    transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "executing",
      toStatus: "succeeded",
      reasonCode: "execution.completed",
      traceId: "trace-exec",
      actorType: "system",
      occurredAt: nowIso(),
    });

    execution = ctx.store.getExecution(executionId);
    assert.equal(execution?.status, "succeeded", "Execution should be succeeded");
    assert.ok(execution?.finishedAt != null, "FinishedAt should be set on succeeded");
  } finally {
    ctx.cleanup();
  }
});

test("state-transition: TransitionService session status transitions", () => {
  const ctx = createIntegrationContext("aa-ts-session-");
  try {
    const repository = createRuntimeLifecycleRepository(ctx.store);
    const transitions = new TransitionService(ctx.db, ctx.store, repository);

    const sessionId = "ts-session-001";
    const taskId = "ts-session-task-001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        tenantId: null,
        title: "Session test",
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

    // open -> streaming
    transitions.transitionSessionStatus({
      entityKind: "session",
      entityId: sessionId,
      fromStatus: "open",
      toStatus: "streaming",
      reasonCode: "session.streaming_started",
      traceId: "trace-session",
      actorType: "system",
      occurredAt: nowIso(),
    });

    let session = ctx.store.getSession(sessionId);
    assert.equal(session?.status, "streaming", "Session should be streaming");

    // streaming -> awaiting_user
    transitions.transitionSessionStatus({
      entityKind: "session",
      entityId: sessionId,
      fromStatus: "streaming",
      toStatus: "awaiting_user",
      reasonCode: "session.awaiting_user",
      traceId: "trace-session",
      actorType: "system",
      occurredAt: nowIso(),
    });

    session = ctx.store.getSession(sessionId);
    assert.equal(session?.status, "awaiting_user", "Session should be awaiting_user");

    // awaiting_user -> streaming (resumed)
    transitions.transitionSessionStatus({
      entityKind: "session",
      entityId: sessionId,
      fromStatus: "awaiting_user",
      toStatus: "streaming",
      reasonCode: "session.resumed",
      traceId: "trace-session",
      actorType: "system",
      occurredAt: nowIso(),
    });

    session = ctx.store.getSession(sessionId);
    assert.equal(session?.status, "streaming", "Session should be streaming after resume");
  } finally {
    ctx.cleanup();
  }
});

test("state-transition: TransitionService creates events during state changes", () => {
  const ctx = createIntegrationContext("aa-ts-events-");
  try {
    const repository = createRuntimeLifecycleRepository(ctx.store);
    const transitions = new TransitionService(ctx.db, ctx.store, repository);

    const taskId = "ts-events-001";
    const executionId = "ts-events-exec-001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        tenantId: null,
        title: "Events test task",
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
      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        harnessRunId: null,
        budgetReservationId: null,
        budgetLedgerId: null,
        agentId: "agent-events",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "trace-events",
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
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Trigger transitions that should emit events
    transitions.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "queued",
      toStatus: "in_progress",
      executionId,
      reasonCode: "task.started",
      traceId: "trace-events",
      actorType: "system",
      occurredAt: nowIso(),
    });

    transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "created",
      toStatus: "prechecking",
      reasonCode: "execution.precheck_started",
      traceId: "trace-events",
      actorType: "system",
      occurredAt: nowIso(),
    });

    // Verify events were created
    const events = ctx.store.listEventsForTask(taskId);
    assert.ok(events.length >= 2, "Should have at least 2 events (task + execution status changes)");

    const eventTypes = events.map((e) => e.eventType);
    assert.ok(eventTypes.includes("task:status_changed"), "Should have task status changed event");
  } finally {
    ctx.cleanup();
  }
});
