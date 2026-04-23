import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { SessionRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/session-repository.js";
import { TaskRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/task-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { SessionDualStorageService } from "../../../../../../src/platform/state-evidence/truth/session-dual-storage.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
function createTestTask(db, taskId, now, tenantId = null) {
    const taskRepo = new TaskRepository(db.connection);
    taskRepo.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId,
        title: "Test task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: null,
        outputJson: null,
        estimatedCostUsd: null,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
    });
}
function createTestSession(db, sessionId, taskId, now, status = "open") {
    const sessionRepo = new SessionRepository(db.connection);
    createTestTask(db, taskId, now);
    sessionRepo.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status,
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
    });
}
test("SessionRepository inserts a session and getSession returns it", () => {
    const workspace = createTempWorkspace("aa-session-repo-");
    const dbPath = join(workspace, "session-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new SessionRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-session-1", now);
        const session = {
            id: "session-001",
            taskId: "task-session-1",
            channel: "cli",
            status: "open",
            externalSessionId: null,
            createdAt: now,
            updatedAt: now,
        };
        repo.insertSession(session);
        const result = repo.getSession("session-001");
        assert.ok(result, "getSession should return the inserted session");
        assert.equal(result.id, "session-001");
        assert.equal(result.taskId, "task-session-1");
        assert.equal(result.channel, "cli");
        assert.equal(result.status, "open");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("SessionRepository getSession returns undefined for non-existent session", () => {
    const workspace = createTempWorkspace("aa-session-repo-");
    const dbPath = join(workspace, "session-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new SessionRepository(db.connection);
        const result = repo.getSession("nonexistent-session");
        assert.strictEqual(result, undefined);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("SessionRepository listSessionsByTask returns all sessions for a task", () => {
    const workspace = createTempWorkspace("aa-session-repo-");
    const dbPath = join(workspace, "session-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new SessionRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-session-list", now);
        for (let i = 1; i <= 3; i++) {
            repo.insertSession({
                id: `session-list-${i}`,
                taskId: "task-session-list",
                channel: "cli",
                status: "open",
                externalSessionId: null,
                createdAt: now,
                updatedAt: now,
            });
        }
        const results = repo.listSessionsByTask("task-session-list");
        assert.equal(results.length, 3, "should return all 3 sessions");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("SessionRepository updateSessionStatus changes session status", () => {
    const workspace = createTempWorkspace("aa-session-repo-");
    const dbPath = join(workspace, "session-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new SessionRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestSession(db, "session-update", "task-session-update", now);
        const newUpdatedAt = "2026-04-14T11:00:00.000Z";
        repo.updateSessionStatus("session-update", "streaming", newUpdatedAt);
        const result = repo.getSession("session-update");
        assert.ok(result);
        assert.equal(result.status, "streaming");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("SessionRepository updateSessionStatus creates terminal session summary", () => {
    const workspace = createTempWorkspace("aa-session-repo-");
    const dbPath = join(workspace, "session-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new SessionRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        const completedAt = "2026-04-14T10:10:00.000Z";
        createTestSession(db, "session-terminal", "task-session-terminal", now);
        repo.insertMessage({
            id: "msg-terminal-1",
            sessionId: "session-terminal",
            direction: "inbound",
            messageType: "text",
            content: "hello",
            partsJson: null,
            attachmentsJson: null,
            createdAt: now,
        });
        repo.updateSessionStatus("session-terminal", "completed", completedAt);
        const summary = repo.getLatestSessionSummary("session-terminal");
        assert.ok(summary);
        assert.equal(summary.sessionId, "session-terminal");
        assert.match(summary.summaryText, /hello/);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("SessionRepository insertMessage and listMessagesBySession work", () => {
    const workspace = createTempWorkspace("aa-session-repo-");
    const dbPath = join(workspace, "session-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new SessionRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestSession(db, "session-msg", "task-msg", now);
        const message = {
            id: "msg-001",
            sessionId: "session-msg",
            direction: "inbound",
            messageType: "text",
            content: "Hello world",
            partsJson: null,
            attachmentsJson: null,
            createdAt: now,
        };
        repo.insertMessage(message);
        const results = repo.listMessagesBySession("session-msg");
        assert.equal(results.length, 1, "should return 1 message");
        assert.equal(results[0]?.id, "msg-001");
        assert.equal(results[0]?.content, "Hello world");
        assert.equal(results[0]?.direction, "inbound");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("SessionRepository writes dual-storage JSONL events when configured", () => {
    const workspace = createTempWorkspace("aa-session-repo-dual-");
    const dbPath = join(workspace, "session-repo.db");
    const replayRoot = join(workspace, "session-replay");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new SessionRepository(db.connection, new SessionDualStorageService({ jsonlRootDir: replayRoot }));
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-dual", now);
        repo.insertSession({
            id: "session-dual",
            taskId: "task-dual",
            channel: "cli",
            status: "open",
            externalSessionId: null,
            createdAt: now,
            updatedAt: now,
        });
        repo.insertMessage({
            id: "msg-dual",
            sessionId: "session-dual",
            direction: "inbound",
            messageType: "text",
            content: "hello dual storage",
            partsJson: null,
            attachmentsJson: null,
            createdAt: now,
        });
        repo.updateSessionStatus("session-dual", "completed", "2026-04-14T10:05:00.000Z");
        const sessionFile = join(replayRoot, "session-session-dual.jsonl");
        assert.equal(existsSync(sessionFile), true);
        const content = readFileSync(sessionFile, "utf8");
        assert.match(content, /session_created/);
        assert.match(content, /message_added/);
        assert.match(content, /session_completed/);
        assert.match(content, /task-dual/);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("SessionRepository listMessagesBySession with limit returns only specified number", () => {
    const workspace = createTempWorkspace("aa-session-repo-");
    const dbPath = join(workspace, "session-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new SessionRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestSession(db, "session-msg-limit", "task-msg-limit", now);
        for (let i = 1; i <= 5; i++) {
            repo.insertMessage({
                id: `msg-limit-${i}`,
                sessionId: "session-msg-limit",
                direction: "inbound",
                messageType: "text",
                content: `Message ${i}`,
                partsJson: null,
                attachmentsJson: null,
                createdAt: now,
            });
        }
        const results = repo.listMessagesBySession("session-msg-limit", 3);
        assert.equal(results.length, 3, "should return only 3 messages");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("SessionRepository listMessagesBySession returns messages in chronological order", () => {
    const workspace = createTempWorkspace("aa-session-repo-");
    const dbPath = join(workspace, "session-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new SessionRepository(db.connection);
        createTestSession(db, "session-msg-order", "task-msg-order", "2026-04-14T10:00:00.000Z");
        // Insert messages with different timestamps (out of order)
        const times = [
            "2026-04-14T10:03:00.000Z",
            "2026-04-14T10:01:00.000Z",
            "2026-04-14T10:02:00.000Z",
        ];
        for (let i = 0; i < times.length; i++) {
            repo.insertMessage({
                id: `msg-order-${i}`,
                sessionId: "session-msg-order",
                direction: "inbound",
                messageType: "text",
                content: `Message at ${times[i]}`,
                partsJson: null,
                attachmentsJson: null,
                createdAt: times[i],
            });
        }
        const results = repo.listMessagesBySession("session-msg-order");
        // Should return in chronological order (created_at ASC)
        assert.equal(results.length, 3, "should return all 3 messages");
        assert.equal(results[0]?.content, "Message at 2026-04-14T10:01:00.000Z", "first message should be earliest");
        assert.equal(results[1]?.content, "Message at 2026-04-14T10:02:00.000Z", "second message should be middle");
        assert.equal(results[2]?.content, "Message at 2026-04-14T10:03:00.000Z", "third message should be latest");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("SessionRepository upsertGatewayTarget inserts new target", () => {
    const workspace = createTempWorkspace("aa-session-repo-");
    const dbPath = join(workspace, "session-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new SessionRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        const target = {
            targetId: "target-001",
            channel: "slack",
            targetKind: "room",
            externalTargetId: "C0123456789",
            displayName: "general",
            aliasesJson: '["general","random"]',
            metadataJson: '{"team":"engineering"}',
            source: "directory",
            lastSeenAt: now,
            createdAt: now,
            updatedAt: now,
        };
        repo.upsertGatewayTarget(target);
        const result = repo.getGatewayTarget("target-001");
        assert.ok(result);
        assert.equal(result.targetId, "target-001");
        assert.equal(result.channel, "slack");
        assert.equal(result.targetKind, "room");
        assert.equal(result.displayName, "general");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("SessionRepository upsertGatewayTarget updates existing target", () => {
    const workspace = createTempWorkspace("aa-session-repo-");
    const dbPath = join(workspace, "session-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new SessionRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        const later = "2026-04-14T12:00:00.000Z";
        const target = {
            targetId: "target-update",
            channel: "slack",
            targetKind: "room",
            externalTargetId: "C0123456789",
            displayName: "general",
            aliasesJson: '["general"]',
            metadataJson: "{}",
            source: "directory",
            lastSeenAt: now,
            createdAt: now,
            updatedAt: now,
        };
        repo.upsertGatewayTarget(target);
        const updatedTarget = {
            targetId: "target-update",
            channel: "slack",
            targetKind: "room",
            externalTargetId: "C0123456789",
            displayName: "general-updated",
            aliasesJson: '["general-updated"]',
            metadataJson: '{"updated":true}',
            source: "directory",
            lastSeenAt: later,
            createdAt: now,
            updatedAt: later,
        };
        repo.upsertGatewayTarget(updatedTarget);
        const result = repo.getGatewayTarget("target-update");
        assert.ok(result);
        assert.equal(result.displayName, "general-updated");
        assert.equal(result.aliasesJson, '["general-updated"]');
    }
    finally {
        cleanupPath(workspace);
    }
});
test("SessionRepository listGatewayTargetsByChannel returns targets for channel", () => {
    const workspace = createTempWorkspace("aa-session-repo-");
    const dbPath = join(workspace, "session-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new SessionRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        let idx = 0;
        for (const channel of ["slack", "slack", "discord"]) {
            repo.upsertGatewayTarget({
                targetId: `target-${channel}-${idx++}`,
                channel,
                targetKind: "room",
                externalTargetId: `ext-${channel}-${idx}`,
                displayName: `${channel}-channel`,
                aliasesJson: "[]",
                metadataJson: "{}",
                source: "directory",
                lastSeenAt: now,
                createdAt: now,
                updatedAt: now,
            });
        }
        const slackTargets = repo.listGatewayTargetsByChannel("slack");
        assert.equal(slackTargets.length, 2, "should return 2 slack targets");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("SessionRepository listGatewaySessionTargetCandidates applies channel and tenant scope", () => {
    const workspace = createTempWorkspace("aa-session-repo-");
    const dbPath = join(workspace, "session-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new SessionRepository(db.connection);
        createTestTask(db, "task-candidate-a", "2026-04-14T10:00:00.000Z", "tenant-a");
        createTestTask(db, "task-candidate-b", "2026-04-14T10:01:00.000Z", "tenant-b");
        repo.insertSession({
            id: "session-candidate-a",
            taskId: "task-candidate-a",
            channel: "slack",
            status: "streaming",
            externalSessionId: "ext-a",
            createdAt: "2026-04-14T10:00:00.000Z",
            updatedAt: "2026-04-14T10:05:00.000Z",
        });
        repo.insertSession({
            id: "session-candidate-b",
            taskId: "task-candidate-b",
            channel: "slack",
            status: "open",
            externalSessionId: "ext-b",
            createdAt: "2026-04-14T10:01:00.000Z",
            updatedAt: "2026-04-14T10:06:00.000Z",
        });
        repo.insertSession({
            id: "session-candidate-cli",
            taskId: "task-candidate-a",
            channel: "cli",
            status: "open",
            externalSessionId: null,
            createdAt: "2026-04-14T10:02:00.000Z",
            updatedAt: "2026-04-14T10:07:00.000Z",
        });
        repo.insertMessage({
            id: "msg-candidate-a-1",
            sessionId: "session-candidate-a",
            direction: "inbound",
            messageType: "text",
            content: "older message",
            partsJson: null,
            attachmentsJson: null,
            createdAt: "2026-04-14T10:03:00.000Z",
        });
        repo.insertMessage({
            id: "msg-candidate-a-2",
            sessionId: "session-candidate-a",
            direction: "outbound",
            messageType: "text",
            content: "latest preview",
            partsJson: null,
            attachmentsJson: null,
            createdAt: "2026-04-14T10:04:00.000Z",
        });
        const candidates = repo.listGatewaySessionTargetCandidates(10, "slack", "tenant-a");
        assert.equal(candidates.length, 1);
        assert.deepEqual(candidates[0], {
            sessionId: "session-candidate-a",
            taskId: "task-candidate-a",
            channel: "slack",
            sessionStatus: "streaming",
            externalSessionId: "ext-a",
            taskTitle: "Test task",
            latestMessage: "latest preview",
            latestMessageAt: "2026-04-14T10:04:00.000Z",
            lastSeenAt: "2026-04-14T10:05:00.000Z",
        });
    }
    finally {
        cleanupPath(workspace);
    }
});
test("SessionRepository insertSession violates primary key constraint throws error", () => {
    const workspace = createTempWorkspace("aa-session-repo-");
    const dbPath = join(workspace, "session-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new SessionRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-session-dup", now);
        repo.insertSession({
            id: "session-duplicate",
            taskId: "task-session-dup",
            channel: "cli",
            status: "open",
            externalSessionId: null,
            createdAt: now,
            updatedAt: now,
        });
        assert.throws(() => {
            repo.insertSession({
                id: "session-duplicate",
                taskId: "task-session-dup",
                channel: "api",
                status: "streaming",
                externalSessionId: "ext-dup",
                createdAt: now,
                updatedAt: now,
            });
        }, /UNIQUE.*session-duplicate|UNIQUE constraint failed/i);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("SessionRepository column mapping snake_case to camelCase is correct", () => {
    const workspace = createTempWorkspace("aa-session-repo-");
    const dbPath = join(workspace, "session-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new SessionRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-session-cols", now);
        repo.insertSession({
            id: "session-columns",
            taskId: "task-session-cols",
            channel: "api",
            status: "streaming",
            externalSessionId: "ext-123",
            createdAt: now,
            updatedAt: now,
        });
        const result = repo.getSession("session-columns");
        assert.ok(result);
        assert.equal(result.taskId, "task-session-cols");
        assert.equal(result.channel, "api");
        assert.equal(result.status, "streaming");
        assert.equal(result.externalSessionId, "ext-123");
        assert.equal(result.createdAt, now);
        assert.equal(result.updatedAt, now);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("SessionRepository rejects insertion with non-existent task_id FK", () => {
    const workspace = createTempWorkspace("aa-session-repo-");
    const dbPath = join(workspace, "session-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new SessionRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        // Attempt to insert session with non-existent task_id
        assert.throws(() => {
            repo.insertSession({
                id: "session-fk-task",
                taskId: "nonexistent-task-id",
                channel: "cli",
                status: "open",
                externalSessionId: null,
                createdAt: now,
                updatedAt: now,
            });
        }, (error) => {
            const message = error instanceof Error ? error.message : String(error);
            return message.includes("FOREIGN KEY") || message.includes("constraint");
        });
    }
    finally {
        cleanupPath(workspace);
    }
});
test("SessionRepository session summaries return the latest record", () => {
    const workspace = createTempWorkspace("aa-session-repo-");
    const dbPath = join(workspace, "session-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new SessionRepository(db.connection);
        createTestSession(db, "session-summary", "task-summary", "2026-04-14T10:00:00.000Z");
        repo.insertSessionSummary({
            id: "summary-1",
            sessionId: "session-summary",
            taskId: "task-summary",
            agentId: "agent-1",
            summaryText: "first summary",
            keyDecisions: null,
            keyOutcomes: null,
            memoryIdsReferenced: null,
            tokenCount: 100,
            createdAt: "2026-04-14T10:01:00.000Z",
        });
        repo.insertSessionSummary({
            id: "summary-2",
            sessionId: "session-summary",
            taskId: "task-summary",
            agentId: "agent-1",
            summaryText: "latest summary",
            keyDecisions: "[]",
            keyOutcomes: "[]",
            memoryIdsReferenced: "[]",
            tokenCount: 120,
            createdAt: "2026-04-14T10:02:00.000Z",
        });
        const result = repo.getLatestSessionSummary("session-summary");
        assert.ok(result);
        assert.equal(result.id, "summary-2");
        assert.equal(result.summaryText, "latest summary");
        assert.equal(result.tokenCount, 120);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("SessionRepository compaction records and session events support tenant-scoped listing", () => {
    const workspace = createTempWorkspace("aa-session-repo-");
    const dbPath = join(workspace, "session-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new SessionRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-session-tenant-a", now);
        createTestTask(db, "task-session-tenant-b", now);
        db.connection.prepare(`UPDATE tasks SET tenant_id = ? WHERE id = ?`).run("tenant-a", "task-session-tenant-a");
        db.connection.prepare(`UPDATE tasks SET tenant_id = ? WHERE id = ?`).run("tenant-b", "task-session-tenant-b");
        repo.insertSession({
            id: "session-tenant-a",
            taskId: "task-session-tenant-a",
            channel: "cli",
            status: "open",
            externalSessionId: null,
            createdAt: now,
            updatedAt: now,
        });
        repo.insertSession({
            id: "session-tenant-b",
            taskId: "task-session-tenant-b",
            channel: "cli",
            status: "open",
            externalSessionId: null,
            createdAt: now,
            updatedAt: now,
        });
        repo.insertCompactionRecord({
            id: "compaction-a",
            sessionId: "session-tenant-a",
            taskId: "task-session-tenant-a",
            stage: "summarize",
            sourceMessageIdsJson: "[\"m1\"]",
            summaryText: "tenant a summary",
            summaryRef: null,
            compactionReason: "budget",
            overflowTriggered: 1,
            autoTriggered: 1,
            tokenReductionEstimate: 250,
            createdAt: now,
        });
        repo.insertCompactionRecord({
            id: "compaction-b",
            sessionId: "session-tenant-b",
            taskId: "task-session-tenant-b",
            stage: "trim",
            sourceMessageIdsJson: "[\"m2\"]",
            summaryText: null,
            summaryRef: null,
            compactionReason: "manual",
            overflowTriggered: 0,
            autoTriggered: 0,
            tokenReductionEstimate: 50,
            createdAt: now,
        });
        repo.insertSessionEvent({
            id: "event-1",
            sessionId: "session-tenant-a",
            eventType: "message.created",
            payloadJson: "{\"id\":\"m1\"}",
            createdAt: "2026-04-14T10:00:01.000Z",
        });
        repo.insertSessionEvent({
            id: "event-2",
            sessionId: "session-tenant-a",
            eventType: "message.completed",
            payloadJson: "{\"id\":\"m1\"}",
            createdAt: "2026-04-14T10:00:02.000Z",
        });
        const events = repo.listSessionEvents("session-tenant-a");
        assert.equal(events.length, 2);
        assert.equal(events[0]?.id, "event-1");
        assert.equal(events[1]?.id, "event-2");
        const tenantScoped = repo.listCompactionRecordsBySession("session-tenant-a", "tenant-a");
        assert.equal(tenantScoped.length, 1);
        assert.equal(tenantScoped[0]?.id, "compaction-a");
        const wrongTenant = repo.listCompactionRecordsBySession("session-tenant-a", "tenant-b");
        assert.equal(wrongTenant.length, 0);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=session-repository.test.js.map