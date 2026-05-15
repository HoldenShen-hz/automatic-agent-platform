import assert from "node:assert/strict";
import test from "node:test";

import type {
  TelegramGatewayConfig,
  SlackGatewayConfig,
  WebhookGatewayConfig,
  ChannelGatewayServiceOptions,
  SendGatewayMessageInput,
  GatewayDeliveryReceipt,
  GatewayRetryQueueSummary,
  TrackedGatewayDeliveryPayload,
} from "../../../../../src/platform/five-plane-interface/channel-gateway/types.js";

test("TelegramGatewayConfig allows optional baseUrl", () => {
  const config1: TelegramGatewayConfig = { botToken: "token123" };
  assert.equal(config1.botToken, "token123");
  assert.equal(config1.baseUrl, undefined);

  const config2: TelegramGatewayConfig = { botToken: "token123", baseUrl: "https://custom.api.com" };
  assert.equal(config2.baseUrl, "https://custom.api.com");
});

test("SlackGatewayConfig allows optional baseUrl", () => {
  const config1: SlackGatewayConfig = { botToken: "xoxb-123" };
  assert.equal(config1.botToken, "xoxb-123");
  assert.equal(config1.baseUrl, undefined);

  const config2: SlackGatewayConfig = { botToken: "xoxb-123", baseUrl: "https://custom.slack.com" };
  assert.equal(config2.baseUrl, "https://custom.slack.com");
});

test("WebhookGatewayConfig allows optional defaultHeaders", () => {
  const config1: WebhookGatewayConfig = {};
  assert.equal(config1.defaultHeaders, undefined);

  const config2: WebhookGatewayConfig = {
    defaultHeaders: { Authorization: "Bearer token123" },
  };
  assert.equal(config2.defaultHeaders!["Authorization"], "Bearer token123");
});

test("ChannelGatewayServiceOptions accepts all optional fields", () => {
  const options: ChannelGatewayServiceOptions = {
    fetchImpl: fetch,
    telegram: { botToken: "token" },
    slack: { botToken: "xoxb" },
    webhook: { defaultHeaders: {} },
  };

  assert.ok(options.fetchImpl === fetch);
  assert.ok(options.telegram?.botToken === "token");
  assert.ok(options.slack?.botToken === "xoxb");
});

test("SendGatewayMessageInput with channel specified", () => {
  const input: SendGatewayMessageInput = {
    channel: "telegram",
    targetId: "chat-123",
    text: "Hello world",
    metadata: { userId: "user-1" },
  };

  assert.equal(input.channel, "telegram");
  assert.equal(input.targetId, "chat-123");
  assert.equal(input.text, "Hello world");
  assert.deepEqual(input.metadata, { userId: "user-1" });
});

test("SendGatewayMessageInput with query (lookup)", () => {
  const input: SendGatewayMessageInput = {
    query: "john.doe@example.com",
    text: "Hello",
  };

  assert.equal(input.query, "john.doe@example.com");
  assert.equal(input.text, "Hello");
  assert.equal(input.channel, undefined);
  assert.equal(input.targetId, undefined);
});

test("SendGatewayMessageInput allows null metadata", () => {
  const input: SendGatewayMessageInput = {
    channel: "slack",
    targetId: "channel-123",
    text: "Message",
    metadata: null,
  };

  assert.equal(input.metadata, null);
});

test("GatewayDeliveryReceipt structure", () => {
  const receipt: GatewayDeliveryReceipt = {
    deliveredAt: "2024-01-01T12:00:00.000Z",
    channel: "telegram",
    targetId: "chat-123",
    externalTargetId: "987654321",
    requestUrl: "https://api.telegram.org/bot123/sendMessage",
    responseStatus: 200,
    providerMessageId: "123",
  };

  assert.equal(receipt.channel, "telegram");
  assert.equal(receipt.responseStatus, 200);
  assert.equal(receipt.providerMessageId, "123");
  assert.ok(receipt.externalTargetId !== null);
});

test("GatewayDeliveryReceipt allows null externalTargetId and providerMessageId", () => {
  const receipt: GatewayDeliveryReceipt = {
    deliveredAt: "2024-01-01T12:00:00.000Z",
    channel: "webhook",
    targetId: "endpoint-123",
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
    delivered: 95,
    retryScheduled: 3,
    deadLettered: 1,
    skippedRateLimited: 1,
  };

  assert.equal(summary.scanned, 100);
  assert.equal(summary.delivered, 95);
  assert.equal(summary.retryScheduled, 3);
  assert.equal(summary.deadLettered, 1);
  assert.equal(summary.skippedRateLimited, 1);
});

test("GatewayRetryQueueSummary all zeros", () => {
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
    targetId: "chat-123",
    text: "Hello world",
    metadata: { userId: "user-1" },
  };

  assert.equal(payload.targetId, "chat-123");
  assert.equal(payload.text, "Hello world");
  assert.deepEqual(payload.metadata, { userId: "user-1" });
});

test("TrackedGatewayDeliveryPayload without optional metadata", () => {
  const payload: TrackedGatewayDeliveryPayload = {
    targetId: "chat-123",
    text: "Hello",
  };

  assert.equal(payload.metadata, undefined);
});
