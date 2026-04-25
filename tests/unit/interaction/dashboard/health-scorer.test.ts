import assert from "node:assert/strict";
import test from "node:test";

import { scoreSystemHealth } from "../../../../src/interaction/dashboard/health-scorer/index.js";
import type { SystemSituation } from "../../../../src/platform/shared/observability/system-situation-model.js";

test("scoreSystemHealth returns 100 for ok status with empty backlog", () => {
  const system: SystemSituation = {
    healthStatus: "ok",
    providerHealth: { status: "healthy", successRate: 1, recentCalls: 0 },
    resourceUtilization: { memoryRssMb: 512, activeProcesses: 4 },
    queueBacklog: { size: 0, degraded: false },
    eventBusBacklog: { tier1PendingAcks: 0 },
    findings: [],
    observedAt: Date.now(),
  };

  const score = scoreSystemHealth(system);
  assert.equal(score, 100);
});

test("scoreSystemHealth returns 80 for degraded status", () => {
  const system: SystemSituation = {
    healthStatus: "degraded",
    providerHealth: { status: "degraded", successRate: 0.9, recentCalls: 10 },
    resourceUtilization: { memoryRssMb: 1024, activeProcesses: 8 },
    queueBacklog: { size: 0, degraded: false },
    eventBusBacklog: { tier1PendingAcks: 3 },
    findings: [],
    observedAt: Date.now(),
  };

  const score = scoreSystemHealth(system);
  assert.equal(score, 80);
});

test("scoreSystemHealth returns 60 for overloaded status", () => {
  const system: SystemSituation = {
    healthStatus: "overloaded",
    providerHealth: { status: "degraded", successRate: 0.85, recentCalls: 20 },
    resourceUtilization: { memoryRssMb: 2048, cpuPercent: 90, activeProcesses: 16 },
    queueBacklog: { size: 0, degraded: false },
    eventBusBacklog: { tier1PendingAcks: 10 },
    findings: [],
    observedAt: Date.now(),
  };

  const score = scoreSystemHealth(system);
  assert.equal(score, 60);
});

test("scoreSystemHealth returns 30 for unhealthy status", () => {
  const system: SystemSituation = {
    healthStatus: "unhealthy",
    providerHealth: { status: "failed", successRate: 0.5, recentCalls: 100 },
    resourceUtilization: { memoryRssMb: 4096, cpuPercent: 95, activeProcesses: 32 },
    queueBacklog: { size: 0, degraded: false },
    eventBusBacklog: { tier1PendingAcks: 50 },
    findings: [],
    observedAt: Date.now(),
  };

  const score = scoreSystemHealth(system);
  assert.equal(score, 30);
});

test("scoreSystemHealth applies backlog penalty up to 30", () => {
  const base: SystemSituation = {
    healthStatus: "ok",
    providerHealth: { status: "healthy", successRate: 1, recentCalls: 0 },
    resourceUtilization: { memoryRssMb: 512, activeProcesses: 4 },
    queueBacklog: { size: 100, degraded: true },
    eventBusBacklog: { tier1PendingAcks: 0 },
    findings: [],
    observedAt: Date.now(),
  };

  const score = scoreSystemHealth(base);
  assert.ok(score <= 70);
  assert.ok(score >= 0);
});

test("scoreSystemHealth backlog penalty caps at size 30", () => {
  const smallBacklog: SystemSituation = {
    healthStatus: "ok",
    providerHealth: { status: "healthy", successRate: 1, recentCalls: 0 },
    resourceUtilization: { memoryRssMb: 512, activeProcesses: 4 },
    queueBacklog: { size: 30, degraded: true },
    eventBusBacklog: { tier1PendingAcks: 0 },
    findings: [],
    observedAt: Date.now(),
  };

  const largeBacklog: SystemSituation = {
    healthStatus: "ok",
    providerHealth: { status: "healthy", successRate: 1, recentCalls: 0 },
    resourceUtilization: { memoryRssMb: 512, activeProcesses: 4 },
    queueBacklog: { size: 100, degraded: true },
    eventBusBacklog: { tier1PendingAcks: 0 },
    findings: [],
    observedAt: Date.now(),
  };

  const scoreSmall = scoreSystemHealth(smallBacklog);
  const scoreLarge = scoreSystemHealth(largeBacklog);
  assert.equal(scoreSmall, scoreLarge);
});

test("scoreSystemHealth applies findings penalty per finding", () => {
  const noFindings: SystemSituation = {
    healthStatus: "ok",
    providerHealth: { status: "healthy", successRate: 1, recentCalls: 0 },
    resourceUtilization: { memoryRssMb: 512, activeProcesses: 4 },
    queueBacklog: { size: 0, degraded: false },
    eventBusBacklog: { tier1PendingAcks: 0 },
    findings: [],
    observedAt: Date.now(),
  };

  const withFindings: SystemSituation = {
    ...noFindings,
    findings: ["finding1", "finding2", "finding3"],
  };

  const scoreNoFindings = scoreSystemHealth(noFindings);
  const scoreWithFindings = scoreSystemHealth(withFindings);

  assert.equal(scoreNoFindings - scoreWithFindings, 15);
});

test("scoreSystemHealth findings penalty caps at 20", () => {
  const fewFindings: SystemSituation = {
    healthStatus: "ok",
    providerHealth: { status: "healthy", successRate: 1, recentCalls: 0 },
    resourceUtilization: { memoryRssMb: 512, activeProcesses: 4 },
    queueBacklog: { size: 0, degraded: false },
    eventBusBacklog: { tier1PendingAcks: 0 },
    findings: ["f1", "f2", "f3", "f4"],
    observedAt: Date.now(),
  };

  const manyFindings: SystemSituation = {
    healthStatus: "ok",
    providerHealth: { status: "healthy", successRate: 1, recentCalls: 0 },
    resourceUtilization: { memoryRssMb: 512, activeProcesses: 4 },
    queueBacklog: { size: 0, degraded: false },
    eventBusBacklog: { tier1PendingAcks: 0 },
    findings: ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8"],
    observedAt: Date.now(),
  };

  const scoreFew = scoreSystemHealth(fewFindings);
  const scoreMany = scoreSystemHealth(manyFindings);
  assert.equal(scoreFew, scoreMany);
});

test("scoreSystemHealth floor is 0 when penalties exceed base", () => {
  const system: SystemSituation = {
    healthStatus: "unhealthy",
    providerHealth: { status: "failed", successRate: 0.3, recentCalls: 500 },
    resourceUtilization: { memoryRssMb: 8192, cpuPercent: 99, activeProcesses: 64 },
    queueBacklog: { size: 500, degraded: true },
    eventBusBacklog: { tier1PendingAcks: 200 },
    findings: ["f1", "f2", "f3", "f4", "f5"],
    observedAt: Date.now(),
  };

  const score = scoreSystemHealth(system);
  assert.equal(score, 0);
});

test("scoreSystemHealth combines backlog and findings penalties", () => {
  const system: SystemSituation = {
    healthStatus: "ok",
    providerHealth: { status: "healthy", successRate: 1, recentCalls: 0 },
    resourceUtilization: { memoryRssMb: 512, activeProcesses: 4 },
    queueBacklog: { size: 10, degraded: true },
    eventBusBacklog: { tier1PendingAcks: 0 },
    findings: ["f1", "f2"],
    observedAt: Date.now(),
  };

  const score = scoreSystemHealth(system);
  assert.equal(score, 100 - 10 - 10);
});

test("scoreSystemHealth returns exact 100 when no penalties apply", () => {
  const system: SystemSituation = {
    healthStatus: "ok",
    providerHealth: { status: "healthy", successRate: 1, recentCalls: 0 },
    resourceUtilization: { memoryRssMb: 512, activeProcesses: 4 },
    queueBacklog: { size: 0, degraded: false },
    eventBusBacklog: { tier1PendingAcks: 0 },
    findings: [],
    observedAt: Date.now(),
  };

  assert.equal(scoreSystemHealth(system), 100);
});

test("scoreSystemHealth never returns negative", () => {
  const system: SystemSituation = {
    healthStatus: "unhealthy",
    providerHealth: { status: "failed", successRate: 0, recentCalls: 1000 },
    resourceUtilization: { memoryRssMb: 16384, cpuPercent: 100, activeProcesses: 128 },
    queueBacklog: { size: 1000, degraded: true },
    eventBusBacklog: { tier1PendingAcks: 1000 },
    findings: ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10"],
    observedAt: Date.now(),
  };

  const score = scoreSystemHealth(system);
  assert.ok(score >= 0);
});

test("scoreSystemHealth each finding reduces score by 5", () => {
  const base: SystemSituation = {
    healthStatus: "ok",
    providerHealth: { status: "healthy", successRate: 1, recentCalls: 0 },
    resourceUtilization: { memoryRssMb: 512, activeProcesses: 4 },
    queueBacklog: { size: 0, degraded: false },
    eventBusBacklog: { tier1PendingAcks: 0 },
    findings: [],
    observedAt: Date.now(),
  };

  const oneFinding = scoreSystemHealth({ ...base, findings: ["f1"] });
  const twoFindings = scoreSystemHealth({ ...base, findings: ["f1", "f2"] });
  const threeFindings = scoreSystemHealth({ ...base, findings: ["f1", "f2", "f3"] });

  assert.equal(oneFinding, 95);
  assert.equal(twoFindings, 90);
  assert.equal(threeFindings, 85);
});

test("scoreSystemHealth each backlog item reduces score by 1 up to 30", () => {
  const base: SystemSituation = {
    healthStatus: "ok",
    providerHealth: { status: "healthy", successRate: 1, recentCalls: 0 },
    resourceUtilization: { memoryRssMb: 512, activeProcesses: 4 },
    queueBacklog: { size: 0, degraded: false },
    eventBusBacklog: { tier1PendingAcks: 0 },
    findings: [],
    observedAt: Date.now(),
  };

  const fiveBacklog = scoreSystemHealth({ ...base, queueBacklog: { size: 5, degraded: true } });
  const tenBacklog = scoreSystemHealth({ ...base, queueBacklog: { size: 10, degraded: true } });
  const fifteenBacklog = scoreSystemHealth({ ...base, queueBacklog: { size: 15, degraded: true } });

  assert.equal(fiveBacklog, 95);
  assert.equal(tenBacklog, 90);
  assert.equal(fifteenBacklog, 85);
});
