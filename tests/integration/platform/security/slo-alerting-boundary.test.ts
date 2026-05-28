import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  SloAlertingService,
  SLO_ALERTING_DDL,
} from "../../../../src/platform/shared/observability/slo-alerting-service.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "slo-boundary.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(SLO_ALERTING_DDL);
  return { workspace, db };
}

test("SLO service safely handles alert title with injection patterns", () => {
  const h = createHarness("aa-slo-sqli-");
  try {
    const service = new SloAlertingService(h.db);
    const rule = service.defineAlertRule({
      name: "test",
      sloId: null,
      condition: "",
      severity: "info",
      channelKind: "log",
      channelConfig: "{}",
      cooldownMinutes: 1,
      enabled: true,
    });

    const alert = service.fireAlert(rule.id, "'; DROP TABLE alert_events; --", "detail");
    assert.equal(alert.title, "'; DROP TABLE alert_events; --");
    // Table still intact
    const events = service.listAlertEvents();
    assert.equal(events.length, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SLO service handles negative and extreme SLI values", () => {
  const h = createHarness("aa-slo-extreme-");
  try {
    const service = new SloAlertingService(h.db);
    const slo = service.defineSlo({
      name: "custom_metric",
      description: "",
      sliKind: "custom",
      targetValue: 0,
      operator: "gte",
      windowMinutes: 60,
    });

    service.collectSli(slo.id, -100, "units");
    service.collectSli(slo.id, Number.MAX_SAFE_INTEGER, "units");

    const samples = service.listSliSamples(slo.id);
    assert.equal(samples.length, 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SLO service acknowledge non-existent alert returns false gracefully", () => {
  const h = createHarness("aa-slo-ack-miss-");
  try {
    const service = new SloAlertingService(h.db);
    const result = service.acknowledgeAlert("alert_nonexistent", "user");
    assert.equal(result, false);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SLO service evaluateSlo for nonexistent SLO returns unknown", () => {
  const h = createHarness("aa-slo-eval-miss-");
  try {
    const service = new SloAlertingService(h.db);
    const status = service.evaluateSlo("slo_nonexistent");
    assert.equal(status, "unknown");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
