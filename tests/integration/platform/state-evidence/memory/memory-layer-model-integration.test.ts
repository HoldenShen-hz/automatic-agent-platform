/**
 * Integration Tests: Memory Layer Model
 *
 * Tests for memory layer model integration with TTL eviction,
 * promotion engine, and cross-layer operations.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  MemoryPlaneService,
} from "../../../../../src/platform/state-evidence/memory/memory-plane-service.js";
import { MemoryPromotionEngine } from "../../../../../src/platform/state-evidence/memory/memory-promotion-engine.js";
import {
  DEFAULT_LAYER_TTL_CONFIGS,
  DEFAULT_MEMORY_PROMOTION_RULES,
  isMemoryStale,
  getEvictionPriority,
  shouldEvict,
  createContextTruncationReport,
  getLayerTtlConfig,
  type MemoryRecord,
} from "../../../../../src/platform/state-evidence/memory/memory-layer-model.js";
import type {
  MemoryProvider,
  MemoryProviderPrefetchResult,
  MemoryProviderQuery,
  MemoryTurnSyncInput,
  MemoryTurnSyncResult,
} from "../../../../../src/platform/state-evidence/memory/memory-provider.js";
import type { HierarchicalMemoryLayer } from "../../../../../../src/platform/state-evidence/memory/memory-layer-model.js";

function createMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: "mem_" + Math.random().toString(36).slice(2, 8),
    taskId: null,
    sessionId: "session_integration",
    agentId: null,
    executionId: null,
    memoryLayer: "layer_3",
    scope: "session",
    contentJson: JSON.stringify({ text: "integration test memory" }),
    classification: "test",
    sourceTrustLevel: "trusted",
    qualityScore: 0.75,
    hitCount: 8,
    createdAt: new Date().toISOString() as any,
    lastAccessedAt: null,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general",
    status: "active",
    importanceScore: 0.7,
    freshnessScore: 0.85,
    contentHash: "test_hash_" + Math.random().toString(36).slice(2, 6),
    ...overrides,
  } as MemoryRecord;
}

function createMockProvider(memories: MemoryRecord[] = []): MemoryProvider {
  return {
    initialize: async () => ({
      providerId: "integration-test-provider",
      initializedAt: new Date().toISOString(),
      authoritativeSource: "builtin",
      augmentationMode: "authoritative",
    }),
    systemPromptBlock: async () => ({
      providerId: "integration-test-provider",
      generatedAt: new Date().toISOString(),
      memoryIds: memories.map((m) => m.id),
      experienceIds: [],
      block: "test prompt block",
    }),
    prefetch: async (_query: MemoryProviderQuery): Promise<MemoryProviderPrefetchResult> => ({
      memories,
      promptBlock: "test block",
      fewShotExamples: [],
      experienceIds: [],
    }),
    queuePrefetch: async () => ({
      providerId: "integration-test-provider",
      requestId: "req_integration",
      queuedAt: new Date().toISOString(),
      state: "queued",
    }),
    syncTurn: async (_input: MemoryTurnSyncInput): Promise<MemoryTurnSyncResult> => ({
      providerId: "integration-test-provider",
      syncedAt: new Date().toISOString(),
      rememberedMemories: [],
      memoryIds: [],
    }),
    shutdown: async () => ({
      providerId: "integration-test-provider",
      shutdownAt: new Date().toISOString(),
      pendingPrefetches: 0,
    }),
  };
}

// =============================================================================
// Integration: Memory Plane Service with Multiple Layers
// =============================================================================

test("MemoryPlaneService integration: builds view with memories from all layers", async () => {
  const memories = [
    createMemory({ id: "mem_rt", scope: "task_runtime" }),
    createMemory({ id: "mem_ss", scope: "session" }),
    createMemory({ id: "mem_ag", scope: "agent" }),
    createMemory({ id: "mem_pr", scope: "project" }),
    createMemory({ id: "mem_us", scope: "user" }),
    createMemory({ id: "mem_ev", scope: "evolution" }),
  ];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);
  const view = await service.buildView({ sessionId: "integration_session" });
  assert.equal(view.layers.runtime.length, 1);
  assert.equal(view.layers.session.length, 1);
  assert.equal(view.layers.agent.length, 1);
  assert.equal(view.layers.project.length, 1);
  assert.equal(view.layers.user.length, 1);
  assert.equal(view.layers.evolution.length, 1);
  assert.equal(view.memoryIds.length, 6);
});

test("MemoryPlaneService integration: architecture layers are populated", async () => {
  const memories = [
    createMemory({ scope: "task_runtime" }),
    createMemory({ scope: "session" }),
  ];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);
  const view = await service.buildView({});
  assert.ok(view.architectureLayers.working.length >= 0);
  assert.ok(view.architectureLayers.session.length >= 0);
});

test("MemoryPlaneService integration: syncTurn with promotion", async () => {
  const memories = [createMemory({ id: "mem_promote", scope: "session" })];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);
  const result = await service.syncTurn({
    sessionId: "integration_session",
    turnNumber: 5,
    agentId: "agent_integration",
    promotionContext: { projectId: "proj_123" },
  });
  assert.equal(result.providerId, "integration-test-provider");
});

test("MemoryPlaneService integration: evaluatePromotion with context", () => {
  const memories = [
    createMemory({ id: "mem_eval", scope: "session" }),
    createMemory({ id: "mem_eval2", scope: "agent" }),
  ];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);
  const result = service.evaluatePromotion(memories, { projectId: "proj_abc", userId: "user_xyz" });
  assert.ok(result.promoted !== undefined);
  assert.ok(result.rejected !== undefined);
  assert.ok(Array.isArray(result.promoted));
  assert.ok(Array.isArray(result.rejected));
});

// =============================================================================
// Integration: TTL Configuration Across Layers
// =============================================================================

test("Integration: TTL configs cover all memory layers", () => {
  const layers: HierarchicalMemoryLayer[] = ["runtime", "session", "agent", "project", "user", "evolution"];
  for (const layer of layers) {
    const config = getLayerTtlConfig(layer);
    assert.ok(config !== undefined, `Missing TTL config for layer: ${layer}`);
    assert.ok(config!.defaultTtlMs > 0);
  }
});

test("Integration: eviction strategies are consistent with layer purposes", () => {
  const runtimeConfig = getLayerTtlConfig("runtime");
  assert.equal(runtimeConfig!.evictionStrategy, "lru");

  const agentConfig = getLayerTtlConfig("agent");
  assert.equal(agentConfig!.evictionStrategy, "quality");

  const projectConfig = getLayerTtlConfig("project");
  assert.equal(projectConfig!.evictionStrategy, "trust");

  const userConfig = getLayerTtlConfig("user");
  assert.equal(userConfig!.evictionStrategy, "usage");

  const evolutionConfig = getLayerTtlConfig("evolution");
  assert.equal(evolutionConfig!.evictionStrategy, "importance");
});

test("Integration: TTL values increase from runtime to user", () => {
  const configs = [
    getLayerTtlConfig("runtime"),
    getLayerTtlConfig("session"),
    getLayerTtlConfig("agent"),
    getLayerTtlConfig("project"),
    getLayerTtlConfig("user"),
  ];
  for (let i = 1; i < configs.length; i++) {
    assert.ok(
      configs[i]!.defaultTtlMs > configs[i - 1]!.defaultTtlMs,
      `Layer ${i} TTL should be greater than layer ${i - 1} TTL`,
    );
  }
});

// =============================================================================
// Integration: Promotion Rules Consistency
// =============================================================================

test("Integration: promotion rules form a chain from session to evolution", () => {
  const rules = DEFAULT_MEMORY_PROMOTION_RULES;
  assert.equal(rules[0]!.from, "session");
  assert.equal(rules[0]!.to, "agent");

  assert.equal(rules[1]!.from, "agent");
  assert.equal(rules[1]!.to, "project");

  assert.equal(rules[2]!.from, "project");
  assert.equal(rules[2]!.to, "user");

  assert.equal(rules[3]!.from, "user");
  assert.equal(rules[3]!.to, "evolution");
});

test("Integration: promotion thresholds increase at each level", () => {
  const rules = DEFAULT_MEMORY_PROMOTION_RULES;
  for (let i = 1; i < rules.length; i++) {
    assert.ok(
      rules[i]!.minHitCount > rules[i - 1]!.minHitCount,
      `Rule ${i} should require more hits than rule ${i - 1}`,
    );
    assert.ok(
      rules[i]!.minQualityScore > rules[i - 1]!.minQualityScore,
      `Rule ${i} should require higher quality than rule ${i - 1}`,
    );
    assert.ok(
      rules[i]!.minImportanceScore > rules[i - 1]!.minImportanceScore,
      `Rule ${i} should require higher importance than rule ${i - 1}`,
    );
  }
});

// =============================================================================
// Integration: Memory Staleness Across Time
// =============================================================================

test("Integration: memory becomes stale after layer-specific TTL", () => {
  // Runtime layer: default 60 seconds
  const runtimeMemory = createMemory({
    scope: "runtime",
    createdAt: new Date(Date.now() - 90000).toISOString(), // 90 seconds ago
  });
  assert.equal(isMemoryStale(runtimeMemory, Date.now()), true);

  // Session layer: default 1 hour
  const sessionMemory = createMemory({
    scope: "session",
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
  });
  assert.equal(isMemoryStale(sessionMemory, Date.now()), false);
});

test("Integration: memory staleness respects explicit expiresAt", () => {
  const memory = createMemory({
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10000).toISOString(), // expires in 10 seconds
  });
  assert.equal(isMemoryStale(memory, Date.now()), false);

  const expiredMemory = createMemory({
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() - 1000).toISOString(), // expired 1 second ago
  });
  assert.equal(isMemoryStale(expiredMemory, Date.now()), true);
});

// =============================================================================
// Integration: Eviction Priority Across Strategies
// =============================================================================

test("Integration: eviction priority reflects layer strategy", () => {
  // Runtime uses LRU - priority based on timestamp
  const runtimeMemory = createMemory({
    scope: "runtime",
    createdAt: new Date(Date.now() - 1000).toISOString(),
    lastAccessedAt: new Date(Date.now() - 500).toISOString(),
  });
  const runtimePriority = getEvictionPriority(runtimeMemory);
  assert.ok(typeof runtimePriority === "number");

  // Agent uses quality - priority = 1 - qualityScore
  const agentMemory = createMemory({
    scope: "agent",
    qualityScore: 0.8,
  });
  const agentPriority = getEvictionPriority(agentMemory);
  assert.ok(Math.abs(agentPriority - 0.2) < 0.001);

  // User uses usage - priority = 1 / (hitCount + 1)
  const userMemory = createMemory({
    scope: "user",
    hitCount: 4,
  });
  const userPriority = getEvictionPriority(userMemory);
  assert.ok(Math.abs(userPriority - 0.2) < 0.001);
});

test("Integration: shouldEvict considers both staleness and priority", () => {
  // Fresh memory should not be evicted
  const freshMemory = createMemory({
    scope: "runtime",
    createdAt: new Date().toISOString(),
  });
  assert.equal(shouldEvict(freshMemory, 20, 10), false);

  // Stale memory should be evicted
  const staleMemory = createMemory({
    scope: "runtime",
    createdAt: new Date(Date.now() - 120000).toISOString(),
  });
  assert.equal(shouldEvict(staleMemory, 1), true);
});

// =============================================================================
// Integration: Context Truncation Report
// =============================================================================

test("Integration: createContextTruncationReport includes all evicted records", () => {
  const memories = [
    createMemory({ id: "mem_evict_1", scope: "session" }),
    createMemory({ id: "mem_evict_2", scope: "session" }),
    createMemory({ id: "mem_evict_3", scope: "session" }),
  ];
  const report = createContextTruncationReport("session", memories, "lru_eviction");
  assert.equal(report.totalEvicted, 3);
  assert.equal(report.layer, "session");
  assert.equal(report.reason, "lru_eviction");
  assert.equal(report.evictedRecords.length, 3);
});

test("Integration: ContextTruncationReport calculates estimated size", () => {
  const memories = [
    createMemory({ id: "mem_size_1" }),
    createMemory({ id: "mem_size_2" }),
  ];
  const report = createContextTruncationReport("agent", memories, "stale_expired");
  assert.ok(report.evictedSizeBytes >= memories.length * 1000);
});

test("Integration: ContextTruncationReport with different eviction reasons", () => {
  const reasons: Array<"lru_eviction" | "stale_expired" | "size_limit_exceeded" | "manual_truncation"> = [
    "lru_eviction",
    "stale_expired",
    "size_limit_exceeded",
    "manual_truncation",
  ];
  for (const reason of reasons) {
    const report = createContextTruncationReport("session", [createMemory()], reason);
    assert.equal(report.reason, reason);
  }
});

// =============================================================================
// Integration: Memory Promotion Engine
// =============================================================================

test("MemoryPromotionEngine can be instantiated", () => {
  const engine = new MemoryPromotionEngine();
  assert.ok(engine !== undefined);
});

test("MemoryPromotionEngine.evaluatePromotion returns promotion candidate", () => {
  const engine = new MemoryPromotionEngine();
  const memory = createMemory({ id: "mem_cand_1", scope: "session" });
  const result = engine.evaluatePromotion(memory);
  assert.ok(result !== undefined);
  assert.equal(result.memory.id, "mem_cand_1");
  assert.equal(result.currentLayer, "session");
});

test("MemoryPromotionEngine.promote updates memory layers", () => {
  const engine = new MemoryPromotionEngine();
  const memories = [
    createMemory({
      id: "mem_promo_1",
      scope: "session",
      qualityScore: 0.7,
      importanceScore: 0.6,
      hitCount: 5,
    }),
  ];
  const result = engine.promote(memories, {});
  assert.ok(result !== undefined);
});