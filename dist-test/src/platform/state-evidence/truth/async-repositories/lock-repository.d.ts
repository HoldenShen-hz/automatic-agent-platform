/**
 * AsyncLockRepository - Async data access for file locks.
 *
 * This is the async PostgreSQL-compatible version of LockRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */
import type { FileLockRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncLockRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    insertFileLock(lock: FileLockRecord): Promise<void>;
    /**
     * List active file locks for a resource that haven't expired.
     */
    listActiveFileLocksForResource(resourcePath: string, now: string): Promise<FileLockRecord[]>;
    /**
     * List all expired file locks.
     */
    listExpiredFileLocks(now: string): Promise<FileLockRecord[]>;
    /**
     * List all file locks.
     */
    listFileLocks(): Promise<FileLockRecord[]>;
    /**
     * List file locks for a task.
     */
    listFileLocksByTask(taskId: string, tenantId?: string | null): Promise<FileLockRecord[]>;
    /**
     * Delete a file lock.
     */
    deleteFileLock(lockId: string): Promise<number>;
}
