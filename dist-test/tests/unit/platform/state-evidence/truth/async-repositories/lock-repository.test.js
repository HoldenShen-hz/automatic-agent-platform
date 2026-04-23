import assert from "node:assert/strict";
import test from "node:test";
import { AsyncLockRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/lock-repository.js";
function createConnection(options = {}) {
    const calls = [];
    let queryIndex = 0;
    let queryOneIndex = 0;
    let executeIndex = 0;
    const connection = {
        async query(sql, ...params) {
            calls.push({ method: "query", sql, params });
            const rows = (options.queryRows?.[queryIndex++] ?? []);
            return { rows, rowCount: rows.length, changes: rows.length };
        },
        async queryOne(sql, ...params) {
            calls.push({ method: "queryOne", sql, params });
            return options.queryOneRows?.[queryOneIndex++];
        },
        async execute(sql, ...params) {
            calls.push({ method: "execute", sql, params });
            return options.executeResults?.[executeIndex++] ?? 1;
        },
    };
    return { connection, calls };
}
const now = "2026-04-23T10:00:00.000Z";
function fileLockRecord(overrides = {}) {
    return {
        id: "lock-1",
        taskId: "task-1",
        executionId: "exec-1",
        lockScope: "file",
        resourcePath: "/path/to/file.txt",
        lockMode: "shared",
        ownerId: "agent-1",
        expiresAt: "2026-04-23T12:00:00.000Z",
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}
test("AsyncLockRepository insertFileLock inserts lock record", async () => {
    const lock = fileLockRecord();
    const { connection, calls } = createConnection({ executeResults: [1] });
    const repo = new AsyncLockRepository(connection);
    await repo.insertFileLock(lock);
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /INSERT INTO file_locks/);
    assert.match(calls[0].sql, /id, task_id, execution_id/);
});
test("AsyncLockRepository listActiveFileLocksForResource returns active locks", async () => {
    const lock = fileLockRecord();
    const { connection, calls } = createConnection({ queryRows: [[lock]] });
    const repo = new AsyncLockRepository(connection);
    const result = await repo.listActiveFileLocksForResource("/path/to/file.txt", now);
    assert.deepEqual(result, [lock]);
    assert.match(calls[0].sql, /FROM file_locks/);
    assert.match(calls[0].sql, /resource_path = \$1/);
    assert.match(calls[0].sql, /expires_at >= \$2/);
    assert.match(calls[0].sql, /ORDER BY created_at ASC/);
});
test("AsyncLockRepository listExpiredFileLocks returns expired locks", async () => {
    const lock = fileLockRecord();
    const { connection, calls } = createConnection({ queryRows: [[lock]] });
    const repo = new AsyncLockRepository(connection);
    const result = await repo.listExpiredFileLocks(now);
    assert.deepEqual(result, [lock]);
    assert.match(calls[0].sql, /FROM file_locks/);
    assert.match(calls[0].sql, /WHERE expires_at < \$1/);
});
test("AsyncLockRepository listFileLocks returns all locks", async () => {
    const lock = fileLockRecord();
    const { connection, calls } = createConnection({ queryRows: [[lock]] });
    const repo = new AsyncLockRepository(connection);
    const result = await repo.listFileLocks();
    assert.deepEqual(result, [lock]);
    assert.match(calls[0].sql, /FROM file_locks/);
    assert.match(calls[0].sql, /ORDER BY created_at ASC/);
});
test("AsyncLockRepository listFileLocksByTask returns locks without tenant", async () => {
    const lock = fileLockRecord();
    const { connection, calls } = createConnection({ queryRows: [[lock]] });
    const repo = new AsyncLockRepository(connection);
    const result = await repo.listFileLocksByTask("task-1");
    assert.deepEqual(result, [lock]);
    assert.match(calls[0].sql, /FROM file_locks/);
    assert.match(calls[0].sql, /WHERE task_id = \$1/);
    assert.doesNotMatch(calls[0].sql, /INNER JOIN tasks/);
});
test("AsyncLockRepository listFileLocksByTask returns locks with tenant", async () => {
    const lock = fileLockRecord();
    const { connection, calls } = createConnection({ queryRows: [[lock]] });
    const repo = new AsyncLockRepository(connection);
    const result = await repo.listFileLocksByTask("task-1", "tenant-a");
    assert.deepEqual(result, [lock]);
    assert.match(calls[0].sql, /INNER JOIN tasks t ON t\.id = f\.task_id/);
    assert.match(calls[0].sql, /t\.tenant_id = \$2/);
});
test("AsyncLockRepository deleteFileLock deletes lock and returns count", async () => {
    const { connection, calls } = createConnection({ executeResults: [1] });
    const repo = new AsyncLockRepository(connection);
    const result = await repo.deleteFileLock("lock-1");
    assert.equal(result, 1);
    assert.match(calls[0].sql, /DELETE FROM file_locks WHERE id = \$1/);
    assert.deepEqual(calls[0].params, ["lock-1"]);
});
//# sourceMappingURL=lock-repository.test.js.map