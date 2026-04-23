/**
 * State Transition Service Integration Tests
 *
 * Tests the transition service lifecycle using SQLite-backed store.
 * Covers task, workflow, session, and execution state transitions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { TransitionService } from "../../../../../src/platform/execution/state-transition/transition-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { createRuntimeLifecycleRepository } from "../../../../../src/platform/state-evidence/truth/repositories/runtime-lifecycle-repository.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";

test("TransitionService: transitionTaskStatus moves task through valid lifecycle", () => {
  const ctx = createIntegrationContext("aa-transition-task-");
  try {
    const repo = createRuntimeLifecycleRepository(ctx.store);
    const service = new TransitionService(ctx.db, ctx.store, repo);
    const now = nowIso();

    // queued -> pending
    service.transitionTaskStatus({
      entityId: "task-transition-001",
      executionId: "exec-transition-001",
      fromStatus: "queued",
      toStatus: "pending",
      occurredAt: now,
      traceId: "trace-transition-001",
    });

    // pending -> in_progress
    service.transitionTaskStatus({
      entityId: "task-transition-001",
      executionId: "exec-transition-001",
      fromStatus: "pending",
      toStatus: "in_progress",
      occurredAt: now,
      traceId: "trace-transition-001",
    });

    const task = ctx.store.getTask("task-transition-001");
    assert.equal(task?.status, "in_progress");
  } finally {
    ctx.cleanup();
  }
});

test("TransitionService: transitionTaskStatus rejects invalid transition", () => {
  const ctx = createIntegrationContext("aa-transition-invalid-");
  try {
    const repo = createRuntimeLifecycleRepository(ctx.store);
    const service = new TransitionService(ctx.db, ctx.store, repo);
    const now = nowIso();

    // Attempt invalid transition: queued -> done (must go through pending/in_progress)
    assert.throws(
      () =>
        service.transitionTaskStatus({
          entityId: "task-transition-invalid-001",
          executionId: "exec-transition-invalid-001",
          fromStatus: "queued",
          toStatus: "done",
          occurredAt: now,
          traceId: "trace-transition-invalid-001",
        }),
      /Invalid transition/,
    );
  } finally {
    ctx.cleanup();
  }
});

test("TransitionService: transitionWorkflowStatus updates workflow state", () => {
  const ctx = createIntegrationContext("aa-transition-workflow-");
  try {
    const repo = createRuntimeLifecycleRepository(ctx.store);
    const service = new TransitionService(ctx.db, ctx.store, repo);
    const now = nowIso();

    // Insert workflow state first
    ctx.store.insertWorkflowState({
      taskId: "task-workflow-transition-001",
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

    service.transitionWorkflowStatus({
      entityId: "task-workflow-transition-001",
      fromStatus: "running",
      toStatus: "completed",
      occurredAt: now,
      currentStepIndex: 1,
      outputsJson: '{"result":"ok"}',
    });

    const workflow = ctx.store.workflow.getWorkflowState("task-workflow-transition-001");
    assert.equal(workflow?.status, "completed");
    assert.equal(workflow?.currentStepIndex, 1);
  } finally {
    ctx.cleanup();
  }
});

test("TransitionService: transitionSessionStatus updates session state", () => {
  const ctx = createIntegrationContext("aa-transition-session-");
  try {
    const repo = createRuntimeLifecycleRepository(ctx.store);
    const service = new TransitionService(ctx.db, ctx.store, repo);
    const now = nowIso();

    // Insert session first
    ctx.store.insertSession({
      id: "sess-transition-001",
      taskId: "task-session-transition-001",
      channel: "cli",
      status: "open",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });

    service.transitionSessionStatus({
      entityId: "sess-transition-001",
      fromStatus: "open",
      toStatus: "streaming",
      occurredAt: now,
    });

    const session = ctx.store.getSession("sess-transition-001");
    assert.equal(session?.status, "streaming");
  } finally {
    ctx.cleanup();
  }
});

test("TransitionService: transitionExecutionStatus updates execution", () => {
  const ctx = createIntegrationContext("aa-transition-execution-");
  try {
    const repo = createRuntimeLifecycleRepository(ctx.store);
    const service = new TransitionService(ctx.db, ctx.store, repo);
    const now = nowIso();

    service.transitionExecutionStatus({
      entityId: "exec-transition-001",
      fromStatus: "created",
      toStatus: "prechecking",
      occurredAt: now,
      traceId: "trace-execution-transition-001",
    });

    const execution = ctx.store.getExecution("exec-transition-001");
    assert.equal(execution?.status, "prechecking");
  } finally {
    ctx.cleanup();
  }
});

test("TransitionService: transitionApprovalStatus moves approval through lifecycle", () => {
  const ctx = createIntegrationContext("aa-transition-approval-");
  try {
    const repo = createRuntimeLifecycleRepository(ctx.store);
    const service = new TransitionService(ctx.db, ctx.store, repo);
    const now = nowIso();

    // Insert approval record first
    ctx.store.insertApproval({
      id: "approval-transition-001",
      taskId: "task-approval-transition-001",
      executionId: "exec-approval-transition-001",
      requestedBy: "agent-test",
      riskLevel: "medium",
      options: ["approve", "reject"],
      requestJson: "{}",
      responseJson: null,
      status: "requested",
      timeoutPolicy: "reject",
      createdAt: now,
      respondedAt: null,
    });

    // requested -> approved
    service.transitionApprovalStatus({
      entityId: "approval-transition-001",
      fromStatus: "requested",
      toStatus: "approved",
      responseJson: '{"decision":"approved"}',
      occurredAt: now,
    });

    const approval = ctx.store.approvals.getApproval("approval-transition-001");
    assert.equal(approval?.status, "approved");
    assert.equal(approval?.responseJson, '{"decision":"approved"}');
  } finally {
    ctx.cleanup();
  }
});

test("TransitionService: transitionTaskTerminalState cascades to all entities", () => {
  const ctx = createIntegrationContext("aa-transition-terminal-");
  try {
    const repo = createRuntimeLifecycleRepository(ctx.store);
    const service = new TransitionService(ctx.db, ctx.store, repo);
    const now = nowIso();

    // Set up initial state
    ctx.store.setTaskState({
      taskId: "task-terminal-transition-001",
      status: "in_progress",
      updatedAt: now,
      errorCode: null,
      completedAt: null,
    });

    ctx.store.insertWorkflowState({
      taskId: "task-terminal-transition-001",
      divisionId: "general_ops",
      workflowId: "single_agent_minimal",
      currentStepIndex: 1,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    ctx.store.insertSession({
      id: "sess-terminal-transition-001",
      taskId: "task-terminal-transition-001",
      channel: "cli",
      status: "streaming",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });

    // Transition to terminal state
    service.transitionTaskTerminalState({
      taskId: "task-terminal-transition-001",
      sessionId: "sess-terminal-transition-001",
      executionId: "exec-terminal-transition-001",
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: "done",
      taskOutputJson: '{"result":"success"}',
      outputsJson: '{"analysis":"complete"}',
      context: { traceId: "trace-terminal-transition-001", actor: "system" },
    });

    const task = ctx.store.getTask("task-terminal-transition-001");
    const workflow = ctx.store.workflow.getWorkflowState("task-terminal-transition-001");
    const session = ctx.store.getSession("sess-terminal-transition-001");

    assert.equal(task?.status, "done");
    assert.equal(workflow?.status, "completed");
    assert.equal(session?.status, "completed");
  } finally {
    ctx.cleanup();
  }
});

test("TransitionService: transitionBlockedForApproval creates approval and blocks entities", () => {
  const ctx = createIntegrationContext("aa-transition-blocked-");
  try {
    const repo = createRuntimeLifecycleRepository(ctx.store);
    const service = new TransitionService(ctx.db, ctx.store, repo);
    const now = nowIso();

    // Set up initial state
    ctx.store.setTaskState({
      taskId: "task-blocked-transition-001",
      status: "in_progress",
      updatedAt: now,
      errorCode: null,
      completedAt: null,
    });

    ctx.store.insertWorkflowState({
      taskId: "task-blocked-transition-001",
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

    ctx.store.insertSession({
      id: "sess-blocked-transition-001",
      taskId: "task-blocked-transition-001",
      channel: "cli",
      status: "open",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });

    const result = service.transitionBlockedForApproval({
      taskId: "task-blocked-transition-001",
      sessionId: "sess-blocked-transition-001",
      executionId: "exec-blocked-transition-001",
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "open",
      currentExecutionStatus: "executing",
      workflowCurrentStepIndex: 0,
      workflowOutputsJson: "{}",
      approval: {
        sourceAgentId: "agent-blocked",
        reason: "High risk operation requires approval",
        riskLevel: "high",
        options: ["approve", "reject", "modify"],
        context: {},
        timeoutPolicy: "reject",
      },
      context: { traceId: "trace-blocked-transition-001", actor: "system" },
    });

    assert.ok(result.approvalId, "Should return approval ID");
    assert.ok(result.createdAt, "Should return created timestamp");

    const task = ctx.store.getTask("task-blocked-transition-001");
    const workflow = ctx.store.workflow.getWorkflowState("task-blocked-transition-001");
    const session = ctx.store.getSession("sess-blocked-transition-001");
    const approval = ctx.store.approvals.getApproval(result.approvalId);

    assert.equal(task?.status, "awaiting_decision");
    assert.equal(workflow?.status, "paused");
    assert.equal(session?.status, "paused");
    assert.equal(approval?.status, "requested");
  } finally {
    ctx.cleanup();
  }
});