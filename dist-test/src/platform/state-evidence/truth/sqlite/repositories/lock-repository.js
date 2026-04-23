/**
 * LockRepository - Data access for file locks.
 *
 * This repository handles all data access for:
 * - FileLockRecord (file_locks table)
 *
 * All SQL queries use proper column aliasing to match the camelCase domain types.
 */
import { queryAll, execute } from "../query-helper.js";
import { resolveTenantScope } from "../authoritative-task-store-types.js";
export class LockRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    insertFileLock(lock) {
        this.conn
            .prepare(`INSERT INTO file_locks (
          id, task_id, execution_id, lock_scope, resource_path, lock_mode, owner_id, expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(lock.id, lock.taskId, lock.executionId, lock.lockScope, lock.resourcePath, lock.lockMode, lock.ownerId, lock.expiresAt, lock.createdAt, lock.updatedAt);
    }
    /**
     * List active file locks for a resource that haven't expired.
     */
    listActiveFileLocksForResource(resourcePath, now) {
        return queryAll(this.conn, `SELECT
        id,
        task_id AS taskId,
        execution_id AS executionId,
        lock_scope AS lockScope,
        resource_path AS resourcePath,
        lock_mode AS lockMode,
        owner_id AS ownerId,
        expires_at AS expiresAt,
        created_at AS createdAt,
        updated_at AS updatedAt
       FROM file_locks
       WHERE resource_path = ?
         AND expires_at >= ?
       ORDER BY created_at ASC`, resourcePath, now);
    }
    /**
     * List all expired file locks.
     */
    listExpiredFileLocks(now) {
        return queryAll(this.conn, `SELECT
        id,
        task_id AS taskId,
        execution_id AS executionId,
        lock_scope AS lockScope,
        resource_path AS resourcePath,
        lock_mode AS lockMode,
        owner_id AS ownerId,
        expires_at AS expiresAt,
        created_at AS createdAt,
        updated_at AS updatedAt
       FROM file_locks
       WHERE expires_at < ?`, now);
    }
    /**
     * List all file locks.
     */
    listFileLocks() {
        return queryAll(this.conn, `SELECT
        id,
        task_id AS taskId,
        execution_id AS executionId,
        lock_scope AS lockScope,
        resource_path AS resourcePath,
        lock_mode AS lockMode,
        owner_id AS ownerId,
        expires_at AS expiresAt,
        created_at AS createdAt,
        updated_at AS updatedAt
       FROM file_locks
       ORDER BY created_at ASC`);
    }
    /**
     * List file locks for a task.
     */
    listFileLocksByTask(taskId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return queryAll(this.conn, `SELECT
          f.id,
          f.task_id AS taskId,
          f.execution_id AS executionId,
          f.lock_scope AS lockScope,
          f.resource_path AS resourcePath,
          f.lock_mode AS lockMode,
          f.owner_id AS ownerId,
          f.expires_at AS expiresAt,
          f.created_at AS createdAt,
          f.updated_at AS updatedAt
         FROM file_locks f
         INNER JOIN tasks t ON t.id = f.task_id
         WHERE f.task_id = ?
           AND t.tenant_id = ?
         ORDER BY f.created_at ASC`, taskId, scopedTenantId);
        }
        return queryAll(this.conn, `SELECT
        id,
        task_id AS taskId,
        execution_id AS executionId,
        lock_scope AS lockScope,
        resource_path AS resourcePath,
        lock_mode AS lockMode,
        owner_id AS ownerId,
        expires_at AS expiresAt,
        created_at AS createdAt,
        updated_at AS updatedAt
       FROM file_locks
       WHERE task_id = ?
       ORDER BY created_at ASC`, taskId);
    }
    /**
     * Delete a file lock.
     */
    deleteFileLock(lockId) {
        execute(this.conn, `DELETE FROM file_locks WHERE id = ?`, lockId);
    }
}
//# sourceMappingURL=lock-repository.js.map