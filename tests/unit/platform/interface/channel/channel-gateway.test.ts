import { test } from "node:test";
import assert from "node:assert/strict";

import { ChannelGatewayService, GatewayRateLimitError } from "../../../../../src/platform/interface/channel-gateway/channel-gateway-service.js";
import { GatewayTargetDirectoryService } from "../../../../../src/platform/interface/channel-gateway/gateway-target-directory-service.js";
import { normalizeGatewayDeliveryFailure, GatewayDeliveryError } from "../../../../../src/platform/interface/channel-gateway/errors.js";
import type { GatewayStoragePort } from "../../../../../src/platform/interface/channel-gateway/storage-port.js";
import type { GatewayTargetRecord, GatewayTargetKind, GatewayTargetSource } from "../../../../../src/platform/contracts/types/domain.js";
import type { ChannelGatewayDeliveryService } from "../../../../../src/platform/interface/channel-gateway/channel-gateway-delivery-service.js";
import type { GatewayDeliveryReceipt } from "../../../../../src/platform/interface/channel-gateway/types.js";

/**
 * Manual mock implementations for unit testing ChannelGatewayService
 * without requiring database or external dependencies.
 */

interface MockGatewayTarget extends GatewayTargetRecord {
  targetId: string;
  channel: string;
  targetKind: GatewayTargetKind;
  externalTargetId: string | null;
  displayName: string;
  aliasesJson: string;
  metadataJson: string | null;
  source: GatewayTargetSource;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function createMockStoragePort(targets: Map<string, MockGatewayTarget> = new Map()): GatewayStoragePort {
  return {
    getGatewayTarget(targetId: string): GatewayTargetRecord | null {
      return targets.get(targetId) ?? null;
    },
    upsertGatewayTarget(target: GatewayTargetRecord): void {
      const mock: MockGatewayTarget = {
        targetId: target.targetId,
        channel: target.channel,
        targetKind: target.targetKind,
        externalTargetId: target.externalTargetId,
        displayName: target.displayName,
        aliasesJson: target.aliasesJson,
        metadataJson: target.metadataJson,
        source: target.source,
        lastSeenAt: target.lastSeenAt,
        createdAt: target.createdAt,
        updatedAt: target.updatedAt,
      };
      targets.set(target.targetId, mock);
    },
    listGatewayTargets(_limit?: number, _channel?: string): GatewayTargetRecord[] {
      return [...targets.values()];
    },
    listGatewaySessionTargetCandidates(_limit?: number, _channel?: string, _tenantId?: string | null) {
      return [];
    },
  };
}

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function createMockFetch(_responses?: Map<string, { ok: boolean; status: number; body: unknown }>): (input: string | URL, init?: RequestInit) => Promise<Response> {
  return async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const response = { ok: true, status: 200, body: {} };
    return {
      ok: response.ok,
      status: response.status,
      json: async () => response.body,
    };
  };
}

function createMockDeliveryService(): ChannelGatewayDeliveryService {
  const rateLimits = new Map<string, { count: number; limit: number; windowMs: number }>();
  const messages = new Map<string, { channel: string; targetId: string; payload: Record<string, unknown>; attempts: number; maxRetries: number }>();
  const deadLetters: Array<{ messageId: string; channel: string; targetId: string; payload: Record<string, unknown>; failureReason: string }> = [];
  let messageIdCounter = 0;

  return {
    checkRateLimit(channel: string) {
      const config = rateLimits.get(channel) ?? { count: 0, limit: 100, windowMs: 60000 };
      return {
        allowed: config.count < config.limit,
        currentCount: config.count,
        limit: config.limit,
        windowMs: config.windowMs,
        retryAfterMs: config.count >= config.limit ? 1000 : undefined,
      };
    },
    recordRateLimitHit(channel: string): void {
      const config = rateLimits.get(channel) ?? { count: 0, limit: 100, windowMs: 60000 };
      config.count += 1;
      rateLimits.set(channel, config);
    },
    createDeliveryMessage(channel: string, targetId: string, payload: Record<string, unknown>, _maxRetries?: number) {
      const messageId = `msg_${++messageIdCounter}`;
      messages.set(messageId, { channel, targetId, payload, attempts: 0, maxRetries: 3 });
      return { messageId, channel, targetId, status: "pending_retry" as const, attempts: 0, finalStatus: "success" as const, firstAttemptAt: "", lastAttemptAt: "", providerMessageId: null };
    },
    recordDeliverySuccess(messageId: string, _responseStatus: number, _providerMessageId?: string | null) {
      const msg = messages.get(messageId);
      if (msg) msg.attempts += 1;
      return null;
    },
    recordDeliveryFailure(messageId: string, options: { retryable: boolean; responseStatus?: number | null; errorMessage?: string | null }) {
      const msg = messages.get(messageId);
      if (!msg) return null;
      msg.attempts += 1;
      if (options.retryable && msg.attempts < msg.maxRetries) {
        return { outcome: "retry_scheduled" as const, attempt: null };
      }
      deadLetters.push({ messageId, channel: msg.channel, targetId: msg.targetId, payload: msg.payload, failureReason: options.errorMessage ?? "unknown" });
      return { outcome: "dead_lettered" as const, attempt: null };
    },
    getRetryableMessages(_limit?: number) {
      return [...messages.values()]
        .filter(m => m.attempts > 0 && m.attempts < m.maxRetries)
        .map(m => ({ messageId: `msg_${m.attempts}`, channel: m.channel, targetId: m.targetId, payload: m.payload, attempts: m.attempts, maxRetries: m.maxRetries, nextRetryAt: null }));
    },
    isRetryableStatus(status: number): boolean {
      return [429, 500, 502, 503, 504].includes(status);
    },
  } as unknown as ChannelGatewayDeliveryService;
}

test("ChannelGatewayService requires non-empty text", async () => {
  const store = createMockStoragePort();
  const targetDirectory = new GatewayTargetDirectoryService(store);
  const mockFetch = createMockFetch();
  const service = new ChannelGatewayService(store, targetDirectory, { fetchImpl: mockFetch });

  await assert.rejects(
    service.sendMessage({ text: "", targetId: "test-target" }),
    (err: unknown) => (err as any)?.code === "gateway.invalid_text",
  );
});

test("ChannelGatewayService resolves target by targetId directly", async () => {
  const targets = new Map<string, MockGatewayTarget>();
  targets.set("telegram:user:chat123", {
    targetId: "telegram:user:chat123",
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "chat123",
    displayName: "Test User",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  const store = createMockStoragePort(targets);
  const targetDirectory = new GatewayTargetDirectoryService(store);
  const responses = new Map([["https://api.telegram.org/bottest/sendMessage", { ok: true, status: 200, body: { result: { message_id: 42 } } }]]);
  const mockFetch = createMockFetch(responses);
  const service = new ChannelGatewayService(store, targetDirectory, {
    fetchImpl: mockFetch,
    telegram: { botToken: "test", baseUrl: "https://api.telegram.org" },
  });

  const receipt = await service.sendMessage({ targetId: "telegram:user:chat123", text: "Hello" });

  assert.equal(receipt.channel, "telegram");
  assert.equal(receipt.providerMessageId, "42");
  assert.equal(receipt.targetId, "telegram:user:chat123");
});

test("ChannelGatewayService throws when telegram not configured", async () => {
  const targets = new Map<string, MockGatewayTarget>();
  targets.set("telegram:user:chat123", {
    targetId: "telegram:user:chat123",
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "chat123",
    displayName: "Test User",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  const store = createMockStoragePort(targets);
  const targetDirectory = new GatewayTargetDirectoryService(store);
  const service = new ChannelGatewayService(store, targetDirectory, {});

  await assert.rejects(
    service.sendMessage({ targetId: "telegram:user:chat123", text: "Hello" }),
    (err: unknown) => (err as any)?.code === "gateway.telegram_not_configured",
  );
});

test("ChannelGatewayService throws when slack not configured", async () => {
  const targets = new Map<string, MockGatewayTarget>();
  targets.set("slack:room:C123456", {
    targetId: "slack:room:C123456",
    channel: "slack",
    targetKind: "room",
    externalTargetId: "C123456",
    displayName: "Test Room",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  const store = createMockStoragePort(targets);
  const targetDirectory = new GatewayTargetDirectoryService(store);
  const service = new ChannelGatewayService(store, targetDirectory, {});

  await assert.rejects(
    service.sendMessage({ targetId: "slack:room:C123456", text: "Hello" }),
    (err: unknown) => (err as any)?.code === "gateway.slack_not_configured",
  );
});

test("ChannelGatewayService enforces rate limit via delivery service", async () => {
  const targets = new Map<string, MockGatewayTarget>();
  targets.set("webhook:room:hook1", {
    targetId: "webhook:room:hook1",
    channel: "webhook",
    targetKind: "room",
    externalTargetId: "https://example.com/webhook",
    displayName: "Test Webhook",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  const store = createMockStoragePort(targets);
  const targetDirectory = new GatewayTargetDirectoryService(store);

  // Create a delivery service that reports rate limit exceeded
  const limitedDeliveryService = {
    checkRateLimit: () => ({ allowed: false, currentCount: 10, limit: 10, windowMs: 60000, retryAfterMs: 30000 }),
    recordRateLimitHit: () => {},
    createDeliveryMessage: () => ({ messageId: "msg_1", channel: "webhook", targetId: "webhook:room:hook1", status: "pending_retry" as const, attempts: 0, finalStatus: "success" as const, firstAttemptAt: "", lastAttemptAt: "", providerMessageId: null }),
    recordDeliverySuccess: () => null,
    recordDeliveryFailure: () => null,
    getRetryableMessages: () => [],
    isRetryableStatus: (s: number) => [429, 500, 502, 503, 504].includes(s),
  } as unknown as ChannelGatewayDeliveryService;

  const mockFetch = createMockFetch();
  const service = new ChannelGatewayService(store, targetDirectory, {
    fetchImpl: mockFetch,
    webhook: {},
    deliveryService: limitedDeliveryService,
  });

  await assert.rejects(
    service.sendMessage({ targetId: "webhook:room:hook1", text: "Hello" }),
    (err: unknown) => err instanceof GatewayRateLimitError && err.channel === "webhook",
  );
});

test("ChannelGatewayService getDeliveryService returns configured delivery service", () => {
  const store = createMockStoragePort();
  const targetDirectory = new GatewayTargetDirectoryService(store);
  const deliveryService = createMockDeliveryService();
  const service = new ChannelGatewayService(store, targetDirectory, { deliveryService });

  assert.equal(service.getDeliveryService(), deliveryService);
});

test("ChannelGatewayService getDeliveryService returns undefined when not configured", () => {
  const store = createMockStoragePort();
  const targetDirectory = new GatewayTargetDirectoryService(store);
  const service = new ChannelGatewayService(store, targetDirectory, {});

  assert.equal(service.getDeliveryService(), undefined);
});

test("ChannelGatewayService processRetryQueue returns zeros when no delivery service", async () => {
  const store = createMockStoragePort();
  const targetDirectory = new GatewayTargetDirectoryService(store);
  const service = new ChannelGatewayService(store, targetDirectory, {});

  const result = await service.processRetryQueue();

  assert.equal(result.scanned, 0);
  assert.equal(result.delivered, 0);
  assert.equal(result.retryScheduled, 0);
  assert.equal(result.deadLettered, 0);
  assert.equal(result.skippedRateLimited, 0);
});

test("ChannelGatewayService sends slack message with bearer token", async () => {
  const targets = new Map<string, MockGatewayTarget>();
  targets.set("slack:room:C123456", {
    targetId: "slack:room:C123456",
    channel: "slack",
    targetKind: "room",
    externalTargetId: "C123456",
    displayName: "Test Room",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  const store = createMockStoragePort(targets);
  const targetDirectory = new GatewayTargetDirectoryService(store);
  let capturedRequest: CapturedRequest | null = null;
  // @ts-expect-error - RequestInfo/RequestInit not available in Node types
  const mockFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedRequest = {
      url: typeof input === "string" ? input : input.toString(),
      method: init?.method ?? "GET",
      headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v])),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    };
    return { ok: true, status: 200, json: async () => ({ ok: true, ts: "1234567890.123456" }) } as Response;
  };

  const service = new ChannelGatewayService(store, targetDirectory, {
    fetchImpl: mockFetch,
    slack: { botToken: "xoxb-test-token", baseUrl: "https://slack.api.test" },
  });

  const receipt = await service.sendMessage({ targetId: "slack:room:C123456", text: "Hello Slack" });

  assert.equal(receipt.channel, "slack");
  assert.equal(receipt.providerMessageId, "1234567890.123456");
  // @ts-expect-error - TypeScript control flow issue with optional chaining
  assert.ok(capturedRequest?.headers.authorization?.startsWith("Bearer "));
});

test("ChannelGatewayService throws on slack API error response", async () => {
  const targets = new Map<string, MockGatewayTarget>();
  targets.set("slack:room:C123456", {
    targetId: "slack:room:C123456",
    channel: "slack",
    targetKind: "room",
    externalTargetId: "C123456",
    displayName: "Test Room",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  const store = createMockStoragePort(targets);
  const targetDirectory = new GatewayTargetDirectoryService(store);
  const mockFetch: typeof fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: false }) } as Response);

  const service = new ChannelGatewayService(store, targetDirectory, {
    fetchImpl: mockFetch,
    slack: { botToken: "xoxb-test-token", baseUrl: "https://slack.api.test" },
  });

  await assert.rejects(
    service.sendMessage({ targetId: "slack:room:C123456", text: "Hello" }),
    (err: unknown) => (err as any)?.code === "gateway.slack_delivery_failed:provider_rejected",
  );
});

test("ChannelGatewayService sends webhook message with merged metadata", async () => {
  const targets = new Map<string, MockGatewayTarget>();
  targets.set("webhook:room:hook1", {
    targetId: "webhook:room:hook1",
    channel: "webhook",
    targetKind: "room",
    externalTargetId: "https://fallback.example.com/webhook",
    displayName: "Test Webhook",
    aliasesJson: "[]",
    metadataJson: JSON.stringify({ webhookUrl: "https://primary.example.com/webhook", region: "us-east" }),
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  const store = createMockStoragePort(targets);
  const targetDirectory = new GatewayTargetDirectoryService(store);
  let capturedBody: Record<string, unknown> | null = null;
  // @ts-expect-error - RequestInfo/RequestInit not available in Node types
  const mockFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.body) capturedBody = JSON.parse(String(init.body));
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  };

  const service = new ChannelGatewayService(store, targetDirectory, {
    fetchImpl: mockFetch,
    webhook: { defaultHeaders: { "x-source": "test" } },
  });

  const receipt = await service.sendMessage({
    targetId: "webhook:room:hook1",
    text: "Hello Webhook",
    metadata: { traceId: "abc123" },
  });

  assert.equal(receipt.channel, "webhook");
  // @ts-expect-error - TypeScript control flow issue with optional chaining
  assert.deepEqual(capturedBody?.metadata, { webhookUrl: "https://primary.example.com/webhook", region: "us-east", traceId: "abc123" });
});

test("ChannelGatewayService throws on webhook delivery failure", async () => {
  const targets = new Map<string, MockGatewayTarget>();
  targets.set("webhook:room:hook1", {
    targetId: "webhook:room:hook1",
    channel: "webhook",
    targetKind: "room",
    externalTargetId: "https://example.com/webhook",
    displayName: "Test Webhook",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  const store = createMockStoragePort(targets);
  const targetDirectory = new GatewayTargetDirectoryService(store);
  const mockFetch: typeof fetch = async () => ({ ok: false, status: 502, json: async () => ({}) } as Response);

  const service = new ChannelGatewayService(store, targetDirectory, {
    fetchImpl: mockFetch,
    webhook: {},
  });

  await assert.rejects(
    service.sendMessage({ targetId: "webhook:room:hook1", text: "Hello" }),
    (err: unknown) => (err as any)?.code === "gateway.webhook_delivery_failed:502",
  );
});

test("ChannelGatewayService throws on unsupported channel", async () => {
  const targets = new Map<string, MockGatewayTarget>();
  targets.set("unknown:room:target1", {
    targetId: "unknown:room:target1",
    channel: "unknown",
    targetKind: "room",
    externalTargetId: "ext1",
    displayName: "Unknown Target",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  const store = createMockStoragePort(targets);
  const targetDirectory = new GatewayTargetDirectoryService(store);
  const mockFetch = createMockFetch();

  const service = new ChannelGatewayService(store, targetDirectory, { fetchImpl: mockFetch });

  await assert.rejects(
    service.sendMessage({ targetId: "unknown:room:target1", text: "Hello" }),
    (err: unknown) => (err as any)?.code === "gateway.unsupported_channel:unknown",
  );
});

test("ChannelGatewayService throws when target not found", async () => {
  const store = createMockStoragePort();
  const targetDirectory = new GatewayTargetDirectoryService(store);
  const mockFetch = createMockFetch();

  const service = new ChannelGatewayService(store, targetDirectory, { fetchImpl: mockFetch });

  await assert.rejects(
    service.sendMessage({ targetId: "nonexistent:target:id", text: "Hello" }),
    (err: unknown) => (err as any)?.code?.startsWith("gateway.target_not_found"),
  );
});

test("normalizeGatewayDeliveryFailure returns retryable true for unknown errors", () => {
  const deliveryService = createMockDeliveryService();
  const result = normalizeGatewayDeliveryFailure(new Error("unknown error"), deliveryService);
  assert.equal(result.retryable, true);
  assert.equal(result.errorMessage, "unknown error");
});

test("normalizeGatewayDeliveryFailure returns correct flags for GatewayDeliveryError", () => {
  const deliveryService = createMockDeliveryService();
  const error = new GatewayDeliveryError("test.error", 503, true);
  const result = normalizeGatewayDeliveryFailure(error, deliveryService);
  assert.equal(result.retryable, true);
  assert.equal(result.responseStatus, 503);
  assert.equal(result.errorMessage, "test.error");
});

test("normalizeGatewayDeliveryFailure returns correct flags for GatewayRateLimitError", () => {
  const deliveryService = createMockDeliveryService();
  const error = new GatewayRateLimitError("telegram", 30000, 20, 20);
  const result = normalizeGatewayDeliveryFailure(error, deliveryService);
  assert.equal(result.retryable, true);
});
