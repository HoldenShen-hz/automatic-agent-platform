/**
 * @fileoverview Unit tests for Channel Gateway Service - Issue #2047
 *
 * ISSUE #2047: Inbound webhook retry path must preserve structured RequestEnvelope
 *
 * Regression coverage ensures retry tracking stores a structured
 * requestEnvelope alongside webhook metadata so replay does not lose
 * tenant/source/event context.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { ChannelGatewayService } from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-service.js";
import { ChannelGatewayDeliveryService, CHANNEL_DELIVERY_DDL } from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-delivery-service.js";
import { GatewayTargetDirectoryService } from "../../../../../src/platform/five-plane-interface/channel-gateway/gateway-target-directory-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import type { SendGatewayMessageInput } from "../../../../../src/platform/five-plane-interface/channel-gateway/types.js";

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function createHarness() {
  const workspace = createTempWorkspace("aa-channel-gateway-issue-2047-");
  const dbPath = join(workspace, "channel-gateway-2047.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(CHANNEL_DELIVERY_DDL);
  const store = new AuthoritativeTaskStore(db);
  const targets = new GatewayTargetDirectoryService(store);
  const requests: CapturedRequest[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    requests.push({
      url: typeof input === "string" ? input : input.toString(),
      method: init?.method ?? "GET",
      headers: Object.fromEntries(
        Object.entries((init?.headers ?? {}) as Record<string, string>).map(([name, value]) => [
          name.toLowerCase(),
          value,
        ]),
      ),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return {
      ok: true,
      status: 202,
      json: async () => ({ ok: true }),
    } as Response;
  };

  return {
    workspace,
    db,
    store,
    targets,
    requests,
    createService(options: { deliveryService?: ChannelGatewayDeliveryService } = {}) {
      return new ChannelGatewayService(store, targets, {
        fetchImpl,
        telegram: { botToken: "test-token", baseUrl: "https://telegram.example.test" },
        slack: { botToken: "test-token", baseUrl: "https://slack.example.test" },
        webhook: { defaultHeaders: { "x-gateway-source": "test" } },
        ...(options.deliveryService ? { deliveryService: options.deliveryService } : {}),
      });
    },
    close() {
      db.close();
      cleanupPath(workspace);
    },
  };
}

// ── Issue #2047: Tracked payload loses envelope context ─────────────────────────

/**
 * ISSUE #2047 TEST SUITE
 *
 * When a message is tracked for retry, the payload stored is:
 *   { targetId, text, metadata }
 *
 * But the original request envelope contained additional context:
 *   { source, tenantId, workspaceId, eventType, idempotencyKey, ... }
 *
 * This means on retry, we cannot properly reconstruct the original
 * webhook delivery because envelope metadata is lost.
 */

test("ISSUE #2047: tracked webhook payload preserves normalized requestEnvelope context", async () => {
  const harness = createHarness();
  try {
    const deliveryService = new ChannelGatewayDeliveryService(harness.db, {
      maxRetries: 3,
      initialBackoffMs: 0,
      maxBackoffMs: 0,
    });

    const target = harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "webhook",
      externalTargetId: "https://hooks.example.test/retry-me",
      displayName: "Retry Hook",
    });

    const failingService = new ChannelGatewayService(harness.store, harness.targets, {
      deliveryService,
      fetchImpl: async () => ({ ok: false, status: 503 } as Response),
      webhook: { defaultHeaders: { "x-gateway-source": "test" } },
    });

    await assert.rejects(
      () => failingService.sendMessage({
        targetId: target.targetId,
        text: "Test message with metadata",
        metadata: {
          originalEventType: "task.completed",
          sourceTenant: "tenant-123",
          _envelope_source: "slack",
          _envelope_tenantId: "tenant-123",
        },
      }),
      /gateway\.webhook_delivery_failed:503/,
    );

    const queued = deliveryService.getRetryableMessages();
    assert.equal(queued.length, 1);

    const trackedPayload = queued[0]!.payload as {
      targetId: string;
      text: string;
      metadata: Record<string, unknown>;
      requestEnvelope?: Record<string, unknown>;
    };
    assert.equal(trackedPayload.targetId, target.targetId);
    assert.equal(trackedPayload.text, "Test message with metadata");
    assert.deepEqual(trackedPayload.metadata, {
      originalEventType: "task.completed",
      sourceTenant: "tenant-123",
      _envelope_source: "slack",
      _envelope_tenantId: "tenant-123",
    });
    assert.deepEqual(trackedPayload.requestEnvelope, {
      source: "slack",
      tenantId: "tenant-123",
    });
  } finally {
    harness.close();
  }
});

test("ISSUE #2047: explicit requestEnvelope is retained for retry reconstruction", async () => {
  const harness = createHarness();
  try {
    const deliveryService = new ChannelGatewayDeliveryService(harness.db, {
      maxRetries: 3,
      initialBackoffMs: 0,
      maxBackoffMs: 0,
    });

    const target = harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "webhook",
      externalTargetId: "https://hooks.example.test/full-envelope",
      displayName: "Full Envelope Hook",
    });

    const input: SendGatewayMessageInput = {
      targetId: target.targetId,
      text: "Original message text",
      metadata: {
        // These fields should be part of RequestEnvelope but are lost
        requestEnvelope: {
          requestId: "req-123",
          tenantId: "tenant-abc",
          sourcePlane: "interface",
          targetPlane: "orchestration",
          traceId: "trace-xyz",
          eventType: "pull_request",
        },
      },
    };

    const failingService = new ChannelGatewayService(harness.store, harness.targets, {
      deliveryService,
      fetchImpl: async () => ({ ok: false, status: 503 } as Response),
      webhook: { defaultHeaders: { "x-gateway-source": "test" } },
    });

    await assert.rejects(() => failingService.sendMessage(input), /gateway\.webhook_delivery_failed:503/);

    const queued = deliveryService.getRetryableMessages();
    assert.equal(queued.length, 1);

    const trackedPayload = queued[0]!.payload as {
      targetId: string;
      text: string;
      metadata: Record<string, unknown>;
      requestEnvelope?: Record<string, unknown>;
    };
    assert.equal(trackedPayload.targetId, target.targetId);
    assert.equal(trackedPayload.text, "Original message text");
    assert.deepEqual((trackedPayload.metadata as { requestEnvelope?: unknown }).requestEnvelope, input.metadata?.requestEnvelope);
    assert.deepEqual(trackedPayload.requestEnvelope, input.metadata?.requestEnvelope);
  } finally {
    harness.close();
  }
});

test("ISSUE #2047: flattened envelope metadata is normalized into requestEnvelope", async () => {
  const harness = createHarness();
  try {
    const deliveryService = new ChannelGatewayDeliveryService(harness.db, {
      maxRetries: 3,
      initialBackoffMs: 0,
      maxBackoffMs: 0,
    });

    const target = harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "webhook",
      externalTargetId: "https://hooks.example.test/flattened",
      displayName: "Flattened Hook",
    });

    const metadata = {
      webhookUrl: "https://hooks.example.test/flattened",
      _envelope_source: "bitbucket",
      _envelope_tenantId: "tenant-bitbucket",
      _envelope_eventType: "push",
    };
    const failingService = new ChannelGatewayService(harness.store, harness.targets, {
      deliveryService,
      fetchImpl: async () => ({ ok: false, status: 503 } as Response),
      webhook: { defaultHeaders: { "x-gateway-source": "test" } },
    });

    await assert.rejects(
      () => failingService.sendMessage({
        targetId: target.targetId,
        text: "Test with envelope fields",
        metadata,
      }),
      /gateway\.webhook_delivery_failed:503/,
    );

    const queued = deliveryService.getRetryableMessages();
    assert.equal(queued.length, 1);

    const trackedPayload = queued[0]!.payload as {
      text: string;
      metadata: Record<string, unknown>;
      requestEnvelope?: Record<string, unknown>;
    };
    assert.equal(trackedPayload.text, "Test with envelope fields");
    assert.deepEqual(trackedPayload.metadata, metadata);
    assert.deepEqual(trackedPayload.requestEnvelope, {
      source: "bitbucket",
      tenantId: "tenant-bitbucket",
      eventType: "push",
    });
  } finally {
    harness.close();
  }
});

test("ISSUE #2047: retry processing replays webhook with top-level requestEnvelope", async () => {
  const harness = createHarness();
  try {
    const deliveryService = new ChannelGatewayDeliveryService(harness.db, {
      maxRetries: 3,
      initialBackoffMs: 0,
      maxBackoffMs: 0,
    });
    const service = harness.createService({ deliveryService });

    const target = harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "webhook",
      externalTargetId: "https://hooks.example.test/retry-lost",
      displayName: "Retry Lost Hook",
    });

    const metadata = {
      correlationId: "corr-123",
      retryCount: 0,
      requestEnvelope: {
        requestId: "req-retry-1",
        tenantId: "tenant-retry",
        traceId: "trace-retry",
      },
    };
    const failingService = new ChannelGatewayService(harness.store, harness.targets, {
      deliveryService,
      fetchImpl: async () => ({ ok: false, status: 503 } as Response),
      webhook: { defaultHeaders: { "x-gateway-source": "test" } },
    });

    await assert.rejects(
      () => failingService.sendMessage({
        targetId: target.targetId,
        text: "Message that needs retry",
        metadata,
      }),
      /gateway\.webhook_delivery_failed:503/,
    );

    const queued = deliveryService.getRetryableMessages();
    assert.equal(queued.length, 1);

    // Process retry queue
    const summary = await service.processRetryQueue(10);

    assert.equal(summary.delivered, 1);
    assert.deepEqual((harness.requests.at(-1)?.body as { metadata?: unknown } | undefined)?.metadata, metadata);
    assert.deepEqual((harness.requests.at(-1)?.body as { requestEnvelope?: unknown } | undefined)?.requestEnvelope, metadata.requestEnvelope);
  } finally {
    harness.close();
  }
});

// ── Normal functionality tests (should continue to work) ───────────────────────

test("ChannelGatewayService sendMessage works without delivery service", async () => {
  const harness = createHarness();
  try {
    const target = harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "webhook",
      externalTargetId: "https://hooks.example.test/no-tracking",
      displayName: "No Tracking Hook",
    });

    const service = harness.createService();
    const receipt = await service.sendMessage({
      targetId: target.targetId,
      text: "No tracking needed",
    });

    assert.equal(receipt.channel, "webhook");
    assert.equal(receipt.responseStatus, 202);
  } finally {
    harness.close();
  }
});

test("ChannelGatewayService processRetryQueue returns empty when no delivery service", async () => {
  const harness = createHarness();
  try {
    const service = harness.createService();
    const summary = await service.processRetryQueue();

    assert.equal(summary.scanned, 0);
    assert.equal(summary.delivered, 0);
    assert.equal(summary.retryScheduled, 0);
    assert.equal(summary.deadLettered, 0);
    assert.equal(summary.skippedRateLimited, 0);
  } finally {
    harness.close();
  }
});

test("ChannelGatewayService retry works when message is tracked and retried", async () => {
  const harness = createHarness();
  try {
    const deliveryService = new ChannelGatewayDeliveryService(harness.db, {
      maxRetries: 3,
      initialBackoffMs: 0,
      maxBackoffMs: 0,
    });
    const service = harness.createService({ deliveryService });

    const target = harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "webhook",
      externalTargetId: "https://hooks.example.test/actual-retry",
      displayName: "Actual Retry Hook",
    });

    // First send fails
    let attemptCount = 0;
    const failingFetch: typeof fetch = async () => {
      attemptCount++;
      if (attemptCount === 1) {
        return { ok: false, status: 503 } as Response;
      }
      return { ok: true, status: 202, json: async () => ({}) } as Response;
    };

    // Create service with failing fetch
    const failingService = new ChannelGatewayService(harness.store, harness.targets, {
      deliveryService,
      fetchImpl: failingFetch,
      webhook: { defaultHeaders: {} },
    }, undefined);

    await assert.rejects(
      failingService.sendMessage({
        targetId: target.targetId,
        text: "Will retry",
      }),
      /gateway\.webhook_delivery_failed:503/,
    );

    const queued = deliveryService.getRetryableMessages();
    assert.equal(queued.length, 1);

    // Retry succeeds
    const summary = await service.processRetryQueue();
    assert.equal(summary.delivered, 1);
  } finally {
    harness.close();
  }
});
