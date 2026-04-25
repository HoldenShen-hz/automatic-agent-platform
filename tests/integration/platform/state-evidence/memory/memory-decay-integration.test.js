import assert from "node:assert/strict";
import test from "node:test";

import { MemoryDecayService, DEFAULT_DECAY_CONFIGS } from "../../../../../src/platform/state-evidence/memory/memory-decay-service.js";
import { LayerTransitionService, mapScopeToSixLayer } from "../../../../../src/platform/state-evidence/memory/layer-transition-service.js";
import { MemoryService } from "../../../../../src/platform/state-evidence/memory/memory-service.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createMemoryRecord(overrides = {}) {
  return {
    id: `mem_decay_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    taskId: null,
    sessionId: null,
    agentId: null,
    executionId: null,
    memoryLayer: "layer_3",
    scope: "session",
    contentJson: '{"content":"test memory","facts":[]}',
    classification: "internal",
    sourceTrustLevel: "trusted",
    qualityScore: null,
    hitCount: 0,
    createdAt: new Date().toISOString(),
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

test("decay integration: calculateFreshness for working layer decays rapidly", () => {
  const workspace = createTempWorkspace("aa-decay-working-");
  const dbPath = `${workspace}/decay.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryService = new MemoryService(store);
    const decayService = new MemoryDecayService();

    // Store memory in working scope
    memoryService.remember({
      scope: "working",
      sessionId: "session-decay-test",
      content: { note: "working memory for decay test" },
      createdAt: "2026-04-10T08:00:00.000Z",
    });

    const memories = store.listMemories({
      scopes: ["working"],
      includeExpired: true,
      includeRevoked: true,
      evaluatedAt: "2026-04-10T08:00:00.000Z",
    });

    assert.ok(memories.length > 0);
    const freshness = decayService.calculateFreshness(memories[0], "2026-04-10T08:00:00.000Z");
    assert.equal(freshness, 1.0);

    // After 5 minutes (half-life), freshness should be ~0.5
    const freshness5min = decayService.calculateFreshness(memories[0], "2026-04-10T08:05:00.000Z");
    assert.ok(freshness5min < 1.0, "Working memory should decay within 5 minutes");
    assert.ok(freshness5min > 0.4, "Freshness should not be below minimum");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("decay integration: calculateFreshness for session layer decays slower", () => {
  const workspace = createTempWorkspace("aa-decay-session-");
  const dbPath = `${workspace}/decay.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryService = new MemoryService(store);
    const decayService = new MemoryDecayService();

    memoryService.remember({
      scope: "session",
      sessionId: "session-decay-test",
      content: { note: "session memory for decay test" },
      createdAt: "2026-04-10T08:00:00.000Z",
    });

    const memories = store.listMemories({
      scopes: ["session"],
      includeExpired: true,
      includeRevoked: true,
      evaluatedAt: "2026-04-10T08:00:00.000Z",
    });

    assert.ok(memories.length > 0);

    // Session half-life is 1 hour
    const freshness5min = decayService.calculateFreshness(memories[0], "2026-04-10T08:05:00.000Z");
    assert.ok(freshness5min > 0.9, "Session memory should not decay significantly in 5 minutes");

    // After 1 hour, should be close to 0.5
    const freshness1hr = decayService.calculateFreshness(memories[0], "2026-04-10T09:00:00.000Z");
    assert.ok(freshness1hr < 0.6, "Session memory should decay significantly after 1 hour");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("decay integration: access boost slows decay for frequently accessed memories", () => {
  const workspace = createTempWorkspace("aa-decay-access-boost-");
  const dbPath = `${workspace}/decay.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryService = new MemoryService(store);
    const decayService = new MemoryDecayService();

    // Memory with no hits
    const mem1 = memoryService.remember({
      scope: "working",
      sessionId: "session-boost-test",
      content: { note: "memory without access" },
      createdAt: "2026-04-10T08:00:00.000Z",
    });

    // Memory with multiple hits - update hit count directly
    const mem2 = memoryService.remember({
      scope: "working",
      sessionId: "session-boost-test",
      content: { note: "memory with access" },
      createdAt: "2026-04-10T08:00:00.000Z",
    });

    // Simulate hits on mem2
    store.memory.recordMemoryAccess(mem2.id, "2026-04-10T08:01:00.000Z");
    store.memory.recordMemoryAccess(mem2.id, "2026-04-10T08:02:00.000Z");
    store.memory.recordMemoryAccess(mem2.id, "2026-04-10T08:03:00.000Z");

    const mem1Record = store.getMemory(mem1.id)!;
    const mem2Record = store.getMemory(mem2.id)!;

    // After 5 minutes
    const freshness1 = decayService.calculateFreshness(mem1Record, "2026-04-10T08:05:00.000Z");
    const freshness2 = decayService.calculateFreshness(mem2Record, "2026-04-10T08:05:00.000Z");

    assert.ok(freshness2 > freshness1, "Memory with more hits should have higher freshness due to access boost");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("decay integration: generateDecaySummary aggregates by layer", () => {
  const workspace = createTempWorkspace("aa-decay-summary-");
  const dbPath = `${workspace}/decay.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryService = new MemoryService(store);
    const decayService = new MemoryDecayService();

    // Create memories in different scopes/layers
    memoryService.remember({
      scope: "working",
      sessionId: "session-summary",
      content: { note: "working memory 1" },
      createdAt: "2026-04-10T08:00:00.000Z",
    });
    memoryService.remember({
      scope: "working",
      sessionId: "session-summary",
      content: { note: "working memory 2" },
      createdAt: "2026-04-10T08:00:00.000Z",
    });
    memoryService.remember({
      scope: "session",
      sessionId: "session-summary",
      content: { note: "session memory 1" },
      createdAt: "2026-04-10T08:00:00.000Z",
    });
    memoryService.remember({
      scope: "project",
      sessionId: "session-summary",
      content: { note: "semantic memory 1" },
      createdAt: "2026-04-10T08:00:00.000Z",
    });

    const memories = store.listMemories({
      includeExpired: true,
      includeRevoked: true,
      evaluatedAt: "2026-04-10T08:00:00.000Z",
    });

    const summary = decayService.generateDecaySummary(memories, "2026-04-10T08:00:00.000Z");

    assert.equal(summary.totalMemories, 4);
    assert.equal(summary.averageFreshness, 1.0);
    assert.equal(summary.decayedMemories, 0);
    assert.equal(summary.freshMemories, 4);
    assert.ok(summary.byLayer.working.count >= 2);
    assert.ok(summary.byLayer.session.count >= 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("decay integration: generateDecaySummary shows decayed memories after time passes", () => {
  const workspace = createTempWorkspace("aa-decay-summary-aged-");
  const dbPath = `${workspace}/decay.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryService = new MemoryService(store);
    const decayService = new MemoryDecayService();

    // Create working memories 10 minutes ago
    memoryService.remember({
      scope: "working",
      sessionId: "session-aged",
      content: { note: "working memory aged" },
      createdAt: "2026-04-10T08:00:00.000Z",
    });
    memoryService.remember({
      scope: "working",
      sessionId: "session-aged",
      content: { note: "working memory aged 2" },
      createdAt: "2026-04-10T08:00:00.000Z",
    });

    const memories = store.listMemories({
      scopes: ["working"],
      includeExpired: true,
      includeRevoked: true,
      evaluatedAt: "2026-04-10T08:00:00.000Z",
    });

    // Evaluate at 10 minutes later - working memory half-life is 5 minutes
    const summary = decayService.generateDecaySummary(memories, "2026-04-10T08:10:00.000Z");

    assert.equal(summary.totalMemories, 2);
    assert.ok(summary.decayedMemories > 0, "Working memories should be decayed after 10 minutes");
    assert.ok(summary.byLayer.working.averageFreshness < 1.0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("decay integration: evaluateCompressionCandidates prioritizes low-quality memories", () => {
  const workspace = createTempWorkspace("aa-decay-compression-");
  const dbPath = `${workspace}/decay.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryService = new MemoryService(store);
    const decayService = new MemoryDecayService();

    // Create memories with varying quality scores
    memoryService.remember({
      scope: "session",
      sessionId: "session-compress",
      content: { note: "high quality memory" },
      qualityScore: 0.9,
      createdAt: "2026-04-10T08:00:00.000Z",
    });
    memoryService.remember({
      scope: "session",
      sessionId: "session-compress",
      content: { note: "medium quality memory" },
      qualityScore: 0.6,
      createdAt: "2026-04-10T08:00:00.000Z",
    });
    memoryService.remember({
      scope: "session",
      sessionId: "session-compress",
      content: { note: "low quality memory" },
      qualityScore: 0.3,
      createdAt: "2026-04-10T08:00:00.000Z",
    });

    const memories = store.listMemories({
      scopes: ["session"],
      includeExpired: true,
      includeRevoked: true,
      evaluatedAt: "2026-04-10T08:00:00.000Z",
    });

    const result = decayService.evaluateCompressionCandidates(memories);

    assert.equal(result.totalCount, 3);
    assert.ok(result.candidates.length > 0);

    // Low quality memory should be first (highest compression priority)
    const lowestQuality = result.candidates.find((c) => c.memory.qualityScore === 0.3);
    assert.ok(lowestQuality !== undefined, "Low quality memory should be a compression candidate");
    assert.equal(result.candidates.indexOf(lowestQuality!), 0, "Low quality memory should be highest priority");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("decay integration: evaluateCompressionCandidates with freshness below minimum", () => {
  const workspace = createTempWorkspace("aa-decay-compression-fresh-");
  const dbPath = `${workspace}/decay.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryService = new MemoryService(store);
    const decayService = new MemoryDecayService();

    // Create working memory and age it past minimum freshness
    memoryService.remember({
      scope: "working",
      sessionId: "session-fresh-test",
      content: { note: "old working memory" },
      createdAt: "2026-04-10T08:00:00.000Z",
    });

    const memories = store.listMemories({
      scopes: ["working"],
      includeExpired: true,
      includeRevoked: true,
      evaluatedAt: "2026-04-10T08:00:00.000Z",
    });

    // Evaluate at 10 minutes later - freshness should be near minFreshness
    const result = decayService.evaluateCompressionCandidates(memories, "2026-04-10T08:10:00.000Z");

    assert.ok(result.candidates.length > 0);

    const workingCandidate = result.candidates.find((c) => c.memory.scope === "working");
    assert.ok(workingCandidate !== undefined);
    assert.ok(workingCandidate!.reason.includes("Freshness"), "Reason should mention freshness below minimum");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("decay integration: calculateDecay returns full decay calculation", () => {
  const workspace = createTempWorkspace("aa-decay-calculate-");
  const dbPath = `${workspace}/decay.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryService = new MemoryService(store);
    const decayService = new MemoryDecayService();

    memoryService.remember({
      scope: "session",
      sessionId: "session-calc-test",
      content: { note: "session memory for calculation test" },
      createdAt: "2026-04-10T08:00:00.000Z",
    });

    const memories = store.listMemories({
      scopes: ["session"],
      includeExpired: true,
      includeRevoked: true,
      evaluatedAt: "2026-04-10T08:00:00.000Z",
    });

    const calc = decayService.calculateDecay(memories[0], 1.0, "2026-04-10T09:00:00.000Z");

    assert.equal(calc.memoryId, memories[0].id);
    assert.ok(calc.currentFreshness < 1.0, "Freshness should have decayed");
    assert.equal(calc.previousFreshness, 1.0);
    assert.ok(calc.decayAmount > 0, "Decay amount should be positive");
    assert.ok(calc.accessBoost >= 1.0, "Access boost should be at least 1.0");
    assert.equal(calc.evaluatedAt, "2026-04-10T09:00:00.000Z");
    assert.ok(calc.halfLifeSeconds > 0, "Half-life should be positive");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("decay integration: getDecayConfig returns correct config per layer", () => {
  const workspace = createTempWorkspace("aa-decay-config-");
  const dbPath = `${workspace}/decay.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryService = new MemoryService(store);
    const decayService = new MemoryDecayService();

    memoryService.remember({
      scope: "working",
      sessionId: "session-config-test",
      content: { note: "working memory" },
      createdAt: "2026-04-10T08:00:00.000Z",
    });
    memoryService.remember({
      scope: "project",
      sessionId: "session-config-test",
      content: { note: "semantic memory" },
      createdAt: "2026-04-10T08:00:00.000Z",
    });

    const memories = store.listMemories({
      includeExpired: true,
      includeRevoked: true,
      evaluatedAt: "2026-04-10T08:00:00.000Z",
    });

    const workingMem = memories.find((m) => m.scope === "working")!;
    const semanticMem = memories.find((m) => m.scope === "project")!;

    const workingConfig = decayService.getDecayConfig(workingMem);
    const semanticConfig = decayService.getDecayConfig(semanticMem);

    assert.equal(workingConfig.halfLifeSeconds, 300, "Working half-life should be 5 minutes");
    assert.equal(semanticConfig.halfLifeSeconds, 604800, "Semantic half-life should be 1 week");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("decay integration: decay persists across service restart", () => {
  const workspace = createTempWorkspace("aa-decay-persist-");
  const dbPath = `${workspace}/decay.db`;

  try {
    // First session - create memories
    {
      const db = new SqliteDatabase(dbPath);
      db.migrate();
      const store = new AuthoritativeTaskStore(db);
      const memoryService = new MemoryService(store);

      memoryService.remember({
        scope: "session",
        sessionId: "session-persist",
        content: { note: "memory to persist decay" },
        createdAt: "2026-04-10T08:00:00.000Z",
      });

      db.close();
    }

    // Second session - verify decay state persists
    {
      const db = new SqliteDatabase(dbPath);
      db.migrate();
      const store = new AuthoritativeTaskStore(db);
      const memoryService = new MemoryService(store);
      const decayService = new MemoryDecayService();

      const memories = store.listMemories({
        scopes: ["session"],
        includeExpired: true,
        includeRevoked: true,
        evaluatedAt: "2026-04-10T09:00:00.000Z",
      });

      assert.ok(memories.length > 0);
      const freshness = decayService.calculateFreshness(memories[0], "2026-04-10T09:00:00.000Z");
      assert.ok(freshness < 1.0, "Freshness should be decayed after 1 hour");

      db.close();
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("decay integration: meta layer does not decay", () => {
  const workspace = createTempWorkspace("aa-decay-meta-");
  const dbPath = `${workspace}/decay.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryService = new MemoryService(store);
    const decayService = new MemoryDecayService();

    memoryService.remember({
      scope: "meta",
      content: { note: "meta memory that should not decay" },
      createdAt: "2026-04-10T08:00:00.000Z",
    });

    const memories = store.listMemories({
      scopes: ["meta"],
      includeExpired: true,
      includeRevoked: true,
      evaluatedAt: "2026-04-10T08:00:00.000Z",
    });

    assert.ok(memories.length > 0);

    // Even after very long time, meta layer should not decay
    const freshness = decayService.calculateFreshness(memories[0], "2026-04-11T08:00:00.000Z"); // 1 day later
    assert.equal(freshness, 1.0, "Meta layer should not decay");

    // Also verify via decay calculation
    const calc = decayService.calculateDecay(memories[0], 1.0, "2026-04-11T08:00:00.000Z");
    assert.equal(calc.currentFreshness, 1.0, "Meta layer should show no decay");
    assert.equal(calc.effectiveDecayRate, 0, "Meta layer should have 0 effective decay rate");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("decay integration: procedural layer has slow decay", () => {
  const workspace = createTempWorkspace("aa-decay-procedural-");
  const dbPath = `${workspace}/decay.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryService = new MemoryService(store);
    const decayService = new MemoryDecayService();

    memoryService.remember({
      scope: "procedural",
      content: { note: "procedural memory for decay test" },
      createdAt: "2026-04-10T08:00:00.000Z",
    });

    const memories = store.listMemories({
      scopes: ["procedural"],
      includeExpired: true,
      includeRevoked: true,
      evaluatedAt: "2026-04-10T08:00:00.000Z",
    });

    assert.ok(memories.length > 0);

    // After 1 day, procedural should still be highly fresh (half-life 30 days)
    const freshness1day = decayService.calculateFreshness(memories[0], "2026-04-11T08:00:00.000Z");
    assert.ok(freshness1day > 0.95, "Procedural memory should remain highly fresh after 1 day");

    // After 7 days, still should be above 0.8
    const freshness7days = decayService.calculateFreshness(memories[0], "2026-04-17T08:00:00.000Z");
    assert.ok(freshness7days > 0.8, "Procedural memory should still be fresh after 7 days");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("decay integration: episodic layer has moderate decay rate", () => {
  const workspace = createTempWorkspace("aa-decay-episodic-");
  const dbPath = `${workspace}/decay.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryService = new MemoryService(store);
    const decayService = new MemoryDecayService();

    memoryService.remember({
      scope: "episodic",
      content: { note: "episodic memory for decay test" },
      createdAt: "2026-04-10T08:00:00.000Z",
    });

    const memories = store.listMemories({
      scopes: ["episodic"],
      includeExpired: true,
      includeRevoked: true,
      evaluatedAt: "2026-04-10T08:00:00.000Z",
    });

    assert.ok(memories.length > 0);

    // Episodic half-life is 1 day
    const freshness1day = decayService.calculateFreshness(memories[0], "2026-04-11T08:00:00.000Z");
    assert.ok(freshness1day < 0.6, "Episodic memory should decay significantly after 1 day");
    assert.ok(freshness1day > 0.3, "Episodic memory should not decay below minimum");

    // After 2 days, should be around 0.25
    const freshness2days = decayService.calculateFreshness(memories[0], "2026-04-12T08:00:00.000Z");
    assert.ok(freshness2days < 0.4, "Episodic memory should be significantly decayed after 2 days");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("decay integration: getAllDecayConfigs returns all layer configs", () => {
  const decayService = new MemoryDecayService();
  const configs = decayService.getAllDecayConfigs();

  assert.ok(configs.working, "Should have working config");
  assert.ok(configs.session, "Should have session config");
  assert.ok(configs.episodic, "Should have episodic config");
  assert.ok(configs.semantic, "Should have semantic config");
  assert.ok(configs.procedural, "Should have procedural config");
  assert.ok(configs.meta, "Should have meta config");

  assert.equal(configs.working.halfLifeSeconds, 300);
  assert.equal(configs.session.halfLifeSeconds, 3600);
  assert.equal(configs.episodic.halfLifeSeconds, 86400);
  assert.equal(configs.semantic.halfLifeSeconds, 604800);
  assert.equal(configs.procedural.halfLifeSeconds, 2592000);
  assert.equal(configs.meta.halfLifeSeconds, Number.POSITIVE_INFINITY);
});

test("decay integration: getLayerDecayConfig returns specific layer config", () => {
  const decayService = new MemoryDecayService();

  const workingConfig = decayService.getLayerDecayConfig("working");
  assert.equal(workingConfig.halfLifeSeconds, 300);
  assert.equal(workingConfig.minFreshness, 0.1);

  const metaConfig = decayService.getLayerDecayConfig("meta");
  assert.equal(metaConfig.halfLifeSeconds, Number.POSITIVE_INFINITY);
  assert.equal(metaConfig.decayRateMultiplier, 0.0);
});

test("decay integration: custom decay configs override defaults", () => {
  const customConfigs = {
    working: {
      halfLifeSeconds: 60, // 1 minute
      minFreshness: 0.05,
      decayRateMultiplier: 2.0,
      accessBoostFactor: 0.2,
    },
    session: DEFAULT_DECAY_CONFIGS.session,
    episodic: DEFAULT_DECAY_CONFIGS.episodic,
    semantic: DEFAULT_DECAY_CONFIGS.semantic,
    procedural: DEFAULT_DECAY_CONFIGS.procedural,
    meta: DEFAULT_DECAY_CONFIGS.meta,
  };

  const decayService = new MemoryDecayService(customConfigs);
  const workingConfig = decayService.getLayerDecayConfig("working");

  assert.equal(workingConfig.halfLifeSeconds, 60);
  assert.equal(workingConfig.minFreshness, 0.05);
  assert.equal(workingConfig.decayRateMultiplier, 2.0);
});