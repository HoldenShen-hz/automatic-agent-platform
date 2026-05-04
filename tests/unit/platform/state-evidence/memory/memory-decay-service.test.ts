/**
 * Unit tests for MemoryDecayService - Issue #2028
 *
 * Tests scope→SixLayerMemoryType no mapping bug.
 * Issue #2028: "project" scope falls back to "session" config instead of mapping to semantic layer.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  MemoryDecayService,
  DEFAULT_DECAY_CONFIGS,
  calculateFreshness,
  type DecayConfig,
} from "../../../../../src/platform/state-evidence/memory/memory-decay-service.js";
import type { MemoryRecord, MemoryLayer } from "../../../../../src/platform/contracts/types/domain.js";
import { mapScopeToSixLayer, type SixLayerMemoryType } from "../../../../../src/platform/state-evidence/memory/layer-transition-service.js";

// =============================================================================
// Typed Factory
// =============================================================================

function createMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  const now = new Date().toISOString();
  return {
    id: "mem_" + Math.random().toString(36).slice(2, 8),
    taskId: null,
    sessionId: null,
    agentId: null,
    executionId: null,
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
  };
}

// =============================================================================
// Issue #2028: scope→SixLayerMemoryType mapping tests
// The mapScopeToSixLayer function in layer-transition-service.ts does NOT
// have a mapping for "project" scope - it falls through to the default "session".
// This means project-scoped memories get session decay config instead of semantic.
// =============================================================================

test("Issue #2028: mapScopeToSixLayer does not map 'project' to semantic", () => {
  // BUG: "project" is NOT in the mapScopeToSixLayer switch statement
  // It falls through to default → returns "session" instead of "semantic"
  const result = mapScopeToSixLayer("project");
  assert.equal(result, "session", "Issue #2028: project maps to session (should be semantic)");
});

test("Issue #2028: MemoryDecayService.getDecayConfig uses 'session' config for 'project' scope", () => {
  const service = new MemoryDecayService();
  const memory = createMemoryRecord({ scope: "project" });
  const config = service.getDecayConfig(memory);

  // BUG: Should use semantic config (halfLife=604800), but uses session (halfLife=3600)
  // This causes project-scoped memories to decay much faster than intended
  const sessionConfig = DEFAULT_DECAY_CONFIGS.session;
  const semanticConfig = DEFAULT_DECAY_CONFIGS.semantic;

  assert.equal(config.halfLifeSeconds, sessionConfig.halfLifeSeconds,
    "Issue #2028: project scope uses session halfLife (should be semantic)");
  assert.notEqual(config.halfLifeSeconds, semanticConfig.halfLifeSeconds,
    "Issue #2028: project scope should NOT use semantic halfLife due to mapping bug");
});

test("Issue #2028: project memories decay faster than intended due to wrong config", () => {
  const service = new MemoryDecayService();

  // Create a project memory
  const projectMemory = createMemoryRecord({
    scope: "project",
    createdAt: "2026-04-01T00:00:00.000Z",
    hitCount: 0,
  });

  // Create a semantic memory (same age and hits)
  const semanticMemory = createMemoryRecord({
    scope: "semantic",
    createdAt: "2026-04-01T00:00:00.000Z",
    hitCount: 0,
  });

  const evaluatedAt = "2026-04-02T00:00:00.000Z"; // 1 day later

  const projectFreshness = service.calculateFreshness(projectMemory, evaluatedAt);
  const semanticFreshness = service.calculateFreshness(semanticMemory, evaluatedAt);

  // BUG: Project freshness will be MUCH lower than semantic because it uses
  // session config (halfLife=3600s = 1 hour) instead of semantic (halfLife=604800s = 1 week)
  // After 1 day: session freshness ≈ exp(-ln(2)*24) ≈ 0.0000019
  // After 1 day: semantic freshness ≈ exp(-ln(2)*0.12) ≈ 0.92
  console.log(`Issue #2028: project freshness: ${projectFreshness}, semantic freshness: ${semanticFreshness}`);

  // Document the bug: project decays MUCH faster than semantic
  assert.ok(projectFreshness < semanticFreshness,
    "Issue #2028: project decays faster than semantic due to wrong config mapping");
  assert.ok(projectFreshness < 0.01, "Issue #2028: project freshness too low due to session config");
  assert.ok(semanticFreshness > 0.5, "Issue #2028: semantic freshness should be high");
});

test("Issue #2028: verify 'project' is missing from mapScopeToSixLayer switch", () => {
  // This test documents the root cause: "project" is not in the switch statement
  // Cases handled: task_runtime/working, session, agent/episode/episodic,
  //               workspace/project/semantic, user/procedure/procedural, experience/evolution/meta
  // Note: "project" is mentioned in the comment but NOT in the actual switch!
  const knownScopes = ["task_runtime", "working", "session", "agent", "episode", "episodic",
                       "workspace", "project", "semantic", "user", "procedure", "procedural",
                       "experience", "evolution", "meta"];

  // Test each scope maps to a SixLayerMemoryType
  for (const scope of knownScopes) {
    const layer = mapScopeToSixLayer(scope);
    assert.ok(["working", "session", "episodic", "semantic", "procedural", "meta"].includes(layer),
      `${scope} should map to a valid SixLayerMemoryType`);
  }

  // But "project" still maps to "session" due to the missing case
  // (it's listed in comments but not in actual switch statement)
  const projectLayer = mapScopeToSixLayer("project");
  assert.equal(projectLayer, "session"); // Bug: should be "semantic"
});

test("Issue #2028: MemoryDecayService falls back to session for unknown scopes", () => {
  const service = new MemoryDecayService();

  // Test various scopes that should map to different layers
  const testCases: Array<{ scope: string; expectedFallback: SixLayerMemoryType }> = [
    // These scopes are properly mapped:
    { scope: "working", expectedFallback: "working" },  // Works correctly
    { scope: "session", expectedFallback: "session" }, // Works correctly
    { scope: "semantic", expectedFallback: "semantic" }, // Works correctly

    // BUG: project should be semantic but maps to session:
    { scope: "project", expectedFallback: "session" }, // Issue #2028 - wrong fallback!

    // These have no mapping and fall back to session (correct behavior for unknown):
    { scope: "unknown_scope", expectedFallback: "session" }, // Unknown falls to session
    { scope: "random", expectedFallback: "session" }, // Random falls to session
  ];

  for (const { scope, expectedFallback } of testCases) {
    const memory = createMemoryRecord({ scope });
    const config = service.getDecayConfig(memory);
    const expectedConfig = DEFAULT_DECAY_CONFIGS[expectedFallback];

    assert.equal(config.halfLifeSeconds, expectedConfig.halfLifeSeconds,
      `${scope}: expected ${expectedFallback} config with halfLife=${expectedConfig.halfLifeSeconds}`);
  }
});

// =============================================================================
// Existing tests (preserved)
// =============================================================================

test("MemoryDecayService.getDecayConfig maps session scope correctly", () => {
  const service = new MemoryDecayService();

  const memory = createMemoryRecord({ scope: "session" });
  const config = service.getDecayConfig(memory);

  assert.equal(config.halfLifeSeconds, DEFAULT_DECAY_CONFIGS.session.halfLifeSeconds);
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
  const memory = createMemoryRecord({ createdAt: "2026-04-01T00:00:00.000Z" });
  const config = DEFAULT_DECAY_CONFIGS.session;

  const freshness30m = calculateFreshness(memory, config, "2026-04-01T00:30:00.000Z");
  assert.ok(freshness30m > 0.6 && freshness30m < 0.85, `30min freshness: expected ~0.7, got ${freshness30m}`);

  const freshness1h = calculateFreshness(memory, config, "2026-04-01T01:00:00.000Z");
  assert.ok(freshness1h > 0.4 && freshness1h < 0.6, `1hr freshness: expected ~0.5, got ${freshness1h}`);

  const freshness2h = calculateFreshness(memory, config, "2026-04-01T02:00:00.000Z");
  assert.ok(freshness2h > 0.15 && freshness2h < 0.35, `2hr freshness: expected ~0.25, got ${freshness2h}`);
});

test("calculateFreshness respects minFreshness floor", () => {
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

test("calculateFreshness slows decay for frequently accessed memories without pinning freshness to 1.0", () => {
  const coldMemory = createMemoryRecord({ hitCount: 0, createdAt: "2026-04-01T00:00:00.000Z" });
  const hotMemory = createMemoryRecord({ hitCount: 500, createdAt: "2026-04-01T00:00:00.000Z" });
  const config = DEFAULT_DECAY_CONFIGS.session;

  const coldFreshness = calculateFreshness(coldMemory, config, "2026-04-01T02:00:00.000Z");
  const hotFreshness = calculateFreshness(hotMemory, config, "2026-04-01T02:00:00.000Z");

  assert.ok(hotFreshness > coldFreshness, "high hitCount should slow decay instead of accelerating it");
  assert.ok(hotFreshness < 1.0, "high hitCount must not saturate freshness at 1.0");
});

test("calculateFreshness infinite half-life means no decay", () => {
  const memory = createMemoryRecord({ createdAt: "2020-01-01T00:00:00.000Z" });
  const config = DEFAULT_DECAY_CONFIGS.meta;

  const freshness = calculateFreshness(memory, config, "2026-04-01T00:00:00.000Z");
  assert.equal(freshness, 1.0, "meta layer should have no decay (freshness = 1.0)");
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

  assert.ok(workingFreshness <= sessionFreshness, "working should decay faster than session");
  assert.ok(sessionFreshness <= semanticFreshness, "session should decay faster than semantic");
});

test("MemoryDecayService.generateDecaySummary returns correct structure", () => {
  const service = new MemoryDecayService();

  const memories = [
    createMemoryRecord({ scope: "session" }),
    createMemoryRecord({ scope: "session" }),
    createMemoryRecord({ scope: "semantic" }),
  ];

  const summary = service.generateDecaySummary(memories);

  assert.equal(summary.totalMemories, 3);
  assert.ok(summary.byLayer.session.count >= 2);
  assert.ok(summary.byLayer.semantic.count >= 1);
});

test("MemoryDecayService.evaluateCompressionCandidates sorts by score", () => {
  const service = new MemoryDecayService();

  const memories = [
    createMemoryRecord({
      scope: "session",
      qualityScore: 0.9,
      importanceScore: 0.8,
      hitCount: 10,
      createdAt: new Date().toISOString(),
    }),
    createMemoryRecord({
      scope: "session",
      qualityScore: 0.3,
      importanceScore: 0.2,
      hitCount: 1,
      createdAt: new Date().toISOString(),
    }),
  ];

  const result = service.evaluateCompressionCandidates(memories);

  assert.equal(result.totalCount, 2);
  assert.ok(result.candidates.length >= 1);
  // Low quality memory should be first (lowest score = highest compression priority)
  const lowestScore = result.candidates[0];
  assert.ok(lowestScore?.compressionScore < 0.5, "Low quality memory should have low compression score");
});
