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

test("scoreSystemHealth returns 100 for ok status with no backlog", () => {
  const system = makeSystemSituation({ healthStatus: "ok" });

  const score = scoreSystemHealth(system);

  assert.equal(score, 100);
});

test("scoreSystemHealth returns 80 for degraded status", () => {
  const system = makeSystemSituation({ healthStatus: "degraded" });

  const score = scoreSystemHealth(system);

  assert.equal(score, 80);
});

test("scoreSystemHealth returns 60 for overloaded status", () => {
  const system = makeSystemSituation({ healthStatus: "overloaded" });

  const score = scoreSystemHealth(system);

  assert.equal(score, 60);
});

test("scoreSystemHealth returns 30 for critical status", () => {
  const system = makeSystemSituation({ healthStatus: "critical" });

  const score = scoreSystemHealth(system);

  assert.equal(score, 30);
});

test("scoreSystemHealth applies backlog penalty up to 30 points", () => {
  const system = makeSystemSituation({
    healthStatus: "ok",
    queueBacklog: new Set(["item1", "item2", "item3"]),
  });

  const score = scoreSystemHealth(system);

  assert.equal(score, 100 - 3); // backlogPenalty = min(30, 3) = 3
});

test("scoreSystemHealth caps backlog penalty at 30", () => {
  const system = makeSystemSituation({
    healthStatus: "ok",
    queueBacklog: new Set(Array.from({ length: 50 }, (_, i) => `item${i}`)),
  });

  const score = scoreSystemHealth(system);

  assert.equal(score, 100 - 30); // capped at 30
});

test("scoreSystemHealth applies finding penalty up to 20 points", () => {
  const system = makeSystemSituation({
    healthStatus: "ok",
    findings: [{ checkId: "f1", severity: "p1", entityRef: "e1", summary: "s1" }, { checkId: "f2", severity: "p1", entityRef: "e2", summary: "s2" }],
  });

  const score = scoreSystemHealth(system);

  assert.equal(score, 100 - 10); // findingPenalty = min(20, 2 * 5) = 10
});

test("scoreSystemHealth caps finding penalty at 20", () => {
  const system = makeSystemSituation({
    healthStatus: "ok",
    findings: Array.from({ length: 10 }, (_, i) => ({ checkId: `f${i}`, severity: "p1" as const, entityRef: `e${i}`, summary: `s${i}` })),
  });

  const score = scoreSystemHealth(system);

  assert.equal(score, 100 - 20); // capped at 20
});

test("scoreSystemHealth combines backlog and finding penalties", () => {
  const system = makeSystemSituation({
    healthStatus: "degraded",
    queueBacklog: new Set(["item1", "item2"]),
    findings: [{ checkId: "f1", severity: "p1", entityRef: "e1", summary: "s1" }],
  });

  const score = scoreSystemHealth(system);

  assert.equal(score, 80 - 2 - 5); // base 80, backlog penalty 2, finding penalty 5
});

test("scoreSystemHealth returns 0 minimum score", () => {
  const system = makeSystemSituation({
    healthStatus: "critical",
    queueBacklog: new Set(Array.from({ length: 50 }, (_, i) => `item${i}`)),
    findings: Array.from({ length: 10 }, (_, i) => ({ checkId: `f${i}`, severity: "p1" as const, entityRef: `e${i}`, summary: `s${i}` })),
  });

  const score = scoreSystemHealth(system);

  assert.equal(score, 0); // 30 - 30 - 20 = -20, but max(0, ...) = 0
});

test("scoreSystemHealth handles empty backlog", () => {
  const system = makeSystemSituation({ healthStatus: "ok", queueBacklog: new Set() });

  const score = scoreSystemHealth(system);

  assert.equal(score, 100);
});

test("scoreSystemHealth handles empty findings", () => {
  const system = makeSystemSituation({ healthStatus: "ok", findings: [] });

  const score = scoreSystemHealth(system);

  assert.equal(score, 100);
});

test("scoreSystemHealth with 0 backlog size", () => {
  const system = makeSystemSituation({ healthStatus: "ok", queueBacklog: new Set() });

  const score = scoreSystemHealth(system);

  assert.equal(score, 100);
});

test("scoreSystemHealth with single backlog item", () => {
  const system = makeSystemSituation({ healthStatus: "ok", queueBacklog: new Set(["single"]) });

  const score = scoreSystemHealth(system);

  assert.equal(score, 99);
});

test("scoreSystemHealth with single finding", () => {
  const system = makeSystemSituation({
    healthStatus: "ok",
    findings: [{ checkId: "f1", severity: "p1", entityRef: "e1", summary: "s1" }],
  });

  const score = scoreSystemHealth(system);

  assert.equal(score, 95);
});