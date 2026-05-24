import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LAYER_TTL_CONFIGS,
  DEFAULT_MEMORY_PROMOTION_RULES,
  architectureLayerToScope,
  cloneMemoryWithLayer,
  createContextTruncationReport,
  getEvictionPriority,
  getLayerTtlConfig,
  getLayerTtlConfigByArchitectureLayer,
  isMemoryStale,
  mapMemoryScopeToLayer,
  scopeToArchitectureLayer,
  shouldEvict,
} from "../../../../../src/platform/five-plane-state-evidence/memory/memory-layer-model.js";
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

test("memory layer mapping follows the canonical architecture rules", () => {
  assert.equal(mapMemoryScopeToLayer("task_runtime"), "runtime");
  assert.equal(mapMemoryScopeToLayer("workspace"), "project");
  assert.equal(architectureLayerToScope("episodic"), "agent");
  assert.equal(scopeToArchitectureLayer("experience"), "meta");
  assert.throws(() => mapMemoryScopeToLayer("unknown_scope"), /memory\.layer_unknown/);
});

test("ttl configuration helpers expose stable layer metadata", () => {
  assert.equal(DEFAULT_LAYER_TTL_CONFIGS.length, 6);
  assert.equal(DEFAULT_MEMORY_PROMOTION_RULES.length > 0, true);
  assert.equal(getLayerTtlConfig("session")?.evictionStrategy, "lru");
  assert.equal(getLayerTtlConfigByArchitectureLayer("semantic")?.scope, "project");
});

test("cloneMemoryWithLayer only changes the scope field", () => {
  const memory = createMemory({ scope: "session", classification: "important" });

  const cloned = cloneMemoryWithLayer(memory, "agent");

  assert.equal(cloned.scope, "agent");
  assert.equal(cloned.id, memory.id);
  assert.equal(cloned.classification, "important");
});

test("staleness and eviction logic use ttl and trust-aware scoring", () => {
  const staleMemory = createMemory({
    scope: "runtime",
    createdAt: "2026-05-24T00:00:00.000Z",
  });
  const trustMemory = createMemory({
    scope: "project",
    sourceTrustLevel: "external",
  });
  let evictionReason: string | null = null;

  assert.equal(isMemoryStale(staleMemory, Date.parse("2026-05-24T00:02:00.000Z")), true);
  assert.ok(getEvictionPriority(trustMemory) > 0);
  assert.equal(
    shouldEvict(staleMemory, 1, undefined, (_memory, reason) => {
      evictionReason = reason;
    }),
    true,
  );
  assert.equal(evictionReason, "ttl_expired");
});

test("context truncation report preserves evicted memory metadata", () => {
  const report = createContextTruncationReport("runtime", [
    createMemory({ id: "memory-a", scope: "runtime", qualityScore: 0.4 }),
    createMemory({ id: "memory-b", scope: "runtime", qualityScore: 0.2 }),
  ], "size_limit_exceeded");

  assert.equal(report.layer, "runtime");
  assert.equal(report.totalEvicted, 2);
  assert.equal(report.evictedMemories[0]?.memoryId, "memory-a");
  assert.equal(report.evictedRecords[1]?.memoryId, "memory-b");
});
