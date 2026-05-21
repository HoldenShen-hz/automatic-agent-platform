import test from "node:test";
import assert from "node:assert/strict";
import {
  ChannelAdapterRegistry,
  createDefaultChannelAdapterRegistry,
  TelegramChannelAdapter,
  SlackChannelAdapter,
  WebhookChannelAdapter,
  type ChannelAdapter,
} from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-adapters.js";

// Helper to create a mock receipt
function createMockReceipt() {
  return {
    deliveredAt: new Date().toISOString(),
    channel: "test",
    targetId: "target-123",
    externalTargetId: null,
    requestUrl: "https://example.com/webhook",
    responseStatus: 200,
    providerMessageId: "msg-123",
  };
}

test("ChannelAdapterRegistry.register throws when channel already registered", () => {
  const registry = new ChannelAdapterRegistry();
  const adapter1: ChannelAdapter = {
    channelType: "telegram",
    supports: (ch) => ch === "telegram",
    sendMessage: async () => createMockReceipt(),
  };
  registry.register(adapter1);

  assert.throws(
    () => {
      registry.register(adapter1);
    },
    (error: unknown) => {
      return error instanceof Error && error.message.includes("channel_adapter.already_registered");
    },
  );
});

test("ChannelAdapterRegistry.register normalizes legacy adapter with channel field", () => {
  const registry = new ChannelAdapterRegistry();
  const legacyAdapter = {
    channel: "slack",
    send: async (input: { targetId: string; externalTargetId: string | null; text: string }) => {
      return createMockReceipt();
    },
  };
  registry.register(legacyAdapter);

  assert.ok(registry.supports("slack"));
  const adapter = registry.get("slack");
  assert.ok(adapter !== undefined);
  assert.equal(adapter!.channelType, "slack");
});

test("ChannelAdapterRegistry.get returns undefined for unregistered channel", () => {
  const registry = new ChannelAdapterRegistry();
  assert.equal(registry.get("unknown"), undefined);
});

test("ChannelAdapterRegistry.getChannelTypes returns all registered channels", () => {
  const registry = new ChannelAdapterRegistry();
  registry.register({
    channelType: "telegram",
    supports: (ch) => ch === "telegram",
    sendMessage: async () => createMockReceipt(),
  });
  registry.register({
    channelType: "slack",
    supports: (ch) => ch === "slack",
    sendMessage: async () => createMockReceipt(),
  });

  const channels = registry.getChannelTypes();
  assert.deepEqual(channels, ["telegram", "slack"]);
});

test("ChannelAdapterRegistry.supports returns true for registered channel", () => {
  const registry = new ChannelAdapterRegistry();
  registry.register({
    channelType: "webhook",
    supports: (ch) => ch === "webhook",
    sendMessage: async () => createMockReceipt(),
  });
  assert.ok(registry.supports("webhook"));
});

test("ChannelAdapterRegistry.supports returns false for unregistered channel", () => {
  const registry = new ChannelAdapterRegistry();
  assert.ok(!registry.supports("unknown"));
});

test("ChannelAdapterRegistry.has is alias for supports", () => {
  const registry = new ChannelAdapterRegistry();
  registry.register({
    channelType: "telegram",
    supports: (ch) => ch === "telegram",
    sendMessage: async () => createMockReceipt(),
  });
  assert.ok(registry.has("telegram"));
  assert.ok(!registry.has("unknown"));
});

test("ChannelAdapterRegistry.registeredChannels returns all registered channels", () => {
  const registry = new ChannelAdapterRegistry();
  registry.register({
    channelType: "telegram",
    supports: (ch) => ch === "telegram",
    sendMessage: async () => createMockReceipt(),
  });
  registry.register({
    channelType: "slack",
    supports: (ch) => ch === "slack",
    sendMessage: async () => createMockReceipt(),
  });

  assert.deepEqual(registry.registeredChannels(), ["telegram", "slack"]);
});

test("createDefaultChannelAdapterRegistry creates registry with telegram, slack, webhook", () => {
  const registry = createDefaultChannelAdapterRegistry();

  assert.ok(registry.supports("telegram"));
  assert.ok(registry.supports("slack"));
  assert.ok(registry.supports("webhook"));
  assert.ok(!registry.supports("unknown"));

  const channels = registry.getChannelTypes();
  assert.equal(channels.length, 3);
});

test("TelegramChannelAdapter returns correct channelType", () => {
  const adapter = new TelegramChannelAdapter(async () => createMockReceipt());
  assert.equal(adapter.channelType, "telegram");
});

test("TelegramChannelAdapter.supports returns true for telegram", () => {
  const adapter = new TelegramChannelAdapter(async () => createMockReceipt());
  assert.ok(adapter.supports("telegram"));
  assert.ok(!adapter.supports("slack"));
});

test("TelegramChannelAdapter.sendMessage calls sendFn with correct arguments", async () => {
  let capturedArgs: [string, string | null, string] | null = null;
  const adapter = new TelegramChannelAdapter(async (targetId, externalTargetId, text) => {
    capturedArgs = [targetId, externalTargetId, text];
    return createMockReceipt();
  });

  await adapter.sendMessage({
    targetId: "chat-123",
    externalTargetId: "ext-456",
    text: "Hello world",
    metadata: { key: "value" },
  });

  assert.deepEqual(capturedArgs, ["chat-123", "ext-456", "Hello world"]);
});

test("SlackChannelAdapter returns correct channelType", () => {
  const adapter = new SlackChannelAdapter(async () => createMockReceipt());
  assert.equal(adapter.channelType, "slack");
});

test("SlackChannelAdapter.supports returns true for slack", () => {
  const adapter = new SlackChannelAdapter(async () => createMockReceipt());
  assert.ok(adapter.supports("slack"));
  assert.ok(!adapter.supports("telegram"));
});

test("SlackChannelAdapter.sendMessage calls sendFn with correct arguments", async () => {
  let capturedArgs: [string, string | null, string] | null = null;
  const adapter = new SlackChannelAdapter(async (targetId, externalTargetId, text) => {
    capturedArgs = [targetId, externalTargetId, text];
    return createMockReceipt();
  });

  await adapter.sendMessage({
    targetId: "channel-123",
    externalTargetId: null,
    text: "Slack message",
  });

  assert.deepEqual(capturedArgs, ["channel-123", null, "Slack message"]);
});

test("WebhookChannelAdapter returns correct channelType", () => {
  const adapter = new WebhookChannelAdapter(async () => createMockReceipt());
  assert.equal(adapter.channelType, "webhook");
});

test("WebhookChannelAdapter.supports returns true for webhook", () => {
  const adapter = new WebhookChannelAdapter(async () => createMockReceipt());
  assert.ok(adapter.supports("webhook"));
  assert.ok(!adapter.supports("telegram"));
});

test("WebhookChannelAdapter.sendMessage calls sendFn with correct arguments including metadata", async () => {
  let capturedArgs: [string, string | null, string, Record<string, unknown>] | null = null;
  const adapter = new WebhookChannelAdapter(async (targetId, externalTargetId, text, metadata) => {
    capturedArgs = [targetId, externalTargetId, text, metadata];
    return createMockReceipt();
  });

  const testMetadata = { eventType: "alert", severity: "high" };
  await adapter.sendMessage({
    targetId: "webhook-123",
    externalTargetId: "ext-789",
    text: "Webhook payload",
    metadata: testMetadata,
  });

  assert.deepEqual(capturedArgs, ["webhook-123", "ext-789", "Webhook payload", testMetadata]);
});

test("WebhookChannelAdapter.sendMessage defaults metadata to empty object when not provided", async () => {
  let capturedMetadata: Record<string, unknown> | null = null;
  const adapter = new WebhookChannelAdapter(async (_targetId, _externalTargetId, _text, metadata) => {
    capturedMetadata = metadata;
    return createMockReceipt();
  });

  await adapter.sendMessage({
    targetId: "webhook-123",
    externalTargetId: null,
    text: "No metadata",
  });

  assert.deepEqual(capturedMetadata, {});
});

test("createDefaultChannelAdapterRegistry adapters sendMessage returns placeholder receipt", async () => {
  const registry = createDefaultChannelAdapterRegistry();

  const telegramAdapter = registry.get("telegram")!;
  const receipt = await telegramAdapter.sendMessage({
    targetId: "chat-123",
    externalTargetId: null,
    text: "test",
  });

  assert.equal(receipt.channel, "telegram");
  assert.equal(receipt.targetId, "chat-123");
  assert.equal(receipt.externalTargetId, null);
  assert.equal(receipt.responseStatus, 0);
  assert.equal(receipt.providerMessageId, null);
});

test("Registry can replace adapter after throw", () => {
  const registry = new ChannelAdapterRegistry();

  const adapter1: ChannelAdapter = {
    channelType: "test-channel",
    supports: (ch) => ch === "test-channel",
    sendMessage: async () => createMockReceipt(),
  };

  // First registration should work
  registry.register(adapter1);

  // Remove and re-register with different adapter
  // Note: The API doesn't have an unregister method, but we can test duplicate prevention
  const adapter2: ChannelAdapter = {
    channelType: "test-channel",
    supports: (ch) => ch === "test-channel",
    sendMessage: async () => ({ ...createMockReceipt(), responseStatus: 201 }),
  };

  // The registry doesn't allow duplicate registration, so we can't replace without removing
  assert.throws(() => registry.register(adapter2));
});
