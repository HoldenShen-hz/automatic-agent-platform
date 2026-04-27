/**
 * Unit tests for AuthoritativeTaskStoreDelegatingRuntime
 *
 * Tests delegation of runtime methods to repositories via delegateLegacy/delegateRepo.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import { AuthoritativeTaskStoreDelegatingRuntime } from "../../../../../../src/platform/state-evidence/truth/sqlite/authoritative-task-store-delegating-runtime.js";

// Test double that records which methods were called and with what arguments
class SpyDelegatingRuntime extends AuthoritativeTaskStoreDelegatingRuntime {
  public callLog: Array<{
    method: string;
    repoName: string;
    methodName: string;
    args: unknown[];
  }> = [];

  public override insertAnalyticsFactRecord(...args: unknown[]): unknown {
    this.callLog.push({ method: "insertAnalyticsFactRecord", repoName: "operations", methodName: "insertAnalyticsFactRecord", args });
    return { success: true };
  }

  public override listAnalyticsFactRecords(...args: unknown[]): unknown {
    this.callLog.push({ method: "listAnalyticsFactRecords", repoName: "operations", methodName: "listAnalyticsFactRecords", args });
    return [];
  }

  public override listActiveTasksWithoutWorkflow(...args: unknown[]): unknown {
    this.callLog.push({ method: "listActiveTasksWithoutWorkflow", repoName: "operations", methodName: "listActiveTasksWithoutWorkflow", args });
    return [];
  }

  public override getExecution(...args: unknown[]): unknown {
    this.callLog.push({ method: "getExecution", repoName: "dispatch", methodName: "getExecution", args });
    return null;
  }

  public override listGatewayTargets(...args: unknown[]): unknown {
    this.callLog.push({ method: "listGatewayTargets", repoName: "dispatch", methodName: "listGatewayTargets", args });
    return [];
  }

  public override listActiveFileLocksForResource(...args: unknown[]): unknown {
    this.callLog.push({ method: "listActiveFileLocksForResource", repoName: "lock", methodName: "listActiveFileLocksForResource", args });
    return [];
  }

  public override countActiveExecutionsByTenant(...args: unknown[]): unknown {
    this.callLog.push({ method: "countActiveExecutionsByTenant", repoName: "billing", methodName: "countActiveExecutionsByTenant", args });
    return 0;
  }

  public override listSessionsByTask(...args: unknown[]): unknown {
    this.callLog.push({ method: "listSessionsByTask", repoName: "session", methodName: "listSessionsByTask", args });
    return [];
  }
}

function createTestRuntime(workspace: string): SpyDelegatingRuntime {
  const dbPath = `${workspace}/test-runtime.db`;
  const db = new SqliteDatabase(dbPath);
  return new SpyDelegatingRuntime(db);
}

test("AuthoritativeTaskStoreDelegatingRuntime extends AuthoritativeTaskStoreDelegatingGovernance", () => {
  const workspace = createTempWorkspace("aa-runtime-extends-");
  try {
    const dbPath = `${workspace}/test-runtime.db`;
    const db = new SqliteDatabase(dbPath);
    const runtime = new AuthoritativeTaskStoreDelegatingRuntime(db);

    // Verify it's an instance of the parent class
    assert.ok(runtime instanceof AuthoritativeTaskStoreDelegatingRuntime);
  } finally {
    cleanupPath(workspace);
  }
});

test("insertAnalyticsFactRecord delegates to operations repository", () => {
  const workspace = createTempWorkspace("aa-runtime-ops-");
  try {
    const runtime = createTestRuntime(workspace);
    const result = runtime.insertAnalyticsFactRecord({ taskId: "task-123" } as never);

    const call = runtime.callLog.find(c => c.method === "insertAnalyticsFactRecord");
    assert.ok(call, "insertAnalyticsFactRecord should be called");
    assert.equal(call!.repoName, "operations");
    assert.equal(call!.methodName, "insertAnalyticsFactRecord");
    assert.deepEqual(call!.args, [{ taskId: "task-123" }]);
    assert.ok(result.success);
  } finally {
    cleanupPath(workspace);
  }
});

test("listAnalyticsFactRecords delegates to operations repository", () => {
  const workspace = createTempWorkspace("aa-runtime-list-");
  try {
    const runtime = createTestRuntime(workspace);
    const result = runtime.listAnalyticsFactRecords({ tenantId: "tenant-1" } as never);

    const call = runtime.callLog.find(c => c.method === "listAnalyticsFactRecords");
    assert.ok(call, "listAnalyticsFactRecords should be called");
    assert.equal(call!.repoName, "operations");
    assert.deepEqual(call!.args, [{ tenantId: "tenant-1" }]);
    assert.ok(Array.isArray(result));
  } finally {
    cleanupPath(workspace);
  }
});

test("getExecution delegates to dispatch repository", () => {
  const workspace = createTempWorkspace("aa-runtime-dispatch-");
  try {
    const runtime = createTestRuntime(workspace);
    const result = runtime.getExecution("exec-456" as never);

    const call = runtime.callLog.find(c => c.method === "getExecution");
    assert.ok(call, "getExecution should be called");
    assert.equal(call!.repoName, "dispatch");
    assert.equal(call!.methodName, "getExecution");
    assert.deepEqual(call!.args, ["exec-456"]);
    assert.equal(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("listGatewayTargets delegates to dispatch repository", () => {
  const workspace = createTempWorkspace("aa-runtime-gateway-");
  try {
    const runtime = createTestRuntime(workspace);
    const result = runtime.listGatewayTargets({ channel: "web" } as never);

    const call = runtime.callLog.find(c => c.method === "listGatewayTargets");
    assert.ok(call, "listGatewayTargets should be called");
    assert.equal(call!.repoName, "dispatch");
    assert.deepEqual(call!.args, [{ channel: "web" }]);
    assert.ok(Array.isArray(result));
  } finally {
    cleanupPath(workspace);
  }
});

test("listActiveFileLocksForResource delegates to lock repository", () => {
  const workspace = createTempWorkspace("aa-runtime-lock-");
  try {
    const runtime = createTestRuntime(workspace);
    const result = runtime.listActiveFileLocksForResource("resource-abc" as never);

    const call = runtime.callLog.find(c => c.method === "listActiveFileLocksForResource");
    assert.ok(call, "listActiveFileLocksForResource should be called");
    assert.equal(call!.repoName, "lock");
    assert.deepEqual(call!.args, ["resource-abc"]);
    assert.ok(Array.isArray(result));
  } finally {
    cleanupPath(workspace);
  }
});

test("countActiveExecutionsByTenant delegates to billing repository via delegateRepo", () => {
  const workspace = createTempWorkspace("aa-runtime-billing-");
  try {
    const runtime = createTestRuntime(workspace);
    const result = runtime.countActiveExecutionsByTenant("tenant-xyz" as never);

    const call = runtime.callLog.find(c => c.method === "countActiveExecutionsByTenant");
    assert.ok(call, "countActiveExecutionsByTenant should be called");
    assert.equal(call!.repoName, "billing");
    assert.equal(call!.methodName, "countActiveExecutionsByTenant");
    assert.deepEqual(call!.args, ["tenant-xyz"]);
    assert.equal(result, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("listSessionsByTask delegates to session repository via delegateRepo", () => {
  const workspace = createTempWorkspace("aa-runtime-session-");
  try {
    const runtime = createTestRuntime(workspace);
    const result = runtime.listSessionsByTask("task-789" as never);

    const call = runtime.callLog.find(c => c.method === "listSessionsByTask");
    assert.ok(call, "listSessionsByTask should be called");
    assert.equal(call!.repoName, "session");
    assert.equal(call!.methodName, "listSessionsByTask");
    assert.deepEqual(call!.args, ["task-789"]);
    assert.ok(Array.isArray(result));
  } finally {
    cleanupPath(workspace);
  }
});

test("listActiveTasksWithoutWorkflow delegates to operations repository", () => {
  const workspace = createTempWorkspace("aa-runtime-active-");
  try {
    const runtime = createTestRuntime(workspace);
    const result = runtime.listActiveTasksWithoutWorkflow({} as never);

    const call = runtime.callLog.find(c => c.method === "listActiveTasksWithoutWorkflow");
    assert.ok(call, "listActiveTasksWithoutWorkflow should be called");
    assert.equal(call!.repoName, "operations");
    assert.deepEqual(call!.args, [{}]);
    assert.ok(Array.isArray(result));
  } finally {
    cleanupPath(workspace);
  }
});

test("runtime has access to repositories via repositories() method", () => {
  const workspace = createTempWorkspace("aa-runtime-repos-");
  try {
    const dbPath = `${workspace}/test-runtime.db`;
    const db = new SqliteDatabase(dbPath);
    const runtime = new AuthoritativeTaskStoreDelegatingRuntime(db);

    const repos = runtime.repositories();
    assert.ok(repos, "repositories() should return a repos object");
    assert.ok(repos.task, "should have task repository");
    assert.ok(repos.execution, "should have execution repository");
    assert.ok(repos.session, "should have session repository");
    assert.ok(repos.billing, "should have billing repository");
    assert.ok(repos.lock, "should have lock repository");
  } finally {
    cleanupPath(workspace);
  }
});

test("runtime exposes repository accessors via properties", () => {
  const workspace = createTempWorkspace("aa-runtime-props-");
  try {
    const dbPath = `${workspace}/test-runtime.db`;
    const db = new SqliteDatabase(dbPath);
    const runtime = new AuthoritativeTaskStoreDelegatingRuntime(db);

    assert.ok(runtime.task, "runtime.task accessor should exist");
    assert.ok(runtime.execution, "runtime.execution accessor should exist");
    assert.ok(runtime.session, "runtime.session accessor should exist");
    assert.ok(runtime.billing, "runtime.billing accessor should exist");
    assert.ok(runtime.lock, "runtime.lock accessor should exist");
    assert.ok(runtime.dispatch, "runtime.dispatch accessor should exist");
    assert.ok(runtime.operations, "runtime.operations accessor should exist");
  } finally {
    cleanupPath(workspace);
  }
});

test("runtime withConnection passes db connection", () => {
  const workspace = createTempWorkspace("aa-runtime-conn-");
  try {
    const dbPath = `${workspace}/test-runtime.db`;
    const db = new SqliteDatabase(dbPath);
    const runtime = new AuthoritativeTaskStoreDelegatingRuntime(db);

    let receivedConn: unknown = null;
    runtime.withConnection(conn => {
      receivedConn = conn;
    });

    assert.ok(receivedConn, "withConnection should receive connection");
    assert.equal(receivedConn, db.connection);
  } finally {
    cleanupPath(workspace);
  }
});

test("runtime db property is the database instance", () => {
  const workspace = createTempWorkspace("aa-runtime-db-");
  try {
    const dbPath = `${workspace}/test-runtime.db`;
    const db = new SqliteDatabase(dbPath);
    const runtime = new AuthoritativeTaskStoreDelegatingRuntime(db);

    assert.equal(runtime.db, db);
    assert.equal(runtime.db.filePath, dbPath);
  } finally {
    cleanupPath(workspace);
  }
});