/**
 * @fileoverview AlertDispatcher Unit Tests
 *
 * Tests for AlertDispatcher class that handles alert event persistence
 * and delivery through configured channels.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { AlertDispatcher } from "../../../../src/platform/shared/observability/alert-dispatcher.js";
import { SLO_ALERTING_DDL } from "../../../../src/platform/shared/observability/slo-alerting/types.js";
import type { AuthoritativeSqlDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AlertEvent, AlertChannelKind } from "../../../../src/platform/shared/observability/slo-alerting/types.js";

// =============================================================================
// Test setup helpers
// =============================================================================

function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(SLO_ALERTING_DDL);
  return db;
}

function createMockDatabase(db: DatabaseSync): AuthoritativeSqlDatabase {
  return {
    backendType: "sqlite",
    connection: db,
    healthCheck: async () => true,
  } as unknown as AuthoritativeSqlDatabase;
}

// =============================================================================
// AlertDispatcher basic operations
// =============================================================================

test("AlertDispatcher persists alert event to database", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const dispatcher = new AlertDispatcher(mockDb);

  const event: AlertEvent = {
    id: "alert_test_001",
    ruleId: "rule_001",
    severity: "warning",
    status: "firing",
    title: "Test Alert",
    detail: "This is a test alert",
    channelKind: "log",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-25T00:00:00.000Z",
  };

  dispatcher.persistAlertEvent(event);

  const row = db.prepare("SELECT * FROM alert_events WHERE id = ?").get("alert_test_001") as Record<string, unknown>;
  assert.ok(row != null, "Alert event should be persisted");
  assert.equal(row.id, "alert_test_001");
  assert.equal(row.rule_id, "rule_001");
  assert.equal(row.severity, "warning");
  assert.equal(row.title, "Test Alert");
});

test("AlertDispatcher marks alert as delivered", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const dispatcher = new AlertDispatcher(mockDb);

  const event: AlertEvent = {
    id: "alert_delivered_001",
    ruleId: "rule_001",
    severity: "warning",
    status: "firing",
    title: "Test Alert",
    detail: "Test detail",
    channelKind: "log",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-25T00:00:00.000Z",
  };

  dispatcher.persistAlertEvent(event);
  dispatcher.markDelivered("alert_delivered_001", "2026-04-25T00:01:00.000Z");

  const row = db.prepare("SELECT delivered_at FROM alert_events WHERE id = ?").get("alert_delivered_001") as Record<string, unknown>;
  assert.ok(row != null);
  assert.equal(row.delivered_at, "2026-04-25T00:01:00.000Z");
});

test("AlertDispatcher retrieves alert rule by ID", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);

  db.prepare(`
    INSERT INTO alert_rules (id, name, slo_id, condition, severity, channel_kind, channel_config, cooldown_minutes, enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("rule_test_001", "Test Rule", null, "error_rate > 0.05", "warning", "log", "{}", 5, 1, "2026-04-25T00:00:00.000Z");

  const dispatcher = new AlertDispatcher(mockDb);
  const rule = dispatcher.getAlertRule("rule_test_001");

  assert.ok(rule != null, "Rule should be found");
  assert.equal(rule!.id, "rule_test_001");
  assert.equal(rule!.name, "Test Rule");
});

// =============================================================================
// AlertDispatcher channel management
// =============================================================================

test("AlertDispatcher has default log channel registered", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const dispatcher = new AlertDispatcher(mockDb);

  const channelKinds = dispatcher.getRegisteredChannelKinds();
  assert.ok(channelKinds.includes("log"), "Should have log channel by default");
});

test("AlertDispatcher returns undefined for unregistered channel", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const dispatcher = new AlertDispatcher(mockDb);

  const channel = dispatcher.getChannel("pagerduty");
  assert.equal(channel, undefined, "Unregistered channel should return undefined");
});

test("AlertDispatcher registers custom channel", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const dispatcher = new AlertDispatcher(mockDb);

  const customChannel = {
    kind: "webhook" as AlertChannelKind,
    deliver: (event: AlertEvent, config: Record<string, unknown>) => ({
      channelKind: "webhook" as AlertChannelKind,
      delivered: true,
      error: null,
    }),
  };

  dispatcher.registerChannel("webhook", customChannel);

  const channel = dispatcher.getChannel("webhook");
  assert.ok(channel != null, "Custom channel should be registered");
  assert.equal(channel!.kind, "webhook");
});

// =============================================================================
// AlertDispatcher dispatch operations
// =============================================================================

test("AlertDispatcher dispatch creates and persists alert event", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);

  db.prepare(`
    INSERT INTO alert_rules (id, name, slo_id, condition, severity, channel_kind, channel_config, cooldown_minutes, enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("rule_dispatch_001", "Dispatch Test Rule", null, "", "critical", "log", "{}", 5, 1, "2026-04-25T00:00:00.000Z");

  const dispatcher = new AlertDispatcher(mockDb);
  const event = dispatcher.dispatch("rule_dispatch_001", "Critical Alert", "System is down");

  assert.ok(event != null, "Event should be created");
  assert.equal(event.ruleId, "rule_dispatch_001");
  assert.equal(event.title, "Critical Alert");
  assert.equal(event.detail, "System is down");
  assert.equal(event.severity, "critical");
  assert.equal(event.status, "firing");

  const row = db.prepare("SELECT * FROM alert_events WHERE id = ?").get(event.id) as Record<string, unknown>;
  assert.ok(row != null, "Event should be persisted");
});

test("AlertDispatcher dispatch uses rule severity when not specified", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);

  db.prepare(`
    INSERT INTO alert_rules (id, name, slo_id, condition, severity, channel_kind, channel_config, cooldown_minutes, enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("rule_severity_001", "Severity Test", null, "", "warning", "log", "{}", 5, 1, "2026-04-25T00:00:00.000Z");

  const dispatcher = new AlertDispatcher(mockDb);
  const event = dispatcher.dispatch("rule_severity_001", "Warning Alert", "Something is off");

  assert.equal(event.severity, "warning", "Should use rule severity");
});

test("AlertDispatcher dispatch uses rule channel when not specified", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);

  db.prepare(`
    INSERT INTO alert_rules (id, name, slo_id, condition, severity, channel_kind, channel_config, cooldown_minutes, enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("rule_channel_001", "Channel Test", null, "", "info", "email", "{}", 5, 1, "2026-04-25T00:00:00.000Z");

  const dispatcher = new AlertDispatcher(mockDb);
  const event = dispatcher.dispatch("rule_channel_001", "Info Alert", "FYI");

  assert.equal(event.channelKind, "email", "Should use rule channel");
});

test("AlertDispatcher dispatchRaw creates alert with explicit values", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const dispatcher = new AlertDispatcher(mockDb);

  const event = dispatcher.dispatchRaw(
    "raw_rule_001",
    "Raw Alert Title",
    "Raw alert detail content",
    "critical",
    "slack",
  );

  assert.ok(event != null, "Raw event should be created");
  assert.equal(event.ruleId, "raw_rule_001");
  assert.equal(event.title, "Raw Alert Title");
  assert.equal(event.detail, "Raw alert detail content");
  assert.equal(event.severity, "critical");
  assert.equal(event.channelKind, "slack");
  assert.equal(event.status, "firing");
  assert.ok(event.firedAt != null, "Should have firedAt timestamp");
});

test("AlertDispatcher dispatchRaw persists event to database", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const dispatcher = new AlertDispatcher(mockDb);

  const event = dispatcher.dispatchRaw(
    "raw_persist_001",
    "Persist Test",
    "Testing persistence",
    "warning",
    "log",
  );

  const row = db.prepare("SELECT * FROM alert_events WHERE id = ?").get(event.id) as Record<string, unknown>;
  assert.ok(row != null, "Raw event should be persisted");
  assert.equal(row.rule_id, "raw_persist_001");
  assert.equal(row.title, "Persist Test");
});

// =============================================================================
// AlertDispatcher error handling
// =============================================================================

test("AlertDispatcher dispatch handles missing rule gracefully", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const dispatcher = new AlertDispatcher(mockDb);

  const event = dispatcher.dispatch("nonexistent_rule", "No Rule Alert", "No rule found");

  assert.ok(event != null, "Event should still be created");
  assert.equal(event.ruleId, "nonexistent_rule");
  assert.equal(event.severity, "warning", "Should default to warning severity");
  assert.equal(event.channelKind, "log", "Should default to log channel");
});

test("AlertDispatcher marks delivered updates existing record", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const dispatcher = new AlertDispatcher(mockDb);

  const event: AlertEvent = {
    id: "alert_mark_001",
    ruleId: "rule_001",
    severity: "info",
    status: "firing",
    title: "Mark Delivered Test",
    detail: "Testing mark delivered",
    channelKind: "log",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-25T00:00:00.000Z",
  };

  dispatcher.persistAlertEvent(event);
  assert.equal(event.deliveredAt, null, "Initially not delivered");

  dispatcher.markDelivered("alert_mark_001", "2026-04-25T00:05:00.000Z");

  const row = db.prepare("SELECT delivered_at FROM alert_events WHERE id = ?").get("alert_mark_001") as Record<string, unknown>;
  assert.equal(row.delivered_at, "2026-04-25T00:05:00.000Z");
});

// =============================================================================
// InMemoryLogChannel behavior
// =============================================================================

test("AlertDispatcher default log channel stores delivered events", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const dispatcher = new AlertDispatcher(mockDb);

  const event = dispatcher.dispatchRaw("log_channel_001", "Log Test", "Testing log channel", "info", "log");

  const row = db.prepare("SELECT * FROM alert_events WHERE id = ?").get(event.id) as Record<string, unknown>;
  assert.ok(row != null, "Event should be persisted");
  assert.equal(row.channel_kind, "log");
});
