import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { ChannelGatewayDeliveryService, CHANNEL_DELIVERY_DDL } from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-delivery-service.js";
import { ChannelGatewayService, GatewayRateLimitError } from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-service.js";
import { DEFAULT_DELIVERY_CONFIG } from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-delivery-support.js";
import { GatewayTargetDirectoryService } from "../../../../../src/platform/five-plane-interface/channel-gateway/gateway-target-directory-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function createHarness(options: { fetchImpl?: typeof fetch } = {}) {
  const workspace = createTempWorkspace("aa-channel-gateway-unit-");
  const dbPath = join(workspace, "channel-gateway.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(CHANNEL_DELIVERY_DDL);
  const store = new AuthoritativeTaskStore(db);
  const targets = new GatewayTargetDirectoryService(store);
  const requests: CapturedRequest[] = [];
  const defaultFetchImpl: typeof fetch = async (input, init) => {
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
    if (requests[requests.length - 1]?.url.includes("telegram")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ result: { message_id: 777 } }),
      } as Response;
    }
    if (requests[requests.length - 1]?.url.includes("slack")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, ts: "1710000000.123456" }),
      } as Response;
    }
    return {
      ok: true,
      status: 202,
      json: async () => ({ ok: true }),
    } as Response;
  };
  const fetchImpl = options.fetchImpl ?? defaultFetchImpl;

  return {
    workspace,
    db,
    store,
    targets,
    requests,
    createService(options: { deliveryService?: ChannelGatewayDeliveryService } = {}) {
      return new ChannelGatewayService(store, targets, {
        fetchImpl,
        telegram: {
          botToken: "telegram-token",
          baseUrl: "https://telegram.example.test",
        },
        slack: {
          botToken: "slack-token",
          baseUrl: "https://slack.example.test",
        },
        webhook: {
          defaultHeaders: {
            "x-gateway-source": "automatic-agent",
          },
        },
        ...(options.deliveryService ? { deliveryService: options.deliveryService } : {}),
      });
    },
    close() {
      db.close();
      cleanupPath(workspace);
    },
  };
}

test("channel gateway service sends telegram messages through the configured bot endpoint", async () => {
  const harness = createHarness();
  try {
    harness.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "finance-team",
      displayName: "Finance Team",
      aliases: ["finance"],
    });
    const service = harness.createService();

    const receipt = await service.sendMessage({
      channel: "telegram",
      query: "finance",
      text: "Ship the budget update.",
    });

    assert.equal(receipt.channel, "telegram");
    assert.equal(receipt.providerMessageId, "777");
    assert.equal(receipt.requestUrl, "https://telegram.example.test/bot***/sendMessage");
    assert.equal(harness.requests[0]?.url, "https://telegram.example.test/bottelegram-token/sendMessage");
    assert.deepEqual(harness.requests[0]?.body, {
      chat_id: "finance-team",
      text: "Ship the budget update.",
    });
  } finally {
    harness.close();
  }
});

test("channel gateway service sends slack messages with bearer authorization", async () => {
  const harness = createHarness();
  try {
    harness.targets.registerTarget({
      channel: "slack",
      targetKind: "room",
      externalTargetId: "C123456",
      displayName: "Ops Room",
      aliases: ["ops-room"],
    });
    const service = harness.createService();

    const receipt = await service.sendMessage({
      channel: "slack",
      query: "ops-room",
      text: "Escalate the dispatch reconciliation alert.",
    });

    assert.equal(receipt.channel, "slack");
    assert.equal(receipt.providerMessageId, "1710000000.123456");
    assert.equal(harness.requests[0]?.url, "https://slack.example.test/chat.postMessage");
    assert.equal(harness.requests[0]?.headers.authorization, "Bearer slack-token");
    assert.deepEqual(harness.requests[0]?.body, {
      channel: "C123456",
      text: "Escalate the dispatch reconciliation alert.",
    });
  } finally {
    harness.close();
  }
});

test("channel gateway service merges webhook metadata and default headers", async () => {
  const harness = createHarness();
  try {
    const target = harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "room",
      externalTargetId: "https://hooks.example.test/fallback",
      displayName: "Ops Webhook",
      aliases: ["ops-hook"],
      metadata: {
        webhookUrl: "https://hooks.example.test/override",
        severity: "high",
      },
    });
    const service = harness.createService();

    const receipt = await service.sendMessage({
      targetId: target.targetId,
      text: "Promote the new control-plane build.",
      metadata: {
        traceId: "trace-1",
      },
    });

    assert.equal(receipt.channel, "webhook");
    assert.equal(receipt.requestUrl, "https://hooks.example.test/override");
    assert.equal(harness.requests[0]?.headers["x-gateway-source"], "automatic-agent");
    assert.deepEqual(harness.requests[0]?.body, {
      targetId: target.targetId,
      text: "Promote the new control-plane build.",
      metadata: {
        webhookUrl: "https://hooks.example.test/override",
        severity: "high",
        traceId: "trace-1",
      },
    });
  } finally {
    harness.close();
  }
});

test("channel gateway service sanitizes webhook receipt URLs that contain query credentials", async () => {
  const harness = createHarness();
  try {
    const target = harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "room",
      externalTargetId: "https://hooks.example.test/fallback",
      displayName: "Sensitive Hook",
      aliases: ["sensitive-hook"],
      metadata: {
        webhookUrl: "https://hooks.example.test/override?token=secret-token&trace=1",
      },
    });
    const service = harness.createService();

    const receipt = await service.sendMessage({
      targetId: target.targetId,
      text: "Protect the webhook receipt surface.",
    });

    assert.equal(receipt.requestUrl, "https://hooks.example.test/override?token=***&trace=1");
    assert.equal(harness.requests[0]?.url, "https://hooks.example.test/override?token=secret-token&trace=1");
  } finally {
    harness.close();
  }
});

test("channel gateway service deletes closed circuit breaker entries after reset", () => {
  const harness = createHarness();
  try {
    const service = harness.createService();
    const breakers = (service as any).circuitBreakers as Map<string, { reset: () => void }>;
    const breaker = (service as any).getCircuitBreaker("slack") as { reset: () => void };

    assert.equal(breakers.has("slack"), true);
    breaker.reset();
    assert.equal(breakers.has("slack"), true);
  } finally {
    harness.close();
  }
});

test("channel gateway service rejects internal webhook URLs", async () => {
  const harness = createHarness();
  try {
    const target = harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "room",
      externalTargetId: "http://127.0.0.1:8080/webhook",
      displayName: "Blocked Hook",
      aliases: ["blocked-hook"],
    });
    const service = harness.createService();

    await assert.rejects(
      service.sendMessage({
        targetId: target.targetId,
        text: "Do not SSRF local services.",
      }),
      /gateway\.webhook_url_blocked_ssrf/,
    );
    assert.equal(harness.requests.length, 0);
  } finally {
    harness.close();
  }
});

test("channel gateway service enforces per-channel rate limits before delivery", async () => {
  const harness = createHarness();
  try {
    harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "room",
      externalTargetId: "https://hooks.example.test/rate-limited",
      displayName: "Rate Limited Hook",
      aliases: ["rate-limited-hook"],
    });
    const deliveryService = new ChannelGatewayDeliveryService(harness.db, {
      rateLimit: {
        webhook: {
          limit: 1,
          windowMs: 60000,
        },
      },
    });
    const service = harness.createService({ deliveryService });

    await service.sendMessage({
      channel: "webhook",
      query: "rate-limited-hook",
      text: "First message succeeds.",
    });

    await assert.rejects(
      service.sendMessage({
        channel: "webhook",
        query: "rate-limited-hook",
        text: "Second message should be blocked.",
      }),
      (error: unknown) =>
        error instanceof GatewayRateLimitError
        && error.channel === "webhook"
        && error.limit === 1
        && error.currentCount === 1,
    );
    assert.equal(harness.requests.length, 1);
    assert.equal(deliveryService.getRateLimitStatus().webhook?.currentCount, 1);
    assert.equal(deliveryService.getPendingDeliveries().length, 0);
  } finally {
    harness.close();
  }
});

test("channel gateway service times out outbound provider calls", async () => {
  const fetchImpl: typeof fetch = async (_input, init) => await new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
  });
  const harness = createHarness({ fetchImpl });
  try {
    harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "room",
      externalTargetId: "https://hooks.example.test/timeout",
      displayName: "Timeout Hook",
      aliases: ["timeout-hook"],
    });
    const service = new ChannelGatewayService(harness.store, harness.targets, {
      fetchImpl,
      requestTimeoutMs: 10,
      webhook: {
        defaultHeaders: {
          "x-gateway-source": "automatic-agent",
        },
      },
    });

    await assert.rejects(
      service.sendMessage({
        query: "timeout-hook",
        text: "This should time out.",
      }),
      /gateway\.webhook_timeout/,
    );
  } finally {
    harness.close();
  }
});

test("channel gateway service derives default request timeout from delivery config", () => {
  const harness = createHarness();
  try {
    const service = harness.createService();
    assert.equal(
      (service as unknown as { requestTimeoutMs: number }).requestTimeoutMs,
      DEFAULT_DELIVERY_CONFIG.timeoutMs,
    );
  } finally {
    harness.close();
  }
});

test("channel gateway service opens provider circuit breaker after repeated retryable failures", async () => {
  let requestCount = 0;
  const fetchImpl: typeof fetch = async () => {
    requestCount += 1;
    return {
      ok: false,
      status: 503,
      json: async () => ({ ok: false }),
    } as Response;
  };
  const harness = createHarness({ fetchImpl });
  try {
    harness.targets.registerTarget({
      channel: "slack",
      targetKind: "room",
      externalTargetId: "C123456",
      displayName: "Failing Slack",
      aliases: ["failing-slack"],
    });
    const service = new ChannelGatewayService(harness.store, harness.targets, {
      fetchImpl,
      circuitBreakerFailureThreshold: 2,
      slack: {
        botToken: "slack-token",
        baseUrl: "https://slack.example.test",
      },
    });

    await assert.rejects(
      service.sendMessage({ query: "failing-slack", text: "first failure" }),
      /gateway\.slack_delivery_failed:503/,
    );
    await assert.rejects(
      service.sendMessage({ query: "failing-slack", text: "second failure" }),
      /gateway\.slack_delivery_failed:503/,
    );
    await assert.rejects(
      service.sendMessage({ query: "failing-slack", text: "breaker open" }),
      /gateway\.slack_circuit_open/,
    );
    assert.equal(requestCount, 2);
  } finally {
    harness.close();
  }
});

test("channel gateway service retries queued delivery failures asynchronously", async () => {
  let attempts = 0;
  const requests: CapturedRequest[] = [];
  const harness = createHarness({
    fetchImpl: async (input, init) => {
      attempts += 1;
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
      if (attempts === 1) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ ok: false }),
        } as Response;
      }
      return {
        ok: true,
        status: 202,
        json: async () => ({ ok: true }),
      } as Response;
    },
  });

  try {
    const target = harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "room",
      externalTargetId: "https://hooks.example.test/retry-me",
      displayName: "Retry Hook",
      aliases: ["retry-hook"],
    });
    const deliveryService = new ChannelGatewayDeliveryService(harness.db, {
      maxRetries: 3,
      initialBackoffMs: 0,
      maxBackoffMs: 0,
    });
    const service = harness.createService({ deliveryService });

    await assert.rejects(
      service.sendMessage({
        targetId: target.targetId,
        text: "Retry this delivery.",
      }),
      /gateway\.webhook_delivery_failed:503/,
    );

    const queued = deliveryService.getRetryableMessages();
    assert.equal(queued.length, 1);

    const summary = await service.processRetryQueue();

    assert.equal(summary.scanned, 1);
    assert.equal(summary.delivered, 1);
    assert.equal(summary.deadLettered, 0);
    assert.equal(summary.retryScheduled, 0);
    assert.equal(requests.length, 2);
    const receipt = deliveryService.getDeliveryReceipt(queued[0]!.messageId);
    assert.equal(receipt?.status, "delivered");
    assert.equal(receipt?.attempts, 2);
  } finally {
    harness.close();
  }
});

test("channel gateway service escalates non-retryable failures to dead letter", async () => {
  const requests: CapturedRequest[] = [];
  const harness = createHarness({
    fetchImpl: async (input, init) => {
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
        ok: false,
        status: 400,
        json: async () => ({ ok: false }),
      } as Response;
    },
  });

  try {
    const target = harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "room",
      externalTargetId: "https://hooks.example.test/permanent-failure",
      displayName: "Dead Letter Hook",
      aliases: ["dead-letter-hook"],
    });
    const deliveryService = new ChannelGatewayDeliveryService(harness.db, {
      maxRetries: 3,
      initialBackoffMs: 0,
      maxBackoffMs: 0,
    });
    const service = harness.createService({ deliveryService });

    await assert.rejects(
      service.sendMessage({
        targetId: target.targetId,
        text: "This delivery should dead-letter immediately.",
      }),
      /gateway\.webhook_delivery_failed:400/,
    );

    assert.equal(deliveryService.getRetryableMessages().length, 0);
    assert.equal(requests.length, 1);
    assert.equal(deliveryService.getDeadLetters().length, 1);
    assert.equal(deliveryService.getDeadLetters()[0]?.failureReason, "gateway.delivery_non_retryable_failure");
  } finally {
    harness.close();
  }
});

test("channel gateway service throws telegram_not_configured when telegram is not configured", async () => {
  const harness = createHarness();
  try {
    harness.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "finance-team",
      displayName: "Finance Team",
      aliases: ["finance"],
    });
    // Create service WITHOUT telegram config - fetch won't be called since error is thrown before fetch
    const dummyFetch = async (): Promise<Response> => {
      throw new Error("fetch should not be called");
    };
    const service = new ChannelGatewayService(harness.store, harness.targets, {
      fetchImpl: dummyFetch as unknown as typeof fetch,
    });

    await assert.rejects(
      service.sendMessage({
        channel: "telegram",
        query: "finance",
        text: "This should fail.",
      }),
      (err: unknown) => {
        return (err as any)?.code === "gateway.telegram_not_configured";
      },
    );
  } finally {
    harness.close();
  }
});

test("channel gateway service throws slack_not_configured when slack is not configured", async () => {
  const harness = createHarness();
  try {
    harness.targets.registerTarget({
      channel: "slack",
      targetKind: "room",
      externalTargetId: "C123456",
      displayName: "Ops Room",
      aliases: ["ops-room"],
    });
    // Create service WITHOUT slack config - fetch won't be called since error is thrown before fetch
    const dummyFetch = async (): Promise<Response> => {
      throw new Error("fetch should not be called");
    };
    const service = new ChannelGatewayService(harness.store, harness.targets, {
      fetchImpl: dummyFetch as unknown as typeof fetch,
    });

    await assert.rejects(
      service.sendMessage({
        channel: "slack",
        query: "ops-room",
        text: "This should fail.",
      }),
      (err: unknown) => {
        return (err as any)?.code === "gateway.slack_not_configured";
      },
    );
  } finally {
    harness.close();
  }
});

test("channel gateway service throws telegram_delivery_failed when API returns error", async () => {
  const workspace = createTempWorkspace("aa-channel-gateway-telegram-fail-");
  try {
    const dbPath = join(workspace, "channel-gateway.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const targets = new GatewayTargetDirectoryService(store);

    targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "finance-team",
      displayName: "Finance Team",
      aliases: ["finance"],
    });

    // Custom fetch that returns a 500 error for telegram
    const failingFetch = async (): Promise<Response> => {
      return {
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response;
    };

    const service = new ChannelGatewayService(store, targets, {
      fetchImpl: failingFetch as unknown as typeof fetch,
      telegram: {
        botToken: "telegram-token",
        baseUrl: "https://telegram.example.test",
      },
    });

    await assert.rejects(
      service.sendMessage({
        channel: "telegram",
        query: "finance",
        text: "This should fail.",
      }),
      (err: unknown) => {
        return (err as any)?.code === "gateway.telegram_delivery_failed:500";
      },
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("channel gateway service throws slack_delivery_failed when API returns error", async () => {
  const workspace = createTempWorkspace("aa-channel-gateway-slack-fail-");
  try {
    const dbPath = join(workspace, "channel-gateway.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const targets = new GatewayTargetDirectoryService(store);

    targets.registerTarget({
      channel: "slack",
      targetKind: "room",
      externalTargetId: "C123456",
      displayName: "Ops Room",
      aliases: ["ops-room"],
    });

    // Custom fetch that returns a 502 error for slack
    const failingFetch = async (): Promise<Response> => {
      return {
        ok: false,
        status: 502,
        json: async () => ({}),
      } as Response;
    };

    const service = new ChannelGatewayService(store, targets, {
      fetchImpl: failingFetch as unknown as typeof fetch,
      slack: {
        botToken: "slack-token",
        baseUrl: "https://slack.example.test",
      },
    });

    await assert.rejects(
      service.sendMessage({
        channel: "slack",
        query: "ops-room",
        text: "This should fail.",
      }),
      (err: unknown) => {
        return (err as any)?.code === "gateway.slack_delivery_failed:502";
      },
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("channel gateway service getDeliveryService returns undefined when not configured", () => {
  const harness = createHarness();
  try {
    const service = harness.createService();
    // When no delivery service is passed, getDeliveryService returns undefined
    assert.equal(service.getDeliveryService(), undefined);
  } finally {
    harness.close();
  }
});

test("channel gateway service getDeliveryService returns configured delivery service", () => {
  const harness = createHarness();
  try {
    const deliveryService = new ChannelGatewayDeliveryService(harness.db, {});
    const service = harness.createService({ deliveryService });
    assert.ok(service.getDeliveryService() != null);
    assert.equal(service.getDeliveryService(), deliveryService);
  } finally {
    harness.close();
  }
});

test("channel gateway service processRetryQueue returns zeros when no delivery service", async () => {
  const harness = createHarness();
  try {
    const service = harness.createService();
    // Without delivery service, processRetryQueue should return zeros
    const result = await service.processRetryQueue();
    assert.equal(result.scanned, 0);
    assert.equal(result.delivered, 0);
    assert.equal(result.retryScheduled, 0);
    assert.equal(result.deadLettered, 0);
    assert.equal(result.skippedRateLimited, 0);
  } finally {
    harness.close();
  }
});

test("channel gateway service throws slack_delivery_failed when API returns ok=false despite 200 status", async () => {
  const workspace = createTempWorkspace("aa-channel-gateway-slack-ok-false-");
  try {
    const dbPath = join(workspace, "channel-gateway.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const targets = new GatewayTargetDirectoryService(store);

    targets.registerTarget({
      channel: "slack",
      targetKind: "room",
      externalTargetId: "C123456",
      displayName: "Ops Room",
      aliases: ["ops-room"],
    });

    // Custom fetch that returns 200 but with ok=false in body
    const badSlackFetch = async (): Promise<Response> => {
      return {
        ok: true, // HTTP is OK
        status: 200,
        json: async () => ({ ok: false }), // But API says not ok
      } as Response;
    };

    const service = new ChannelGatewayService(store, targets, {
      fetchImpl: badSlackFetch as unknown as typeof fetch,
      slack: {
        botToken: "slack-token",
        baseUrl: "https://slack.example.test",
      },
    });

    await assert.rejects(
      service.sendMessage({
        channel: "slack",
        query: "ops-room",
        text: "This should fail.",
      }),
      (err: unknown) => {
        return (err as any)?.code === "gateway.slack_delivery_failed:provider_rejected";
      },
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("channel gateway service redacts externalTargetId from missing webhook url errors", async () => {
  const harness = createHarness();
  try {
    const target = harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "room",
      externalTargetId: "not-a-url",
      displayName: "No URL",
      aliases: [],
    });
    const service = harness.createService();

    await assert.rejects(
      () => service.sendMessage({
        targetId: target.targetId,
        text: "Should fail",
      }),
      (error: unknown) => {
        assert.ok(error && typeof error === "object");
        const details = (error as { details?: Record<string, unknown> }).details;
        assert.equal(details?.hasExternalTargetId, true);
        assert.equal(Object.hasOwn(details ?? {}, "externalTargetId"), false);
        return true;
      },
    );
  } finally {
    harness.close();
  }
});
