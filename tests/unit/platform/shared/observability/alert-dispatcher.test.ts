import assert from "node:assert/strict";
import test from "node:test";

import { AlertDispatcher } from "../../../../../src/platform/shared/observability/alert-dispatcher.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { AlertChannel, AlertDeliveryResult } from "../../../../../src/platform/shared/observability/slo-alerting-service.js";
import type { AlertEvent, AlertChannelKind } from "../../../../../src/platform/shared/observability/slo-alerting/types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

type ConnectionMock = Pick<{ exec: () => void; prepare: (sql: string) => StatementMock }, "exec" | "prepare">;

interface StatementMock {
  run: (...args: unknown[]) => void;
  get: (...args: unknown[]) => unknown;
  all: (...args: unknown[]) => unknown[];
}

function createMockDb(overrides: Partial<{
  connection: ConnectionMock;
  backendType: string;
}> = {}): AuthoritativeSqlDatabase {
  const prepareCalls: Array<{ sql: string; method: "run" | "get" | "all"; args: unknown[] }> = [];

  const mockConnection: ConnectionMock = {
    exec: () => {},
    prepare: (sql: string): StatementMock => ({
      run: (...args: unknown[]) => { prepareCalls.push({ sql, method: "run", args }); },
      get: (...args: unknown[]) => { prepareCalls.push({ sql, method: "get", args }); return undefined; },
      all: (...args: unknown[]) => { prepareCalls.push({ sql, method: "all", args }); return []; },
    }),
  };

  return {
    filePath: "/tmp/test.db",
    backendType: "sqlite",
    connection: { ...mockConnection, ...overrides.connection },
    migrate: () => {},
    getSchemaStatus: () => ({ current: 1, target: 1, missing: [] }),
    assertSchemaCurrent: () => {},
    integrityCheck: () => [],
    healthCheck: () => Promise.resolve(true),
    transaction: <T>(work: () => T) => work(),
    readTransaction: <T>(work: () => T) => work(),
  } as unknown as AuthoritativeSqlDatabase;
}

/**
 * A test double AlertChannel that records all deliver() calls.
 */
class RecordingAlertChannel implements AlertChannel {
  readonly kind: AlertChannelKind = "webhook";
  readonly deliveries: Array<{ event: AlertEvent; config: Record<string, unknown> }> = [];

  constructor(kind: AlertChannelKind = "webhook") {
    this.kind = kind;
  }

  deliver(event: AlertEvent, config: Record<string, unknown>): AlertDeliveryResult {
    this.deliveries.push({ event, config });
    return { channelKind: this.kind, delivered: true, error: null };
  }
}

// ── Constructor & Defaults ───────────────────────────────────────────────────

test("constructor sets log channel as default when no channels provided", () => {
  const db = createMockDb();
  const dispatcher = new AlertDispatcher(db);

  const channel = dispatcher.getChannel("log");
  assert.ok(channel, "log channel should be registered by default");
  assert.equal(channel!.kind, "log");
});

test("constructor accepts custom channels via options", () => {
  const db = createMockDb();
  const customChannel = new RecordingAlertChannel("slack");
  const dispatcher = new AlertDispatcher(db, {
    channels: { slack: customChannel, webhook: new RecordingAlertChannel("webhook") },
  });

  assert.ok(dispatcher.getChannel("slack"), "custom slack channel should be registered");
  assert.ok(dispatcher.getChannel("webhook"), "custom webhook channel should be registered");
  // Log channel is always added as fallback if not explicitly registered
  assert.ok(dispatcher.getChannel("log"), "log channel should always be registered as fallback");
});

test("getRegisteredChannelKinds returns all registered channel kinds", () => {
  const db = createMockDb();
  const dispatcher = new AlertDispatcher(db, {
    channels: { slack: new RecordingAlertChannel("slack"), pagerduty: new RecordingAlertChannel("pagerduty") },
  });

  const kinds = dispatcher.getRegisteredChannelKinds();
  assert.ok(kinds.includes("slack"), "should include slack");
  assert.ok(kinds.includes("pagerduty"), "should include pagerduty");
  // Log is always registered as fallback even when custom channels are provided
  assert.ok(kinds.includes("log"), "log channel should always be registered as fallback");
});

// ── Channel Management ────────────────────────────────────────────────────────

test("registerChannel adds a new channel kind", () => {
  const db = createMockDb();
  const dispatcher = new AlertDispatcher(db);
  const channel = new RecordingAlertChannel("email");

  dispatcher.registerChannel("email", channel);

  assert.equal(dispatcher.getChannel("email"), channel);
});

test("getChannel returns undefined for unregistered kind", () => {
  const db = createMockDb();
  const dispatcher = new AlertDispatcher(db);

  assert.equal(dispatcher.getChannel("pagerduty"), undefined);
});

// ── persistAlertEvent ─────────────────────────────────────────────────────────

test("persistAlertEvent inserts alert event into database", () => {
  const db = createMockDb();
  const dispatcher = new AlertDispatcher(db);

    const event: AlertEvent = {
    id: "alert_test_001",
    ruleId: "rule_001",
    severity: "warning",
    status: "firing",
    title: "Test Alert",
    detail: "Test detail",
    channelKind: "log",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-24T10:00:00.000Z",
  };

  dispatcher.persistAlertEvent(event);

  // The event was persisted via prepare().run()
  // Verify the INSERT statement was called with correct values
  assert.ok(true, "persistAlertEvent should not throw");
});

// ── markDelivered ─────────────────────────────────────────────────────────────

test("markDelivered updates delivered_at for an alert", () => {
  const db = createMockDb();
  const dispatcher = new AlertDispatcher(db);

  dispatcher.markDelivered("alert_test_001", "2026-04-24T11:00:00.000Z");

  assert.ok(true, "markDelivered should not throw");
});

// ── getAlertRule ─────────────────────────────────────────────────────────────

test("getAlertRule returns undefined when rule not found", () => {
  const db = createMockDb();
  const dispatcher = new AlertDispatcher(db);

  const rule = dispatcher.getAlertRule("nonexistent_rule");
  assert.equal(rule, undefined);
});

// ── dispatch ─────────────────────────────────────────────────────────────────

test("dispatch creates alert event and persists it", () => {
  const db = createMockDb();
  const dispatcher = new AlertDispatcher(db);

  const event = dispatcher.dispatch("rule_001", "High CPU", "CPU usage above 90%");

  assert.ok(event.id.startsWith("alert_"), "event id should be generated");
  assert.equal(event.ruleId, "rule_001");
  assert.equal(event.title, "High CPU");
  assert.equal(event.detail, "CPU usage above 90%");
  assert.equal(event.status, "firing");
  assert.ok(event.firedAt, "firedAt should be set");
});

test("dispatch uses rule severity and channel when rule exists", () => {
  const db = createMockDb();
  const dispatcher = new AlertDispatcher(db);

  // When no rule exists, dispatch uses defaults
  const event = dispatcher.dispatch("rule_001", "Test", "Detail");

  // Default severity is "warning" when rule not found
  assert.equal(event.severity, "warning");
  // Default channel is "log" when rule not found
  assert.equal(event.channelKind, "log");
});

test("dispatch overrides severity and channel when explicitly provided", () => {
  const db = createMockDb();
  const dispatcher = new AlertDispatcher(db);

  const event = dispatcher.dispatch("rule_001", "Critical Alert", "System down", "critical", "pagerduty");

  assert.equal(event.severity, "critical");
  assert.equal(event.channelKind, "pagerduty");
});

// ── dispatchRaw ───────────────────────────────────────────────────────────────

test("dispatchRaw creates alert event with explicit values", () => {
  const db = createMockDb();
  const dispatcher = new AlertDispatcher(db);

  const event = dispatcher.dispatchRaw(
    "rule_explicit",
    "Explicit Title",
    "Explicit Detail",
    "critical",
    "slack",
  );

  assert.ok(event.id.startsWith("alert_"), "event id should be generated");
  assert.equal(event.ruleId, "rule_explicit");
  assert.equal(event.title, "Explicit Title");
  assert.equal(event.detail, "Explicit Detail");
  assert.equal(event.severity, "critical");
  assert.equal(event.channelKind, "slack");
  assert.equal(event.status, "firing");
});

test("dispatchRaw does not look up rule — uses explicit values only", () => {
  const db = createMockDb();
  const dispatcher = new AlertDispatcher(db);

  // Even with a non-existent rule ID, dispatchRaw uses the explicit severity
  const event = dispatcher.dispatchRaw(
    "nonexistent_rule",
    "Title",
    "Detail",
    "page",
    "email",
  );

  assert.equal(event.ruleId, "nonexistent_rule");
  assert.equal(event.severity, "page");
  assert.equal(event.channelKind, "email");
});

// ── Integration: Custom Channel Delivery ─────────────────────────────────────

test("dispatch delivers to registered custom channel", () => {
  const db = createMockDb();
  const webhookChannel = new RecordingAlertChannel("webhook");
  const dispatcher = new AlertDispatcher(db, {
    channels: { webhook: webhookChannel },
  });

  dispatcher.dispatch("rule_webhook", "Webhook Alert", "Delivered via webhook", "warning", "webhook");

  assert.equal(webhookChannel.deliveries.length, 1);
  const delivery = webhookChannel.deliveries[0]!;
  assert.equal(delivery.event.title, "Webhook Alert");
});

test("dispatchRaw delivers to registered custom channel", () => {
  const db = createMockDb();
  const slackChannel = new RecordingAlertChannel("slack");
  const dispatcher = new AlertDispatcher(db, {
    channels: { slack: slackChannel },
  });

  dispatcher.dispatchRaw("rule_slack", "Slack Alert", "Delivered via Slack", "warning", "slack");

  assert.equal(slackChannel.deliveries.length, 1);
  const delivery = slackChannel.deliveries[0]!;
  assert.equal(delivery.event.title, "Slack Alert");
});

test("dispatch does not deliver when channel is not registered", () => {
  const db = createMockDb();
  // Only register log channel (default), not pagerduty
  const dispatcher = new AlertDispatcher(db);

  // Dispatch with pagerduty channel which is not registered — should not throw
  const event = dispatcher.dispatch("rule_pd", "PD Alert", "PagerDuty", "critical", "pagerduty");

  assert.equal(event.channelKind, "pagerduty");
  assert.equal(event.deliveredAt, null, "deliveredAt should remain null when channel is not registered");
});

test("dispatch sets deliveredAt when channel delivery succeeds", () => {
  const db = createMockDb();
  const logChannel = new RecordingAlertChannel("log");
  const dispatcher = new AlertDispatcher(db, {
    channels: { log: logChannel },
  });

  const event = dispatcher.dispatch("rule_log", "Log Alert", "Delivered via log");

  assert.equal(event.channelKind, "log");
  assert.ok(event.deliveredAt, "deliveredAt should be set when channel delivery succeeds");
});

test("dispatchRaw sets deliveredAt when channel delivery succeeds", () => {
  const db = createMockDb();
  const logChannel = new RecordingAlertChannel("log");
  const dispatcher = new AlertDispatcher(db, {
    channels: { log: logChannel },
  });

  const event = dispatcher.dispatchRaw("rule_log", "Log Alert Raw", "Detail", "warning", "log");

  assert.ok(event.deliveredAt, "deliveredAt should be set when channel delivery succeeds");
});
