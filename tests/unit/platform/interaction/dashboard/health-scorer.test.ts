import test from "node:test";
import { strict as assert } from "node:assert/strict";
import {
  buildStructuredHealthScore,
  scoreSystemHealth,
} from "../../../../../src/interaction/dashboard/health-scorer/index.js";
import type { SystemSituation } from "../../../../../src/platform/shared/observability/system-situation-model.js";

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

test("scoreSystemHealth uses composite weighting rather than raw status only", () => {
  const pristine = mockSystemSituation({ healthStatus: "ok" });
  const stressed = mockSystemSituation({
    healthStatus: "ok",
    providerHealth: { status: "degraded", successRate: 0.7, recentCalls: 25 },
    queueBacklog: { size: 8, degraded: true },
    findings: ["finding-1", "finding-2", "finding-3"],
  });

  assert.equal(scoreSystemHealth(pristine), 100);
  assert.equal(scoreSystemHealth(stressed), 72);
});

test("scoreSystemHealth penalizes provider failures more than backlog alone", () => {
  const backlogOnly = mockSystemSituation({
    healthStatus: "degraded",
    queueBacklog: { size: 5, degraded: false },
  });
  const providerFailure = mockSystemSituation({
    healthStatus: "degraded",
    providerHealth: { status: "failed", successRate: 0.1, recentCalls: 12 },
    queueBacklog: { size: 5, degraded: false },
  });

  assert.equal(scoreSystemHealth(backlogOnly), 85);
  assert.equal(scoreSystemHealth(providerFailure), 61);
});

test("buildStructuredHealthScore derives latency and worker counters from queue pressure", () => {
  const score = buildStructuredHealthScore(mockSystemSituation({
    healthStatus: "overloaded",
    queueBacklog: { size: 6, degraded: true },
    findings: ["finding-1"],
  }));

  assert.equal(score.overall, 67);
  assert.equal(score.queueDepth, 6);
  assert.equal(score.p50LatencyMs, 132);
  assert.equal(score.p99LatencyMs, 500);
  assert.equal(score.activeWorkers, 1);
  assert.equal(score.budgetUtilizationPercent, 27);
});

test("buildStructuredHealthScore preserves low error rate for healthy systems", () => {
  const score = buildStructuredHealthScore(mockSystemSituation({
    healthStatus: "ok",
    providerHealth: { status: "healthy", successRate: 0.99, recentCalls: 50 },
    findings: [],
  }));

  assert.equal(score.overall, 100);
  assert.equal(score.errorRate, 1);
  assert.equal(score.uptime, 100);
});

test("scoreSystemHealth bottoms out near zero for compounded severe degradation", () => {
  const score = scoreSystemHealth(mockSystemSituation({
    healthStatus: "unhealthy",
    providerHealth: { status: "failed", successRate: 0, recentCalls: 100 },
    queueBacklog: { size: 100, degraded: true },
    findings: Array.from({ length: 10 }, (_, index) => `finding-${index}`),
  }));

  assert.equal(score, 17);
});
