import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { LockRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/lock-repository.js";
import { TaskRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/task-repository.js";
import { ExecutionRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/execution-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import type { FileLockRecord } from "../../../../../../src/platform/contracts/types/domain.js";

function createTestTask(db: SqliteDatabase, taskId: string, tenantId: string | null, now: string): void {
  const taskRepo = new TaskRepository(db.connection);
  taskRepo.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general-ops",
    tenantId,
    title: "Test task",
    status: "in_progress",
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });
}

test("LockRepository listActiveFileLocksForResource returns non-expired locks", () => {
  const workspace = createTempWorkspace("aa-lock-repo-");
  const dbPath = join(workspace, "lock-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new LockRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const future = "2026-04-14T12:00:00.000Z";
    const past = "2026-04-14T08:00:00.000Z";

    // Create tasks first (required by foreign key)
    createTestTask(db, "task-1", null, now);
    createTestTask(db, "task-2", null, now);

    // Insert expired lock
    db.connection.exec(`
      INSERT INTO file_locks (id, task_id, execution_id, lock_scope, resource_path, lock_mode, owner_id, expires_at, created_at, updated_at)
      VALUES ('lock-expired', 'task-1', NULL, 'task', '/path/expired.txt', 'exclusive', 'worker-1', '${past}', '${past}', '${past}')
    `);

    // Insert active lock
    db.connection.exec(`
      INSERT INTO file_locks (id, task_id, execution_id, lock_scope, resource_path, lock_mode, owner_id, expires_at, created_at, updated_at)
      VALUES ('lock-active', 'task-2', NULL, 'task', '/path/active.txt', 'exclusive', 'worker-2', '${future}', '${now}', '${now}')
    `);

    const activeLocks = repo.listActiveFileLocksForResource("/path/active.txt", now);

    assert.equal(activeLocks.length, 1);
    assert.equal(activeLocks[0]!.id, "lock-active");
    assert.equal(activeLocks[0]!.resourcePath, "/path/active.txt");
    assert.equal(activeLocks[0]!.lockMode, "exclusive");
  } finally {
    cleanupPath(workspace);
  }
});

test("LockRepository insertFileLock persists a new lock", () => {
  const workspace = createTempWorkspace("aa-lock-repo-");
  const dbPath = join(workspace, "lock-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new LockRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const future = "2026-04-14T12:00:00.000Z";
    createTestTask(db, "task-lock-insert", null, now);

    repo.insertFileLock({
      id: "lock-insert-001",
      taskId: "task-lock-insert",
      executionId: null,
      lockScope: "task",
      resourcePath: "/path/insert.txt",
      lockMode: "exclusive",
      ownerId: "worker-insert",
      expiresAt: future,
      createdAt: now,
      updatedAt: now,
    });

    const locks = repo.listFileLocksByTask("task-lock-insert");
    assert.equal(locks.length, 1);
    assert.equal(locks[0]?.id, "lock-insert-001");
  } finally {
    cleanupPath(workspace);
  }
});

test("LockRepository listActiveFileLocksForResource excludes expired locks", () => {
  const workspace = createTempWorkspace("aa-lock-repo-");
  const dbPath = join(workspace, "lock-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new LockRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const past = "2026-04-14T08:00:00.000Z";

    createTestTask(db, "task-1", null, now);

    db.connection.exec(`
      INSERT INTO file_locks (id, task_id, execution_id, lock_scope, resource_path, lock_mode, owner_id, expires_at, created_at, updated_at)
      VALUES ('lock-expired', 'task-1', NULL, 'task', '/path/file.txt', 'exclusive', 'worker-1', '${past}', '${past}', '${past}')
    `);

    const activeLocks = repo.listActiveFileLocksForResource("/path/file.txt", now);

    assert.equal(activeLocks.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("LockRepository listExpiredFileLocks returns only expired locks", () => {
  const workspace = createTempWorkspace("aa-lock-repo-");
  const dbPath = join(workspace, "lock-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new LockRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const future = "2026-04-14T12:00:00.000Z";
    const past = "2026-04-14T08:00:00.000Z";

    createTestTask(db, "task-1", null, now);
    createTestTask(db, "task-2", null, now);

    db.connection.exec(`
      INSERT INTO file_locks (id, task_id, execution_id, lock_scope, resource_path, lock_mode, owner_id, expires_at, created_at, updated_at)
      VALUES ('lock-active', 'task-1', NULL, 'task', '/path/active.txt', 'exclusive', 'worker-1', '${future}', '${now}', '${now}')
    `);
    db.connection.exec(`
      INSERT INTO file_locks (id, task_id, execution_id, lock_scope, resource_path, lock_mode, owner_id, expires_at, created_at, updated_at)
      VALUES ('lock-expired', 'task-2', NULL, 'task', '/path/expired.txt', 'exclusive', 'worker-2', '${past}', '${past}', '${past}')
    `);

    const expiredLocks = repo.listExpiredFileLocks(now);

    assert.equal(expiredLocks.length, 1);
    assert.equal(expiredLocks[0]!.id, "lock-expired");
  } finally {
    cleanupPath(workspace);
  }
});

test("LockRepository listFileLocks returns all locks regardless of expiry", () => {
  const workspace = createTempWorkspace("aa-lock-repo-");
  const dbPath = join(workspace, "lock-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new LockRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const future = "2026-04-14T12:00:00.000Z";
    const past = "2026-04-14T08:00:00.000Z";

    createTestTask(db, "task-1", null, now);
    createTestTask(db, "task-2", null, now);

    db.connection.exec(`
      INSERT INTO file_locks (id, task_id, execution_id, lock_scope, resource_path, lock_mode, owner_id, expires_at, created_at, updated_at)
      VALUES ('lock-1', 'task-1', NULL, 'task', '/path/file1.txt', 'exclusive', 'worker-1', '${future}', '${past}', '${past}')
    `);
    db.connection.exec(`
      INSERT INTO file_locks (id, task_id, execution_id, lock_scope, resource_path, lock_mode, owner_id, expires_at, created_at, updated_at)
      VALUES ('lock-2', 'task-2', NULL, 'task', '/path/file2.txt', 'shared', 'worker-2', '${past}', '${past}', '${past}')
    `);

    const allLocks = repo.listFileLocks();

    assert.equal(allLocks.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("LockRepository listFileLocksByTask returns locks for specific task", () => {
  const workspace = createTempWorkspace("aa-lock-repo-");
  const dbPath = join(workspace, "lock-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new LockRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const future = "2026-04-14T12:00:00.000Z";

    createTestTask(db, "task-target", null, now);
    createTestTask(db, "task-other", null, now);

    db.connection.exec(`
      INSERT INTO file_locks (id, task_id, execution_id, lock_scope, resource_path, lock_mode, owner_id, expires_at, created_at, updated_at)
      VALUES ('lock-task1', 'task-target', NULL, 'task', '/path/file1.txt', 'exclusive', 'worker-1', '${future}', '${now}', '${now}')
    `);
    db.connection.exec(`
      INSERT INTO file_locks (id, task_id, execution_id, lock_scope, resource_path, lock_mode, owner_id, expires_at, created_at, updated_at)
      VALUES ('lock-task2', 'task-target', NULL, 'task', '/path/file2.txt', 'shared', 'worker-2', '${future}', '${now}', '${now}')
    `);
    db.connection.exec(`
      INSERT INTO file_locks (id, task_id, execution_id, lock_scope, resource_path, lock_mode, owner_id, expires_at, created_at, updated_at)
      VALUES ('lock-other', 'task-other', NULL, 'task', '/path/file3.txt', 'exclusive', 'worker-3', '${future}', '${now}', '${now}')
    `);

    const taskLocks = repo.listFileLocksByTask("task-target");

    assert.equal(taskLocks.length, 2);
    assert.ok(taskLocks.every((l) => l.taskId === "task-target"));
  } finally {
    cleanupPath(workspace);
  }
});

test("LockRepository listFileLocksByTask returns empty for non-existent task", () => {
  const workspace = createTempWorkspace("aa-lock-repo-");
  const dbPath = join(workspace, "lock-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new LockRepository(db.connection);

    const locks = repo.listFileLocksByTask("non-existent-task");
    assert.equal(locks.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("LockRepository deleteFileLock removes lock", () => {
  const workspace = createTempWorkspace("aa-lock-repo-");
  const dbPath = join(workspace, "lock-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new LockRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const future = "2026-04-14T12:00:00.000Z";

    createTestTask(db, "task-1", null, now);

    db.connection.exec(`
      INSERT INTO file_locks (id, task_id, execution_id, lock_scope, resource_path, lock_mode, owner_id, expires_at, created_at, updated_at)
      VALUES ('lock-to-delete', 'task-1', NULL, 'task', '/path/file.txt', 'exclusive', 'worker-1', '${future}', '${now}', '${now}')
    `);

    let allLocks = repo.listFileLocks();
    assert.equal(allLocks.length, 1);

    repo.deleteFileLock("lock-to-delete");

    allLocks = repo.listFileLocks();
    assert.equal(allLocks.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("LockRepository listFileLocks returns locks in creation order", () => {
  const workspace = createTempWorkspace("aa-lock-repo-");
  const dbPath = join(workspace, "lock-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new LockRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const future = "2026-04-14T12:00:00.000Z";

    createTestTask(db, "task-a", null, now);
    createTestTask(db, "task-b", null, now);
    createTestTask(db, "task-c", null, now);

    // Insert in non-order
    db.connection.exec(`
      INSERT INTO file_locks (id, task_id, execution_id, lock_scope, resource_path, lock_mode, owner_id, expires_at, created_at, updated_at)
      VALUES ('lock-c', 'task-c', NULL, 'task', '/path/c.txt', 'exclusive', 'worker-c', '${future}', '2026-04-14T10:03:00.000Z', '2026-04-14T10:03:00.000Z')
    `);
    db.connection.exec(`
      INSERT INTO file_locks (id, task_id, execution_id, lock_scope, resource_path, lock_mode, owner_id, expires_at, created_at, updated_at)
      VALUES ('lock-a', 'task-a', NULL, 'task', '/path/a.txt', 'exclusive', 'worker-a', '${future}', '2026-04-14T10:01:00.000Z', '2026-04-14T10:01:00.000Z')
    `);
    db.connection.exec(`
      INSERT INTO file_locks (id, task_id, execution_id, lock_scope, resource_path, lock_mode, owner_id, expires_at, created_at, updated_at)
      VALUES ('lock-b', 'task-b', NULL, 'task', '/path/b.txt', 'exclusive', 'worker-b', '${future}', '2026-04-14T10:02:00.000Z', '2026-04-14T10:02:00.000Z')
    `);

    const locks = repo.listFileLocks();

    assert.equal(locks.length, 3);
    assert.equal(locks[0]!.id, "lock-a");
    assert.equal(locks[1]!.id, "lock-b");
    assert.equal(locks[2]!.id, "lock-c");
  } finally {
    cleanupPath(workspace);
  }
});

test("LockRepository with tenant isolation returns only tenant's locks", () => {
  const workspace = createTempWorkspace("aa-lock-repo-");
  const dbPath = join(workspace, "lock-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new LockRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const future = "2026-04-14T12:00:00.000Z";

    // Create tasks with different tenant IDs
    createTestTask(db, "task-tenant-a", "tenant-a", now);
    createTestTask(db, "task-tenant-b", "tenant-b", now);

    db.connection.exec(`
      INSERT INTO file_locks (id, task_id, execution_id, lock_scope, resource_path, lock_mode, owner_id, expires_at, created_at, updated_at)
      VALUES ('lock-a', 'task-tenant-a', NULL, 'task', '/path/file.txt', 'exclusive', 'worker-a', '${future}', '${now}', '${now}')
    `);
    db.connection.exec(`
      INSERT INTO file_locks (id, task_id, execution_id, lock_scope, resource_path, lock_mode, owner_id, expires_at, created_at, updated_at)
      VALUES ('lock-b', 'task-tenant-b', NULL, 'task', '/path/file.txt', 'exclusive', 'worker-b', '${future}', '${now}', '${now}')
    `);

    // Without tenant filter - should return all
    const allLocks = repo.listFileLocksByTask("task-tenant-a");
    assert.equal(allLocks.length, 1);

    // With tenant filter - should only return matching tenant's locks
    const tenantALocks = repo.listFileLocksByTask("task-tenant-a", "tenant-a");
    const tenantBLocks = repo.listFileLocksByTask("task-tenant-b", "tenant-b");

    assert.equal(tenantALocks.length, 1);
    assert.equal(tenantALocks[0]!.taskId, "task-tenant-a");
    assert.equal(tenantBLocks.length, 1);
    assert.equal(tenantBLocks[0]!.taskId, "task-tenant-b");
  } finally {
    cleanupPath(workspace);
  }
});
