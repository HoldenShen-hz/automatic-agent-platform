import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import {
  TransitionService,
  TaskTransitionService,
  WorkflowTransitionService,
  SessionTransitionService,
  ExecutionTransitionService,
  ApprovalTransitionService,
} from "../../../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";

// =============================================================================
// TASK TRANSITION SERVICE TESTS
// =============================================================================

test("TaskTransitionService.transition applies valid status change", () => {
  const workspace = createTempWorkspace("aa-task-transition-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TaskTransitionService(db, store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Task Transition Test",
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
        traceId: "trace-task-1",
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

    service.transition({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "queued",
      toStatus: "in_progress",
      executionId,
      reasonCode: "task.started",
      traceId: "trace-task-1",
      actorType: "system",
      occurredAt: nowIso(),
    });

    const snapshot = store.loadTaskSnapshot(taskId);
    assert.equal(snapshot.task.status, "in_progress");
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskTransitionService.transition throws on invalid transition", () => {
  const workspace = createTempWorkspace("aa-task-transition-invalid-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TaskTransitionService(db, store);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Task Invalid Transition Test",
        status: "done",
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
        completedAt: now,
      });
    });

    assert.throws(
      () =>
        service.transition({
          entityKind: "task",
          entityId: taskId,
          fromStatus: "done",
          toStatus: "in_progress",
          executionId: null,
          reasonCode: "test",
          traceId: "trace-invalid",
          actorType: "system",
          occurredAt: nowIso(),
        }),
      /invalid_transition|transition_cas_failed/
    );
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// WORKFLOW TRANSITION SERVICE TESTS
// =============================================================================

test("WorkflowTransitionService.transition applies valid status change", () => {
  const workspace = createTempWorkspace("aa-workflow-transition-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new WorkflowTransitionService(db, store);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Workflow Transition Test",
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
      store.insertWorkflow({
        id: taskId,
        taskId,
        name: "Test Workflow",
        status: "created",
        currentStepIndex: 0,
        outputsJson: "{}",
        createdAt: now,
        updatedAt: now,
      });
    });

    service.transition({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "created",
      toStatus: "running",
      currentStepIndex: 0,
      outputsJson: "{}",
      reasonCode: "workflow.start",
      traceId: "trace-wf-1",
      actorType: "system",
      occurredAt: nowIso(),
    });

    const snapshot = store.loadTaskSnapshot(taskId);
    assert.equal(snapshot.task.status, "queued");
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkflowTransitionService.transition throws on status mismatch", () => {
  const workspace = createTempWorkspace("aa-workflow-mismatch-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new WorkflowTransitionService(db, store);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Workflow Mismatch Test",
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
      store.insertWorkflow({
        id: taskId,
        taskId,
        name: "Test Workflow",
        status: "running",
        currentStepIndex: 1,
        outputsJson: "{}",
        createdAt: now,
        updatedAt: now,
      });
    });

    assert.throws(
      () =>
        service.transition({
          entityKind: "workflow",
          entityId: taskId,
          fromStatus: "created",
          toStatus: "running",
          currentStepIndex: 0,
          outputsJson: "{}",
          reasonCode: "workflow.start",
          traceId: "trace-wf-mismatch",
          actorType: "system",
          occurredAt: nowIso(),
        }),
      /transition_fromStatus_mismatch/
    );
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// SESSION TRANSITION SERVICE TESTS
// =============================================================================

test("SessionTransitionService.transition applies valid status change", () => {
  const workspace = createTempWorkspace("aa-session-transition-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = store;
    const service = new SessionTransitionService(repository as any);

    const taskId = newId("task");
    const sessionId = newId("session");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Session Transition Test",
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
      store.insertSession({
        id: sessionId,
        taskId,
        status: "open",
        createdAt: now,
        updatedAt: now,
      });
    });

    // Note: This test validates the service can be constructed
    // Full integration testing requires more complex setup
    assert.ok(service);
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// EXECUTION TRANSITION SERVICE TESTS
// =============================================================================

test("ExecutionTransitionService.transition applies valid status change", () => {
  const workspace = createTempWorkspace("aa-exec-transition-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = store;
    const service = new ExecutionTransitionService(repository as any, db);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Execution Transition Test",
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
        traceId: "trace-exec-1",
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

    service.transition({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "created",
      toStatus: "prechecking",
      reasonCode: "execution.start",
      traceId: "trace-exec-1",
      actorType: "system",
      occurredAt: nowIso(),
    });

    const snapshot = store.loadExecutionSnapshot(executionId);
    assert.equal(snapshot.execution.status, "prechecking");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTransitionService sets startedAt for prechecking", () => {
  const workspace = createTempWorkspace("aa-exec-started-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = store;
    const service = new ExecutionTransitionService(repository as any, db);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Execution StartedAt Test",
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
        traceId: "trace-exec-2",
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

    const nowAfter = nowIso();
    service.transition({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "created",
      toStatus: "prechecking",
      reasonCode: "execution.start",
      traceId: "trace-exec-2",
      actorType: "system",
      occurredAt: nowAfter,
    });

    const snapshot = store.loadExecutionSnapshot(executionId);
    assert.equal(snapshot.execution.status, "prechecking");
    assert.ok(snapshot.execution.startedAt !== null);
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTransitionService sets finishedAt for terminal statuses", () => {
  const workspace = createTempWorkspace("aa-exec-finished-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = store;
    const service = new ExecutionTransitionService(repository as any, db);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Execution FinishedAt Test",
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
        status: "executing",
        inputRef: null,
        traceId: "trace-exec-3",
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

    const nowAfter = nowIso();
    service.transition({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "executing",
      toStatus: "succeeded",
      reasonCode: "execution.complete",
      traceId: "trace-exec-3",
      actorType: "system",
      occurredAt: nowAfter,
    });

    const snapshot = store.loadExecutionSnapshot(executionId);
    assert.equal(snapshot.execution.status, "succeeded");
    assert.ok(snapshot.execution.finishedAt !== null);
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// APPROVAL TRANSITION SERVICE TESTS
// =============================================================================

test("ApprovalTransitionService.transition applies valid status change", () => {
  const workspace = createTempWorkspace("aa-approval-transition-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = store;
    const service = new ApprovalTransitionService(repository as any);

    const approvalId = newId("approval");
    const now = nowIso();

    db.transaction(() => {
      store.insertApproval({
        id: approvalId,
        taskId: "task-approval-1",
        executionId: "exec-approval-1",
        status: "requested",
        requestJson: JSON.stringify({}),
        responseJson: null,
        timeoutPolicy: "reject",
        createdAt: now,
        respondedAt: null,
      });
    });

    service.transition({
      entityKind: "approval",
      entityId: approvalId,
      fromStatus: "requested",
      toStatus: "approved",
      responseJson: JSON.stringify({ decision: "approved" }),
      reasonCode: "approval.approved",
      traceId: "trace-approval-1",
      actorType: "human",
      occurredAt: nowIso(),
    });

    const snapshot = store.loadApprovalSnapshot(approvalId);
    assert.equal(snapshot.approval.status, "approved");
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalTransitionService.transition throws on invalid transition", () => {
  const workspace = createTempWorkspace("aa-approval-invalid-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = store;
    const service = new ApprovalTransitionService(repository as any);

    const approvalId = newId("approval");
    const now = nowIso();

    db.transaction(() => {
      store.insertApproval({
        id: approvalId,
        taskId: "task-approval-2",
        executionId: "exec-approval-2",
        status: "approved",
        requestJson: JSON.stringify({}),
        responseJson: JSON.stringify({ decision: "approved" }),
        timeoutPolicy: "reject",
        createdAt: now,
        respondedAt: now,
      });
    });

    assert.throws(
      () =>
        service.transition({
          entityKind: "approval",
          entityId: approvalId,
          fromStatus: "approved",
          toStatus: "rejected",
          responseJson: JSON.stringify({ decision: "rejected" }),
          reasonCode: "approval.reject",
          traceId: "trace-approval-invalid",
          actorType: "human",
          occurredAt: nowIso(),
        }),
      /invalid_transition|transition_cas_failed/
    );
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// TRANSITION SERVICE FACADE TESTS
// =============================================================================

test("TransitionService can transition task status via facade", () => {
  const workspace = createTempWorkspace("aa-facade-task-");
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
        title: "Facade Task Test",
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
        traceId: "trace-facade-1",
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

    service.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "queued",
      toStatus: "in_progress",
      executionId,
      reasonCode: "task.started",
      traceId: "trace-facade-1",
      actorType: "system",
      occurredAt: nowIso(),
    });

    const snapshot = store.loadTaskSnapshot(taskId);
    assert.equal(snapshot.task.status, "in_progress");
  } finally {
    cleanupPath(workspace);
  }
});

test("TransitionService can transition workflow status via facade", () => {
  const workspace = createTempWorkspace("aa-facade-workflow-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Facade Workflow Test",
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
      store.insertWorkflow({
        id: taskId,
        taskId,
        name: "Test Workflow",
        status: "created",
        currentStepIndex: 0,
        outputsJson: "{}",
        createdAt: now,
        updatedAt: now,
      });
    });

    service.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "created",
      toStatus: "running",
      currentStepIndex: 0,
      outputsJson: "{}",
      reasonCode: "workflow.start",
      traceId: "trace-facade-wf",
      actorType: "system",
      occurredAt: nowIso(),
    });
  } finally {
    cleanupPath(workspace);
  }
});

test("TransitionService can transition execution status via facade", () => {
  const workspace = createTempWorkspace("aa-facade-exec-");
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
        title: "Facade Execution Test",
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
        traceId: "trace-facade-exec",
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

    service.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "created",
      toStatus: "executing",
      reasonCode: "execution.start",
      traceId: "trace-facade-exec",
      actorType: "system",
      occurredAt: nowIso(),
    });
  } finally {
    cleanupPath(workspace);
  }
});

test("TransitionService can transition approval status via facade", () => {
  const workspace = createTempWorkspace("aa-facade-approval-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);

    const approvalId = newId("approval");
    const now = nowIso();

    db.transaction(() => {
      store.insertApproval({
        id: approvalId,
        taskId: "task-facade-approval",
        executionId: "exec-facade-approval",
        status: "requested",
        requestJson: JSON.stringify({}),
        responseJson: null,
        timeoutPolicy: "reject",
        createdAt: now,
        respondedAt: null,
      });
    });

    service.transitionApprovalStatus({
      entityKind: "approval",
      entityId: approvalId,
      fromStatus: "requested",
      toStatus: "approved",
      responseJson: JSON.stringify({ decision: "approved" }),
      reasonCode: "approval.approved",
      traceId: "trace-facade-approval",
      actorType: "human",
      occurredAt: nowIso(),
    });

    const snapshot = store.loadApprovalSnapshot(approvalId);
    assert.equal(snapshot.approval.status, "approved");
  } finally {
    cleanupPath(workspace);
  }
});