import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  SloAlertingService,
  LogAlertChannel,
  SLO_ALERTING_DDL,
} from "../../../../../src/platform/shared/observability/slo-alerting-service.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "slo-basic.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(SLO_ALERTING_DDL);
  return { workspace, db };
}

test("SLO service defines and retrieves an SLO", () => {
  const h = createHarness("aa-slo-basic-");
  try {
    const service = new SloAlertingService(h.db);

    const slo = service.defineSlo({
      name: "test_slo",
      description: "Test SLO",
      sliKind: "error_rate",
      targetValue: 1.0,
      operator: "lte",
      windowMinutes: 30,
    });

    assert.ok(slo.id.startsWith("slo_"));
    assert.equal(slo.name, "test_slo");
    assert.equal(slo.status, "unknown");

    const retrieved = service.getSlo(slo.id);
    assert.ok(retrieved !== null);
    assert.equal(retrieved!.name, "test_slo");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SLO service collects SLI samples", () => {
  const h = createHarness("aa-sli-collect-");
  try {
    const service = new SloAlertingService(h.db);

    const slo = service.defineSlo({
      name: "latency_slo",
      description: "Latency SLO",
      sliKind: "latency_p95",
      targetValue: 500,
      operator: "lte",
      windowMinutes: 60,
    });

    const sli1 = service.collectSli(slo.id, 350, "ms");
    assert.ok(sli1.id.startsWith("sli_"));
    assert.equal(sli1.value, 350);
    assert.equal(sli1.unit, "ms");

    const sli2 = service.collectSli(slo.id, 400, "ms", { source: "probe" });
    assert.ok(sli2.id.startsWith("sli_"));

    const samples = service.listSliSamples(slo.id);
    assert.equal(samples.length, 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SLO service evaluates met status", () => {
  const h = createHarness("aa-slo-met-");
  try {
    const service = new SloAlertingService(h.db);

    const slo = service.defineSlo({
      name: "met_slo",
      description: "Error rate under threshold",
      sliKind: "error_rate",
      targetValue: 1.0,
      operator: "lte",
      windowMinutes: 60,
    });

    service.collectSli(slo.id, 0.5, "%");
    service.collectSli(slo.id, 0.3, "%");

    const status = service.evaluateSlo(slo.id);
    assert.ok(["met", "at_risk"].includes(status));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SLO service evaluates breached status", () => {
  const h = createHarness("aa-slo-breached-");
  try {
    const service = new SloAlertingService(h.db);

    const slo = service.defineSlo({
      name: "breached_slo",
      description: "Error rate over threshold",
      sliKind: "error_rate",
      targetValue: 1.0,
      operator: "lte",
      windowMinutes: 60,
    });

    service.collectSli(slo.id, 2.0, "%");
    service.collectSli(slo.id, 3.0, "%");

    const status = service.evaluateSlo(slo.id);
    assert.equal(status, "breached");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SLO service fires alert to log channel", () => {
  const h = createHarness("aa-alert-fire-");
  try {
    const logChannel = new LogAlertChannel();
    const service = new SloAlertingService(h.db, {
      channels: { log: logChannel } as Record<string, LogAlertChannel>,
    });

    const rule = service.defineAlertRule({
      name: "test_rule",
      sloId: null,
      condition: "error > 1%",
      severity: "warning",
      channelKind: "log",
      channelConfig: "{}",
      cooldownMinutes: 5,
      enabled: true,
    });

    const alert = service.fireAlert(rule.id, "Test Alert", "Test detail");

    assert.ok(alert.id.startsWith("alert_"));
    assert.equal(alert.status, "firing");
    assert.equal(alert.title, "Test Alert");
    assert.equal(alert.detail, "Test detail");

    const delivered = logChannel.getDelivered();
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0]!.title, "Test Alert");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SLO service acknowledgeAlert transitions alert to acknowledged", () => {
  const h = createHarness("aa-alert-ack-");
  try {
    const service = new SloAlertingService(h.db);

    const rule = service.defineAlertRule({
      name: "ack_rule",
      sloId: null,
      condition: "",
      severity: "warning",
      channelKind: "log",
      channelConfig: "{}",
      cooldownMinutes: 5,
      enabled: true,
    });

    const alert = service.fireAlert(rule.id, "Ack Test", "Testing acknowledge");

    const result = service.acknowledgeAlert(alert.id, "tester");
    assert.equal(result, true);

    const events = service.listAlertEvents("acknowledged");
    assert.equal(events.length, 1);
    assert.equal(events[0]!.acknowledgedBy, "tester");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SLO service resolveAlert transitions alert to resolved", () => {
  const h = createHarness("aa-alert-resolve-");
  try {
    const service = new SloAlertingService(h.db);

    const rule = service.defineAlertRule({
      name: "resolve_rule",
      sloId: null,
      condition: "",
      severity: "warning",
      channelKind: "log",
      channelConfig: "{}",
      cooldownMinutes: 5,
      enabled: true,
    });

    const alert = service.fireAlert(rule.id, "Resolve Test", "Testing resolve");

    const result = service.resolveAlert(alert.id);
    assert.equal(result, true);

    const events = service.listAlertEvents("resolved");
    assert.equal(events.length, 1);
    assert.ok(events[0]!.resolvedAt !== null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SLO service listSlos returns all SLOs", () => {
  const h = createHarness("aa-slo-list-");
  try {
    const service = new SloAlertingService(h.db);

    service.defineSlo({
      name: "first_slo",
      description: "",
      sliKind: "availability",
      targetValue: 99.9,
      operator: "gte",
      windowMinutes: 60,
    });

    service.defineSlo({
      name: "second_slo",
      description: "",
      sliKind: "latency_p95",
      targetValue: 500,
      operator: "lte",
      windowMinutes: 30,
    });

    const slos = service.listSlos();
    assert.equal(slos.length, 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SLO service listAlertRules returns all rules", () => {
  const h = createHarness("aa-rules-list-");
  try {
    const service = new SloAlertingService(h.db);

    service.defineAlertRule({
      name: "rule_one",
      sloId: null,
      condition: "",
      severity: "info",
      channelKind: "log",
      channelConfig: "{}",
      cooldownMinutes: 1,
      enabled: true,
    });

    service.defineAlertRule({
      name: "rule_two",
      sloId: null,
      condition: "",
      severity: "critical",
      channelKind: "log",
      channelConfig: "{}",
      cooldownMinutes: 5,
      enabled: true,
    });

    const rules = service.listAlertRules();
    assert.equal(rules.length, 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SLO service summary returns correct counts", () => {
  const h = createHarness("aa-summary-");
  try {
    const service = new SloAlertingService(h.db);

    const s = service.summary();
    assert.equal(s.sloCount, 0);
    assert.equal(s.breachedCount, 0);
    assert.equal(s.firingAlertCount, 0);
    assert.equal(s.runbookExecutionCount, 0);

    const slo = service.defineSlo({
      name: "summary_slo",
      description: "",
      sliKind: "error_rate",
      targetValue: 1.0,
      operator: "lte",
      windowMinutes: 60,
    });

    service.collectSli(slo.id, 5.0, "%");
    service.evaluateSlo(slo.id);

    const rule = service.defineAlertRule({
      name: "summary_rule",
      sloId: slo.id,
      condition: "",
      severity: "warning",
      channelKind: "log",
      channelConfig: "{}",
      cooldownMinutes: 1,
      enabled: true,
    });

    service.fireAlert(rule.id, "Summary Alert", "Testing summary");

    const s2 = service.summary();
    assert.equal(s2.sloCount, 1);
    assert.equal(s2.breachedCount, 1);
    assert.equal(s2.firingAlertCount, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
