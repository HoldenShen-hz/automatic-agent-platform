// @ts-nocheck
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteAsyncAdapter } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-async-adapter.js";
import { AsyncSessionRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/session-repository.js";
import { AsyncTaskRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/task-repository.js";
import { createTempWorkspace, cleanupPath } from "../../../../../helpers/fs.js";
test.describe("AsyncSessionRepository", () => {
    let harness;
    test.beforeEach(() => {
        const workspace = createTempWorkspace("aa-async-session-repo-");
        const dbPath = join(workspace, "session-repo.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const adapter = new SqliteAsyncAdapter(db);
        const repo = new AsyncSessionRepository(adapter.asyncConnection);
        const taskRepo = new AsyncTaskRepository(adapter.asyncConnection);
        harness = {
            workspace,
            dbPath,
            db,
            adapter,
            repo,
            taskRepo,
            cleanup() {
                db.close();
                cleanupPath(workspace);
            },
        };
    });
    test.afterEach(() => {
        harness.cleanup();
    });
    async function insertTestTask(taskId) {
        const task = {
            id: taskId,
            parentId: null,
            rootId: taskId,
            divisionId: "general_ops",
            tenantId: "tenant-session",
            title: `Task ${taskId}`,
            status: "in_progress",
            source: "user",
            priority: "normal",
            inputJson: "{}",
            normalizedInputJson: "{}",
            outputJson: null,
            estimatedCostUsd: 0,
            actualCostUsd: 0,
            errorCode: null,
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
            completedAt: null,
        };
        await harness.taskRepo.insertTask(task);
    }
    test("insertSession and getSession roundtrip", async () => {
        await insertTestTask("task-session-001");
        const session = {
            id: "session-001",
            taskId: "task-session-001",
            channel: "console",
            status: "active",
            externalSessionId: null,
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.repo.insertSession(session);
        const retrieved = await harness.repo.getSession("session-001");
        assert.equal(retrieved?.id, "session-001");
        assert.equal(retrieved?.taskId, "task-session-001");
        assert.equal(retrieved?.channel, "console");
        assert.equal(retrieved?.status, "active");
    });
    test("getSession returns null for non-existent session", async () => {
        const result = await harness.repo.getSession("non-existent-session");
        assert.equal(result, null);
    });
    test("listSessionsByTask returns sessions for a task", async () => {
        await insertTestTask("task-session-list");
        const sessions = [
            {
                id: "session-list-001",
                taskId: "task-session-list",
                channel: "console",
                status: "active",
                externalSessionId: null,
                createdAt: "2026-04-23T10:00:00.000Z",
                updatedAt: "2026-04-23T10:00:00.000Z",
            },
            {
                id: "session-list-002",
                taskId: "task-session-list",
                channel: "api",
                status: "closed",
                externalSessionId: "ext-456",
                createdAt: "2026-04-23T11:00:00.000Z",
                updatedAt: "2026-04-23T11:00:00.000Z",
            },
        ];
        for (const session of sessions) {
            await harness.repo.insertSession(session);
        }
        const listed = await harness.repo.listSessionsByTask("task-session-list");
        assert.equal(listed.length, 2);
    });
    test("updateSessionStatus updates status and timestamp", async () => {
        await insertTestTask("task-session-update");
        const session = {
            id: "session-update-001",
            taskId: "task-session-update",
            channel: "console",
            status: "active",
            externalSessionId: null,
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.repo.insertSession(session);
        const affected = await harness.repo.updateSessionStatus("session-update-001", "closed", "2026-04-23T12:00:00.000Z");
        assert.equal(affected, 1);
        const retrieved = await harness.repo.getSession("session-update-001");
        assert.equal(retrieved?.status, "closed");
        assert.equal(retrieved?.updatedAt, "2026-04-23T12:00:00.000Z");
    });
    test("insertMessage and listMessagesBySession roundtrip", async () => {
        await insertTestTask("task-msg-001");
        const session = {
            id: "session-msg-001",
            taskId: "task-msg-001",
            channel: "console",
            status: "active",
            externalSessionId: null,
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.repo.insertSession(session);
        const messages = [
            {
                id: "msg-001",
                sessionId: "session-msg-001",
                direction: "inbound",
                messageType: "text",
                content: "Hello",
                partsJson: null,
                attachmentsJson: null,
                createdAt: "2026-04-23T10:01:00.000Z",
            },
            {
                id: "msg-002",
                sessionId: "session-msg-001",
                direction: "outbound",
                messageType: "text",
                content: "Hi there",
                partsJson: null,
                attachmentsJson: null,
                createdAt: "2026-04-23T10:02:00.000Z",
            },
        ];
        for (const msg of messages) {
            await harness.repo.insertMessage(msg);
        }
        const listed = await harness.repo.listMessagesBySession("session-msg-001");
        assert.equal(listed.length, 2);
        assert.equal(listed[0].id, "msg-001");
        assert.equal(listed[0].direction, "inbound");
        assert.equal(listed[1].id, "msg-002");
    });
    test("listMessagesBySession with limit", async () => {
        await insertTestTask("task-msg-limit");
        const session = {
            id: "session-msg-limit",
            taskId: "task-msg-limit",
            channel: "console",
            status: "active",
            externalSessionId: null,
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.repo.insertSession(session);
        for (let i = 0; i < 5; i++) {
            const msg = {
                id: `msg-limit-${i}`,
                sessionId: "session-msg-limit",
                direction: "inbound",
                messageType: "text",
                content: `Message ${i}`,
                partsJson: null,
                attachmentsJson: null,
                createdAt: new Date(2026, 3, 23, 10, i).toISOString(),
            };
            await harness.repo.insertMessage(msg);
        }
        const listed = await harness.repo.listMessagesBySession("session-msg-limit", 3);
        assert.equal(listed.length, 3);
    });
    test("upsertGatewayTarget and getGatewayTarget roundtrip", async () => {
        const target = {
            targetId: "target-001",
            channel: "console",
            targetKind: "user",
            externalTargetId: "user-123",
            displayName: "Test User",
            aliasesJson: '["testuser"]',
            metadataJson: '{"verified": true}',
            source: "oauth",
            lastSeenAt: "2026-04-23T10:00:00.000Z",
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.repo.upsertGatewayTarget(target);
        const retrieved = await harness.repo.getGatewayTarget("target-001");
        assert.equal(retrieved?.targetId, "target-001");
        assert.equal(retrieved?.displayName, "Test User");
        assert.equal(retrieved?.externalTargetId, "user-123");
    });
    test("upsertGatewayTarget updates existing record", async () => {
        const target = {
            targetId: "target-update-001",
            channel: "console",
            targetKind: "user",
            externalTargetId: "user-456",
            displayName: "Original Name",
            aliasesJson: "[]",
            metadataJson: "{}",
            source: "manual",
            lastSeenAt: "2026-04-23T10:00:00.000Z",
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.repo.upsertGatewayTarget(target);
        const updatedTarget = {
            ...target,
            displayName: "Updated Name",
            lastSeenAt: "2026-04-23T11:00:00.000Z",
            updatedAt: "2026-04-23T11:00:00.000Z",
        };
        await harness.repo.upsertGatewayTarget(updatedTarget);
        const retrieved = await harness.repo.getGatewayTarget("target-update-001");
        assert.equal(retrieved?.displayName, "Updated Name");
        assert.equal(retrieved?.lastSeenAt, "2026-04-23T11:00:00.000Z");
    });
    test("listGatewayTargetsByChannel returns targets for channel", async () => {
        const targets = [
            { targetId: "target-list-001", channel: "console", targetKind: "user", externalTargetId: "user-1", displayName: "User One", aliasesJson: "[]", metadataJson: "{}", source: "manual", lastSeenAt: "2026-04-23T10:00:00.000Z", createdAt: "2026-04-23T10:00:00.000Z", updatedAt: "2026-04-23T10:00:00.000Z" },
            { targetId: "target-list-002", channel: "console", targetKind: "user", externalTargetId: "user-2", displayName: "User Two", aliasesJson: "[]", metadataJson: "{}", source: "manual", lastSeenAt: "2026-04-23T10:00:00.000Z", createdAt: "2026-04-23T10:00:00.000Z", updatedAt: "2026-04-23T10:00:00.000Z" },
            { targetId: "target-list-003", channel: "api", targetKind: "bot", externalTargetId: "bot-1", displayName: "Bot One", aliasesJson: "[]", metadataJson: "{}", source: "oauth", lastSeenAt: "2026-04-23T10:00:00.000Z", createdAt: "2026-04-23T10:00:00.000Z", updatedAt: "2026-04-23T10:00:00.000Z" },
        ];
        for (const target of targets) {
            await harness.repo.upsertGatewayTarget(target);
        }
        const consoleTargets = await harness.repo.listGatewayTargetsByChannel("console");
        assert.equal(consoleTargets.length, 2);
        const apiTargets = await harness.repo.listGatewayTargetsByChannel("api");
        assert.equal(apiTargets.length, 1);
    });
    test("insertSessionEvent and listSessionEvents roundtrip", async () => {
        await insertTestTask("task-event-001");
        const session = {
            id: "session-event-001",
            taskId: "task-event-001",
            channel: "console",
            status: "active",
            externalSessionId: null,
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.repo.insertSession(session);
        const events = [
            { id: "se-001", sessionId: "session-event-001", eventType: "session.started", payloadJson: '{"reason":"user_request"}', createdAt: "2026-04-23T10:00:00.000Z" },
            { id: "se-002", sessionId: "session-event-001", eventType: "message.received", payloadJson: '{"messageId":"msg-001"}', createdAt: "2026-04-23T10:01:00.000Z" },
        ];
        for (const event of events) {
            await harness.repo.insertSessionEvent(event);
        }
        const listed = await harness.repo.listSessionEvents("session-event-001", 10);
        assert.equal(listed.length, 2);
        assert.equal(listed[0].eventType, "session.started");
    });
    test("listSessionEvents respects limit", async () => {
        await insertTestTask("task-event-limit");
        const session = {
            id: "session-event-limit",
            taskId: "task-event-limit",
            channel: "console",
            status: "active",
            externalSessionId: null,
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.repo.insertSession(session);
        for (let i = 0; i < 5; i++) {
            const event = { id: `se-limit-${i}`, sessionId: "session-event-limit", eventType: "test.event", payloadJson: "{}", createdAt: new Date(2026, 3, 23, 10, i).toISOString() };
            await harness.repo.insertSessionEvent(event);
        }
        const listed = await harness.repo.listSessionEvents("session-event-limit", 3);
        assert.equal(listed.length, 3);
    });
});
//# sourceMappingURL=session-repository.test.js.map