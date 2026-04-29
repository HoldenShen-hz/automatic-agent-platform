/**
 * Unit tests for memory-layer-model module
 *
 * Tests hierarchical memory layer configuration, TTL settings,
 * eviction strategies, and layer mapping functions.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  mapMemoryScopeToLayer,
  cloneMemoryWithLayer,
  DEFAULT_MEMORY_PROMOTION_RULES,
  architectureLayerToScope,
  scopeToArchitectureLayer,
  getLayerTtlConfig,
  getLayerTtlConfigByArchitectureLayer,
  isMemoryStale,
  getEvictionPriority,
  shouldEvict,
  createContextTruncationReport,
  DEFAULT_LAYER_TTL_CONFIGS,
} from "../../../../../src/platform/five-plane-state-evidence/memory/memory-layer-model.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createTestMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
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
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    lastAccessedAt: new Date(Date.now() - 1800_000).toISOString(),
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

test("mapMemoryScopeToLayer returns runtime for task_runtime", () => {
  assert.equal(mapMemoryScopeToLayer("task_runtime"), "runtime");
});

test("mapMemoryScopeToLayer returns session for session", () => {
  assert.equal(mapMemoryScopeToLayer("session"), "session");
});

test("mapMemoryScopeToLayer returns agent for agent", () => {
  assert.equal(mapMemoryScopeToLayer("agent"), "agent");
});

test("mapMemoryScopeToLayer returns project for workspace", () => {
  assert.equal(mapMemoryScopeToLayer("workspace"), "project");
});

test("mapMemoryScopeToLayer returns project for project", () => {
  assert.equal(mapMemoryScopeToLayer("project"), "project");
});

test("mapMemoryScopeToLayer returns user for user", () => {
  assert.equal(mapMemoryScopeToLayer("user"), "user");
});

test("mapMemoryScopeToLayer returns evolution for experience", () => {
  assert.equal(mapMemoryScopeToLayer("experience"), "evolution");
});

test("mapMemoryScopeToLayer returns evolution for evolution", () => {
  assert.equal(mapMemoryScopeToLayer("evolution"), "evolution");
});

test("mapMemoryScopeToLayer defaults to project for unknown scopes", () => {
  assert.equal(mapMemoryScopeToLayer("unknown_scope"), "project");
  assert.equal(mapMemoryScopeToLayer(""), "project");
  assert.equal(mapMemoryScopeToLayer("invalid"), "project");
});

test("cloneMemoryWithLayer updates scope to target layer", () => {
  const memory = createTestMemory({ scope: "session" });

  const result = cloneMemoryWithLayer(memory, "agent");
  assert.equal(result.scope, "agent");
  assert.equal(result.id, memory.id);
  assert.equal(result.contentJson, memory.contentJson);
});

test("cloneMemoryWithLayer project becomes project scope", () => {
  const memory = createTestMemory({ scope: "agent" });

  const result = cloneMemoryWithLayer(memory, "project");
  assert.equal(result.scope, "project");
});

test("cloneMemoryWithLayer preserves other properties", () => {
  const memory = createTestMemory({
    scope: "session",
    importanceScore: 0.8,
    hitCount: 5,
  });

  const result = cloneMemoryWithLayer(memory, "agent");
  assert.equal(result.id, memory.id);
  assert.equal(result.contentJson, memory.contentJson);
  assert.equal(result.importanceScore, 0.8);
  assert.equal(result.hitCount, 5);
});

test("DEFAULT_MEMORY_PROMOTION_RULES has correct structure", () => {
  assert.ok(DEFAULT_MEMORY_PROMOTION_RULES.length > 0);
  for (const rule of DEFAULT_MEMORY_PROMOTION_RULES) {
    assert.ok(rule.from !== undefined);
    assert.ok(rule.to !== undefined);
    assert.ok(rule.minHitCount >= 0);
    assert.ok(rule.minQualityScore >= 0 && rule.minQualityScore <= 1);
    assert.ok(rule.minImportanceScore >= 0 && rule.minImportanceScore <= 1);
  }
});

test("DEFAULT_MEMORY_PROMOTION_RULES has increasing thresholds", () => {
  for (let i = 1; i < DEFAULT_MEMORY_PROMOTION_RULES.length; i++) {
    const prev = DEFAULT_MEMORY_PROMOTION_RULES[i - 1];
    const curr = DEFAULT_MEMORY_PROMOTION_RULES[i];
    assert.ok(prev !== undefined);
    assert.ok(curr !== undefined);
    assert.ok(curr.minHitCount > prev.minHitCount);
    assert.ok(curr.minQualityScore > prev.minQualityScore);
    assert.ok(curr.minImportanceScore > prev.minImportanceScore);
  }
});

test("DEFAULT_MEMORY_PROMOTION_RULES covers session to agent", () => {
  const rule = DEFAULT_MEMORY_PROMOTION_RULES.find((r) => r.from === "session" && r.to === "agent");
  assert.ok(rule !== undefined);
  assert.equal(rule!.minHitCount, 3);
  assert.equal(rule!.minQualityScore, 0.6);
  assert.equal(rule!.minImportanceScore, 0.5);
});

test("DEFAULT_MEMORY_PROMOTION_RULES covers agent to project", () => {
  const rule = DEFAULT_MEMORY_PROMOTION_RULES.find((r) => r.from === "agent" && r.to === "project");
  assert.ok(rule !== undefined);
  assert.equal(rule!.minHitCount, 8);
  assert.equal(rule!.minQualityScore, 0.75);
  assert.equal(rule!.minImportanceScore, 0.65);
});

test("DEFAULT_MEMORY_PROMOTION_RULES covers project to user", () => {
  const rule = DEFAULT_MEMORY_PROMOTION_RULES.find((r) => r.from === "project" && r.to === "user");
  assert.ok(rule !== undefined);
  assert.equal(rule!.minHitCount, 12);
  assert.equal(rule!.minQualityScore, 0.8);
  assert.equal(rule!.minImportanceScore, 0.75);
});

test("DEFAULT_MEMORY_PROMOTION_RULES covers user to evolution", () => {
  const rule = DEFAULT_MEMORY_PROMOTION_RULES.find((r) => r.from === "user" && r.to === "evolution");
  assert.ok(rule !== undefined);
  assert.equal(rule!.minHitCount, 20);
  assert.equal(rule!.minQualityScore, 0.9);
  assert.equal(rule!.minImportanceScore, 0.85);
});

test("architectureLayerToScope maps working to runtime", () => {
  assert.equal(architectureLayerToScope("working"), "runtime");
});

test("architectureLayerToScope maps session to session", () => {
  assert.equal(architectureLayerToScope("session"), "session");
});

test("architectureLayerToScope maps episodic to agent", () => {
  assert.equal(architectureLayerToScope("episodic"), "agent");
});

test("architectureLayerToScope maps semantic to project", () => {
  assert.equal(architectureLayerToScope("semantic"), "project");
});

test("architectureLayerToScope maps procedural to user", () => {
  assert.equal(architectureLayerToScope("procedural"), "user");
});

test("architectureLayerToScope maps meta to evolution", () => {
  assert.equal(architectureLayerToScope("meta"), "evolution");
});

test("architectureLayerToScope defaults to project for unknown", () => {
  assert.equal(architectureLayerToScope("unknown"), "project");
});

test("scopeToArchitectureLayer maps task_runtime to working", () => {
  assert.equal(scopeToArchitectureLayer("task_runtime"), "working");
});

test("scopeToArchitectureLayer maps task_runtime to working", () => {
  assert.equal(scopeToArchitectureLayer("task_runtime"), "working");
});

test("scopeToArchitectureLayer maps session to session", () => {
  assert.equal(scopeToArchitectureLayer("session"), "session");
});

test("scopeToArchitectureLayer maps agent to episodic", () => {
  assert.equal(scopeToArchitectureLayer("agent"), "episodic");
});

test("scopeToArchitectureLayer maps project to semantic", () => {
  assert.equal(scopeToArchitectureLayer("project"), "semantic");
});

test("scopeToArchitectureLayer maps workspace to semantic", () => {
  assert.equal(scopeToArchitectureLayer("workspace"), "semantic");
});

test("scopeToArchitectureLayer maps user to procedural", () => {
  assert.equal(scopeToArchitectureLayer("user"), "procedural");
});

test("scopeToArchitectureLayer maps evolution to meta", () => {
  assert.equal(scopeToArchitectureLayer("evolution"), "meta");
});

test("scopeToArchitectureLayer maps experience to meta", () => {
  assert.equal(scopeToArchitectureLayer("experience"), "meta");
});

test("scopeToArchitectureLayer defaults to semantic for unknown", () => {
  assert.equal(scopeToArchitectureLayer("unknown"), "semantic");
});

test("DEFAULT_LAYER_TTL_CONFIGS has 6 layers", () => {
  assert.equal(DEFAULT_LAYER_TTL_CONFIGS.length, 6);
});

test("getLayerTtlConfig returns config for runtime", () => {
  const config = getLayerTtlConfig("runtime");
  assert.ok(config !== undefined);
  assert.equal(config!.scope, "runtime");
  assert.equal(config!.architectureLayer, "working");
  assert.ok(config!.defaultTtlMs > 0);
  assert.ok(config!.maxTtlMs >= config!.defaultTtlMs);
  assert.ok(config!.minTtlMs <= config!.defaultTtlMs);
});

test("getLayerTtlConfig returns config for session", () => {
  const config = getLayerTtlConfig("session");
  assert.ok(config !== undefined);
  assert.equal(config!.scope, "session");
  assert.equal(config!.architectureLayer, "session");
  assert.ok(config!.supportsPromotion);
  assert.ok(config!.supportsDemotion);
});

test("getLayerTtlConfig returns config for agent", () => {
  const config = getLayerTtlConfig("agent");
  assert.ok(config !== undefined);
  assert.equal(config!.evictionStrategy, "quality");
});

test("getLayerTtlConfig returns config for project", () => {
  const config = getLayerTtlConfig("project");
  assert.ok(config !== undefined);
  assert.equal(config!.evictionStrategy, "trust");
});

test("getLayerTtlConfig returns config for user", () => {
  const config = getLayerTtlConfig("user");
  assert.ok(config !== undefined);
  assert.equal(config!.evictionStrategy, "usage");
  assert.ok(!config!.supportsPromotion);
});

test("getLayerTtlConfig returns config for evolution", () => {
  const config = getLayerTtlConfig("evolution");
  assert.ok(config !== undefined);
  assert.equal(config!.evictionStrategy, "importance");
});

test("getLayerTtlConfig returns undefined for unknown", () => {
  assert.equal(getLayerTtlConfig("unknown"), undefined);
});

test("getLayerTtlConfigByArchitectureLayer returns config for working", () => {
  const config = getLayerTtlConfigByArchitectureLayer("working");
  assert.ok(config !== undefined);
  assert.equal(config!.architectureLayer, "working");
  assert.equal(config!.scope, "runtime");
});

test("getLayerTtlConfigByArchitectureLayer returns undefined for unknown", () => {
  assert.equal(getLayerTtlConfigByArchitectureLayer("unknown"), undefined);
});

test("isMemoryStale returns false for fresh memory", () => {
  const memory = createTestMemory({
    scope: "runtime",
    createdAt: new Date(Date.now() - 30_000).toISOString(),
  });
  assert.equal(isMemoryStale(memory, Date.now()), false);
});

test("isMemoryStale returns true for expired memory", () => {
  const memory = createTestMemory({
    scope: "runtime",
    createdAt: new Date(Date.now() - 600_000).toISOString(),
  });
  assert.equal(isMemoryStale(memory, Date.now()), true);
});

test("isMemoryStale respects explicit expiresAt", () => {
  const pastTime = new Date(Date.now() - 1000).toISOString();
  const memory = createTestMemory({ expiresAt: pastTime });
  assert.equal(isMemoryStale(memory, Date.now()), true);

  const futureTime = new Date(Date.now() + 60000).toISOString();
  const futureMemory = createTestMemory({ expiresAt: futureTime });
  assert.equal(isMemoryStale(futureMemory, Date.now()), false);
});

test("getEvictionPriority returns numeric value", () => {
  const memory = createTestMemory({ scope: "session" });
  const priority = getEvictionPriority(memory);
  assert.ok(typeof priority === "number");
});

test("shouldEvict returns true for stale memory", () => {
  const memory = createTestMemory({
    scope: "runtime",
    createdAt: new Date(Date.now() - 600_000).toISOString(),
  });
  assert.equal(shouldEvict(memory, 10), true);
});

test("shouldEvict returns false for fresh memory without maxLayerSize", () => {
  const memory = createTestMemory({
    scope: "runtime",
    createdAt: new Date(Date.now() - 30_000).toISOString(),
  });
  assert.equal(shouldEvict(memory, 10), false);
});

test("shouldEvict returns false when under maxLayerSize", () => {
  const memory = createTestMemory({
    scope: "session",
    createdAt: new Date(Date.now() - 30_000).toISOString(),
  });
  assert.equal(shouldEvict(memory, 5, 10), false);
});

test("createContextTruncationReport generates valid report", () => {
  const memories = [
    createTestMemory({ id: "mem_1", scope: "session" }),
    createTestMemory({ id: "mem_2", scope: "session" }),
  ];

  const report = createContextTruncationReport("session", memories, "lru_eviction");

  assert.equal(report.layer, "session");
  assert.equal(report.totalEvicted, 2);
  assert.equal(report.evictedRecords.length, 2);
  assert.equal(report.reason, "lru_eviction");
  assert.ok(report.timestamp !== undefined);
  assert.ok(report.evictedSizeBytes > 0);
});

test("createContextTruncationReport includes record details", () => {
  const memories = [createTestMemory({ id: "mem_1", scope: "agent" })];

  const report = createContextTruncationReport("agent", memories, "quality_below_threshold");

  assert.equal(report.evictedRecords[0].recordId, "mem_1");
  assert.equal(report.evictedRecords[0].scope, "agent");
});

test("DEFAULT_LAYER_TTL_CONFIGS runtime has LRU eviction", () => {
  const config = getLayerTtlConfig("runtime");
  assert.ok(config !== undefined);
  assert.equal(config!.evictionStrategy, "lru");
  assert.ok(config!.supportsPromotion);
  assert.ok(!config!.supportsDemotion);
});

test("DEFAULT_LAYER_TTL_CONFIGS user does not support promotion", () => {
  const config = getLayerTtlConfig("user");
  assert.ok(config !== undefined);
  assert.ok(!config!.supportsPromotion);
  assert.ok(config!.supportsDemotion);
});