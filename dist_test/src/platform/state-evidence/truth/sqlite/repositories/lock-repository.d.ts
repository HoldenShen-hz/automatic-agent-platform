/**
 * LockRepository - Data access for file locks.
 *
 * This repository handles all data access for:
 * - FileLockRecord (file_locks table)
 *
 * All SQL queries use proper column aliasing to match the camelCase domain types.
 */
import type { FileLockRecord } from "../../../../contracts/types/domain.js";
import type { SqliteConnection } from "../query-helper.js";
export declare class LockRepository {
    private readonly conn;
    constructor(conn: SqliteConnection);
    insertFileLock(lock: FileLockRecord): void;
    /**
     * List active file locks for a resource that haven't expired.
     */
    listActiveFileLocksForResource(resourcePath: string, now: string): FileLockRecord[];
    /**
     * List all expired file locks.
     */
    listExpiredFileLocks(now: string): FileLockRecord[];
    /**
     * List all file locks.
     */
    listFileLocks(): FileLockRecord[];
    /**
     * List file locks for a task.
     */
    listFileLocksByTask(taskId: string, tenantId?: string | null): FileLockRecord[];
    /**
     * Delete a file lock.
     */
    deleteFileLock(lockId: string): void;
}
