import assert from "node:assert/strict";
import test from "node:test";

import { scoreSystemHealth } from "../../../../../src/interaction/dashboard/health-scorer/index.js";
import type { DashboardSystemSituation } from "../../../../../src/interaction/dashboard/index.js";

function createSystem(
  overrides: Partial<DashboardSystemSituation> & {
    queueDepth?: number;
    degraded?: boolean;
  } = {},
): DashboardSystemSituation {
  return {
    healthStatus: "ok",
    providerHealth: { status: "healthy", successRate: 1 },
    queueBacklog: new Set<string>(),
    queueDepth: 0,
    degraded: false,
    findings: [],
    ...overrides,
  };
}

test("scoreSystemHealth returns 100 for ok status with no backlog or findings", () => {
  const system = createSystem();

  assert.equal(scoreSystemHealth(system), 100);
});

test("scoreSystemHealth returns 80 for degraded status", () => {
  const system = createSystem({
    healthStatus: "degraded",
    providerHealth: { status: "degraded", successRate: 0.9 },
  });

  assert.equal(scoreSystemHealth(system), 80);
});

test("scoreSystemHealth returns 60 for overloaded status with no backlog", () => {
  const system = createSystem({
    healthStatus: "overloaded",
    providerHealth: { status: "degraded", successRate: 0.85 },
  });

  // Base is 60 (overloaded), no backlog penalty
  assert.equal(scoreSystemHealth(system), 60);
});

test("scoreSystemHealth returns 30 for unhealthy status with no backlog", () => {
  const system = createSystem({
    healthStatus: "unhealthy",
    providerHealth: { status: "failed", successRate: 0.5 },
  });

  // Base is 30 (unhealthy), no backlog penalty
  assert.equal(scoreSystemHealth(system), 30);
});

test("scoreSystemHealth applies backlog penalty (max 30)", () => {
  const baseSystem = createSystem();

  const withBacklog: DashboardSystemSituation = {
    ...baseSystem,
    queueDepth: 50,
    degraded: true,
  };

  // Base is 100, backlog of 50 should apply 30 penalty (capped)
  assert.equal(scoreSystemHealth(withBacklog), 70);
});

test("scoreSystemHealth applies findings penalty (max 20)", () => {
  const baseSystem = createSystem();

  // 5 findings * 5 = 25, capped at 20
  const withFindings: DashboardSystemSituation = {
    ...baseSystem,
    findings: ["finding1", "finding2", "finding3", "finding4", "finding5"],
  };

  // Base 100 - 20 (capped findings) = 80
  assert.equal(scoreSystemHealth(withFindings), 80);
});

test("scoreSystemHealth returns 0 when penalties exceed base", () => {
  const system = createSystem({
    healthStatus: "unhealthy",
    providerHealth: { status: "failed", successRate: 0.3 },
    queueDepth: 100,
    degraded: true,
    findings: ["f1", "f2", "f3", "f4", "f5", "f6"],
  });

  // Base 30 - 30 (backlog) - 20 (findings, capped) = -20, clamped to 0
  assert.equal(scoreSystemHealth(system), 0);
});

test("scoreSystemHealth handles minimal system state", () => {
  const system = createSystem();

  assert.equal(scoreSystemHealth(system), 100);
});
