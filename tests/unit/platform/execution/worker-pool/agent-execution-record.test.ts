import assert from "node:assert/strict";
import test from "node:test";

import { buildAgentExecutionRecord } from "../../../../../src/platform/five-plane-execution/worker-pool/execution-worker-handshake-support.js";
import type {
  AgentExecutionRecord,
  ExecutionRecord,
  RunKind,
} from "../../../../../src/platform/contracts/types/domain.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createMockStore(
  overrides: Partial<{
    getAgentExecutionRecord: (executionId: string) => AgentExecutionRecord | undefined;
  }> = {},
): AuthoritativeTaskStore {
  return {
    worker: {
      getAgentExecutionRecord: overrides.getAgentExecutionRecord ?? (() => undefined),
      upsertAgentExecutionRecord: () => {},
      insertRemoteLog: () => {},
    },
    dispatch: {
      getExecution: () => null,
    },
  } as unknown as AuthoritativeTaskStore;
}

function createMockExecution(overrides: Partial<ExecutionRecord> = {}): ExecutionRecord {
  return {
    id: "exec-001",
    taskId: "task-001",
    workflowId: "workflow-001",
    parentExecutionId: null,
    agentId: "agent-001",
    roleId: "role-001",
    runKind: "task_run" as RunKind,
    status: "executing",
    inputRef: null,
    traceId: "trace-001",
    attempt: 1,
    timeoutMs: 300000,
    budgetUsdLimit: null,
    requiresApproval: 0,
    sandboxMode: null,
    allowedToolsJson: null,
    allowedPathsJson: null,
    maxRetries: 3,
    retryBackoff: "none",
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createMockUpdates(
  overrides: Partial<{
    agentId: string;
    runtimeInstanceId: string | null;
    restartedFromRuntimeInstanceId: string | null;
    restartGeneration: number;
    status: string;
    currentStepId: string | null;
    lastToolName: string | null;
    toolCallCount: number;
    progressMessage: string | null;
    lastErrorCode: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
  }> = {},
) {
  return {
    agentId: "agent-001",
    runtimeInstanceId: "runtime-001",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "running",
    currentStepId: "step-001",
    lastToolName: "tool-1",
    toolCallCount: 5,
    progressMessage: "Working on step 1",
    lastErrorCode: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildAgentExecutionRecord tests
// ---------------------------------------------------------------------------

test("buildAgentExecutionRecord creates new record with required fields", () => {
  const store = createMockStore();
  const execution = createMockExecution();
  const occurredAt = "2024-01-01T00:00:00.000Z";
  const updates = createMockUpdates();

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.executionId, "exec-001");
  assert.equal(result.taskId, "task-001");
  assert.equal(result.agentId, "agent-001");
  assert.equal(result.workflowId, "workflow-001");
  assert.equal(result.roleId, "role-001");
  assert.equal(result.runKind, "task_run");
  assert.equal(result.runtimeInstanceId, "runtime-001");
  assert.equal(result.status, "running");
  assert.equal(result.currentStepId, "step-001");
  assert.equal(result.lastToolName, "tool-1");
  assert.equal(result.toolCallCount, 5);
  assert.equal(result.progressMessage, "Working on step 1");
});

test("buildAgentExecutionRecord sets planJson from execution details when no existing record", () => {
  const store = createMockStore();
  const execution = createMockExecution();
  const occurredAt = "2024-01-01T00:00:00.000Z";
  const updates = createMockUpdates();

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  const planJson = JSON.parse(result.planJson);
  assert.equal(planJson.workflowId, "workflow-001");
  assert.equal(planJson.roleId, "role-001");
  assert.equal(planJson.runKind, "task_run");
});

test("buildAgentExecutionRecord preserves existing planJson when present", () => {
  const existingRecord: AgentExecutionRecord = {
    executionId: "exec-001",
    taskId: "task-001",
    agentId: "agent-001",
    workflowId: "workflow-001",
    roleId: "role-001",
    runKind: "task_run",
    runtimeInstanceId: "runtime-001",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 1,
    status: "running",
    planJson: '{"custom": "plan"}',
    currentStepId: "step-002",
    lastToolName: "tool-2",
    toolCallCount: 10,
    lastDecisionJson: null,
    lastErrorCode: null,
    retryCount: 1,
    progressMessage: "Custom progress",
    startedAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    completedAt: null,
  };
  const store = createMockStore({
    getAgentExecutionRecord: () => existingRecord,
  });
  const execution = createMockExecution();
  const occurredAt = "2024-01-02T00:00:00.000Z";
  const updates = createMockUpdates({ currentStepId: "step-003" });

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.planJson, '{"custom": "plan"}');
  assert.equal(result.currentStepId, "step-003");
});

test("buildAgentExecutionRecord preserves existing lastDecisionJson when no update provided", () => {
  const existingRecord: AgentExecutionRecord = {
    executionId: "exec-001",
    taskId: "task-001",
    agentId: "agent-001",
    workflowId: "workflow-001",
    roleId: "role-001",
    runKind: "task_run",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "running",
    planJson: "{}",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: 0,
    lastDecisionJson: '{"decision": "skip"}',
    lastErrorCode: null,
    retryCount: 0,
    progressMessage: null,
    startedAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    completedAt: null,
  };
  const store = createMockStore({
    getAgentExecutionRecord: () => existingRecord,
  });
  const execution = createMockExecution();
  const occurredAt = "2024-01-01T00:00:00.000Z";
  const updates = createMockUpdates();

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.lastDecisionJson, '{"decision": "skip"}');
});

test("buildAgentExecutionRecord calculates retryCount from attempt when no existing record", () => {
  const store = createMockStore();
  const execution = createMockExecution({ attempt: 3 });
  const occurredAt = "2024-01-01T00:00:00.000Z";
  const updates = createMockUpdates();

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.retryCount, 2);
});

test("buildAgentExecutionRecord preserves existing retryCount when present", () => {
  const existingRecord: AgentExecutionRecord = {
    executionId: "exec-001",
    taskId: "task-001",
    agentId: "agent-001",
    workflowId: "workflow-001",
    roleId: "role-001",
    runKind: "task_run",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "running",
    planJson: "{}",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: 0,
    lastDecisionJson: null,
    lastErrorCode: null,
    retryCount: 5,
    progressMessage: null,
    startedAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    completedAt: null,
  };
  const store = createMockStore({
    getAgentExecutionRecord: () => existingRecord,
  });
  const execution = createMockExecution({ attempt: 2 });
  const occurredAt = "2024-01-01T00:00:00.000Z";
  const updates = createMockUpdates();

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.retryCount, 5);
});

test("buildAgentExecutionRecord handles startedAt with explicit value", () => {
  const store = createMockStore();
  const execution = createMockExecution();
  const occurredAt = "2024-01-01T00:00:00.000Z";
  const updates = createMockUpdates({ startedAt: "2024-01-01T00:01:00.000Z" });

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.startedAt, "2024-01-01T00:01:00.000Z");
});

test("buildAgentExecutionRecord uses occurredAt as startedAt when not provided", () => {
  const store = createMockStore();
  const execution = createMockExecution();
  const occurredAt = "2024-01-01T00:00:00.000Z";
  const updates = createMockUpdates();

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.startedAt, occurredAt);
});

test("buildAgentExecutionRecord preserves existing startedAt when startedAt is undefined", () => {
  const existingRecord: AgentExecutionRecord = {
    executionId: "exec-001",
    taskId: "task-001",
    agentId: "agent-001",
    workflowId: "workflow-001",
    roleId: "role-001",
    runKind: "task_run",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "running",
    planJson: "{}",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: 0,
    lastDecisionJson: null,
    lastErrorCode: null,
    retryCount: 0,
    progressMessage: null,
    startedAt: "2024-01-01T00:05:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    completedAt: null,
  };
  const store = createMockStore({
    getAgentExecutionRecord: () => existingRecord,
  });
  const execution = createMockExecution();
  const occurredAt = "2024-01-02T00:00:00.000Z";
  const updates = createMockUpdates();

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.startedAt, "2024-01-01T00:05:00.000Z");
});

test("buildAgentExecutionRecord handles completedAt with explicit value", () => {
  const store = createMockStore();
  const execution = createMockExecution();
  const occurredAt = "2024-01-01T00:00:00.000Z";
  const updates = createMockUpdates({ completedAt: "2024-01-01T00:10:00.000Z" });

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.completedAt, "2024-01-01T00:10:00.000Z");
});

test("buildAgentExecutionRecord sets completedAt to null when not provided and no existing", () => {
  const store = createMockStore();
  const execution = createMockExecution();
  const occurredAt = "2024-01-01T00:00:00.000Z";
  const updates = createMockUpdates();

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.completedAt, null);
});

test("buildAgentExecutionRecord preserves existing completedAt when completedAt is undefined", () => {
  const existingRecord: AgentExecutionRecord = {
    executionId: "exec-001",
    taskId: "task-001",
    agentId: "agent-001",
    workflowId: "workflow-001",
    roleId: "role-001",
    runKind: "task_run",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "running",
    planJson: "{}",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: 0,
    lastDecisionJson: null,
    lastErrorCode: null,
    retryCount: 0,
    progressMessage: null,
    startedAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    completedAt: "2024-01-01T00:10:00.000Z",
  };
  const store = createMockStore({
    getAgentExecutionRecord: () => existingRecord,
  });
  const execution = createMockExecution();
  const occurredAt = "2024-01-02T00:00:00.000Z";
  const updates = createMockUpdates();

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.completedAt, "2024-01-01T00:10:00.000Z");
});

test("buildAgentExecutionRecord normalizes negative toolCallCount to zero", () => {
  const store = createMockStore();
  const execution = createMockExecution();
  const occurredAt = "2024-01-01T00:00:00.000Z";
  const updates = createMockUpdates({ toolCallCount: -5 });

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.toolCallCount, 0);
});

test("buildAgentExecutionRecord truncates fractional toolCallCount", () => {
  const store = createMockStore();
  const execution = createMockExecution();
  const occurredAt = "2024-01-01T00:00:00.000Z";
  const updates = createMockUpdates({ toolCallCount: 5.7 });

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.toolCallCount, 5);
});

test("buildAgentExecutionRecord sets createdAt from existing record when present", () => {
  const existingRecord: AgentExecutionRecord = {
    executionId: "exec-001",
    taskId: "task-001",
    agentId: "agent-001",
    workflowId: "workflow-001",
    roleId: "role-001",
    runKind: "task_run",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "running",
    planJson: "{}",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: 0,
    lastDecisionJson: null,
    lastErrorCode: null,
    retryCount: 0,
    progressMessage: null,
    startedAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    completedAt: null,
  };
  const store = createMockStore({
    getAgentExecutionRecord: () => existingRecord,
  });
  const execution = createMockExecution();
  const occurredAt = "2024-01-02T00:00:00.000Z";
  const updates = createMockUpdates();

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.createdAt, "2024-01-01T00:00:00.000Z");
});

test("buildAgentExecutionRecord sets createdAt to occurredAt when no existing record", () => {
  const store = createMockStore();
  const execution = createMockExecution();
  const occurredAt = "2024-01-01T00:00:00.000Z";
  const updates = createMockUpdates();

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.createdAt, occurredAt);
});

test("buildAgentExecutionRecord always sets updatedAt to occurredAt", () => {
  const existingRecord: AgentExecutionRecord = {
    executionId: "exec-001",
    taskId: "task-001",
    agentId: "agent-001",
    workflowId: "workflow-001",
    roleId: "role-001",
    runKind: "task_run",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "running",
    planJson: "{}",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: 0,
    lastDecisionJson: null,
    lastErrorCode: null,
    retryCount: 0,
    progressMessage: null,
    startedAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    completedAt: null,
  };
  const store = createMockStore({
    getAgentExecutionRecord: () => existingRecord,
  });
  const execution = createMockExecution();
  const occurredAt = "2024-01-02T00:00:00.000Z";
  const updates = createMockUpdates();

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.updatedAt, "2024-01-02T00:00:00.000Z");
});

test("buildAgentExecutionRecord handles null values for nullable fields", () => {
  const store = createMockStore();
  const execution = createMockExecution();
  const occurredAt = "2024-01-01T00:00:00.000Z";
  const updates = createMockUpdates({
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    currentStepId: null,
    lastToolName: null,
    progressMessage: null,
    lastErrorCode: null,
  });

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.runtimeInstanceId, null);
  assert.equal(result.restartedFromRuntimeInstanceId, null);
  assert.equal(result.currentStepId, null);
  assert.equal(result.lastToolName, null);
  assert.equal(result.progressMessage, null);
  assert.equal(result.lastErrorCode, null);
});

test("buildAgentExecutionRecord handles restartedFromRuntimeInstanceId", () => {
  const store = createMockStore();
  const execution = createMockExecution();
  const occurredAt = "2024-01-01T00:00:00.000Z";
  const updates = createMockUpdates({
    restartedFromRuntimeInstanceId: "previous-runtime-001",
    restartGeneration: 2,
  });

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.restartedFromRuntimeInstanceId, "previous-runtime-001");
  assert.equal(result.restartGeneration, 2);
});

test("buildAgentExecutionRecord handles null lastErrorCode", () => {
  const store = createMockStore();
  const execution = createMockExecution();
  const occurredAt = "2024-01-01T00:00:00.000Z";
  const updates = createMockUpdates({ lastErrorCode: null });

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.lastErrorCode, null);
});

test("buildAgentExecutionRecord handles lastErrorCode with value", () => {
  const store = createMockStore();
  const execution = createMockExecution();
  const occurredAt = "2024-01-01T00:00:00.000Z";
  const updates = createMockUpdates({ lastErrorCode: "TOOL_TIMEOUT" });

  const result = buildAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(result.lastErrorCode, "TOOL_TIMEOUT");
});
