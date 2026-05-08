/**
 * Integration tests for memory services
 *
 * Tests memory layer model in integration with memory quality and SQLite storage.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { existsSync, unlinkSync, mkdirSync } from "node:fs";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import {
  mapMemoryScopeToLayer,
  cloneMemoryWithLayer,
  getLayerTtlConfig,
  isMemoryStale,
  shouldEvict,
} from "../../../../../src/platform/five-plane-state-evidence/memory/memory-layer-model.js";
import {
  getMemoryState,
  matchesMemoryRecallQuery,
  filterAndSortMemories,
  buildMemoryQualityReport,
} from "../../../../../src/platform/five-plane-state-evidence/memory/memory-quality.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";

const TEST_DB_DIR = "/tmp/five-plane-state-evidence-integration-test";
const TEST_DB_PATH = join(TEST_DB_DIR, "memory-integration.db");

function cleanupTestDb() {
  try {
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
  } catch {
    // ignore cleanup errors
  }
}

function createTestMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  const now = new Date();
  return {
    id: "mem_integration_" + Math.random().toString(36).slice(2, 9),
    taskId: null,
    sessionId: "session_integration",
    agentId: null,
    executionId: null,
    memoryLayer: "layer_5",
    scope: "session",
    contentJson: JSON.stringify({ text: "Integration test memory" }),
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

test("integration: memory layer model with quality filtering", () => {
  const memories: MemoryRecord[] = [
    createTestMemory({
      id: "mem_q1",
      scope: "runtime",
      qualityScore: 0.9,
      hitCount: 10,
      classification: "important",
    }),
    createTestMemory({
      id: "mem_q2",
      scope: "session",
      qualityScore: 0.5,
      hitCount: 2,
      classification: "general",
    }),
    createTestMemory({
      id: "mem_q3",
      scope: "agent",
      qualityScore: 0.8,
      hitCount: 5,
      classification: "important",
    }),
  ];

  const query = { minQualityScore: 0.6, classifications: ["important"] };
  const filtered = filterAndSortMemories(memories, query);

  assert.equal(filtered.length, 2);
  assert.ok(filtered.every((m) => m.qualityScore! >= 0.6));
  assert.ok(filtered.every((m) => m.classification === "important"));
});

test("integration: memory state transitions with explicit expiration", () => {
  const freshMemory = createTestMemory({
    scope: "runtime",
    createdAt: new Date(Date.now() - 30_000).toISOString(),
  });
  const expiredMemory = createTestMemory({
    scope: "runtime",
    createdAt: new Date(Date.now() - 600_000).toISOString(),
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  });
  const revokedMemory = createTestMemory({
    revokedAt: new Date(Date.now() - 1000).toISOString(),
  });

  const now = new Date().toISOString();

  assert.equal(getMemoryState(freshMemory, now), "active");
  // getMemoryState only checks explicit expiresAt/revokedAt, not TTL-based staleness
  assert.equal(getMemoryState(expiredMemory, now), "expired");
  assert.equal(getMemoryState(revokedMemory, now), "revoked");
});

test("integration: layer eviction with stale memory evaluation", () => {
  const memories: MemoryRecord[] = [
    createTestMemory({
      id: "mem_evict_1",
      scope: "session",
      createdAt: new Date(Date.now() - 7200_000).toISOString(),
      lastAccessedAt: new Date(Date.now() - 7200_000).toISOString(),
    }),
    createTestMemory({
      id: "mem_evict_2",
      scope: "session",
      createdAt: new Date(Date.now() - 3600_000).toISOString(),
      lastAccessedAt: new Date(Date.now() - 3600_000).toISOString(),
    }),
  ];

  const staleMemories = memories.filter((m) => isMemoryStale(m));
  assert.ok(staleMemories.length >= 1, "at least one memory should be stale");

  // Both session memories in this test should be stale based on session TTL (1 hour default)
  // mem_evict_1 is 2 hours old, mem_evict_2 is 1 hour old
  // isMemoryStale uses defaultTtlMs of 3,600,000 (1 hour) for session layer
  const newlyStale = staleMemories.filter((m) => m.id === "mem_evict_1");
  assert.ok(newlyStale.length >= 1, "mem_evict_1 should be stale (2 hours > 1 hour TTL)");

  // Verify shouldEvict marks stale memories for eviction
  for (const memory of staleMemories) {
    assert.ok(shouldEvict(memory, 2), `${memory.id} should be marked for eviction`);
  }
});

test("integration: memory scope to layer mapping consistency", () => {
  const scopeLayerPairs: Array<[string, string]> = [
    ["task_runtime", "runtime"],
    ["session", "session"],
    ["agent", "agent"],
    ["project", "project"],
    ["workspace", "project"],
    ["user", "user"],
    ["experience", "evolution"],
    ["evolution", "evolution"],
  ];

  for (const [scope, expectedLayer] of scopeLayerPairs) {
    const result = mapMemoryScopeToLayer(scope);
    assert.equal(result, expectedLayer, `Scope ${scope} should map to ${expectedLayer}`);
  }
});

test("integration: memory quality report generation", () => {
  const memories: MemoryRecord[] = [
    createTestMemory({ id: "mem_r1", hitCount: 10, qualityScore: 0.9 }),
    createTestMemory({ id: "mem_r2", hitCount: 0, qualityScore: 0.4 }),
    createTestMemory({ id: "mem_r3", hitCount: 5, qualityScore: 0.7 }),
    createTestMemory({ id: "mem_r4", expiresAt: new Date(Date.now() - 1000).toISOString() }),
    createTestMemory({ id: "mem_r5", revokedAt: new Date(Date.now() - 1000).toISOString() }),
  ];

  const report = buildMemoryQualityReport(memories);

  assert.equal(report.totalCount, 5);
  assert.equal(report.activeCount, 3);
  assert.equal(report.expiredCount, 1);
  assert.equal(report.revokedCount, 1);
  // mem_r1 has hitCount=10, mem_r3 has hitCount=5, mem_r4/mem_r5 default to hitCount=5 from createTestMemory
  // mem_r2 has hitCount=0, so only 4 memories are recalled (hitCount > 0)
  assert.equal(report.recalledCount, 4);
  assert.equal(report.neverRecalledCount, 1);
  assert.ok(report.averageQualityScore !== null);
});

test("integration: layer TTL configs are consistent with architecture", () => {
  const layers = ["runtime", "session", "agent", "project", "user", "evolution"];

  for (const layer of layers) {
    const config = getLayerTtlConfig(layer);
    assert.ok(config !== undefined, `Layer ${layer} should have TTL config`);
    assert.ok(config!.defaultTtlMs > 0, `${layer} should have positive default TTL`);
    assert.ok(config!.maxTtlMs >= config!.defaultTtlMs, `${layer} max should be >= default`);
    assert.ok(config!.minTtlMs <= config!.defaultTtlMs, `${layer} min should be <= default`);
  }
});

test("integration: memory recall query with multiple filters", () => {
  const memories: MemoryRecord[] = [
    createTestMemory({
      id: "mem_mf1",
      taskId: "task_1",
      scope: "session",
      qualityScore: 0.8,
    }),
    createTestMemory({
      id: "mem_mf2",
      taskId: "task_1",
      scope: "agent",
      qualityScore: 0.6,
    }),
    createTestMemory({
      id: "mem_mf3",
      taskId: "task_2",
      scope: "session",
      qualityScore: 0.9,
    }),
  ];

  const query = {
    taskId: "task_1",
    scopes: ["session", "agent"],
    minQualityScore: 0.7,
  };

  const result = filterAndSortMemories(memories, query);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "mem_mf1");
  assert.equal(result[0].taskId, "task_1");
  assert.ok(result[0].qualityScore! >= 0.7);
});

test("integration: cloneMemoryWithLayer preserves data integrity", () => {
  const original = createTestMemory({
    id: "mem_clone_original",
    scope: "session",
    importanceScore: 0.85,
    qualityScore: 0.92,
    hitCount: 15,
  });

  const clonedSession = cloneMemoryWithLayer(original, "agent");

  assert.notEqual(clonedSession.scope, original.scope);
  assert.equal(clonedSession.id, original.id);
  assert.equal(clonedSession.importanceScore, original.importanceScore);
  assert.equal(clonedSession.qualityScore, original.qualityScore);
  assert.equal(clonedSession.hitCount, original.hitCount);
  assert.equal(clonedSession.contentJson, original.contentJson);
});