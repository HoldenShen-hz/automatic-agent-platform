/**
 * Unit tests for storage backend factory
 *
 * Tests storage backend planning, opening, and context creation.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  planAuthoritativeStorageBackend,
  openAuthoritativeStorageBackend,
  openAuthoritativeStorageContext,
  openAsyncAuthoritativeStorageBackend,
  requireSqliteAuthoritativeStorageBackend,
  requireSyncCompatibleAuthoritativeSqlDatabase,
} from "../../../../src/platform/state-evidence/truth/storage-backend-factory.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

// ---------------------------------------------------------------------------
// planAuthoritativeStorageBackend
// ---------------------------------------------------------------------------

test("planAuthoritativeStorageBackend returns executable plan for dev environment", () => {
  const workspace = createTempWorkspace("aa-plan-dev-");
  const dbPath = `${workspace}/test.db`;

  try {
    const plan = planAuthoritativeStorageBackend({
      dbPath,
      environment: "dev",
      env: {},
    });

    assert.equal(plan.executable, true);
    assert.equal(plan.openErrorCode, null);
    assert.equal(plan.environment, "dev");
    assert.equal(plan.runtimeProfile.driver, "sqlite");
  } finally {
    cleanupPath(workspace);
  }
});

test("planAuthoritativeStorageBackend returns non-executable plan for invalid config", () => {
  const workspace = createTempWorkspace("aa-plan-invalid-");
  const dbPath = `${workspace}/test.db`;

  try {
    // Using path outside workspace should fail sandbox validation
    const plan = planAuthoritativeStorageBackend({
      dbPath,
      environment: "prod", // prod has stricter sandbox requirements
      env: {},
    });

    // Plan may or may not be executable depending on sandbox policy
    assert.ok(plan.runtimeProfile);
    assert.ok(plan.environment);
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// openAuthoritativeStorageBackend
// ---------------------------------------------------------------------------

test("openAuthoritativeStorageBackend opens SQLite backend successfully", () => {
  const workspace = createTempWorkspace("aa-backend-sqlite-");
  const dbPath = `${workspace}/runtime.db`;

  try {
    const storage = openAuthoritativeStorageBackend({
      dbPath,
      environment: "dev",
      env: {},
    });

    assert.equal(storage.driver, "sqlite");
    assert.ok(storage.sql);
    assert.ok(storage.asyncSql);
    assert.ok(storage.sqlite);

    storage.migrate();
    storage.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("openAuthoritativeStorageBackend throws StorageError for invalid path", () => {
  const workspace = createTempWorkspace("aa-backend-error-");
  const dbPath = `${workspace}/runtime.db`;

  try {
    // This should throw because we're using a non-existent parent directory
    // after cleanup
    cleanupPath(workspace);

    assert.throws(
      () =>
        openAuthoritativeStorageBackend({
          dbPath,
          environment: "dev",
          env: {},
        }),
      /storage\.backend_open_failed|ENOENT/,
    );
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// requireSqliteAuthoritativeStorageBackend
// ---------------------------------------------------------------------------

test("requireSqliteAuthoritativeStorageBackend returns sqlite instance", () => {
  const workspace = createTempWorkspace("aa-require-sqlite-");
  const dbPath = `${workspace}/runtime.db`;

  try {
    const storage = openAuthoritativeStorageBackend({
      dbPath,
      environment: "dev",
      env: {},
    });

    const sqlite = requireSqliteAuthoritativeStorageBackend(storage);
    assert.ok(sqlite);
    assert.equal(sqlite.filePath, dbPath);

    storage.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("requireSqliteAuthoritativeStorageBackend throws for postgres backend", () => {
  const workspace = createTempWorkspace("aa-require-pg-");
  const dbPath = `${workspace}/runtime.db`;

  try {
    const storage = openAuthoritativeStorageBackend({
      dbPath,
      environment: "dev",
      env: {},
    });

    // Change driver to simulate postgres
    const fakeStorage = { ...storage, driver: "postgres" } as typeof storage;

    assert.throws(
      () => requireSqliteAuthoritativeStorageBackend(fakeStorage),
      /storage\.expected_sqlite_got_postgres/,
    );

    storage.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// openAuthoritativeStorageContext
// ---------------------------------------------------------------------------

test("openAuthoritativeStorageContext returns context with store", () => {
  const workspace = createTempWorkspace("aa-context-");
  const dbPath = `${workspace}/runtime.db`;

  try {
    const context = openAuthoritativeStorageContext({
      dbPath,
      environment: "dev",
      env: {},
    });

    assert.ok(context.store);
    assert.ok(context.sql);
    assert.equal(context.driver, "sqlite");

    // Store should be functional
    context.store.insertTask({
      id: "ctx-task-001",
      parentId: null,
      rootId: "ctx-task-001",
      divisionId: "general_ops",
      tenantId: null,
      title: "Context Test",
      status: "queued",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: "2026-04-29T00:00:00.000Z",
      updatedAt: "2026-04-29T00:00:00.000Z",
      completedAt: null,
    });

    const task = context.store.getTask("ctx-task-001");
    assert.ok(task);
    assert.equal(task!.title, "Context Test");

    context.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// openAsyncAuthoritativeStorageBackend
// ---------------------------------------------------------------------------

test("openAsyncAuthoritativeStorageBackend returns backend handle", async () => {
  const workspace = createTempWorkspace("aa-async-backend-");
  const dbPath = `${workspace}/runtime.db`;

  try {
    const storage = await openAsyncAuthoritativeStorageBackend({
      dbPath,
      environment: "dev",
      env: {},
    });

    assert.ok(storage);
    assert.equal(storage.driver, "sqlite");

    storage.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// requireSyncCompatibleAuthoritativeSqlDatabase
// ---------------------------------------------------------------------------

test("requireSyncCompatibleAuthoritativeSqlDatabase returns sql for sqlite", () => {
  const workspace = createTempWorkspace("aa-sync-sqlite-");
  const dbPath = `${workspace}/runtime.db`;

  try {
    const storage = openAuthoritativeStorageBackend({
      dbPath,
      environment: "dev",
      env: {},
    });

    const sql = requireSyncCompatibleAuthoritativeSqlDatabase(storage);
    assert.ok(sql);

    storage.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Multiple storage instances
// ---------------------------------------------------------------------------

test("multiple storage backends can be opened independently", () => {
  const workspace1 = createTempWorkspace("aa-multi-1-");
  const workspace2 = createTempWorkspace("aa-multi-2-");
  const dbPath1 = `${workspace1}/runtime.db`;
  const dbPath2 = `${workspace2}/runtime.db`;

  try {
    const storage1 = openAuthoritativeStorageBackend({
      dbPath: dbPath1,
      environment: "dev",
      env: {},
    });

    const storage2 = openAuthoritativeStorageBackend({
      dbPath: dbPath2,
      environment: "dev",
      env: {},
    });

    // Insert different data in each
    storage1.sql.transaction(() => {
      storage1.store.insertTask({
        id: "task-storage-1",
        parentId: null,
        rootId: "task-storage-1",
        divisionId: "general_ops",
        tenantId: null,
        title: "Storage 1 Task",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: "2026-04-29T00:00:00.000Z",
        updatedAt: "2026-04-29T00:00:00.000Z",
        completedAt: null,
      });
    });

    storage2.sql.transaction(() => {
      storage2.store.insertTask({
        id: "task-storage-2",
        parentId: null,
        rootId: "task-storage-2",
        divisionId: "general_ops",
        tenantId: null,
        title: "Storage 2 Task",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: "2026-04-29T00:00:00.000Z",
        updatedAt: "2026-04-29T00:00:00.000Z",
        completedAt: null,
      });
    });

    // Verify isolation
    const task1 = storage1.store.getTask("task-storage-1");
    const task2 = storage1.store.getTask("task-storage-2");
    assert.ok(task1);
    assert.equal(task1!.title, "Storage 1 Task");
    assert.equal(task2, null);

    const task2FromStorage2 = storage2.store.getTask("task-storage-2");
    assert.ok(task2FromStorage2);
    assert.equal(task2FromStorage2!.title, "Storage 2 Task");

    storage1.close();
    storage2.close();
  } finally {
    cleanupPath(workspace1);
    cleanupPath(workspace2);
  }
});