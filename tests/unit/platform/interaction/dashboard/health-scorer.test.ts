import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { scoreSystemHealth } from "../../../../../../src/interaction/dashboard/health-scorer/index.js";
import type { SystemSituation } from "../../../../../../src/platform/shared/observability/system-situation-model.js";

function mockSystemSituation(overrides: Partial<SystemSituation> = {}): SystemSituation {
  return {
    healthStatus: "ok",
    providerHealth: { status: "healthy", successRate: 1, recentCalls: 0 },
    resourceUtilization: { memoryRssMb: 0, activeProcesses: 0 },
    queueBacklog: { size: 0, degraded: false },
    eventBusBacklog: { tier1PendingAcks: 0 },
    findings: [],
    observedAt: 0,
    ...overrides,
  };
}

test("scoreSystemHealth returns 100 for ok healthStatus", () => {
  const system = mockSystemSituation({ healthStatus: "ok" });

  const score = scoreSystemHealth(system);

  assert.strictEqual(score, 100);
});

test("scoreSystemHealth returns 80 for degraded healthStatus", () => {
  const system = mockSystemSituation({ healthStatus: "degraded" });

  const score = scoreSystemHealth(system);

  assert.strictEqual(score, 80);
});

test("scoreSystemHealth returns 60 for overloaded healthStatus", () => {
  const system = mockSystemSituation({ healthStatus: "overloaded" });

  const score = scoreSystemHealth(system);

  assert.strictEqual(score, 60);
});

test("scoreSystemHealth returns 30 for unhealthy healthStatus", () => {
  const system = mockSystemSituation({ healthStatus: "unhealthy" });

  const score = scoreSystemHealth(system);

  assert.strictEqual(score, 30);
});

test("scoreSystemHealth applies backlog penalty up to 30", () => {
  const systemOk = mockSystemSituation({ healthStatus: "ok", queueBacklog: { size: 10, degraded: false } });

  const score = scoreSystemHealth(systemOk);

  assert.ok(score < 100);
  assert.strictEqual(score, 70);
});

test("scoreSystemHealth caps backlog penalty at 30", () => {
  const system = mockSystemSituation({ healthStatus: "ok", queueBacklog: { size: 100, degraded: false } });

  const score = scoreSystemHealth(system);

  assert.strictEqual(score, 70);
});

test("scoreSystemHealth applies findings penalty up to 20", () => {
  const system = mockSystemSituation({ healthStatus: "ok", findings: ["finding-1", "finding-2", "finding-3"] });

  const score = scoreSystemHealth(system);

  assert.ok(score < 100);
  assert.strictEqual(score, 85);
});

test("scoreSystemHealth caps findings penalty at 20", () => {
  const system = mockSystemSituation({ healthStatus: "ok", findings: Array.from({ length: 10 }, (_, i) => `finding-${i}`) });

  const score = scoreSystemHealth(system);

  assert.strictEqual(score, 70);
});

test("scoreSystemHealth combines both penalties", () => {
  const system = mockSystemSituation({
    healthStatus: "ok",
    queueBacklog: { size: 5, degraded: false },
    findings: ["finding-1", "finding-2"],
  });

  const score = scoreSystemHealth(system);

  assert.strictEqual(score, 65);
});

test("scoreSystemHealth returns 0 at minimum", () => {
  const system = mockSystemSituation({
    healthStatus: "unhealthy",
    queueBacklog: { size: 100, degraded: true },
    findings: Array.from({ length: 10 }, (_, i) => `finding-${i}`),
  });

  const score = scoreSystemHealth(system);

  assert.strictEqual(score, 0);
});

test("scoreSystemHealth handles empty findings", () => {
  const system = mockSystemSituation({ healthStatus: "degraded", findings: [] });

  const score = scoreSystemHealth(system);

  assert.strictEqual(score, 80);
});

test("scoreSystemHealth handles zero backlog", () => {
  const system = mockSystemSituation({ healthStatus: "ok", queueBacklog: { size: 0, degraded: false } });

  const score = scoreSystemHealth(system);

  assert.strictEqual(score, 100);
});

test("scoreSystemHealth with ok status and no penalties returns 100", () => {
  const system = mockSystemSituation({
    healthStatus: "ok",
    queueBacklog: { size: 0, degraded: false },
    findings: [],
  });

  const score = scoreSystemHealth(system);

  assert.strictEqual(score, 100);
});

test("scoreSystemHealth degraded with zero findings and backlog", () => {
  const system = mockSystemSituation({
    healthStatus: "degraded",
    queueBacklog: { size: 0, degraded: false },
    findings: [],
  });

  const score = scoreSystemHealth(system);

  assert.strictEqual(score, 80);
});

test("scoreSystemHealth overloaded with small penalty still returns positive", () => {
  const system = mockSystemSituation({
    healthStatus: "overloaded",
    queueBacklog: { size: 1, degraded: false },
    findings: [],
  });

  const score = scoreSystemHealth(system);

  assert.ok(score > 0);
  assert.strictEqual(score, 59);
});

test("scoreSystemHealth unhappy path with max penalties", () => {
  const system = mockSystemSituation({
    healthStatus: "unhealthy",
    queueBacklog: { size: 50, degraded: true },
    findings: ["a", "b", "c", "d", "e"],
  });

  const score = scoreSystemHealth(system);

  assert.strictEqual(score, 0);
});

test("scoreSystemHealth single finding penalty calculation", () => {
  const system = mockSystemSituation({
    healthStatus: "ok",
    queueBacklog: { size: 0, degraded: false },
    findings: ["single-finding"],
  });

  const score = scoreSystemHealth(system);

  assert.strictEqual(score, 95);
});

test("scoreSystemHealth two findings penalty calculation", () => {
  const system = mockSystemSituation({
    healthStatus: "ok",
    queueBacklog: { size: 0, degraded: false },
    findings: ["finding-1", "finding-2"],
  });

  const score = scoreSystemHealth(system);

  assert.strictEqual(score, 90);
});

test("scoreSystemHealth backlog of exactly 3 applies 15 point penalty", () => {
  const system = mockSystemSituation({
    healthStatus: "ok",
    queueBacklog: { size: 3, degraded: false },
    findings: [],
  });

  const score = scoreSystemHealth(system);

  assert.strictEqual(score, 85);
});