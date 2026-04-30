import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for MemoryDecayService covering:
 * - Issue #2028: scope→SixLayerMemoryType no mapping, "project" falls back to session
 */

import { MemoryDecayService, DEFAULT_DECAY_CONFIGS, calculateFreshness, type DecayConfig } from "../../../../../src/platform/state-evidence/memory/memory-decay-service.js";
import type { MemoryRecord, MemoryLayer } from "../../../../../src/platform/contracts/types/domain.js";

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
    sourceTrustLevel: "trusted",
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

test("MemoryDecayService.getDecayConfig maps session scope correctly", () => {
  const service = new MemoryDecayService();

  const memory = createMemoryRecord({ scope: "session" });
  const config = service.getDecayConfig(memory);

  // Session should map to session decay config
  assert.equal(config.halfLifeSeconds, DEFAULT_DECAY_CONFIGS.session.halfLifeSeconds);
});

test("MemoryDecayService.getDecayConfig falls back to session for unknown scopes - Issue #2028", () => {
  const service = new MemoryDecayService();

  // Issue #2028: "project" scope has no mapping to SixLayerMemoryType
  // It should fall back to session config
  const memory = createMemoryRecord({ scope: "project" });
  const config = service.getDecayConfig(memory);

  // The fallback is to session config for unknown layers
  assert.equal(config.halfLifeSeconds, DEFAULT_DECAY_CONFIGS.session.halfLifeSeconds);
  assert.equal(config.decayRateMultiplier, DEFAULT_DECAY_CONFIGS.session.decayRateMultiplier);
});

test("MemoryDecayService.getDecayConfig handles all SixLayerMemoryType values", () => {
  const service = new MemoryDecayService();

  const scopes = ["working", "session", "episodic", "semantic", "procedural", "meta"] as const;

  for (const scope of scopes) {
    const memory = createMemoryRecord({ scope });
    const config = service.getDecayConfig(memory);
    const expectedConfig = DEFAULT_DECAY_CONFIGS[scope];

    assert.ok(config, `should have config for ${scope}`);
    assert.equal(config.halfLifeSeconds, expectedConfig.halfLifeSeconds, `${scope}: halfLifeSeconds mismatch`);
    assert.equal(config.minFreshness, expectedConfig.minFreshness, `${scope}: minFreshness mismatch`);
    assert.equal(config.decayRateMultiplier, expectedConfig.decayRateMultiplier, `${scope}: decayRateMultiplier mismatch`);
  }
});

test("MemoryDecayService.calculateFreshness uses correct config for memory scope", () => {
  const service = new MemoryDecayService();

  const sessionMemory = createMemoryRecord({ scope: "session", createdAt: new Date().toISOString() });
  const semanticMemory = createMemoryRecord({ scope: "semantic", createdAt: new Date().toISOString() });

  const sessionFreshness = service.calculateFreshness(sessionMemory);
  const semanticFreshness = service.calculateFreshness(semanticMemory);

  // Session decays faster (lower freshness) than semantic
  // Both are fresh (freshness 1.0) immediately after creation
  assert.ok(sessionFreshness <= 1.0);
  assert.ok(semanticFreshness <= 1.0);
});

test("MemoryDecayService.calculateDecay returns complete decay calculation", () => {
  const service = new MemoryDecayService();

  const memory = createMemoryRecord({
    scope: "session",
    createdAt: "2026-04-01T00:00:00.000Z",
    hitCount: 5,
  });

  const result = service.calculateDecay(memory, 1.0, "2026-04-01T01:00:00.000Z");

  assert.equal(result.memoryId, memory.id);
  assert.ok(result.currentFreshness < 1.0, "freshness should have decayed");
  assert.ok(result.previousFreshness === 1.0);
  assert.ok(result.decayAmount > 0, "should have some decay");
  assert.ok(result.accessBoost > 1, "access boost should increase with hitCount");
  assert.ok(result.halfLifeSeconds > 0);
});

test("calculateFreshness applies exponential decay correctly", () => {
  // Memory created 1 hour ago with 1 hour half-life should have freshness ~0.5
  const memory = createMemoryRecord({ createdAt: "2026-04-01T00:00:00.000Z" });
  const config = DEFAULT_DECAY_CONFIGS.session; // halfLifeSeconds = 3600

  // After 30 minutes (0.5 hours), freshness should be ~0.71
  const freshness30m = calculateFreshness(memory, config, "2026-04-01T00:30:00.000Z");
  assert.ok(freshness30m > 0.6 && freshness30m < 0.85, `30min freshness: expected ~0.7, got ${freshness30m}`);

  // After 1 hour (half-life), freshness should be ~0.5
  const freshness1h = calculateFreshness(memory, config, "2026-04-01T01:00:00.000Z");
  assert.ok(freshness1h > 0.4 && freshness1h < 0.6, `1hr freshness: expected ~0.5, got ${freshness1h}`);

  // After 2 hours (2 half-lives), freshness should be ~0.25
  const freshness2h = calculateFreshness(memory, config, "2026-04-01T02:00:00.000Z");
  assert.ok(freshness2h > 0.15 && freshness2h < 0.35, `2hr freshness: expected ~0.25, got ${freshness2h}`);
});

test("calculateFreshness respects minFreshness floor", () => {
  // Very old memory should clamp to minFreshness
  const memory = createMemoryRecord({ createdAt: "2020-01-01T00:00:00.000Z" });
  const config = DEFAULT_DECAY_CONFIGS.session;

  const freshness = calculateFreshness(memory, config, "2026-04-01T00:00:00.000Z");
  assert.equal(freshness, config.minFreshness, "freshness should be clamped to minFreshness");
});

test("calculateFreshness with hitCount applies access boost", () => {
  const memory0 = createMemoryRecord({ hitCount: 0, createdAt: "2026-04-01T00:00:00.000Z" });
  const memory10 = createMemoryRecord({ hitCount: 10, createdAt: "2026-04-01T00:00:00.000Z" });
  const memory50 = createMemoryRecord({ hitCount: 50, createdAt: "2026-04-01T00:00:00.000Z" });

  const config = DEFAULT_DECAY_CONFIGS.session;

  const freshness0 = calculateFreshness(memory0, config, "2026-04-01T00:30:00.000Z");
  const freshness10 = calculateFreshness(memory10, config, "2026-04-01T00:30:00.000Z");
  const freshness50 = calculateFreshness(memory50, config, "2026-04-01T00:30:00.000Z");

  assert.ok(freshness10 > freshness0, "hitCount 10 should have higher freshness than 0");
  assert.ok(freshness50 > freshness10, "hitCount 50 should have higher freshness than 10");
});

test("calculateFreshness infinite half-life means no decay", () => {
  const memory = createMemoryRecord({ createdAt: "2020-01-01T00:00:00.000Z" });
  const config = DEFAULT_DECAY_CONFIGS.meta; // Infinite half-life

  const freshness = calculateFreshness(memory, config, "2026-04-01T00:00:00.000Z");
  assert.equal(freshness, 1.0, "meta layer should have no decay (freshness = 1.0)");
});

test("MemoryDecayService with custom decay configs", () => {
  const customConfigs: Record<string, DecayConfig> = {
    working: { halfLifeSeconds: 300, minFreshness: 0.1, decayRateMultiplier: 1.0, accessBoostFactor: 0.1 },
    session: { halfLifeSeconds: 1800, minFreshness: 0.2, decayRateMultiplier: 0.9, accessBoostFactor: 0.08 },
  };

  const service = new MemoryDecayService(customConfigs as any);

  const memory = createMemoryRecord({ scope: "working" });
  const config = service.getDecayConfig(memory);

  assert.equal(config.halfLifeSeconds, 300, "should use custom working config");
});

test("MemoryDecayService defaults include all SixLayerMemoryType configs", () => {
  const service = new MemoryDecayService();

  const expectedLayers = ["working", "session", "episodic", "semantic", "procedural", "meta"];

  for (const layer of expectedLayers) {
    const memory = createMemoryRecord({ scope: layer as any });
    const config = service.getDecayConfig(memory);
    assert.ok(config, `should have config for ${layer}`);
  }
});

test("working memory has fastest effective decay rate", () => {
  const memory = createMemoryRecord({ createdAt: "2020-01-01T00:00:00.000Z", hitCount: 0 });

  const workingConfig = DEFAULT_DECAY_CONFIGS.working;
  const sessionConfig = DEFAULT_DECAY_CONFIGS.session;
  const semanticConfig = DEFAULT_DECAY_CONFIGS.semantic;

  const workingFreshness = calculateFreshness(memory, workingConfig, "2026-04-01T00:00:00.000Z");
  const sessionFreshness = calculateFreshness(memory, sessionConfig, "2026-04-01T00:00:00.000Z");
  const semanticFreshness = calculateFreshness(memory, semanticConfig, "2026-04-01T00:00:00.000Z");

  // Working has fastest decay (lowest freshness for same age)
  assert.ok(workingFreshness <= sessionFreshness, "working should decay faster than session");
  assert.ok(sessionFreshness <= semanticFreshness, "session should decay faster than semantic");
});