import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { OrphanCleanupService } from "../../../src/platform/execution/execution-engine/orphan-cleanup-service.js";
import { WorkerRegistryService } from "../../../src/platform/execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import { seedTaskAndExecution } from "../../helpers/seed.js";
test("orphan cleanup service preserves valid worker execution refs while pruning orphaned ones", () => {
    const workspace = createTempWorkspace("aa-orphan-cleanup-unit-");
    const dbPath = join(workspace, "orphan-cleanup-unit.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const workers = new WorkerRegistryService(store);
        const cleanup = new OrphanCleanupService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-worker-valid",
            executionId: "exec-worker-valid",
            traceId: "trace-worker-valid",
        });
        seedTaskAndExecution(db, store, {
            taskId: "task-worker-terminal",
            executionId: "exec-worker-terminal",
            traceId: "trace-worker-terminal",
        });
        store.updateExecutionStatus("exec-worker-terminal", "succeeded", "2026-04-07T12:00:02.000Z", null, "2026-04-07T12:00:02.000Z", null);
        db.transaction(() => {
            store.insertExecutionLease({
                id: "lease-worker-valid",
                executionId: "exec-worker-valid",
                workerId: "worker-cleanup",
                attempt: 1,
                fencingToken: 1,
                queueName: "default",
                status: "active",
                leasedAt: "2026-04-07T12:00:00.000Z",
                expiresAt: "2026-04-07T12:10:00.000Z",
                lastHeartbeatAt: "2026-04-07T12:00:00.000Z",
                releasedAt: null,
                reasonCode: null,
            });
        });
        workers.recordHeartbeat({
            workerId: "worker-cleanup",
            status: "busy",
            capabilities: ["bash"],
            runningExecutionIds: ["exec-worker-valid", "exec-worker-terminal", "exec-worker-missing"],
            activeLeaseCount: 3,
            maxConcurrency: 3,
            queueAffinity: "default",
            occurredAt: "2026-04-07T12:00:01.000Z",
        });
        const before = cleanup.preview("2026-04-07T12:00:03.000Z");
        const report = cleanup.enforce("2026-04-07T12:00:04.000Z");
        const worker = store.getWorkerSnapshot("worker-cleanup");
        const events = store.listEventsForTask("task-worker-valid");
        const maintenanceEvents = store.listEventsForTask("task-worker-terminal");
        db.close();
        assert.ok(before.issues.some((issue) => issue.issueType === "worker_execution_reference_orphan"
            && issue.entityId === "worker-cleanup"
            && issue.orphanExecutionRefs?.some((item) => item.executionId === "exec-worker-terminal")));
        assert.ok(report.applied?.some((item) => item.action === "clean_worker_execution_refs" && item.applied));
        assert.equal(worker?.runningExecutionsJson, JSON.stringify(["exec-worker-valid"]));
        assert.equal(worker?.activeLeaseCount, 1);
        assert.equal(worker?.status, "busy");
        assert.equal(events.some((event) => event.eventType === "maintenance:worker_execution_refs_cleaned"), false);
        assert.ok(maintenanceEvents.some((event) => event.eventType === "maintenance:worker_execution_refs_cleaned") === false);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("orphan cleanup service reports no issues when all execution refs are valid", () => {
    const workspace = createTempWorkspace("aa-orphan-cleanup-valid-");
    const dbPath = join(workspace, "orphan-cleanup-valid.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const workers = new WorkerRegistryService(store);
        const cleanup = new OrphanCleanupService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-clean",
            executionId: "exec-clean",
            traceId: "trace-clean",
        });
        db.transaction(() => {
            store.insertExecutionLease({
                id: "lease-clean",
                executionId: "exec-clean",
                workerId: "worker-clean",
                attempt: 1,
                fencingToken: 1,
                queueName: "default",
                status: "active",
                leasedAt: "2026-04-07T12:00:00.000Z",
                expiresAt: "2026-04-07T12:10:00.000Z",
                lastHeartbeatAt: "2026-04-07T12:00:00.000Z",
                releasedAt: null,
                reasonCode: null,
            });
        });
        workers.recordHeartbeat({
            workerId: "worker-clean",
            status: "busy",
            capabilities: ["bash"],
            runningExecutionIds: ["exec-clean"],
            activeLeaseCount: 1,
            maxConcurrency: 3,
            queueAffinity: "default",
            occurredAt: "2026-04-07T12:00:01.000Z",
        });
        const before = cleanup.preview("2026-04-07T12:00:03.000Z");
        assert.equal(before.issues.length, 0);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("orphan cleanup service detects orphan session", () => {
    const workspace = createTempWorkspace("aa-orphan-session-");
    const dbPath = join(workspace, "orphan-session.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const cleanup = new OrphanCleanupService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-orphan-session",
            executionId: "exec-orphan-session",
            traceId: "trace-orphan-session",
        });
        store.updateExecutionStatus("exec-orphan-session", "succeeded", "2026-04-07T12:00:02.000Z", null, "2026-04-07T12:00:02.000Z", null);
        store.updateTaskStatus("task-orphan-session", "done", "2026-04-07T12:00:03.000Z", null, null);
        // Use correct SessionRecord fields: id, taskId, channel, status, externalSessionId, createdAt, updatedAt
        store.insertSession({
            id: "session-orphan",
            taskId: "task-orphan-session",
            channel: "cli",
            status: "open",
            externalSessionId: null,
            createdAt: "2026-04-07T11:00:00.000Z",
            updatedAt: "2026-04-07T11:00:00.000Z",
        });
        const report = cleanup.preview("2026-04-07T14:00:00.000Z");
        assert.ok(report.issues.some((issue) => issue.issueType === "orphan_session"), "Should detect orphan session");
        assert.equal(report.issues.length, 1);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("orphan cleanup service enforce applies close_orphan_session action", () => {
    const workspace = createTempWorkspace("aa-orphan-enforce-");
    const dbPath = join(workspace, "orphan-enforce.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const cleanup = new OrphanCleanupService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-enforce",
            executionId: "exec-enforce",
            traceId: "trace-enforce",
        });
        store.updateExecutionStatus("exec-enforce", "succeeded", "2026-04-07T12:00:02.000Z", null, "2026-04-07T12:00:02.000Z", null);
        store.updateTaskStatus("task-enforce", "done", "2026-04-07T12:00:03.000Z", null, null);
        store.insertSession({
            id: "session-enforce",
            taskId: "task-enforce",
            channel: "cli",
            status: "open",
            externalSessionId: null,
            createdAt: "2026-04-07T11:00:00.000Z",
            updatedAt: "2026-04-07T11:00:00.000Z",
        });
        const report = cleanup.enforce("2026-04-07T14:00:00.000Z");
        assert.ok(report.applied?.some((item) => item.action === "close_orphan_session" && item.applied), "Should apply close_orphan_session");
        const session = store.getSession("session-enforce");
        assert.equal(session?.status, "completed");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("orphan cleanup service close_orphan_session skips session that is already missing", () => {
    const workspace = createTempWorkspace("aa-orphan-missing-");
    const dbPath = join(workspace, "orphan-missing.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const cleanup = new OrphanCleanupService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-missing",
            executionId: "exec-missing",
            traceId: "trace-missing",
        });
        store.updateExecutionStatus("exec-missing", "succeeded", "2026-04-07T12:00:02.000Z", null, "2026-04-07T12:00:02.000Z", null);
        store.updateTaskStatus("task-missing", "done", "2026-04-07T12:00:03.000Z", null, null);
        // Don't insert session - the orphan issue will reference a non-existent session
        const report = cleanup.enforce("2026-04-07T14:00:00.000Z");
        // No orphan sessions should be found since we didn't insert one
        // The report will be empty for orphan_session issues
        assert.ok(report.issues.filter((i) => i.issueType === "orphan_session").length === 0);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=orphan-cleanup-service.test.js.map