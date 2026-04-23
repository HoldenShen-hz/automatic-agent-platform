import assert from "node:assert/strict";
import test from "node:test";
import { ChannelGatewayDeliveryService, CHANNEL_DELIVERY_DDL } from "../../../../../src/platform/interface/channel-gateway/channel-gateway-delivery-service.js";
import { ChannelGatewayService } from "../../../../../src/platform/interface/channel-gateway/channel-gateway-service.js";
import { GatewayTargetDirectoryService } from "../../../../../src/platform/interface/channel-gateway/gateway-target-directory-service.js";
import { GatewayStorageAdapter } from "../../../../../src/platform/interface/channel-gateway/storage-adapter.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { join } from "node:path";
function createGatewayTestHarness() {
    const workspace = createTempWorkspace("aa-gateway-integration-");
    const dbPath = join(workspace, "gateway.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.connection.exec(CHANNEL_DELIVERY_DDL);
    const store = new AuthoritativeTaskStore(db);
    const storageAdapter = new GatewayStorageAdapter(store);
    const targets = new GatewayTargetDirectoryService(storageAdapter);
    const capturedRequests = [];
    const defaultFetchImpl = async (input, init) => {
        capturedRequests.push({
            url: typeof input === "string" ? input : input.toString(),
            method: init?.method ?? "GET",
            headers: Object.fromEntries(Object.entries((init?.headers ?? {})).map(([name, value]) => [
                name.toLowerCase(),
                value,
            ])),
            body: init?.body ? JSON.parse(String(init.body)) : null,
        });
        if (capturedRequests[capturedRequests.length - 1]?.url.includes("telegram")) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ result: { message_id: 888 } }),
            };
        }
        if (capturedRequests[capturedRequests.length - 1]?.url.includes("slack")) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ ok: true, ts: "1710000001.123456" }),
            };
        }
        if (capturedRequests[capturedRequests.length - 1]?.url.includes("webhook")) {
            return {
                ok: true,
                status: 202,
                json: async () => ({ received: true }),
            };
        }
        return {
            ok: true,
            status: 202,
            json: async () => ({ ok: true }),
        };
    };
    const deliveryService = new ChannelGatewayDeliveryService(db);
    const channelGateway = new ChannelGatewayService(storageAdapter, targets, {
        fetchImpl: defaultFetchImpl,
        telegram: {
            botToken: "test-telegram-token",
            baseUrl: "https://telegram.example.test",
        },
        slack: {
            botToken: "test-slack-token",
            baseUrl: "https://slack.example.test",
        },
        webhook: {
            defaultHeaders: {
                "x-gateway-source": "integration-test",
            },
        },
        deliveryService,
    });
    return {
        workspace,
        db,
        store,
        targets,
        deliveryService,
        channelGateway,
        capturedRequests,
        cleanup() {
            db.close();
            cleanupPath(workspace);
        },
    };
}
test("GatewayTargetDirectoryService registers and resolves targets", () => {
    const h = createGatewayTestHarness();
    try {
        const target = h.targets.registerTarget({
            channel: "telegram",
            targetKind: "user",
            externalTargetId: "test-user-123",
            displayName: "Test User",
            aliases: ["test", "user"],
        });
        assert.ok(target.targetId.length > 0);
        assert.ok(target.targetId.includes(":"));
        const resolved = h.targets.resolveTarget({ query: target.targetId });
        assert.ok(resolved != null);
        assert.equal(resolved?.entry.displayName, "Test User");
        assert.equal(resolved?.entry.externalTargetId, "test-user-123");
        const byAlias = h.targets.listTargets({ query: "test" });
        assert.ok(byAlias.length >= 1);
        assert.ok(byAlias.some((t) => t.targetId === target.targetId));
    }
    finally {
        h.cleanup();
    }
});
test("GatewayTargetDirectoryService resolves targets by channel filter", () => {
    const h = createGatewayTestHarness();
    try {
        h.targets.registerTarget({
            channel: "telegram",
            targetKind: "user",
            externalTargetId: "telegram-user-1",
            displayName: "Telegram User",
            aliases: ["tg"],
        });
        h.targets.registerTarget({
            channel: "slack",
            targetKind: "room",
            externalTargetId: "slack-room-1",
            displayName: "Slack Room",
            aliases: ["sl"],
        });
        h.targets.registerTarget({
            channel: "webhook",
            targetKind: "room",
            externalTargetId: "https://example.test/webhook",
            displayName: "Webhook Room",
            aliases: ["wh"],
        });
        const telegramTargets = h.targets.listTargets({ channel: "telegram" });
        assert.equal(telegramTargets.length, 1);
        assert.equal(telegramTargets[0]?.displayName, "Telegram User");
        const slackTargets = h.targets.listTargets({ channel: "slack" });
        assert.equal(slackTargets.length, 1);
        assert.equal(slackTargets[0]?.displayName, "Slack Room");
        const allTargets = h.targets.listTargets({});
        assert.equal(allTargets.length, 3);
    }
    finally {
        h.cleanup();
    }
});
test("ChannelGatewayDeliveryService rate limiting works", () => {
    const h = createGatewayTestHarness();
    try {
        const rateLimitedService = new ChannelGatewayDeliveryService(h.db, {
            rateLimit: {
                webhook: {
                    limit: 2,
                    windowMs: 60000,
                },
            },
        });
        const target = h.targets.registerTarget({
            channel: "webhook",
            targetKind: "room",
            externalTargetId: "https://example.test/rate-test",
            displayName: "Rate Test",
            aliases: [],
        });
        // First two should be allowed
        const result1 = rateLimitedService.checkRateLimit("webhook");
        assert.equal(result1.allowed, true);
        // Record one
        rateLimitedService.recordRateLimitHit("webhook");
        const result2 = rateLimitedService.checkRateLimit("webhook");
        assert.equal(result2.allowed, true);
        // Record two - now at limit
        rateLimitedService.recordRateLimitHit("webhook");
        const result3 = rateLimitedService.checkRateLimit("webhook");
        assert.equal(result3.allowed, false);
        assert.equal(result3.currentCount, 2);
    }
    finally {
        h.cleanup();
    }
});
test("ChannelGatewayDeliveryService creates and tracks delivery messages", () => {
    const h = createGatewayTestHarness();
    try {
        const target = h.targets.registerTarget({
            channel: "webhook",
            targetKind: "room",
            externalTargetId: "https://example.test/delivery-track",
            displayName: "Delivery Track",
            aliases: [],
        });
        const message = h.deliveryService.createDeliveryMessage("webhook", target.targetId, { text: "Test message", metadata: { traceId: "trace-1" } });
        assert.ok(message.messageId.startsWith("dlvmsg_"));
        assert.equal(message.channel, "webhook");
        assert.equal(message.status, "pending_retry");
        const receipt = h.deliveryService.getDeliveryReceipt(message.messageId);
        assert.ok(receipt != null);
        assert.equal(receipt.status, "pending_retry");
        const attempt = h.deliveryService.recordAttempt(message.messageId, 1, "success", 200);
        assert.ok(attempt.attemptId.startsWith("dlvatt_"));
        assert.equal(attempt.status, "success");
        assert.equal(attempt.responseStatus, 200);
        const updatedReceipt = h.deliveryService.getDeliveryReceipt(message.messageId);
        assert.equal(updatedReceipt?.status, "delivered");
        assert.equal(updatedReceipt?.finalStatus, "success");
    }
    finally {
        h.cleanup();
    }
});
test("ChannelGatewayDeliveryService dead-letters exhausted messages", () => {
    const h = createGatewayTestHarness();
    try {
        const target = h.targets.registerTarget({
            channel: "webhook",
            targetKind: "room",
            externalTargetId: "https://example.test/dead-letter",
            displayName: "Dead Letter Test",
            aliases: [],
        });
        const message = h.deliveryService.createDeliveryMessage("webhook", target.targetId, { text: "Will fail" }, 2);
        // First failure - should schedule retry
        const failure1 = h.deliveryService.recordDeliveryFailure(message.messageId, {
            responseStatus: 503,
            errorMessage: "Service unavailable",
            retryable: true,
        });
        assert.equal(failure1?.outcome, "retry_scheduled");
        // Second failure - should dead-letter
        const failure2 = h.deliveryService.recordDeliveryFailure(message.messageId, {
            responseStatus: 503,
            errorMessage: "Still unavailable",
            retryable: true,
        });
        assert.equal(failure2?.outcome, "dead_lettered");
        const deadLetters = h.deliveryService.getDeadLetters();
        assert.equal(deadLetters.length, 1);
        assert.ok(deadLetters[0]?.failureReason === "gateway.delivery_retries_exhausted"
            || deadLetters[0]?.failureReason === "gateway.delivery_non_retryable_failure");
    }
    finally {
        h.cleanup();
    }
});
test("ChannelGatewayService sends telegram messages end-to-end", async () => {
    const h = createGatewayTestHarness();
    try {
        const target = h.targets.registerTarget({
            channel: "telegram",
            targetKind: "user",
            externalTargetId: "telegram-chat-456",
            displayName: "Telegram Chat",
            aliases: ["chat"],
        });
        const receipt = await h.channelGateway.sendMessage({
            targetId: target.targetId,
            text: "Hello from integration test",
        });
        assert.equal(receipt.channel, "telegram");
        assert.equal(receipt.providerMessageId, "888");
        assert.equal(h.capturedRequests.length, 1);
        assert.ok(h.capturedRequests[0]?.url.includes("sendMessage"));
    }
    finally {
        h.cleanup();
    }
});
test("ChannelGatewayService sends slack messages with authorization", async () => {
    const h = createGatewayTestHarness();
    try {
        const target = h.targets.registerTarget({
            channel: "slack",
            targetKind: "room",
            externalTargetId: "C_SLACK_CHANNEL",
            displayName: "Slack Channel",
            aliases: ["channel"],
        });
        const receipt = await h.channelGateway.sendMessage({
            targetId: target.targetId,
            text: "Slack message with auth",
        });
        assert.equal(receipt.channel, "slack");
        assert.equal(receipt.providerMessageId, "1710000001.123456");
        assert.equal(h.capturedRequests[0]?.headers.authorization, "Bearer test-slack-token");
    }
    finally {
        h.cleanup();
    }
});
test("ChannelGatewayService rejects internal webhook URLs (SSRF protection)", async () => {
    const h = createGatewayTestHarness();
    try {
        const target = h.targets.registerTarget({
            channel: "webhook",
            targetKind: "room",
            externalTargetId: "http://127.0.0.1:9999/internal-webhook",
            displayName: "Blocked Internal Webhook",
            aliases: [],
        });
        await assert.rejects(h.channelGateway.sendMessage({
            targetId: target.targetId,
            text: "This should be blocked",
        }), /gateway\.webhook_url_blocked_ssrf/);
        assert.equal(h.capturedRequests.length, 0);
    }
    finally {
        h.cleanup();
    }
});
test("ChannelGatewayService uses query alias to resolve targets", async () => {
    const h = createGatewayTestHarness();
    try {
        const target = h.targets.registerTarget({
            channel: "telegram",
            targetKind: "user",
            externalTargetId: "alias-test-user",
            displayName: "Alias Test User",
            aliases: ["alias-query", "myalias"],
        });
        const receipt = await h.channelGateway.sendMessage({
            channel: "telegram",
            query: "myalias",
            text: "Message via alias",
        });
        assert.equal(receipt.channel, "telegram");
        assert.equal(receipt.providerMessageId, "888");
    }
    finally {
        h.cleanup();
    }
});
test("ChannelGatewayService processes retry queue successfully", async () => {
    const h = createGatewayTestHarness();
    try {
        const target = h.targets.registerTarget({
            channel: "webhook",
            targetKind: "room",
            externalTargetId: "https://example.test/retry-queue",
            displayName: "Retry Queue Test",
            aliases: [],
        });
        // Create a message that will be queued
        const message = h.deliveryService.createDeliveryMessage("webhook", target.targetId, { text: "Retry test" });
        // Process the retry queue - should find no messages since none failed
        const summary = await h.channelGateway.processRetryQueue();
        assert.equal(summary.scanned, 0);
        assert.equal(summary.delivered, 0);
    }
    finally {
        h.cleanup();
    }
});
test("GatewayTargetDirectoryService updates existing targets", () => {
    const h = createGatewayTestHarness();
    try {
        const original = h.targets.registerTarget({
            channel: "telegram",
            targetKind: "user",
            externalTargetId: "update-test-user",
            displayName: "Original Name",
            aliases: ["original"],
        });
        h.targets.registerTarget({
            channel: "telegram",
            targetKind: "user",
            externalTargetId: "update-test-user",
            displayName: "Updated Name",
            aliases: ["updated"],
        });
        const resolved = h.targets.resolveTarget({ query: original.targetId });
        assert.ok(resolved != null);
        assert.equal(resolved?.entry.displayName, "Updated Name");
    }
    finally {
        h.cleanup();
    }
});
//# sourceMappingURL=channel-gateway-integration.test.js.map