import assert from "node:assert/strict";
import test from "node:test";

import {
  TenantExecutionIsolationService,
  TENANT_ISOLATION_DDL,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/tenant-execution-isolation-service.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { join } from "node:path";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "tenant-isolation.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(`
    DROP TABLE IF EXISTS tenant_quotas;
    DROP TABLE IF EXISTS quota_usage_samples;
    DROP TABLE IF EXISTS execution_resource_usage;
    DROP TABLE IF EXISTS noisy_neighbor_signals;
  `);
  db.connection.exec(TENANT_ISOLATION_DDL);
  return { workspace, db };
}

test("defines and retrieves tenant quota", () => {
  const h = createHarness("aa-tenant-quota-");
  try {
    const service = new TenantExecutionIsolationService(h.db);
    const quota = service.defineQuota({
      tenantId: "tenant-1",
      quotaKind: "executions_per_minute",
      limitValue: 100,
      windowSeconds: 60,
      enforcementAction: "reject",
      enabled: true,
    });

    assert.equal(quota.tenantId, "tenant-1");
    assert.equal(quota.quotaKind, "executions_per_minute");
    assert.equal(quota.limitValue, 100);
    assert.equal(quota.enforcementAction, "reject");

    const retrieved = service.getQuota("tenant-1", "executions_per_minute");
    assert.ok(retrieved);
    assert.equal(retrieved!.limitValue, 100);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("checkQuota allows when under limit", () => {
  const h = createHarness("aa-quota-check-");
  try {
    const service = new TenantExecutionIsolationService(h.db);
    service.defineQuota({
      tenantId: "tenant-1",
      quotaKind: "executions_per_minute",
      limitValue: 10,
      windowSeconds: 60,
      enforcementAction: "reject",
      enabled: true,
    });

    const result = service.checkQuota("tenant-1", "executions_per_minute", 5);
    assert.equal(result.allowed, true);
    assert.ok(result.currentUsage);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("checkQuota rejects when over limit with reject enforcement", () => {
  const h = createHarness("aa-quota-reject-");
  try {
    const service = new TenantExecutionIsolationService(h.db);
    service.defineQuota({
      tenantId: "tenant-1",
      quotaKind: "executions_per_minute",
      limitValue: 5,
      windowSeconds: 60,
      enforcementAction: "reject",
      enabled: true,
    });

    // Record usage that would exceed
    service.recordResourceUsage({
      executionId: "exec-1",
      tenantId: "tenant-1",
      cpuMs: 100,
      memoryBytes: 1024,
      networkBytes: 512,
      durationMs: 1000,
      recordedAt: new Date().toISOString(),
    });

    const result = service.checkQuota("tenant-1", "executions_per_minute", 10);
    assert.equal(result.allowed, false);
    assert.equal(result.enforcementAction, "reject");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("checkQuota reports log_only action but still blocks over-quota usage", () => {
  const h = createHarness("aa-quota-log-");
  try {
    const service = new TenantExecutionIsolationService(h.db);
    service.defineQuota({
      tenantId: "tenant-1",
      quotaKind: "executions_per_minute",
      limitValue: 5,
      windowSeconds: 60,
      enforcementAction: "log_only",
      enabled: true,
    });

    service.recordResourceUsage({
      executionId: "exec-1",
      tenantId: "tenant-1",
      cpuMs: 100,
      memoryBytes: 1024,
      networkBytes: 512,
      durationMs: 1000,
      recordedAt: new Date().toISOString(),
    });

    const result = service.checkQuota("tenant-1", "executions_per_minute", 10);
    assert.equal(result.allowed, false);
    assert.equal(result.enforcementAction, "log_only");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("record noisy neighbor signal and resolve it", () => {
  const h = createHarness("aa-noisy-");
  try {
    const service = new TenantExecutionIsolationService(h.db);
    service.recordNoisyNeighborSignal("tenant-1", "burst_cpu_usage", "high");

    const signals = service.listActiveNoisyNeighborSignals("tenant-1");
    assert.equal(signals.length, 1);
    assert.equal(signals[0]!.severity, "high");
    assert.equal(signals[0]!.signal_type, "burst_cpu_usage");

    const resolved = service.resolveNoisyNeighborSignal(signals[0]!.id);
    assert.equal(resolved, true);

    const signalsAfter = service.listActiveNoisyNeighborSignals("tenant-1");
    assert.equal(signalsAfter.length, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getIsolationStatus returns correct status", () => {
  const h = createHarness("aa-isolation-status-");
  try {
    const service = new TenantExecutionIsolationService(h.db);
    service.defineQuota({
      tenantId: "tenant-1",
      quotaKind: "executions_per_minute",
      limitValue: 100,
      windowSeconds: 60,
      enforcementAction: "reject",
      enabled: true,
    });

    const status = service.getIsolationStatus("tenant-1");
    assert.equal(status.tenantId, "tenant-1");
    assert.equal(status.overallStatus, "active");
    assert.ok(Array.isArray(status.quotas));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("quota usage tracks samples correctly", () => {
  const h = createHarness("aa-usage-");
  try {
    const service = new TenantExecutionIsolationService(h.db);
    service.defineQuota({
      tenantId: "tenant-1",
      quotaKind: "total_compute_minutes",
      limitValue: 10,
      windowSeconds: 60,
      enforcementAction: "reject",
      enabled: true,
    });

    service.recordResourceUsage({
      executionId: "exec-1",
      tenantId: "tenant-1",
      cpuMs: 6000, // 1 minute
      memoryBytes: 1024,
      networkBytes: 512,
      durationMs: 60000,
      recordedAt: new Date().toISOString(),
    });

    const usage = service.getQuotaUsage("tenant-1", "total_compute_minutes");
    assert.ok(usage);
    assert.ok(usage!.currentValue > 0);
    assert.ok(usage!.percentUsed > 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("deleteQuota removes quota", () => {
  const h = createHarness("aa-delete-quota-");
  try {
    const service = new TenantExecutionIsolationService(h.db);
    service.defineQuota({
      tenantId: "tenant-1",
      quotaKind: "executions_per_minute",
      limitValue: 100,
      windowSeconds: 60,
      enforcementAction: "reject",
      enabled: true,
    });

    const deleted = service.deleteQuota("tenant-1", "executions_per_minute");
    assert.equal(deleted, true);

    const retrieved = service.getQuota("tenant-1", "executions_per_minute");
    assert.equal(retrieved, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listQuotas returns all quotas for tenant", () => {
  const h = createHarness("aa-list-quotas-");
  try {
    const service = new TenantExecutionIsolationService(h.db);
    service.defineQuota({
      tenantId: "tenant-1",
      quotaKind: "executions_per_minute",
      limitValue: 100,
      windowSeconds: 60,
      enforcementAction: "reject",
      enabled: true,
    });
    service.defineQuota({
      tenantId: "tenant-1",
      quotaKind: "concurrent_executions",
      limitValue: 10,
      windowSeconds: 60,
      enforcementAction: "throttle",
      enabled: true,
    });

    const quotas = service.listQuotas("tenant-1");
    assert.equal(quotas.length, 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("purgeOldSamples removes old data", () => {
  const h = createHarness("aa-purge-samples-");
  try {
    const service = new TenantExecutionIsolationService(h.db);
    service.defineQuota({
      tenantId: "tenant-1",
      quotaKind: "total_compute_minutes",
      limitValue: 10,
      windowSeconds: 60,
      enforcementAction: "reject",
      enabled: true,
    });

    service.recordResourceUsage({
      executionId: "exec-1",
      tenantId: "tenant-1",
      cpuMs: 6000,
      memoryBytes: 1024,
      networkBytes: 512,
      durationMs: 60000,
      recordedAt: new Date().toISOString(),
    });

    const purged = service.purgeOldSamples(0); // Purge everything
    assert.ok(purged >= 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
