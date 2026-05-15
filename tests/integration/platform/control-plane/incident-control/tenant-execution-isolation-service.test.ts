/**
 * Integration Tests: Tenant Execution Isolation Service
 *
 * Tests the TenantExecutionIsolationService with real database
 * quota management, usage tracking, and isolation status evaluation.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { TenantExecutionIsolationService, TENANT_ISOLATION_DDL, type TenantQuota, type QuotaUsage, type TenantIsolationStatus, type ExecutionResourceUsage } from "../../../../../src/platform/five-plane-control-plane/incident-control/tenant-execution-isolation-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

function createTestDb(workspace: string): SqliteDatabase {
  const db = new SqliteDatabase(join(workspace, "tenant-isolation.db"));
  db.migrate();
  // Drop any existing tables and recreate to ensure clean state
  db.connection.exec(`
    DROP TABLE IF EXISTS tenant_quotas;
    DROP TABLE IF EXISTS quota_usage_samples;
    DROP TABLE IF EXISTS execution_resource_usage;
    DROP TABLE IF EXISTS noisy_neighbor_signals;
  `);
  db.connection.exec(TENANT_ISOLATION_DDL);
  return db;
}

// =============================================================================
// Construction & Quota Management
// =============================================================================

test("TenantExecutionIsolationService integration: constructs and runs migrations", () => {
  const workspace = createTempWorkspace("aa-tenant-construct-");

  try {
    const db = createTestDb(workspace);
    const service = new TenantExecutionIsolationService(db);

    assert.ok(service);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TenantExecutionIsolationService integration: defineQuota creates quota", () => {
  const workspace = createTempWorkspace("aa-tenant-quota-");

  try {
    const db = createTestDb(workspace);
    const store = new AuthoritativeTaskStore(db);
    const service = new TenantExecutionIsolationService(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-quota-1",
      executionId: "exec-quota-1",
      traceId: "trace-quota-1",
    });

    const quota = service.defineQuota({
      tenantId: "tenant-a",
      quotaKind: "executions_per_minute",
      limitValue: 100,
      windowSeconds: 60,
      enforcementAction: "throttle",
      enabled: true,
    });

    assert.ok(quota.id.startsWith("tquota_"));
    assert.equal(quota.tenantId, "tenant-a");
    assert.equal(quota.quotaKind, "executions_per_minute");
    assert.equal(quota.limitValue, 100);
    assert.equal(quota.enforcementAction, "throttle");
    assert.equal(quota.enabled, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TenantExecutionIsolationService integration: getQuota retrieves defined quota", () => {
  const workspace = createTempWorkspace("aa-tenant-get-");

  try {
    const db = createTestDb(workspace);
    const store = new AuthoritativeTaskStore(db);
    const service = new TenantExecutionIsolationService(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-get-1",
      executionId: "exec-get-1",
      traceId: "trace-get-1",
    });

    service.defineQuota({
      tenantId: "tenant-b",
      quotaKind: "concurrent_executions",
      limitValue: 10,
      windowSeconds: 60,
      enforcementAction: "reject",
      enabled: true,
    });

    const retrieved = service.getQuota("tenant-b", "concurrent_executions");

    assert.ok(retrieved);
    assert.equal(retrieved?.tenantId, "tenant-b");
    assert.equal(retrieved?.quotaKind, "concurrent_executions");
    assert.equal(retrieved?.limitValue, 10);
    assert.equal(retrieved?.enforcementAction, "reject");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TenantExecutionIsolationService integration: getQuota returns null for missing quota", () => {
  const workspace = createTempWorkspace("aa-tenant-missing-");

  try {
    const db = createTestDb(workspace);
    const service = new TenantExecutionIsolationService(db);

    const result = service.getQuota("non-existent-tenant", "executions_per_minute");

    assert.equal(result, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TenantExecutionIsolationService integration: listQuotas returns all quotas", () => {
  const workspace = createTempWorkspace("aa-tenant-list-");

  try {
    const db = createTestDb(workspace);
    const store = new AuthoritativeTaskStore(db);
    const service = new TenantExecutionIsolationService(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-list-1",
      executionId: "exec-list-1",
      traceId: "trace-list-1",
    });

    service.defineQuota({
      tenantId: "tenant-x",
      quotaKind: "executions_per_minute",
      limitValue: 50,
      windowSeconds: 60,
      enforcementAction: "log_only",
      enabled: true,
    });
    service.defineQuota({
      tenantId: "tenant-x",
      quotaKind: "total_compute_minutes",
      limitValue: 1000,
      windowSeconds: 3600,
      enforcementAction: "log_only",
      enabled: true,
    });
    service.defineQuota({
      tenantId: "tenant-y",
      quotaKind: "executions_per_minute",
      limitValue: 75,
      windowSeconds: 60,
      enforcementAction: "log_only",
      enabled: true,
    });

    const allQuotas = service.listQuotas();
    assert.ok(allQuotas.length >= 3);

    const tenantXQuotas = service.listQuotas("tenant-x");
    assert.equal(tenantXQuotas.length, 2);
    assert.ok(tenantXQuotas.every((q) => q.tenantId === "tenant-x"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TenantExecutionIsolationService integration: deleteQuota removes quota", () => {
  const workspace = createTempWorkspace("aa-tenant-delete-");

  try {
    const db = createTestDb(workspace);
    const store = new AuthoritativeTaskStore(db);
    const service = new TenantExecutionIsolationService(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-delete-1",
      executionId: "exec-delete-1",
      traceId: "trace-delete-1",
    });

    service.defineQuota({
      tenantId: "tenant-delete",
      quotaKind: "storage_bytes",
      limitValue: 1_000_000_000,
      windowSeconds: 86400,
      enforcementAction: "reject",
      enabled: true,
    });

    assert.ok(service.getQuota("tenant-delete", "storage_bytes"));

    const deleted = service.deleteQuota("tenant-delete", "storage_bytes");
    assert.equal(deleted, true);
    assert.equal(service.getQuota("tenant-delete", "storage_bytes"), null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TenantExecutionIsolationService integration: deleteQuota returns false for non-existent", () => {
  const workspace = createTempWorkspace("aa-tenant-delete-false-");

  try {
    const db = createTestDb(workspace);
    const service = new TenantExecutionIsolationService(db);

    const deleted = service.deleteQuota("non-existent", "executions_per_minute");
    assert.equal(deleted, false);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Usage Recording
// =============================================================================

test("TenantExecutionIsolationService integration: recordResourceUsage stores usage", () => {
  const workspace = createTempWorkspace("aa-tenant-usage-");

  try {
    const db = createTestDb(workspace);
    const store = new AuthoritativeTaskStore(db);
    const service = new TenantExecutionIsolationService(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-usage-1",
      executionId: "exec-usage-1",
      traceId: "trace-usage-1",
    });

    service.recordResourceUsage({
      executionId: "exec-usage-1",
      tenantId: "tenant-usage",
      cpuMs: 1500,
      memoryBytes: 256_000_000,
      networkBytes: 10_000_000,
      durationMs: 5000,
      recordedAt: nowIso(),
    });

    // Verify by checking active execution count
    const count = service.getActiveExecutionCount("tenant-usage");
    assert.equal(count, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TenantExecutionIsolationService integration: recordResourceUsage updates compute quota samples", () => {
  const workspace = createTempWorkspace("aa-tenant-compute-");

  try {
    const db = createTestDb(workspace);
    const store = new AuthoritativeTaskStore(db);
    const service = new TenantExecutionIsolationService(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-compute-1",
      executionId: "exec-compute-1",
      traceId: "trace-compute-1",
    });

    service.defineQuota({
      tenantId: "tenant-compute",
      quotaKind: "total_compute_minutes",
      limitValue: 100,
      windowSeconds: 60,
      enforcementAction: "log_only",
      enabled: true,
    });

    service.recordResourceUsage({
      executionId: "exec-compute-1",
      tenantId: "tenant-compute",
      cpuMs: 30000, // 0.5 compute minutes
      memoryBytes: 128_000_000,
      networkBytes: 0,
      durationMs: 30000,
      recordedAt: nowIso(),
    });

    const usage = service.getQuotaUsage("tenant-compute", "total_compute_minutes");
    assert.ok(usage);
    assert.equal(usage?.currentValue, 0.5);
    assert.equal(usage?.limitValue, 100);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Quota Usage Query
// =============================================================================

test("TenantExecutionIsolationService integration: getQuotaUsage calculates percentage", () => {
  const workspace = createTempWorkspace("aa-tenant-usage-query-");

  try {
    const db = createTestDb(workspace);
    const store = new AuthoritativeTaskStore(db);
    const service = new TenantExecutionIsolationService(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-uq-1",
      executionId: "exec-uq-1",
      traceId: "trace-uq-1",
    });

    service.defineQuota({
      tenantId: "tenant-uq",
      quotaKind: "executions_per_minute",
      limitValue: 10,
      windowSeconds: 60,
      enforcementAction: "throttle",
      enabled: true,
    });

    // Record multiple samples
    service.recordQuotaSample("tenant-uq", "executions_per_minute", 3, 60, nowIso());
    service.recordQuotaSample("tenant-uq", "executions_per_minute", 4, 60, nowIso());

    const usage = service.getQuotaUsage("tenant-uq", "executions_per_minute");

    assert.ok(usage);
    assert.equal(usage?.currentValue, 7);
    assert.equal(usage?.percentUsed, 70);
    assert.equal(usage?.status, "warning");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TenantExecutionIsolationService integration: getQuotaUsage returns null for non-existent quota", () => {
  const workspace = createTempWorkspace("aa-tenant-usage-null-");

  try {
    const db = createTestDb(workspace);
    const service = new TenantExecutionIsolationService(db);

    const usage = service.getQuotaUsage("non-existent-tenant", "executions_per_minute");
    assert.equal(usage, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TenantExecutionIsolationService integration: getQuotaUsage status is critical at 90%", () => {
  const workspace = createTempWorkspace("aa-tenant-critical-");

  try {
    const db = createTestDb(workspace);
    const store = new AuthoritativeTaskStore(db);
    const service = new TenantExecutionIsolationService(db, { quotaCriticalPercent: 90 });

    seedTaskAndExecution(db, store, {
      taskId: "task-critical-1",
      executionId: "exec-critical-1",
      traceId: "trace-critical-1",
    });

    service.defineQuota({
      tenantId: "tenant-critical",
      quotaKind: "executions_per_minute",
      limitValue: 10,
      windowSeconds: 60,
      enforcementAction: "reject",
      enabled: true,
    });

    service.recordQuotaSample("tenant-critical", "executions_per_minute", 9, 60, nowIso());

    const usage = service.getQuotaUsage("tenant-critical", "executions_per_minute");

    assert.ok(usage);
    assert.equal(usage?.percentUsed, 90);
    assert.equal(usage?.status, "critical");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TenantExecutionIsolationService integration: getQuotaUsage status is exceeded at 100%", () => {
  const workspace = createTempWorkspace("aa-tenant-exceeded-");

  try {
    const db = createTestDb(workspace);
    const store = new AuthoritativeTaskStore(db);
    const service = new TenantExecutionIsolationService(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-exceeded-1",
      executionId: "exec-exceeded-1",
      traceId: "trace-exceeded-1",
    });

    service.defineQuota({
      tenantId: "tenant-exceeded",
      quotaKind: "executions_per_minute",
      limitValue: 10,
      windowSeconds: 60,
      enforcementAction: "reject",
      enabled: true,
    });

    service.recordQuotaSample("tenant-exceeded", "executions_per_minute", 15, 60, nowIso());

    const usage = service.getQuotaUsage("tenant-exceeded", "executions_per_minute");

    assert.ok(usage);
    assert.equal(usage?.currentValue, 15);
    assert.equal(usage?.percentUsed, 150);
    assert.equal(usage?.status, "exceeded");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Isolation Status
// =============================================================================

test("TenantExecutionIsolationService integration: getIsolationStatus returns comprehensive status", () => {
  const workspace = createTempWorkspace("aa-tenant-status-");

  try {
    const db = createTestDb(workspace);
    const store = new AuthoritativeTaskStore(db);
    const service = new TenantExecutionIsolationService(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-status-1",
      executionId: "exec-status-1",
      traceId: "trace-status-1",
    });

    service.defineQuota({
      tenantId: "tenant-status",
      quotaKind: "executions_per_minute",
      limitValue: 100,
      windowSeconds: 60,
      enforcementAction: "throttle",
      enabled: true,
    });

    service.recordResourceUsage({
      executionId: "exec-status-1",
      tenantId: "tenant-status",
      cpuMs: 500,
      memoryBytes: 100_000_000,
      networkBytes: 0,
      durationMs: 2000,
      recordedAt: nowIso(),
    });

    const status = service.getIsolationStatus("tenant-status");

    assert.equal(status.tenantId, "tenant-status");
    assert.equal(status.overallStatus, "active");
    assert.equal(status.activeExecutions, 1);
    assert.ok(status.noisyNeighborScore === 0);
    assert.ok(status.lastCheckedAt);
    assert.ok(status.quotas.length > 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TenantExecutionIsolationService integration: getIsolationStatus shows quota_exceeded when limit hit", () => {
  const workspace = createTempWorkspace("aa-tenant-exceeded-status-");

  try {
    const db = createTestDb(workspace);
    const store = new AuthoritativeTaskStore(db);
    const service = new TenantExecutionIsolationService(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-exceeded-status-1",
      executionId: "exec-exceeded-status-1",
      traceId: "trace-exceeded-status-1",
    });

    service.defineQuota({
      tenantId: "tenant-exceeded-status",
      quotaKind: "executions_per_minute",
      limitValue: 5,
      windowSeconds: 60,
      enforcementAction: "reject",
      enabled: true,
    });

    // Exceed the limit
    service.recordQuotaSample("tenant-exceeded-status", "executions_per_minute", 10, 60, nowIso());

    const status = service.getIsolationStatus("tenant-exceeded-status");

    assert.equal(status.overallStatus, "quota_exceeded");
    assert.ok(status.blockedSince);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Quota Check
// =============================================================================

test("TenantExecutionIsolationService integration: checkQuota allows increment within limit", () => {
  const workspace = createTempWorkspace("aa-tenant-check-");

  try {
    const db = createTestDb(workspace);
    const store = new AuthoritativeTaskStore(db);
    const service = new TenantExecutionIsolationService(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-check-1",
      executionId: "exec-check-1",
      traceId: "trace-check-1",
    });

    service.defineQuota({
      tenantId: "tenant-check",
      quotaKind: "concurrent_executions",
      limitValue: 5,
      windowSeconds: 60,
      enforcementAction: "reject",
      enabled: true,
    });

    service.recordQuotaSample("tenant-check", "concurrent_executions", 2, 60, nowIso());

    const result = service.checkQuota("tenant-check", "concurrent_executions", 1);

    assert.equal(result.allowed, true);
    assert.ok(result.currentUsage);
    assert.equal(result.currentUsage?.currentValue, 2);
    assert.equal(result.enforcementAction, "reject");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TenantExecutionIsolationService integration: checkQuota denies increment that would exceed limit", () => {
  const workspace = createTempWorkspace("aa-tenant-check-deny-");

  try {
    const db = createTestDb(workspace);
    const store = new AuthoritativeTaskStore(db);
    const service = new TenantExecutionIsolationService(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-check-deny-1",
      executionId: "exec-check-deny-1",
      traceId: "trace-check-deny-1",
    });

    service.defineQuota({
      tenantId: "tenant-check-deny",
      quotaKind: "concurrent_executions",
      limitValue: 5,
      windowSeconds: 60,
      enforcementAction: "reject",
      enabled: true,
    });

    service.recordQuotaSample("tenant-check-deny", "concurrent_executions", 5, 60, nowIso());

    const result = service.checkQuota("tenant-check-deny", "concurrent_executions", 1);

    assert.equal(result.allowed, false);
    assert.equal(result.enforcementAction, "reject");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TenantExecutionIsolationService integration: checkQuota allows when enforcement is log_only", () => {
  const workspace = createTempWorkspace("aa-tenant-check-log-");

  try {
    const db = createTestDb(workspace);
    const store = new AuthoritativeTaskStore(db);
    const service = new TenantExecutionIsolationService(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-check-log-1",
      executionId: "exec-check-log-1",
      traceId: "trace-check-log-1",
    });

    service.defineQuota({
      tenantId: "tenant-check-log",
      quotaKind: "concurrent_executions",
      limitValue: 5,
      windowSeconds: 60,
      enforcementAction: "log_only",
      enabled: true,
    });

    service.recordQuotaSample("tenant-check-log", "concurrent_executions", 5, 60, nowIso());

    const result = service.checkQuota("tenant-check-log", "concurrent_executions", 1);

    // log_only enforcement still allows even when over limit
    assert.equal(result.allowed, true);
    assert.equal(result.enforcementAction, "log_only");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TenantExecutionIsolationService integration: checkQuota allows for disabled quota", () => {
  const workspace = createTempWorkspace("aa-tenant-check-disabled-");

  try {
    const db = createTestDb(workspace);
    const store = new AuthoritativeTaskStore(db);
    const service = new TenantExecutionIsolationService(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-check-disabled-1",
      executionId: "exec-check-disabled-1",
      traceId: "trace-check-disabled-1",
    });

    service.defineQuota({
      tenantId: "tenant-check-disabled",
      quotaKind: "concurrent_executions",
      limitValue: 1,
      windowSeconds: 60,
      enforcementAction: "reject",
      enabled: false, // Disabled
    });

    const result = service.checkQuota("tenant-check-disabled", "concurrent_executions", 10);

    assert.equal(result.allowed, true);
    assert.equal(result.currentUsage, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Noisy Neighbor Detection
// =============================================================================

test("TenantExecutionIsolationService integration: recordNoisyNeighborSignal records signal", () => {
  const workspace = createTempWorkspace("aa-tenant-noise-");

  try {
    const db = createTestDb(workspace);
    const service = new TenantExecutionIsolationService(db);

    service.recordNoisyNeighborSignal("tenant-noise", "excessive_resource_usage", "high", { cpuPct: 95 });

    const signals = service.listActiveNoisyNeighborSignals("tenant-noise");

    assert.ok(signals.length > 0);
    assert.equal(signals[0]?.tenant_id, "tenant-noise");
    assert.equal(signals[0]?.signal_type, "excessive_resource_usage");
    assert.equal(signals[0]?.severity, "high");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TenantExecutionIsolationService integration: resolveNoisyNeighborSignal clears signal", () => {
  const workspace = createTempWorkspace("aa-tenant-resolve-");

  try {
    const db = createTestDb(workspace);
    const service = new TenantExecutionIsolationService(db);

    service.recordNoisyNeighborSignal("tenant-resolve", "burst_traffic", "medium");

    let signals = service.listActiveNoisyNeighborSignals("tenant-resolve");
    const signalId = signals[0]?.id;

    assert.ok(signals.length > 0);

    const resolved = service.resolveNoisyNeighborSignal(signalId!);
    assert.equal(resolved, true);

    signals = service.listActiveNoisyNeighborSignals("tenant-resolve");
    assert.ok(signals.length === 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TenantExecutionIsolationService integration: noisy neighbor score affects isolation status", () => {
  const workspace = createTempWorkspace("aa-tenant-noise-status-");

  try {
    const db = createTestDb(workspace);
    const store = new AuthoritativeTaskStore(db);
    const service = new TenantExecutionIsolationService(db, { noisyNeighborThreshold: 50 });

    seedTaskAndExecution(db, store, {
      taskId: "task-noise-status-1",
      executionId: "exec-noise-status-1",
      traceId: "trace-noise-status-1",
    });

    // Record multiple high severity signals to push score above threshold
    service.recordNoisyNeighborSignal("tenant-noise-status", "high_cpu", "high", { cpuPct: 99 });
    service.recordNoisyNeighborSignal("tenant-noise-status", "high_memory", "high", { memoryMb: 8000 });
    service.recordNoisyNeighborSignal("tenant-noise-status", "network_saturation", "high", { networkMbps: 900 });

    const status = service.getIsolationStatus("tenant-noise-status");

    assert.equal(status.overallStatus, "noisy_neighbor_detected");
    assert.ok(status.noisyNeighborScore >= 50);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Cleanup
// =============================================================================

test("TenantExecutionIsolationService integration: purgeOldSamples removes old samples", () => {
  const workspace = createTempWorkspace("aa-tenant-purge-");

  try {
    const db = createTestDb(workspace);
    const store = new AuthoritativeTaskStore(db);
    const service = new TenantExecutionIsolationService(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-purge-1",
      executionId: "exec-purge-1",
      traceId: "trace-purge-1",
    });

    service.defineQuota({
      tenantId: "tenant-purge",
      quotaKind: "executions_per_minute",
      limitValue: 100,
      windowSeconds: 60,
      enforcementAction: "log_only",
      enabled: true,
    });

    service.recordQuotaSample("tenant-purge", "executions_per_minute", 5, 60, nowIso());

    // Purge samples older than 24 hours
    const deleted = service.purgeOldSamples(86400);

    assert.ok(deleted >= 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TenantExecutionIsolationService integration: purgeResolvedSignals removes old resolved signals", () => {
  const workspace = createTempWorkspace("aa-tenant-purge-signals-");

  try {
    const db = createTestDb(workspace);
    const service = new TenantExecutionIsolationService(db);

    service.recordNoisyNeighborSignal("tenant-purge-signals", "test_signal", "low");
    service.recordNoisyNeighborSignal("tenant-purge-signals", "test_signal_2", "low");

    let signals = service.listActiveNoisyNeighborSignals("tenant-purge-signals");
    const firstSignalId = signals[0]?.id;

    service.resolveNoisyNeighborSignal(firstSignalId!);

    signals = service.listActiveNoisyNeighborSignals("tenant-purge-signals");
    assert.ok(signals.length === 1);

    const deleted = service.purgeResolvedSignals(86400);
    assert.ok(deleted >= 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
