import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";
import { createTempWorkspace, cleanupPath } from "../../helpers/fs.js";

test("transition service writes tier1 ack records for task status change", () => {
  const workspace = createTempWorkspace("aa-transition-");

  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Transition test",
        status: "queued",
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
      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "trace-1",
        attempt: 1,
        timeoutMs: 1000,
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

    service.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "queued",
      toStatus: "in_progress",
      executionId,
      reasonCode: "task.started",
      traceId: "trace-1",
      actorType: "system",
      idempotencyKey: "task-start-1",
      metadataJson: JSON.stringify({ source: "unit-test" }),
      occurredAt: nowIso(),
    });

    const snapshot = store.loadTaskSnapshot(taskId);
    assert.equal(snapshot.task.status, "in_progress");
    assert.equal(snapshot.events.length, 1);
    assert.equal(snapshot.events[0]?.eventType, "task:status_changed");
    const eventPayload = snapshot.events[0] ? (JSON.parse(snapshot.events[0].payloadJson) as Record<string, unknown>) : null;
    const traceContext = eventPayload?.traceContext as Record<string, unknown> | undefined;
    assert.equal(traceContext?.traceId, "trace-1");
    assert.equal(typeof traceContext?.spanId, "string");
    assert.equal(traceContext?.correlationId, taskId);
    assert.equal(eventPayload?.entityKind, "task");
    assert.equal(eventPayload?.entityId, taskId);
    assert.equal(eventPayload?.actorType, "system");
    assert.equal(eventPayload?.idempotencyKey, "task-start-1");
    assert.equal(eventPayload?.metadataJson, "{\"source\":\"unit-test\"}");

    const ackRow = db.connection.prepare("SELECT COUNT(*) AS count FROM event_consumer_acks").get() as
      | { count?: number }
      | undefined;
    const ackCount = Number(ackRow?.count ?? 0);
    assert.ok(ackCount >= 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("transition service rejects illegal task terminal reentry", () => {
  const workspace = createTempWorkspace("aa-transition-");

  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);
    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Terminal task",
        status: "done",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: "{}",
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });
      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent",
        roleId: "general_executor",
        runKind: "task_run",
        status: "succeeded",
        inputRef: null,
        traceId: "trace-2",
        attempt: 1,
        timeoutMs: 1000,
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
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    assert.throws(() => {
      service.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "done",
        toStatus: "in_progress",
        executionId,
        reasonCode: "task.recover",
        traceId: "trace-2",
        actorType: "recovery",
        occurredAt: nowIso(),
      });
    }, /task\.invalid_transition/);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("transition service rejects awaiting user sessions from pausing again", () => {
  const workspace = createTempWorkspace("aa-transition-");

  try {
    const db = new SqliteDatabase(join(workspace, "session-transition.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: "task-session-transition",
        parentId: null,
        rootId: "task-session-transition",
        divisionId: "general_ops",
        title: "Session transition",
        status: "awaiting_decision",
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
      store.insertSession({
        id: "sess-session-transition",
        taskId: "task-session-transition",
        channel: "cli",
        status: "awaiting_user",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    assert.throws(() => {
      service.transitionSessionStatus({
        entityKind: "session",
        entityId: "sess-session-transition",
        fromStatus: "awaiting_user",
        toStatus: "paused",
        reasonCode: "session.pause_again",
        traceId: "trace-session-transition",
        actorType: "system",
        occurredAt: nowIso(),
      });
    }, /session\.invalid_transition/);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("transition service updates approval status through the unified approval transition entry", () => {
  const workspace = createTempWorkspace("aa-transition-");

  try {
    const db = new SqliteDatabase(join(workspace, "approval-transition.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: "task-approval-transition",
        parentId: null,
        rootId: "task-approval-transition",
        divisionId: "general_ops",
        title: "Approval transition",
        status: "awaiting_decision",
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
      store.insertApproval({
        id: "approval-transition-1",
        taskId: "task-approval-transition",
        executionId: null,
        status: "requested",
        requestJson: "{\"reason\":\"Need approval\"}",
        responseJson: null,
        timeoutPolicy: "reject",
        createdAt: now,
        respondedAt: null,
      });
    });

    service.transitionApprovalStatus({
      entityKind: "approval",
      entityId: "approval-transition-1",
      fromStatus: "requested",
      toStatus: "approved",
      responseJson: JSON.stringify({
        approvalId: "approval-transition-1",
        decisionType: "confirmed",
      }),
      reasonCode: "approval.approved",
      traceId: "trace-approval-transition",
      actorType: "user",
      actorId: "operator-1",
      occurredAt: "2026-04-11T08:00:00.000Z",
    });

    const approval = store.getApproval("approval-transition-1");
    assert.equal(approval?.status, "approved");
    assert.equal(approval?.respondedAt, "2026-04-11T08:00:00.000Z");
    assert.match(approval?.responseJson ?? "", /"decisionType":"confirmed"/);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("transition service blocks task execution for approval atomically", () => {
  const workspace = createTempWorkspace("aa-transition-blocked-");

  try {
    const db = new SqliteDatabase(join(workspace, "blocked-for-approval.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: "task-blocked-approval",
        parentId: null,
        rootId: "task-blocked-approval",
        divisionId: "general_ops",
        title: "Approval gate",
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
      store.insertWorkflowState({
        taskId: "task-blocked-approval",
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "[]",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
      store.insertSession({
        id: "session-blocked-approval",
        taskId: "task-blocked-approval",
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
      store.insertExecution({
        id: "exec-blocked-approval",
        taskId: "task-blocked-approval",
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-blocked-approval",
        attempt: 1,
        timeoutMs: 1000,
        budgetUsdLimit: 1,
        requiresApproval: 1,
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

    const result = service.transitionBlockedForApproval({
      taskId: "task-blocked-approval",
      sessionId: "session-blocked-approval",
      executionId: "exec-blocked-approval",
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      workflowCurrentStepIndex: 0,
      workflowOutputsJson: "[{\"stepId\":\"s1\"}]",
      approval: {
        sourceAgentId: "agent",
        reason: "Need operator confirmation",
        riskLevel: "high",
        options: ["approve", "reject"],
        context: { sessionId: "session-blocked-approval" },
        timeoutPolicy: "reject",
      },
      context: {
        reasonCode: "approval.required",
        traceId: "trace-blocked-approval",
        actorType: "system",
        occurredAt: "2026-04-11T10:00:00.000Z",
      },
    });

    const snapshot = store.loadTaskSnapshot("task-blocked-approval");
    const approval = store.getApproval(result.approvalId);
    assert.equal(snapshot.task.status, "awaiting_decision");
    assert.equal(snapshot.workflow?.status, "paused");
    assert.equal(snapshot.session?.status, "awaiting_user");
    assert.equal(snapshot.execution?.status, "blocked");
    assert.equal(approval?.status, "requested");
    assert.match(approval?.requestJson ?? "", /Need operator confirmation/);

    const decisionEvent = store.listEventsForTask("task-blocked-approval").find((event) => event.eventType === "decision:requested");
    assert.ok(decisionEvent);
    assert.equal(result.createdAt, "2026-04-11T10:00:00.000Z");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("transition service rejects approval terminal reentry", () => {
  const workspace = createTempWorkspace("aa-transition-");

  try {
    const db = new SqliteDatabase(join(workspace, "approval-transition-invalid.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: "task-approval-invalid",
        parentId: null,
        rootId: "task-approval-invalid",
        divisionId: "general_ops",
        title: "Approval invalid transition",
        status: "awaiting_decision",
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
      store.insertApproval({
        id: "approval-transition-invalid",
        taskId: "task-approval-invalid",
        executionId: null,
        status: "approved",
        requestJson: "{\"reason\":\"Need approval\"}",
        responseJson: "{\"decisionType\":\"confirmed\"}",
        timeoutPolicy: "reject",
        createdAt: now,
        respondedAt: now,
      });
    });

    assert.throws(() => {
      service.transitionApprovalStatus({
        entityKind: "approval",
        entityId: "approval-transition-invalid",
        fromStatus: "approved",
        toStatus: "rejected",
        responseJson: "{\"decisionType\":\"rejected\"}",
        reasonCode: "approval.rejected",
        traceId: "trace-approval-invalid",
        actorType: "system",
        occurredAt: nowIso(),
      });
    }, /approval\.invalid_transition/);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// CAS failure — RT-01 branch in TaskTransitionService.apply()
// ---------------------------------------------------------------------------

test("transitionTaskStatus throws when CAS update returns 0 rows (concurrent writer)", () => {
  // Simulate two concurrent writers trying to transition the same task.
  // The second writer's CAS update matches zero rows because the first writer
  // already moved the task out of the expected status.
  const workspace = createTempWorkspace("aa-ts-cas-");

  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "CAS test",
        status: "queued",
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
      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "trace-cas",
        attempt: 1,
        timeoutMs: 1000,
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

    // First writer: queued -> pending succeeds
    service.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "queued",
      toStatus: "pending",
      executionId,
      reasonCode: "test",
      traceId: "trace-cas-1",
      actorType: "system",
      occurredAt: "2026-04-21T10:00:00.000Z",
    });

    // Second writer: tries to transition from stale "queued" state.
    // State machine allows it (queued->pending is valid) but CAS finds 0 rows.
    assert.throws(
      () =>
        service.transitionTaskStatus({
          entityKind: "task",
          entityId: taskId,
          fromStatus: "queued", // stale — task is already "pending"
          toStatus: "pending",
          executionId,
          reasonCode: "test",
          traceId: "trace-cas-2",
          actorType: "system",
          occurredAt: "2026-04-21T10:00:01.000Z",
        }),
      /task\.transition_cas_failed/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// ExecutionTransitionService — startedAt / finishedAt branches
// ---------------------------------------------------------------------------

test("transitionExecutionStatus created->executing sets startedAt but not finishedAt", () => {
  const workspace = createTempWorkspace("aa-ts-exec-");

  try {
    const db = new SqliteDatabase(join(workspace, "exec-timestamps.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Exec timestamps",
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
      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent",
        roleId: "general_executor",
        runKind: "task_run",
        status: "prechecking",
        inputRef: null,
        traceId: "trace-exec",
        attempt: 1,
        timeoutMs: 1000,
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

    service.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "prechecking",
      toStatus: "executing",
      reasonCode: "exec.start",
      traceId: "trace-exec",
      actorType: "system",
      occurredAt: now,
    });

    const exec = store.execution.getExecution(executionId);
    assert.equal(exec?.status, "executing");
    // startedAt was set during prechecking transition; not cleared by executing transition
    assert.equal(exec?.finishedAt, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("transitionExecutionStatus executing->failed sets finishedAt with errorCode", () => {
  const workspace = createTempWorkspace("aa-ts-exec-");

  try {
    const db = new SqliteDatabase(join(workspace, "exec-failed.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Exec failed",
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
      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-exec",
        attempt: 1,
        timeoutMs: 1000,
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

    service.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "executing",
      toStatus: "failed",
      reasonCode: "E099",
      traceId: "trace-exec",
      actorType: "system",
      occurredAt: "2026-04-21T10:05:00.000Z",
    });

    const exec = store.execution.getExecution(executionId);
    assert.equal(exec?.status, "failed");
    assert.equal(exec?.finishedAt, "2026-04-21T10:05:00.000Z");
    assert.equal(exec?.lastErrorCode, "E099");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("transitionExecutionStatus executing->cancelled sets finishedAt", () => {
  const workspace = createTempWorkspace("aa-ts-exec-");

  try {
    const db = new SqliteDatabase(join(workspace, "exec-cancelled.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Exec cancelled",
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
      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-exec",
        attempt: 1,
        timeoutMs: 1000,
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

    service.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "executing",
      toStatus: "cancelled",
      reasonCode: "user_cancel",
      traceId: "trace-exec",
      actorType: "system",
      occurredAt: "2026-04-21T10:05:00.000Z",
    });

    const exec = store.execution.getExecution(executionId);
    assert.equal(exec?.status, "cancelled");
    assert.equal(exec?.finishedAt, "2026-04-21T10:05:00.000Z");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// WorkflowTransitionService
// ---------------------------------------------------------------------------

test("transitionWorkflowStatus running->failed with step index", () => {
  const workspace = createTempWorkspace("aa-ts-wf-");

  try {
    const db = new SqliteDatabase(join(workspace, "wf-transition.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: "task-wf-transition",
        parentId: null,
        rootId: "task-wf-transition",
        divisionId: "general_ops",
        title: "Workflow transition",
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
      store.insertWorkflowState({
        taskId: "task-wf-transition",
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 3,
        status: "running",
        outputsJson: "[]",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
    });

    service.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: "task-wf-transition",
      fromStatus: "running",
      toStatus: "failed",
      currentStepIndex: 5,
      outputsJson: '{"error":"step failed"}',
      reasonCode: "step.error",
      traceId: "trace-wf",
      actorType: "system",
      occurredAt: now,
    });

    const wf = store.workflow.getWorkflowState("task-wf-transition");
    assert.equal(wf?.status, "failed");
    assert.equal(wf?.currentStepIndex, 5);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// TaskTerminalTransitionService — cascade branches (done / failed / cancelled)
// ---------------------------------------------------------------------------

test("transitionTaskTerminalState failed cascades with reasonCode to all entities", () => {
  const workspace = createTempWorkspace("aa-ts-term-");

  try {
    const db = new SqliteDatabase(join(workspace, "term-failed.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: "task-term-failed",
        parentId: null,
        rootId: "task-term-failed",
        divisionId: "general_ops",
        title: "Terminal failed",
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
      store.insertWorkflowState({
        taskId: "task-term-failed",
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 2,
        status: "running",
        outputsJson: "[]",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
      store.insertSession({
        id: "sess-term-failed",
        taskId: "task-term-failed",
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
      store.insertExecution({
        id: "exec-term-failed",
        taskId: "task-term-failed",
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-term",
        attempt: 1,
        timeoutMs: 1000,
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

    service.transitionTaskTerminalState({
      taskId: "task-term-failed",
      sessionId: "sess-term-failed",
      executionId: "exec-term-failed",
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: "failed",
      taskOutputJson: '{}',
      outputsJson: '{}',
      context: {
        reasonCode: "E099",
        traceId: "trace-term",
        actorType: "system",
        occurredAt: now,
      },
    });

    assert.equal(store.task.getTask("task-term-failed")?.status, "failed");
    assert.equal(store.task.getTask("task-term-failed")?.errorCode, "E099");
    assert.equal(store.workflow.getWorkflowState("task-term-failed")?.status, "failed");
    assert.equal(store.session.getSession("sess-term-failed")?.status, "failed");
    assert.equal(store.execution.getExecution("exec-term-failed")?.status, "failed");
    assert.equal(store.execution.getExecution("exec-term-failed")?.lastErrorCode, "E099");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("transitionTaskTerminalState cancelled cascades to all entities", () => {
  const workspace = createTempWorkspace("aa-ts-term-");

  try {
    const db = new SqliteDatabase(join(workspace, "term-cancelled.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: "task-term-cancelled",
        parentId: null,
        rootId: "task-term-cancelled",
        divisionId: "general_ops",
        title: "Terminal cancelled",
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
      store.insertWorkflowState({
        taskId: "task-term-cancelled",
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 2,
        status: "running",
        outputsJson: "[]",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
      store.insertSession({
        id: "sess-term-cancelled",
        taskId: "task-term-cancelled",
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
      store.insertExecution({
        id: "exec-term-cancelled",
        taskId: "task-term-cancelled",
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-term",
        attempt: 1,
        timeoutMs: 1000,
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

    service.transitionTaskTerminalState({
      taskId: "task-term-cancelled",
      sessionId: "sess-term-cancelled",
      executionId: "exec-term-cancelled",
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: "cancelled",
      taskOutputJson: '{}',
      outputsJson: '{}',
      context: {
        reasonCode: "user_cancel",
        traceId: "trace-term",
        actorType: "system",
        occurredAt: now,
      },
    });

    assert.equal(store.task.getTask("task-term-cancelled")?.status, "cancelled");
    assert.equal(store.workflow.getWorkflowState("task-term-cancelled")?.status, "cancelled");
    assert.equal(store.session.getSession("sess-term-cancelled")?.status, "cancelled");
    assert.equal(store.execution.getExecution("exec-term-cancelled")?.status, "cancelled");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("applyTaskTerminalState applies terminal state without transaction wrapper", () => {
  // applyTaskTerminalState calls terminalTasks.apply() directly (no db.transaction())
  const workspace = createTempWorkspace("aa-ts-term-");

  try {
    const db = new SqliteDatabase(join(workspace, "term-apply.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: "task-term-apply",
        parentId: null,
        rootId: "task-term-apply",
        divisionId: "general_ops",
        title: "Terminal apply",
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
      store.insertWorkflowState({
        taskId: "task-term-apply",
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 2,
        status: "running",
        outputsJson: "[]",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
      store.insertSession({
        id: "sess-term-apply",
        taskId: "task-term-apply",
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
      store.insertExecution({
        id: "exec-term-apply",
        taskId: "task-term-apply",
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-term",
        attempt: 1,
        timeoutMs: 1000,
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

    service.applyTaskTerminalState({
      taskId: "task-term-apply",
      sessionId: "sess-term-apply",
      executionId: "exec-term-apply",
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: "done",
      taskOutputJson: '{"result":"ok"}',
      outputsJson: '{}',
      context: {
        reasonCode: "done",
        traceId: "trace-term",
        actorType: "system",
        occurredAt: now,
      },
    });

    assert.equal(store.task.getTask("task-term-apply")?.status, "done");
    assert.equal(store.task.getTask("task-term-apply")?.completedAt, now);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// buildEventTraceContext — correlationId branch
// ---------------------------------------------------------------------------

test("buildEventTraceContext uses explicit correlationId when provided", () => {
  // The branch: correlationId ?? taskId — when correlationId IS set
  const workspace = createTempWorkspace("aa-ts-trace-");

  try {
    const db = new SqliteDatabase(join(workspace, "trace-corr.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Trace test",
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
      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-corr",
        attempt: 1,
        timeoutMs: 1000,
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

    service.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "in_progress",
      toStatus: "done",
      executionId,
      reasonCode: "done",
      traceId: "trace-corr",
      correlationId: "custom-corr-id",
      actorType: "system",
      occurredAt: now,
    });

    const snapshot = store.loadTaskSnapshot(taskId);
    const event = snapshot.events.find((e) => e.eventType === "task:status_changed");
    assert.ok(event);
    const payload = JSON.parse(event!.payloadJson) as Record<string, unknown>;
    const traceCtx = payload.traceContext as Record<string, unknown> | undefined;
    assert.equal(traceCtx?.correlationId, "custom-corr-id");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// §17.4 Fencing Token Rejection Scenarios
// via ExecutionLeaseService.validateWriteAccess()
// ---------------------------------------------------------------------------

test("§17.4 lease_not_found — execution has no lease record", async () => {
  // ExecutionLeaseService.validateWriteAccess returns lease_not_found when
  // getLatestExecutionLease returns null (no lease ever acquired).
  const { ExecutionLeaseService } = await import(
    "../../../src/platform/five-plane-execution/lease/execution-lease-service.js"
  );
  const workspace = createTempWorkspace("aa-fencing-");

  try {
    const db = new SqliteDatabase(join(workspace, "fencing.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const leaseService = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Fencing test",
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
      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-fencing",
        attempt: 1,
        timeoutMs: 1000,
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

    // No lease acquired — validateWriteAccess should return lease_not_found
    const result = leaseService.validateWriteAccess({
      executionId,
      workerId: "worker-a",
      fencingToken: 1,
      occurredAt: now,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, "lease_not_found");
    assert.equal(result.authoritativeFencingToken, 0);
    assert.equal(result.activeLeaseId, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("§17.4 no_active_lease — lease exists but is expired/released", async () => {
  // ExecutionLeaseService.validateWriteAccess returns no_active_lease when
  // a lease record exists but getActiveExecutionLease returns null
  // (lease was released or expired without being replaced).
  const { ExecutionLeaseService } = await import(
    "../../../src/platform/five-plane-execution/lease/execution-lease-service.js"
  );
  const workspace = createTempWorkspace("aa-fencing-");

  try {
    const db = new SqliteDatabase(join(workspace, "fencing2.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const leaseService = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Fencing test",
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
      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-fencing",
        attempt: 1,
        timeoutMs: 1000,
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

    // Acquire then release
    const granted = leaseService.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30_000,
      occurredAt: now,
    });
    assert.equal(granted.outcome, "granted");

    leaseService.releaseLease({
      leaseId: granted.lease!.id,
      workerId: "worker-a",
      reasonCode: "done",
      occurredAt: now,
    });

    // Validate with released lease
    const result = leaseService.validateWriteAccess({
      executionId,
      workerId: "worker-a",
      fencingToken: granted.lease!.fencingToken,
      leaseId: granted.lease!.id,
      occurredAt: now,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, "no_active_lease");
    assert.equal(result.activeLeaseId, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("§17.4 stale_fencing_token — worker presents old fencing token after lease renewal", async () => {
  // ExecutionLeaseService.validateWriteAccess returns stale_fencing_token when
  // the presented fencingToken does not match activeLease.fencingToken.
  // This detects split-brain: a worker with an old lease tries to write after
  // a new lease has been granted (with a new fencing token).
  const { ExecutionLeaseService } = await import(
    "../../../src/platform/five-plane-execution/lease/execution-lease-service.js"
  );
  const workspace = createTempWorkspace("aa-fencing-");

  try {
    const db = new SqliteDatabase(join(workspace, "fencing3.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const leaseService = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Fencing test",
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
      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-fencing",
        attempt: 1,
        timeoutMs: 1000,
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

    // worker-a acquires lease (fencingToken=1)
    const first = leaseService.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30_000,
      occurredAt: now,
    });
    assert.equal(first.lease!.fencingToken, 1);

    // worker-a releases
    leaseService.releaseLease({
      leaseId: first.lease!.id,
      workerId: "worker-a",
      reasonCode: "done",
      occurredAt: now,
    });

    // worker-b acquires NEW lease (fencingToken=2)
    const second = leaseService.acquireLease({
      executionId,
      workerId: "worker-b",
      ttlMs: 30_000,
      occurredAt: now,
    });
    assert.equal(second.lease!.fencingToken, 2);

    // worker-a tries to write with their OLD fencing token (stale)
    const result = leaseService.validateWriteAccess({
      executionId,
      workerId: "worker-a",
      fencingToken: 1, // stale token
      leaseId: first.lease!.id,
      occurredAt: now,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, "stale_fencing_token");
    assert.equal(result.authoritativeFencingToken, 2);
    assert.equal(result.activeLeaseId, second.lease!.id);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("§17.4 worker_mismatch — requesting worker is not the lease holder", async () => {
  // ExecutionLeaseService.validateWriteAccess returns worker_mismatch when
  // the workerId in the request does not match activeLease.workerId.
  const { ExecutionLeaseService } = await import(
    "../../../src/platform/five-plane-execution/lease/execution-lease-service.js"
  );
  const workspace = createTempWorkspace("aa-fencing-");

  try {
    const db = new SqliteDatabase(join(workspace, "fencing4.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const leaseService = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Fencing test",
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
      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-fencing",
        attempt: 1,
        timeoutMs: 1000,
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

    // worker-a acquires lease
    const granted = leaseService.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30_000,
      occurredAt: now,
    });

    // worker-b (wrong worker) tries to validate write access
    const result = leaseService.validateWriteAccess({
      executionId,
      workerId: "worker-b", // wrong worker
      fencingToken: granted.lease!.fencingToken,
      leaseId: granted.lease!.id,
      occurredAt: now,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, "worker_mismatch");
    assert.equal(result.activeLeaseId, granted.lease!.id);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("§17.4 lease_mismatch — lease ID does not match current active lease", async () => {
  // ExecutionLeaseService.validateWriteAccess returns lease_mismatch when
  // the presented leaseId does not match activeLease.id (lease was replaced).
  const { ExecutionLeaseService } = await import(
    "../../../src/platform/five-plane-execution/lease/execution-lease-service.js"
  );
  const workspace = createTempWorkspace("aa-fencing-");

  try {
    const db = new SqliteDatabase(join(workspace, "fencing5.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const leaseService = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Fencing test",
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
      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-fencing",
        attempt: 1,
        timeoutMs: 1000,
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

    // worker-a acquires first lease
    const first = leaseService.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30_000,
      occurredAt: now,
    });

    // worker-a releases
    leaseService.releaseLease({
      leaseId: first.lease!.id,
      workerId: "worker-a",
      reasonCode: "done",
      occurredAt: now,
    });

    // worker-a acquires a new lease (new ID, incremented fencing token)
    const second = leaseService.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30_000,
      occurredAt: now,
    });
    assert.notEqual(second.lease!.id, first.lease!.id);
    assert.ok(second.lease!.fencingToken > first.lease!.fencingToken);

    // Validate with the OLD lease ID (lease_mismatch)
    const result = leaseService.validateWriteAccess({
      executionId,
      workerId: "worker-a",
      fencingToken: second.lease!.fencingToken,
      leaseId: first.lease!.id, // stale lease ID
      occurredAt: now,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, "lease_mismatch");
    assert.equal(result.activeLeaseId, second.lease!.id);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
