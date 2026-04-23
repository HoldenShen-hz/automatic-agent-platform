/**
 * AsyncLockRepository - Async data access for file locks.
 *
 * This is the async PostgreSQL-compatible version of LockRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */
import { asyncExecute, asyncQueryAll } from "../async-query-helper.js";
import { resolveTenantScope } from "../sqlite/authoritative-task-store-types.js";
export class AsyncLockRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    async insertFileLock(lock) {
        await this.conn.execute(`INSERT INTO file_locks (
        id, task_id, execution_id, lock_scope, resource_path, lock_mode, owner_id, expires_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, lock.id, lock.taskId, lock.executionId, lock.lockScope, lock.resourcePath, lock.lockMode, lock.ownerId, lock.expiresAt, lock.createdAt, lock.updatedAt);
    }
    /**
     * List active file locks for a resource that haven't expired.
     */
    async listActiveFileLocksForResource(resourcePath, now) {
        return asyncQueryAll(this.conn, `SELECT
        id,
        task_id AS "taskId",
        execution_id AS "executionId",
        lock_scope AS "lockScope",
        resource_path AS "resourcePath",
        lock_mode AS "lockMode",
        owner_id AS "ownerId",
        expires_at AS "expiresAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM file_locks
       WHERE resource_path = $1
         AND expires_at >= $2
       ORDER BY created_at ASC`, resourcePath, now);
    }
    /**
     * List all expired file locks.
     */
    async listExpiredFileLocks(now) {
        return asyncQueryAll(this.conn, `SELECT
        id,
        task_id AS "taskId",
        execution_id AS "executionId",
        lock_scope AS "lockScope",
        resource_path AS "resourcePath",
        lock_mode AS "lockMode",
        owner_id AS "ownerId",
        expires_at AS "expiresAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM file_locks
       WHERE expires_at < $1`, now);
    }
    /**
     * List all file locks.
     */
    async listFileLocks() {
        return asyncQueryAll(this.conn, `SELECT
        id,
        task_id AS "taskId",
        execution_id AS "executionId",
        lock_scope AS "lockScope",
        resource_path AS "resourcePath",
        lock_mode AS "lockMode",
        owner_id AS "ownerId",
        expires_at AS "expiresAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM file_locks
       ORDER BY created_at ASC`);
    }
    /**
     * List file locks for a task.
     */
    async listFileLocksByTask(taskId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return asyncQueryAll(this.conn, `SELECT
          f.id,
          f.task_id AS "taskId",
          f.execution_id AS "executionId",
          f.lock_scope AS "lockScope",
          f.resource_path AS "resourcePath",
          f.lock_mode AS "lockMode",
          f.owner_id AS "ownerId",
          f.expires_at AS "expiresAt",
          f.created_at AS "createdAt",
          f.updated_at AS "updatedAt"
         FROM file_locks f
         INNER JOIN tasks t ON t.id = f.task_id
         WHERE f.task_id = $1
           AND t.tenant_id = $2
         ORDER BY f.created_at ASC`, taskId, scopedTenantId);
        }
        return asyncQueryAll(this.conn, `SELECT
        id,
        task_id AS "taskId",
        execution_id AS "executionId",
        lock_scope AS "lockScope",
        resource_path AS "resourcePath",
        lock_mode AS "lockMode",
        owner_id AS "ownerId",
        expires_at AS "expiresAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM file_locks
       WHERE task_id = $1
       ORDER BY created_at ASC`, taskId);
    }
    /**
     * Delete a file lock.
     */
    async deleteFileLock(lockId) {
        return asyncExecute(this.conn, `DELETE FROM file_locks WHERE id = $1`, lockId);
    }
}
//# sourceMappingURL=lock-repository.js.map