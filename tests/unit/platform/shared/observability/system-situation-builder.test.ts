import assert from "node:assert/strict";
import test from "node:test";

import { SystemSituationBuilder } from "../../../../../src/platform/shared/observability/system-situation-builder.js";

test("SystemSituationBuilder falls back to process memory without HealthService", () => {
  const builder = new SystemSituationBuilder({});
  const situation = builder.build();

  assert.strictEqual(situation.healthStatus, "ok");
  assert.strictEqual(situation.providerHealth.status, "healthy");
  assert.strictEqual(situation.providerHealth.successRate, 1);
  assert.strictEqual(situation.providerHealth.recentCalls, 0);
  assert.ok(situation.resourceUtilization.memoryRssMb >= 0);
  assert.strictEqual(situation.resourceUtilization.activeProcesses, 0);
  assert.deepStrictEqual(situation.queueBacklog, { size: 0, degraded: false });
  assert.deepStrictEqual(situation.eventBusBacklog, { tier1PendingAcks: 0 });
  assert.deepStrictEqual(situation.findings, []);
  assert.ok(situation.observedAt > 0);
});

test("SystemSituationBuilder falls back to process memory with null HealthService", () => {
  const builder = new SystemSituationBuilder({ healthService: null });
  const situation = builder.build();

  assert.strictEqual(situation.healthStatus, "ok");
  assert.deepStrictEqual(situation.findings, []);
});
