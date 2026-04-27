import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("AuthoritativeTaskStore can be instantiated with SqliteDatabase", () => {
  const workspace = createTempWorkspace("aa-truth-store-test-");
  const dbPath = join(workspace, "truth-store.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    assert.ok(store instanceof AuthoritativeTaskStore);
    assert.ok(store.repositories);
    assert.equal(typeof store.repositories, "function");
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStore repositories returns repository accessors", () => {
  const workspace = createTempWorkspace("aa-truth-store-repos-test-");
  const dbPath = join(workspace, "truth-store-repos.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repositories = store.repositories();

    // Verify all expected repository accessors exist
    assert.ok(repositories.task);
    assert.ok(repositories.workflow);
    assert.ok(repositories.execution);
    assert.ok(repositories.session);
    assert.ok(repositories.event);
    assert.ok(repositories.worker);
    assert.ok(repositories.approval);
    assert.ok(repositories.billing);
    assert.ok(repositories.lease);
    assert.ok(repositories.lock);
    assert.ok(repositories.memory);
    assert.ok(repositories.artifact);
    assert.ok(repositories.dispatch);
    assert.ok(repositories.division);
    assert.ok(repositories.secret);
    assert.ok(repositories.marketplace);
    assert.ok(repositories.release);
    assert.ok(repositories.organization);
    assert.ok(repositories.intelligence);
    assert.ok(repositories.evolution);
    assert.ok(repositories.governance);
    assert.ok(repositories.operations);
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStore repositories returns the same instance on multiple calls", () => {
  const workspace = createTempWorkspace("aa-truth-store-cached-");
  const dbPath = join(workspace, "truth-store-cached.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repositories1 = store.repositories();
    const repositories2 = store.repositories();

    assert.equal(repositories1, repositories2);
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStore governance and operations are the same repository", () => {
  const workspace = createTempWorkspace("aa-truth-store-ops-");
  const dbPath = join(workspace, "truth-store-ops.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repositories = store.repositories();

    assert.equal(repositories.governance, repositories.operations);
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStore delegates billing methods correctly", () => {
  const workspace = createTempWorkspace("aa-truth-store-billing-");
  const dbPath = join(workspace, "truth-store-billing.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Verify billing delegation methods exist
    assert.equal(typeof store.countActiveExecutionsByTenant, "function");
    assert.equal(typeof store.listRecentExecutionsByTenant, "function");
    assert.equal(typeof store.countQueuedTasksByTenant, "function");
    assert.equal(typeof store.listQueuedTasksByTenant, "function");
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStore delegates session methods correctly", () => {
  const workspace = createTempWorkspace("aa-truth-store-session-");
  const dbPath = join(workspace, "truth-store-session.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Verify session delegation methods exist
    assert.equal(typeof store.listSessionsByTask, "function");
    assert.equal(typeof store.listGatewayTargetsByChannel, "function");
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStore task repository is accessible", () => {
  const workspace = createTempWorkspace("aa-truth-store-task-");
  const dbPath = join(workspace, "truth-store-task.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repositories = store.repositories();

    // Verify task repository exists and has expected methods
    assert.ok(repositories.task);
    assert.equal(typeof repositories.task.listTasks, "function");
    assert.equal(typeof repositories.task.getTask, "function");
    assert.equal(typeof repositories.task.insertTask, "function");
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStore workflow repository is accessible", () => {
  const workspace = createTempWorkspace("aa-truth-store-workflow-");
  const dbPath = join(workspace, "truth-store-workflow.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repositories = store.repositories();

    // Verify workflow repository exists
    assert.ok(repositories.workflow);
    assert.equal(typeof repositories.workflow.listWorkflowStates, "function");
    assert.equal(typeof repositories.workflow.getWorkflowState, "function");
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStore execution repository is accessible", () => {
  const workspace = createTempWorkspace("aa-truth-store-execution-");
  const dbPath = join(workspace, "truth-store-execution.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repositories = store.repositories();

    // Verify execution repository exists
    assert.ok(repositories.execution);
    assert.equal(typeof repositories.execution.listExecutionsByTask, "function");
    assert.equal(typeof repositories.execution.getExecution, "function");
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStore with mocked database maintains interface contract", () => {
  // Create a mock that satisfies the database interface
  const mockConnection = {
    exec: () => undefined,
    prepare: () => ({
      bind: () => ({
        first: () => null,
        all: () => [],
        run: () => ({ changes: 0, lastInsertRowid: BigInt(0) }),
      }),
    }),
  };
  const mockDb = {
    filePath: ":memory:",
    backendType: "sqlite",
    connection: mockConnection,
    prepare: mockConnection.prepare,
    transaction: (fn: () => void) => fn(),
    readTransaction: (fn: () => void) => fn(),
    migrate: () => {},
    getSchemaStatus: () => ({ currentVersion: 0, expectedVersion: 0, upToDate: true, pendingVersions: [], checksumMismatches: [] }),
    assertSchemaCurrent: () => {},
    integrityCheck: () => [],
    healthCheck: async () => true,
  } as unknown as SqliteDatabase;

  const store = new AuthoritativeTaskStore(mockDb);

  assert.ok(store instanceof AuthoritativeTaskStore);
  assert.equal(typeof store.repositories, "function");

  // Should not throw when getting repositories
  const repositories = store.repositories();
  assert.ok(repositories);
});

test("AuthoritativeTaskStore Phase1aStore alias works correctly", () => {
  const workspace = createTempWorkspace("aa-phase1a-store-");
  const dbPath = join(workspace, "phase1a-store.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    // Phase1aStore is an alias for AuthoritativeTaskStore
    const Phase1aStore = AuthoritativeTaskStore;
    const store = new Phase1aStore(db);

    assert.ok(store instanceof AuthoritativeTaskStore);
    assert.equal(typeof store.repositories, "function");
  } finally {
    cleanupPath(workspace);
  }
});
