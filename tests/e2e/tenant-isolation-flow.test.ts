import assert from "node:assert/strict";
import test from "node:test";

import {
  TENANT_ISOLATION_DDL,
  TenantExecutionIsolationService,
} from "../../src/platform/five-plane-control-plane/incident-control/tenant-execution-isolation-service.js";
import { createE2EHarness } from "../helpers/e2e-harness.js";

function prepareIsolationSchema(): ReturnType<typeof createE2EHarness> {
  const harness = createE2EHarness("aa-e2e-tenant-isolation-");
  harness.db.connection.exec(`
    DROP TABLE IF EXISTS tenant_quotas;
    DROP TABLE IF EXISTS quota_usage_samples;
    DROP TABLE IF EXISTS execution_resource_usage;
    DROP TABLE IF EXISTS noisy_neighbor_signals;
  `);
  harness.db.connection.exec(TENANT_ISOLATION_DDL);
  return harness;
}

test("E2E: tenant isolation blocks quota growth after compute minutes are exhausted", () => {
  const harness = prepareIsolationSchema();

  try {
    const service = new TenantExecutionIsolationService(harness.db);
    service.defineQuota({
      tenantId: "tenant-quota",
      quotaKind: "total_compute_minutes",
      limitValue: 5,
      windowSeconds: 3600,
      enforcementAction: "reject",
      enabled: true,
    });

    service.recordResourceUsage({
      executionId: "exec-quota-1",
      tenantId: "tenant-quota",
      cpuMs: 1_200,
      memoryBytes: 1024,
      networkBytes: 512,
      durationMs: 180_000,
      recordedAt: new Date().toISOString(),
    });
    service.recordResourceUsage({
      executionId: "exec-quota-2",
      tenantId: "tenant-quota",
      cpuMs: 1_800,
      memoryBytes: 2048,
      networkBytes: 256,
      durationMs: 180_000,
      recordedAt: new Date().toISOString(),
    });

    const usage = service.getQuotaUsage("tenant-quota", "total_compute_minutes");
    assert.ok(usage);
    assert.equal(usage?.currentValue, 6);
    assert.equal(usage?.status, "exceeded");

    const status = service.getIsolationStatus("tenant-quota");
    assert.equal(status.overallStatus, "quota_exceeded");
    assert.equal(status.activeExecutions, 2);
    assert.equal(status.quotas[0]?.status, "exceeded");
    assert.ok(status.blockedSince);

    const quotaCheck = service.checkQuota("tenant-quota", "total_compute_minutes", 1);
    assert.equal(quotaCheck.allowed, false);
    assert.equal(quotaCheck.enforcementAction, "reject");
  } finally {
    harness.cleanup();
  }
});

test("E2E: tenant isolation escalates and clears noisy-neighbor signals", () => {
  const harness = prepareIsolationSchema();

  try {
    const service = new TenantExecutionIsolationService(harness.db, {
      noisyNeighborThreshold: 50,
    });

    service.recordNoisyNeighborSignal("tenant-noisy", "cpu_starvation", "critical", {
      source: "scheduler",
    });
    service.recordNoisyNeighborSignal("tenant-noisy", "retry_storm", "high", {
      source: "dispatcher",
    });

    const activeSignals = service.listActiveNoisyNeighborSignals("tenant-noisy");
    assert.equal(activeSignals.length, 2);

    const noisyStatus = service.getIsolationStatus("tenant-noisy");
    assert.equal(noisyStatus.overallStatus, "noisy_neighbor_detected");
    assert.equal(noisyStatus.noisyNeighborScore, 50);
    assert.ok(noisyStatus.blockedSince);

    for (const signal of activeSignals) {
      assert.equal(service.resolveNoisyNeighborSignal(String(signal.id)), true);
    }

    const clearedStatus = service.getIsolationStatus("tenant-noisy");
    assert.equal(clearedStatus.overallStatus, "active");
    assert.equal(clearedStatus.noisyNeighborScore, 0);
    assert.equal(service.listActiveNoisyNeighborSignals("tenant-noisy").length, 0);
  } finally {
    harness.cleanup();
  }
});
