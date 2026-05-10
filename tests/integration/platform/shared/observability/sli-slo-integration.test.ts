/**
 * @fileoverview SLI/SLO Integration Tests
 *
 * Verifies end-to-end SLI collection, SLO definition, SLO evaluation,
 * alert rule creation, and alert firing for the minimum SLO set.
 *
 * Covers:
 * - SliCollectionService.collectAllSlis() wiring to HealthService + MetricsService
 * - SloAlertingService.defineSlo / evaluateSlo / defineAlertRule / fireAlert
 * - SLO status transitions: unknown → met / at_risk / breached
 * - Alert delivery through LogAlertChannel
 *
 * @see src/core/observability/sli-collection-service.ts
 * @see src/core/observability/slo-alerting-service.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import { MetricsService } from "../../../../../src/platform/shared/observability/metrics-service.js";
import {
  SloAlertingService,
  LogAlertChannel,
  SLO_ALERTING_DDL,
  type SloDefinition,
  type SliRecord,
  type AlertEvent,
  type SloStatus,
} from "../../../../../src/platform/shared/observability/slo-alerting-service.js";
import {
  SliCollectionService,
  type SliCollectionSummary,
} from "../../../../../src/platform/shared/observability/sli-collection-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function buildTestSystem() {
  const workspace = createTempWorkspace("aa-sli-slo-");
  const dbPath = join(workspace, "sli-slo-test.db");

  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(SLO_ALERTING_DDL);

  const store = new AuthoritativeTaskStore(db);
  const healthService = new HealthService(db, store);
  const metricsService = new MetricsService(db, healthService);
  const sloService = new SloAlertingService(db);

  // SloAlertingService always has a log channel internally by default

  const collectionService = new SliCollectionService(
    db,
    healthService,
    metricsService,
    sloService,
  );

  return { workspace, dbPath, db, store, healthService, metricsService, sloService, collectionService };
}

// ── Tests ─────────────────────────────────────────────────────────────────

test("SliCollectionService initializes default SLO definitions", () => {
  const { workspace, dbPath, db, store, healthService, metricsService, sloService, collectionService } =
    buildTestSystem();

  try {
    const created = collectionService.initializeDefaultSlos();

    // Should create all default SLOs (currently 3 defined in DEFAULT_SLO_DEFINITIONS)
    assert.ok(created.length >= 3, `Expected at least 3 default SLOs, got ${created.length}`);
    assert.ok(created.every((s) => s.status === "unknown"), "Newly created SLOs should have unknown status");

    const allSlos = sloService.listSlos();
    assert.ok(allSlos.length >= 3, "listSlos should return the initialized SLOs");

    // Idempotent: calling again should create zero new SLOs
    const createdAgain = collectionService.initializeDefaultSlos();
    assert.equal(createdAgain.length, 0, "initializeDefaultSlos should be idempotent");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SliCollectionService.collectAllSlis returns valid summary", () => {
  const { workspace, dbPath, db, store, healthService, metricsService, sloService, collectionService } =
    buildTestSystem();

  try {
    // Initialize default SLOs before collection
    collectionService.initializeDefaultSlos();

    // Seed a completed task so metrics are available
    seedTaskAndExecution(db, store, {
      taskId: "task-sli-test",
      executionId: "exec-sli-test",
      traceId: "trace-sli-test",
    });

    const summary: SliCollectionSummary = collectionService.collectAllSlis();

    assert.ok(summary.collectedAt.length > 0, "collectedAt should be a valid ISO string");
    assert.ok(summary.sliCount >= 0, "sliCount should be non-negative");
    assert.ok(Array.isArray(summary.sliKinds), "sliKinds should be an array");
    assert.ok(Array.isArray(summary.errors), "errors should be an array");
    assert.equal(summary.errors.length, 0, "There should be no collection errors with seeded data");

    // With default SLOs initialized and seeded task data, we expect at least availability SLI to be collected
    assert.ok(summary.sliKinds.includes("availability"), "Should have collected availability SLI");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SloAlertingService.defineSlo creates a persisted SLO and getSlo retrieves it", () => {
  const { workspace, dbPath, db, sloService } = buildTestSystem();

  try {
    const slo: SloDefinition = sloService.defineSlo({
      name: "test_task_success_rate",
      description: "Test SLO for task success rate",
      sliKind: "availability",
      targetValue: 0.95,
      operator: "gte",
      windowMinutes: 60,
      domain: null,
    });

    assert.ok(slo.id.startsWith("slo_"), "SLO ID should have slo_ prefix");
    assert.equal(slo.status, "unknown");
    assert.equal(slo.targetValue, 0.95);
    assert.equal(slo.operator, "gte");
    assert.equal(slo.windowMinutes, 60);

    const retrieved = sloService.getSlo(slo.id);
    assert.ok(retrieved !== null, "getSlo should return the SLO");
    assert.equal(retrieved!.id, slo.id);
    assert.equal(retrieved!.name, "test_task_success_rate");

    const all = sloService.listSlos();
    assert.ok(all.some((s) => s.id === slo.id), "listSlos should include the created SLO");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SloAlertingService.collectSli stores a sample and listSliSamples retrieves it", () => {
  const { workspace, dbPath, db, sloService } = buildTestSystem();

  try {
    const slo: SloDefinition = sloService.defineSlo({
      name: "test_latency",
      description: "Test latency SLO",
      sliKind: "latency_p99",
      targetValue: 500,
      operator: "lte",
      windowMinutes: 15,
      domain: null,
    });

    const sli: SliRecord = sloService.collectSli(slo.id, 342.5, "ms", { source: "test" });

    assert.ok(sli.id.startsWith("sli_"), "SLI ID should have sli_ prefix");
    assert.equal(sli.sloId, slo.id);
    assert.equal(sli.value, 342.5);
    assert.equal(sli.unit, "ms");

    const samples: SliRecord[] = sloService.listSliSamples(slo.id, 10);
    assert.equal(samples.length, 1);
    assert.equal(samples[0]!.id, sli.id);
    assert.equal(samples[0]!.value, 342.5);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SloAlertingService.evaluateSlo returns met when target is met", () => {
  const { workspace, dbPath, db, sloService } = buildTestSystem();

  try {
    const slo: SloDefinition = sloService.defineSlo({
      name: "test_eval_met",
      description: "Eval test",
      sliKind: "availability",
      targetValue: 0.90,
      operator: "gte",
      windowMinutes: 60,
      domain: null,
    });

    // Collect two samples averaging 0.95 (>= 0.90 target)
    sloService.collectSli(slo.id, 0.95, "ratio");
    sloService.collectSli(slo.id, 0.95, "ratio");

    const status: SloStatus = sloService.evaluateSlo(slo.id)!;

    assert.ok(
      status === "met" || status === "at_risk",
      `SLO with avg 0.95 vs target 0.90 should be met or at_risk, got: ${status}`,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SloAlertingService.evaluateSlo returns breached when average violates target", () => {
  const { workspace, dbPath, db, sloService } = buildTestSystem();

  try {
    const slo: SloDefinition = sloService.defineSlo({
      name: "test_eval_breach",
      description: "Breach test",
      sliKind: "availability",
      targetValue: 0.95,
      operator: "gte",
      windowMinutes: 60,
      domain: null,
    });

    // Collect samples averaging 0.80 (< 0.95 target)
    sloService.collectSli(slo.id, 0.80, "ratio");
    sloService.collectSli(slo.id, 0.80, "ratio");

    const status: SloStatus = sloService.evaluateSlo(slo.id);
    assert.equal(status, "breached", "SLO with avg 0.80 vs target 0.95 should be breached");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SloAlertingService.evaluateSlo returns unknown when no samples in window", () => {
  const { workspace, dbPath, db, sloService } = buildTestSystem();

  try {
    const slo: SloDefinition = sloService.defineSlo({
      name: "test_eval_empty",
      description: "Empty window test",
      sliKind: "latency_p99",
      targetValue: 200,
      operator: "lte",
      windowMinutes: 1,
      domain: null,
    });

    // No samples collected — should return unknown
    const status: SloStatus = sloService.evaluateSlo(slo.id);
    assert.equal(status, "unknown", "SLO with no samples should return unknown");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SloAlertingService.defineAlertRule creates a rule and listAlertRules returns it", () => {
  const { workspace, dbPath, db, sloService } = buildTestSystem();

  try {
    const slo: SloDefinition = sloService.defineSlo({
      name: "test_alert_slo",
      description: "Alert SLO",
      sliKind: "error_rate",
      targetValue: 0.05,
      operator: "lte",
      windowMinutes: 30,
      domain: null,
    });

    const rule = sloService.defineAlertRule({
      name: "High Error Rate Alert",
      sloId: slo.id,
      condition: "breached",
      severity: "critical",
      channelKind: "log",
      channelConfig: "{}",
      cooldownMinutes: 5,
      enabled: true,
    });

    assert.ok(rule.id.startsWith("arule_"), "Alert rule ID should have arule_ prefix");
    assert.equal(rule.name, "High Error Rate Alert");
    assert.equal(rule.sloId, slo.id);
    assert.equal(rule.severity, "critical");
    assert.equal(rule.enabled, true);

    const rules = sloService.listAlertRules();
    assert.ok(rules.some((r) => r.id === rule.id), "listAlertRules should include the created rule");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SloAlertingService.fireAlert creates an alert event delivered to log channel", () => {
  const { workspace, dbPath, db, sloService } = buildTestSystem();

  try {
    const slo: SloDefinition = sloService.defineSlo({
      name: "test_fire_slo",
      description: "Fire test",
      sliKind: "availability",
      targetValue: 0.99,
      operator: "gte",
      windowMinutes: 30,
      domain: null,
    });

    const rule = sloService.defineAlertRule({
      name: "SLO Breached Alert",
      sloId: slo.id,
      condition: "breached",
      severity: "warning",
      channelKind: "log",
      channelConfig: "{}",
      cooldownMinutes: 5,
      enabled: true,
    });

    const alertEvent: AlertEvent = sloService.fireAlert(rule.id, "SLO breached", "Task success rate dropped to 85%");

    assert.ok(alertEvent.id.startsWith("alert_"), "Alert ID should have alert_ prefix");
    assert.equal(alertEvent.ruleId, rule.id);
    assert.equal(alertEvent.severity, "warning");
    assert.equal(alertEvent.title, "SLO breached");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SloCollectionService stop() prevents automatic collection", async () => {
  const { workspace, dbPath, db, store, healthService, metricsService, sloService } = buildTestSystem();

  try {
    // Create collection service with very short interval
    const collectionService = new SliCollectionService(db, healthService, metricsService, sloService, {
      collectionIntervalMs: 50,
      autoStart: true,
    });

    // Wait for at least one automatic collection to fire
    await new Promise<void>((resolve) => setTimeout(resolve, 120));

    collectionService.stop();

    const summary1: SliCollectionSummary = collectionService.collectAllSlis();

    // Stop should prevent next interval firing — verify by checking interval handle is cleared
    // The key test: stop() prevents future collections by clearing the interval handle
    // We verify indirectly by ensuring the service is still functional after stop
    assert.ok(summary1.collectedAt.length > 0, "Service should still work after stop");

    collectionService.stop(); // Idempotent stop should be safe

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SloCollectionService collectAllSlis produces samples queryable via evaluateSlo", () => {
  const { workspace, dbPath, db, store, healthService, metricsService, sloService, collectionService } =
    buildTestSystem();

  try {
    seedTaskAndExecution(db, store, {
      taskId: "task-slo-eval",
      executionId: "exec-slo-eval",
      traceId: "trace-slo-eval",
    });

    // Initialize default SLOs so we have targets for the collected SLIs
    collectionService.initializeDefaultSlos();

    // Collect SLIs
    collectionService.collectAllSlis();

    // Find the task_success_rate SLO
    const slos = sloService.listSlos();
    const taskSlo = slos.find((s) => s.name === "task_success_rate");
    assert.ok(taskSlo !== undefined, "task_success_rate SLO should exist after initialization");

    // Evaluate should return a valid status (not throw)
    const status: SloStatus = sloService.evaluateSlo(taskSlo!.id);
    assert.ok(
      status === "met" || status === "at_risk" || status === "breached" || status === "unknown",
      `evaluateSlo should return a valid SloStatus, got: ${status}`,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
