/**
 * Golden Test: Alert Dispatcher Output Structure
 *
 * Verifies alert dispatcher produces consistent alert events
 * with proper severity, channels, and delivery status.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AlertDispatcher } from "../../src/platform/shared/observability/alert-dispatcher.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { assertGolden } from "../helpers/golden.js";

test("golden: alert dispatcher dispatch produces valid alert event", () => {
  const workspace = createTempWorkspace("aa-golden-alert-");

  const dbPath = `${workspace}/alert.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  const dispatcher = new AlertDispatcher(db);

  const event = dispatcher.dispatch(
    "rule_test_001",
    "Test Alert",
    "This is a test alert",
    "warning",
    "log",
  );

  // Verify event structure
  assert.ok(event, "Event should exist");
  assert.ok(event.id, "Event should have id");
  assert.equal(event.ruleId, "rule_test_001");
  assert.equal(event.severity, "warning");
  assert.equal(event.status, "firing");
  assert.equal(event.title, "Test Alert");
  assert.equal(event.detail, "This is a test alert");
  assert.ok(event.firedAt, "Should have firedAt");
  assert.equal(event.channelKind, "log");

  assertGolden("alert-dispatcher-basic", {
    hasId: event.id.length > 0,
    ruleId: event.ruleId,
    severity: event.severity,
    status: event.status,
    titleLength: event.title.length,
    hasFiredAt: event.firedAt !== null,
    hasDeliveredAt: event.deliveredAt !== null,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: alert dispatcher dispatchRaw with explicit values", () => {
  const workspace = createTempWorkspace("aa-golden-alert-raw-");

  const dbPath = `${workspace}/alert-raw.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  const dispatcher = new AlertDispatcher(db);

  const event = dispatcher.dispatchRaw(
    "rule_raw_001",
    "Critical Alert",
    "Something critical happened",
    "critical",
    "log",
  );

  assert.ok(event, "Event should exist");
  assert.equal(event.severity, "critical");
  assert.equal(event.unifiedSeverity, "critical");

  assertGolden("alert-dispatcher-raw", {
    ruleId: event.ruleId,
    severity: event.severity,
    unifiedSeverity: event.unifiedSeverity,
    status: event.status,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: alert dispatcher marks delivery correctly", () => {
  const workspace = createTempWorkspace("aa-golden-alert-delivery-");

  const dbPath = `${workspace}/alert-delivery.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  const dispatcher = new AlertDispatcher(db);

  const event = dispatcher.dispatch(
    "rule_delivery_001",
    "Delivery Test",
    "Testing delivery status",
    "info",
    "log",
  );

  // Event should have been delivered via the in-memory log channel
  assert.ok(event.deliveredAt, "Event should have deliveredAt after dispatch");

  assertGolden("alert-dispatcher-delivery", {
    deliveredAt: event.deliveredAt !== null,
    deliveredAtTime: event.deliveredAt,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: alert dispatcher persists and retrieves alert rule", () => {
  const workspace = createTempWorkspace("aa-golden-alert-rule-");

  const dbPath = `${workspace}/alert-rule.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  // Insert a test alert rule first
  db.connection
    .prepare(
      `INSERT INTO alert_rules (id, name, slo_id, condition, severity, channel_kind, channel_config, cooldown_minutes, enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "rule_persisted_001",
      "Persisted Rule",
      null,
      "error_rate > 0.01",
      "warning",
      "log",
      "{}",
      5,
      1,
      new Date().toISOString(),
    );

  const dispatcher = new AlertDispatcher(db);

  const rule = dispatcher.getAlertRule("rule_persisted_001");

  assert.ok(rule, "Rule should be retrieved");
  assert.equal(rule.id, "rule_persisted_001");
  assert.equal(rule.name, "Persisted Rule");

  assertGolden("alert-dispatcher-rule", {
    hasRule: rule !== undefined,
    ruleId: rule?.id,
    ruleName: rule?.name,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: alert dispatcher registered channel kinds", () => {
  const workspace = createTempWorkspace("aa-golden-alert-channels-");

  const dbPath = `${workspace}/alert-channels.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  const dispatcher = new AlertDispatcher(db);

  const channelKinds = dispatcher.getRegisteredChannelKinds();

  assert.ok(Array.isArray(channelKinds), "Should return array of channel kinds");
  assert.ok(channelKinds.includes("log"), "Should include log channel by default");

  assertGolden("alert-dispatcher-channels", {
    channelCount: channelKinds.length,
    hasLogChannel: channelKinds.includes("log"),
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: alert dispatcher severity to unified severity mapping", () => {
  const workspace = createTempWorkspace("aa-golden-alert-severity-");

  const dbPath = `${workspace}/alert-severity.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  const dispatcher = new AlertDispatcher(db);

  // Test different severity levels
  const infoEvent = dispatcher.dispatch("rule_info", "Info", "Info level", "info", "log");
  const warningEvent = dispatcher.dispatch("rule_warning", "Warning", "Warning level", "warning", "log");
  const criticalEvent = dispatcher.dispatch("rule_critical", "Critical", "Critical level", "critical", "log");

  assert.ok(infoEvent.unifiedSeverity, "Info should have unified severity");
  assert.ok(warningEvent.unifiedSeverity, "Warning should have unified severity");
  assert.ok(criticalEvent.unifiedSeverity, "Critical should have unified severity");

  assertGolden("alert-dispatcher-severity", {
    infoSeverity: infoEvent.severity,
    infoUnified: infoEvent.unifiedSeverity,
    warningSeverity: warningEvent.severity,
    warningUnified: warningEvent.unifiedSeverity,
    criticalSeverity: criticalEvent.severity,
    criticalUnified: criticalEvent.unifiedSeverity,
  });

  db.close();
  cleanupPath(workspace);
});
