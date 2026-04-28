/**
 * State Transition Integration Tests
 *
 * Tests end-to-end state transitions through the RuntimeStateMachine
 * and TransitionService for tasks, workflows, sessions, and executions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { createRepositoryHarness } from "../../../helpers/repository-harness.js";
import { TransitionService } from "../../../../src/platform/state-transition/transition-service.js";
import { createRuntimeLifecycleRepository } from "../../../../src/platform/state-evidence/truth/repositories/runtime-lifecycle-repository.js";
import { StateTransitionMachine } from "../../../../src/platform/execution/state-transition/state-transition-machine.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("state-transition: Task transitions from queued -> in_progress -> done", () => {
  const ctx = createIntegrationContext("aa-state-task-");
  try {
    const repository = createRuntimeLifecycleRepository(ctx.store);
    const transitions = new TransitionService(ctx.db, ctx.store, repository);

    const taskId = "task-state-001";
    const executionId = "exec-state-001";
    const traceId = "trace-state-001";
    const now = nowIso();

    // Seed task in queued state
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "State transition test task",
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
        agentId: "agent-1",
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

    // Transition: queued -> in_progress
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

    let task = ctx.store.getTask(taskId);
    assert.equal(task?.status, "in_progress", "Task should be in_progress after first transition");

    // Transition: in_progress -> done (terminal)
    transitions.transitionTaskTerminalState({
      taskId,
      sessionId: "sess-state-001",
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "success" }),
      outputsJson: JSON.stringify({}),
      context: {
        reasonCode: "task.completed",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    task = ctx.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should be in done terminal state");
    assert.ok(task?.completedAt != null, "Task should have completedAt timestamp");
  } finally {
    ctx.cleanup();
  }
});

test("state-transition: Task transitions from queued -> in_progress -> failed", () => {
  const ctx = createIntegrationContext("aa-state-task-fail-");
  try {
    const repository = createRuntimeLifecycleRepository(ctx.store);
    const transitions = new TransitionService(ctx.db, ctx.store, repository);

    const taskId = "task-state-fail-001";
    const executionId = "exec-state-fail-001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "State transition failure test",
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
      ctx.store.insertWorkflowState({
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
      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-fail-001",
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
      ctx.store.insertSession({
        id: "sess-fail-001",
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Transition to failed
    transitions.transitionTaskTerminalState({
      taskId,
      sessionId: "sess-fail-001",
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
        traceId: "trace-fail-001",
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = ctx.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should be in failed terminal state");
    assert.equal(task?.errorCode, "workflow.step_failed", "Task should have error code set");

    const workflow = ctx.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "failed", "Workflow should be in failed state");

    const session = ctx.store.getSession("sess-fail-001");
    assert.equal(session?.status, "failed", "Session should be in failed state");

    const execution = ctx.store.getExecution(executionId);
    assert.equal(execution?.status, "failed", "Execution should be in failed state");
  } finally {
    ctx.cleanup();
  }
});

test("state-transition: Workflow transitions running -> paused -> running (resume)", () => {
  const ctx = createIntegrationContext("aa-state-workflow-");
  try {
    const repository = createRuntimeLifecycleRepository(ctx.store);
    const transitions = new TransitionService(ctx.db, ctx.store, repository);

    const taskId = "task-wf-pause-001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
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
        divisionId: "general_ops",
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
      traceId: "trace-wf-001",
      actorType: "system",
      occurredAt: nowIso(),
    });

    let workflow = ctx.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "paused", "Workflow should be paused");

    // Resume workflow
    transitions.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "paused",
      toStatus: "resuming",
      currentStepIndex: 2,
      outputsJson: JSON.stringify({ step1: { result: "ok" }, step2: { result: "ok" } }),
      reasonCode: "workflow.resuming",
      traceId: "trace-wf-001",
      actorType: "system",
      occurredAt: nowIso(),
    });

    workflow = ctx.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "resuming", "Workflow should be in resuming state");

    // Transition to running again
    transitions.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "resuming",
      toStatus: "running",
      currentStepIndex: 2,
      outputsJson: JSON.stringify({ step1: { result: "ok" }, step2: { result: "ok" } }),
      reasonCode: "workflow.resumed",
      traceId: "trace-wf-001",
      actorType: "system",
      occurredAt: nowIso(),
    });

    workflow = ctx.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "running", "Workflow should be running after resume");
    assert.equal(workflow?.resumableFromStep, null, "ResumableFromStep should be cleared");
  } finally {
    ctx.cleanup();
  }
});

test("state-transition: Session transitions open -> streaming -> completed", () => {
  const ctx = createIntegrationContext("aa-state-session-");
  try {
    const repository = createRuntimeLifecycleRepository(ctx.store);
    const transitions = new TransitionService(ctx.db, ctx.store, repository);

    const sessionId = "sess-state-001";
    const taskId = "task-sess-001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Session transition test",
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

    // Transition to streaming
    transitions.transitionSessionStatus({
      entityKind: "session",
      entityId: sessionId,
      fromStatus: "open",
      toStatus: "streaming",
      reasonCode: "session.streaming_started",
      traceId: "trace-sess-001",
      actorType: "system",
      occurredAt: nowIso(),
    });

    let session = ctx.store.getSession(sessionId);
    assert.equal(session?.status, "streaming", "Session should be streaming");

    // Transition to completed (terminal)
    transitions.transitionSessionStatus({
      entityKind: "session",
      entityId: sessionId,
      fromStatus: "streaming",
      toStatus: "completed",
      reasonCode: "session.completed",
      traceId: "trace-sess-001",
      actorType: "system",
      occurredAt: nowIso(),
    });

    session = ctx.store.getSession(sessionId);
    assert.equal(session?.status, "completed", "Session should be completed");
  } finally {
    ctx.cleanup();
  }
});

test("state-transition: Execution transitions created -> prechecking -> executing -> succeeded", () => {
  const ctx = createIntegrationContext("aa-state-exec-");
  try {
    const repository = createRuntimeLifecycleRepository(ctx.store);
    const transitions = new TransitionService(ctx.db, ctx.store, repository);

    const executionId = "exec-state-001";
    const taskId = "task-exec-001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Execution transition test",
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
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "trace-exec-001",
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
      traceId: "trace-exec-001",
      actorType: "system",
      occurredAt: nowIso(),
    });

    let execution = ctx.store.getExecution(executionId);
    assert.equal(execution?.status, "prechecking", "Execution should be in prechecking");

    // prechecking -> executing
    transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "prechecking",
      toStatus: "executing",
      reasonCode: "execution.started",
      traceId: "trace-exec-001",
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
      traceId: "trace-exec-001",
      actorType: "system",
      occurredAt: nowIso(),
    });

    execution = ctx.store.getExecution(executionId);
    assert.equal(execution?.status, "succeeded", "Execution should be succeeded");
    assert.ok(execution?.finishedAt != null, "Execution should have finishedAt timestamp");
  } finally {
    ctx.cleanup();
  }
});

test("state-transition: Invalid transition throws WorkflowStateError", () => {
  const harness = createRepositoryHarness("aa-state-invalid-");
  try {
    const machine = new StateTransitionMachine("task", {
      queued: ["in_progress", "cancelled"],
      in_progress: ["done", "failed", "cancelled"],
      done: [],
      failed: [],
      cancelled: [],
    } as Record<string, readonly string[]>);

    assert.throws(
      () => machine.assertTransition("done", "in_progress"),
      { message: /invalid_transition/ },
      "Should throw on invalid transition from terminal state"
    );

    assert.throws(
      () => machine.assertTransition("queued", "done"),
      { message: /invalid_transition/ },
      "Should throw on skipping intermediate state"
    );

    assert.throws(
      () => machine.assertTransition("in_progress", "in_progress"),
      { message: /noop_transition_denied/ },
      "Should throw on no-op transition"
    );
  } finally {
    harness.cleanup();
  }
});

test("state-transition: Terminal state transition cascades across all entities", () => {
  const ctx = createIntegrationContext("aa-state-cascade-");
  try {
    const repository = createRuntimeLifecycleRepository(ctx.store);
    const transitions = new TransitionService(ctx.db, ctx.store, repository);

    const taskId = "task-cascade-001";
    const sessionId = "sess-cascade-001";
    const executionId = "exec-cascade-001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
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
        divisionId: "general_ops",
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
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-cascade-001",
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
        traceId: "trace-cascade-001",
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
  } finally {
    ctx.cleanup();
  }
});