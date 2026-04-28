/**
 * Integration tests for Channel Gateway
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import { ChannelGatewayService } from "../../../../../src/platform/interface/channel-gateway/channel-gateway-service.js";
import { ChannelGatewayDeliveryService } from "../../../../../src/platform/interface/channel-gateway/channel-gateway-delivery-service.js";
import { GatewayTargetDirectoryService } from "../../../../../src/platform/interface/channel-gateway/gateway-target-directory-service.js";
import { GatewayStorageAdapter } from "../../../../../src/platform/interface/channel-gateway/storage-adapter.js";
import { newId } from "../../../../../src/platform/contracts/types/ids.js";

test("Integration: ChannelGatewayService sends message through full pipeline", async () => {
  const ctx = createIntegrationContext("aa-channel-gateway-");
  try {
    const targetDir = new GatewayTargetDirectoryService(ctx.store);
    const storageAdapter = new GatewayStorageAdapter(ctx.store);
    const deliveryService = new ChannelGatewayDeliveryService(ctx.db);

    targetDir.registerTarget({
      channel: "webhook",
      targetKind: "room",
      externalTargetId: "https://example.test/webhook",
      displayName: "Test Webhook",
      aliases: ["test"],
    });

    let requestCount = 0;
    const mockFetch = async (url: string): Promise<Response> => {
      requestCount++;
      return new Response(JSON.stringify({ ok: true }), { status: 202 });
    };

    const service = new ChannelGatewayService(storageAdapter, targetDir, {
      fetchImpl: mockFetch as unknown as typeof fetch,
      deliveryService,
    });

    const receipt = await service.sendMessage({
      targetId: targetDir.listTargets()[0]!.targetId,
      text: "Integration test message",
    });

    assert.equal(receipt.channel, "webhook");
    assert.equal(requestCount, 1);
  } finally {
    ctx.cleanup();
  }
});

test("Integration: ChannelGatewayDeliveryService tracks delivery lifecycle", async () => {
  const ctx = createIntegrationContext("aa-delivery-tracking-");
  try {
    const deliveryService = new ChannelGatewayDeliveryService(ctx.db);

    const delivery = deliveryService.createDeliveryMessage("webhook", "target-123", {
      targetId: "target-123",
      text: "Test message",
    });

    assert.ok(delivery.messageId.length > 0);
    assert.equal(delivery.channel, "webhook");
    assert.equal(delivery.targetId, "target-123");

    const receipt = deliveryService.recordAttempt(delivery.messageId, "webhook", "target-123", 1, 202, null);
    assert.equal(receipt.status, "success");
    assert.equal(receipt.attempts, 1);

    const stored = deliveryService.getDeliveryReceipt(delivery.messageId);
    assert.equal(stored?.status, "delivered");
    assert.equal(stored?.attempts, 1);
  } finally {
    ctx.cleanup();
  }
});

test("Integration: GatewayTargetDirectoryService resolves targets", async () => {
  const ctx = createIntegrationContext("aa-target-directory-");
  try {
    const targetDir = new GatewayTargetDirectoryService(ctx.store);

    const registered = targetDir.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "user-123",
      displayName: "Test User",
      aliases: ["testuser"],
    });

    const resolved = targetDir.resolveTarget({ query: "testuser" });

    assert.equal(resolved.entry.targetId, registered.targetId);
    assert.equal(resolved.entry.channel, "telegram");
    assert.equal(resolved.matchedBy, "alias_exact");
  } finally {
    ctx.cleanup();
  }
});

test("Integration: GatewayTargetDirectoryService handles empty query", async () => {
  const ctx = createIntegrationContext("aa-empty-query-");
  try {
    const targetDir = new GatewayTargetDirectoryService(ctx.store);

    targetDir.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "user-123",
      displayName: "Test User",
    });

    await assert.rejects(
      () => targetDir.resolveTarget({ query: "" }),
      /gateway.target_query_required/,
    );
  } finally {
    ctx.cleanup();
  }
});

test("Integration: GatewayTargetDirectoryService listTargets with limit", async () => {
  const ctx = createIntegrationContext("aa-list-targets-");
  try {
    const targetDir = new GatewayTargetDirectoryService(ctx.store);

    for (let i = 0; i < 5; i++) {
      targetDir.registerTarget({
        channel: "telegram",
        targetKind: "user",
        externalTargetId: `user-${i}`,
        displayName: `User ${i}`,
      });
    }

    const all = targetDir.listTargets();
    assert.ok(all.length >= 5);

    const limited = targetDir.listTargets({ limit: 2 });
    assert.equal(limited.length, 2);
  } finally {
    ctx.cleanup();
  }
});

test("Integration: GatewayTargetDirectoryService listTargets with channel filter", async () => {
  const ctx = createIntegrationContext("aa-channel-filter-");
  try {
    const targetDir = new GatewayTargetDirectoryService(ctx.store);

    targetDir.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "telegram-user",
      displayName: "Telegram User",
    });

    targetDir.registerTarget({
      channel: "slack",
      targetKind: "room",
      externalTargetId: "slack-room",
      displayName: "Slack Room",
    });

    const telegramTargets = targetDir.listTargets({ channel: "telegram" });
    assert.equal(telegramTargets.length, 1);
    assert.equal(telegramTargets[0]!.channel, "telegram");

    const slackTargets = targetDir.listTargets({ channel: "slack" });
    assert.equal(slackTargets.length, 1);
    assert.equal(slackTargets[0]!.channel, "slack");
  } finally {
    ctx.cleanup();
  }
});

test("Integration: ChannelGatewayDeliveryService rate limiting", async () => {
  const ctx = createIntegrationContext("aa-rate-limit-");
  try {
    const deliveryService = new ChannelGatewayDeliveryService(ctx.db, {
      rateLimit: {
        webhook: { limit: 2, windowMs: 60000 },
      },
    });

    const result1 = deliveryService.checkRateLimit("webhook");
    assert.equal(result1.allowed, true);

    const result2 = deliveryService.checkRateLimit("webhook");
    assert.equal(result2.allowed, true);

    const result3 = deliveryService.checkRateLimit("webhook");
    assert.equal(result3.allowed, false);
    assert.equal(result3.retryAfterMs, 60000);
  } finally {
    ctx.cleanup();
  }
});

test("Integration: processRetryQueue returns summary", async () => {
  const ctx = createIntegrationContext("aa-retry-queue-");
  try {
    const targetDir = new GatewayTargetDirectoryService(ctx.store);
    const storageAdapter = new GatewayStorageAdapter(ctx.store);
    const deliveryService = new ChannelGatewayDeliveryService(ctx.db);

    targetDir.registerTarget({
      channel: "webhook",
      targetKind: "room",
      externalTargetId: "https://example.test/webhook",
      displayName: "Retry Test",
    });

    const service = new ChannelGatewayService(storageAdapter, targetDir, {
      fetchImpl: async () => new Response("", { status: 202 }),
      deliveryService,
    });

    const result = await service.processRetryQueue();

    assert.equal(typeof result.scanned, "number");
    assert.equal(typeof result.delivered, "number");
    assert.equal(typeof result.retryScheduled, "number");
    assert.equal(typeof result.deadLettered, "number");
    assert.equal(typeof result.skippedRateLimited, "number");
  } finally {
    ctx.cleanup();
  }
});

test("Integration: sendMessage without delivery service", async () => {
  const ctx = createIntegrationContext("aa-no-delivery-");
  try {
    const targetDir = new GatewayTargetDirectoryService(ctx.store);
    const storageAdapter = new GatewayStorageAdapter(ctx.store);

    targetDir.registerTarget({
      channel: "webhook",
      targetKind: "room",
      externalTargetId: "https://example.test/webhook",
      displayName: "No Delivery Service",
    });

    let requestCount = 0;
    const service = new ChannelGatewayService(storageAdapter, targetDir, {
      fetchImpl: async () => {
        requestCount++;
        return new Response(JSON.stringify({ ok: true }), { status: 202 });
      },
    });

    const result = await service.processRetryQueue();
    assert.equal(result.scanned, 0);
    assert.equal(requestCount, 0);
  } finally {
    ctx.cleanup();
  }
});
