/**
 * AlertDispatcher Integration Tests
 *
 * Tests for AlertDispatcher integration with real database,
 * alert persistence, channel delivery, and dispatch operations.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { AlertDispatcher } from "../../../../src/platform/shared/observability/alert-dispatcher.js";
import { SLO_ALERTING_DDL } from "../../../../src/platform/shared/observability/slo-alerting-service.js";

// =============================================================================
// AlertDispatcher with real database
// =============================================================================

test("AlertDispatcher persistAlertEvent stores alert in database", () => {
  const ctx = createIntegrationContext("aa-alert-dispatcher-");

  // Apply SLO alerting DDL for alert_events table
  ctx.db.connection.exec(SLO_ALERTING_DDL);

  try {
    const dispatcher = new AlertDispatcher(ctx.db);

    dispatcher.persistAlertEvent({
      id: "alert-test-001",
      ruleId: "rule-001",
      severity: "warning",
      unifiedSeverity: "warning",
      status: "firing",
      title: "Test Alert",
      detail: "This is a test alert",
      channelKind: "log",
      deliveredAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      firedAt: new Date().toISOString(),
    });

    // Verify the alert was persisted
    const row = ctx.db.connection
      .prepare(`SELECT * FROM alert_events WHERE id = ?`)
      .get("alert-test-001") as Record<string, unknown> | undefined;

    assert.ok(row != null, "Alert should be persisted in database");
    assert.equal(row.id, "alert-test-001");
    assert.equal(row.rule_id, "rule-001");
    assert.equal(row.severity, "warning");
    assert.equal(row.status, "firing");
    assert.equal(row.title, "Test Alert");
  } finally {
    ctx.cleanup();
  }
});

test("AlertDispatcher markDelivered updates delivered_at timestamp", () => {
  const ctx = createIntegrationContext("aa-alert-dispatcher-");
  ctx.db.connection.exec(SLO_ALERTING_DDL);

  try {
    const dispatcher = new AlertDispatcher(ctx.db);
    const now = new Date().toISOString();

    dispatcher.persistAlertEvent({
      id: "alert-delivery-001",
      ruleId: "rule-001",
      severity: "critical",
      unifiedSeverity: "critical",
      status: "firing",
      title: "Delivery Test",
      detail: "Testing delivery timestamp",
      channelKind: "log",
      deliveredAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      firedAt: now,
    });

    dispatcher.markDelivered("alert-delivery-001", now);

    const row = ctx.db.connection
      .prepare(`SELECT delivered_at FROM alert_events WHERE id = ?`)
      .get("alert-delivery-001") as Record<string, unknown> | undefined;

    assert.ok(row != null);
    assert.equal(row.delivered_at, now, "delivered_at should be updated");
  } finally {
    ctx.cleanup();
  }
});

test("AlertDispatcher getAlertRule retrieves rule from database", () => {
  const ctx = createIntegrationContext("aa-alert-dispatcher-");
  ctx.db.connection.exec(SLO_ALERTING_DDL);

  try {
    // Insert an alert rule directly
    ctx.db.connection
      .prepare(
        `INSERT INTO alert_rules (id, name, severity, channel_kind, condition, cooldown_minutes, enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("rule-fetch-001", "High Error Rate", "critical", "log", "error_rate > 0.05", 5, 1, new Date().toISOString());

    const dispatcher = new AlertDispatcher(ctx.db);
    const rule = dispatcher.getAlertRule("rule-fetch-001");

    assert.ok(rule != null, "Rule should be found");
    assert.equal(rule.id, "rule-fetch-001");
    assert.equal(rule.name, "High Error Rate");
    assert.equal(rule.severity, "critical");
  } finally {
    ctx.cleanup();
  }
});

test("AlertDispatcher dispatch creates and persists alert event", () => {
  const ctx = createIntegrationContext("aa-alert-dispatcher-");
  ctx.db.connection.exec(SLO_ALERTING_DDL);

  try {
    // Insert an alert rule
    ctx.db.connection
      .prepare(
        `INSERT INTO alert_rules (id, name, severity, channel_kind, condition, cooldown_minutes, enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("rule-dispatch-001", "Latency Alert", "warning", "log", "latency_p95 > 1000", 10, 1, new Date().toISOString());

    const dispatcher = new AlertDispatcher(ctx.db);
    const event = dispatcher.dispatch("rule-dispatch-001", "High Latency Detected", "P95 latency exceeded 1000ms");

    assert.ok(event != null, "Event should be created");
    assert.equal(event.ruleId, "rule-dispatch-001");
    assert.equal(event.title, "High Latency Detected");
    assert.equal(event.severity, "warning");
    assert.equal(event.status, "firing");

    // Verify persisted
    const row = ctx.db.connection
      .prepare(`SELECT * FROM alert_events WHERE id = ?`)
      .get(event.id) as Record<string, unknown>;

    assert.ok(row != null, "Event should be in database");
    assert.equal(row.title, "High Latency Detected");
  } finally {
    ctx.cleanup();
  }
});

test("AlertDispatcher dispatchRaw creates alert without rule lookup", () => {
  const ctx = createIntegrationContext("aa-alert-dispatcher-");
  ctx.db.connection.exec(SLO_ALERTING_DDL);

  try {
    const dispatcher = new AlertDispatcher(ctx.db);
    const event = dispatcher.dispatchRaw(
      "rule-nonexistent",
      "Immediate Alert",
      "This alert has no associated rule",
      "critical",
      "log",
    );

    assert.ok(event != null);
    assert.equal(event.ruleId, "rule-nonexistent");
    assert.equal(event.severity, "critical");
    assert.equal(event.status, "firing");
    assert.ok(event.deliveredAt != null, "Should be immediately delivered via log channel");
  } finally {
    ctx.cleanup();
  }
});

test("AlertDispatcher getChannel returns registered channel", () => {
  const ctx = createIntegrationContext("aa-alert-dispatcher-");

  try {
    const dispatcher = new AlertDispatcher(ctx.db);
    const channel = dispatcher.getChannel("log");

    assert.ok(channel != null, "Default log channel should be registered");
    assert.equal(channel.kind, "log");
  } finally {
    ctx.cleanup();
  }
});

test("AlertDispatcher getRegisteredChannelKinds returns all channel kinds", () => {
  const ctx = createIntegrationContext("aa-alert-dispatcher-");

  try {
    const dispatcher = new AlertDispatcher(ctx.db);
    const kinds = dispatcher.getRegisteredChannelKinds();

    assert.ok(kinds.includes("log"), "Should include default log channel");
  } finally {
    ctx.cleanup();
  }
});

test("AlertDispatcher registerChannel adds new channel", () => {
  const ctx = createIntegrationContext("aa-alert-dispatcher-");
  ctx.db.connection.exec(SLO_ALERTING_DDL);

  try {
    const dispatcher = new AlertDispatcher(ctx.db);

    // Create a mock webhook channel
    let deliverCalled = false;
    const mockChannel = {
      kind: "webhook" as const,
      deliver: (event: unknown) => {
        deliverCalled = true;
        return { channelKind: "webhook" as const, delivered: true, error: null };
      },
    };

    dispatcher.registerChannel("webhook", mockChannel);

    const retrieved = dispatcher.getChannel("webhook");
    assert.ok(retrieved != null, "Webhook channel should be retrievable");
    assert.equal(retrieved.kind, "webhook");

    // Dispatch with webhook channel
    dispatcher.dispatchRaw("rule-webhook", "Webhook Test", "Testing webhook channel", "warning", "webhook");
    assert.ok(deliverCalled, "Webhook deliver should be called");
  } finally {
    ctx.cleanup();
  }
});
