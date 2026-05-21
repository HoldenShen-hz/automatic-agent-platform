/**
 * @fileoverview Unit tests for Execution Worker Writeback Support - Additional Functions
 * Tests: buildAgentExecutionRecord, persistRemoteLogs
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAgentExecutionRecord,
  persistRemoteLogs,
} from "../../../../../src/platform/five-plane-execution/worker-pool/execution-worker-writeback-support.js";
import type { AgentExecutionRecord, WorkerSnapshotRecord } from "../../../../../src/platform/contracts/types/domain.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { WorkerRemoteLogInput } from "../../../../../src/platform/five-plane-execution/worker-pool/execution-worker-handshake-types.js";

// ---------------------------------------------------------------------------
// Mock store factory
// ---------------------------------------------------------------------------

function createMockStore(overrides: Partial<AuthoritativeTaskStore> = {}): AuthoritativeTaskStore {
  return {
    worker: {
      getAgentExecutionRecord: () => null,
      insertRemoteLog: () => {},
      ...overrides.worker,
    },
    dispatch: {
      getExecution: () => null,
    },
    event: {
      insertEvent: () => {},
    },
    ...overrides,
  } as unknown as AuthoritativeTaskStore;
}

// ---------------------------------------------------------------------------
// buildAgentExecutionRecord
// ---------------------------------------------------------------------------

test("buildAgentExecutionRecord creates new record with correct fields", () => {
  const store = createMockStore();
  const execution = {
    id: "exec-123",
    taskId: "task-456",
    workflowId: "wf-789",
    roleId: "role-001",
    runKind: "automatic" as const,
    startedAt: "2024-01-01T00:00:00.000Z",
    attempt: 1,
  };

  const updates = {
    agentId: "agent-abc",
    runtimeInstanceId: "runtime-xyz",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "running",
    currentStepId: "step-1",
    lastToolName: "bash",
    toolCallCount: 5,
    progressMessage: "Processing task",
    lastErrorCode: null,
  };

  const record = buildAgentExecutionRecord(store, execution, "2024-01-01T00:01:00.000Z", updates);

  assert.equal(record.executionId, "exec-123");
  assert.equal(record.taskId, "task-456");
  assert.equal(record.agentId, "agent-abc");
  assert.equal(record.runtimeInstanceId, "runtime-xyz");
  assert.equal(record.status, "running");
  assert.equal(record.toolCallCount, 5);
});

test("buildAgentExecutionRecord uses execution.startedAt when startedAt not in updates", () => {
  const store = createMockStore();
  const execution = {
    id: "exec-123",
    taskId: "task-456",
    workflowId: "wf-789",
    roleId: "role-001",
    runKind: "automatic" as const,
    startedAt: "2024-01-01T00:00:00.000Z",
    attempt: 1,
  };

  const updates = {
    agentId: "agent-abc",
    runtimeInstanceId: "runtime-xyz",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "running",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: 0,
    progressMessage: null,
    lastErrorCode: null,
  };

  const record = buildAgentExecutionRecord(store, execution, "2024-01-01T00:01:00.000Z", updates);

  assert.equal(record.startedAt, "2024-01-01T00:00:00.000Z");
});

test("buildAgentExecutionRecord calculates retryCount from execution attempt", () => {
  const store = createMockStore();
  const execution = {
    id: "exec-123",
    taskId: "task-456",
    workflowId: "wf-789",
    roleId: "role-001",
    runKind: "automatic" as const,
    startedAt: "2024-01-01T00:00:00.000Z",
    attempt: 3,
  };

  const updates = {
    agentId: "agent-abc",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "running",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: 0,
    progressMessage: null,
    lastErrorCode: null,
  };

  const record = buildAgentExecutionRecord(store, execution, "2024-01-01T00:01:00.000Z", updates);

  assert.equal(record.retryCount, 2);
});

test("buildAgentExecutionRecord clamps toolCallCount to zero minimum", () => {
  const store = createMockStore();
  const execution = {
    id: "exec-123",
    taskId: "task-456",
    workflowId: "wf-789",
    roleId: "role-001",
    runKind: "automatic" as const,
    startedAt: "2024-01-01T00:00:00.000Z",
    attempt: 1,
  };

  const updates = {
    agentId: "agent-abc",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "running",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: -10,
    progressMessage: null,
    lastErrorCode: null,
  };

  const record = buildAgentExecutionRecord(store, execution, "2024-01-01T00:01:00.000Z", updates);

  assert.equal(record.toolCallCount, 0);
});

test("buildAgentExecutionRecord merges with existing record preserving planJson", () => {
  const store = createMockStore({
    worker: {
      getAgentExecutionRecord: () => ({
        executionId: "exec-123",
        taskId: "task-456",
        agentId: "old-agent",
        workflowId: "wf-789",
        roleId: "role-001",
        runKind: "automatic" as const,
        runtimeInstanceId: "old-runtime",
        restartedFromRuntimeInstanceId: null,
        restartGeneration: 0,
        status: "running",
        planJson: '{"workflowId":"wf-789","roleId":"role-001","runKind":"automatic"}',
        currentStepId: null,
        lastToolName: null,
        toolCallCount: 0,
        lastDecisionJson: null,
        lastErrorCode: null,
        retryCount: 1,
        progressMessage: null,
        startedAt: "2024-01-01T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        completedAt: null,
      }),
    } as unknown as AuthoritativeTaskStore["worker"],
  });

  const execution = {
    id: "exec-123",
    taskId: "task-456",
    workflowId: "wf-789",
    roleId: "role-001",
    runKind: "automatic" as const,
    startedAt: "2024-01-01T00:00:00.000Z",
    attempt: 2,
  };

  const updates = {
    agentId: "new-agent",
    runtimeInstanceId: "new-runtime",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 1,
    status: "running",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: 0,
    progressMessage: null,
    lastErrorCode: null,
  };

  const record = buildAgentExecutionRecord(store, execution, "2024-01-01T00:02:00.000Z", updates);

  assert.equal(record.agentId, "new-agent");
  assert.equal(record.retryCount, 1);
  assert.ok(record.planJson.includes("wf-789"));
});

test("buildAgentExecutionRecord throws TypeError when updates is undefined", () => {
  const store = createMockStore();
  const execution = {
    id: "exec-123",
    taskId: "task-456",
    workflowId: "wf-789",
    roleId: "role-001",
    runKind: "automatic" as const,
    startedAt: "2024-01-01T00:00:00.000Z",
    attempt: 1,
  };

  assert.throws(() => {
    buildAgentExecutionRecord(store, execution, "2024-01-01T00:01:00.000Z", undefined as never);
  }, TypeError);
});

test("buildAgentExecutionRecord handles legacy signature with occurredAt as first string arg", () => {
  const store = createMockStore();
  const execution = {
    id: "exec-123",
    taskId: "task-456",
    workflowId: "wf-789",
    roleId: "role-001",
    runKind: "automatic" as const,
    startedAt: "2024-01-01T00:00:00.000Z",
    attempt: 1,
  };

  const updates = {
    agentId: "agent-abc",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "running",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: 0,
    progressMessage: null,
    lastErrorCode: null,
    startedAt: "2024-01-02T00:00:00.000Z",
    completedAt: null,
  };

  const record = buildAgentExecutionRecord(store, execution, "2024-01-01T00:01:00.000Z", updates);

  assert.equal(record.startedAt, "2024-01-02T00:00:00.000Z");
});

// ---------------------------------------------------------------------------
// persistRemoteLogs
// ---------------------------------------------------------------------------

test("persistRemoteLogs inserts log entries into store", () => {
  let insertedLog: { id: string; taskId: string; executionId: string; workerId: string; level: string; message: string } | null = null;

  const store = createMockStore({
    worker: {
      insertRemoteLog: (log: {
        id: string;
        taskId: string;
        executionId: string;
        workerId: string;
        runtimeInstanceId: string | null;
        level: "debug" | "info" | "warn" | "error";
        message: string;
        contextJson: string;
        createdAt: string;
      }) => {
        insertedLog = log as typeof insertedLog;
      },
    } as unknown as AuthoritativeTaskStore["worker"],
  });

  const logs: WorkerRemoteLogInput[] = [
    { level: "info", message: "Task started", occurredAt: "2024-01-01T00:00:00.000Z" },
  ];

  persistRemoteLogs(store, "task-123", "exec-456", "trace-789", "worker-001", "runtime-xyz", logs, "2024-01-01T00:00:00.000Z");

  assert.ok(insertedLog !== null);
  assert.equal(insertedLog!.taskId, "task-123");
  assert.equal(insertedLog!.executionId, "exec-456");
  assert.equal(insertedLog!.workerId, "worker-001");
  assert.equal(insertedLog!.level, "info");
  assert.equal(insertedLog!.message, "Task started");
});

test("persistRemoteLogs skips empty messages", () => {
  let insertCallCount = 0;

  const store = createMockStore({
    worker: {
      insertRemoteLog: () => {
        insertCallCount++;
      },
    } as unknown as AuthoritativeTaskStore["worker"],
  });

  const logs: WorkerRemoteLogInput[] = [
    { level: "info", message: "", occurredAt: "2024-01-01T00:00:00.000Z" },
    { level: "info", message: "valid message", occurredAt: "2024-01-01T00:00:01.000Z" },
  ];

  persistRemoteLogs(store, "task-123", "exec-456", "trace-789", "worker-001", null, logs, "2024-01-01T00:00:00.000Z");

  assert.equal(insertCallCount, 1);
});

test("persistRemoteLogs skips whitespace-only messages", () => {
  let insertCallCount = 0;

  const store = createMockStore({
    worker: {
      insertRemoteLog: () => {
        insertCallCount++;
      },
    } as unknown as AuthoritativeTaskStore["worker"],
  });

  const logs: WorkerRemoteLogInput[] = [
    { level: "info", message: "   ", occurredAt: "2024-01-01T00:00:00.000Z" },
    { level: "info", message: "valid", occurredAt: "2024-01-01T00:00:01.000Z" },
  ];

  persistRemoteLogs(store, "task-123", "exec-456", "trace-789", "worker-001", null, logs, "2024-01-01T00:00:00.000Z");

  assert.equal(insertCallCount, 1);
});

test("persistRemoteLogs handles undefined logs array", () => {
  let insertCallCount = 0;

  const store = createMockStore({
    worker: {
      insertRemoteLog: () => {
        insertCallCount++;
      },
    } as unknown as AuthoritativeTaskStore["worker"],
  });

  persistRemoteLogs(store, "task-123", "exec-456", "trace-789", "worker-001", null, undefined, "2024-01-01T00:00:00.000Z");

  assert.equal(insertCallCount, 0);
});

test("persistRemoteLogs includes context in contextJson", () => {
  let insertedLog: { contextJson: string } | null = null;

  const store = createMockStore({
    worker: {
      insertRemoteLog: (log: { id: string; taskId: string; executionId: string; workerId: string; runtimeInstanceId: string | null; level: "debug" | "info" | "warn" | "error"; message: string; contextJson: string; createdAt: string }) => {
        insertedLog = log as typeof insertedLog;
      },
    } as unknown as AuthoritativeTaskStore["worker"],
  });

  const logs: WorkerRemoteLogInput[] = [
    {
      level: "info",
      message: "Task started",
      context: { customField: "customValue", taskType: "automation" },
      occurredAt: "2024-01-01T00:00:00.000Z",
    },
  ];

  persistRemoteLogs(store, "task-123", "exec-456", "trace-789", "worker-001", "runtime-xyz", logs, "2024-01-01T00:00:00.000Z");

  assert.ok(insertedLog !== null);
  const context = JSON.parse(insertedLog!.contextJson);
  assert.equal(context.taskId, "task-123");
  assert.equal(context.executionId, "exec-456");
  assert.equal(context.workerId, "worker-001");
  assert.equal(context.traceId, "trace-789");
  assert.equal(context.customField, "customValue");
});

test("persistRemoteLogs includes runtimeInstanceId in context when provided", () => {
  let insertedLog: { contextJson: string } | null = null;

  const store = createMockStore({
    worker: {
      insertRemoteLog: (log: { id: string; taskId: string; executionId: string; workerId: string; runtimeInstanceId: string | null; level: "debug" | "info" | "warn" | "error"; message: string; contextJson: string; createdAt: string }) => {
        insertedLog = log as typeof insertedLog;
      },
    } as unknown as AuthoritativeTaskStore["worker"],
  });

  const logs: WorkerRemoteLogInput[] = [
    { level: "debug", message: "Debug info", occurredAt: "2024-01-01T00:00:00.000Z" },
  ];

  persistRemoteLogs(store, "task-123", "exec-456", "trace-789", "worker-001", "runtime-xyz", logs, "2024-01-01T00:00:00.000Z");

  assert.ok(insertedLog !== null);
  const context = JSON.parse(insertedLog!.contextJson);
  assert.equal(context.runtimeInstanceId, "runtime-xyz");
});

test("persistRemoteLogs uses defaultOccurredAt when entry has no occurredAt", () => {
  let insertedLog: { createdAt: string } | null = null;

  const store = createMockStore({
    worker: {
      insertRemoteLog: (log: { id: string; taskId: string; executionId: string; workerId: string; runtimeInstanceId: string | null; level: "debug" | "info" | "warn" | "error"; message: string; contextJson: string; createdAt: string }) => {
        insertedLog = log as typeof insertedLog;
      },
    } as unknown as AuthoritativeTaskStore["worker"],
  });

  const logs: WorkerRemoteLogInput[] = [
    { level: "warn", message: "Warning message" },
  ];

  persistRemoteLogs(store, "task-123", "exec-456", "trace-789", "worker-001", null, logs, "2024-01-01T00:00:00.000Z");

  assert.ok(insertedLog !== null);
  assert.equal(insertedLog!.createdAt, "2024-01-01T00:00:00.000Z");
});

test("persistRemoteLogs handles multiple log entries", () => {
  const insertedLogs: { level: string; message: string }[] = [];

  const store = createMockStore({
    worker: {
      insertRemoteLog: (log: { id: string; taskId: string; executionId: string; workerId: string; runtimeInstanceId: string | null; level: "debug" | "info" | "warn" | "error"; message: string; contextJson: string; createdAt: string }) => {
        insertedLogs.push({ level: log.level, message: log.message });
      },
    } as unknown as AuthoritativeTaskStore["worker"],
  });

  const logs: WorkerRemoteLogInput[] = [
    { level: "debug", message: "Debug message", occurredAt: "2024-01-01T00:00:00.000Z" },
    { level: "info", message: "Info message", occurredAt: "2024-01-01T00:00:01.000Z" },
    { level: "warn", message: "Warning message", occurredAt: "2024-01-01T00:00:02.000Z" },
    { level: "error", message: "Error message", occurredAt: "2024-01-01T00:00:03.000Z" },
  ];

  persistRemoteLogs(store, "task-123", "exec-456", "trace-789", "worker-001", null, logs, "2024-01-01T00:00:00.000Z");

  assert.equal(insertedLogs.length, 4);
  assert.equal(insertedLogs[0]!.level, "debug");
  assert.equal(insertedLogs[3]!.message, "Error message");
});