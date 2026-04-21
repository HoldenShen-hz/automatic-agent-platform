/**
 * Lifecycle Integration Test: Session Lifecycle
 *
 * Verifies session lifecycle and event storage.
 * Part of lifecycle tests per strategy doc Section 6.0a.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
test("lifecycle: session can transition through open -> closed states", () => {
    const workspace = createTempWorkspace("lifecycle-session-");
    try {
        const dbPath = join(workspace, "session-lifecycle.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const taskId = newId("task");
        const sessionId = newId("sess");
        const now = nowIso();
        // Create task
        db.transaction(() => {
            store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Session lifecycle test",
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
        });
        // Create session
        db.transaction(() => {
            store.insertSession({
                id: sessionId,
                taskId,
                channel: "cli",
                status: "open",
                externalSessionId: null,
                createdAt: now,
                updatedAt: now,
            });
        });
        // Verify session is open
        const openSessions = db.connection
            .prepare("SELECT status FROM sessions WHERE id = ?")
            .get(sessionId);
        assert.strictEqual(openSessions?.status, "open");
        // Close session
        const closedAt = nowIso();
        db.transaction(() => {
            store.updateSessionStatus(sessionId, "closed", closedAt);
        });
        // Verify session is closed
        const closedSessions = db.connection
            .prepare("SELECT status FROM sessions WHERE id = ?")
            .get(sessionId);
        assert.strictEqual(closedSessions?.status, "closed");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lifecycle: session events are stored in correct order", () => {
    const workspace = createTempWorkspace("lifecycle-session-events-");
    try {
        const dbPath = join(workspace, "session-events-order.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const sessionId = newId("sess");
        const now = nowIso();
        // Insert multiple session events
        db.transaction(() => {
            for (let i = 0; i < 5; i++) {
                db.connection
                    .prepare("INSERT INTO session_events (id, session_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)")
                    .run(newId("sess-event"), sessionId, `session.event_${i}`, JSON.stringify({ sequence: i }), now);
            }
        });
        // Query events ordered by created_at
        const events = db.connection
            .prepare("SELECT * FROM session_events WHERE session_id = ? ORDER BY created_at ASC")
            .all(sessionId);
        assert.strictEqual(events.length, 5, "Should have 5 session events");
        assert.strictEqual(events[0].event_type, "session.event_0");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lifecycle: session can be associated with multiple event types", () => {
    const workspace = createTempWorkspace("lifecycle-session-types-");
    try {
        const dbPath = join(workspace, "session-types.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const sessionId = newId("sess");
        const now = nowIso();
        const eventTypes = [
            "session.created",
            "session.message_sent",
            "session.message_received",
            "session.closed",
        ];
        // Insert events of different types
        db.transaction(() => {
            for (const eventType of eventTypes) {
                db.connection
                    .prepare("INSERT INTO session_events (id, session_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)")
                    .run(newId("sess-event"), sessionId, eventType, JSON.stringify({ type: eventType }), now);
            }
        });
        // Query all events
        const events = db.connection
            .prepare("SELECT event_type FROM session_events WHERE session_id = ?")
            .all(sessionId);
        assert.strictEqual(events.length, 4, "Should have events for each type");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=session-lifecycle-integration.test.js.map