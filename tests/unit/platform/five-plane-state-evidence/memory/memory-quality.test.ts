import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMemoryQualityReport,
  filterAndSortMemories,
  getMemoryState,
  matchesMemoryRecallQuery,
} from "../../../../../src/platform/five-plane-state-evidence/memory/memory-quality.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: "memory-1",
    taskId: null,
    sessionId: "session-1",
    agentId: null,
    executionId: null,
    memoryLayer: "layer_5",
    scope: "session",
    contentJson: JSON.stringify({ text: "memory" }),
    classification: "general",
    sourceTrustLevel: "trusted",
    qualityScore: 0.7,
    hitCount: 5,
    createdAt: "2026-05-24T00:00:00.000Z",
    lastAccessedAt: "2026-05-24T00:10:00.000Z",
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

test("getMemoryState prioritizes revoked over expired and active states", () => {
  const evaluatedAt = "2026-05-24T01:00:00.000Z";

  assert.equal(getMemoryState(createMemory(), evaluatedAt), "active");
  assert.equal(
    getMemoryState(createMemory({ expiresAt: "2026-05-24T00:30:00.000Z" }), evaluatedAt),
    "expired",
  );
  assert.equal(
    getMemoryState(createMemory({
      expiresAt: "2026-05-24T00:30:00.000Z",
      revokedAt: "2026-05-24T00:20:00.000Z",
    }), evaluatedAt),
    "revoked",
  );
});

test("matchesMemoryRecallQuery filters by identifiers scope layer trust and quality", () => {
  const memory = createMemory({
    taskId: "task-1",
    executionId: "exec-1",
    scope: "agent",
    memoryLayer: "layer_3",
    classification: "important",
    sourceTrustLevel: "external",
    qualityScore: 0.8,
  });

  assert.equal(matchesMemoryRecallQuery(memory, {
    taskId: "task-1",
    executionId: "exec-1",
    scopes: ["agent"],
    memoryLayers: ["layer_3"],
    classifications: ["important"],
    sourceTrustLevels: ["external"],
    minQualityScore: 0.7,
  }), true);
  assert.equal(matchesMemoryRecallQuery(memory, { sourceTrustLevels: ["trusted"] }), false);
  assert.equal(matchesMemoryRecallQuery(memory, { minQualityScore: 0.9 }), false);
});

test("filterAndSortMemories sorts newest first and respects limits", () => {
  const memories = [
    createMemory({ id: "memory-old", createdAt: "2026-05-24T00:00:00.000Z" }),
    createMemory({ id: "memory-new", createdAt: "2026-05-24T00:10:00.000Z" }),
    createMemory({ id: "memory-mid", createdAt: "2026-05-24T00:05:00.000Z" }),
  ];

  const filtered = filterAndSortMemories(memories, { limit: 2 });

  assert.deepEqual(filtered.map((entry) => entry.id), ["memory-new", "memory-mid"]);
});

test("buildMemoryQualityReport aggregates activity and breakdowns", () => {
  const report = buildMemoryQualityReport([
    createMemory({ id: "memory-a", scope: "session", hitCount: 2, qualityScore: 0.8 }),
    createMemory({ id: "memory-b", scope: "session", hitCount: 0, qualityScore: 0.6 }),
    createMemory({
      id: "memory-c",
      scope: "agent",
      classification: "important",
      revokedAt: "2026-05-24T00:20:00.000Z",
    }),
  ], "2026-05-24T01:00:00.000Z");

  assert.equal(report.totalCount, 3);
  assert.equal(report.recalledCount, 2);
  assert.equal(report.neverRecalledCount, 1);
  assert.equal(report.revokedCount, 1);
  assert.equal(report.byScope.find((entry) => entry.key === "session")?.totalCount, 2);
  assert.equal(report.byClassification.find((entry) => entry.key === "important")?.totalCount, 1);
});
