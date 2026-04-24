import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";

import { ChannelGatewayDeliveryService, CHANNEL_DELIVERY_DDL } from "../../../../../src/platform/interface/channel-gateway/channel-gateway-delivery-service.js";
import { ChannelGatewayService } from "../../../../../src/platform/interface/channel-gateway/channel-gateway-service.js";
import { GatewayTargetDirectoryService } from "../../../../../src/platform/interface/channel-gateway/gateway-target-directory-service.js";
import { GatewayStorageAdapter } from "../../../../../src/platform/interface/channel-gateway/storage-adapter.js";
import { ChannelGatewayRetryExecutor } from "../../../../../src/platform/interface/channel-gateway/channel-gateway-retry-executor.js";
import { StreamBridge } from "../../../../../src/platform/interface/channel-gateway/stream-bridge.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { join } from "node:path";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function createGatewayTestHarness() {
  const workspace = createTempWorkspace("aa-gateway-integration-");
  const dbPath = join(workspace, "gateway.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(CHANNEL_DELIVERY_DDL);
  const store = new AuthoritativeTaskStore(db);
  const storageAdapter = new GatewayStorageAdapter(store);
  const targets = new GatewayTargetDirectoryService(storageAdapter);
  const capturedRequests: CapturedRequest[] = [];

  const defaultFetchImpl: typeof fetch = async (input, init) => {
    capturedRequests.push({
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
    if (capturedRequests[capturedRequests.length - 1]?.url.includes("telegram")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ result: { message_id: 888 } }),
      } as Response;
    }
    if (capturedRequests[capturedRequests.length - 1]?.url.includes("slack")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, ts: "1710000001.123456" }),
      } as Response;
    }
    if (capturedRequests[capturedRequests.length - 1]?.url.includes("webhook")) {
      return {
        ok: true,
        status: 202,
        json: async () => ({ received: true }),
      } as Response;
    }
    return {
      ok: true,
      status: 202,
      json: async () => ({ ok: true }),
    } as Response;
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

// ============================================================================
// GatewayTargetDirectoryService - Additional Tests
// ============================================================================

test("GatewayTargetDirectoryService throws on empty query", () => {
  const h = createGatewayTestHarness();
  try {
    assert.throws(
      () => h.targets.resolveTarget({ query: "" }),
      /gateway\.target_query_required/,
    );
    assert.throws(
      () => h.targets.resolveTarget({ query: "   " }),
      /gateway\.target_query_required/,
    );
  } finally {
    h.cleanup();
  }
});

test("GatewayTargetDirectoryService throws GatewayTargetNotFoundError for unknown query", () => {
  const h = createGatewayTestHarness();
  try {
    h.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "existing-user",
      displayName: "Existing User",
      aliases: [],
    });

    assert.throws(
      () => h.targets.resolveTarget({ query: "nonexistent-query" }),
      /gateway\.target_not_found:nonexistent-query/,
    );
  } finally {
    h.cleanup();
  }
});

test("GatewayTargetDirectoryService throws GatewayTargetAmbiguousError when multiple matches", () => {
  const h = createGatewayTestHarness();
  try {
    // Register two targets with same display name prefix
    h.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "user-one",
      displayName: "John",
      aliases: ["john1"],
    });
    h.targets.registerTarget({
      channel: "slack",
      targetKind: "user",
      externalTargetId: "user-two",
      displayName: "John",
      aliases: ["john2"],
    });

    // Exact match on same displayName should be ambiguous
    assert.throws(
      () => h.targets.resolveTarget({ query: "john" }),
      /gateway\.target_ambiguous/,
    );
  } finally {
    h.cleanup();
  }
});

test("GatewayTargetDirectoryService resolves by displayName exact match", () => {
  const h = createGatewayTestHarness();
  try {
    const target = h.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "display-name-user",
      displayName: "Unique Display Name",
      aliases: ["alias1", "alias2"],
    });

    const resolved = h.targets.resolveTarget({ query: "Unique Display Name" });
    assert.ok(resolved != null);
    assert.equal(resolved.entry.targetId, target.targetId);
    assert.equal(resolved.matchedBy, "display_name_exact");
  } finally {
    h.cleanup();
  }
});

test("GatewayTargetDirectoryService resolves by alias exact match", () => {
  const h = createGatewayTestHarness();
  try {
    const target = h.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "alias-user",
      displayName: "Alias User",
      aliases: ["special-alias", "another-alias"],
    });

    const resolved = h.targets.resolveTarget({ query: "special-alias" });
    assert.ok(resolved != null);
    assert.equal(resolved.entry.targetId, target.targetId);
    assert.equal(resolved.matchedBy, "alias_exact");
  } finally {
    h.cleanup();
  }
});

test("GatewayTargetDirectoryService listTargets filters by channel", () => {
  const h = createGatewayTestHarness();
  try {
    h.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "telegram-user-1",
      displayName: "Telegram User 1",
      aliases: [],
    });
    h.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "telegram-user-2",
      displayName: "Telegram User 2",
      aliases: [],
    });
    h.targets.registerTarget({
      channel: "slack",
      targetKind: "room",
      externalTargetId: "slack-room",
      displayName: "Slack Room",
      aliases: [],
    });

    const telegramOnly = h.targets.listTargets({ channel: "telegram" });
    assert.equal(telegramOnly.length, 2);
    assert.ok(telegramOnly.every((t) => t.channel === "telegram"));

    const slackOnly = h.targets.listTargets({ channel: "slack" });
    assert.equal(slackOnly.length, 1);
    assert.equal(slackOnly[0]?.displayName, "Slack Room");
  } finally {
    h.cleanup();
  }
});

test("GatewayTargetDirectoryService listTargets filters by query", () => {
  const h = createGatewayTestHarness();
  try {
    h.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "user-searchable",
      displayName: "Searchable User",
      aliases: ["find-me"],
    });
    h.targets.registerTarget({
      channel: "slack",
      targetKind: "room",
      externalTargetId: "room-searchable",
      displayName: "Another Searchable",
      aliases: ["not-find-me"],
    });

    const results = h.targets.listTargets({ query: "searchable" });
    assert.equal(results.length, 2);
  } finally {
    h.cleanup();
  }
});

test("GatewayTargetDirectoryService listTargets respects limit", () => {
  const h = createGatewayTestHarness();
  try {
    for (let i = 0; i < 10; i++) {
      h.targets.registerTarget({
        channel: "telegram",
        targetKind: "user",
        externalTargetId: `user-${i}`,
        displayName: `User ${i}`,
        aliases: [],
      });
    }

    const limited = h.targets.listTargets({ limit: 3 });
    assert.equal(limited.length, 3);

    // Verify default limit is 50
    const all = h.targets.listTargets({});
    assert.ok(all.length <= 50);
  } finally {
    h.cleanup();
  }
});

test("GatewayTargetDirectoryService throws on invalid external target ID", () => {
  const h = createGatewayTestHarness();
  try {
    assert.throws(
      () =>
        h.targets.registerTarget({
          channel: "telegram",
          targetKind: "user",
          externalTargetId: "   ",
          displayName: "Invalid User",
          aliases: [],
        }),
      /gateway\.invalid_external_target_id/,
    );
  } finally {
    h.cleanup();
  }
});

test("GatewayTargetDirectoryService throws on empty display name", () => {
  const h = createGatewayTestHarness();
  try {
    assert.throws(
      () =>
        h.targets.registerTarget({
          channel: "telegram",
          targetKind: "user",
          externalTargetId: "valid-id",
          displayName: "   ",
          aliases: [],
        }),
      /gateway\.invalid_display_name/,
    );
  } finally {
    h.cleanup();
  }
});

test("GatewayTargetDirectoryService throws on invalid channel", () => {
  const h = createGatewayTestHarness();
  try {
    assert.throws(
      () =>
        h.targets.registerTarget({
          channel: "",
          targetKind: "user",
          externalTargetId: "valid-id",
          displayName: "Valid User",
          aliases: [],
        }),
      /gateway\.invalid_channel/,
    );
  } finally {
    h.cleanup();
  }
});

// ============================================================================
// ChannelGatewayDeliveryService - Additional Tests
// ============================================================================

test("ChannelGatewayDeliveryService verifySignature accepts valid signature", () => {
  const h = createGatewayTestHarness();
  try {
    const payload = '{"text":"hello"}';
    const secret = "webhook-secret-123";
    const signature = h.deliveryService.generateSignature(payload, secret);

    const result = h.deliveryService.verifySignature(payload, signature, null, { secret });
    assert.equal(result.valid, true);
    assert.equal(result.error, null);
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayDeliveryService verifySignature rejects invalid signature", () => {
  const h = createGatewayTestHarness();
  try {
    const payload = '{"text":"hello"}';
    const secret = "webhook-secret-123";
    const wrongSignature = "sha256=0000000000000000000000000000000000000000000000000000000000000000";

    const result = h.deliveryService.verifySignature(payload, wrongSignature, null, { secret });
    assert.equal(result.valid, false);
    assert.equal(result.error, "signature_mismatch");
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayDeliveryService verifySignature rejects missing signature", () => {
  const h = createGatewayTestHarness();
  try {
    const result = h.deliveryService.verifySignature("payload", null, null, { secret: "secret" });
    assert.equal(result.valid, false);
    assert.equal(result.error, "missing_signature");
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayDeliveryService verifySignature validates timestamp tolerance", () => {
  const h = createGatewayTestHarness();
  try {
    const payload = '{"text":"hello"}';
    const secret = "webhook-secret-123";
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600); // 10 minutes ago
    const signedPayload = `${oldTimestamp}.${payload}`;
    const signature = `sha256=${createHmac("sha256", secret).update(signedPayload).digest("hex")}`;

    const result = h.deliveryService.verifySignature(payload, signature, oldTimestamp, {
      secret,
      toleranceSeconds: 300,
    });
    assert.equal(result.valid, false);
    assert.equal(result.error, "timestamp_outside_tolerance");
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayDeliveryService verifyNonce prevents replay", () => {
  const h = createGatewayTestHarness();
  try {
    const nonce = h.deliveryService.generateNonce();

    const firstResult = h.deliveryService.verifyNonce(nonce);
    assert.equal(firstResult.valid, true);
    assert.equal(firstResult.error, null);

    const secondResult = h.deliveryService.verifyNonce(nonce);
    assert.equal(secondResult.valid, false);
    assert.equal(secondResult.error, "nonce_already_used");
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayDeliveryService generateNonce produces unique values", () => {
  const h = createGatewayTestHarness();
  try {
    const nonce1 = h.deliveryService.generateNonce();
    const nonce2 = h.deliveryService.generateNonce();
    assert.notEqual(nonce1, nonce2);
    assert.ok(nonce1.length >= 32);
    assert.ok(nonce2.length >= 32);
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayDeliveryService getRateLimitStatus returns all channels", () => {
  const h = createGatewayTestHarness();
  try {
    const status = h.deliveryService.getRateLimitStatus();
    assert.ok("telegram" in status);
    assert.ok("slack" in status);
    assert.ok("webhook" in status);
    assert.equal(typeof status.telegram.limit, "number");
    assert.equal(typeof status.telegram.windowMs, "number");
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayDeliveryService markPermanentFailure updates message status", () => {
  const h = createGatewayTestHarness();
  try {
    const target = h.targets.registerTarget({
      channel: "webhook",
      targetKind: "room",
      externalTargetId: "https://example.test/permanent-fail",
      displayName: "Permanent Fail Test",
      aliases: [],
    });

    const message = h.deliveryService.createDeliveryMessage(
      "webhook",
      target.targetId,
      { text: "Will fail permanently" },
    );

    h.deliveryService.markPermanentFailure(message.messageId, "Non-retryable error");

    const receipt = h.deliveryService.getDeliveryReceipt(message.messageId);
    assert.equal(receipt?.status, "failed");
    assert.equal(receipt?.finalStatus, "permanent_failure");
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayDeliveryService getPendingDeliveries returns queued messages", () => {
  const h = createGatewayTestHarness();
  try {
    const target = h.targets.registerTarget({
      channel: "webhook",
      targetKind: "room",
      externalTargetId: "https://example.test/pending",
      displayName: "Pending Test",
      aliases: [],
    });

    h.deliveryService.createDeliveryMessage(
      "webhook",
      target.targetId,
      { text: "Pending message 1" },
    );
    h.deliveryService.createDeliveryMessage(
      "webhook",
      target.targetId,
      { text: "Pending message 2" },
    );

    const pending = h.deliveryService.getPendingDeliveries();
    assert.ok(pending.length >= 2);
    assert.ok(pending.every((p) => p.channel === "webhook"));
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayDeliveryService getDeadLetterCount returns channel counts", () => {
  const h = createGatewayTestHarness();
  try {
    const target = h.targets.registerTarget({
      channel: "webhook",
      targetKind: "room",
      externalTargetId: "https://example.test/dl-count",
      displayName: "DL Count Test",
      aliases: [],
    });

    // Create and dead-letter a message
    const message = h.deliveryService.createDeliveryMessage(
      "webhook",
      target.targetId,
      { text: "Dead letter candidate" },
      1, // maxRetries = 1
    );

    h.deliveryService.recordDeliveryFailure(message.messageId, {
      responseStatus: 503,
      errorMessage: "Service unavailable",
      retryable: true,
    });

    const counts = h.deliveryService.getDeadLetterCount();
    assert.ok((counts.webhook ?? 0) >= 1);
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayDeliveryService getDeadLetters with channel filter", () => {
  const h = createGatewayTestHarness();
  try {
    const telegramTarget = h.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "telegram-dl-user",
      displayName: "Telegram DL User",
      aliases: [],
    });

    const webhookTarget = h.targets.registerTarget({
      channel: "webhook",
      targetKind: "room",
      externalTargetId: "https://example.test/webhook-dl",
      displayName: "Webhook DL",
      aliases: [],
    });

    // Create and dead-letter a telegram message
    const telegramMsg = h.deliveryService.createDeliveryMessage(
      "telegram",
      telegramTarget.targetId,
      { text: "Telegram dead letter" },
      1,
    );
    h.deliveryService.recordDeliveryFailure(telegramMsg.messageId, {
      responseStatus: 500,
      retryable: true,
    });

    // Create and dead-letter a webhook message
    const webhookMsg = h.deliveryService.createDeliveryMessage(
      "webhook",
      webhookTarget.targetId,
      { text: "Webhook dead letter" },
      1,
    );
    h.deliveryService.recordDeliveryFailure(webhookMsg.messageId, {
      responseStatus: 500,
      retryable: true,
    });

    const telegramDL = h.deliveryService.getDeadLetters("telegram");
    assert.ok(telegramDL.every((dl) => dl.channel === "telegram"));

    const webhookDL = h.deliveryService.getDeadLetters("webhook");
    assert.ok(webhookDL.every((dl) => dl.channel === "webhook"));
  } finally {
    h.cleanup();
  }
});

// ============================================================================
// ChannelGatewayService - Additional Tests
// ============================================================================

test("ChannelGatewayService sends webhook with metadata", async () => {
  const h = createGatewayTestHarness();
  try {
    const target = h.targets.registerTarget({
      channel: "webhook",
      targetKind: "room",
      externalTargetId: "https://example.test/webhook-metadata",
      displayName: "Webhook Metadata Test",
      aliases: [],
    });

    const receipt = await h.channelGateway.sendMessage({
      targetId: target.targetId,
      text: "Webhook with metadata",
      metadata: {
        webhookUrl: "https://example.test/custom-webhook",
        traceId: "trace-abc-123",
      },
    });

    assert.equal(receipt.channel, "webhook");
    assert.equal(h.capturedRequests.length, 1);
    const lastRequest = h.capturedRequests[h.capturedRequests.length - 1];
    assert.ok(lastRequest);
    assert.ok(lastRequest.url.includes("custom-webhook"));
    assert.ok(lastRequest.body && typeof lastRequest.body === "object" && "metadata" in lastRequest.body);
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayService uses externalTargetId as webhook URL fallback", async () => {
  const h = createGatewayTestHarness();
  try {
    const target = h.targets.registerTarget({
      channel: "webhook",
      targetKind: "room",
      externalTargetId: "https://example.test/fallback-url",
      displayName: "Fallback URL Test",
      aliases: [],
    });

    const receipt = await h.channelGateway.sendMessage({
      targetId: target.targetId,
      text: "Using fallback URL",
    });

    assert.equal(receipt.channel, "webhook");
    assert.ok(h.capturedRequests[0]?.url.includes("fallback-url"));
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayService throws when webhook URL is missing", async () => {
  const h = createGatewayTestHarness();
  try {
    const target = h.targets.registerTarget({
      channel: "webhook",
      targetKind: "room",
      externalTargetId: "not-a-url", // Doesn't start with http
      displayName: "No URL Test",
      aliases: [],
    });

    await assert.rejects(
      h.channelGateway.sendMessage({
        targetId: target.targetId,
        text: "Should fail",
      }),
      /gateway\.webhook_url_required/,
    );
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayService sends message with query when targetId not provided", async () => {
  const h = createGatewayTestHarness();
  try {
    const target = h.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "telegram-query-user",
      displayName: "Query User",
      aliases: [],
    });

    // Using query (not targetId) should resolve the target
    const receipt = await h.channelGateway.sendMessage({
      query: target.targetId,
      text: "Hello via query",
    });

    assert.equal(receipt.channel, "telegram");
    assert.equal(receipt.providerMessageId, "888");
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayService throws GatewayRateLimitError when rate limited", async () => {
  const h = createGatewayTestHarness();
  try {
    // Create a service with very low rate limit
    const limitedDeliveryService = new ChannelGatewayDeliveryService(h.db, {
      rateLimit: {
        telegram: { limit: 1, windowMs: 60000 },
      },
    });

    const limitedGateway = new ChannelGatewayService(h.targets["store"], h.targets, {
      fetchImpl: h.channelGateway["fetchImpl"],
      telegram: {
        botToken: "test-telegram-token",
        baseUrl: "https://telegram.example.test",
      },
      deliveryService: limitedDeliveryService,
    });

    const target = h.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "rate-limited-user",
      displayName: "Rate Limited User",
      aliases: [],
    });

    // First message should succeed
    await limitedGateway.sendMessage({
      targetId: target.targetId,
      text: "First message",
    });

    // Second message should be rate limited
    await assert.rejects(
      limitedGateway.sendMessage({
        targetId: target.targetId,
        text: "Second message",
      }),
      /gateway\.rate_limited/,
    );
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayService throws when telegram not configured", async () => {
  const h = createGatewayTestHarness();
  try {
    // Create gateway without telegram config
    const noTelegramGateway = new ChannelGatewayService(h.targets["store"], h.targets, {
      fetchImpl: h.channelGateway["fetchImpl"],
      // No telegram config
    });

    const target = h.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "telegram-no-config-user",
      displayName: "No Config User",
      aliases: [],
    });

    await assert.rejects(
      noTelegramGateway.sendMessage({
        targetId: target.targetId,
        text: "Should fail - no telegram config",
      }),
      /gateway\.telegram_not_configured/,
    );
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayService throws when slack not configured", async () => {
  const h = createGatewayTestHarness();
  try {
    const noSlackGateway = new ChannelGatewayService(h.targets["store"], h.targets, {
      fetchImpl: h.channelGateway["fetchImpl"],
      // No slack config
    });

    const target = h.targets.registerTarget({
      channel: "slack",
      targetKind: "room",
      externalTargetId: "C_NO_CONFIG_CHANNEL",
      displayName: "No Config Slack",
      aliases: [],
    });

    await assert.rejects(
      noSlackGateway.sendMessage({
        targetId: target.targetId,
        text: "Should fail - no slack config",
      }),
      /gateway\.slack_not_configured/,
    );
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayService throws on unsupported channel", async () => {
  const h = createGatewayTestHarness();
  try {
    // Register a telegram target
    const target = h.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "telegram-unsupported-user",
      displayName: "Telegram Unsupported",
      aliases: [],
    });

    // Create a gateway without any channel configs to trigger unsupported
    const noChannelGateway = new ChannelGatewayService(h.targets["store"], h.targets, {
      fetchImpl: h.channelGateway["fetchImpl"],
      // No telegram, slack, or webhook configs
    });

    await assert.rejects(
      noChannelGateway.sendMessage({
        targetId: target.targetId,
        text: "Should fail",
      }),
      /gateway\.telegram_not_configured|gateway\.unsupported_channel/,
    );
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayService throws on invalid text", async () => {
  const h = createGatewayTestHarness();
  try {
    const target = h.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "invalid-text-user",
      displayName: "Invalid Text User",
      aliases: [],
    });

    await assert.rejects(
      h.channelGateway.sendMessage({
        targetId: target.targetId,
        text: "   ", // Whitespace only
      }),
      /gateway\.invalid_text/,
    );
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayService throws when target not found", async () => {
  const h = createGatewayTestHarness();
  try {
    await assert.rejects(
      h.channelGateway.sendMessage({
        targetId: "nonexistent:target:id",
        text: "Should fail",
      }),
      /gateway\.target_not_found/,
    );
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayService processes retry queue with failed messages", async () => {
  const h = createGatewayTestHarness();
  try {
    const target = h.targets.registerTarget({
      channel: "webhook",
      targetKind: "room",
      externalTargetId: "https://example.test/retry-failed",
      displayName: "Retry Failed Test",
      aliases: [],
    });

    // Create a message with 2 retries allowed (allows 1 retry before dead-letter)
    const message = h.deliveryService.createDeliveryMessage(
      "webhook",
      target.targetId,
      { text: "Will be retried" },
      2,
    );

    // Record first failure - should schedule retry since attemptNumber (1) < maxRetries (2)
    const failure = h.deliveryService.recordDeliveryFailure(message.messageId, {
      responseStatus: 503,
      errorMessage: "Service unavailable",
      retryable: true,
    });

    assert.equal(failure?.outcome, "retry_scheduled");
    assert.equal(failure?.attempt.status, "retrying");
  } finally {
    h.cleanup();
  }
});

// ============================================================================
// ChannelGatewayRetryExecutor Tests
// ============================================================================

test("ChannelGatewayRetryExecutor start and stop", async () => {
  const h = createGatewayTestHarness();
  try {
    const executor = new ChannelGatewayRetryExecutor(h.channelGateway, {
      pollIntervalMs: 100,
      autoStart: false,
    });

    executor.start();
    assert.ok(executor["intervalHandle"] != null);

    executor.stop();
    assert.ok(executor["intervalHandle"] == null);
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayRetryExecutor runOnce returns busy when already running", async () => {
  const h = createGatewayTestHarness();
  try {
    const executor = new ChannelGatewayRetryExecutor(h.channelGateway, {
      pollIntervalMs: 10000,
      autoStart: false,
    });

    // Set running to true to simulate busy state
    executor["running"] = true;

    const result = await executor.runOnce();
    assert.equal(result.busy, true);
    assert.equal(result.scanned, 0);
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayRetryExecutor runOnce processes retry queue", async () => {
  const h = createGatewayTestHarness();
  try {
    const executor = new ChannelGatewayRetryExecutor(h.channelGateway, {
      pollIntervalMs: 10000,
      autoStart: false,
    });

    const result = await executor.runOnce();
    assert.equal(result.busy, false);
    assert.ok(result.startedAt != null);
    assert.ok(result.completedAt != null);
  } finally {
    h.cleanup();
  }
});

// ============================================================================
// StreamBridge Tests
// ============================================================================

test("StreamBridge createStreamId generates unique IDs", () => {
  const bridge = new StreamBridge();
  const id1 = bridge.createStreamId("task-123", "updates");
  const id2 = bridge.createStreamId("task-456", "updates");

  assert.ok(id1.includes("task-123"));
  assert.ok(id2.includes("task-456"));
  assert.notEqual(id1, id2);
});

test("StreamBridge emitFrame assigns sequential sequence numbers", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-seq", "updates");

  const frame1 = bridge.emitFrame({
    streamId,
    taskId: "task-seq",
    channel: "updates",
    eventType: "status_changed",
    payload: { status: "running" },
  });

  const frame2 = bridge.emitFrame({
    streamId,
    taskId: "task-seq",
    channel: "updates",
    eventType: "progress",
    payload: { progress: 50 },
  });

  assert.equal(frame1.sequence, 1);
  assert.equal(frame2.sequence, 2);
  assert.equal(frame1.streamId, frame2.streamId);
});

test("StreamBridge replay returns frames after lastSequence", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-replay", "updates");

  bridge.emitFrame({
    streamId,
    taskId: "task-replay",
    channel: "updates",
    eventType: "status_changed",
    payload: { status: "init" },
  });
  bridge.emitFrame({
    streamId,
    taskId: "task-replay",
    channel: "updates",
    eventType: "status_changed",
    payload: { status: "running" },
  });
  bridge.emitFrame({
    streamId,
    taskId: "task-replay",
    channel: "updates",
    eventType: "completed",
    payload: { result: "done" },
  });

  const result = bridge.replay(streamId, 1);
  assert.equal(result.replayable, true);
  assert.equal(result.frames.length, 2);
  assert.equal(result.frames[0]?.sequence, 2);
  assert.equal(result.frames[1]?.sequence, 3);
});

test("StreamBridge replayAfterSequence returns correct frames", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-after", "updates");

  bridge.emitFrame({
    streamId,
    taskId: "task-after",
    channel: "updates",
    eventType: "status_changed",
    payload: { status: "1" },
  });
  bridge.emitFrame({
    streamId,
    taskId: "task-after",
    channel: "updates",
    eventType: "status_changed",
    payload: { status: "2" },
  });
  bridge.emitFrame({
    streamId,
    taskId: "task-after",
    channel: "updates",
    eventType: "status_changed",
    payload: { status: "3" },
  });

  const frames = bridge.replayAfterSequence(streamId, 1);
  assert.equal(frames.length, 2);
});

test("StreamBridge toSseFrame converts frame correctly", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-sse", "updates");

  const frame = bridge.emitFrame({
    streamId,
    taskId: "task-sse",
    channel: "updates",
    eventType: "status_changed",
    payload: { status: "running" },
    createdAt: "2024-01-01T00:00:00.000Z",
  });

  const sseFrame = bridge.toSseFrame(frame);

  assert.ok(sseFrame.id.includes(streamId));
  assert.ok(sseFrame.id.includes(String(frame.sequence)));
  assert.equal(sseFrame.event, "status_changed");
  const parsedData = JSON.parse(sseFrame.data);
  assert.equal(parsedData.stream_id, streamId);
  assert.equal(parsedData.event_type, "status_changed");
});

test("StreamBridge getReplayWindow returns buffer metadata", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-window", "updates");

  bridge.emitFrame({
    streamId,
    taskId: "task-window",
    channel: "updates",
    eventType: "status_changed",
    payload: { status: "1" },
  });
  bridge.emitFrame({
    streamId,
    taskId: "task-window",
    channel: "updates",
    eventType: "status_changed",
    payload: { status: "2" },
  });

  const window = bridge.getReplayWindow(streamId);

  assert.ok(window.earliestAvailableSequence >= 1);
  assert.equal(window.replayMaxSequence, 2);
  assert.equal(window.bufferedFrameCount, 2);
});

test("StreamBridge emits message delta frames", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-delta", "updates");

  const frame = bridge.emitMessageDelta({
    streamId,
    taskId: "task-delta",
    channel: "updates",
    delta: "Hello",
    role: "assistant",
  });

  assert.equal(frame.eventType, "message_delta");
  assert.deepEqual(frame.payload, { delta: "Hello", role: "assistant" });
});

test("StreamBridge replay returns frames after last buffered sequence", () => {
  const bridge = new StreamBridge({ maxReplayFrames: 3 });
  const streamId = bridge.createStreamId("task-evict", "updates");

  // Emit 5 frames (exceeds maxReplayFrames, older frames get evicted)
  for (let i = 1; i <= 5; i++) {
    bridge.emitFrame({
      streamId,
      taskId: "task-evict",
      channel: "updates",
      eventType: "status_changed",
      payload: { step: i },
    });
  }

  // After eviction, buffer has frames 3, 4, 5
  // Replay from sequence 2 should return frames 3, 4, 5
  const result = bridge.replay(streamId, 2);
  assert.equal(result.frames.length, 3);
  assert.equal(result.frames[0]?.sequence, 3);
  assert.equal(result.frames[1]?.sequence, 4);
  assert.equal(result.frames[2]?.sequence, 5);
});

test("StreamBridge emits from EventRecord", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-event", "updates");

  const eventRecord = {
    id: "evt-123",
    taskId: "task-event",
    sessionId: null,
    executionId: null,
    eventType: "task:status_changed",
    eventTier: "tier_2" as const,
    payloadJson: JSON.stringify({ toStatus: "running" }),
    traceId: null,
    createdAt: nowIso(),
  };

  const frame = bridge.emitFromEvent({
    streamId,
    channel: "updates",
    event: eventRecord,
  });

  assert.equal(frame.eventType, "status_changed");
  assert.equal(frame.taskId, "task-event");
});

// ============================================================================
// Helper function tests
// ============================================================================

test("ChannelGatewayService getDeliveryService returns configured service", () => {
  const h = createGatewayTestHarness();
  try {
    const service = h.channelGateway.getDeliveryService();
    assert.ok(service != null);
    assert.ok(service instanceof ChannelGatewayDeliveryService);
  } finally {
    h.cleanup();
  }
});

test("ChannelGatewayService getDeliveryService returns undefined when not configured", () => {
  const h = createGatewayTestHarness();
  try {
    const noDeliveryGateway = new ChannelGatewayService(h.targets["store"], h.targets, {
      fetchImpl: h.channelGateway["fetchImpl"],
    });

    assert.equal(noDeliveryGateway.getDeliveryService(), undefined);
  } finally {
    h.cleanup();
  }
});
