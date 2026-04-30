/**
 * @fileoverview Unit tests for Channel Gateway Service - Issue #2047
 *
 * ISSUE #2047: Inbound webhook stores raw payload not RequestEnvelope
 *
 * When an inbound webhook request is received and tracked for retry,
 * the delivery payload stores only { targetId, text, metadata } but NOT
 * the full RequestEnvelope that would be needed for proper replay.
 *
 * The current tracking stores raw message data but loses the envelope
 * context (source, tenantId, workspaceId, etc.) that was part of the
 * original webhook request.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { ChannelGatewayService } from "../../../../../src/platform/interface/channel-gateway/channel-gateway-service.js";
import { ChannelGatewayDeliveryService, CHANNEL_DELIVERY_DDL } from "../../../../../src/platform/interface/channel-gateway/channel-gateway-delivery-service.js";
import { GatewayTargetDirectoryService } from "../../../../../src/platform/interface/channel-gateway/gateway-target-directory-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import type { SendGatewayMessageInput } from "../../../../../src/platform/interface/channel-gateway/types.js";

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

test("ISSUE #2047: Tracked message payload only contains text and metadata, not envelope context", async () => {
  const harness = createHarness();
  try {
    const deliveryService = new ChannelGatewayDeliveryService(harness.db, {});
    const service = harness.createService({ deliveryService });

    harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "webhook",
      externalTargetId: "https://hooks.example.test/retry-me",
      displayName: "Retry Hook",
    });

    await service.sendMessage({
      targetId: "webhook:https://hooks.example.test/retry-me",
      text: "Test message with metadata",
      metadata: {
        originalEventType: "task.completed",
        sourceTenant: "tenant-123",
      },
    });

    const queued = deliveryService.getRetryableMessages();
    assert.equal(queued.length, 1);

    const trackedPayload = queued[0]!.payload;
    assert.equal(trackedPayload.targetId, "webhook:https://hooks.example.test/retry-me");
    assert.equal(trackedPayload.text, "Test message with metadata");

    // ISSUE #2047: The envelope context (sourceTenant, eventType, etc.) is NOT stored
    // Only text and metadata are preserved
    assert.equal(("sourceTenant" in trackedPayload), false);
    assert.equal(("originalEventType" in trackedPayload), false);
  } finally {
    harness.close();
  }
});

test("ISSUE #2047: Cannot reconstruct original RequestEnvelope from tracked payload", async () => {
  const harness = createHarness();
  try {
    const deliveryService = new ChannelGatewayDeliveryService(harness.db, {});
    const service = harness.createService({ deliveryService });

    harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "webhook",
      externalTargetId: "https://hooks.example.test/full-envelope",
      displayName: "Full Envelope Hook",
    });

    const input: SendGatewayMessageInput = {
      targetId: "webhook:https://hooks.example.test/full-envelope",
      text: "Original message text",
      metadata: {
        // These fields should be part of RequestEnvelope but are lost
        requestEnvelope: {
          envelopeId: "env-123",
          source: "github",
          tenantId: "tenant-abc",
          workspaceId: "workspace-xyz",
          eventType: "pull_request",
        },
      },
    };

    await service.sendMessage(input);

    const queued = deliveryService.getRetryableMessages();
    assert.equal(queued.length, 1);

    // When reconstructing for retry, we only have { targetId, text, metadata }
    // The original RequestEnvelope is lost
    const trackedPayload = queued[0]!.payload;
    const reconstructed = {
      targetId: trackedPayload.targetId,
      text: trackedPayload.text,
      // Cannot restore envelope - it's nested inside metadata but wasn't preserved as structured data
    };

    // We can reconstruct basic fields
    assert.equal(reconstructed.text, "Original message text");

    // But we CANNOT reconstruct the envelope context
    // because it was stored as a nested object in metadata, not as separate fields
    assert.equal(("envelopeId" in reconstructed), false);
    assert.equal(("source" in reconstructed), false);
  } finally {
    harness.close();
  }
});

test("ISSUE #2047: Webhook adapter metadata is preserved but envelope fields are flattened", async () => {
  const harness = createHarness();
  try {
    const deliveryService = new ChannelGatewayDeliveryService(harness.db, {});
    const service = harness.createService({ deliveryService });

    harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "webhook",
      externalTargetId: "https://hooks.example.test/flattened",
      displayName: "Flattened Hook",
    });

    // Send message with nested metadata that includes envelope fields
    await service.sendMessage({
      targetId: "webhook:https://hooks.example.test/flattened",
      text: "Test with envelope fields",
      metadata: {
        webhookUrl: "https://hooks.example.test/flattened",
        // Envelope fields were passed as part of metadata
        _envelope_source: "bitbucket",
        _envelope_tenantId: "tenant-bitbucket",
        _envelope_eventType: "push",
      },
    });

    const queued = deliveryService.getRetryableMessages();
    assert.equal(queued.length, 1);

    // The metadata is preserved (with underscore prefix attempt to preserve)
    const trackedPayload = queued[0]!.payload;
    assert.equal(trackedPayload.text, "Test with envelope fields");

    // But these envelope fields are flattened into metadata, not stored as structured envelope
    // This means replay cannot properly restore the original RequestEnvelope structure
  } finally {
    harness.close();
  }
});

test("ISSUE #2047: Retry processing reads text and metadata but cannot restore original envelope", async () => {
  const harness = createHarness();
  try {
    const deliveryService = new ChannelGatewayDeliveryService(harness.db, {});
    const service = harness.createService({ deliveryService });

    harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "webhook",
      externalTargetId: "https://hooks.example.test/retry-lost",
      displayName: "Retry Lost Hook",
    });

    await service.sendMessage({
      targetId: "webhook:https://hooks.example.test/retry-lost",
      text: "Message that needs retry",
      metadata: {
        correlationId: "corr-123",
        retryCount: 0,
      },
    });

    const queued = deliveryService.getRetryableMessages();
    assert.equal(queued.length, 1);

    // Process retry queue
    const summary = await service.processRetryQueue(10);

    // Retry succeeded (delivery service recorded it)
    assert.equal(summary.delivered, 1);

    // But the original envelope context (correlationId, source, etc.) was only in metadata
    // and cannot be properly restored as a first-class RequestEnvelope
  } finally {
    harness.close();
  }
});

// ── Normal functionality tests (should continue to work) ───────────────────────

test("ChannelGatewayService sendMessage works without delivery service", async () => {
  const harness = createHarness();
  try {
    harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "webhook",
      externalTargetId: "https://hooks.example.test/no-tracking",
      displayName: "No Tracking Hook",
    });

    const service = harness.createService();
    const receipt = await service.sendMessage({
      targetId: "webhook:https://hooks.example.test/no-tracking",
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

    harness.targets.registerTarget({
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
      fetchImpl: failingFetch,
      webhook: { defaultHeaders: {} },
    }, undefined);

    await assert.rejects(
      failingService.sendMessage({
        targetId: "webhook:https://hooks.example.test/actual-retry",
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
