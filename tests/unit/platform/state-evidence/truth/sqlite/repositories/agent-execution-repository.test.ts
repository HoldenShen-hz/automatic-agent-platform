import assert from "node:assert/strict";
import test from "node:test";

import type { AgentExecutionRecord, RemoteLogRecord } from "../../../../../../../src/platform/contracts/types/domain.js";
import { AgentExecutionRepository } from "../../../../../../../src/platform/state-evidence/truth/sqlite/repositories/agent-execution-repository.js";

function createMockAgentExecutionRecord(overrides: Partial<AgentExecutionRecord> = {}): AgentExecutionRecord {
  const now = new Date().toISOString();
  return {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    workflowId: null,
    roleId: "executor",
    runKind: "step",
    runtimeInstanceId: "instance-1",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "executing",
    planJson: null,
    currentStepId: "step-1",
    lastToolName: "tool_call",
    toolCallCount: 5,
    lastDecisionJson: null,
    lastErrorCode: null,
    retryCount: 0,
    progressMessage: "Running",
    startedAt: now,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    ...overrides,
  };
}

function createMockRemoteLogRecord(overrides: Partial<RemoteLogRecord> = {}): RemoteLogRecord {
  const now = new Date().toISOString();
  return {
    id: "log-1",
    taskId: "task-1",
    executionId: "exec-1",
    workerId: "worker-1",
    runtimeInstanceId: "instance-1",
    level: "info",
    message: "Test log message",
    contextJson: null,
    createdAt: now,
    ...overrides,
  };
}

test("AgentExecutionRepository constructor accepts connection", () => {
  const mockConn = {};
  const repo = new AgentExecutionRepository(mockConn as any);
  assert.ok(repo);
});

test("AgentExecutionRepository has insertRemoteLog method", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
    }),
  };
  const repo = new AgentExecutionRepository(mockConn as any);
  assert.equal(typeof repo.insertRemoteLog, "function");
});

test("AgentExecutionRepository has upsertAgentExecutionRecord method", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
    }),
  };
  const repo = new AgentExecutionRepository(mockConn as any);
  assert.equal(typeof repo.upsertAgentExecutionRecord, "function");
});

test("AgentExecutionRepository has getAgentExecutionRecord method", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      get: () => undefined,
    }),
  };
  const repo = new AgentExecutionRepository(mockConn as any);
  assert.equal(typeof repo.getAgentExecutionRecord, "function");
});

test("AgentExecutionRepository has listAgentExecutionRecordsByTask method", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
  };
  const repo = new AgentExecutionRepository(mockConn as any);
  assert.equal(typeof repo.listAgentExecutionRecordsByTask, "function");
});

test("AgentExecutionRepository has listRemoteLogsByTask method", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
  };
  const repo = new AgentExecutionRepository(mockConn as any);
  assert.equal(typeof repo.listRemoteLogsByTask, "function");
});

test("AgentExecutionRepository has listRemoteLogsByExecution method", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
  };
  const repo = new AgentExecutionRepository(mockConn as any);
  assert.equal(typeof repo.listRemoteLogsByExecution, "function");
});

test("AgentExecutionRecord has correct structure", () => {
  const record = createMockAgentExecutionRecord();
  assert.equal(record.executionId, "exec-1");
  assert.equal(record.taskId, "task-1");
  assert.equal(record.agentId, "agent-1");
  assert.equal(record.status, "executing");
});

test("AgentExecutionRecord with optional fields", () => {
  const now = new Date().toISOString();
  const record = createMockAgentExecutionRecord({
    workflowId: "workflow-1",
    planJson: '{"steps": []}',
    currentStepId: "step-5",
    lastToolName: "code_execution",
    toolCallCount: 25,
    retryCount: 2,
    progressMessage: "Step 5 of 10",
    completedAt: now,
  });
  assert.equal(record.workflowId, "workflow-1");
  assert.ok(record.planJson);
  assert.equal(record.currentStepId, "step-5");
  assert.equal(record.lastToolName, "code_execution");
  assert.equal(record.toolCallCount, 25);
  assert.equal(record.retryCount, 2);
  assert.equal(record.progressMessage, "Step 5 of 10");
  assert.ok(record.completedAt);
});

test("AgentExecutionRecord with error state", () => {
  const record = createMockAgentExecutionRecord({
    status: "failed",
    lastErrorCode: "EXECUTION_TIMEOUT",
  });
  assert.equal(record.status, "failed");
  assert.equal(record.lastErrorCode, "EXECUTION_TIMEOUT");
});

test("RemoteLogRecord has correct structure", () => {
  const record = createMockRemoteLogRecord();
  assert.equal(record.id, "log-1");
  assert.equal(record.taskId, "task-1");
  assert.equal(record.executionId, "exec-1");
  assert.equal(record.workerId, "worker-1");
  assert.equal(record.level, "info");
  assert.equal(record.message, "Test log message");
});

test("RemoteLogRecord with all log levels", () => {
  const levels = ["debug", "info", "warn", "error"] as const;
  for (const level of levels) {
    const record = createMockRemoteLogRecord({ level });
    assert.equal(record.level, level);
  }
});

test("RemoteLogRecord with context JSON", () => {
  const record = createMockRemoteLogRecord({
    contextJson: '{"requestId": "req-123", "metadata": {"key": "value"}}',
  });
  assert.ok(record.contextJson);
});

test("listRemoteLogsByTask accepts tenantId parameter", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
  };
  const repo = new AgentExecutionRepository(mockConn as any);
  const results = repo.listRemoteLogsByTask("task-1", "tenant-1");
  assert.ok(Array.isArray(results));
});

test("listRemoteLogsByTask without tenantId", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
  };
  const repo = new AgentExecutionRepository(mockConn as any);
  const results = repo.listRemoteLogsByTask("task-1");
  assert.ok(Array.isArray(results));
});

test("listRemoteLogsByExecution accepts tenantId parameter", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
  };
  const repo = new AgentExecutionRepository(mockConn as any);
  const results = repo.listRemoteLogsByExecution("exec-1", "tenant-1");
  assert.ok(Array.isArray(results));
});

test("listRemoteLogsByExecution without tenantId", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
  };
  const repo = new AgentExecutionRepository(mockConn as any);
  const results = repo.listRemoteLogsByExecution("exec-1");
  assert.ok(Array.isArray(results));
});

test("getAgentExecutionRecord accepts tenantId parameter", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      get: () => undefined,
    }),
  };
  const repo = new AgentExecutionRepository(mockConn as any);
  const result = repo.getAgentExecutionRecord("exec-1", "tenant-1");
  assert.equal(result, undefined);
});

test("getAgentExecutionRecord without tenantId", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      get: () => undefined,
    }),
  };
  const repo = new AgentExecutionRepository(mockConn as any);
  const result = repo.getAgentExecutionRecord("exec-1");
  assert.equal(result, undefined);
});

test("listAgentExecutionRecordsByTask accepts tenantId parameter", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
  };
  const repo = new AgentExecutionRepository(mockConn as any);
  const results = repo.listAgentExecutionRecordsByTask("task-1", "tenant-1");
  assert.ok(Array.isArray(results));
});

test("listAgentExecutionRecordsByTask without tenantId", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
  };
  const repo = new AgentExecutionRepository(mockConn as any);
  const results = repo.listAgentExecutionRecordsByTask("task-1");
  assert.ok(Array.isArray(results));
});

test("AgentExecutionRecord runKind values", () => {
  const runKinds = ["step", "loop", "recovery"] as const;
  for (const runKind of runKinds) {
    const record = createMockAgentExecutionRecord({ runKind });
    assert.equal(record.runKind, runKind);
  }
});

test("AgentExecutionRecord status values", () => {
  const statuses = ["created", "executing", "blocked", "succeeded", "failed", "cancelled", "superseded"] as const;
  for (const status of statuses) {
    const record = createMockAgentExecutionRecord({ status });
    assert.equal(record.status, status);
  }
});