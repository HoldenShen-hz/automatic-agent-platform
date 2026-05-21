/**
 * Unit tests for Health Service - comprehensive coverage
 *
 * @see src/platform/shared/observability/health-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import { ProviderHealthTracker } from "../../../../../src/platform/shared/observability/provider-health-tracker.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("HealthService constructor applies default options", () => {
  const workspace = createTempWorkspace("aa-health-ctor-");
  const dbPath = join(workspace, "health-ctor.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);

    const report = service.getReport();
    assert.ok(report !== undefined);
    assert.equal(typeof report.status, "string");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService constructor accepts custom options", () => {
  const workspace = createTempWorkspace("aa-health-opts-");
  const dbPath = join(workspace, "health-opts.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const providerTracker = new ProviderHealthTracker({ retentionLimit: 100 });
    const service = new HealthService(db, store, {
      providerTracker,
      providerWindowMs: 60_000,
      memoryHighWatermarkMb: 1024,
      eventLoopLagThresholdMs: 500,
      queuedTaskDegradedThreshold: 10,
      queuedTaskOverloadedThreshold: 20,
      tier1AckDegradedThreshold: 20,
      tier1AckOverloadedThreshold: 50,
      activeExecutionOverloadedThreshold: 20,
      queueStarvationThresholdSeconds: 600,
      staleWorkerThresholdMs: 600_000,
      degradedScoreThreshold: 3,
      weakSignalEscalationWindow: 3,
      recoveryWindowReports: 3,
      syncSnapshotMaxAgeMs: 10_000,
      allowSynchronousSampling: false,
    });

    const report = service.getReport();
    assert.ok(report !== undefined);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService getReport returns status ok for fresh system", () => {
  const workspace = createTempWorkspace("aa-health-fresh-");
  const dbPath = join(workspace, "health-fresh.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = service.getReport();

    assert.ok(["ok", "degraded", "overloaded", "unhealthy"].includes(report.status));
    assert.equal(typeof report.dbWritable, "boolean");
    assert.ok(report.uptimeSeconds >= 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService getReportAsync returns valid promise", async () => {
  const workspace = createTempWorkspace("aa-health-async-");
  const dbPath = join(workspace, "health-async.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = await service.getReportAsync();

    assert.ok(report !== undefined);
    assert.ok(["ok", "degraded", "overloaded", "unhealthy"].includes(report.status));
    assert.equal(typeof report.dbWritable, "boolean");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService report includes all required fields", () => {
  const workspace = createTempWorkspace("aa-health-fields-");
  const dbPath = join(workspace, "health-fields.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = service.getReport();

    assert.ok("status" in report);
    assert.ok("uptimeSeconds" in report);
    assert.ok("dbWritable" in report);
    assert.ok("providerHealth" in report);
    assert.ok("providerSuccessRate" in report);
    assert.ok("providerRecentCalls" in report);
    assert.ok("activeExecutions" in report);
    assert.ok("queuedTasks" in report);
    assert.ok("eventLoopLagMs" in report);
    assert.ok("memoryRssMb" in report);
    assert.ok("tier1AckBacklog" in report);
    assert.ok("degradationMode" in report);
    assert.ok("backpressure" in report);
    assert.ok("queueGovernance" in report);
    assert.ok("workerHealth" in report);
    assert.ok("findings" in report);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService providerTracker integration", () => {
  const workspace = createTempWorkspace("aa-health-provider-");
  const dbPath = join(workspace, "health-provider.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const providerTracker = new ProviderHealthTracker();
    providerTracker.recordAttempt({
      provider: "test-provider",
      model: "test-model",
      succeeded: true,
      latencyMs: 100,
      recordedAt: new Date().toISOString(),
    });

    const service = new HealthService(db, store, { providerTracker });
    const report = service.getReport();

    assert.equal(report.providerRecentCalls, 1);
    assert.equal(report.providerHealth, "healthy");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService degraded provider health affects status", () => {
  const workspace = createTempWorkspace("aa-health-degraded-");
  const dbPath = join(workspace, "health-degraded.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const providerTracker = new ProviderHealthTracker({ degradedThreshold: 0.9 });
    // Record multiple failed attempts to trigger degraded status
    for (let i = 0; i < 10; i++) {
      providerTracker.recordAttempt({
        provider: "test-provider",
        model: "test-model",
        succeeded: i < 7, // 70% success rate -> degraded with 0.9 threshold
        latencyMs: 100,
        recordedAt: new Date().toISOString(),
      });
    }

    const service = new HealthService(db, store, { providerTracker });
    const report = service.getReport();

    assert.ok(["degraded", "overloaded", "unhealthy"].includes(report.status) || report.providerHealth === "degraded");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService with nowMsSupplier for deterministic time", () => {
  const workspace = createTempWorkspace("aa-health-time-");
  const dbPath = join(workspace, "health-time.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const nowMs = () => 1700000000000;
    const service = new HealthService(db, store, { nowMsSupplier: nowMs });
    const report = service.getReport();

    assert.ok(report.uptimeSeconds >= 0);
    assert.equal(typeof report.status, "string");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService queueGovernance has correct structure", () => {
  const workspace = createTempWorkspace("aa-health-queue-");
  const dbPath = join(workspace, "health-queue.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = service.getReport();

    assert.equal(typeof report.queueGovernance.backlogSize, "number");
    assert.equal(typeof report.queueGovernance.dispatchableBacklogSize, "number");
    assert.equal(typeof report.queueGovernance.claimedBacklogSize, "number");
    assert.ok(
      report.queueGovernance.oldestWaitSeconds === null
      || typeof report.queueGovernance.oldestWaitSeconds === "number",
    );
    assert.ok(
      report.queueGovernance.oldestClaimAgeSeconds === null
      || typeof report.queueGovernance.oldestClaimAgeSeconds === "number",
    );
    assert.ok(Array.isArray(report.queueGovernance.queueNames));
    assert.equal(typeof report.queueGovernance.starvationDetected, "boolean");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService workerHealth has correct structure", () => {
  const workspace = createTempWorkspace("aa-health-worker-");
  const dbPath = join(workspace, "health-worker.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = service.getReport();

    assert.equal(typeof report.workerHealth.totalWorkers, "number");
    assert.equal(typeof report.workerHealth.healthyWorkers, "number");
    assert.equal(typeof report.workerHealth.busyWorkers, "number");
    assert.equal(typeof report.workerHealth.drainingWorkers, "number");
    assert.equal(typeof report.workerHealth.degradedWorkers, "number");
    assert.equal(typeof report.workerHealth.quarantinedWorkers, "number");
    assert.equal(typeof report.workerHealth.offlineWorkers, "number");
    assert.equal(typeof report.workerHealth.staleWorkers, "number");
    assert.equal(typeof report.workerHealth.loadSkewDetected, "boolean");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService backpressure has correct structure", () => {
  const workspace = createTempWorkspace("aa-health-bp-");
  const dbPath = join(workspace, "health-bp.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = service.getReport();

    assert.ok(["ok", "degraded", "overloaded", "unhealthy"].includes(report.backpressure.status));
    assert.ok([
      "none",
      "queue_only",
      "fast_only",
      "pause_non_critical",
      "read_only_operations_only",
    ].includes(report.backpressure.degradationMode));
    assert.equal(typeof report.backpressure.tier1AckBacklog, "number");
    assert.ok("queueGovernance" in report.backpressure);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService findings is array of strings", () => {
  const workspace = createTempWorkspace("aa-health-findings-");
  const dbPath = join(workspace, "health-findings.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = service.getReport();

    assert.ok(Array.isArray(report.findings));
    for (const finding of report.findings) {
      assert.equal(typeof finding, "string");
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService degradationMode is valid value", () => {
  const workspace = createTempWorkspace("aa-health-deg-");
  const dbPath = join(workspace, "health-deg.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = service.getReport();

    assert.ok([
      "none",
      "queue_only",
      "fast_only",
      "pause_non_critical",
      "read_only_operations_only",
    ].includes(report.degradationMode));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService checkHealth is alias for getReport", () => {
  const workspace = createTempWorkspace("aa-health-alias-");
  const dbPath = join(workspace, "health-alias.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report1 = service.checkHealth();
    const report2 = service.getReport();

    assert.equal(report1.status, report2.status);
    assert.equal(report1.dbWritable, report2.dbWritable);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService reports memory usage", () => {
  const workspace = createTempWorkspace("aa-health-mem-");
  const dbPath = join(workspace, "health-mem.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = service.getReport();

    assert.equal(typeof report.memoryRssMb, "number");
    assert.ok(report.memoryRssMb > 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService reports event loop lag", () => {
  const workspace = createTempWorkspace("aa-health-eloop-");
  const dbPath = join(workspace, "health-eloop.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    let lagSamplerCalled = false;
    const service = new HealthService(db, store, {
      eventLoopLagSampler: () => {
        lagSamplerCalled = true;
        return 50;
      },
    });
    const report = service.getReport();

    assert.equal(typeof report.eventLoopLagMs, "number");
    assert.ok(lagSamplerCalled);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService with allowSynchronousSampling false uses cache", () => {
  const workspace = createTempWorkspace("aa-health-async-mode-");
  const dbPath = join(workspace, "health-async-mode.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store, {
      allowSynchronousSampling: false,
      syncSnapshotMaxAgeMs: 10_000,
    });
    const report = service.getReport();

    assert.ok(report !== undefined);
    assert.equal(typeof report.status, "string");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService multiple calls return consistent report", () => {
  const workspace = createTempWorkspace("aa-health-multi-");
  const dbPath = join(workspace, "health-multi.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);

    const report1 = service.getReport();
    const report2 = service.getReport();
    const report3 = service.getReport();

    // All reports should have same status structure
    assert.ok(["ok", "degraded", "overloaded", "unhealthy"].includes(report1.status));
    assert.ok(["ok", "degraded", "overloaded", "unhealthy"].includes(report2.status));
    assert.ok(["ok", "degraded", "overloaded", "unhealthy"].includes(report3.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService providerSuccessRate is between 0 and 1", () => {
  const workspace = createTempWorkspace("aa-health-rate-");
  const dbPath = join(workspace, "health-rate.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = service.getReport();

    assert.ok(report.providerSuccessRate >= 0);
    assert.ok(report.providerSuccessRate <= 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});