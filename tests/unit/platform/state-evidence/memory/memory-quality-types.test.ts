import assert from "node:assert/strict";
import test from "node:test";

import type {
  MemoryState,
  MemoryRecallQuery,
  MemoryQualityBreakdownItem,
  MemoryQualityReport,
} from "../../../../../src/platform/five-plane-state-evidence/memory/memory-quality.js";

test("MemoryState type accepts valid values", () => {
  const states: MemoryState[] = ["active", "expired", "revoked"];
  assert.equal(states.length, 3);
});

test("MemoryRecallQuery structure is correct", () => {
  const query: MemoryRecallQuery = {
    taskId: "task_123",
    sessionId: "sess_456",
    agentId: "agent_789",
    executionId: "exec_abc",
    scopes: ["session"],
    memoryLayers: ["layer_3"],
    classifications: ["work_context"],
    sourceTrustLevels: ["trusted"],
    includeExpired: false,
    includeRevoked: false,
    minQualityScore: 0.5,
    limit: 100,
    evaluatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(query.taskId, "task_123");
  assert.equal(query.limit, 100);
  assert.equal(query.includeExpired, false);
});

test("MemoryRecallQuery allows minimal query", () => {
  const query: MemoryRecallQuery = {};
  assert.equal(query.taskId, undefined);
  assert.equal(query.limit, undefined);
});

test("MemoryRecallQuery allow undefined optional fields", () => {
  const query: MemoryRecallQuery = {
    taskId: "task_123",
    includeExpired: true,
  };
  assert.equal(query.taskId, "task_123");
  assert.equal(query.includeExpired, true);
  assert.equal(query.sessionId, undefined);
});

test("MemoryQualityBreakdownItem structure is correct", () => {
  const item: MemoryQualityBreakdownItem = {
    key: "session",
    totalCount: 50,
    activeCount: 40,
  };
  assert.equal(item.key, "session");
  assert.equal(item.totalCount, 50);
  assert.equal(item.activeCount, 40);
});

test("MemoryQualityReport structure is correct", () => {
  const report: MemoryQualityReport = {
    generatedAt: "2026-04-14T00:00:00.000Z",
    totalCount: 100,
    activeCount: 80,
    expiredCount: 15,
    revokedCount: 5,
    recalledCount: 60,
    neverRecalledCount: 40,
    averageQualityScore: 0.75,
    byScope: [],
    byLayer: [],
    byClassification: [],
  };
  assert.equal(report.totalCount, 100);
  assert.equal(report.activeCount, 80);
  assert.equal(report.averageQualityScore, 0.75);
});

test("MemoryQualityReport allows null averageQualityScore", () => {
  const report: MemoryQualityReport = {
    generatedAt: "2026-04-14T00:00:00.000Z",
    totalCount: 0,
    activeCount: 0,
    expiredCount: 0,
    revokedCount: 0,
    recalledCount: 0,
    neverRecalledCount: 0,
    averageQualityScore: null,
    byScope: [],
    byLayer: [],
    byClassification: [],
  };
  assert.equal(report.averageQualityScore, null);
});

test("MemoryQualityReport includes breakdown arrays", () => {
  const report: MemoryQualityReport = {
    generatedAt: "2026-04-14T00:00:00.000Z",
    totalCount: 100,
    activeCount: 80,
    expiredCount: 10,
    revokedCount: 10,
    recalledCount: 50,
    neverRecalledCount: 50,
    averageQualityScore: 0.6,
    byScope: [
      { key: "session", totalCount: 60, activeCount: 50 },
      { key: "persistent", totalCount: 40, activeCount: 30 },
    ],
    byLayer: [
      { key: "working", totalCount: 70, activeCount: 60 },
    ],
    byClassification: [
      { key: "work_context", totalCount: 100, activeCount: 80 },
    ],
  };
  assert.equal(report.byScope.length, 2);
  assert.equal(report.byLayer.length, 1);
  assert.equal(report.byClassification.length, 1);
});
