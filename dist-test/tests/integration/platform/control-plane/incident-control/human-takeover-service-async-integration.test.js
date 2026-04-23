/**
 * Integration Tests: Human Takeover Service Async
 *
 * Tests the HumanTakeoverServiceAsync with real database, queue management,
 * and event emission integration.
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { HumanTakeoverServiceAsync } from "../../../../../src/platform/control-plane/incident-control/human-takeover-service-async.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
// =============================================================================
// Construction & Basic Operations
// =============================================================================
test("HumanTakeoverServiceAsync integration: constructs with default config", () => {
    const workspace = createTempWorkspace("aa-async-construct-");
    const dbPath = join(workspace, "async-construct.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        seedTaskAndExecution(db, store, {
            taskId: "task-async-construct",
            executionId: "exec-async-construct",
            traceId: "trace-async-construct",
        });
        const service = new HumanTakeoverServiceAsync(db, store);
        assert.equal(service.getQueueDepth(), 0);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("HumanTakeoverServiceAsync integration: constructs with custom config", () => {
    const workspace = createTempWorkspace("aa-async-config-");
    const dbPath = join(workspace, "async-config.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        seedTaskAndExecution(db, store, {
            taskId: "task-async-config",
            executionId: "exec-async-config",
            traceId: "trace-async-config",
        });
        const service = new HumanTakeoverServiceAsync(db, store, {
            maxQueueDepth: 50,
            defaultPriority: 10,
            timeoutConfig: {
                defaultTimeoutMs: 60000,
                acknowledgmentTimeoutMs: 30000,
                escalationCheckIntervalMs: 10000,
                maxRetries: 5,
            },
        });
        assert.equal(service.getQueueDepth(), 0);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
// =============================================================================
// Queue Management
// =============================================================================
test("HumanTakeoverServiceAsync integration: openSessionAsync enqueues request", () => {
    const workspace = createTempWorkspace("aa-async-open-");
    const dbPath = join(workspace, "async-open.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        seedTaskAndExecution(db, store, {
            taskId: "task-async-open",
            executionId: "exec-async-open",
            traceId: "trace-async-open",
        });
        const service = new HumanTakeoverServiceAsync(db, store);
        const entry = service.openSessionAsync({
            taskId: "task-async-open",
            operatorId: "operator-async",
            reasonCode: "incident.test_async",
        });
        assert.ok(entry.requestId.startsWith("tkrq_"));
        assert.equal(entry.taskId, "task-async-open");
        assert.equal(entry.operatorId, "operator-async");
        assert.equal(entry.actionType, "open_session");
        assert.equal(entry.status, "pending");
        assert.equal(service.getQueueDepth(), 1);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("HumanTakeoverServiceAsync integration: enqueueTakeoverRequest with modify_input action", () => {
    const workspace = createTempWorkspace("aa-async-modify-");
    const dbPath = join(workspace, "async-modify.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        seedTaskAndExecution(db, store, {
            taskId: "task-async-modify",
            executionId: "exec-async-modify",
            traceId: "trace-async-modify",
        });
        const service = new HumanTakeoverServiceAsync(db, store);
        // First open a session to get a valid sessionId
        const sessionEntry = service.openSessionAsync({
            taskId: "task-async-modify",
            operatorId: "operator-async",
            reasonCode: "incident.open_first",
        });
        // Now enqueue a modify_input request
        const modifyEntry = service.enqueueTakeoverRequest({
            taskId: "task-async-modify",
            operatorId: "operator-async",
            reasonCode: "incident.modify",
            actionType: "modify_input",
            payload: {
                type: "modify_input",
                sessionId: sessionEntry.requestId,
                inputJson: JSON.stringify({ adjusted: true }),
                reasonCode: "incident.modify",
            },
        });
        assert.equal(modifyEntry.actionType, "modify_input");
        assert.equal(service.getQueueDepth(), 2);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("HumanTakeoverServiceAsync integration: getPendingRequests returns all pending", () => {
    const workspace = createTempWorkspace("aa-async-pending-");
    const dbPath = join(workspace, "async-pending.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        seedTaskAndExecution(db, store, {
            taskId: "task-async-pending",
            executionId: "exec-async-pending",
            traceId: "trace-async-pending",
        });
        const service = new HumanTakeoverServiceAsync(db, store);
        service.openSessionAsync({
            taskId: "task-async-pending",
            operatorId: "operator-async",
            reasonCode: "incident.first",
        });
        service.openSessionAsync({
            taskId: "task-async-pending",
            operatorId: "operator-async",
            reasonCode: "incident.second",
        });
        const pending = service.getPendingRequests();
        assert.equal(pending.length, 2);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("HumanTakeoverServiceAsync integration: cancelRequest removes pending entry", () => {
    const workspace = createTempWorkspace("aa-async-cancel-");
    const dbPath = join(workspace, "async-cancel.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        seedTaskAndExecution(db, store, {
            taskId: "task-async-cancel",
            executionId: "exec-async-cancel",
            traceId: "trace-async-cancel",
        });
        const service = new HumanTakeoverServiceAsync(db, store);
        const entry = service.openSessionAsync({
            taskId: "task-async-cancel",
            operatorId: "operator-async",
            reasonCode: "incident.cancel_me",
        });
        assert.equal(service.getQueueDepth(), 1);
        const cancelled = service.cancelRequest(entry.requestId);
        assert.equal(cancelled, true);
        assert.equal(service.getQueueDepth(), 0);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("HumanTakeoverServiceAsync integration: cancelRequest returns false for non-existent", () => {
    const workspace = createTempWorkspace("aa-async-cancel-false-");
    const dbPath = join(workspace, "async-cancel-false.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        seedTaskAndExecution(db, store, {
            taskId: "task-async-cancel-false",
            executionId: "exec-async-cancel-false",
            traceId: "trace-async-cancel-false",
        });
        const service = new HumanTakeoverServiceAsync(db, store);
        const cancelled = service.cancelRequest("non-existent-request-id");
        assert.equal(cancelled, false);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("HumanTakeoverServiceAsync integration: priority is respected in queue ordering", () => {
    const workspace = createTempWorkspace("aa-async-priority-");
    const dbPath = join(workspace, "async-priority.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        seedTaskAndExecution(db, store, {
            taskId: "task-async-priority",
            executionId: "exec-async-priority",
            traceId: "trace-async-priority",
        });
        const service = new HumanTakeoverServiceAsync(db, store, {
            defaultPriority: 5,
        });
        // Enqueue low priority
        service.openSessionAsync({
            taskId: "task-async-priority",
            operatorId: "operator-async",
            reasonCode: "incident.low",
            priority: 10,
        });
        // Enqueue high priority
        service.openSessionAsync({
            taskId: "task-async-priority",
            operatorId: "operator-async",
            reasonCode: "incident.high",
            priority: 1,
        });
        const pending = service.getPendingRequests();
        assert.equal(pending[0]?.reasonCode, "incident.high");
        assert.equal(pending[1]?.reasonCode, "incident.low");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("HumanTakeoverServiceAsync integration: processRequest handles open_session action", () => {
    const workspace = createTempWorkspace("aa-async-process-");
    const dbPath = join(workspace, "async-process.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        seedTaskAndExecution(db, store, {
            taskId: "task-async-process",
            executionId: "exec-async-process",
            traceId: "trace-async-process",
        });
        const service = new HumanTakeoverServiceAsync(db, store);
        const entry = service.openSessionAsync({
            taskId: "task-async-process",
            operatorId: "operator-process",
            reasonCode: "incident.process_test",
        });
        const result = service.processRequest(entry.requestId);
        assert.equal(result.requestId, entry.requestId);
        assert.equal(result.success, true);
        assert.ok(result.actionResult);
        assert.equal(result.actionResult?.taskId, "task-async-process");
        assert.ok(result.actionResult?.takeoverSessionId.startsWith("takeover_"));
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("HumanTakeoverServiceAsync integration: processRequest returns error for unknown request", () => {
    const workspace = createTempWorkspace("aa-async-unknown-");
    const dbPath = join(workspace, "async-unknown.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        seedTaskAndExecution(db, store, {
            taskId: "task-async-unknown",
            executionId: "exec-async-unknown",
            traceId: "trace-async-unknown",
        });
        const service = new HumanTakeoverServiceAsync(db, store);
        const result = service.processRequest("non-existent-request");
        assert.equal(result.success, false);
        assert.ok(result.error?.includes("not found"));
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("HumanTakeoverServiceAsync integration: all async action types can be enqueued", () => {
    const workspace = createTempWorkspace("aa-async-types-");
    const dbPath = join(workspace, "async-types.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        seedTaskAndExecution(db, store, {
            taskId: "task-async-types",
            executionId: "exec-async-types",
            traceId: "trace-async-types",
        });
        const service = new HumanTakeoverServiceAsync(db, store);
        const actionTypes = [
            "open_session",
            "modify_input",
            "switch_worker",
            "retry_execution",
            "set_current_step",
            "write_step_output",
            "skip_current_step",
            "complete_task",
            "acknowledge_takeover",
        ];
        for (const actionType of actionTypes) {
            const entry = service.enqueueTakeoverRequest({
                taskId: "task-async-types",
                operatorId: "operator-async",
                reasonCode: "incident.testing",
                actionType,
                payload: { type: actionType, sessionId: "s1" },
            });
            assert.equal(entry.actionType, actionType);
        }
        assert.equal(service.getQueueDepth(), actionTypes.length);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=human-takeover-service-async-integration.test.js.map