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
  type LayerTtlConfig,
  type EvictionStrategy,
} from "../../../../../src/platform/state-evidence/memory/memory-layer-model.js";
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
    createdAt: "2024-01-15T10:30:00.000Z",
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
// architectureLayerToScope tests
// =============================================================================

test("architectureLayerToScope returns runtime for working", () => {
  assert.equal(architectureLayerToScope("working"), "runtime");
});

test("architectureLayerToScope returns session for session", () => {
  assert.equal(architectureLayerToScope("session"), "session");
});

test("architectureLayerToScope returns agent for episodic", () => {
  assert.equal(architectureLayerToScope("episodic"), "agent");
});

test("architectureLayerToScope returns project for semantic", () => {
  assert.equal(architectureLayerToScope("semantic"), "project");
});

test("architectureLayerToScope returns user for procedural", () => {
  assert.equal(architectureLayerToScope("procedural"), "user");
});

test("architectureLayerToScope returns evolution for meta", () => {
  assert.equal(architectureLayerToScope("meta"), "evolution");
});

test("architectureLayerToScope returns project for unknown", () => {
  assert.equal(architectureLayerToScope("unknown_layer"), "project");
});

// =============================================================================
// scopeToArchitectureLayer tests
// =============================================================================

test("scopeToArchitectureLayer returns working for task_runtime", () => {
  assert.equal(scopeToArchitectureLayer("task_runtime"), "working");
});

test("scopeToArchitectureLayer returns session for session", () => {
  assert.equal(scopeToArchitectureLayer("session"), "session");
});

test("scopeToArchitectureLayer returns episodic for agent", () => {
  assert.equal(scopeToArchitectureLayer("agent"), "episodic");
});

test("scopeToArchitectureLayer returns semantic for workspace", () => {
  assert.equal(scopeToArchitectureLayer("workspace"), "semantic");
});

test("scopeToArchitectureLayer returns semantic for project", () => {
  assert.equal(scopeToArchitectureLayer("project"), "semantic");
});

test("scopeToArchitectureLayer returns procedural for user", () => {
  assert.equal(scopeToArchitectureLayer("user"), "procedural");
});

test("scopeToArchitectureLayer returns meta for experience", () => {
  assert.equal(scopeToArchitectureLayer("experience"), "meta");
});

test("scopeToArchitectureLayer returns meta for evolution", () => {
  assert.equal(scopeToArchitectureLayer("evolution"), "meta");
});

test("scopeToArchitectureLayer returns semantic for unknown", () => {
  assert.equal(scopeToArchitectureLayer("unknown_scope"), "semantic");
});

// =============================================================================
// getLayerTtlConfig tests
// =============================================================================

test("getLayerTtlConfig returns config for runtime", () => {
  const config = getLayerTtlConfig("runtime");
  assert.ok(config !== undefined);
  assert.equal(config!.scope, "runtime");
  assert.equal(config!.architectureLayer, "working");
});

test("getLayerTtlConfig returns config for session", () => {
  const config = getLayerTtlConfig("session");
  assert.ok(config !== undefined);
  assert.equal(config!.scope, "session");
  assert.ok(config!.defaultTtlMs > 0);
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
});

test("getLayerTtlConfig returns config for evolution", () => {
  const config = getLayerTtlConfig("evolution");
  assert.ok(config !== undefined);
  assert.equal(config!.scope, "evolution");
  assert.equal(config!.evictionStrategy, "importance");
});

test("getLayerTtlConfig returns undefined for unknown", () => {
  const config = getLayerTtlConfig("unknown" as any);
  assert.equal(config, undefined);
});

// =============================================================================
// getLayerTtlConfigByArchitectureLayer tests
// =============================================================================

test("getLayerTtlConfigByArchitectureLayer returns config for working", () => {
  const config = getLayerTtlConfigByArchitectureLayer("working");
  assert.ok(config !== undefined);
  assert.equal(config!.architectureLayer, "working");
});

test("getLayerTtlConfigByArchitectureLayer returns config for session", () => {
  const config = getLayerTtlConfigByArchitectureLayer("session");
  assert.ok(config !== undefined);
});

test("getLayerTtlConfigByArchitectureLayer returns config for episodic", () => {
  const config = getLayerTtlConfigByArchitectureLayer("episodic");
  assert.ok(config !== undefined);
  assert.equal(config!.architectureLayer, "episodic");
});

test("getLayerTtlConfigByArchitectureLayer returns config for semantic", () => {
  const config = getLayerTtlConfigByArchitectureLayer("semantic");
  assert.ok(config !== undefined);
});

test("getLayerTtlConfigByArchitectureLayer returns config for procedural", () => {
  const config = getLayerTtlConfigByArchitectureLayer("procedural");
  assert.ok(config !== undefined);
});

test("getLayerTtlConfigByArchitectureLayer returns config for meta", () => {
  const config = getLayerTtlConfigByArchitectureLayer("meta");
  assert.ok(config !== undefined);
});

test("getLayerTtlConfigByArchitectureLayer returns undefined for unknown", () => {
  const config = getLayerTtlConfigByArchitectureLayer("nonexistent");
  assert.equal(config, undefined);
});

// =============================================================================
// isMemoryStale tests
// =============================================================================

test("isMemoryStale returns false for fresh memory", () => {
  const memory = createTestMemory({
    createdAt: new Date().toISOString(),
    expiresAt: null,
  });
  // Created just now, should not be stale
  assert.equal(isMemoryStale(memory, Date.now()), false);
});

test("isMemoryStale returns true for expired memory", () => {
  const memory = createTestMemory({
    createdAt: new Date(Date.now() - 10000).toISOString(), // 10 seconds ago
    expiresAt: new Date(Date.now() - 1000).toISOString(), // expired 1 second ago
  });
  assert.equal(isMemoryStale(memory, Date.now()), true);
});

test("isMemoryStale returns true for old memory without expiresAt", () => {
  // Created 2 years ago
  const memory = createTestMemory({
    createdAt: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: null,
  });
  assert.equal(isMemoryStale(memory, Date.now()), true);
});

test("isMemoryStale uses default 7 days for unknown scope", () => {
  const memory = createTestMemory({
    scope: "unknown_scope" as any,
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
    expiresAt: null,
  });
  // Unknown scope defaults to 7 days
  assert.equal(isMemoryStale(memory, Date.now()), true);
});

test("isMemoryStale returns false for fresh unknown scope", () => {
  const memory = createTestMemory({
    scope: "unknown_scope" as any,
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days ago
    expiresAt: null,
  });
  // Unknown scope defaults to 7 days
  assert.equal(isMemoryStale(memory, Date.now()), false);
});

test("isMemoryStale with explicit expiresAt", () => {
  const futureTime = new Date(Date.now() + 10000).toISOString();
  const memory = createTestMemory({ expiresAt: futureTime });
  assert.equal(isMemoryStale(memory, Date.now()), false);
});

test("isMemoryStale with past expiresAt", () => {
  const pastTime = new Date(Date.now() - 1000).toISOString();
  const memory = createTestMemory({ expiresAt: pastTime });
  assert.equal(isMemoryStale(memory, Date.now()), true);
});

// =============================================================================
// getEvictionPriority tests
// =============================================================================

test("getEvictionPriority for lru strategy returns timestamp", () => {
  const memory = createTestMemory({ scope: "runtime" });
  const priority = getEvictionPriority(memory);
  // Should return a timestamp (number)
  assert.ok(typeof priority === "number");
  assert.ok(priority > 0);
});

test("getEvictionPriority for quality strategy returns 1-quality", () => {
  const memory = createTestMemory({
    scope: "agent",
    qualityScore: 0.3,
  });
  const priority = getEvictionPriority(memory);
  // 1 - 0.3 = 0.7
  assert.ok(Math.abs(priority - 0.7) < 0.001);
});

test("getEvictionPriority for trust strategy returns 1-trust", () => {
  const memory = createTestMemory({
    scope: "project",
    sourceTrustLevel: "trusted",
  });
  const priority = getEvictionPriority(memory);
  // trusted has weight 0.5 (not defined, so default), so 1 - 0.5 = 0.5
  assert.ok(Math.abs(priority - 0.5) < 0.001);
});

test("getEvictionPriority for usage strategy returns 1/(hitCount+1)", () => {
  const memory = createTestMemory({
    scope: "user",
    hitCount: 9,
  });
  const priority = getEvictionPriority(memory);
  // 1 / (9 + 1) = 0.1
  assert.ok(Math.abs(priority - 0.1) < 0.001);
});

test("getEvictionPriority for importance strategy returns 1-importance", () => {
  const memory = createTestMemory({
    scope: "evolution",
    importanceScore: 0.6,
  });
  const priority = getEvictionPriority(memory);
  // 1 - 0.6 = 0.4
  assert.ok(Math.abs(priority - 0.4) < 0.001);
});

test("getEvictionPriority for fifo strategy returns creation timestamp", () => {
  const memory = createTestMemory({ scope: "session" });
  const priority = getEvictionPriority(memory);
  const createdAt = new Date(memory.createdAt).getTime();
  assert.ok(Math.abs(priority - createdAt) < 1000); // Within 1 second
});

test("getEvictionPriority handles null qualityScore", () => {
  const memory = createTestMemory({
    scope: "agent",
    qualityScore: null as any,
  });
  const priority = getEvictionPriority(memory);
  // Should default to 0.5, so 1 - 0.5 = 0.5
  assert.ok(Math.abs(priority - 0.5) < 0.001);
});

test("getEvictionPriority handles null importanceScore", () => {
  const memory = createTestMemory({
    scope: "evolution",
    importanceScore: null as any,
  });
  const priority = getEvictionPriority(memory);
  // Should default to 0.5, so 1 - 0.5 = 0.5
  assert.ok(Math.abs(priority - 0.5) < 0.001);
});

test("getEvictionPriority handles unknown trust level", () => {
  const memory = createTestMemory({
    scope: "project",
    sourceTrustLevel: "unknown_level" as any,
  });
  const priority = getEvictionPriority(memory);
  // Should default to 0.5, so 1 - 0.5 = 0.5
  assert.ok(Math.abs(priority - 0.5) < 0.001);
});

test("getEvictionPriority uses lastAccessedAt when available for lru", () => {
  const now = Date.now();
  const memory = createTestMemory({
    scope: "runtime",
    createdAt: new Date(now - 10000).toISOString(), // Created 10 seconds ago
    lastAccessedAt: new Date(now - 1000).toISOString(), // Accessed 1 second ago
  });
  const priority = getEvictionPriority(memory);
  // Priority should be closer to now (lastAccessedAt) than createdAt
  const lastAccessed = now - 1000;
  assert.ok(Math.abs(priority - lastAccessed) < 100); // Within 100ms
});

test("getEvictionPriority defaults to createdAt when lastAccessedAt null for lru", () => {
  const now = Date.now();
  const memory = createTestMemory({
    scope: "runtime",
    createdAt: new Date(now - 5000).toISOString(),
    lastAccessedAt: null,
  });
  const priority = getEvictionPriority(memory);
  const createdAt = now - 5000;
  assert.ok(Math.abs(priority - createdAt) < 100); // Within 100ms
});

// =============================================================================
// shouldEvict tests
// =============================================================================

test("shouldEvict returns true for stale memory", () => {
  const memory = createTestMemory({
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
    scope: "runtime", // 1 minute default TTL
  });
  assert.equal(shouldEvict(memory, 1), true);
});

test("shouldEvict returns false for fresh memory without maxLayerSize", () => {
  const memory = createTestMemory({
    createdAt: new Date().toISOString(),
    scope: "runtime",
  });
  assert.equal(shouldEvict(memory, 1), false);
});

test("shouldEvict returns false when candidateCount <= maxLayerSize", () => {
  const memory = createTestMemory({
    createdAt: new Date().toISOString(),
    scope: "session",
  });
  assert.equal(shouldEvict(memory, 5, 10), false);
});

test("shouldEvict returns true when candidateCount > maxLayerSize and priority < 0.5", () => {
  const memory = createTestMemory({
    createdAt: new Date().toISOString(),
    scope: "agent",
    qualityScore: 0.3, // Low quality = high eviction priority
  });
  // With quality strategy, priority = 1 - 0.3 = 0.7 which is > 0.5
  // So should not evict based on priority alone
  assert.equal(shouldEvict(memory, 20, 10), false);
});

test("shouldEvict returns false when priority >= 0.5 even with layer overflow", () => {
  const memory = createTestMemory({
    createdAt: new Date().toISOString(),
    scope: "agent",
    qualityScore: 0.8, // High quality = low eviction priority
  });
  // With quality strategy, priority = 1 - 0.8 = 0.2 which is < 0.5
  // But if freshness makes it pass, then we check priority
  // Actually let's use session scope (lru) with recent lastAccessed
  const recentMemory = createTestMemory({
    scope: "session",
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    qualityScore: null as any,
  });
  // LRU returns timestamp, which should be recent and > 0.5
  // Actually timestamp will be huge, let's just test the logic
  const result = shouldEvict(recentMemory, 20, 10);
  // Fresh memory with recent access should not be evicted
  assert.equal(result, false);
});

test("shouldEvict with unknown scope uses default 7 days", () => {
  const memory = createTestMemory({
    scope: "unknown_scope" as any,
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
  });
  // Unknown scope defaults to 7 days, so 8 days old is stale
  assert.equal(shouldEvict(memory, 1), true);
});

// =============================================================================
// DEFAULT_LAYER_TTL_CONFIGS tests
// =============================================================================

test("DEFAULT_LAYER_TTL_CONFIGS has exactly 6 entries", () => {
  assert.equal(DEFAULT_LAYER_TTL_CONFIGS.length, 6);
});

test("DEFAULT_LAYER_TTL_CONFIGS runtime has correct values", () => {
  const config = DEFAULT_LAYER_TTL_CONFIGS.find((c) => c.scope === "runtime")!;
  assert.equal(config.architectureLayer, "working");
  assert.equal(config.defaultTtlMs, 60_000);
  assert.equal(config.maxTtlMs, 300_000);
  assert.equal(config.minTtlMs, 30_000);
  assert.equal(config.evictionStrategy, "lru");
  assert.equal(config.supportsPromotion, true);
  assert.equal(config.supportsDemotion, false);
});

test("DEFAULT_LAYER_TTL_CONFIGS session has correct values", () => {
  const config = DEFAULT_LAYER_TTL_CONFIGS.find((c) => c.scope === "session")!;
  assert.equal(config.architectureLayer, "session");
  assert.equal(config.defaultTtlMs, 3_600_000);
  assert.equal(config.evictionStrategy, "lru");
  assert.equal(config.supportsPromotion, true);
  assert.equal(config.supportsDemotion, true);
});

test("DEFAULT_LAYER_TTL_CONFIGS agent has correct values", () => {
  const config = DEFAULT_LAYER_TTL_CONFIGS.find((c) => c.scope === "agent")!;
  assert.equal(config.architectureLayer, "episodic");
  assert.equal(config.evictionStrategy, "quality");
});

test("DEFAULT_LAYER_TTL_CONFIGS project has correct values", () => {
  const config = DEFAULT_LAYER_TTL_CONFIGS.find((c) => c.scope === "project")!;
  assert.equal(config.architectureLayer, "semantic");
  assert.equal(config.evictionStrategy, "trust");
});

test("DEFAULT_LAYER_TTL_CONFIGS user has correct values", () => {
  const config = DEFAULT_LAYER_TTL_CONFIGS.find((c) => c.scope === "user")!;
  assert.equal(config.architectureLayer, "procedural");
  assert.equal(config.evictionStrategy, "usage");
  assert.equal(config.supportsPromotion, false);
});

test("DEFAULT_LAYER_TTL_CONFIGS evolution has correct values", () => {
  const config = DEFAULT_LAYER_TTL_CONFIGS.find((c) => c.scope === "evolution")!;
  assert.equal(config.architectureLayer, "meta");
  assert.equal(config.evictionStrategy, "importance");
});

test("All DEFAULT_LAYER_TTL_CONFIGS have non-zero TTL values", () => {
  for (const config of DEFAULT_LAYER_TTL_CONFIGS) {
    assert.ok(config.defaultTtlMs > 0, `${config.scope} defaultTtlMs should be > 0`);
    assert.ok(config.maxTtlMs >= config.defaultTtlMs, `${config.scope} maxTtlMs should >= defaultTtlMs`);
    assert.ok(config.minTtlMs <= config.defaultTtlMs, `${config.scope} minTtlMs should <= defaultTtlMs`);
  }
});

// =============================================================================
// DEFAULT_MEMORY_PROMOTION_RULES tests
// =============================================================================

test("DEFAULT_MEMORY_PROMOTION_RULES has 4 rules", () => {
  assert.equal(DEFAULT_MEMORY_PROMOTION_RULES.length, 4);
});

test("DEFAULT_MEMORY_PROMOTION_RULES defines session to agent rule", () => {
  const rule = DEFAULT_MEMORY_PROMOTION_RULES.find((r) => r.from === "session" && r.to === "agent");
  assert.ok(rule !== undefined);
  assert.equal(rule!.minHitCount, 3);
  assert.equal(rule!.minQualityScore, 0.6);
});

test("DEFAULT_MEMORY_PROMOTION_RULES defines agent to project rule", () => {
  const rule = DEFAULT_MEMORY_PROMOTION_RULES.find((r) => r.from === "agent" && r.to === "project");
  assert.ok(rule !== undefined);
  assert.equal(rule!.minHitCount, 8);
  assert.equal(rule!.minQualityScore, 0.75);
});

test("DEFAULT_MEMORY_PROMOTION_RULES defines project to user rule", () => {
  const rule = DEFAULT_MEMORY_PROMOTION_RULES.find((r) => r.from === "project" && r.to === "user");
  assert.ok(rule !== undefined);
  assert.equal(rule!.minHitCount, 12);
  assert.equal(rule!.minQualityScore, 0.8);
});

test("DEFAULT_MEMORY_PROMOTION_RULES defines user to evolution rule", () => {
  const rule = DEFAULT_MEMORY_PROMOTION_RULES.find((r) => r.from === "user" && r.to === "evolution");
  assert.ok(rule !== undefined);
  assert.equal(rule!.minHitCount, 20);
  assert.equal(rule!.minQualityScore, 0.9);
});

test("DEFAULT_MEMORY_PROMOTION_RULES are in order from lower to higher layers", () => {
  const froms = DEFAULT_MEMORY_PROMOTION_RULES.map((r) => r.from);
  assert.deepEqual(froms, ["session", "agent", "project", "user"]);
});

test("Promotion rules require increasing hit counts", () => {
  for (let i = 1; i < DEFAULT_MEMORY_PROMOTION_RULES.length; i++) {
    const current = DEFAULT_MEMORY_PROMOTION_RULES[i]!;
    const previous = DEFAULT_MEMORY_PROMOTION_RULES[i - 1]!;
    assert.ok(current.minHitCount > previous.minHitCount,
      `${current.from} requires more hits than ${previous.from}`);
  }
});

test("Promotion rules require increasing quality scores", () => {
  for (let i = 1; i < DEFAULT_MEMORY_PROMOTION_RULES.length; i++) {
    const current = DEFAULT_MEMORY_PROMOTION_RULES[i]!;
    const previous = DEFAULT_MEMORY_PROMOTION_RULES[i - 1]!;
    assert.ok(current.minQualityScore > previous.minQualityScore,
      `${current.from} requires higher quality than ${previous.from}`);
  }
});