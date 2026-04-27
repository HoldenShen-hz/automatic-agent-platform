/**
 * Golden Test: System Situation Model
 *
 * Verifies system situation schema produces consistent JSON output
 * for system-level health and resource state.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SystemSituationSchema, parseSystemSituation, type SystemSituation } from "../../src/platform/shared/observability/system-situation-model.js";

test("golden: system situation schema validates correct input", () => {
  const input: SystemSituation = {
    healthStatus: "ok",
    providerHealth: {
      status: "healthy",
      successRate: 0.99,
      recentCalls: 100,
    },
    resourceUtilization: {
      memoryRssMb: 512,
      cpuPercent: 45.5,
      activeProcesses: 8,
    },
    queueBacklog: {
      size: 10,
      degraded: false,
    },
    eventBusBacklog: {
      tier1PendingAcks: 5,
    },
    findings: [],
    observedAt: 1714123456789,
  };

  const result = SystemSituationSchema.parse(input);

  assert.equal(result.healthStatus, "ok");
  assert.equal(result.providerHealth.status, "healthy");
  assert.equal(result.resourceUtilization.memoryRssMb, 512);
  assert.equal(result.queueBacklog.size, 10);
});

test("golden: system situation provides default values", () => {
  const minimalInput = {
    healthStatus: "ok",
    observedAt: 1714123456789,
  };

  const result = SystemSituationSchema.parse(minimalInput);

  assert.equal(result.providerHealth.status, "healthy");
  assert.equal(result.providerHealth.successRate, 1);
  assert.equal(result.providerHealth.recentCalls, 0);
  assert.equal(result.resourceUtilization.memoryRssMb, 0);
  assert.equal(result.resourceUtilization.activeProcesses, 0);
  assert.equal(result.queueBacklog.size, 0);
  assert.equal(result.queueBacklog.degraded, false);
  assert.deepEqual(result.findings, []);
});

test("golden: system situation parseSystemSituation helper works", () => {
  const input = {
    healthStatus: "degraded",
    observedAt: 1714123456789,
  };

  const result = parseSystemSituation(input);

  assert.equal(result.healthStatus, "degraded");
  assert.ok(result.providerHealth, "Should have provider health with defaults");
});

test("golden: system situation JSON serialization is valid", () => {
  const input: SystemSituation = {
    healthStatus: "ok",
    providerHealth: {
      status: "degraded",
      successRate: 0.85,
      recentCalls: 50,
    },
    resourceUtilization: {
      memoryRssMb: 1024,
      activeProcesses: 12,
    },
    queueBacklog: {
      size: 100,
      degraded: true,
    },
    eventBusBacklog: {
      tier1PendingAcks: 25,
    },
    findings: ["memory_pressure", "high_latency"],
    observedAt: 1714123456789,
  };

  const json = JSON.stringify(input);
  const parsed = JSON.parse(json);
  const result = SystemSituationSchema.parse(parsed);

  assert.equal(result.healthStatus, "ok");
  assert.equal(result.providerHealth.status, "degraded");
  assert.equal(result.resourceUtilization.memoryRssMb, 1024);
  assert.equal(result.queueBacklog.degraded, true);
  assert.deepEqual(result.findings, ["memory_pressure", "high_latency"]);
});

test("golden: system situation all health statuses are valid", () => {
  const statuses = ["ok", "degraded", "overloaded", "unhealthy"] as const;

  for (const status of statuses) {
    const input = {
      healthStatus: status,
      observedAt: 1714123456789,
    };

    const result = SystemSituationSchema.parse(input);
    assert.equal(result.healthStatus, status, `Status ${status} should be valid`);
  }
});

test("golden: system situation provider health statuses are valid", () => {
  const statuses = ["healthy", "degraded", "failed"] as const;

  for (const status of statuses) {
    const input = {
      healthStatus: "ok",
      providerHealth: {
        status,
        successRate: 0.9,
        recentCalls: 10,
      },
      observedAt: 1714123456789,
    };

    const result = SystemSituationSchema.parse(input);
    assert.equal(result.providerHealth.status, status, `Provider status ${status} should be valid`);
  }
});
