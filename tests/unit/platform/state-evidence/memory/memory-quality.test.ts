import assert from "node:assert/strict";
import test from "node:test";

import type { MemoryRecord, MemoryLayer, MemorySourceTrustLevel } from "../../../../../src/platform/contracts/types/domain/task-types.js";
import {
  getMemoryState,
  matchesMemoryRecallQuery,
  filterAndSortMemories,
  buildMemoryQualityReport,
  type MemoryRecallQuery,
} from "../../../../../src/platform/state-evidence/memory/memory-quality.js";

function createMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  const now = new Date().toISOString() as any;
  return {
    id: "mem_001",
    taskId: null,
    sessionId: "sess_001",
    agentId: "agent_001",
    executionId: "exec_001",
    memoryLayer: "layer_3" as MemoryLayer,
    scope: "session",
    contentJson: "{}",
    classification: "content",
    sourceTrustLevel: "trusted" as MemorySourceTrustLevel,
    qualityScore: null,
    hitCount: 0,
    createdAt: now,
    lastAccessedAt: null,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general",
    status: "active",
    importanceScore: null,
    freshnessScore: null,
    contentHash: null,
    ...overrides,
  } as MemoryRecord;
}

test("getMemoryState returns active when no expiry or revoke", () => {
  const record = createMemoryRecord();
  const state = getMemoryState(record, "2026-04-14T00:00:00.000Z");
  assert.equal(state, "active");
});

test("getMemoryState returns expired when expiresAt is in past", () => {
  const record = createMemoryRecord({
    expiresAt: "2026-04-13T00:00:00.000Z" as any,
  });
  const state = getMemoryState(record, "2026-04-14T00:00:00.000Z");
  assert.equal(state, "expired");
});

test("getMemoryState returns revoked when revokedAt is in past", () => {
  const record = createMemoryRecord({
    revokedAt: "2026-04-13T00:00:00.000Z" as any,
  });
  const state = getMemoryState(record, "2026-04-14T00:00:00.000Z");
  assert.equal(state, "revoked");
});

test("getMemoryState revoked takes precedence over expired", () => {
  const record = createMemoryRecord({
    expiresAt: "2026-04-13T00:00:00.000Z" as any,
    revokedAt: "2026-04-13T00:00:00.000Z" as any,
  });
  const state = getMemoryState(record, "2026-04-14T00:00:00.000Z");
  assert.equal(state, "revoked");
});

test("matchesMemoryRecallQuery returns true when no filters", () => {
  const record = createMemoryRecord();
  const query: MemoryRecallQuery = {};
  assert.equal(matchesMemoryRecallQuery(record, query), true);
});

test("matchesMemoryRecallQuery filters by taskId", () => {
  const record = createMemoryRecord({ taskId: "task_123" });
  assert.equal(matchesMemoryRecallQuery(record, { taskId: "task_123" }), true);
  assert.equal(matchesMemoryRecallQuery(record, { taskId: "task_456" }), false);
});

test("matchesMemoryRecallQuery filters by sessionId", () => {
  const record = createMemoryRecord({ sessionId: "sess_123" });
  assert.equal(matchesMemoryRecallQuery(record, { sessionId: "sess_123" }), true);
  assert.equal(matchesMemoryRecallQuery(record, { sessionId: "sess_456" }), false);
});

test("matchesMemoryRecallQuery filters by agentId", () => {
  const record = createMemoryRecord({ agentId: "agent_123" });
  assert.equal(matchesMemoryRecallQuery(record, { agentId: "agent_123" }), true);
  assert.equal(matchesMemoryRecallQuery(record, { agentId: "agent_456" }), false);
});

test("matchesMemoryRecallQuery filters by executionId", () => {
  const record = createMemoryRecord({ executionId: "exec_123" });
  assert.equal(matchesMemoryRecallQuery(record, { executionId: "exec_123" }), true);
  assert.equal(matchesMemoryRecallQuery(record, { executionId: "exec_456" }), false);
});

test("matchesMemoryRecallQuery filters by scopes", () => {
  const record = createMemoryRecord({ scope: "session" });
  assert.equal(matchesMemoryRecallQuery(record, { scopes: ["session"] }), true);
  assert.equal(matchesMemoryRecallQuery(record, { scopes: ["persistent"] }), false);
});

test("matchesMemoryRecallQuery filters by memoryLayers", () => {
  const record = createMemoryRecord({ memoryLayer: "layer_3" });
  assert.equal(matchesMemoryRecallQuery(record, { memoryLayers: ["layer_3"] }), true);
  assert.equal(matchesMemoryRecallQuery(record, { memoryLayers: ["layer_5"] }), false);
});

test("matchesMemoryRecallQuery filters by classifications", () => {
  const record = createMemoryRecord({ classification: "content" });
  assert.equal(matchesMemoryRecallQuery(record, { classifications: ["content"] }), true);
  assert.equal(matchesMemoryRecallQuery(record, { classifications: ["metadata"] }), false);
});

test("matchesMemoryRecallQuery filters by sourceTrustLevels", () => {
  const record = createMemoryRecord({ sourceTrustLevel: "trusted" });
  assert.equal(matchesMemoryRecallQuery(record, { sourceTrustLevels: ["trusted"] }), true);
  assert.equal(matchesMemoryRecallQuery(record, { sourceTrustLevels: ["untrusted"] }), false);
});

test("matchesMemoryRecallQuery filters by minQualityScore", () => {
  const record = createMemoryRecord({ qualityScore: 0.8 });
  assert.equal(matchesMemoryRecallQuery(record, { minQualityScore: 0.7 }), true);
  assert.equal(matchesMemoryRecallQuery(record, { minQualityScore: 0.9 }), false);
});

test("matchesMemoryRecallQuery returns false for expired when includeExpired is false", () => {
  const record = createMemoryRecord({
    expiresAt: "2026-04-13T00:00:00.000Z" as any,
  });
  const query: MemoryRecallQuery = {
    includeExpired: false,
    evaluatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(matchesMemoryRecallQuery(record, query), false);
});

test("matchesMemoryRecallQuery returns true for expired when includeExpired is true", () => {
  const record = createMemoryRecord({
    expiresAt: "2026-04-13T00:00:00.000Z" as any,
  });
  const query: MemoryRecallQuery = {
    includeExpired: true,
    evaluatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(matchesMemoryRecallQuery(record, query), true);
});

test("matchesMemoryRecallQuery returns false for revoked when includeRevoked is false", () => {
  const record = createMemoryRecord({
    revokedAt: "2026-04-13T00:00:00.000Z" as any,
    revocationReason: "stale",
  });
  const query: MemoryRecallQuery = {
    includeRevoked: false,
    evaluatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(matchesMemoryRecallQuery(record, query), false);
});

test("matchesMemoryRecallQuery returns true for revoked when includeRevoked is true", () => {
  const record = createMemoryRecord({
    revokedAt: "2026-04-13T00:00:00.000Z" as any,
    revocationReason: "stale",
  });
  const query: MemoryRecallQuery = {
    includeRevoked: true,
    evaluatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(matchesMemoryRecallQuery(record, query), true);
});

test("filterAndSortMemories returns empty array for empty input", () => {
  const result = filterAndSortMemories([]);
  assert.deepEqual(result, []);
});

test("filterAndSortMemories sorts by createdAt descending", () => {
  const records = [
    createMemoryRecord({ id: "mem_1", createdAt: "2026-04-10T00:00:00.000Z" as any }),
    createMemoryRecord({ id: "mem_2", createdAt: "2026-04-14T00:00:00.000Z" as any }),
    createMemoryRecord({ id: "mem_3", createdAt: "2026-04-12T00:00:00.000Z" as any }),
  ];
  const result = filterAndSortMemories(records);
  assert.equal(result[0]!.id, "mem_2");
  assert.equal(result[1]!.id, "mem_3");
  assert.equal(result[2]!.id, "mem_1");
});

test("filterAndSortMemories respects limit", () => {
  const records = [
    createMemoryRecord({ id: "mem_1", createdAt: "2026-04-10T00:00:00.000Z" as any }),
    createMemoryRecord({ id: "mem_2", createdAt: "2026-04-14T00:00:00.000Z" as any }),
    createMemoryRecord({ id: "mem_3", createdAt: "2026-04-12T00:00:00.000Z" as any }),
  ];
  const result = filterAndSortMemories(records, { limit: 2 });
  assert.equal(result.length, 2);
  assert.equal(result[0]!.id, "mem_2");
  assert.equal(result[1]!.id, "mem_3");
});

test("filterAndSortMemories sorts by id when createdAt is equal", () => {
  const createdAt = "2026-04-14T00:00:00.000Z" as any;
  const records = [
    createMemoryRecord({ id: "mem_z", createdAt }),
    createMemoryRecord({ id: "mem_a", createdAt }),
    createMemoryRecord({ id: "mem_m", createdAt }),
  ];
  const result = filterAndSortMemories(records);
  assert.equal(result[0]!.id, "mem_a");
  assert.equal(result[1]!.id, "mem_m");
  assert.equal(result[2]!.id, "mem_z");
});

test("buildMemoryQualityReport returns correct counts", () => {
  const records = [
    createMemoryRecord({ id: "mem_1", expiresAt: null, revokedAt: null }),
    createMemoryRecord({ id: "mem_2", expiresAt: "2026-04-13T00:00:00.000Z" as any, revokedAt: null }),
    createMemoryRecord({ id: "mem_3", expiresAt: null, revokedAt: "2026-04-13T00:00:00.000Z" as any }),
    createMemoryRecord({ id: "mem_4", expiresAt: null, revokedAt: null, hitCount: 1 }),
    createMemoryRecord({ id: "mem_5", expiresAt: null, revokedAt: null, hitCount: 0, qualityScore: 0.9 }),
  ];
  const evaluatedAt = "2026-04-14T00:00:00.000Z";
  const report = buildMemoryQualityReport(records, evaluatedAt);

  assert.equal(report.totalCount, 5);
  assert.equal(report.activeCount, 3); // mem_1, mem_4, and mem_5 are active
  assert.equal(report.expiredCount, 1); // mem_2
  assert.equal(report.revokedCount, 1); // mem_3
  assert.equal(report.recalledCount, 1); // mem_4 has hitCount > 0
  assert.equal(report.neverRecalledCount, 4); // mem_1, mem_2, mem_3, mem_5 have hitCount = 0
});

test("buildMemoryQualityReport calculates average quality score", () => {
  const records = [
    createMemoryRecord({ qualityScore: 0.8 }),
    createMemoryRecord({ qualityScore: 0.6 }),
    createMemoryRecord({ qualityScore: 1.0 }),
  ];
  const report = buildMemoryQualityReport(records);
  // Use approximate comparison due to floating point precision
  assert.ok(report.averageQualityScore !== null);
  assert.ok(Math.abs(report.averageQualityScore! - 0.8) < 0.001);
});

test("buildMemoryQualityReport returns null average when no quality scores", () => {
  const records = [
    createMemoryRecord({ qualityScore: null }),
    createMemoryRecord({ qualityScore: null }),
  ];
  const report = buildMemoryQualityReport(records);
  assert.equal(report.averageQualityScore, null);
});

test("buildMemoryQualityReport groups by scope", () => {
  const records = [
    createMemoryRecord({ id: "mem_1", scope: "session" }),
    createMemoryRecord({ id: "mem_2", scope: "session" }),
    createMemoryRecord({ id: "mem_3", scope: "persistent" }),
  ];
  const report = buildMemoryQualityReport(records);
  const sessionItem = report.byScope.find((item) => item.key === "session");
  const persistentItem = report.byScope.find((item) => item.key === "persistent");

  assert.ok(sessionItem);
  assert.equal(sessionItem!.totalCount, 2);
  assert.ok(persistentItem);
  assert.equal(persistentItem!.totalCount, 1);
});

test("buildMemoryQualityReport sorts by key when scope groups have equal totalCount", () => {
  // When two scope groups have the same totalCount, they should be sorted alphabetically by key
  const records = [
    createMemoryRecord({ id: "mem_1", scope: "alpha" }),
    createMemoryRecord({ id: "mem_2", scope: "beta" }),
  ];
  const report = buildMemoryQualityReport(records);
  // Both alpha and beta have totalCount=1, so they should be sorted alphabetically
  assert.equal(report.byScope[0]!.key, "alpha");
  assert.equal(report.byScope[1]!.key, "beta");
});

test("buildMemoryQualityReport groups by memoryLayer", () => {
  const records = [
    createMemoryRecord({ id: "mem_1", memoryLayer: "layer_3" }),
    createMemoryRecord({ id: "mem_2", memoryLayer: "layer_3" }),
    createMemoryRecord({ id: "mem_3", memoryLayer: "layer_5" }),
  ];
  const report = buildMemoryQualityReport(records);
  const layer3Item = report.byLayer.find((item) => item.key === "layer_3");
  const layer5Item = report.byLayer.find((item) => item.key === "layer_5");

  assert.ok(layer3Item);
  assert.equal(layer3Item!.totalCount, 2);
  assert.ok(layer5Item);
  assert.equal(layer5Item!.totalCount, 1);
});

test("buildMemoryQualityReport groups by classification", () => {
  const records = [
    createMemoryRecord({ id: "mem_1", classification: "internal" }),
    createMemoryRecord({ id: "mem_2", classification: "public" }),
    createMemoryRecord({ id: "mem_3", classification: "internal" }),
  ];
  const report = buildMemoryQualityReport(records);
  const internalItem = report.byClassification.find((item) => item.key === "internal");
  const publicItem = report.byClassification.find((item) => item.key === "public");

  assert.ok(internalItem);
  assert.equal(internalItem!.totalCount, 2);
  assert.ok(publicItem);
  assert.equal(publicItem!.totalCount, 1);
});

test("buildMemoryQualityReport calculates activeCount per breakdown group", () => {
  const evaluatedAt = "2026-04-14T00:00:00.000Z";
  const records = [
    createMemoryRecord({ id: "mem_1", scope: "session", expiresAt: null, revokedAt: null }),
    createMemoryRecord({ id: "mem_2", scope: "session", expiresAt: "2026-04-13T00:00:00.000Z" as any, revokedAt: null }), // expired
    createMemoryRecord({ id: "mem_3", scope: "persistent", expiresAt: null, revokedAt: null }),
  ];
  const report = buildMemoryQualityReport(records, evaluatedAt);
  const sessionItem = report.byScope.find((item) => item.key === "session");
  const persistentItem = report.byScope.find((item) => item.key === "persistent");

  assert.equal(sessionItem!.activeCount, 1); // only mem_1 is active
  assert.equal(persistentItem!.activeCount, 1); // mem_3 is active
});

test("filterAndSortMemories returns all when no limit specified", () => {
  const records = [
    createMemoryRecord({ id: "mem_1", createdAt: "2026-04-10T00:00:00.000Z" as any }),
    createMemoryRecord({ id: "mem_2", createdAt: "2026-04-14T00:00:00.000Z" as any }),
    createMemoryRecord({ id: "mem_3", createdAt: "2026-04-12T00:00:00.000Z" as any }),
  ];
  const result = filterAndSortMemories(records, {});
  assert.equal(result.length, 3);
});

test("filterAndSortMemories returns all when limit is 0", () => {
  const records = [
    createMemoryRecord({ id: "mem_1", createdAt: "2026-04-10T00:00:00.000Z" as any }),
    createMemoryRecord({ id: "mem_2", createdAt: "2026-04-14T00:00:00.000Z" as any }),
  ];
  const result = filterAndSortMemories(records, { limit: 0 });
  assert.equal(result.length, 2); // limit 0 means return all
});

test("filterAndSortMemories returns all when limit is negative", () => {
  const records = [
    createMemoryRecord({ id: "mem_1", createdAt: "2026-04-10T00:00:00.000Z" as any }),
    createMemoryRecord({ id: "mem_2", createdAt: "2026-04-14T00:00:00.000Z" as any }),
  ];
  const result = filterAndSortMemories(records, { limit: -5 });
  assert.equal(result.length, 2); // negative limit means return all
});

test("matchesMemoryRecallQuery handles null taskId in record", () => {
  const record = createMemoryRecord({ taskId: null });
  assert.equal(matchesMemoryRecallQuery(record, { taskId: "task_123" }), false);
  // When taskId is null in record and not specified in query, it matches
  assert.equal(matchesMemoryRecallQuery(record, {}), true);
});

test("matchesMemoryRecallQuery handles empty scopes array", () => {
  const record = createMemoryRecord({ scope: "session" });
  assert.equal(matchesMemoryRecallQuery(record, { scopes: [] }), true);
});

test("matchesMemoryRecallQuery handles empty memoryLayers array", () => {
  const record = createMemoryRecord({ memoryLayer: "layer_3" });
  assert.equal(matchesMemoryRecallQuery(record, { memoryLayers: [] }), true);
});

test("getMemoryState uses default evaluatedAt when not provided", () => {
  const record = createMemoryRecord({
    expiresAt: "2099-12-31T00:00:00.000Z" as any, // far future
  });
  // Should not throw even without evaluatedAt
  const state = getMemoryState(record);
  assert.equal(state, "active");
});
