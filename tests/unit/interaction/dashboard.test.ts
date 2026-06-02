import assert from "node:assert/strict";
import test from "node:test";

import { sortAttentionQueue } from "../../../src/interaction/dashboard/alert-router/index.js";
import { scoreSystemHealth } from "../../../src/interaction/dashboard/health-scorer/index.js";
import type { AttentionItem } from "../../../src/interaction/dashboard/index.js";
import type { SystemSituation } from "../../../src/platform/shared/observability/system-situation-model.js";

function makeAttentionItem(overrides: Partial<AttentionItem> = {}): AttentionItem {
  return {
    itemType: "incident",
    priority: "normal",
    title: "Test Item",
    description: "Test description",
    actionOptions: ["inspect"],
    createdAt: "2026-04-19T00:00:00.000Z",
    domainId: "general-ops",
    ...overrides,
  };
}

function makeSystemSituation(overrides: Partial<SystemSituation> = {}): SystemSituation {
  return {
    healthStatus: "ok",
    providerHealth: {
      status: "healthy",
      successRate: 0.99,
      recentCalls: 100,
    },
    resourceUtilization: {
      memoryRssMb: 512,
      cpuPercent: 45,
      activeProcesses: 8,
    },
    queueBacklog: {
      size: 0,
      degraded: false,
    },
    eventBusBacklog: {
      tier1PendingAcks: 0,
    },
    findings: [],
    observedAt: Date.parse("2026-04-19T00:00:00.000Z"),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// sortAttentionQueue tests
// ─────────────────────────────────────────────────────────────────────────────

test("sortAttentionQueue sorts critical items first", () => {
  const items = [
    makeAttentionItem({ priority: "normal", createdAt: "2026-04-19T00:01:00.000Z" }),
    makeAttentionItem({ priority: "critical", createdAt: "2026-04-19T00:02:00.000Z" }),
    makeAttentionItem({ priority: "high", createdAt: "2026-04-19T00:03:00.000Z" }),
  ];

  const sorted = sortAttentionQueue(items);

  assert.equal(sorted[0]!.priority, "critical");
  assert.equal(sorted[1]!.priority, "high");
  assert.equal(sorted[2]!.priority, "normal");
});

test("sortAttentionQueue sorts high priority after critical", () => {
  const items = [
    makeAttentionItem({ priority: "high", createdAt: "2026-04-19T00:01:00.000Z" }),
    makeAttentionItem({ priority: "critical", createdAt: "2026-04-19T00:01:00.000Z" }),
  ];

  const sorted = sortAttentionQueue(items);

  assert.equal(sorted[0]!.priority, "critical");
  assert.equal(sorted[1]!.priority, "high");
});

test("sortAttentionQueue sorts normal priority after high", () => {
  const items = [
    makeAttentionItem({ priority: "normal", createdAt: "2026-04-19T00:01:00.000Z" }),
    makeAttentionItem({ priority: "high", createdAt: "2026-04-19T00:01:00.000Z" }),
  ];

  const sorted = sortAttentionQueue(items);

  assert.equal(sorted[0]!.priority, "high");
  assert.equal(sorted[1]!.priority, "normal");
});

test("sortAttentionQueue sorts low priority last", () => {
  const items = [
    makeAttentionItem({ priority: "low", createdAt: "2026-04-19T00:01:00.000Z" }),
    makeAttentionItem({ priority: "normal", createdAt: "2026-04-19T00:01:00.000Z" }),
  ];

  const sorted = sortAttentionQueue(items);

  assert.equal(sorted[0]!.priority, "normal");
  assert.equal(sorted[1]!.priority, "low");
});

test("sortAttentionQueue sorts by createdAt within same priority", () => {
  const items = [
    makeAttentionItem({ priority: "normal", createdAt: "2026-04-19T00:03:00.000Z" }),
    makeAttentionItem({ priority: "normal", createdAt: "2026-04-19T00:01:00.000Z" }),
    makeAttentionItem({ priority: "normal", createdAt: "2026-04-19T00:02:00.000Z" }),
  ];

  const sorted = sortAttentionQueue(items);

  assert.equal(sorted[0]!.createdAt, "2026-04-19T00:03:00.000Z");
  assert.equal(sorted[1]!.createdAt, "2026-04-19T00:02:00.000Z");
  assert.equal(sorted[2]!.createdAt, "2026-04-19T00:01:00.000Z");
});

test("sortAttentionQueue does not mutate original array", () => {
  const items = [
    makeAttentionItem({ priority: "normal", createdAt: "2026-04-19T00:02:00.000Z" }),
    makeAttentionItem({ priority: "critical", createdAt: "2026-04-19T00:01:00.000Z" }),
  ];
  const original = [...items];

  sortAttentionQueue(items);

  assert.equal(items[0]!.priority, original[0]!.priority);
  assert.equal(items[1]!.priority, original[1]!.priority);
});

test("sortAttentionQueue handles empty array", () => {
  const sorted = sortAttentionQueue([]);

  assert.equal(sorted.length, 0);
});

test("sortAttentionQueue handles single item [interaction-dashboard]", () => {
  const items = [makeAttentionItem({ priority: "critical" })];

  const sorted = sortAttentionQueue(items);

  assert.equal(sorted.length, 1);
  assert.equal(sorted[0]!.priority, "critical");
});

test("sortAttentionQueue handles all same priority items", () => {
  const items = [
    makeAttentionItem({ priority: "high", createdAt: "2026-04-19T00:03:00.000Z" }),
    makeAttentionItem({ priority: "high", createdAt: "2026-04-19T00:01:00.000Z" }),
    makeAttentionItem({ priority: "high", createdAt: "2026-04-19T00:02:00.000Z" }),
  ];

  const sorted = sortAttentionQueue(items);

  assert.equal(sorted.length, 3);
  assert.equal(sorted[0]!.createdAt, "2026-04-19T00:03:00.000Z");
  assert.equal(sorted[1]!.createdAt, "2026-04-19T00:02:00.000Z");
  assert.equal(sorted[2]!.createdAt, "2026-04-19T00:01:00.000Z");
});

test("sortAttentionQueue sorts all priority levels correctly", () => {
  const items = [
    makeAttentionItem({ priority: "low", createdAt: "2026-04-19T00:01:00.000Z" }),
    makeAttentionItem({ priority: "critical", createdAt: "2026-04-19T00:01:00.000Z" }),
    makeAttentionItem({ priority: "normal", createdAt: "2026-04-19T00:01:00.000Z" }),
    makeAttentionItem({ priority: "high", createdAt: "2026-04-19T00:01:00.000Z" }),
  ];

  const sorted = sortAttentionQueue(items);

  assert.equal(sorted[0]!.priority, "critical");
  assert.equal(sorted[1]!.priority, "high");
  assert.equal(sorted[2]!.priority, "normal");
  assert.equal(sorted[3]!.priority, "low");
});

// ─────────────────────────────────────────────────────────────────────────────
// scoreSystemHealth tests
// ─────────────────────────────────────────────────────────────────────────────

test("scoreSystemHealth returns 100 for ok status with no issues", () => {
  const system = makeSystemSituation({ healthStatus: "ok" });

  const score = scoreSystemHealth(system);

  assert.equal(score, 100);
});

test("scoreSystemHealth returns 80 for degraded status with no issues", () => {
  const system = makeSystemSituation({ healthStatus: "degraded" });

  const score = scoreSystemHealth(system);

  assert.equal(score, 80);
});

test("scoreSystemHealth returns 60 for overloaded status with no issues", () => {
  const system = makeSystemSituation({ healthStatus: "overloaded" });

  const score = scoreSystemHealth(system);

  assert.equal(score, 60);
});

test("scoreSystemHealth returns 30 for unhealthy status with no issues", () => {
  const system = makeSystemSituation({ healthStatus: "unhealthy" });

  const score = scoreSystemHealth(system);

  assert.equal(score, 30);
});

test("scoreSystemHealth applies backlog penalty up to 30", () => {
  const systemOk = makeSystemSituation({ healthStatus: "ok", queueBacklog: { size: 50, degraded: false } });

  const score = scoreSystemHealth(systemOk);

  // Base 100 - min(30, 50) = 70
  assert.equal(score, 70);
});

test("scoreSystemHealth applies backlog penalty capped at 30", () => {
  const system = makeSystemSituation({ healthStatus: "ok", queueBacklog: { size: 100, degraded: false } });

  const score = scoreSystemHealth(system);

  // Base 100 - min(30, 100) = 70
  assert.equal(score, 70);
});

test("scoreSystemHealth applies finding penalty of 5 per finding up to 20", () => {
  const system = makeSystemSituation({ healthStatus: "ok", findings: ["finding1", "finding2", "finding3"] });

  const score = scoreSystemHealth(system);

  // Base 100 - (3 * 5) = 85
  assert.equal(score, 85);
});

test("scoreSystemHealth applies finding penalty capped at 20", () => {
  const system = makeSystemSituation({ healthStatus: "ok", findings: ["f1", "f2", "f3", "f4", "f5", "f6"] });

  const score = scoreSystemHealth(system);

  // Base 100 - min(20, 6 * 5) = 80
  assert.equal(score, 80);
});

test("scoreSystemHealth combines backlog and finding penalties", () => {
  const system = makeSystemSituation({
    healthStatus: "degraded",
    queueBacklog: { size: 10, degraded: true },
    findings: ["finding1"],
  });

  const score = scoreSystemHealth(system);

  // Base 80 - min(30, 10) - min(20, 1 * 5) = 80 - 10 - 5 = 65
  assert.equal(score, 65);
});

test("scoreSystemHealth returns at least 0", () => {
  const system = makeSystemSituation({
    healthStatus: "unhealthy",
    queueBacklog: { size: 100, degraded: true },
    findings: ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8"],
  });

  const score = scoreSystemHealth(system);

  // Base 30 - min(30, 100) - min(20, 8 * 5) = 30 - 30 - 20 = -20, but clamped to 0
  assert.equal(score, 0);
});

test("scoreSystemHealth handles zero queue backlog", () => {
  const system = makeSystemSituation({ healthStatus: "ok", queueBacklog: { size: 0, degraded: false } });

  const score = scoreSystemHealth(system);

  assert.equal(score, 100);
});

test("scoreSystemHealth handles empty findings", () => {
  const system = makeSystemSituation({ healthStatus: "ok", findings: [] });

  const score = scoreSystemHealth(system);

  assert.equal(score, 100);
});

test("scoreSystemHealth degraded status with max backlog and findings", () => {
  const system = makeSystemSituation({
    healthStatus: "degraded",
    queueBacklog: { size: 50, degraded: true },
    findings: ["f1", "f2", "f3", "f4", "f5"],
  });

  const score = scoreSystemHealth(system);

  // Base 80 - min(30, 50) - min(20, 25) = 80 - 30 - 20 = 30
  assert.equal(score, 30);
});

test("scoreSystemHealth overloaded status calculation", () => {
  const system = makeSystemSituation({
    healthStatus: "overloaded",
    queueBacklog: { size: 5, degraded: true },
    findings: [],
  });

  const score = scoreSystemHealth(system);

  // Base 60 - min(30, 5) - 0 = 55
  assert.equal(score, 55);
});

test("scoreSystemHealth with exactly max backlog penalty", () => {
  const system = makeSystemSituation({ healthStatus: "ok", queueBacklog: { size: 30, degraded: false } });

  const score = scoreSystemHealth(system);

  // Base 100 - min(30, 30) = 70
  assert.equal(score, 70);
});

test("scoreSystemHealth with exactly max finding penalty", () => {
  const system = makeSystemSituation({ healthStatus: "ok", findings: ["f1", "f2", "f3", "f4"] });

  const score = scoreSystemHealth(system);

  // Base 100 - min(20, 4 * 5) = 100 - 20 = 80
  assert.equal(score, 80);
});
