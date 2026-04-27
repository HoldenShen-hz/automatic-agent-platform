/**
 * Additional edge case tests for scoreSystemHealth
 */

import assert from "node:assert/strict";
import test from "node:test";
import { scoreSystemHealth } from "../../../../../src/interaction/dashboard/health-scorer/index.js";
import type { SystemSituation } from "../../../../../src/interaction/dashboard/health-scorer/index.js";

function makeSystemSituation(overrides: Partial<SystemSituation> = {}): SystemSituation {
  return {
    situationId: "sit-1",
    tenantId: "tenant-1",
    observedAt: new Date().toISOString(),
    healthStatus: "ok",
    activeExecutions: 0,
    queueBacklog: new Set(),
    findings: [],
    ...overrides,
  };
}

test("scoreSystemHealth ok status returns 100 before penalties", () => {
  const system = makeSystemSituation({ healthStatus: "ok" });
  const score = scoreSystemHealth(system);
  assert.equal(score, 100);
});

test("scoreSystemHealth handles queueBacklog of size 1", () => {
  const system = makeSystemSituation({
    healthStatus: "ok",
    queueBacklog: new Set(["item1"]),
  });
  const score = scoreSystemHealth(system);
  assert.equal(score, 99);
});

test("scoreSystemHealth handles queueBacklog of size 30 exactly", () => {
  const system = makeSystemSituation({
    healthStatus: "ok",
    queueBacklog: new Set(Array.from({ length: 30 }, (_, i) => `item${i}`)),
  });
  const score = scoreSystemHealth(system);
  assert.equal(score, 70); // 100 - 30 = 70
});

test("scoreSystemHealth handles queueBacklog larger than 30", () => {
  const system = makeSystemSituation({
    healthStatus: "ok",
    queueBacklog: new Set(Array.from({ length: 100 }, (_, i) => `item${i}`)),
  });
  const score = scoreSystemHealth(system);
  // backlog penalty capped at 30
  assert.equal(score, 70);
});

test("scoreSystemHealth handles findings of size 1", () => {
  const system = makeSystemSituation({
    healthStatus: "ok",
    findings: [{ checkId: "f1", severity: "p1", entityRef: "e1", summary: "s1" }],
  });
  const score = scoreSystemHealth(system);
  assert.equal(score, 95); // 100 - 5 = 95
});

test("scoreSystemHealth handles findings of size 4", () => {
  const system = makeSystemSituation({
    healthStatus: "ok",
    findings: [
      { checkId: "f1", severity: "p1", entityRef: "e1", summary: "s1" },
      { checkId: "f2", severity: "p1", entityRef: "e2", summary: "s2" },
      { checkId: "f3", severity: "p1", entityRef: "e3", summary: "s3" },
      { checkId: "f4", severity: "p1", entityRef: "e4", summary: "s4" },
    ],
  });
  const score = scoreSystemHealth(system);
  // 4 findings * 5 = 20, capped at 20
  assert.equal(score, 80);
});

test("scoreSystemHealth combined penalties do not go below 0", () => {
  const system = makeSystemSituation({
    healthStatus: "critical",
    queueBacklog: new Set(Array.from({ length: 50 }, (_, i) => `item${i}`)),
    findings: Array.from({ length: 10 }, (_, i) => ({
      checkId: `f${i}`,
      severity: "p1" as const,
      entityRef: `e${i}`,
      summary: `s${i}`,
    })),
  });
  const score = scoreSystemHealth(system);
  // 30 (critical base) - 30 (backlog cap) - 20 (finding cap) = -20, capped at 0
  assert.equal(score, 0);
});

test("scoreSystemHealth degraded status with no backlog or findings", () => {
  const system = makeSystemSituation({ healthStatus: "degraded" });
  const score = scoreSystemHealth(system);
  assert.equal(score, 80);
});

test("scoreSystemHealth overloaded status with no backlog or findings", () => {
  const system = makeSystemSituation({ healthStatus: "overloaded" });
  const score = scoreSystemHealth(system);
  assert.equal(score, 60);
});

test("scoreSystemHealth critical status with no backlog or findings", () => {
  const system = makeSystemSituation({ healthStatus: "critical" });
  const score = scoreSystemHealth(system);
  assert.equal(score, 30);
});

test("scoreSystemHealth does not mutate original Set", () => {
  const backlog = new Set(["item1", "item2"]);
  const system = makeSystemSituation({
    healthStatus: "ok",
    queueBacklog: backlog,
  });
  scoreSystemHealth(system);
  assert.equal(backlog.size, 2);
});

test("scoreSystemHealth does not mutate original findings array", () => {
  const findings = [
    { checkId: "f1", severity: "p1" as const, entityRef: "e1", summary: "s1" },
  ];
  const system = makeSystemSituation({
    healthStatus: "ok",
    findings,
  });
  scoreSystemHealth(system);
  assert.equal(findings.length, 1);
});
