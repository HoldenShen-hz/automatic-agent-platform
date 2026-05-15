import assert from "node:assert/strict";
import test from "node:test";

import type { MemoryRecord, MemoryLayer, MemorySourceTrustLevel, MemoryKind, MemoryStatus } from "../../../../../src/platform/contracts/types/domain.js";
import {
  MemoryDecayService,
  calculateFreshness,
  calculateDecayAmount,
  DEFAULT_DECAY_CONFIGS,
  type DecayConfig,
  type SixLayerMemoryType,
} from "../../../../../src/platform/five-plane-state-evidence/memory/index.js";

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
    kind: "general" as MemoryKind,
    status: "active" as MemoryStatus,
    importanceScore: null,
    freshnessScore: null,
    contentHash: null,
    ...overrides,
  } as MemoryRecord;
}

// =============================================================================
// calculateFreshness tests
// =============================================================================

test("calculateFreshness returns 1.0 for new memory with no decay", () => {
  const memory = createMemoryRecord({ createdAt: new Date().toISOString() });
  const config = DEFAULT_DECAY_CONFIGS.session;
  const freshness = calculateFreshness(memory, config, memory.createdAt);
  assert.equal(freshness, 1.0);
});

test("calculateFreshness applies exponential decay over time", () => {
  const memory = createMemoryRecord({ createdAt: "2026-04-01T00:00:00.000Z" });
  const config = DEFAULT_DECAY_CONFIGS.session;
  // After 30 minutes (1800s) with halfLife of 3600s (1 hour)
  const freshness = calculateFreshness(memory, config, "2026-04-01T00:30:00.000Z");
  // Should be around 0.5^0.5 = ~0.707
  assert.ok(freshness > 0.6 && freshness < 0.8, `Expected ~0.7, got ${freshness}`);
});

test("calculateFreshness applies minFreshness clamp for very old memories", () => {
  const memory = createMemoryRecord({ createdAt: "2020-01-01T00:00:00.000Z" });
  const config = DEFAULT_DECAY_CONFIGS.session;
  const freshness = calculateFreshness(memory, config, "2026-04-01T00:00:00.000Z");
  // Should be clamped to minFreshness
  assert.equal(freshness, config.minFreshness);
});

test("calculateFreshness applies access boost reducing decay", () => {
  const memory1 = createMemoryRecord({ hitCount: 0, createdAt: "2026-04-01T00:00:00.000Z" });
  const memory10 = createMemoryRecord({ hitCount: 10, createdAt: "2026-04-01T00:00:00.000Z" });
  const config = DEFAULT_DECAY_CONFIGS.session;
  const freshness1 = calculateFreshness(memory1, config, "2026-04-01T00:30:00.000Z");
  const freshness10 = calculateFreshness(memory10, config, "2026-04-01T00:30:00.000Z");
  // Higher hit count should result in higher freshness (less decay)
  assert.ok(freshness10 > freshness1, `Expected freshness10 (${freshness10}) > freshness1 (${freshness1})`);
});

test("calculateFreshness meta layer has no decay (infinite half-life)", () => {
  const memory = createMemoryRecord({ createdAt: "2020-01-01T00:00:00.000Z" });
  const config = DEFAULT_DECAY_CONFIGS.meta;
  const freshness = calculateFreshness(memory, config, "2026-04-01T00:00:00.000Z");
  // Meta layer should have freshness of 1.0 (no decay)
  assert.equal(freshness, 1.0);
});

test("calculateFreshness working layer has fastest decay rate", () => {
  const memory = createMemoryRecord({ createdAt: "2020-01-01T00:00:00.000Z" });
  const workingConfig = DEFAULT_DECAY_CONFIGS.working;
  const sessionConfig = DEFAULT_DECAY_CONFIGS.session;
  const freshnessWorking = calculateFreshness(memory, workingConfig, "2026-04-01T00:00:00.000Z");
  const freshnessSession = calculateFreshness(memory, sessionConfig, "2026-04-01T00:00:00.000Z");
  // Working should decay faster (have lower freshness) than session
  assert.ok(freshnessWorking < freshnessSession, `Expected working (${freshnessWorking}) < session (${freshnessSession})`);
});

test("calculateFreshness clamps to max 1.0", () => {
  const memory = createMemoryRecord({ createdAt: new Date().toISOString(), hitCount: 0 });
  const config = DEFAULT_DECAY_CONFIGS.session;
  const freshness = calculateFreshness(memory, config, memory.createdAt);
  assert.ok(freshness <= 1.0, `Expected <= 1.0, got ${freshness}`);
});

test("calculateFreshness with custom config", () => {
  const memory = createMemoryRecord({ createdAt: "2026-04-01T00:00:00.000Z", hitCount: 0 });
  const customConfig: DecayConfig = {
    halfLifeSeconds: 3600,
    minFreshness: 0.1,
    decayRateMultiplier: 1.0,
    accessBoostFactor: 0.0,
  };
  const freshness = calculateFreshness(memory, customConfig, "2026-04-01T00:30:00.000Z");
  assert.ok(freshness > 0 && freshness <= 1.0);
});

// =============================================================================
// calculateDecayAmount tests
// =============================================================================

test("calculateDecayAmount returns positive when freshness decreased", () => {
  const memory = createMemoryRecord({ createdAt: "2026-04-01T00:00:00.000Z" });
  const config = DEFAULT_DECAY_CONFIGS.session;
  const previousFreshness = 1.0;
  const decayAmount = calculateDecayAmount(memory, previousFreshness, config, "2026-04-01T01:00:00.000Z");
  assert.ok(decayAmount > 0, `Expected positive decay, got ${decayAmount}`);
});

test("calculateDecayAmount returns 0 when freshness would increase", () => {
  const memory = createMemoryRecord({ createdAt: "2026-04-01T00:00:00.000Z" });
  const config = DEFAULT_DECAY_CONFIGS.session;
  const previousFreshness = 0.3; // Very low previous freshness
  const decayAmount = calculateDecayAmount(memory, previousFreshness, config, "2026-04-01T00:15:00.000Z");
  // Decay amount should be 0 since current freshness > previous
  assert.equal(decayAmount, 0);
});

test("calculateDecayAmount returns 0 for meta layer (no decay)", () => {
  const memory = createMemoryRecord({ createdAt: new Date().toISOString() });
  const config = DEFAULT_DECAY_CONFIGS.meta;
  const previousFreshness = 1.0;
  const decayAmount = calculateDecayAmount(memory, previousFreshness, config, new Date().toISOString());
  assert.equal(decayAmount, 0);
});

// =============================================================================
// MemoryDecayService constructor and config tests
// =============================================================================

test("MemoryDecayService constructor accepts custom decay configs", () => {
  const customConfig: DecayConfig = {
    halfLifeSeconds: 60,
    minFreshness: 0.1,
    decayRateMultiplier: 1.0,
    accessBoostFactor: 0.1,
  };
  const customConfigs = {
    working: customConfig,
    session: customConfig,
    episodic: customConfig,
    semantic: customConfig,
    procedural: customConfig,
    meta: customConfig,
  };
  const service = new MemoryDecayService(customConfigs);
  const layerConfig = service.getLayerDecayConfig("working");
  assert.equal(layerConfig.halfLifeSeconds, 60);
});

test("MemoryDecayService.getLayerDecayConfig returns correct config for working layer", () => {
  const service = new MemoryDecayService();
  const config = service.getLayerDecayConfig("working");
  assert.equal(config.halfLifeSeconds, 300);
  assert.equal(config.decayRateMultiplier, 0.0);
  assert.equal(config.accessBoostFactor, 0.1);
});

test("MemoryDecayService.getLayerDecayConfig returns correct config for session layer", () => {
  const service = new MemoryDecayService();
  const config = service.getLayerDecayConfig("session");
  assert.equal(config.halfLifeSeconds, 3600);
  assert.equal(config.decayRateMultiplier, 0.8);
  assert.equal(config.accessBoostFactor, 0.08);
});

test("MemoryDecayService.getLayerDecayConfig returns correct config for episodic layer", () => {
  const service = new MemoryDecayService();
  const config = service.getLayerDecayConfig("episodic");
  assert.equal(config.halfLifeSeconds, 86400);
  assert.equal(config.decayRateMultiplier, 0.6);
});

test("MemoryDecayService.getLayerDecayConfig returns correct config for semantic layer", () => {
  const service = new MemoryDecayService();
  const config = service.getLayerDecayConfig("semantic");
  assert.equal(config.halfLifeSeconds, 604800);
  assert.equal(config.decayRateMultiplier, 0.4);
});

test("MemoryDecayService.getLayerDecayConfig returns correct config for procedural layer", () => {
  const service = new MemoryDecayService();
  const config = service.getLayerDecayConfig("procedural");
  assert.equal(config.halfLifeSeconds, 2592000);
  assert.equal(config.decayRateMultiplier, 0.0);
});

test("MemoryDecayService.getLayerDecayConfig returns correct config for meta layer", () => {
  const service = new MemoryDecayService();
  const config = service.getLayerDecayConfig("meta");
  assert.equal(config.halfLifeSeconds, Number.POSITIVE_INFINITY);
  assert.equal(config.decayRateMultiplier, 0.0);
});

// =============================================================================
// MemoryDecayService.getDecayConfig tests
// =============================================================================

test("MemoryDecayService.getDecayConfig falls back to session for unknown layer", () => {
  const service = new MemoryDecayService();
  const memory = createMemoryRecord({ scope: "unknown_scope" });
  const config = service.getDecayConfig(memory);
  assert.equal(config.halfLifeSeconds, 3600);
});

test("MemoryDecayService.getDecayConfig uses memory scope to get correct config", () => {
  const service = new MemoryDecayService();
  const oldWorking = createMemoryRecord({ scope: "working", createdAt: "2020-01-01T00:00:00.000Z" });
  const oldMeta = createMemoryRecord({ scope: "meta", createdAt: "2020-01-01T00:00:00.000Z" });
  assert.ok(service.calculateFreshness(oldWorking) < service.calculateFreshness(oldMeta));
});

test("MemoryDecayService maps project scope to semantic decay config", () => {
  const service = new MemoryDecayService();
  const config = service.getDecayConfig(createMemoryRecord({ scope: "project" }));
  assert.equal(config.halfLifeSeconds, DEFAULT_DECAY_CONFIGS.semantic.halfLifeSeconds);
  assert.equal(config.decayRateMultiplier, DEFAULT_DECAY_CONFIGS.semantic.decayRateMultiplier);
});

// =============================================================================
// MemoryDecayService.calculateFreshness tests
// =============================================================================

test("MemoryDecayService.calculateFreshness uses memory scope to get config", () => {
  const service = new MemoryDecayService();
  const memory = createMemoryRecord({ createdAt: new Date().toISOString() });
  const freshness = service.calculateFreshness(memory);
  assert.ok(freshness >= 0 && freshness <= 1.0);
});

test("MemoryDecayService.calculateFreshness with default evaluatedAt", () => {
  const service = new MemoryDecayService();
  const memory = createMemoryRecord({ createdAt: new Date().toISOString() });
  const freshness = service.calculateFreshness(memory);
  assert.ok(freshness >= 0 && freshness <= 1.0);
});

// =============================================================================
// MemoryDecayService.calculateDecay tests
// =============================================================================

test("MemoryDecayService.calculateDecay returns complete calculation", () => {
  const service = new MemoryDecayService();
  const memory = createMemoryRecord({
    createdAt: "2026-04-01T00:00:00.000Z",
    hitCount: 5,
  });
  const result = service.calculateDecay(memory, 1.0, "2026-04-01T01:00:00.000Z");
  assert.equal(result.memoryId, "mem_001");
  assert.ok(result.currentFreshness < 1.0);
  assert.equal(result.previousFreshness, 1.0);
  assert.ok(result.decayAmount > 0);
  assert.ok(result.accessBoost > 1.0);
  assert.ok(result.halfLifeSeconds > 0);
  assert.ok(result.effectiveDecayRate > 0);
  assert.equal(result.evaluatedAt, "2026-04-01T01:00:00.000Z");
});

test("MemoryDecayService.calculateDecay for meta layer has no effective decay", () => {
  const service = new MemoryDecayService();
  const memory = createMemoryRecord({
    scope: "meta",
    createdAt: "2020-01-01T00:00:00.000Z",
    hitCount: 5,
  });
  const result = service.calculateDecay(memory, 1.0, "2026-04-01T00:00:00.000Z");
  assert.equal(result.currentFreshness, 1.0);
  assert.equal(result.decayAmount, 0);
  assert.equal(result.effectiveDecayRate, 0);
});

// =============================================================================
// MemoryDecayService.generateDecaySummary tests
// =============================================================================

test("MemoryDecayService.generateDecaySummary calculates correct totals", () => {
  const service = new MemoryDecayService();
  const memories = [
    createMemoryRecord({ scope: "session", createdAt: "2026-04-01T00:00:00.000Z" }),
    createMemoryRecord({ scope: "session", createdAt: "2026-04-01T00:00:00.000Z" }),
    createMemoryRecord({ scope: "episodic", createdAt: "2020-01-01T00:00:00.000Z" }),
  ];
  const summary = service.generateDecaySummary(memories, "2026-04-01T12:00:00.000Z");
  assert.equal(summary.totalMemories, 3);
  assert.ok(summary.averageFreshness > 0);
  assert.ok(summary.byLayer.session.count === 2);
  assert.ok(summary.byLayer.episodic.count === 1);
});

test("MemoryDecayService.generateDecaySummary handles empty array", () => {
  const service = new MemoryDecayService();
  const summary = service.generateDecaySummary([]);
  assert.equal(summary.totalMemories, 0);
  assert.equal(summary.averageFreshness, 0);
  assert.equal(summary.decayedMemories, 0);
  assert.equal(summary.freshMemories, 0);
});

test("MemoryDecayService.generateDecaySummary counts decayedMemories correctly", () => {
  const service = new MemoryDecayService();
  const memories = [
    createMemoryRecord({ scope: "session", createdAt: "2026-04-01T00:00:00.000Z" }),
    createMemoryRecord({ scope: "meta", createdAt: "2020-01-01T00:00:00.000Z" }),
  ];
  const summary = service.generateDecaySummary(memories, "2026-04-01T12:00:00.000Z");
  // Meta layer never decays
  assert.ok(summary.byLayer.meta.decayedCount === 0);
});

test("MemoryDecayService.generateDecaySummary includes all six layers", () => {
  const service = new MemoryDecayService();
  const memories = [
    createMemoryRecord({ scope: "working" }),
    createMemoryRecord({ scope: "session" }),
    createMemoryRecord({ scope: "episodic" }),
    createMemoryRecord({ scope: "semantic" }),
    createMemoryRecord({ scope: "procedural" }),
    createMemoryRecord({ scope: "meta" }),
  ];
  const summary = service.generateDecaySummary(memories);
  assert.ok(summary.byLayer.working);
  assert.ok(summary.byLayer.session);
  assert.ok(summary.byLayer.episodic);
  assert.ok(summary.byLayer.semantic);
  assert.ok(summary.byLayer.procedural);
  assert.ok(summary.byLayer.meta);
});

test("MemoryDecayService.generateDecaySummary with default evaluatedAt", () => {
  const service = new MemoryDecayService();
  const memories = [createMemoryRecord()];
  const summary = service.generateDecaySummary(memories);
  assert.ok(summary.totalMemories === 1);
});

// =============================================================================
// MemoryDecayService.evaluateCompressionCandidates tests
// =============================================================================

test("MemoryDecayService.evaluateCompressionCandidates sorts by score (lowest first)", () => {
  const service = new MemoryDecayService();
  const memories = [
    createMemoryRecord({ id: "high", qualityScore: 0.9, importanceScore: 0.9, createdAt: new Date().toISOString() }),
    createMemoryRecord({ id: "low", qualityScore: 0.2, importanceScore: 0.2, createdAt: "2020-01-01T00:00:00.000Z" }),
  ];
  const result = service.evaluateCompressionCandidates(memories);
  // Low score memories should be first (higher compression priority)
  assert.equal(result.candidates[0]?.memory.id, "low");
  assert.equal(result.candidates[1]?.memory.id, "high");
});

test("MemoryDecayService.evaluateCompressionCandidates respects maxCandidates", () => {
  const service = new MemoryDecayService();
  const memories = [
    createMemoryRecord({ id: "mem_1", qualityScore: 0.2 }),
    createMemoryRecord({ id: "mem_2", qualityScore: 0.3 }),
    createMemoryRecord({ id: "mem_3", qualityScore: 0.4 }),
    createMemoryRecord({ id: "mem_4", qualityScore: 0.5 }),
  ];
  const result = service.evaluateCompressionCandidates(memories, undefined, 2);
  assert.equal(result.candidates.length, 2);
  assert.equal(result.totalCount, 4);
  assert.equal(result.compressedCount, 2);
  assert.equal(result.preservedCount, 2);
});

test("MemoryDecayService.evaluateCompressionCandidates calculates totalCount correctly", () => {
  const service = new MemoryDecayService();
  const memories = [
    createMemoryRecord({ id: "mem_1", qualityScore: 0.2 }),
    createMemoryRecord({ id: "mem_2", qualityScore: 0.3 }),
  ];
  const result = service.evaluateCompressionCandidates(memories);
  assert.equal(result.totalCount, 2);
  assert.equal(result.candidates.length, 2);
  assert.equal(result.preservedCount, 0);
});

test("MemoryDecayService.evaluateCompressionCandidates reason for low freshness", () => {
  const service = new MemoryDecayService();
  const memories = [
    createMemoryRecord({ id: "mem_1", qualityScore: 0.5, importanceScore: 0.5, createdAt: "2020-01-01T00:00:00.000Z" }),
  ];
  const result = service.evaluateCompressionCandidates(memories);
  assert.ok(result.candidates[0]?.reason.includes("Freshness"));
});

test("MemoryDecayService.evaluateCompressionCandidates reason for low quality", () => {
  const service = new MemoryDecayService();
  const memories = [
    createMemoryRecord({ id: "mem_1", qualityScore: 0.2, importanceScore: 0.8, createdAt: new Date().toISOString() }),
  ];
  const result = service.evaluateCompressionCandidates(memories);
  assert.ok(result.candidates[0]?.reason.includes("quality"));
});

test("MemoryDecayService.evaluateCompressionCandidates reason for low importance", () => {
  const service = new MemoryDecayService();
  const memories = [
    createMemoryRecord({ id: "mem_1", qualityScore: 0.8, importanceScore: 0.2, createdAt: new Date().toISOString() }),
  ];
  const result = service.evaluateCompressionCandidates(memories);
  assert.ok(result.candidates[0]?.reason.includes("importance"));
});

test("MemoryDecayService.evaluateCompressionCandidates with default evaluatedAt", () => {
  const service = new MemoryDecayService();
  const memories = [createMemoryRecord({ id: "mem_1" })];
  const result = service.evaluateCompressionCandidates(memories);
  assert.equal(result.totalCount, 1);
});

test("MemoryDecayService.evaluateCompressionCandidates includes compressionScore", () => {
  const service = new MemoryDecayService();
  const memories = [
    createMemoryRecord({ id: "mem_1", qualityScore: 0.8, importanceScore: 0.8, hitCount: 10 }),
  ];
  const result = service.evaluateCompressionCandidates(memories);
  assert.ok(result.candidates[0]?.compressionScore > 0);
  assert.ok(result.candidates[0]?.compressionScore <= 1.0);
});

// =============================================================================
// MemoryDecayService.getAllDecayConfigs tests
// =============================================================================

test("MemoryDecayService.getAllDecayConfigs returns copy of configs", () => {
  const service = new MemoryDecayService();
  const configs = service.getAllDecayConfigs();
  assert.equal(configs.working.halfLifeSeconds, 300);
});

test("MemoryDecayService.getAllDecayConfigs returns all six layers", () => {
  const service = new MemoryDecayService();
  const configs = service.getAllDecayConfigs();
  assert.ok(configs.working);
  assert.ok(configs.session);
  assert.ok(configs.episodic);
  assert.ok(configs.semantic);
  assert.ok(configs.procedural);
  assert.ok(configs.meta);
});

test("MemoryDecayService.getAllDecayConfigs returns shallow copy of configs", () => {
  const service = new MemoryDecayService();
  const configs = service.getAllDecayConfigs();
  // The outer record is a new object, but nested DecayConfig objects are shared references
  assert.ok(configs !== service.getAllDecayConfigs()); // Different outer objects
  // This documents that it's a shallow copy - nested objects are shared
});

// =============================================================================
// DEFAULT_DECAY_CONFIGS tests
// =============================================================================

test("DEFAULT_DECAY_CONFIGS has correct half-life values", () => {
  assert.equal(DEFAULT_DECAY_CONFIGS.working.halfLifeSeconds, 300);
  assert.equal(DEFAULT_DECAY_CONFIGS.session.halfLifeSeconds, 3600);
  assert.equal(DEFAULT_DECAY_CONFIGS.episodic.halfLifeSeconds, 86400);
  assert.equal(DEFAULT_DECAY_CONFIGS.semantic.halfLifeSeconds, 604800);
  assert.equal(DEFAULT_DECAY_CONFIGS.procedural.halfLifeSeconds, 2592000);
  assert.equal(DEFAULT_DECAY_CONFIGS.meta.halfLifeSeconds, Number.POSITIVE_INFINITY);
});

test("DEFAULT_DECAY_CONFIGS has correct decay rate multipliers", () => {
  assert.equal(DEFAULT_DECAY_CONFIGS.working.decayRateMultiplier, 0.0);
  assert.equal(DEFAULT_DECAY_CONFIGS.session.decayRateMultiplier, 0.8);
  assert.equal(DEFAULT_DECAY_CONFIGS.episodic.decayRateMultiplier, 0.6);
  assert.equal(DEFAULT_DECAY_CONFIGS.semantic.decayRateMultiplier, 0.4);
  assert.equal(DEFAULT_DECAY_CONFIGS.procedural.decayRateMultiplier, 0.0);
  assert.equal(DEFAULT_DECAY_CONFIGS.meta.decayRateMultiplier, 0.0);
});

test("DEFAULT_DECAY_CONFIGS has correct minFreshness values", () => {
  assert.equal(DEFAULT_DECAY_CONFIGS.working.minFreshness, 0.1);
  assert.equal(DEFAULT_DECAY_CONFIGS.session.minFreshness, 0.15);
  assert.equal(DEFAULT_DECAY_CONFIGS.episodic.minFreshness, 0.2);
  assert.equal(DEFAULT_DECAY_CONFIGS.semantic.minFreshness, 0.25);
  assert.equal(DEFAULT_DECAY_CONFIGS.procedural.minFreshness, 0.3);
  assert.equal(DEFAULT_DECAY_CONFIGS.meta.minFreshness, 0.5);
});

test("DEFAULT_DECAY_CONFIGS has correct accessBoostFactor values", () => {
  assert.equal(DEFAULT_DECAY_CONFIGS.working.accessBoostFactor, 0.1);
  assert.equal(DEFAULT_DECAY_CONFIGS.session.accessBoostFactor, 0.08);
  assert.equal(DEFAULT_DECAY_CONFIGS.episodic.accessBoostFactor, 0.05);
  assert.equal(DEFAULT_DECAY_CONFIGS.semantic.accessBoostFactor, 0.03);
  assert.equal(DEFAULT_DECAY_CONFIGS.procedural.accessBoostFactor, 0.02);
  assert.equal(DEFAULT_DECAY_CONFIGS.meta.accessBoostFactor, 0.01);
});

// =============================================================================
// Edge cases
// =============================================================================

test("MemoryDecayService handles memory with unknown scope gracefully", () => {
  const service = new MemoryDecayService();
  const memory = createMemoryRecord({ scope: "invalid_scope" });
  const config = service.getDecayConfig(memory);
  // Should fall back to session config
  assert.equal(config.halfLifeSeconds, 3600);
});

test("MemoryDecayService handles memory with null qualityScore", () => {
  const service = new MemoryDecayService();
  const memory = createMemoryRecord({ qualityScore: null });
  const result = service.evaluateCompressionCandidates([memory]);
  // Should use default 0.5 when qualityScore is null
  assert.ok(result.candidates.length === 1);
});

test("MemoryDecayService handles memory with null importanceScore", () => {
  const service = new MemoryDecayService();
  const memory = createMemoryRecord({ importanceScore: null });
  const result = service.evaluateCompressionCandidates([memory]);
  // Should use default 0.5 when importanceScore is null
  assert.ok(result.candidates.length === 1);
});

test("MemoryDecayService handles memory with high hitCount", () => {
  const service = new MemoryDecayService();
  // Use a memory from 1 hour ago - access boost should noticeably affect freshness
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);
  const memory = createMemoryRecord({
    hitCount: 20,
    createdAt: oneHourAgo.toISOString()
  });
  const freshness = service.calculateFreshness(memory);
  // High hit count should boost freshness compared to 0 hits
  const memoryNoHits = createMemoryRecord({
    hitCount: 0,
    createdAt: oneHourAgo.toISOString()
  });
  const freshnessNoHits = service.calculateFreshness(memoryNoHits);
  assert.ok(freshness > freshnessNoHits, `Expected freshness with hits (${freshness}) > without hits (${freshnessNoHits})`);
});
