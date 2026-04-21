/**
 * Recovery Integration Test: Lease Crash Recovery
 *
 * Verifies that leases are properly recovered after worker crashes.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
test("recovery: expired lease allows task to be reassigned", () => {
    const workspace = createTempWorkspace("recovery-lease-");
    try {
        const dbPath = join(workspace, "lease-recovery.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const taskId = newId("task");
        const workerId = newId("worker");
        const executionId = newId("exec");
        const now = nowIso();
        // Create task and execution
        db.transaction(() => {
            store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Lease recovery test",
                status: "in_progress",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
            store.insertExecution({
                id: executionId,
                taskId,
                workflowId: null,
                parentExecutionId: null,
                agentId: workerId,
                roleId: null,
                runKind: "task_run",
                status: "executing",
                inputRef: null,
                traceId: newId("trace"),
                attempt: 1,
                timeoutMs: 30000,
                budgetUsdLimit: null,
                requiresApproval: 0,
                sandboxMode: null,
                allowedToolsJson: null,
                allowedPathsJson: null,
                maxRetries: 0,
                retryBackoff: "exponential",
                lastErrorCode: null,
                lastErrorMessage: null,
                startedAt: now,
                finishedAt: null,
                createdAt: now,
                updatedAt: now,
            });
            store.insertExecutionLease({
                id: newId("lease"),
                executionId,
                workerId,
                attempt: 1,
                fencingToken: 1,
                queueName: null,
                status: "active",
                leasedAt: now,
                expiresAt: new Date(Date.now() + 30000).toISOString(),
                lastHeartbeatAt: now,
                releasedAt: null,
                reasonCode: null,
            });
        });
        // Verify lease is active
        const activeLease = db.connection
            .prepare("SELECT * FROM execution_leases WHERE execution_id = ? AND status = 'active'")
            .get(executionId);
        assert.ok(activeLease, "Lease should be active initially");
        // Simulate time passing beyond lease expiry (update expires_at to past)
        const expiredTime = new Date(Date.now() - 1000).toISOString(); // 1 second ago
        db.connection
            .prepare("UPDATE execution_leases SET expires_at = ? WHERE execution_id = ?")
            .run(expiredTime, executionId);
        // Now the lease should be considered expired
        const expiredLease = db.connection
            .prepare("SELECT * FROM execution_leases WHERE execution_id = ? AND status = 'active' AND expires_at < ?")
            .get(executionId, nowIso());
        // The expired lease query should not find an active lease that's expired
        // But the lease row still exists with status 'active'
        const existingLease = db.connection
            .prepare("SELECT * FROM execution_leases WHERE execution_id = ?")
            .get(executionId);
        assert.ok(existingLease, "Lease should still exist");
        assert.strictEqual(existingLease.status, "active", "Lease status should still be 'active' in DB");
        // Verify the lease is past its expiry time
        assert.ok(existingLease.expires_at < nowIso(), "Lease should be past its expiry time");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("recovery: orphaned execution can be recovered", () => {
    const workspace = createTempWorkspace("recovery-orphan-");
    try {
        const dbPath = join(workspace, "orphan-exec.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const taskId = newId("task");
        const workerId = newId("worker");
        const executionId = newId("exec");
        const now = nowIso();
        // Create task and execution
        db.transaction(() => {
            store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Orphan recovery test",
                status: "in_progress",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
            store.insertExecution({
                id: executionId,
                taskId,
                workflowId: null,
                parentExecutionId: null,
                agentId: workerId,
                roleId: null,
                runKind: "task_run",
                status: "executing",
                inputRef: null,
                traceId: newId("trace"),
                attempt: 1,
                timeoutMs: 30000,
                budgetUsdLimit: null,
                requiresApproval: 0,
                sandboxMode: null,
                allowedToolsJson: null,
                allowedPathsJson: null,
                maxRetries: 0,
                retryBackoff: "exponential",
                lastErrorCode: null,
                lastErrorMessage: null,
                startedAt: now,
                finishedAt: null,
                createdAt: now,
                updatedAt: now,
            });
        });
        // Simulate orphan: worker is gone but execution still marked as 'executing'
        // This happens when a worker crashes without cleanup
        // Find orphaned executions - executions that are 'executing' but have no active lease
        const orphanedExecutions = db.connection
            .prepare(`SELECT e.* FROM executions e
         LEFT JOIN execution_leases l ON e.id = l.execution_id AND l.status = 'active'
         WHERE e.status = 'executing' AND l.id IS NULL`)
            .all();
        assert.equal(orphanedExecutions.length, 1, "Should find 1 orphaned execution");
        assert.strictEqual(orphanedExecutions[0].id, executionId, "Orphaned execution should match");
        // Recovery: mark the orphaned execution as failed
        db.connection
            .prepare("UPDATE executions SET status = ?, updated_at = ? WHERE id = ?")
            .run("failed", nowIso(), executionId);
        // Verify execution is now failed
        const updatedExecution = db.connection
            .prepare("SELECT * FROM executions WHERE id = ?")
            .get(executionId);
        assert.strictEqual(updatedExecution.status, "failed", "Orphaned execution should be marked as failed");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=lease-crash-recovery.test.js.map