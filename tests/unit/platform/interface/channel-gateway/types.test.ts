import test from "node:test";
import assert from "node:assert/strict";

import type {
  FetchLike,
  TelegramGatewayConfig,
  SlackGatewayConfig,
  WebhookGatewayConfig,
  ChannelGatewayServiceOptions,
  SendGatewayMessageInput,
  GatewayDeliveryReceipt,
  GatewayRetryQueueSummary,
  TrackedGatewayDeliveryPayload,
} from "../../../../../src/platform/interface/channel-gateway/types.js";

test("channel-gateway/types: TelegramGatewayConfig structure", () => {
  const config: TelegramGatewayConfig = {
    botToken: "123456:ABC-DEF",
    baseUrl: "https://api.telegram.org",
  };
  assert.equal(config.botToken, "123456:ABC-DEF");
  assert.equal(config.baseUrl, "https://api.telegram.org");
});

test("channel-gateway/types: TelegramGatewayConfig without optional baseUrl", () => {
  const config: TelegramGatewayConfig = {
    botToken: "test_token",
  };
  assert.equal(config.botToken, "test_token");
  assert.equal(config.baseUrl, undefined);
});

test("channel-gateway/types: SlackGatewayConfig structure", () => {
  const config: SlackGatewayConfig = {
    botToken: "xoxb-test-token",
    baseUrl: "https://slack.com/api",
  };
  assert.equal(config.botToken, "xoxb-test-token");
  assert.equal(config.baseUrl, "https://slack.com/api");
});

test("channel-gateway/types: SlackGatewayConfig without optional baseUrl", () => {
  const config: SlackGatewayConfig = {
    botToken: "xoxb-test",
  };
  assert.equal(config.botToken, "xoxb-test");
  assert.equal(config.baseUrl, undefined);
});

test("channel-gateway/types: WebhookGatewayConfig structure", () => {
  const config: WebhookGatewayConfig = {
    defaultHeaders: { Authorization: "Bearer token123" },
  };
  assert.deepEqual(config.defaultHeaders, { Authorization: "Bearer token123" });
});

test("channel-gateway/types: WebhookGatewayConfig without optional headers", () => {
  const config: WebhookGatewayConfig = {};
  assert.equal(config.defaultHeaders, undefined);
});

test("channel-gateway/types: SendGatewayMessageInput with targetId", () => {
  const input: SendGatewayMessageInput = {
    channel: "telegram",
    targetId: "user_123",
    text: "Hello world",
  };
  assert.equal(input.channel, "telegram");
  assert.equal(input.targetId, "user_123");
  assert.equal(input.text, "Hello world");
  assert.equal(input.query, undefined);
  assert.equal(input.metadata, undefined);
});

test("channel-gateway/types: SendGatewayMessageInput with query", () => {
  const input: SendGatewayMessageInput = {
    query: "find user by email",
    text: "Test message",
    metadata: { priority: "high" },
  };
  assert.equal(input.query, "find user by email");
  assert.equal(input.text, "Test message");
  assert.deepEqual(input.metadata, { priority: "high" });
  assert.equal(input.channel, undefined);
  assert.equal(input.targetId, undefined);
});

test("channel-gateway/types: GatewayDeliveryReceipt structure", () => {
  const receipt: GatewayDeliveryReceipt = {
    deliveredAt: "2026-04-26T10:00:00Z",
    channel: "slack",
    targetId: "channel_123",
    externalTargetId: "C123456",
    requestUrl: "https://slack.com/api/chat.postMessage",
    responseStatus: 200,
    providerMessageId: "1234567890.123456",
  };
  assert.equal(receipt.channel, "slack");
  assert.equal(receipt.targetId, "channel_123");
  assert.equal(receipt.externalTargetId, "C123456");
  assert.equal(receipt.responseStatus, 200);
  assert.equal(receipt.providerMessageId, "1234567890.123456");
});

test("channel-gateway/types: GatewayDeliveryReceipt with null externalTargetId", () => {
  const receipt: GatewayDeliveryReceipt = {
    deliveredAt: "2026-04-26T10:00:00Z",
    channel: "webhook",
    targetId: "webhook_456",
    externalTargetId: null,
    requestUrl: "https://example.com/webhook",
    responseStatus: 200,
    providerMessageId: null,
  };
  assert.equal(receipt.externalTargetId, null);
  assert.equal(receipt.providerMessageId, null);
});

test("channel-gateway/types: GatewayRetryQueueSummary structure", () => {
  const summary: GatewayRetryQueueSummary = {
    scanned: 100,
    delivered: 80,
    retryScheduled: 15,
    deadLettered: 3,
    skippedRateLimited: 2,
  };
  assert.equal(summary.scanned, 100);
  assert.equal(summary.delivered, 80);
  assert.equal(summary.retryScheduled, 15);
  assert.equal(summary.deadLettered, 3);
  assert.equal(summary.skippedRateLimited, 2);
});

test("channel-gateway/types: GatewayRetryQueueSummary with zero values", () => {
  const summary: GatewayRetryQueueSummary = {
    scanned: 0,
    delivered: 0,
    retryScheduled: 0,
    deadLettered: 0,
    skippedRateLimited: 0,
  };
  assert.equal(summary.scanned, 0);
  assert.equal(summary.delivered, 0);
});

test("channel-gateway/types: TrackedGatewayDeliveryPayload structure", () => {
  const payload: TrackedGatewayDeliveryPayload = {
    targetId: "user_789",
    text: "Tracked message",
    metadata: { batchId: "batch_123" },
  };
  assert.equal(payload.targetId, "user_789");
  assert.equal(payload.text, "Tracked message");
  assert.deepEqual(payload.metadata, { batchId: "batch_123" });
});

test("channel-gateway/types: TrackedGatewayDeliveryPayload without optional metadata", () => {
  const payload: TrackedGatewayDeliveryPayload = {
    targetId: "user_000",
    text: "Simple message",
  };
  assert.equal(payload.targetId, "user_000");
  assert.equal(payload.text, "Simple message");
  assert.equal(payload.metadata, undefined);
});

test("channel-gateway/types: ChannelGatewayServiceOptions with all channels", () => {
  const options: ChannelGatewayServiceOptions = {
    fetchImpl: globalThis.fetch,
    telegram: { botToken: "token123" },
    slack: { botToken: "slack_token" },
    webhook: { defaultHeaders: {} },
  };
  assert.ok(options.fetchImpl);
  assert.ok(options.telegram);
  assert.ok(options.slack);
  assert.ok(options.webhook);
});

test("channel-gateway/types: ChannelGatewayServiceOptions with minimal config", () => {
  const options: ChannelGatewayServiceOptions = {};
  assert.equal(options.fetchImpl, undefined);
  assert.equal(options.telegram, undefined);
  assert.equal(options.slack, undefined);
  assert.equal(options.webhook, undefined);
});

test("channel-gateway/types: SendGatewayMessageInput with all optional fields", () => {
  const input: SendGatewayMessageInput = {
    channel: "telegram",
    query: undefined,
    targetId: "target_123",
    text: "Full message",
    metadata: { attachLogs: true, priority: "urgent" },
  };
  assert.equal(input.channel, "telegram");
  assert.equal(input.targetId, "target_123");
  assert.equal(input.text, "Full message");
  assert.deepEqual(input.metadata, { attachLogs: true, priority: "urgent" });
});