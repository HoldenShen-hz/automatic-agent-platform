import assert from "node:assert/strict";
import test from "node:test";

import type {
  ChannelGatewayServiceOptions,
  SendGatewayMessageInput,
  GatewayDeliveryReceipt,
  GatewayRetryQueueSummary,
  TrackedGatewayDeliveryPayload,
} from "../../../../../../src/platform/interface/channel-gateway/types.js";

test("ChannelGatewayServiceOptions interface structure", () => {
  // Test that the options interface can be satisfied
  const options: ChannelGatewayServiceOptions = {
    fetchImpl: undefined,
  };
  assert.ok(options);
});

test("SendGatewayMessageInput requires text field", () => {
  // Test that SendGatewayMessageInput has correct structure
  const input: SendGatewayMessageInput = {
    text: "hello",
  };
  assert.equal(input.text, "hello");
});

test("SendGatewayMessageInput with channel", () => {
  const input: SendGatewayMessageInput = {
    channel: "telegram",
    targetId: "user-123",
    text: "hello",
  };
  assert.equal(input.channel, "telegram");
  assert.equal(input.targetId, "user-123");
});

test("SendGatewayMessageInput with query", () => {
  const input: SendGatewayMessageInput = {
    query: "john doe",
    text: "hello",
  };
  assert.equal(input.query, "john doe");
});

test("SendGatewayMessageInput with optional metadata", () => {
  const input: SendGatewayMessageInput = {
    text: "hello",
    metadata: { key: "value" },
  };
  assert.deepEqual(input.metadata, { key: "value" });
});

test("SendGatewayMessageInput allows null metadata", () => {
  const input: SendGatewayMessageInput = {
    text: "hello",
    metadata: null,
  };
  assert.equal(input.metadata, null);
});

test("GatewayDeliveryReceipt structure", () => {
  const receipt: GatewayDeliveryReceipt = {
    deliveredAt: "2026-04-26T10:00:00.000Z",
    channel: "telegram",
    targetId: "user-123",
    externalTargetId: "ext-456",
    requestUrl: "https://api.telegram.org/bot123/sendMessage",
    responseStatus: 200,
    providerMessageId: "msg-789",
  };
  assert.equal(receipt.channel, "telegram");
  assert.equal(receipt.responseStatus, 200);
  assert.equal(receipt.providerMessageId, "msg-789");
});

test("GatewayDeliveryReceipt with null externalTargetId", () => {
  const receipt: GatewayDeliveryReceipt = {
    deliveredAt: "2026-04-26T10:00:00.000Z",
    channel: "webhook",
    targetId: "webhook-123",
    externalTargetId: null,
    requestUrl: "https://example.com/webhook",
    responseStatus: 200,
    providerMessageId: null,
  };
  assert.equal(receipt.externalTargetId, null);
  assert.equal(receipt.providerMessageId, null);
});

test("GatewayRetryQueueSummary structure", () => {
  const summary: GatewayRetryQueueSummary = {
    scanned: 100,
    delivered: 90,
    retryScheduled: 8,
    deadLettered: 1,
    skippedRateLimited: 1,
  };
  assert.equal(summary.scanned, 100);
  assert.equal(summary.delivered, 90);
  assert.equal(summary.deadLettered, 1);
});

test("GatewayRetryQueueSummary with zero values", () => {
  const summary: GatewayRetryQueueSummary = {
    scanned: 0,
    delivered: 0,
    retryScheduled: 0,
    deadLettered: 0,
    skippedRateLimited: 0,
  };
  assert.equal(summary.scanned, 0);
});

test("TrackedGatewayDeliveryPayload structure", () => {
  const payload: TrackedGatewayDeliveryPayload = {
    targetId: "user-123",
    text: "hello",
  };
  assert.equal(payload.targetId, "user-123");
  assert.equal(payload.text, "hello");
});

test("TrackedGatewayDeliveryPayload with optional metadata", () => {
  const payload: TrackedGatewayDeliveryPayload = {
    targetId: "user-123",
    text: "hello",
    metadata: { priority: "high" },
  };
  assert.deepEqual(payload.metadata, { priority: "high" });
});

test("TelegramGatewayConfig structure", () => {
  const config: import("../../../../../../src/platform/interface/channel-gateway/types.js").TelegramGatewayConfig = {
    botToken: "12345:ABC",
    baseUrl: "https://api.telegram.org",
  };
  assert.equal(config.botToken, "12345:ABC");
  assert.equal(config.baseUrl, "https://api.telegram.org");
});

test("TelegramGatewayConfig without optional baseUrl", () => {
  const config: import("../../../../../../src/platform/interface/channel-gateway/types.js").TelegramGatewayConfig = {
    botToken: "12345:ABC",
  };
  assert.ok(!config.baseUrl);
});

test("SlackGatewayConfig structure", () => {
  const config: import("../../../../../../src/platform/interface/channel-gateway/types.js").SlackGatewayConfig = {
    botToken: "xoxb-12345",
    baseUrl: "https://slack.com/api",
  };
  assert.equal(config.botToken, "xoxb-12345");
});

test("WebhookGatewayConfig structure", () => {
  const config: import("../../../../../../src/platform/interface/channel-gateway/types.js").WebhookGatewayConfig = {
    defaultHeaders: { Authorization: "Bearer token" },
  };
  assert.deepEqual(config.defaultHeaders, { Authorization: "Bearer token" });
});

test("WebhookGatewayConfig without optional headers", () => {
  const config: import("../../../../../../src/platform/interface/channel-gateway/types.js").WebhookGatewayConfig = {};
  assert.ok(!config.defaultHeaders);
});