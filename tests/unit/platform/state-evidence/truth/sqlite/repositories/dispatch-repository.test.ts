import assert from "node:assert/strict";
import test from "node:test";
import { DispatchRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/dispatch-repository.js";

function createMockConn() {
  return {
    prepare: () => ({
      run: () => ({ changes: 1 }),
      get: () => undefined,
      all: () => [],
    }),
  };
}

test("DispatchRepository has all required methods", () => {
  const mockConn = createMockConn() as any;
  const repo = new DispatchRepository(mockConn);

  assert.equal(typeof repo.listExecutionsByStatuses, "function");
  assert.equal(typeof repo.getExecution, "function");
  assert.equal(typeof repo.getExecutionPrecheck, "function");
  assert.equal(typeof repo.getDeadLetterByExecutionId, "function");
  assert.equal(typeof repo.listDeadLettersByTask, "function");
  assert.equal(typeof repo.getSession, "function");
  assert.equal(typeof repo.selectLatestSessionByTask, "function");
  assert.equal(typeof repo.getGatewayTarget, "function");
  assert.equal(typeof repo.listGatewayTargets, "function");
  assert.equal(typeof repo.listMessagesBySession, "function");
  assert.equal(typeof repo.getWorkerSnapshot, "function");
});

test("DispatchRepository lists executions by statuses with empty array", () => {
  const mockConn = createMockConn() as any;
  const repo = new DispatchRepository(mockConn);

  const result = repo.listExecutionsByStatuses([]);
  assert.deepEqual(result, []);
});

test("DispatchRepository lists executions by statuses", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;
  const repo = new DispatchRepository(mockConn);

  const result = repo.listExecutionsByStatuses(["pending", "running"]);
  assert.ok(Array.isArray(result));
});

test("DispatchRepository gets execution", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => null,
      all: () => [],
    }),
  } as any;
  const repo = new DispatchRepository(mockConn);

  const result = repo.getExecution("nonexistent");
  assert.equal(result, null);
});

test("DispatchRepository gets execution with tenant scope", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => null,
      all: () => [],
    }),
  } as any;
  const repo = new DispatchRepository(mockConn);

  const result = repo.getExecution("exec_1", "tenant_1");
  assert.equal(result, null);
});

test("DispatchRepository gets execution precheck", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => null,
      all: () => [],
    }),
  } as any;
  const repo = new DispatchRepository(mockConn);

  const result = repo.getExecutionPrecheck("nonexistent");
  assert.equal(result, null);
});

test("DispatchRepository gets dead letter by execution id", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => null,
      all: () => [],
    }),
  } as any;
  const repo = new DispatchRepository(mockConn);

  const result = repo.getDeadLetterByExecutionId("nonexistent");
  assert.equal(result, null);
});

test("DispatchRepository lists dead letters by task", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;
  const repo = new DispatchRepository(mockConn);

  const result = repo.listDeadLettersByTask("task_1");
  assert.ok(Array.isArray(result));
});

test("DispatchRepository lists dead letters by task with tenant scope", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;
  const repo = new DispatchRepository(mockConn);

  const result = repo.listDeadLettersByTask("task_1", "tenant_1");
  assert.ok(Array.isArray(result));
});

test("DispatchRepository gets session", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => null,
      all: () => [],
    }),
  } as any;
  const repo = new DispatchRepository(mockConn);

  const result = repo.getSession("nonexistent");
  assert.equal(result, null);
});

test("DispatchRepository gets session with tenant scope", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => null,
      all: () => [],
    }),
  } as any;
  const repo = new DispatchRepository(mockConn);

  const result = repo.getSession("session_1", "tenant_1");
  assert.equal(result, null);
});

test("DispatchRepository selects latest session by task", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => null,
      all: () => [],
    }),
  } as any;
  const repo = new DispatchRepository(mockConn);

  const result = repo.selectLatestSessionByTask("task_1");
  assert.equal(result, null);
});

test("DispatchRepository gets gateway target", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => null,
      all: () => [],
    }),
  } as any;
  const repo = new DispatchRepository(mockConn);

  const result = repo.getGatewayTarget("nonexistent");
  assert.equal(result, null);
});

test("DispatchRepository lists gateway targets", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;
  const repo = new DispatchRepository(mockConn);

  const result = repo.listGatewayTargets();
  assert.ok(Array.isArray(result));
});

test("DispatchRepository lists gateway targets with channel filter", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;
  const repo = new DispatchRepository(mockConn);

  const result = repo.listGatewayTargets(100, "slack");
  assert.ok(Array.isArray(result));
});

test("DispatchRepository lists messages by session", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;
  const repo = new DispatchRepository(mockConn);

  const result = repo.listMessagesBySession("session_1");
  assert.ok(Array.isArray(result));
});

test("DispatchRepository lists messages by session with tenant scope", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;
  const repo = new DispatchRepository(mockConn);

  const result = repo.listMessagesBySession("session_1", "tenant_1");
  assert.ok(Array.isArray(result));
});

test("DispatchRepository gets worker snapshot", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => null,
      all: () => [],
    }),
  } as any;
  const repo = new DispatchRepository(mockConn);

  const result = repo.getWorkerSnapshot("worker_1");
  assert.equal(result, null);
});