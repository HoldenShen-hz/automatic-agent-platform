import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../../../src/platform/five-plane-execution/state-transition/transition-service.js";
import type { TaskTerminalTransitionInput } from "../../../../src/platform/five-plane-execution/state-transition/transition-service-model.js";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";

// =============================================================================
// TASK TERMINAL STATE TRANSITION TESTS
// =============================================================================

test("TransitionService.transitionTaskTerminalState transitions task to done", () => {
  const workspace = createTempWorkspace("aa-terminal-done-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);

    const taskId = newId("task");
    const sessionId = newId("session");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Terminal Done Test",
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
        id: taskId,
        taskId,
        name: "Test Workflow",
        status: "running",
        currentStepIndex: 2,
        outputsJson: '{"step1": "result"}',
        createdAt: now,
        updatedAt: now,
      });
      store.insertSession({
        id: sessionId,
        taskId,
        status: "streaming",
        createdAt: now,
        updatedAt: now,
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
        traceId: "trace-terminal-1",
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

    const input: TaskTerminalTransitionInput = {
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: "done",
      taskOutputJson: '{"result": "success"}',
      outputsJson: '{"steps": []}',
      context: {
        traceId: "trace-terminal-done",
        occurredAt: nowIso(),
        actorType: "system",
      },
    };

    service.transitionTaskTerminalState(input);

    const snapshot = store.loadTaskSnapshot(taskId);
    assert.equal(snapshot.task.status, "done");
    assert.ok(snapshot.task.completedAt !== null);
  } finally {
    cleanupPath(workspace);
  }
});

test("TransitionService.transitionTaskTerminalState transitions task to failed", () => {
  const workspace = createTempWorkspace("aa-terminal-failed-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);

    const taskId = newId("task");
    const sessionId = newId("session");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Terminal Failed Test",
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
        id: taskId,
        taskId,
        name: "Test Workflow",
        status: "running",
        currentStepIndex: 1,
        outputsJson: "{}",
        createdAt: now,
        updatedAt: now,
      });
      store.insertSession({
        id: sessionId,
        taskId,
        status: "streaming",
        createdAt: now,
        updatedAt: now,
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
        traceId: "trace-terminal-2",
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

    const input: TaskTerminalTransitionInput = {
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: "failed",
      taskOutputJson: '{"error": "something went wrong"}',
      outputsJson: "{}",
      context: {
        traceId: "trace-terminal-failed",
        occurredAt: nowIso(),
        reasonCode: "ERR_EXECUTION_FAILED",
        actorType: "system",
      },
    };

    service.transitionTaskTerminalState(input);

    const snapshot = store.loadTaskSnapshot(taskId);
    assert.equal(snapshot.task.status, "failed");
    assert.ok(snapshot.task.errorCode !== null);
  } finally {
    cleanupPath(workspace);
  }
});

test("TransitionService.transitionTaskTerminalState transitions task to cancelled", () => {
  const workspace = createTempWorkspace("aa-terminal-cancelled-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);

    const taskId = newId("task");
    const sessionId = newId("session");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Terminal Cancelled Test",
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
        id: taskId,
        taskId,
        name: "Test Workflow",
        status: "running",
        currentStepIndex: 0,
        outputsJson: "{}",
        createdAt: now,
        updatedAt: now,
      });
      store.insertSession({
        id: sessionId,
        taskId,
        status: "streaming",
        createdAt: now,
        updatedAt: now,
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
        traceId: "trace-terminal-3",
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

    const input: TaskTerminalTransitionInput = {
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: "cancelled",
      taskOutputJson: null,
      outputsJson: "{}",
      context: {
        traceId: "trace-terminal-cancelled",
        occurredAt: nowIso(),
        actorType: "user",
      },
    };

    service.transitionTaskTerminalState(input);

    const snapshot = store.loadTaskSnapshot(taskId);
    assert.equal(snapshot.task.status, "cancelled");
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// TERMINAL STATE MAPPING TESTS
// =============================================================================

test("Terminal state done maps execution to succeeded", () => {
  const workspace = createTempWorkspace("aa-terminal-mapping-done-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);

    const taskId = newId("task");
    const sessionId = newId("session");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Mapping Done Test",
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
        id: taskId,
        taskId,
        name: "Test Workflow",
        status: "running",
        currentStepIndex: 1,
        outputsJson: "{}",
        createdAt: now,
        updatedAt: now,
      });
      store.insertSession({
        id: sessionId,
        taskId,
        status: "streaming",
        createdAt: now,
        updatedAt: now,
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
        traceId: "trace-mapping-1",
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

    const input: TaskTerminalTransitionInput = {
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: "done",
      taskOutputJson: '{"result": "success"}',
      outputsJson: "{}",
      context: {
        traceId: "trace-mapping-done",
        occurredAt: nowIso(),
        actorType: "system",
      },
    };

    service.transitionTaskTerminalState(input);

    const execution = store.getExecution(executionId);
    assert.equal(execution?.status, "succeeded");
    assert.ok(execution?.finishedAt !== null);
  } finally {
    cleanupPath(workspace);
  }
});

test("Terminal state failed maps execution to failed", () => {
  const workspace = createTempWorkspace("aa-terminal-mapping-failed-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);

    const taskId = newId("task");
    const sessionId = newId("session");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Mapping Failed Test",
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
        id: taskId,
        taskId,
        name: "Test Workflow",
        status: "running",
        currentStepIndex: 0,
        outputsJson: "{}",
        createdAt: now,
        updatedAt: now,
      });
      store.insertSession({
        id: sessionId,
        taskId,
        status: "streaming",
        createdAt: now,
        updatedAt: now,
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
        traceId: "trace-mapping-2",
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

    const input: TaskTerminalTransitionInput = {
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: "failed",
      taskOutputJson: "{}",
      outputsJson: "{}",
      context: {
        traceId: "trace-mapping-failed",
        occurredAt: nowIso(),
        reasonCode: "ERR_FAILED",
        actorType: "system",
      },
    };

    service.transitionTaskTerminalState(input);

    const execution = store.getExecution(executionId);
    assert.equal(execution?.status, "failed");
    assert.ok(execution?.lastErrorCode !== null);
  } finally {
    cleanupPath(workspace);
  }
});

test("Terminal state cancelled maps workflow to cancelled", () => {
  const workspace = createTempWorkspace("aa-terminal-mapping-cancelled-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);

    const taskId = newId("task");
    const sessionId = newId("session");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Mapping Cancelled Test",
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
        id: taskId,
        taskId,
        name: "Test Workflow",
        status: "running",
        currentStepIndex: 3,
        outputsJson: "{}",
        createdAt: now,
        updatedAt: now,
      });
      store.insertSession({
        id: sessionId,
        taskId,
        status: "streaming",
        createdAt: now,
        updatedAt: now,
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
        traceId: "trace-mapping-3",
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

    const input: TaskTerminalTransitionInput = {
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: "cancelled",
      taskOutputJson: null,
      outputsJson: '{"cancelled_step": 3}',
      context: {
        traceId: "trace-mapping-cancelled",
        occurredAt: nowIso(),
        actorType: "user",
      },
    };

    service.transitionTaskTerminalState(input);

    const taskSnapshot = store.loadTaskSnapshot(taskId);
    assert.equal(taskSnapshot.task.status, "cancelled");
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// BLOCKED FOR APPROVAL TRANSITION TESTS
// =============================================================================

test("TransitionService.transitionBlockedForApproval creates approval and transitions entities", () => {
  const workspace = createTempWorkspace("aa-blocked-approval-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);

    const taskId = newId("task");
    const sessionId = newId("session");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Blocked Approval Test",
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
        id: taskId,
        taskId,
        name: "Test Workflow",
        status: "running",
        currentStepIndex: 1,
        outputsJson: "{}",
        createdAt: now,
        updatedAt: now,
      });
      store.insertSession({
        id: sessionId,
        taskId,
        status: "streaming",
        createdAt: now,
        updatedAt: now,
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
        traceId: "trace-blocked-1",
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

    const result = service.transitionBlockedForApproval({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      workflowCurrentStepIndex: 1,
      workflowOutputsJson: "{}",
      approval: {
        sourceAgentId: "agent-1",
        reason: "Human approval needed for this operation",
        riskLevel: "high",
        options: ["approve", "reject"],
        context: { operation: "delete_resource" },
        timeoutPolicy: "reject",
      },
      context: {
        traceId: "trace-blocked-approval",
        occurredAt: nowIso(),
        actorType: "system",
      },
    });

    assert.ok(result.approvalId);
    assert.ok(result.createdAt);

    // Verify task transitioned to awaiting_decision
    const taskSnapshot = store.loadTaskSnapshot(taskId);
    assert.equal(taskSnapshot.task.status, "awaiting_decision");

    // Verify approval record was created
    const approval = store.getApproval(result.approvalId);
    assert.equal(approval?.status, "requested");
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// APPLY TERMINAL STATE TESTS
// =============================================================================

test("TransitionService.applyTaskTerminalState without transaction wrapping", () => {
  const workspace = createTempWorkspace("aa-apply-terminal-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TransitionService(db, store);

    const taskId = newId("task");
    const sessionId = newId("session");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Apply Terminal Test",
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
        id: taskId,
        taskId,
        name: "Test Workflow",
        status: "running",
        currentStepIndex: 0,
        outputsJson: "{}",
        createdAt: now,
        updatedAt: now,
      });
      store.insertSession({
        id: sessionId,
        taskId,
        status: "streaming",
        createdAt: now,
        updatedAt: now,
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
        traceId: "trace-apply-1",
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

    const input: TaskTerminalTransitionInput = {
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: "done",
      taskOutputJson: '{"result": "applied"}',
      outputsJson: "{}",
      context: {
        traceId: "trace-apply-terminal",
        occurredAt: nowIso(),
        actorType: "system",
      },
    };

    service.applyTaskTerminalState(input);

    const snapshot = store.loadTaskSnapshot(taskId);
    assert.equal(snapshot.task.status, "done");
  } finally {
    cleanupPath(workspace);
  }
});
