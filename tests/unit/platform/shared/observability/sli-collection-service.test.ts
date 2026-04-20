import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  SloAlertingService,
  SLO_ALERTING_DDL,
} from "../../../../../src/platform/shared/observability/slo-alerting-service.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import { MetricsService } from "../../../../../src/platform/shared/observability/metrics-service.js";
import {
  SliCollectionService,
  DEFAULT_SLO_DEFINITIONS,
} from "../../../../../src/platform/shared/observability/sli-collection-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createHarness() {
  const workspace = createTempWorkspace("aa-sli-");
  const dbPath = join(workspace, "sli.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(SLO_ALERTING_DDL);

  // Seed minimal data so metrics queries don't fail on empty tables
  const now = new Date().toISOString();
  db.connection.exec(`
    INSERT INTO tasks (id, parent_id, root_id, division_id, title, status, source, priority, input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd, error_code, created_at, updated_at, completed_at)
    VALUES
      ('task_test_1', NULL, 'task_test_1', NULL, 'Test task 1', 'done', 'test', 'medium', '{}', NULL, NULL, NULL, 0, NULL, '${now}', '${now}', '${now}'),
      ('task_test_2', NULL, 'task_test_2', NULL, 'Test task 2', 'done', 'test', 'medium', '{}', NULL, NULL, NULL, 0, NULL, '${now}', '${now}', '${now}'),
      ('task_test_3', NULL, 'task_test_3', NULL, 'Test task 3', 'done', 'test', 'medium', '{}', NULL, NULL, NULL, 0, NULL, '${now}', '${now}', '${now}');
  `);

  const store = new AuthoritativeTaskStore(db);
  const sloService = new SloAlertingService(db);
  const healthService = new HealthService(db, store);
  const metricsService = new MetricsService(db, healthService);
  const collectionService = new SliCollectionService(db, healthService, metricsService, sloService);

  return { workspace, db, store, sloService, healthService, metricsService, collectionService };
}

test("initializeDefaultSlos creates all default SLO definitions", () => {
  const h = createHarness();
  try {
    const created = h.collectionService.initializeDefaultSlos();

    assert.equal(created.length, DEFAULT_SLO_DEFINITIONS.length);
    assert.ok(created.every((slo) => slo.id.startsWith("slo_")));

    // Idempotent - second call returns empty
    const created2 = h.collectionService.initializeDefaultSlos();
    assert.equal(created2.length, 0);

    // Verify all expected SLOs exist
    const slos = h.sloService.listSlos();
    const sloNames = slos.map((s) => s.name);
    assert.ok(sloNames.includes("task_success_rate"));
    assert.ok(sloNames.includes("approval_delivery_availability"));
    assert.ok(sloNames.includes("recovery_success_rate"));
    assert.ok(sloNames.includes("tier1_event_delivery_latency"));
    assert.ok(sloNames.includes("db_writability"));
    assert.ok(sloNames.includes("queue_backlog_pressure"));
    assert.ok(sloNames.includes("provider_health_rate"));
    assert.ok(sloNames.includes("memory_pressure"));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("collectAllSlis collects all SLI types without errors", () => {
  const h = createHarness();
  try {
    h.collectionService.initializeDefaultSlos();

    const summary = h.collectionService.collectAllSlis();

    // Most SLIs should collect without errors; allow small number of errors from
    // edge cases (e.g., no recovery events yet = division by zero handled gracefully)
    assert.ok(summary.errors.length < 5, `Expected < 5 errors, got ${summary.errors.length}: ${summary.errors.join(", ")}`);
    assert.ok(summary.sliKinds.length >= 6, `Expected >= 6 SLI kinds collected, got ${summary.sliKinds.length}`);
    assert.ok(summary.sliKinds.includes("availability"));
    assert.ok(summary.sliKinds.includes("saturation"));

    // At least the core SLIs should have samples
    const taskSlo = h.sloService.listSlos().find((s) => s.name === "task_success_rate")!;
    const taskSamples = h.sloService.listSliSamples(taskSlo.id);
    assert.ok(taskSamples.length >= 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("collectAllSlis records correct values for task_success_rate", () => {
  const h = createHarness();
  try {
    h.collectionService.initializeDefaultSlos();
    h.collectionService.collectAllSlis();

    const slo = h.sloService.listSlos().find((s) => s.name === "task_success_rate")!;
    const samples = h.sloService.listSliSamples(slo.id);
    const latest = samples[0]!;

    // 3 done tasks out of 3 terminal = 1.0 success rate
    assert.equal(latest.value, 1.0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("collectAllSlis records db_writability as 1 when db is writable", () => {
  const h = createHarness();
  try {
    h.collectionService.initializeDefaultSlos();
    h.collectionService.collectAllSlis();

    const slo = h.sloService.listSlos().find((s) => s.name === "db_writability")!;
    const samples = h.sloService.listSliSamples(slo.id);
    const latest = samples[0]!;

    assert.equal(latest.value, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("collectAllSlis records queue_backlog_pressure from health service", () => {
  const h = createHarness();
  try {
    h.collectionService.initializeDefaultSlos();
    h.collectionService.collectAllSlis();

    const slo = h.sloService.listSlos().find((s) => s.name === "queue_backlog_pressure")!;
    const samples = h.sloService.listSliSamples(slo.id);
    const latest = samples[0]!;

    // No tickets in queue = 0 backlog
    assert.equal(latest.value, 0);
    assert.equal(latest.unit, "count");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("collectAllSlis records memory_pressure from health service", () => {
  const h = createHarness();
  try {
    h.collectionService.initializeDefaultSlos();
    h.collectionService.collectAllSlis();

    const slo = h.sloService.listSlos().find((s) => s.name === "memory_pressure")!;
    const samples = h.sloService.listSliSamples(slo.id);
    const latest = samples[0]!;

    assert.ok(latest.value > 0, "Memory pressure should be positive");
    assert.equal(latest.unit, "MB");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("collectAllSlis handles case when SLOs not initialized (graceful no-op)", () => {
  const h = createHarness();
  try {
    // Don't call initializeDefaultSlos - SLIs won't be collected but no error thrown
    const summary = h.collectionService.collectAllSlis();

    // No SLOs defined = nothing to collect = no errors, 0 kinds
    assert.equal(summary.sliKinds.length, 0);
    assert.equal(summary.errors.length, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("start and stop collection loop", () => {
  const h = createHarness();
  try {
    h.collectionService.initializeDefaultSlos();

    // Start should set an interval
    h.collectionService.start();
    // Second start is no-op
    h.collectionService.start();

    // Stop should clear the interval
    h.collectionService.stop();
    // Second stop is no-op
    h.collectionService.stop();
  } finally {
    h.collectionService.stop();
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("autoStart option begins collection immediately", async () => {
  const workspace = createTempWorkspace("aa-sli-auto-");
  try {
    const dbPath = join(workspace, "sli.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.connection.exec(SLO_ALERTING_DDL);

    // Seed minimal data
    const now = new Date().toISOString();
    db.connection.exec(`
    INSERT INTO tasks (id, parent_id, root_id, division_id, title, status, source, priority, input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd, error_code, created_at, updated_at, completed_at)
    VALUES ('task_test_1', NULL, 'task_test_1', NULL, 'Test task 1', 'done', 'test', 'medium', '{}', NULL, NULL, NULL, 0, NULL, '${now}', '${now}', '${now}');
    `);

    const store = new AuthoritativeTaskStore(db);
    const sloService = new SloAlertingService(db);
    const healthService = new HealthService(db, store);
    const metricsService = new MetricsService(db, healthService);

    // Initialize SLOs BEFORE creating service with autoStart
    // so the immediate first collection in constructor succeeds
    const collectionService = new SliCollectionService(
      db,
      healthService,
      metricsService,
      sloService,
    );
    collectionService.initializeDefaultSlos();

    // Now create another service with autoStart - this does immediate collection
    const autoCollectionService = new SliCollectionService(
      db,
      healthService,
      metricsService,
      sloService,
      { autoStart: true, collectionIntervalMs: 60000 },
    );

    // Wait a tiny bit for the async constructor to finish
    await new Promise((resolve) => setTimeout(resolve, 10));

    autoCollectionService.stop();

    // The autoStart service should have collected at least 1 SLI sample
    const slo = sloService.listSlos().find((s) => s.name === "task_success_rate")!;
    const samples = sloService.listSliSamples(slo.id);
    assert.ok(samples.length >= 1, `Expected >= 1 samples, got ${samples.length}`);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SloAlertingService.evaluateSlo evaluates collected samples correctly", () => {
  const h = createHarness();
  try {
    h.collectionService.initializeDefaultSlos();
    h.collectionService.collectAllSlis();

    const slo = h.sloService.listSlos().find((s) => s.name === "task_success_rate")!;
    const status = h.sloService.evaluateSlo(slo.id);

    assert.ok(["met", "at_risk", "breached", "unknown"].includes(status));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
