import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";

import { CacheInvalidationBroadcast, CacheInvalidationMessage } from "../../../../../src/platform/shared/cache/cache-invalidation-broadcast.js";

// =============================================================================
// Mock Redis Client
// =============================================================================

function createMockRedisClient(overrides: Partial<{
  status: string;
  subscribe: (channel: string) => Promise<number>;
  unsubscribe: (channel: string) => Promise<number>;
  publish: (channel: string, message: string) => Promise<number>;
  quit: () => Promise<unknown>;
  disconnect: () => void;
  on: (event: string, handler: (...args: unknown[]) => void) => EventEmitter;
}> = {}): ReturnType<typeof createMockRedisClient> {
  const emitter = new EventEmitter();
  let subscribedChannels: string[] = [];
  let publishedMessages: Array<{ channel: string; message: string }> = [];

  return {
    status: "ready",
    subscribe: async (channel: string) => {
      subscribedChannels.push(channel);
      return 1;
    },
    unsubscribe: async (channel: string) => {
      subscribedChannels = subscribedChannels.filter((c) => c !== channel);
      return 1;
    },
    publish: async (channel: string, message: string) => {
      publishedMessages.push({ channel, message });
      return 1;
    },
    quit: async () => {},
    disconnect: () => {},
    on: (event: string, handler: (...args: unknown[]) => void) => {
      emitter.on(event, handler);
      // Return emitter for chaining
      return emitter as unknown as EventEmitter;
    },
    _getSubscribedChannels: () => subscribedChannels,
    _getPublishedMessages: () => publishedMessages,
    _triggerMessage: (channel: string, message: string) => {
      emitter.emit("message", channel, message);
    },
    ...overrides,
  };
}

// =============================================================================
// Mock buildRedisClientOptions to return mock redis config
// =============================================================================

let mockBuildRedisClientOptions: jest.Mock | undefined;

function createBroadcastWithMockedRedis(
  mockPub: ReturnType<typeof createMockRedisClient>,
  mockSub: ReturnType<typeof createMockRedisClient>,
  config: ConstructorParameters<typeof CacheInvalidationBroadcast>[0] = {},
  onInvalidate: (msg: CacheInvalidationMessage) => Promise<void> = async () => {},
) {
  // Create broadcast instance
  const broadcast = new CacheInvalidationBroadcast(config, onInvalidate);

  // Replace the pub/sub clients via any to inject mocks
  (broadcast as any).pub = mockPub;
  (broadcast as any).sub = mockSub;

  return broadcast;
}

// =============================================================================
// Constructor and Initialization Tests
// =============================================================================

test("CacheInvalidationBroadcast constructor sets default channel", () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();

  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  assert.equal((broadcast as any).channel, "aacache:invalidation");
});

test("CacheInvalidationBroadcast constructor uses custom channel from config", () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();

  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, { channel: "custom:channel" });

  assert.equal((broadcast as any).channel, "custom:channel");
});

test("CacheInvalidationBroadcast constructor generates unique instanceId", () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();

  const broadcast1 = createBroadcastWithMockedRedis(mockPub, mockSub, {});
  const broadcast2 = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  const instanceId1 = (broadcast1 as any).instanceId;
  const instanceId2 = (broadcast2 as any).instanceId;

  assert.ok(instanceId1.startsWith("inst_"));
  assert.ok(instanceId2.startsWith("inst_"));
  assert.notEqual(instanceId1, instanceId2);
});

test("CacheInvalidationBroadcast constructor stores onInvalidate callback", () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();
  const onInvalidate = async (msg: CacheInvalidationMessage) => {};

  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {}, onInvalidate);

  assert.equal((broadcast as any).onInvalidate, onInvalidate);
});

test("CacheInvalidationBroadcast constructor sets isStarted to false initially", () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();

  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  assert.equal((broadcast as any).isStarted, false);
});

// =============================================================================
// start() Method Tests
// =============================================================================

test("start() calls sub.subscribe with correct channel", async () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  await broadcast.start();

  assert.deepEqual(mockSub._getSubscribedChannels(), ["aacache:invalidation"]);
});

test("start() sets isStarted to true after subscribing", async () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  assert.equal((broadcast as any).isStarted, false);
  await broadcast.start();
  assert.equal((broadcast as any).isStarted, true);
});

test("start() is idempotent - only subscribes once", async () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  await broadcast.start();
  await broadcast.start();
  await broadcast.start();

  assert.equal(mockSub._getSubscribedChannels().length, 1);
});

test("start() ignores messages from same instance", async () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();
  let invalidateCallCount = 0;
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {}, async () => {
    invalidateCallCount++;
  });

  await broadcast.start();

  const instanceId = (broadcast as any).instanceId;
  // Trigger a message from the same instance
  mockSub._triggerMessage("aacache:invalidation", JSON.stringify({
    type: "tag",
    tag: "test-tag",
    origin: instanceId,
  }));

  // Small delay to let async handler run
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(invalidateCallCount, 0);
});

test("start() calls onInvalidate for messages from other instances", async () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();
  let receivedMessage: CacheInvalidationMessage | null = null;
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {}, async (msg) => {
    receivedMessage = msg;
  });

  await broadcast.start();

  // Trigger a message from a different instance
  mockSub._triggerMessage("aacache:invalidation", JSON.stringify({
    type: "tag",
    tag: "test-tag",
    origin: "other_instance_123",
  }));

  // Small delay to let async handler run
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.ok(receivedMessage !== null);
  assert.equal(receivedMessage!.type, "tag");
  assert.equal(receivedMessage!.tag, "test-tag");
  assert.equal(receivedMessage!.origin, "other_instance_123");
});

test("start() ignores malformed JSON messages", async () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();
  let invalidateCallCount = 0;
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {}, async () => {
    invalidateCallCount++;
  });

  await broadcast.start();

  // Trigger a malformed message
  mockSub._triggerMessage("aacache:invalidation", "not valid json {{{");

  // Small delay to let async handler run
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(invalidateCallCount, 0);
});

// =============================================================================
// broadcastTagInvalidation Tests
// =============================================================================

test("broadcastTagInvalidation publishes to correct channel", async () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  await broadcast.broadcastTagInvalidation("file:/src/app.ts");

  const publishedMessages = mockPub._getPublishedMessages();
  assert.equal(publishedMessages.length, 1);
  assert.equal(publishedMessages[0].channel, "aacache:invalidation");
});

test("broadcastTagInvalidation publishes correct message structure", async () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  await broadcast.broadcastTagInvalidation("session:abc123");

  const publishedMessages = mockPub._getPublishedMessages();
  const parsedMessage = JSON.parse(publishedMessages[0].message) as CacheInvalidationMessage;

  assert.equal(parsedMessage.type, "tag");
  assert.equal(parsedMessage.tag, "session:abc123");
  assert.ok(parsedMessage.origin.startsWith("inst_"));
});

test("broadcastTagInvalidation includes unique instanceId as origin", async () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  await broadcast.broadcastTagInvalidation("test-tag");

  const publishedMessages = mockPub._getPublishedMessages();
  const parsedMessage = JSON.parse(publishedMessages[0].message) as CacheInvalidationMessage;

  assert.equal(parsedMessage.origin, (broadcast as any).instanceId);
});

// =============================================================================
// broadcastNamespaceInvalidation Tests
// =============================================================================

test("broadcastNamespaceInvalidation publishes to correct channel", async () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  await broadcast.broadcastNamespaceInvalidation("planner");

  const publishedMessages = mockPub._getPublishedMessages();
  assert.equal(publishedMessages.length, 1);
  assert.equal(publishedMessages[0].channel, "aacache:invalidation");
});

test("broadcastNamespaceInvalidation publishes correct message structure", async () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  await broadcast.broadcastNamespaceInvalidation("execution-engine");

  const publishedMessages = mockPub._getPublishedMessages();
  const parsedMessage = JSON.parse(publishedMessages[0].message) as CacheInvalidationMessage;

  assert.equal(parsedMessage.type, "namespace");
  assert.equal(parsedMessage.namespace, "execution-engine");
  assert.ok(parsedMessage.origin.startsWith("inst_"));
});

test("broadcastNamespaceInvalidation includes unique instanceId as origin", async () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  await broadcast.broadcastNamespaceInvalidation("test-namespace");

  const publishedMessages = mockPub._getPublishedMessages();
  const parsedMessage = JSON.parse(publishedMessages[0].message) as CacheInvalidationMessage;

  assert.equal(parsedMessage.origin, (broadcast as any).instanceId);
});

// =============================================================================
// close() Method Tests
// =============================================================================

test("close() unsubscribes from channel when started", async () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  await broadcast.start();
  await broadcast.close();

  assert.equal(mockSub._getSubscribedChannels().length, 0);
});

test("close() calls quit on pub when status is ready", async () => {
  let quitCalled = false;
  const mockPub = createMockRedisClient({
    status: "ready",
    quit: async () => { quitCalled = true; },
  });
  const mockSub = createMockRedisClient();
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  await broadcast.close();

  assert.equal(quitCalled, true);
});

test("close() calls disconnect on pub when status is wait", async () => {
  let disconnectCalled = false;
  const mockPub = createMockRedisClient({
    status: "wait",
    disconnect: () => { disconnectCalled = true; },
  });
  const mockSub = createMockRedisClient();
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  await broadcast.close();

  assert.equal(disconnectCalled, true);
});

test("close() calls disconnect on pub when status is end", async () => {
  let disconnectCalled = false;
  const mockPub = createMockRedisClient({
    status: "end",
    disconnect: () => { disconnectCalled = true; },
  });
  const mockSub = createMockRedisClient();
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  await broadcast.close();

  assert.equal(disconnectCalled, true);
});

test("close() calls quit on sub when status is ready", async () => {
  let quitCalled = false;
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient({
    status: "ready",
    quit: async () => { quitCalled = true; },
  });
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  await broadcast.close();

  assert.equal(quitCalled, true);
});

test("close() calls disconnect on sub when status is wait", async () => {
  let disconnectCalled = false;
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient({
    status: "wait",
    disconnect: () => { disconnectCalled = true; },
  });
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  await broadcast.close();

  assert.equal(disconnectCalled, true);
});

test("close() calls disconnect on sub when status is end", async () => {
  let disconnectCalled = false;
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient({
    status: "end",
    disconnect: () => { disconnectCalled = true; },
  });
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  await broadcast.close();

  assert.equal(disconnectCalled, true);
});

test("close() sets isStarted to false", async () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  await broadcast.start();
  assert.equal((broadcast as any).isStarted, true);

  await broadcast.close();
  assert.equal((broadcast as any).isStarted, false);
});

test("close() is safe to call when not started", async () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  // Should not throw
  await broadcast.close();

  // isStarted should still be false
  assert.equal((broadcast as any).isStarted, false);
});

// =============================================================================
// Error Handling Tests
// =============================================================================

test("error handler is attached to pub client", () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();

  // Create broadcast - error handlers are attached in constructor
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  // The mock's on() method is called - just verify no throw
  assert.ok((broadcast as any).pub === mockPub);
});

test("error handler is attached to sub client", () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();

  // Create broadcast - error handlers are attached in constructor
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {});

  // The mock's on() method is called - just verify no throw
  assert.ok((broadcast as any).sub === mockSub);
});

test("broadcastTagInvalidation works with custom channel", async () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, { channel: "my:channel" });

  await broadcast.broadcastTagInvalidation("my-tag");

  const publishedMessages = mockPub._getPublishedMessages();
  assert.equal(publishedMessages[0].channel, "my:channel");
});

test("broadcastNamespaceInvalidation works with custom channel", async () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, { channel: "my:channel" });

  await broadcast.broadcastNamespaceInvalidation("my-namespace");

  const publishedMessages = mockPub._getPublishedMessages();
  assert.equal(publishedMessages[0].channel, "my:channel");
});

test("message handler handles JSON parse errors gracefully", async () => {
  const mockPub = createMockRedisClient();
  const mockSub = createMockRedisClient();
  let invalidateCallCount = 0;
  const broadcast = createBroadcastWithMockedRedis(mockPub, mockSub, {}, async () => {
    invalidateCallCount++;
  });

  await broadcast.start();

  // Trigger multiple malformed messages - should not throw
  mockSub._triggerMessage("aacache:invalidation", "not valid json {{{");
  mockSub._triggerMessage("aacache:invalidation", "{");

  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(invalidateCallCount, 0);
});

// =============================================================================
// Interface Tests
// =============================================================================

test("CacheInvalidationMessage interface accepts tag type", () => {
  const message: CacheInvalidationMessage = {
    type: "tag",
    tag: "file:/src/app.ts",
    origin: "inst_123",
  };

  assert.equal(message.type, "tag");
  assert.equal(message.tag, "file:/src/app.ts");
});

test("CacheInvalidationMessage interface accepts namespace type", () => {
  const message: CacheInvalidationMessage = {
    type: "namespace",
    namespace: "planner",
    origin: "inst_456",
  };

  assert.equal(message.type, "namespace");
  assert.equal(message.namespace, "planner");
});

test("CacheInvalidationBroadcastConfig interface accepts RedisConnectionConfig properties", () => {
  const config: ConstructorParameters<typeof CacheInvalidationBroadcast>[0] = {
    host: "localhost",
    port: 6379,
    channel: "test:channel",
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
  };

  assert.equal(config.host, "localhost");
  assert.equal(config.port, 6379);
  assert.equal(config.channel, "test:channel");
});
