/**
 * Unit tests for memory-quality module
 *
 * Tests memory state evaluation, recall query matching,
 * filtering and sorting, and quality report generation.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  getMemoryState,
  matchesMemoryRecallQuery,
  filterAndSortMemories,
  buildMemoryQualityReport,
  type MemoryRecallQuery,
  type MemoryRecord,
} from "../../../../../src/platform/five-plane-state-evidence/memory/memory-quality.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createTestMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  const now = new Date();
  return {
    id: "mem_test_1",
    taskId: null,
    sessionId: "session_1",
    agentId: null,
    executionId: null,
    memoryLayer: "layer_5",
    scope: "session",
    contentJson: JSON.stringify({ text: "Test memory content" }),
    classification: "general",
    sourceTrustLevel: "trusted",
    qualityScore: 0.7,
    hitCount: 5,
    createdAt: new Date(now.getTime() - 3600_000).toISOString(),
    lastAccessedAt: new Date(now.getTime() - 1800_000).toISOString(),
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general",
    status: "active",
    importanceScore: 0.8,
    freshnessScore: 0.9,
    contentHash: null,
    ...overrides,
  };
}

test("getMemoryState returns active for valid record", () => {
  const memory = createTestMemory();
  const state = getMemoryState(memory, new Date().toISOString());
  assert.equal(state, "active");
});

test("getMemoryState returns expired when expiresAt is past", () => {
  const pastTime = new Date(Date.now() - 1000).toISOString();
  const memory = createTestMemory({ expiresAt: pastTime });
  const state = getMemoryState(memory, new Date().toISOString());
  assert.equal(state, "expired");
});

test("getMemoryState returns revoked when revokedAt is past", () => {
  const pastTime = new Date(Date.now() - 1000).toISOString();
  const memory = createTestMemory({ revokedAt: pastTime });
  const state = getMemoryState(memory, new Date().toISOString());
  assert.equal(state, "revoked");
});

test("getMemoryState revoked takes precedence over expired", () => {
  const pastTime = new Date(Date.now() - 1000).toISOString();
  const futureExpiry = new Date(Date.now() + 10000).toISOString();
  const memory = createTestMemory({ revokedAt: pastTime, expiresAt: futureExpiry });
  const state = getMemoryState(memory, new Date().toISOString());
  assert.equal(state, "revoked");
});

test("matchesMemoryRecallQuery returns true for empty query", () => {
  const memory = createTestMemory();
  assert.equal(matchesMemoryRecallQuery(memory, {}), true);
});

test("matchesMemoryRecallQuery filters by taskId", () => {
  const memory = createTestMemory({ taskId: "task_123" });
  assert.equal(matchesMemoryRecallQuery(memory, { taskId: "task_123" }), true);
  assert.equal(matchesMemoryRecallQuery(memory, { taskId: "task_456" }), false);
});

test("matchesMemoryRecallQuery filters by sessionId", () => {
  const memory = createTestMemory({ sessionId: "session_abc" });
  assert.equal(matchesMemoryRecallQuery(memory, { sessionId: "session_abc" }), true);
  assert.equal(matchesMemoryRecallQuery(memory, { sessionId: "session_xyz" }), false);
});

test("matchesMemoryRecallQuery filters by agentId", () => {
  const memory = createTestMemory({ agentId: "agent_1" });
  assert.equal(matchesMemoryRecallQuery(memory, { agentId: "agent_1" }), true);
  assert.equal(matchesMemoryRecallQuery(memory, { agentId: "agent_2" }), false);
});

test("matchesMemoryRecallQuery filters by executionId", () => {
  const memory = createTestMemory({ executionId: "exec_1" });
  assert.equal(matchesMemoryRecallQuery(memory, { executionId: "exec_1" }), true);
  assert.equal(matchesMemoryRecallQuery(memory, { executionId: "exec_2" }), false);
});

test("matchesMemoryRecallQuery filters by scopes", () => {
  const memory = createTestMemory({ scope: "session" });
  assert.equal(matchesMemoryRecallQuery(memory, { scopes: ["session"] }), true);
  assert.equal(matchesMemoryRecallQuery(memory, { scopes: ["agent"] }), false);
  assert.equal(matchesMemoryRecallQuery(memory, { scopes: [] }), true);
});

test("matchesMemoryRecallQuery filters by memoryLayers", () => {
  const memory = createTestMemory({ memoryLayer: "layer_3" });
  assert.equal(matchesMemoryRecallQuery(memory, { memoryLayers: ["layer_3"] }), true);
  assert.equal(matchesMemoryRecallQuery(memory, { memoryLayers: ["layer_5"] }), false);
});

test("matchesMemoryRecallQuery filters by classifications", () => {
  const memory = createTestMemory({ classification: "important" });
  assert.equal(matchesMemoryRecallQuery(memory, { classifications: ["important"] }), true);
  assert.equal(matchesMemoryRecallQuery(memory, { classifications: ["general"] }), false);
});

test("matchesMemoryRecallQuery filters by sourceTrustLevels", () => {
  const memory = createTestMemory({ sourceTrustLevel: "official" });
  assert.equal(matchesMemoryRecallQuery(memory, { sourceTrustLevels: ["official"] }), true);
  assert.equal(matchesMemoryRecallQuery(memory, { sourceTrustLevels: ["private"] }), false);
});

test("matchesMemoryRecallQuery filters by minQualityScore", () => {
  const memory = createTestMemory({ qualityScore: 0.8 });
  assert.equal(matchesMemoryRecallQuery(memory, { minQualityScore: 0.7 }), true);
  assert.equal(matchesMemoryRecallQuery(memory, { minQualityScore: 0.9 }), false);
});

test("matchesMemoryRecallQuery excludes revoked when includeRevoked is false", () => {
  const pastTime = new Date(Date.now() - 1000).toISOString();
  const memory = createTestMemory({ revokedAt: pastTime });
  const evaluatedAt = new Date().toISOString();
  assert.equal(matchesMemoryRecallQuery(memory, { includeRevoked: false }, ), false);
  assert.equal(matchesMemoryRecallQuery(memory, { includeRevoked: true },), true);
});

test("matchesMemoryRecallQuery excludes expired when includeExpired is false", () => {
  const pastTime = new Date(Date.now() - 1000).toISOString();
  const memory = createTestMemory({ expiresAt: pastTime });
  const evaluatedAt = new Date().toISOString();
  assert.equal(matchesMemoryRecallQuery(memory, { includeExpired: false }), false);
  assert.equal(matchesMemoryRecallQuery(memory, { includeExpired: true }), true);
});

test("filterAndSortMemories returns all for empty query", () => {
  const memories = [
    createTestMemory({ id: "mem_1" }),
    createTestMemory({ id: "mem_2" }),
    createTestMemory({ id: "mem_3" }),
  ];
  const result = filterAndSortMemories(memories, {});
  assert.equal(result.length, 3);
});

test("filterAndSortMemories respects limit", () => {
  const memories = [
    createTestMemory({ id: "mem_1", createdAt: new Date(Date.now() - 3000).toISOString() }),
    createTestMemory({ id: "mem_2", createdAt: new Date(Date.now() - 2000).toISOString() }),
    createTestMemory({ id: "mem_3", createdAt: new Date(Date.now() - 1000).toISOString() }),
  ];
  const result = filterAndSortMemories(memories, { limit: 2 });
  assert.equal(result.length, 2);
});

test("filterAndSortMemories sorts by createdAt descending", () => {
  const oldMemory = createTestMemory({ id: "mem_old", createdAt: new Date(Date.now() - 10000).toISOString() });
  const newMemory = createTestMemory({ id: "mem_new", createdAt: new Date(Date.now() - 1000).toISOString() });
  const result = filterAndSortMemories([oldMemory, newMemory], {});
  assert.equal(result[0].id, "mem_new");
  assert.equal(result[1].id, "mem_old");
});

test("filterAndSortMemories uses id for tie-breaking", () => {
  const sameTime = new Date(Date.now() - 5000).toISOString();
  const memoryA = createTestMemory({ id: "mem_a", createdAt: sameTime });
  const memoryB = createTestMemory({ id: "mem_b", createdAt: sameTime });
  const result = filterAndSortMemories([memoryB, memoryA], {});
  assert.equal(result[0].id, "mem_a");
  assert.equal(result[1].id, "mem_b");
});

test("buildMemoryQualityReport generates valid report", () => {
  const memories = [
    createTestMemory({ id: "mem_1", qualityScore: 0.8, hitCount: 3 }),
    createTestMemory({ id: "mem_2", qualityScore: 0.6, hitCount: 0 }),
    createTestMemory({ id: "mem_3", qualityScore: 0.9, hitCount: 7 }),
  ];
  const report = buildMemoryQualityReport(memories);
  assert.equal(report.totalCount, 3);
  assert.ok(report.generatedAt !== undefined);
  assert.ok(report.averageQualityScore !== null);
});

test("buildMemoryQualityReport calculates average quality score", () => {
  const memories = [
    createTestMemory({ id: "mem_1", qualityScore: 0.8 }),
    createTestMemory({ id: "mem_2", qualityScore: 0.6 }),
  ];
  const report = buildMemoryQualityReport(memories);
  assert.equal(report.averageQualityScore, 0.7);
});

test("buildMemoryQualityReport returns null for average when no scores", () => {
  const memories = [
    createTestMemory({ id: "mem_1", qualityScore: null }),
    createTestMemory({ id: "mem_2", qualityScore: null }),
  ];
  const report = buildMemoryQualityReport(memories);
  assert.equal(report.averageQualityScore, null);
});

test("buildMemoryQualityReport tracks recalled vs never recalled", () => {
  const memories = [
    createTestMemory({ id: "mem_1", hitCount: 5 }),
    createTestMemory({ id: "mem_2", hitCount: 0 }),
    createTestMemory({ id: "mem_3", hitCount: 1 }),
  ];
  const report = buildMemoryQualityReport(memories);
  assert.equal(report.recalledCount, 2);
  assert.equal(report.neverRecalledCount, 1);
});

test("buildMemoryQualityReport tracks active/expired/revoked counts", () => {
  const activeMemory = createTestMemory({ id: "mem_1" });
  const expiredMemory = createTestMemory({ id: "mem_2", expiresAt: new Date(Date.now() - 1000).toISOString() });
  const revokedMemory = createTestMemory({ id: "mem_3", revokedAt: new Date(Date.now() - 1000).toISOString() });

  const report = buildMemoryQualityReport([activeMemory, expiredMemory, revokedMemory]);
  assert.equal(report.activeCount, 1);
  assert.equal(report.expiredCount, 1);
  assert.equal(report.revokedCount, 1);
});

test("buildMemoryQualityReport includes breakdowns", () => {
  const memories = [
    createTestMemory({ id: "mem_1", scope: "session", memoryLayer: "layer_1", classification: "important" }),
    createTestMemory({ id: "mem_2", scope: "session", memoryLayer: "layer_2", classification: "general" }),
    createTestMemory({ id: "mem_3", scope: "agent", memoryLayer: "layer_1", classification: "important" }),
  ];
  const report = buildMemoryQualityReport(memories);

  assert.ok(report.byScope.length > 0);
  assert.ok(report.byLayer.length > 0);
  assert.ok(report.byClassification.length > 0);

  const sessionScope = report.byScope.find((s) => s.key === "session");
  assert.ok(sessionScope !== undefined);
  assert.equal(sessionScope!.totalCount, 2);
});

test("buildMemoryQualityReport empty array returns zero counts", () => {
  const report = buildMemoryQualityReport([]);
  assert.equal(report.totalCount, 0);
  assert.equal(report.activeCount, 0);
  assert.equal(report.expiredCount, 0);
  assert.equal(report.recalledCount, 0);
  assert.equal(report.averageQualityScore, null);
});