/**
 * State Transition Service Integration Tests
 *
 * Tests the TransitionService with real SQLite database and store.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { TransitionService } from "../../../../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { createRuntimeLifecycleRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/repositories/runtime-lifecycle-repository.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("TransitionService transitions task from queued to in_progress", () => {
  const workspace = createTempWorkspace("aa-transition-task-");
  const dbPath = join(workspace, "transition-task.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = createRuntimeLifecycleRepository(store);
    const transitions = new TransitionService(db, store, repository);

    const taskId = "task-transition-001";
    const executionId = "exec-transition-001";
    const traceId = "trace-transition-001";
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Transition test task",
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
      store.insertExecution({
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

    const task = store.getTask(taskId);
    assert.equal(task?.status, "in_progress");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransitionService transitions execution through valid states", () => {
  const workspace = createTempWorkspace("aa-transition-exec-");
  const dbPath = join(workspace, "transition-exec.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = createRuntimeLifecycleRepository(store);
    const transitions = new TransitionService(db, store, repository);

    const taskId = "task-exec-001";
    const executionId = "exec-exec-001";
    const traceId = "trace-exec-001";
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
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

    // Valid execution transition: created -> prechecking
    transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "created",
      toStatus: "prechecking",
      reasonCode: "execution.prechecking",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    // Valid execution transition: prechecking -> executing
    transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "prechecking",
      toStatus: "executing",
      reasonCode: "execution.started",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    const execution = store.getExecution(executionId);
    assert.equal(execution?.status, "executing");
    assert.ok(execution?.startedAt);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransitionService rejects invalid task transitions", () => {
  const workspace = createTempWorkspace("aa-transition-invalid-");
  const dbPath = join(workspace, "transition-invalid.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = createRuntimeLifecycleRepository(store);
    const transitions = new TransitionService(db, store, repository);

    const taskId = "task-invalid-001";
    const executionId = "exec-invalid-001";
    const traceId = "trace-invalid-001";
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Invalid transition test",
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

    assert.throws(
      () => transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "queued",
        toStatus: "done",
        executionId,
        reasonCode: "invalid",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      }),
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransitionService handles workflow transitions", () => {
  const workspace = createTempWorkspace("aa-transition-wf-");
  const dbPath = join(workspace, "transition-wf.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = createRuntimeLifecycleRepository(store);
    const transitions = new TransitionService(db, store, repository);

    const taskId = "task-wf-001";
    const traceId = "trace-wf-001";
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Workflow transition test",
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
        taskId,
        divisionId: "general_ops",
        workflowId: "multi_step_workflow",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
    });

    transitions.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "running",
      toStatus: "paused",
      currentStepIndex: 1,
      outputsJson: '{"step1": "done"}',
      reasonCode: "workflow.paused",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    const workflow = store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "paused");
    assert.equal(workflow?.currentStepIndex, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransitionService handles session transitions", () => {
  const workspace = createTempWorkspace("aa-transition-sess-");
  const dbPath = join(workspace, "transition-sess.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = createRuntimeLifecycleRepository(store);
    const transitions = new TransitionService(db, store, repository);

    const sessionId = "sess-transition-001";
    const traceId = "trace-sess-001";
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: "task-sess-001",
        parentId: null,
        rootId: "task-sess-001",
        divisionId: "general_ops",
        tenantId: null,
        title: "Session transition test",
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
      store.insertSession({
        id: sessionId,
        taskId: "task-sess-001",
        status: "open",
        createdAt: now,
        updatedAt: now,
      });
    });

    transitions.transitionSessionStatus({
      entityKind: "session",
      entityId: sessionId,
      fromStatus: "open",
      toStatus: "streaming",
      reasonCode: "session.streaming",
      traceId,
      actorType: "agent",
      occurredAt: nowIso(),
    });

    const session = store.getSession(sessionId);
    assert.equal(session?.status, "streaming");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});