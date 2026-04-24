import assert from "node:assert/strict";
import test from "node:test";

import { buildAgentExecutionRecord, persistRemoteLogs } from "../../../../../src/platform/execution/worker-pool/execution-worker-writeback-support.js";
import { resolveRemoteAuthorityBlockReason } from "../../../../../src/platform/execution/worker-pool/remote-session-guard.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AgentExecutionRecord, ExecutionRecord, TaskRecord, WorkerSnapshotRecord } from "../../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// Mock store factory
// ---------------------------------------------------------------------------

function createMockStore(): AuthoritativeTaskStore {
  return {
    worker: {
      getAgentExecutionRecord: () => undefined,
      upsertAgentExecutionRecord: () => {},
      insertRemoteLog: () => {},
    },
  } as unknown as AuthoritativeTaskStore;
}

// ---------------------------------------------------------------------------
// buildAgentExecutionRecord tests
// ---------------------------------------------------------------------------

test("buildAgentExecutionRecord creates new record when no existing record", () => {
  const store = createMockStore();
  const execution = {
    id: "exec-001",
    taskId: "task-001",
    workflowId: "wf-001",
    roleId: "role-001",
    runKind: "task_run" as const,
    startedAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
  } as ExecutionRecord;

  const updates = {
    agentId: "worker-001",
    runtimeInstanceId: "runtime-001",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "succeeded",
    currentStepId: "step-001",
    lastToolName: "tool-001",
    toolCallCount: 10,
    progressMessage: "completed",
    lastErrorCode: null,
    completedAt: "2024-01-01T01:00:00.000Z",
  };

  const result = buildAgentExecutionRecord(store, execution, execution.id, "2024-01-01T01:00:00.000Z", updates);

  assert.equal(result.executionId, "exec-001");
  assert.equal(result.taskId, "task-001");
  assert.equal(result.agentId, "worker-001");
  assert.equal(result.workflowId, "wf-001");
  assert.equal(result.roleId, "role-001");
  assert.equal(result.runKind, "task_run");
  assert.equal(result.runtimeInstanceId, "runtime-001");
  assert.equal(result.restartedFromRuntimeInstanceId, null);
  assert.equal(result.restartGeneration, 0);
  assert.equal(result.status, "succeeded");
  assert.equal(result.currentStepId, "step-001");
  assert.equal(result.lastToolName, "tool-001");
  assert.equal(result.toolCallCount, 10);
  assert.equal(result.progressMessage, "completed");
  assert.equal(result.lastErrorCode, null);
  assert.equal(result.completedAt, "2024-01-01T01:00:00.000Z");
  assert.equal(result.startedAt, "2024-01-01T00:00:00.000Z");
});

test("buildAgentExecutionRecord preserves existing record fields when present", () => {
  const store = createMockStore();
  const existingRecord: AgentExecutionRecord = {
    executionId: "exec-001",
    taskId: "task-001",
    agentId: "worker-001",
    workflowId: "wf-001",
    roleId: "role-001",
    runKind: "task_run",
    runtimeInstanceId: "runtime-old",
    restartedFromRuntimeInstanceId: "runtime-prev",
    restartGeneration: 2,
    status: "executing",
    planJson: '{"key": "existing_plan"}',
    currentStepId: "step-001",
    lastToolName: "tool-prev",
    toolCallCount: 5,
    lastDecisionJson: '{"decision": "made"}',
    lastErrorCode: "prev_error",
    retryCount: 1,
    progressMessage: "in progress",
    startedAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:30:00.000Z",
    completedAt: null,
  };
  store.worker.getAgentExecutionRecord = () => existingRecord;

  const execution = {
    id: "exec-001",
    taskId: "task-001",
    workflowId: "wf-001",
    roleId: "role-001",
    runKind: "task_run" as const,
    startedAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
  } as ExecutionRecord;

  const updates = {
    agentId: "worker-001",
    runtimeInstanceId: "runtime-new",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 2,
    status: "succeeded",
    currentStepId: "step-002",
    lastToolName: "tool-new",
    toolCallCount: 15,
    progressMessage: "done",
    lastErrorCode: null,
    completedAt: "2024-01-01T01:00:00.000Z",
  };

  const result = buildAgentExecutionRecord(store, execution, execution.id, "2024-01-01T01:00:00.000Z", updates);

  // Should preserve planJson from existing
  assert.equal(result.planJson, '{"key": "existing_plan"}');
  // Should preserve lastDecisionJson from existing
  assert.equal(result.lastDecisionJson, '{"decision": "made"}');
  // Should preserve retryCount from existing (not recalculated)
  assert.equal(result.retryCount, 1);
  // Should preserve startedAt from existing
  assert.equal(result.startedAt, "2024-01-01T00:00:00.000Z");
  // New values should be used
  assert.equal(result.currentStepId, "step-002");
  assert.equal(result.toolCallCount, 15);
  assert.equal(result.progressMessage, "done");
});

test("buildAgentExecutionRecord clamps negative toolCallCount to zero", () => {
  const store = createMockStore();
  const execution = {
    id: "exec-001",
    taskId: "task-001",
    workflowId: "wf-001",
    roleId: null,
    runKind: "task_run" as const,
    startedAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
  } as ExecutionRecord;

  const updates = {
    agentId: "worker-001",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "succeeded",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: -5,
    progressMessage: null,
    lastErrorCode: null,
    completedAt: "2024-01-01T01:00:00.000Z",
  };

  const result = buildAgentExecutionRecord(store, execution, execution.id, "2024-01-01T01:00:00.000Z", updates);
  assert.equal(result.toolCallCount, 0);
});

test("buildAgentExecutionRecord calculates retryCount from execution attempt", () => {
  const store = createMockStore();
  store.worker.getAgentExecutionRecord = () => undefined;

  const execution = {
    id: "exec-001",
    taskId: "task-001",
    workflowId: "wf-001",
    roleId: null,
    runKind: "task_run" as const,
    attempt: 3,
    startedAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
  } as ExecutionRecord;

  const updates = {
    agentId: "worker-001",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "succeeded",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: 0,
    progressMessage: null,
    lastErrorCode: null,
    completedAt: "2024-01-01T01:00:00.000Z",
  };

  const result = buildAgentExecutionRecord(store, execution, execution.id, "2024-01-01T01:00:00.000Z", updates);
  assert.equal(result.retryCount, 2); // attempt - 1 = 3 - 1 = 2
});

// ---------------------------------------------------------------------------
// persistRemoteLogs tests
// ---------------------------------------------------------------------------

test("persistRemoteLogs does nothing when remoteLogs is undefined", () => {
  const store = createMockStore();
  let insertRemoteLogCalled = false;
  store.worker.insertRemoteLog = () => { insertRemoteLogCalled = true; };

  persistRemoteLogs(store, "task-001", "exec-001", "trace-001", "worker-001", null, undefined, "2024-01-01T00:00:00.000Z");

  assert.equal(insertRemoteLogCalled, false);
});

test("persistRemoteLogs does nothing when remoteLogs is empty array", () => {
  const store = createMockStore();
  let insertRemoteLogCalled = false;
  store.worker.insertRemoteLog = () => { insertRemoteLogCalled = true; };

  persistRemoteLogs(store, "task-001", "exec-001", "trace-001", "worker-001", null, [], "2024-01-01T00:00:00.000Z");

  assert.equal(insertRemoteLogCalled, false);
});

test("persistRemoteLogs persists valid log entries", () => {
  const store = createMockStore();
  const insertedLogs: unknown[] = [];
  store.worker.insertRemoteLog = (log: unknown) => { insertedLogs.push(log); };

  const remoteLogs = [
    { level: "info" as const, message: "Task started", occurredAt: "2024-01-01T00:01:00.000Z" },
    { level: "debug" as const, message: "Processing step 1", context: { step: 1 }, occurredAt: "2024-01-01T00:02:00.000Z" },
  ];

  persistRemoteLogs(store, "task-001", "exec-001", "trace-001", "worker-001", "runtime-001", remoteLogs, "2024-01-01T00:00:00.000Z");

  assert.equal(insertedLogs.length, 2);
  assert.equal((insertedLogs[0] as { message: string }).message, "Task started");
  assert.equal((insertedLogs[0] as { level: string }).level, "info");
  assert.equal((insertedLogs[1] as { message: string }).message, "Processing step 1");
  assert.equal((insertedLogs[1] as { level: string }).level, "debug");
});

test("persistRemoteLogs skips empty messages", () => {
  const store = createMockStore();
  const insertedLogs: unknown[] = [];
  store.worker.insertRemoteLog = (log: unknown) => { insertedLogs.push(log); };

  const remoteLogs = [
    { level: "info" as const, message: "", occurredAt: "2024-01-01T00:01:00.000Z" },
    { level: "info" as const, message: "valid message", occurredAt: "2024-01-01T00:02:00.000Z" },
  ];

  persistRemoteLogs(store, "task-001", "exec-001", "trace-001", "worker-001", null, remoteLogs, "2024-01-01T00:00:00.000Z");

  assert.equal(insertedLogs.length, 1);
  assert.equal((insertedLogs[0] as { message: string }).message, "valid message");
});

test("persistRemoteLogs trims whitespace from messages", () => {
  const store = createMockStore();
  const insertedLogs: unknown[] = [];
  store.worker.insertRemoteLog = (log: unknown) => { insertedLogs.push(log); };

  const remoteLogs = [
    { level: "info" as const, message: "  trimmed message  ", occurredAt: "2024-01-01T00:01:00.000Z" },
  ];

  persistRemoteLogs(store, "task-001", "exec-001", "trace-001", "worker-001", null, remoteLogs, "2024-01-01T00:00:00.000Z");

  assert.equal(insertedLogs.length, 1);
  assert.equal((insertedLogs[0] as { message: string }).message, "trimmed message");
});

test("persistRemoteLogs uses defaultOccurredAt when entry has no occurredAt", () => {
  const store = createMockStore();
  const insertedLogs: unknown[] = [];
  store.worker.insertRemoteLog = (log: unknown) => { insertedLogs.push(log); };

  const remoteLogs = [
    { level: "warn" as const, message: "warning message" },
  ];

  persistRemoteLogs(store, "task-001", "exec-001", "trace-001", "worker-001", null, remoteLogs, "2024-01-01T00:00:00.000Z");

  assert.equal(insertedLogs.length, 1);
  assert.equal((insertedLogs[0] as { createdAt: string }).createdAt, "2024-01-01T00:00:00.000Z");
});

test("persistRemoteLogs includes correlation context in log", () => {
  const store = createMockStore();
  const insertedLogs: unknown[] = [];
  store.worker.insertRemoteLog = (log: unknown) => { insertedLogs.push(log); };

  const remoteLogs = [
    { level: "info" as const, message: "test log", context: { customKey: "customValue" } },
  ];

  persistRemoteLogs(store, "task-001", "exec-001", "trace-001", "worker-001", "runtime-001", remoteLogs, "2024-01-01T00:00:00.000Z");

  const insertedLog = insertedLogs[0] as { contextJson: string };
  const context = JSON.parse(insertedLog.contextJson);
  assert.equal(context.taskId, "task-001");
  assert.equal(context.executionId, "exec-001");
  assert.equal(context.workerId, "worker-001");
  assert.equal(context.traceId, "trace-001");
  assert.equal(context.correlationId, "task-001");
  assert.equal(context.runtimeInstanceId, "runtime-001");
  assert.equal(context.customKey, "customValue");
});

// ---------------------------------------------------------------------------
// resolveRemoteAuthorityBlockReason tests - extended coverage
// ---------------------------------------------------------------------------

test("resolveRemoteAuthorityBlockReason returns null for local placement", () => {
  const result = resolveRemoteAuthorityBlockReason({
    placement: "local",
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
  });
  assert.equal(result, null);
});

test("resolveRemoteAuthorityBlockReason returns null for undefined placement", () => {
  const result = resolveRemoteAuthorityBlockReason({
    placement: undefined,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
  });
  assert.equal(result, null);
});

test("resolveRemoteAuthorityBlockReason returns remote_session_viewer_only", () => {
  const result = resolveRemoteAuthorityBlockReason({
    placement: "remote",
    remoteSessionStatus: "viewer_only",
    lastAcknowledgedStreamOffset: "offset-123",
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
  });
  assert.equal(result, "remote_session_viewer_only");
});

test("resolveRemoteAuthorityBlockReason returns remote_session_consistency_mismatch", () => {
  const result = resolveRemoteAuthorityBlockReason({
    placement: "remote",
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "offset-123",
    sessionConsistencyCheckStatus: "mismatch",
    workspaceSyncStatus: null,
  });
  assert.equal(result, "remote_session_consistency_mismatch");
});

test("resolveRemoteAuthorityBlockReason returns remote_workspace_sync_conflict", () => {
  const result = resolveRemoteAuthorityBlockReason({
    placement: "remote",
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "offset-123",
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: "conflict",
  });
  assert.equal(result, "remote_workspace_sync_conflict");
});

test("resolveRemoteAuthorityBlockReason returns remote_session_resume_offset_missing", () => {
  const result = resolveRemoteAuthorityBlockReason({
    placement: "remote",
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
  });
  assert.equal(result, "remote_session_resume_offset_missing");
});

test("resolveRemoteAuthorityBlockReason returns null for remote with connecting status and no offset", () => {
  const result = resolveRemoteAuthorityBlockReason({
    placement: "remote",
    remoteSessionStatus: "connecting",
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
  });
  assert.equal(result, null);
});

test("resolveRemoteAuthorityBlockReason returns null for remote with failed status and no offset", () => {
  const result = resolveRemoteAuthorityBlockReason({
    placement: "remote",
    remoteSessionStatus: "failed",
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
  });
  assert.equal(result, null);
});

test("resolveRemoteAuthorityBlockReason returns null for remote with valid offset", () => {
  const result = resolveRemoteAuthorityBlockReason({
    placement: "remote",
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "valid-offset",
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
  });
  assert.equal(result, null);
});

test("resolveRemoteAuthorityBlockReason treats empty string as missing offset", () => {
  const result = resolveRemoteAuthorityBlockReason({
    placement: "remote",
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "",
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
  });
  assert.equal(result, "remote_session_resume_offset_missing");
});

test("resolveRemoteAuthorityBlockReason treats whitespace-only string as missing offset", () => {
  const result = resolveRemoteAuthorityBlockReason({
    placement: "remote",
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "   ",
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
  });
  assert.equal(result, "remote_session_resume_offset_missing");
});
