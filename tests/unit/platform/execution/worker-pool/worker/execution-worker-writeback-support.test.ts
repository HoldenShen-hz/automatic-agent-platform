import assert from "node:assert/strict";
import test from "node:test";

import {
  parseJsonArray,
  removeExecutionId,
  buildAgentExecutionRecord,
  persistRemoteLogs,
} from "../../../../../../src/platform/execution/worker-pool/worker/execution-worker-writeback-support.js";
import type { AuthoritativeTaskStore } from "../../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { WorkerRemoteLogInput } from "../../../../../../src/platform/execution/worker-pool/execution-worker-writeback-service.js";

// ---------------------------------------------------------------------------
// parseJsonArray - additional edge cases
// ---------------------------------------------------------------------------

test("parseJsonArray handles JSON array with escaped characters", () => {
  const result = parseJsonArray('["a\\"b", "c\\nd"]');
  assert.deepEqual(result, ["a\"b", "c\nd"]);
});

test("parseJsonArray handles nested JSON arrays", () => {
  const result = parseJsonArray('[["inner"], "outer"]');
  assert.deepEqual(result, ["outer"]);
});

test("parseJsonArray handles unicode characters", () => {
  const result = parseJsonArray('["hello", "你好", "🎉"]');
  assert.deepEqual(result, ["hello", "你好", "🎉"]);
});

test("parseJsonArray handles whitespace-only strings", () => {
  const result = parseJsonArray('["  ", "a"]');
  // Whitespace-only strings are kept (they are valid strings)
  assert.ok(result.includes("  "));
});

test("parseJsonArray handles JSON number strings", () => {
  const result = parseJsonArray('["123", "456"]');
  assert.deepEqual(result, ["123", "456"]);
});

// ---------------------------------------------------------------------------
// removeExecutionId - additional edge cases
// ---------------------------------------------------------------------------

test("removeExecutionId handles empty array", () => {
  const result = removeExecutionId([], "exec-1");
  assert.deepEqual(result, []);
});

test("removeExecutionId handles single matching element", () => {
  const result = removeExecutionId(["exec-1"], "exec-1");
  assert.deepEqual(result, []);
});

test("removeExecutionId handles single non-matching element", () => {
  const result = removeExecutionId(["exec-1"], "exec-2");
  assert.deepEqual(result, ["exec-1"]);
});

test("removeExecutionId removes all occurrences (duplicates)", () => {
  const result = removeExecutionId(["exec-1", "exec-2", "exec-1"], "exec-1");
  // Should remove all exec-1, leaving only exec-2
  assert.deepEqual(result, ["exec-2"]);
});

test("removeExecutionId returns sorted result even for single element", () => {
  const result = removeExecutionId(["z", "a", "m"], "a");
  assert.deepEqual(result, ["m", "z"]);
});

test("removeExecutionId handles large arrays", () => {
  const largeArray = Array.from({ length: 1000 }, (_, i) => `exec-${i}`);
  const result = removeExecutionId(largeArray, "exec-500");
  assert.equal(result.length, 999);
  assert.ok(!result.includes("exec-500"));
});

// ---------------------------------------------------------------------------
// buildAgentExecutionRecord
// ---------------------------------------------------------------------------

function createMockStoreWithExecution(): {
  store: AuthoritativeTaskStore;
  execution: { id: string; taskId: string; workflowId: string; roleId: string; runKind: string; attempt: number; startedAt: string | null };
} {
  const execution = {
    id: "exec-123",
    taskId: "task-456",
    workflowId: "wf-789",
    roleId: "role-test",
    runKind: "task_run",
    attempt: 2,
    startedAt: "2024-01-01T00:00:00.000Z",
  };

  const store = {
    worker: {
      getAgentExecutionRecord: (_executionId: string) => null,
      upsertAgentExecutionRecord: (_record: any) => {},
    },
  } as unknown as AuthoritativeTaskStore;

  return { store, execution };
}

test("buildAgentExecutionRecord creates record with correct base fields", () => {
  const { store, execution } = createMockStoreWithExecution();

  const result = buildAgentExecutionRecord(store, execution, "exec-123", "2024-01-02T00:00:00.000Z", {
    agentId: "agent-001",
    runtimeInstanceId: "runtime-001",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "executing",
    currentStepId: "step-1",
    lastToolName: "bash",
    toolCallCount: 10,
    progressMessage: "Running task",
    lastErrorCode: null,
    completedAt: null,
  });

  assert.equal(result.executionId, "exec-123");
  assert.equal(result.taskId, "task-456");
  assert.equal(result.agentId, "agent-001");
  assert.equal(result.workflowId, "wf-789");
  assert.equal(result.runKind, "task_run");
});

test("buildAgentExecutionRecord uses existing planJson when available", () => {
  const execution = {
    id: "exec-123",
    taskId: "task-456",
    workflowId: "wf-789",
    roleId: "role-test",
    runKind: "task_run",
    attempt: 2,
    startedAt: null,
  };

  const existingRecord = {
    executionId: "exec-123",
    agentId: "existing-agent",
    planJson: '{"custom":"plan"}',
  };

  const store = {
    worker: {
      getAgentExecutionRecord: (_id: string) => existingRecord,
      upsertAgentExecutionRecord: () => {},
    },
  } as unknown as AuthoritativeTaskStore;

  const result = buildAgentExecutionRecord(store, execution, "exec-123", "2024-01-02T00:00:00.000Z", {
    agentId: "new-agent",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "executing",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: 0,
    progressMessage: null,
    lastErrorCode: null,
    completedAt: null,
  });

  assert.equal(result.planJson, '{"custom":"plan"}');
});

test("buildAgentExecutionRecord computes retryCount from execution attempt", () => {
  const { store, execution } = createMockStoreWithExecution();

  const result = buildAgentExecutionRecord(store, execution, "exec-123", "2024-01-02T00:00:00.000Z", {
    agentId: "agent-001",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "executing",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: 0,
    progressMessage: null,
    lastErrorCode: null,
    completedAt: null,
  });

  // attempt is 2, so retryCount should be max(2-1, 0) = 1
  assert.equal(result.retryCount, 1);
});

test("buildAgentExecutionRecord uses existing retryCount when higher", () => {
  const execution = {
    id: "exec-123",
    taskId: "task-456",
    workflowId: "wf-789",
    roleId: "role-test",
    runKind: "task_run",
    attempt: 1,
    startedAt: null,
  };

  const existingRecord = {
    executionId: "exec-123",
    agentId: "existing-agent",
    retryCount: 5,
  };

  const store = {
    worker: {
      getAgentExecutionRecord: (_id: string) => existingRecord,
      upsertAgentExecutionRecord: () => {},
    },
  } as unknown as AuthoritativeTaskStore;

  const result = buildAgentExecutionRecord(store, execution, "exec-123", "2024-01-02T00:00:00.000Z", {
    agentId: "new-agent",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "executing",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: 0,
    progressMessage: null,
    lastErrorCode: null,
    completedAt: null,
  });

  // Existing retryCount (5) is higher than computed (0), so use existing
  assert.equal(result.retryCount, 5);
});

test("buildAgentExecutionRecord sets startedAt from execution when existing has none", () => {
  const execution = {
    id: "exec-123",
    taskId: "task-456",
    workflowId: "wf-789",
    roleId: "role-test",
    runKind: "task_run",
    attempt: 1,
    startedAt: "2024-01-01T00:00:00.000Z",
  };

  const store = {
    worker: {
      getAgentExecutionRecord: () => null,
      upsertAgentExecutionRecord: () => {},
    },
  } as unknown as AuthoritativeTaskStore;

  const result = buildAgentExecutionRecord(store, execution, "exec-123", "2024-01-02T00:00:00.000Z", {
    agentId: "agent-001",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "executing",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: 0,
    progressMessage: null,
    lastErrorCode: null,
    completedAt: null,
  });

  assert.equal(result.startedAt, "2024-01-01T00:00:00.000Z");
});

test("buildAgentExecutionRecord clamps toolCallCount to non-negative", () => {
  const { store, execution } = createMockStoreWithExecution();

  const result = buildAgentExecutionRecord(store, execution, "exec-123", "2024-01-02T00:00:00.000Z", {
    agentId: "agent-001",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "executing",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: -5,
    progressMessage: null,
    lastErrorCode: null,
    completedAt: null,
  });

  assert.equal(result.toolCallCount, 0);
});

// ---------------------------------------------------------------------------
// persistRemoteLogs
// ---------------------------------------------------------------------------

test("persistRemoteLogs skips empty messages", () => {
  const logs: WorkerRemoteLogInput[] = [
    { level: "info", message: "" },
    { level: "warn", message: "  " },
  ];

  const insertedLogs: any[] = [];
  const store = {
    worker: {
      insertRemoteLog: (log: any) => insertedLogs.push(log),
    },
  } as unknown as AuthoritativeTaskStore;

  persistRemoteLogs(store, "task-1", "exec-1", "trace-1", "worker-1", null, logs, "2024-01-01T00:00:00.000Z");

  assert.equal(insertedLogs.length, 0);
});

test("persistRemoteLogs inserts valid log entries", () => {
  const logs: WorkerRemoteLogInput[] = [
    { level: "info", message: "Hello world", context: { key: "value" } },
  ];

  const insertedLogs: any[] = [];
  const store = {
    worker: {
      insertRemoteLog: (log: any) => insertedLogs.push(log),
    },
  } as unknown as AuthoritativeTaskStore;

  persistRemoteLogs(store, "task-1", "exec-1", "trace-1", "worker-1", "runtime-1", logs, "2024-01-01T00:00:00.000Z");

  assert.equal(insertedLogs.length, 1);
  assert.equal(insertedLogs[0].message, "Hello world");
  assert.equal(insertedLogs[0].level, "info");
  assert.equal(insertedLogs[0].taskId, "task-1");
  assert.equal(insertedLogs[0].executionId, "exec-1");
  assert.equal(insertedLogs[0].workerId, "worker-1");
});

test("persistRemoteLogs uses custom occurredAt when provided", () => {
  const logs: WorkerRemoteLogInput[] = [
    { level: "error", message: "Error occurred", occurredAt: "2024-06-01T12:00:00.000Z" },
  ];

  const insertedLogs: any[] = [];
  const store = {
    worker: {
      insertRemoteLog: (log: any) => insertedLogs.push(log),
    },
  } as unknown as AuthoritativeTaskStore;

  persistRemoteLogs(store, "task-1", "exec-1", "trace-1", "worker-1", null, logs, "2024-01-01T00:00:00.000Z");

  assert.equal(insertedLogs[0].createdAt, "2024-06-01T12:00:00.000Z");
});

test("persistRemoteLogs uses default occurredAt when not provided", () => {
  const logs: WorkerRemoteLogInput[] = [
    { level: "info", message: "Log message" },
  ];

  const insertedLogs: any[] = [];
  const store = {
    worker: {
      insertRemoteLog: (log: any) => insertedLogs.push(log),
    },
  } as unknown as AuthoritativeTaskStore;

  persistRemoteLogs(store, "task-1", "exec-1", "trace-1", "worker-1", null, logs, "2024-01-02T00:00:00.000Z");

  assert.equal(insertedLogs[0].createdAt, "2024-01-02T00:00:00.000Z");
});

test("persistRemoteLogs handles undefined logs array", () => {
  const insertedLogs: any[] = [];
  const store = {
    worker: {
      insertRemoteLog: (log: any) => insertedLogs.push(log),
    },
  } as unknown as AuthoritativeTaskStore;

  persistRemoteLogs(store, "task-1", "exec-1", "trace-1", "worker-1", null, undefined, "2024-01-01T00:00:00.000Z");

  assert.equal(insertedLogs.length, 0);
});

test("persistRemoteLogs includes runtimeInstanceId in context when present", () => {
  const logs: WorkerRemoteLogInput[] = [
    { level: "debug", message: "Debug info" },
  ];

  const insertedLogs: any[] = [];
  const store = {
    worker: {
      insertRemoteLog: (log: any) => insertedLogs.push(log),
    },
  } as unknown as AuthoritativeTaskStore;

  persistRemoteLogs(store, "task-1", "exec-1", "trace-1", "worker-1", "runtime-xyz", logs, "2024-01-01T00:00:00.000Z");

  const context = JSON.parse(insertedLogs[0].contextJson);
  assert.equal(context.runtimeInstanceId, "runtime-xyz");
});

test("persistRemoteLogs includes correlationId in context", () => {
  const logs: WorkerRemoteLogInput[] = [
    { level: "info", message: "Test log" },
  ];

  const insertedLogs: any[] = [];
  const store = {
    worker: {
      insertRemoteLog: (log: any) => insertedLogs.push(log),
    },
  } as unknown as AuthoritativeTaskStore;

  persistRemoteLogs(store, "task-123", "exec-456", "trace-789", "worker-1", null, logs, "2024-01-01T00:00:00.000Z");

  const context = JSON.parse(insertedLogs[0].contextJson);
  assert.equal(context.correlationId, "task-123");
});
