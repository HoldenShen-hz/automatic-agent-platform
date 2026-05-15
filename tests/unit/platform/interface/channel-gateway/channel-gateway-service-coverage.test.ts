import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { ChannelGatewayService, ChannelAdapterRegistry, createDefaultChannelAdapterRegistry } from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-service.js";
import { GatewayTargetDirectoryService } from "../../../../../src/platform/five-plane-interface/channel-gateway/gateway-target-directory-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { ChannelGatewayDeliveryService, CHANNEL_DELIVERY_DDL } from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-delivery-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function createHarness() {
  const workspace = createTempWorkspace("aa-channel-gateway-coverage-");
  const dbPath = join(workspace, "channel-gateway-coverage.db");
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

test("ChannelGatewayService constructor initializes with default adapter registry", () => {
  const harness = createHarness();
  try {
    const service = harness.createService();
    assert.ok(service.getDeliveryService() === undefined);
  } finally {
    harness.close();
  }
});

test("ChannelGatewayService constructor accepts custom adapter registry", () => {
  const harness = createHarness();
  try {
    const customRegistry = new ChannelAdapterRegistry();
    const service = new ChannelGatewayService(harness.store, harness.targets, {
      fetchImpl: globalThis.fetch,
      telegram: { botToken: "test", baseUrl: "https://test.example" },
    }, customRegistry);
    assert.ok(service.getDeliveryService() === undefined);
  } finally {
    harness.close();
  }
});

test("ChannelGatewayService sendMessage resolves target by targetId", async () => {
  const harness = createHarness();
  try {
    const target = harness.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "finance-team",
      displayName: "Finance Team",
    });

    const service = harness.createService();
    const receipt = await service.sendMessage({
      targetId: target.targetId,
      text: "Hello finance team",
    });

    assert.equal(receipt.channel, "telegram");
    assert.equal(receipt.deliveredAt.length > 0, true);
    assert.equal(harness.requests.length > 0, true);
  } finally {
    harness.close();
  }
});

test("ChannelGatewayService sendMessage resolves target by query", async () => {
  const harness = createHarness();
  try {
    harness.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "finance-team",
      displayName: "Finance Team",
      alias: "finance",
    });

    const service = harness.createService();
    const receipt = await service.sendMessage({
      query: "finance",
      text: "Hello",
    });

    assert.equal(receipt.channel, "telegram");
  } finally {
    harness.close();
  }
});

test("ChannelGatewayService sendMessage throws on channel mismatch", async () => {
  const harness = createHarness();
  try {
    const target = harness.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "finance-team",
      displayName: "Finance Team",
    });

    const service = harness.createService();
    await assert.rejects(
      () => service.sendMessage({
        targetId: target.targetId,
        channel: "slack", // Different from target's channel
        text: "Hello",
      }),
      /gateway.channel_target_mismatch/,
    );
  } finally {
    harness.close();
  }
});

test("ChannelGatewayService sendMessage throws for empty text", async () => {
  const harness = createHarness();
  try {
    harness.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "finance-team",
      displayName: "Finance Team",
    });

    const service = harness.createService();
    await assert.rejects(
      () => service.sendMessage({
        targetId: "telegram:finance-team",
        text: "",
      }),
      /gateway.invalid_text/,
    );
  } finally {
    harness.close();
  }
});

test("ChannelGatewayService sendMessage throws when no query or targetId", async () => {
  const harness = createHarness();
  try {
    const service = harness.createService();
    await assert.rejects(
      () => service.sendMessage({
        query: "",
        text: "Hello",
      }),
      /gateway.target_query_required/,
    );
  } finally {
    harness.close();
  }
});

test("ChannelGatewayService sendMessage throws for unsupported channel", async () => {
  const harness = createHarness();
  try {
    const target = harness.targets.registerTarget({
      channel: "unsupported-channel",
      targetKind: "user",
      externalTargetId: "user-1",
      displayName: "Test User",
    });

    const service = harness.createService();
    await assert.rejects(
      () => service.sendMessage({
        targetId: target.targetId,
        text: "Hello",
      }),
      /gateway.unsupported_channel/,
    );
  } finally {
    harness.close();
  }
});

test("ChannelGatewayService processRetryQueue returns empty summary when no delivery service", async () => {
  const harness = createHarness();
  try {
    const service = harness.createService();
    const summary = await service.processRetryQueue();
    assert.equal(summary.scanned, 0);
    assert.equal(summary.delivered, 0);
  } finally {
    harness.close();
  }
});

test("ChannelAdapterRegistry register and get adapter", () => {
  const registry = new ChannelAdapterRegistry();

  class TestAdapter {
    readonly channel = "test";
    async send() {
      return { deliveredAt: "", channel: "test", targetId: "t1", externalTargetId: null, requestUrl: "", responseStatus: 200, providerMessageId: null };
    }
  }

  registry.register(new TestAdapter());
  assert.ok(registry.has("test"));
  assert.equal(registry.get("test")?.channel, "test");
  assert.deepEqual(registry.registeredChannels(), ["test"]);
});

test("ChannelAdapterRegistry throws on duplicate channel registration", () => {
  const registry = new ChannelAdapterRegistry();

  class TestAdapter1 {
    readonly channel = "test";
    async send() {
      return { deliveredAt: "", channel: "test", targetId: "t1", externalTargetId: null, requestUrl: "", responseStatus: 200, providerMessageId: null };
    }
  }

  class TestAdapter2 {
    readonly channel = "test";
    async send() {
      return { deliveredAt: "", channel: "test", targetId: "t1", externalTargetId: null, requestUrl: "", responseStatus: 200, providerMessageId: null };
    }
  }

  registry.register(new TestAdapter1());
  assert.throws(
    () => registry.register(new TestAdapter2()),
    /channel_adapter.already_registered/,
  );
});

test("createDefaultChannelAdapterRegistry includes telegram, slack, and webhook adapters", () => {
  const registry = createDefaultChannelAdapterRegistry();
  assert.ok(registry.has("telegram"));
  assert.ok(registry.has("slack"));
  assert.ok(registry.has("webhook"));
});

test("ChannelGatewayService sendMessage via slack channel", async () => {
  const harness = createHarness();
  try {
    const target = harness.targets.registerTarget({
      channel: "slack",
      targetKind: "user",
      externalTargetId: "slack-channel-1",
      displayName: "Slack Channel",
    });

    const service = harness.createService();
    const receipt = await service.sendMessage({
      targetId: target.targetId,
      text: "Hello from Slack",
    });

    assert.equal(receipt.channel, "slack");
    assert.equal(receipt.providerMessageId, "1710000000.123456");
  } finally {
    harness.close();
  }
});

test("ChannelGatewayService sendMessage via webhook channel", async () => {
  const harness = createHarness();
  const webhookRequests: unknown[] = [];

  // Override fetch to capture webhook requests
  const webhookFetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("webhook")) {
      webhookRequests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    }
    return {
      ok: true,
      status: 202,
      json: async () => ({ ok: true }),
    } as Response;
  };

  const workspace = createTempWorkspace("aa-channel-gateway-webhook-");
  const dbPath = join(workspace, "channel-gateway-webhook.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const targets = new GatewayTargetDirectoryService(store);

  const target = targets.registerTarget({
    channel: "webhook",
    targetKind: "webhook",
    externalTargetId: "https://example.webhook.test/endpoint",
    displayName: "Test Webhook",
  });

  const service = new ChannelGatewayService(store, targets, {
    fetchImpl: webhookFetchImpl,
    webhook: {
      defaultHeaders: {
        "x-gateway-source": "automatic-agent",
      },
    },
  });

  try {
    const receipt = await service.sendMessage({
      targetId: target.targetId,
      text: "Webhook message",
    });

    assert.equal(receipt.channel, "webhook");
    assert.equal(webhookRequests.length > 0, true);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("ChannelGatewayService sendMessage throws when telegram not configured", async () => {
  const harness = createHarness();
  try {
    const target = harness.targets.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "finance-team",
      displayName: "Finance Team",
    });

    // Service without telegram config
    const service = new ChannelGatewayService(harness.store, harness.targets, {
      fetchImpl: globalThis.fetch,
    });

    await assert.rejects(
      () => service.sendMessage({
        targetId: target.targetId,
        text: "Hello",
      }),
      /gateway.telegram_not_configured/,
    );
  } finally {
    harness.close();
  }
});

test("ChannelGatewayService sendMessage throws when slack not configured", async () => {
  const harness = createHarness();
  try {
    const target = harness.targets.registerTarget({
      channel: "slack",
      targetKind: "user",
      externalTargetId: "slack-channel-1",
      displayName: "Slack Channel",
    });

    // Service without slack config
    const service = new ChannelGatewayService(harness.store, harness.targets, {
      fetchImpl: globalThis.fetch,
    });

    await assert.rejects(
      () => service.sendMessage({
        targetId: target.targetId,
        text: "Hello",
      }),
      /gateway.slack_not_configured/,
    );
  } finally {
    harness.close();
  }
});

test("ChannelGatewayService sendMessage throws for invalid webhook URL", async () => {
  const harness = createHarness();
  try {
    const target = harness.targets.registerTarget({
      channel: "webhook",
      targetKind: "webhook",
      externalTargetId: "not-a-valid-url",
      displayName: "Invalid Webhook",
    });

    const service = harness.createService();
    await assert.rejects(
      () => service.sendMessage({
        targetId: target.targetId,
        text: "Hello",
      }),
      /gateway.webhook_url_required/,
    );
  } finally {
    harness.close();
  }
});

test("ChannelGatewayService sendMessage with metadata containing webhookUrl", async () => {
  const harness = createHarness();
  const webhookRequests: unknown[] = [];

  const webhookFetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("mywebhook")) {
      webhookRequests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    }
    return {
      ok: true,
      status: 202,
      json: async () => ({ ok: true }),
    } as Response;
  };

  const workspace = createTempWorkspace("aa-channel-gateway-metadata-");
  const dbPath = join(workspace, "channel-gateway-metadata.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const targets = new GatewayTargetDirectoryService(store);

  targets.registerTarget({
    channel: "webhook",
    targetKind: "webhook",
    externalTargetId: "https://fallback.example.test/endpoint",
    displayName: "Fallback Webhook",
  });

  const service = new ChannelGatewayService(store, targets, {
    fetchImpl: webhookFetchImpl,
    webhook: {
      defaultHeaders: {
        "x-gateway-source": "automatic-agent",
      },
    },
  });

  try {
    const receipt = await service.sendMessage({
      query: "Fallback Webhook",
      text: "Hello with metadata URL",
      metadata: {
        webhookUrl: "https://mywebhook.example.test/endpoint",
      },
    });

    assert.equal(receipt.channel, "webhook");
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});
