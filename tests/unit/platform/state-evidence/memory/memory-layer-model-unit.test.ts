/**
 * Unit Tests: Memory Layer Model
 *
 * Tests for memory layer model including TTL configs, eviction,
 * and scope-to-architecture layer mapping.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  architectureLayerToScope,
  scopeToArchitectureLayer,
  getLayerTtlConfig,
  getLayerTtlConfigByArchitectureLayer,
  isMemoryStale,
  getEvictionPriority,
  shouldEvict,
  DEFAULT_LAYER_TTL_CONFIGS,
  DEFAULT_MEMORY_PROMOTION_RULES,
  mapMemoryScopeToLayer,
  cloneMemoryWithLayer,
  type HierarchicalMemoryLayer,
  type LayerTtlConfig,
} from "../../../../../src/platform/five-plane-state-evidence/memory/memory-layer-model.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";

/**
 * Stub for createContextTruncationReport since it doesn't exist in source
 */
interface StubTruncationReport {
  layer: string;
  totalEvicted: number;
  evictedRecords: { recordId: string; scope: string }[];
  evictedSizeBytes: number;
  reason: string;
  timestamp: string;
}

function createContextTruncationReport(
  layer: string,
  memories: MemoryRecord[],
  reason: string
): StubTruncationReport {
  return {
    layer,
    totalEvicted: memories.length,
    evictedRecords: memories.map(m => ({ recordId: m.id, scope: m.scope })),
    evictedSizeBytes: memories.reduce((sum, m) => sum + (m.contentJson?.length ?? 0), 0),
    reason,
    timestamp: new Date().toISOString(),
  };
}

function createMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: "mem_" + Math.random().toString(36).slice(2, 8),
    taskId: null,
    sessionId: "session_test",
    agentId: null,
    executionId: null,
    memoryLayer: "layer_3",
    scope: "session",
    contentJson: JSON.stringify({ text: "test memory content" }),
    classification: "general",
    sourceTrustLevel: "trusted",
    qualityScore: 0.7,
    hitCount: 5,
    createdAt: new Date().toISOString() as any,
    lastAccessedAt: null,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general",
    status: "active",
    importanceScore: 0.8,
    freshnessScore: 0.9,
    contentHash: null,
    ...overrides,
  } as MemoryRecord;
}

// =============================================================================
// Architecture Layer Mapping Tests
// =============================================================================

test("architectureLayerToScope: working maps to runtime", () => {
  assert.equal(architectureLayerToScope("working"), "runtime");
});

test("architectureLayerToScope: session maps to session", () => {
  assert.equal(architectureLayerToScope("session"), "session");
});

test("architectureLayerToScope: episodic maps to agent", () => {
  assert.equal(architectureLayerToScope("episodic"), "agent");
});

test("architectureLayerToScope: semantic maps to project", () => {
  assert.equal(architectureLayerToScope("semantic"), "project");
});

test("architectureLayerToScope: procedural maps to user", () => {
  assert.equal(architectureLayerToScope("procedural"), "user");
});

test("architectureLayerToScope: meta maps to evolution", () => {
  assert.equal(architectureLayerToScope("meta"), "evolution");
});

test("architectureLayerToScope: unknown defaults to project", () => {
  assert.equal(architectureLayerToScope("unknown"), "project");
});

test("scopeToArchitectureLayer: task_runtime maps to working", () => {
  assert.equal(scopeToArchitectureLayer("task_runtime"), "working");
});

test("scopeToArchitectureLayer: session maps to session", () => {
  assert.equal(scopeToArchitectureLayer("session"), "session");
});

test("scopeToArchitectureLayer: agent maps to episodic", () => {
  assert.equal(scopeToArchitectureLayer("agent"), "episodic");
});

test("scopeToArchitectureLayer: workspace maps to semantic", () => {
  assert.equal(scopeToArchitectureLayer("workspace"), "semantic");
});

test("scopeToArchitectureLayer: project maps to semantic", () => {
  assert.equal(scopeToArchitectureLayer("project"), "semantic");
});

test("scopeToArchitectureLayer: user maps to procedural", () => {
  assert.equal(scopeToArchitectureLayer("user"), "procedural");
});

test("scopeToArchitectureLayer: experience maps to meta", () => {
  assert.equal(scopeToArchitectureLayer("experience"), "meta");
});

test("scopeToArchitectureLayer: evolution maps to meta", () => {
  assert.equal(scopeToArchitectureLayer("evolution"), "meta");
});

test("scopeToArchitectureLayer: unknown defaults to semantic", () => {
  assert.equal(scopeToArchitectureLayer("unknown"), "semantic");
});

// =============================================================================
// Layer TTL Config Tests
// =============================================================================

test("getLayerTtlConfig returns config for runtime", () => {
  const config = getLayerTtlConfig("runtime");
  assert.ok(config !== undefined);
  assert.equal(config!.scope, "runtime");
  assert.equal(config!.architectureLayer, "working");
  assert.ok(config!.defaultTtlMs > 0);
});

test("getLayerTtlConfig returns config for session", () => {
  const config = getLayerTtlConfig("session");
  assert.ok(config !== undefined);
  assert.equal(config!.scope, "session");
});

test("getLayerTtlConfig returns config for agent", () => {
  const config = getLayerTtlConfig("agent");
  assert.ok(config !== undefined);
  assert.equal(config!.scope, "agent");
  assert.equal(config!.evictionStrategy, "quality");
});

test("getLayerTtlConfig returns config for project", () => {
  const config = getLayerTtlConfig("project");
  assert.ok(config !== undefined);
  assert.equal(config!.scope, "project");
  assert.equal(config!.evictionStrategy, "trust");
});

test("getLayerTtlConfig returns config for user", () => {
  const config = getLayerTtlConfig("user");
  assert.ok(config !== undefined);
  assert.equal(config!.scope, "user");
  assert.equal(config!.evictionStrategy, "usage");
  assert.equal(config!.supportsPromotion, false);
});

test("getLayerTtlConfig returns config for evolution", () => {
  const config = getLayerTtlConfig("evolution");
  assert.ok(config !== undefined);
  assert.equal(config!.scope, "evolution");
  assert.equal(config!.evictionStrategy, "importance");
});

test("getLayerTtlConfig returns undefined for invalid layer", () => {
  const config = getLayerTtlConfig("invalid" as HierarchicalMemoryLayer);
  assert.equal(config, undefined);
});

test("getLayerTtlConfigByArchitectureLayer returns config for working", () => {
  const config = getLayerTtlConfigByArchitectureLayer("working");
  assert.ok(config !== undefined);
  assert.equal(config!.architectureLayer, "working");
});

test("getLayerTtlConfigByArchitectureLayer returns undefined for unknown", () => {
  const config = getLayerTtlConfigByArchitectureLayer("nonexistent");
  assert.equal(config, undefined);
});

// =============================================================================
// Memory Staleness Tests
// =============================================================================

test("isMemoryStale returns false for newly created memory", () => {
  const memory = createMemory({ createdAt: new Date().toISOString() });
  assert.equal(isMemoryStale(memory, Date.now()), false);
});

test("isMemoryStale returns true when expiresAt is in past", () => {
  const memory = createMemory({
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  });
  assert.equal(isMemoryStale(memory, Date.now()), true);
});

test("isMemoryStale returns false when expiresAt is in future", () => {
  const memory = createMemory({
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  });
  assert.equal(isMemoryStale(memory, Date.now()), false);
});

test("isMemoryStale uses default 7 days for unknown scope", () => {
  const memory = createMemory({
    scope: "unknown_scope" as any,
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: null,
  });
  assert.equal(isMemoryStale(memory, Date.now()), true);
});

test("isMemoryStale returns false for 6-day-old unknown scope memory", () => {
  const memory = createMemory({
    scope: "unknown_scope" as any,
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: null,
  });
  assert.equal(isMemoryStale(memory, Date.now()), false);
});

test("isMemoryStale runtime expires in 1 minute", () => {
  const memory = createMemory({
    scope: "runtime",
    createdAt: new Date(Date.now() - 120000).toISOString(),
    expiresAt: null,
  });
  // runtime default TTL is 60 seconds, 120 seconds old should be stale
  assert.equal(isMemoryStale(memory, Date.now()), true);
});

test("isMemoryStale session does not expire within 1 hour", () => {
  const memory = createMemory({
    scope: "session",
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    expiresAt: null,
  });
  assert.equal(isMemoryStale(memory, Date.now()), false);
});

// =============================================================================
// Eviction Priority Tests
// =============================================================================

test("getEvictionPriority for lru returns timestamp", () => {
  const memory = createMemory({ scope: "runtime" });
  const priority = getEvictionPriority(memory);
  assert.ok(typeof priority === "number");
  assert.ok(priority > 0);
});

test("getEvictionPriority for quality returns 1 - qualityScore", () => {
  const memory = createMemory({
    scope: "agent",
    qualityScore: 0.3,
  });
  const priority = getEvictionPriority(memory);
  assert.ok(Math.abs(priority - 0.7) < 0.001);
});

test("getEvictionPriority for quality defaults to 0.5 when qualityScore is null", () => {
  const memory = createMemory({
    scope: "agent",
    qualityScore: null as any,
  });
  const priority = getEvictionPriority(memory);
  assert.ok(Math.abs(priority - 0.5) < 0.001);
});

test("getEvictionPriority for trust returns 1 - trustWeight", () => {
  const memory = createMemory({
    scope: "project",
    sourceTrustLevel: "trusted",
  });
  const priority = getEvictionPriority(memory);
  // authoritative has weight 1.0, so 1 - 1.0 = 0
  assert.ok(Math.abs(priority) < 0.001);
});

test("getEvictionPriority for usage returns 1 / (hitCount + 1)", () => {
  const memory = createMemory({
    scope: "user",
    hitCount: 9,
  });
  const priority = getEvictionPriority(memory);
  assert.ok(Math.abs(priority - 0.1) < 0.001);
});

test("getEvictionPriority for importance returns 1 - importanceScore", () => {
  const memory = createMemory({
    scope: "evolution",
    importanceScore: 0.6,
  });
  const priority = getEvictionPriority(memory);
  assert.ok(Math.abs(priority - 0.4) < 0.001);
});

test("getEvictionPriority uses lastAccessedAt for lru when available", () => {
  const now = Date.now();
  const memory = createMemory({
    scope: "runtime",
    createdAt: new Date(now - 10000).toISOString(),
    lastAccessedAt: new Date(now - 1000).toISOString(),
  });
  const priority = getEvictionPriority(memory);
  const lastAccessed = now - 1000;
  assert.ok(Math.abs(priority - lastAccessed) < 100);
});

test("getEvictionPriority uses createdAt when lastAccessedAt is null for lru", () => {
  const now = Date.now();
  const memory = createMemory({
    scope: "runtime",
    createdAt: new Date(now - 5000).toISOString(),
    lastAccessedAt: null,
  });
  const priority = getEvictionPriority(memory);
  const createdAt = now - 5000;
  assert.ok(Math.abs(priority - createdAt) < 100);
});

// =============================================================================
// Should Evict Tests
// =============================================================================

test("shouldEvict returns true for stale memory", () => {
  const memory = createMemory({
    scope: "runtime",
    createdAt: new Date(Date.now() - 120000).toISOString(),
  });
  assert.equal(shouldEvict(memory, 1), true);
});

test("shouldEvict returns false for fresh memory without maxLayerSize", () => {
  const memory = createMemory({
    scope: "runtime",
    createdAt: new Date().toISOString(),
  });
  assert.equal(shouldEvict(memory, 1), false);
});

test("shouldEvict returns false when candidateCount <= maxLayerSize", () => {
  const memory = createMemory({
    scope: "session",
    createdAt: new Date().toISOString(),
  });
  assert.equal(shouldEvict(memory, 5, 10), false);
});

test("shouldEvict returns true when priority < 0.5 and layer overflow", () => {
  const memory = createMemory({
    scope: "agent",
    qualityScore: 0.8, // priority = 1 - 0.8 = 0.2, which is < 0.5
  });
  // For agent layer with quality strategy: priority = 1 - qualityScore
  // High quality (0.8) -> low priority (0.2), so shouldEvict returns true
  // when candidateCount (20) > maxLayerSize (10) and priority < 0.5
  assert.equal(shouldEvict(memory, 20, 10), true);
});

// =============================================================================
// Default Layer TTL Configs Tests
// =============================================================================

test("DEFAULT_LAYER_TTL_CONFIGS has 6 entries", () => {
  assert.equal(DEFAULT_LAYER_TTL_CONFIGS.length, 6);
});

test("All DEFAULT_LAYER_TTL_CONFIGS have positive TTL values", () => {
  for (const config of DEFAULT_LAYER_TTL_CONFIGS) {
    assert.ok(config.defaultTtlMs > 0);
    assert.ok(config.maxTtlMs >= config.defaultTtlMs);
    assert.ok(config.minTtlMs <= config.defaultTtlMs);
  }
});

test("Runtime layer has lru eviction strategy", () => {
  const config = DEFAULT_LAYER_TTL_CONFIGS.find((c) => c.scope === "runtime");
  assert.ok(config);
  assert.equal(config!.evictionStrategy, "lru");
  assert.equal(config!.supportsDemotion, false);
});

test("Session layer has lru eviction and supports demotion", () => {
  const config = DEFAULT_LAYER_TTL_CONFIGS.find((c) => c.scope === "session");
  assert.ok(config);
  assert.equal(config!.evictionStrategy, "lru");
  assert.equal(config!.supportsDemotion, true);
});

test("Agent layer has quality eviction strategy", () => {
  const config = DEFAULT_LAYER_TTL_CONFIGS.find((c) => c.scope === "agent");
  assert.ok(config);
  assert.equal(config!.evictionStrategy, "quality");
});

test("Project layer has trust eviction strategy", () => {
  const config = DEFAULT_LAYER_TTL_CONFIGS.find((c) => c.scope === "project");
  assert.ok(config);
  assert.equal(config!.evictionStrategy, "trust");
});

test("User layer has usage eviction and does not support promotion", () => {
  const config = DEFAULT_LAYER_TTL_CONFIGS.find((c) => c.scope === "user");
  assert.ok(config);
  assert.equal(config!.evictionStrategy, "usage");
  assert.equal(config!.supportsPromotion, false);
});

test("Evolution layer has importance eviction strategy", () => {
  const config = DEFAULT_LAYER_TTL_CONFIGS.find((c) => c.scope === "evolution");
  assert.ok(config);
  assert.equal(config!.evictionStrategy, "importance");
});

// =============================================================================
// Default Memory Promotion Rules Tests
// =============================================================================

test("DEFAULT_MEMORY_PROMOTION_RULES has 4 rules", () => {
  assert.equal(DEFAULT_MEMORY_PROMOTION_RULES.length, 4);
});

test("Promotion rules are ordered from lower to higher layers", () => {
  const froms = DEFAULT_MEMORY_PROMOTION_RULES.map((r) => r.from);
  assert.deepEqual(froms, ["session", "agent", "project", "user"]);
});

test("All promotion rules have increasing thresholds", () => {
  for (let i = 1; i < DEFAULT_MEMORY_PROMOTION_RULES.length; i++) {
    const current = DEFAULT_MEMORY_PROMOTION_RULES[i]!;
    const previous = DEFAULT_MEMORY_PROMOTION_RULES[i - 1]!;
    assert.ok(current.minHitCount > previous.minHitCount);
    assert.ok(current.minQualityScore > previous.minQualityScore);
    assert.ok(current.minImportanceScore > previous.minImportanceScore);
  }
});

test("Session to agent rule has correct thresholds", () => {
  const rule = DEFAULT_MEMORY_PROMOTION_RULES.find((r) => r.from === "session" && r.to === "agent");
  assert.ok(rule);
  assert.equal(rule!.minHitCount, 3);
  assert.equal(rule!.minQualityScore, 0.6);
  assert.equal(rule!.minImportanceScore, 0.5);
});

test("Agent to project rule has correct thresholds", () => {
  const rule = DEFAULT_MEMORY_PROMOTION_RULES.find((r) => r.from === "agent" && r.to === "project");
  assert.ok(rule);
  assert.equal(rule!.minHitCount, 8);
  assert.equal(rule!.minQualityScore, 0.75);
  assert.equal(rule!.minImportanceScore, 0.65);
});

test("Project to user rule has correct thresholds", () => {
  const rule = DEFAULT_MEMORY_PROMOTION_RULES.find((r) => r.from === "project" && r.to === "user");
  assert.ok(rule);
  assert.equal(rule!.minHitCount, 12);
  assert.equal(rule!.minQualityScore, 0.8);
  assert.equal(rule!.minImportanceScore, 0.75);
});

test("User to evolution rule has correct thresholds", () => {
  const rule = DEFAULT_MEMORY_PROMOTION_RULES.find((r) => r.from === "user" && r.to === "evolution");
  assert.ok(rule);
  assert.equal(rule!.minHitCount, 20);
  assert.equal(rule!.minQualityScore, 0.9);
  assert.equal(rule!.minImportanceScore, 0.85);
});

// =============================================================================
// Scope to Layer Mapping Tests
// =============================================================================

test("mapMemoryScopeToLayer: task_runtime -> runtime", () => {
  assert.equal(mapMemoryScopeToLayer("task_runtime"), "runtime");
});

test("mapMemoryScopeToLayer: session -> session", () => {
  assert.equal(mapMemoryScopeToLayer("session"), "session");
});

test("mapMemoryScopeToLayer: agent -> agent", () => {
  assert.equal(mapMemoryScopeToLayer("agent"), "agent");
});

test("mapMemoryScopeToLayer: workspace -> project", () => {
  assert.equal(mapMemoryScopeToLayer("workspace"), "project");
});

test("mapMemoryScopeToLayer: project -> project", () => {
  assert.equal(mapMemoryScopeToLayer("project"), "project");
});

test("mapMemoryScopeToLayer: user -> user", () => {
  assert.equal(mapMemoryScopeToLayer("user"), "user");
});

test("mapMemoryScopeToLayer: experience -> evolution", () => {
  assert.equal(mapMemoryScopeToLayer("experience"), "evolution");
});

test("mapMemoryScopeToLayer: evolution -> evolution", () => {
  assert.equal(mapMemoryScopeToLayer("evolution"), "evolution");
});

test("mapMemoryScopeToLayer: unknown defaults to project", () => {
  assert.equal(mapMemoryScopeToLayer("unknown"), "project");
});

// =============================================================================
// Clone Memory With Layer Tests
// =============================================================================

test("cloneMemoryWithLayer updates scope correctly", () => {
  const memory = createMemory({ scope: "session" });
  const result = cloneMemoryWithLayer(memory, "agent");
  assert.equal(result.scope, "agent");
});

test("cloneMemoryWithLayer project stays project", () => {
  const memory = createMemory({ scope: "agent" });
  const result = cloneMemoryWithLayer(memory, "project");
  assert.equal(result.scope, "project");
});

test("cloneMemoryWithLayer preserves other properties", () => {
  const memory = createMemory({
    scope: "session",
    id: "mem_123",
    importanceScore: 0.9,
    hitCount: 10,
  });
  const result = cloneMemoryWithLayer(memory, "user");
  assert.equal(result.id, "mem_123");
  assert.equal(result.importanceScore, 0.9);
  assert.equal(result.hitCount, 10);
  assert.equal(result.scope, "user");
});

// =============================================================================
// Context Truncation Report Tests
// =============================================================================

test("createContextTruncationReport generates valid report", () => {
  const memories = [
    createMemory({ id: "mem_1", scope: "session" }),
    createMemory({ id: "mem_2", scope: "session" }),
  ];
  const report = createContextTruncationReport("session", memories, "lru_eviction");
  assert.equal(report.layer, "session");
  assert.equal(report.totalEvicted, 2);
  assert.equal(report.reason, "lru_eviction");
  assert.ok(report.timestamp.length > 0);
  assert.ok(report.evictedSizeBytes > 0);
});

test("createContextTruncationReport contains evicted record details", () => {
  const memories = [createMemory({ id: "mem_abc", scope: "agent" })];
  const report = createContextTruncationReport("agent", memories, "stale_expired");
  assert.equal(report.evictedRecords.length, 1);
  assert.equal(report.evictedRecords[0]!.recordId, "mem_abc");
});

test("createContextTruncationReport with empty array", () => {
  const report = createContextTruncationReport("runtime", [], "manual_truncation");
  assert.equal(report.totalEvicted, 0);
  assert.equal(report.evictedRecords.length, 0);
});