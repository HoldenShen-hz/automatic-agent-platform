import assert from "node:assert/strict";
import test from "node:test";
import { MemoryDecayService, calculateFreshness, calculateDecayAmount, DEFAULT_DECAY_CONFIGS, } from "../../../../../src/platform/state-evidence/memory/index.js";
function createMemoryRecord(overrides = {}) {
    const now = new Date().toISOString();
    return {
        id: "mem_001",
        taskId: null,
        sessionId: "sess_001",
        agentId: "agent_001",
        executionId: "exec_001",
        memoryLayer: "layer_3",
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
    };
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
test("calculateFreshness applies decay over time", () => {
    const memory = createMemoryRecord({ createdAt: "2026-04-01T00:00:00.000Z" });
    const config = DEFAULT_DECAY_CONFIGS.session;
    const freshness = calculateFreshness(memory, config, "2026-04-01T01:00:00.000Z");
    // After 1 hour with halfLife of 3600s (1 hour), freshness should be ~0.5
    assert.ok(freshness < 1.0);
    assert.ok(freshness > 0.4);
});
test("calculateFreshness applies minFreshness clamp", () => {
    const memory = createMemoryRecord({ createdAt: "2020-01-01T00:00:00.000Z" });
    const config = DEFAULT_DECAY_CONFIGS.session;
    const freshness = calculateFreshness(memory, config, "2026-04-01T00:00:00.000Z");
    // Should be clamped to minFreshness
    assert.equal(freshness, config.minFreshness);
});
test("calculateFreshness applies access boost", () => {
    const memory1 = createMemoryRecord({ hitCount: 0, createdAt: "2026-04-01T00:00:00.000Z" });
    const memory10 = createMemoryRecord({ hitCount: 10, createdAt: "2026-04-01T00:00:00.000Z" });
    const config = DEFAULT_DECAY_CONFIGS.session;
    const freshness1 = calculateFreshness(memory1, config, "2026-04-01T00:30:00.000Z");
    const freshness10 = calculateFreshness(memory10, config, "2026-04-01T00:30:00.000Z");
    // Higher hit count should result in higher freshness (less decay)
    assert.ok(freshness10 > freshness1);
});
test("calculateFreshness meta layer has no decay", () => {
    const memory = createMemoryRecord({ createdAt: "2020-01-01T00:00:00.000Z" });
    const config = DEFAULT_DECAY_CONFIGS.meta;
    const freshness = calculateFreshness(memory, config, "2026-04-01T00:00:00.000Z");
    // Meta layer should have freshness of 1.0 (no decay)
    assert.equal(freshness, 1.0);
});
test("calculateFreshness working layer has highest decay rate", () => {
    const memory = createMemoryRecord({ createdAt: "2020-01-01T00:00:00.000Z" });
    const workingConfig = DEFAULT_DECAY_CONFIGS.working;
    const sessionConfig = DEFAULT_DECAY_CONFIGS.session;
    const freshnessWorking = calculateFreshness(memory, workingConfig, "2026-04-01T00:00:00.000Z");
    const freshnessSession = calculateFreshness(memory, sessionConfig, "2026-04-01T00:00:00.000Z");
    // Working should decay faster (have lower freshness) than session
    assert.ok(freshnessWorking < freshnessSession);
});
test("calculateFreshness clamps to max 1.0", () => {
    const memory = createMemoryRecord({ createdAt: new Date().toISOString(), hitCount: 0 });
    const config = DEFAULT_DECAY_CONFIGS.session;
    const freshness = calculateFreshness(memory, config, memory.createdAt);
    assert.ok(freshness <= 1.0);
});
// =============================================================================
// calculateDecayAmount tests
// =============================================================================
test("calculateDecayAmount returns positive when freshness decreased", () => {
    const memory = createMemoryRecord({ createdAt: "2026-04-01T00:00:00.000Z" });
    const config = DEFAULT_DECAY_CONFIGS.session;
    const previousFreshness = 1.0;
    const decayAmount = calculateDecayAmount(memory, previousFreshness, config, "2026-04-01T01:00:00.000Z");
    assert.ok(decayAmount > 0);
});
test("calculateDecayAmount returns 0 when freshness increased", () => {
    const memory = createMemoryRecord({ createdAt: "2026-04-01T00:00:00.000Z" });
    const config = DEFAULT_DECAY_CONFIGS.session;
    const previousFreshness = 0.3;
    const decayAmount = calculateDecayAmount(memory, previousFreshness, config, "2026-04-01T00:15:00.000Z");
    assert.equal(decayAmount, 0);
});
test("calculateDecayAmount returns 0 when freshness unchanged", () => {
    const memory = createMemoryRecord({ createdAt: new Date().toISOString() });
    const config = DEFAULT_DECAY_CONFIGS.meta;
    const previousFreshness = 1.0;
    const decayAmount = calculateDecayAmount(memory, previousFreshness, config, new Date().toISOString());
    assert.equal(decayAmount, 0);
});
// =============================================================================
// MemoryDecayService tests
// =============================================================================
test("MemoryDecayService constructor accepts custom decay configs", () => {
    const customConfig = {
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
test("MemoryDecayService.getDecayConfig returns correct config for working layer", () => {
    const service = new MemoryDecayService();
    const config = service.getLayerDecayConfig("working");
    assert.equal(config.halfLifeSeconds, 300);
    assert.equal(config.decayRateMultiplier, 1.0);
});
test("MemoryDecayService.getDecayConfig returns correct config for session layer", () => {
    const service = new MemoryDecayService();
    const config = service.getLayerDecayConfig("session");
    assert.equal(config.halfLifeSeconds, 3600);
    assert.equal(config.decayRateMultiplier, 0.8);
});
test("MemoryDecayService.getDecayConfig returns correct config for episodic layer", () => {
    const service = new MemoryDecayService();
    const config = service.getLayerDecayConfig("episodic");
    assert.equal(config.halfLifeSeconds, 86400);
    assert.equal(config.decayRateMultiplier, 0.6);
});
test("MemoryDecayService.getDecayConfig returns correct config for semantic layer", () => {
    const service = new MemoryDecayService();
    const config = service.getLayerDecayConfig("semantic");
    assert.equal(config.halfLifeSeconds, 604800);
    assert.equal(config.decayRateMultiplier, 0.4);
});
test("MemoryDecayService.getDecayConfig returns correct config for procedural layer", () => {
    const service = new MemoryDecayService();
    const config = service.getLayerDecayConfig("procedural");
    assert.equal(config.halfLifeSeconds, 2592000);
    assert.equal(config.decayRateMultiplier, 0.2);
});
test("MemoryDecayService.getDecayConfig returns correct config for meta layer", () => {
    const service = new MemoryDecayService();
    const config = service.getLayerDecayConfig("meta");
    assert.equal(config.halfLifeSeconds, Number.POSITIVE_INFINITY);
    assert.equal(config.decayRateMultiplier, 0.0);
});
test("MemoryDecayService.getDecayConfig falls back to session for unknown layer", () => {
    const service = new MemoryDecayService();
    const memory = createMemoryRecord({ scope: "unknown_scope" });
    const config = service.getDecayConfig(memory);
    assert.equal(config.halfLifeSeconds, 3600);
});
test("MemoryDecayService.calculateFreshness uses memory scope to get config", () => {
    const service = new MemoryDecayService();
    const oldWorking = createMemoryRecord({ scope: "working", createdAt: "2020-01-01T00:00:00.000Z" });
    const oldMeta = createMemoryRecord({ scope: "meta", createdAt: "2020-01-01T00:00:00.000Z" });
    assert.ok(service.calculateFreshness(oldWorking) < service.calculateFreshness(oldMeta));
});
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
});
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
test("MemoryDecayService.generateDecaySummary calculates decayedMemories count", () => {
    const service = new MemoryDecayService();
    const memories = [
        createMemoryRecord({ scope: "session", createdAt: "2026-04-01T00:00:00.000Z" }),
        createMemoryRecord({ scope: "meta", createdAt: "2020-01-01T00:00:00.000Z" }), // Should not be decayed
    ];
    const summary = service.generateDecaySummary(memories, "2026-04-01T12:00:00.000Z");
    // Meta layer never decays
    assert.ok(summary.byLayer.meta.decayedCount === 0);
});
test("MemoryDecayService.evaluateCompressionCandidates sorts by score", () => {
    const service = new MemoryDecayService();
    const memories = [
        createMemoryRecord({ id: "low", qualityScore: 0.2, importanceScore: 0.2, createdAt: "2020-01-01T00:00:00.000Z" }),
        createMemoryRecord({ id: "high", qualityScore: 0.9, importanceScore: 0.9, createdAt: new Date().toISOString() }),
    ];
    const result = service.evaluateCompressionCandidates(memories);
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
test("MemoryDecayService.evaluateCompressionCandidates includes reason for low freshness", () => {
    const service = new MemoryDecayService();
    const memories = [
        createMemoryRecord({ id: "mem_1", qualityScore: 0.2, createdAt: "2020-01-01T00:00:00.000Z" }),
    ];
    const result = service.evaluateCompressionCandidates(memories);
    assert.ok(result.candidates[0]?.reason.includes("Freshness"));
});
test("MemoryDecayService.evaluateCompressionCandidates includes reason for low quality", () => {
    const service = new MemoryDecayService();
    const memories = [
        createMemoryRecord({ id: "mem_1", qualityScore: 0.2, importanceScore: 0.8, createdAt: new Date().toISOString() }),
    ];
    const result = service.evaluateCompressionCandidates(memories);
    assert.ok(result.candidates[0]?.reason.includes("quality"));
});
test("MemoryDecayService.evaluateCompressionCandidates includes reason for low importance", () => {
    const service = new MemoryDecayService();
    const memories = [
        createMemoryRecord({ id: "mem_1", qualityScore: 0.8, importanceScore: 0.2, createdAt: new Date().toISOString() }),
    ];
    const result = service.evaluateCompressionCandidates(memories);
    assert.ok(result.candidates[0]?.reason.includes("importance"));
});
test("MemoryDecayService.getAllDecayConfigs returns copy of configs", () => {
    const service = new MemoryDecayService();
    const configs = service.getAllDecayConfigs();
    assert.equal(configs.working.halfLifeSeconds, 300);
    // Note: getAllDecayConfigs returns a shallow copy, so nested objects are still shared
    // This test just verifies the values are correct
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
test("DEFAULT_DECAY_CONFIGS has correct structure", () => {
    assert.equal(DEFAULT_DECAY_CONFIGS.working.halfLifeSeconds, 300);
    assert.equal(DEFAULT_DECAY_CONFIGS.session.halfLifeSeconds, 3600);
    assert.equal(DEFAULT_DECAY_CONFIGS.episodic.halfLifeSeconds, 86400);
    assert.equal(DEFAULT_DECAY_CONFIGS.semantic.halfLifeSeconds, 604800);
    assert.equal(DEFAULT_DECAY_CONFIGS.procedural.halfLifeSeconds, 2592000);
    assert.equal(DEFAULT_DECAY_CONFIGS.meta.halfLifeSeconds, Number.POSITIVE_INFINITY);
});
test("MemoryDecayService.getDecayConfig handles memory with unknown scope", () => {
    const service = new MemoryDecayService();
    const memory = createMemoryRecord({ scope: "unknown_scope" });
    const config = service.getDecayConfig(memory);
    // Should fall back to session config
    assert.equal(config.halfLifeSeconds, 3600);
});
test("MemoryDecayService.calculateFreshness with default evaluatedAt", () => {
    const service = new MemoryDecayService();
    const memory = createMemoryRecord({ createdAt: new Date().toISOString() });
    // Should not throw
    const freshness = service.calculateFreshness(memory);
    assert.ok(freshness >= 0 && freshness <= 1.0);
});
test("MemoryDecayService.generateDecaySummary with default evaluatedAt", () => {
    const service = new MemoryDecayService();
    const memories = [createMemoryRecord()];
    // Should not throw
    const summary = service.generateDecaySummary(memories);
    assert.ok(summary.totalMemories === 1);
});
test("MemoryDecayService.evaluateCompressionCandidates with default evaluatedAt", () => {
    const service = new MemoryDecayService();
    const memories = [createMemoryRecord({ id: "mem_1" })];
    // Should not throw
    const result = service.evaluateCompressionCandidates(memories);
    assert.equal(result.totalCount, 1);
});
//# sourceMappingURL=memory-decay-service.test.js.map