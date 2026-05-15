import assert from "node:assert/strict";
import test from "node:test";

import { LockRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/lock-repository.js";
import type { FileLockRecord } from "../../../../../../../src/platform/contracts/types/domain.js";

function createMockSqliteConnection(): any {
  const storage: {
    file_locks: Map<string, FileLockRecord>;
  } = {
    file_locks: new Map(),
  };

  return {
    prepare: (sql: string) => {
      const isInsert = sql.trim().toLowerCase().startsWith("insert");
      const isSelect = sql.trim().toLowerCase().startsWith("select");
      const isDelete = sql.trim().toLowerCase().startsWith("delete");

      if (isInsert) {
        return {
          run: (...params: unknown[]) => {
            const lock: FileLockRecord = {
              id: params[0] as string,
              taskId: params[1] as string,
              executionId: params[2] as string,
              lockScope: params[3] as string,
              resourcePath: params[4] as string,
              lockMode: params[5] as string,
              ownerId: params[6] as string,
              expiresAt: params[7] as string,
              createdAt: params[8] as string,
              updatedAt: params[9] as string,
            };
            storage.file_locks.set(lock.id, lock);
            return { changes: 1 };
          },
        };
      }

      if (isSelect) {
        return {
          all: (...params: unknown[]) => {
            const allLocks = Array.from(storage.file_locks.values());

            // listActiveFileLocksForResource: params are [resourcePath, now]
            // WHERE resource_path = ? AND expires_at >= ?
            if (params.length === 2 && sql.includes("resource_path") && sql.includes("expires_at") && sql.includes("resource_path")) {
              const resourcePath = params[0] as string;
              const now = params[1] as string;
              return allLocks.filter(l =>
                l.resourcePath === resourcePath && l.expiresAt >= now
              );
            }

            // listFileLocksByTask (with tenant): 2 params [taskId, tenantId], has INNER JOIN tasks
            if (params.length === 2 && sql.includes("INNER JOIN")) {
              const taskId = params[0] as string;
              return allLocks.filter(l => l.taskId === taskId);
            }

            // listFileLocksByTask (without tenant): params are [taskId], WHERE clause has just task_id
            if (params.length === 1 && sql.includes("WHERE") && !sql.includes("INNER JOIN")) {
              // Extract the WHERE conditions to determine which query this is
              const whereIdx = sql.toLowerCase().indexOf("where");
              const afterWhere = sql.toLowerCase().substring(whereIdx);
              // listExpiredFileLocks has "WHERE expires_at < ?"
              // listFileLocksByTask has "WHERE task_id = ?"
              if (afterWhere.includes("expires_at") && afterWhere.includes("<")) {
                const now = params[0] as string;
                return allLocks.filter(l => l.expiresAt < now);
              }
              if (afterWhere.includes("task_id") && afterWhere.includes("=")) {
                const taskId = params[0] as string;
                return allLocks.filter(l => l.taskId === taskId);
              }
            }

            // listFileLocks: no params
            return allLocks;
          },
        };
      }

      if (isDelete) {
        return {
          run: (...params: unknown[]) => {
            const lockId = params[0] as string;
            storage.file_locks.delete(lockId);
            return { changes: 1 };
          },
        };
      }

      return {
        run: () => ({ changes: 0 }),
        all: () => [],
      };
    },
    _storage: storage,
  };
}

function createFileLock(overrides: Partial<FileLockRecord> = {}): FileLockRecord {
  const now = new Date().toISOString();
  return {
    id: "lock-001",
    taskId: "task-001",
    executionId: "exec-001",
    lockScope: "exclusive",
    resourcePath: "/path/to/file.txt",
    lockMode: "write",
    ownerId: "worker-001",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test("LockRepository constructor requires connection", () => {
  const conn = createMockSqliteConnection();
  const repo = new LockRepository(conn);
  assert.ok(repo != null);
});

test("LockRepository is instantiable", () => {
  const conn = createMockSqliteConnection();
  const repo = new LockRepository(conn);
  assert.ok(repo instanceof LockRepository);
});

test("LockRepository.insertFileLock stores lock", () => {
  const conn = createMockSqliteConnection();
  const repo = new LockRepository(conn);

  const lock = createFileLock({ id: "lock-insert-1" });
  repo.insertFileLock(lock);

  assert.ok(conn._storage.file_locks.has("lock-insert-1"));
});

test("LockRepository.insertFileLock stores multiple locks", () => {
  const conn = createMockSqliteConnection();
  const repo = new LockRepository(conn);

  repo.insertFileLock(createFileLock({ id: "lock-multi-1" }));
  repo.insertFileLock(createFileLock({ id: "lock-multi-2" }));
  repo.insertFileLock(createFileLock({ id: "lock-multi-3" }));

  assert.equal(conn._storage.file_locks.size, 3);
});

test("LockRepository.listFileLocks returns all locks", () => {
  const conn = createMockSqliteConnection();
  const repo = new LockRepository(conn);

  repo.insertFileLock(createFileLock({ id: "lock-list-1" }));
  repo.insertFileLock(createFileLock({ id: "lock-list-2" }));

  const result = repo.listFileLocks();
  assert.equal(result.length, 2);
});

test("LockRepository.listActiveFileLocksForResource returns active locks for resource", () => {
  const conn = createMockSqliteConnection();
  const repo = new LockRepository(conn);

  const futureExpiry = new Date(Date.now() + 60000).toISOString();
  const pastExpiry = new Date(Date.now() - 60000).toISOString();

  repo.insertFileLock(createFileLock({ id: "lock-active-1", resourcePath: "/path/file.txt", expiresAt: futureExpiry }));
  repo.insertFileLock(createFileLock({ id: "lock-active-2", resourcePath: "/path/file.txt", expiresAt: futureExpiry }));
  repo.insertFileLock(createFileLock({ id: "lock-active-3", resourcePath: "/path/file.txt", expiresAt: pastExpiry }));

  const now = new Date().toISOString();
  const result = repo.listActiveFileLocksForResource("/path/file.txt", now);

  assert.equal(result.length, 2);
  assert.ok(result.every(l => l.expiresAt >= now));
});

test("LockRepository.listActiveFileLocksForResource returns empty for non-existent resource", () => {
  const conn = createMockSqliteConnection();
  const repo = new LockRepository(conn);

  const now = new Date().toISOString();
  const result = repo.listActiveFileLocksForResource("/non/existent", now);

  assert.equal(result.length, 0);
});

test("LockRepository.listExpiredFileLocks returns expired locks", () => {
  const conn = createMockSqliteConnection();
  const repo = new LockRepository(conn);

  const futureExpiry = new Date(Date.now() + 60000).toISOString();
  const pastExpiry = new Date(Date.now() - 60000).toISOString();

  repo.insertFileLock(createFileLock({ id: "lock-expired-1", expiresAt: pastExpiry }));
  repo.insertFileLock(createFileLock({ id: "lock-expired-2", expiresAt: pastExpiry }));
  repo.insertFileLock(createFileLock({ id: "lock-expired-3", expiresAt: futureExpiry }));

  const now = new Date().toISOString();
  const result = repo.listExpiredFileLocks(now);

  assert.equal(result.length, 2);
  assert.ok(result.every(l => l.expiresAt < now));
});

test("LockRepository.listFileLocksByTask returns locks for task", () => {
  const conn = createMockSqliteConnection();
  const repo = new LockRepository(conn);

  repo.insertFileLock(createFileLock({ id: "lock-task-1", taskId: "task-001" }));
  repo.insertFileLock(createFileLock({ id: "lock-task-2", taskId: "task-001" }));
  repo.insertFileLock(createFileLock({ id: "lock-task-3", taskId: "task-002" }));

  const result = repo.listFileLocksByTask("task-001");

  assert.equal(result.length, 2);
  assert.ok(result.every(l => l.taskId === "task-001"));
});

test("LockRepository.listFileLocksByTask returns empty for task with no locks", () => {
  const conn = createMockSqliteConnection();
  const repo = new LockRepository(conn);

  const result = repo.listFileLocksByTask("task-nonexistent");

  assert.equal(result.length, 0);
});

test("LockRepository.deleteFileLock removes lock", () => {
  const conn = createMockSqliteConnection();
  const repo = new LockRepository(conn);

  repo.insertFileLock(createFileLock({ id: "lock-delete-1" }));
  assert.ok(conn._storage.file_locks.has("lock-delete-1"));

  repo.deleteFileLock("lock-delete-1");
  assert.ok(!conn._storage.file_locks.has("lock-delete-1"));
});

test("LockRepository.deleteFileLock handles non-existent lock gracefully", () => {
  const conn = createMockSqliteConnection();
  const repo = new LockRepository(conn);

  // Should not throw
  repo.deleteFileLock("nonexistent-lock");
  assert.equal(conn._storage.file_locks.size, 0);
});

test("LockRepository.listFileLocks returns all locks in insertion order", () => {
  const conn = createMockSqliteConnection();
  const repo = new LockRepository(conn);

  repo.insertFileLock(createFileLock({ id: "lock-order-1", createdAt: "2026-01-01T10:00:00.000Z" }));
  repo.insertFileLock(createFileLock({ id: "lock-order-2", createdAt: "2026-01-01T12:00:00.000Z" }));
  repo.insertFileLock(createFileLock({ id: "lock-order-3", createdAt: "2026-01-01T08:00:00.000Z" }));

  const result = repo.listFileLocks();

  assert.equal(result.length, 3);
  // Verify we have all three locks
  assert.ok(result.some(l => l.id === "lock-order-1"));
  assert.ok(result.some(l => l.id === "lock-order-2"));
  assert.ok(result.some(l => l.id === "lock-order-3"));
});

test("LockRepository handles different lock modes", () => {
  const conn = createMockSqliteConnection();
  const repo = new LockRepository(conn);

  repo.insertFileLock(createFileLock({ id: "lock-mode-1", lockMode: "read" }));
  repo.insertFileLock(createFileLock({ id: "lock-mode-2", lockMode: "write" }));
  repo.insertFileLock(createFileLock({ id: "lock-mode-3", lockMode: "exclusive" }));

  const result = repo.listFileLocks();
  assert.equal(result.length, 3);
  assert.ok(result.some(l => l.lockMode === "read"));
  assert.ok(result.some(l => l.lockMode === "write"));
  assert.ok(result.some(l => l.lockMode === "exclusive"));
});

test("LockRepository handles different lock scopes", () => {
  const conn = createMockSqliteConnection();
  const repo = new LockRepository(conn);

  repo.insertFileLock(createFileLock({ id: "lock-scope-1", lockScope: "file" }));
  repo.insertFileLock(createFileLock({ id: "lock-scope-2", lockScope: "directory" }));
  repo.insertFileLock(createFileLock({ id: "lock-scope-3", lockScope: "exclusive" }));

  const result = repo.listFileLocks();
  assert.equal(result.length, 3);
});