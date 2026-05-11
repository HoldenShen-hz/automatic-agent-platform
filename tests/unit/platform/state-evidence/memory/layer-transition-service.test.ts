import test from "node:test";
import assert from "node:assert/strict";

import {
  LayerTransitionService,
  DEFAULT_SIX_LAYER_TRANSITION_RULES,
  LAYER_METADATA,
  mapScopeToSixLayer,
  mapLayerToScope,
  getNextLayer,
  getPreviousLayer,
  getLayerMetadata,
  getLayerPriority,
  type SixLayerMemoryType,
  type LayerTransitionEvaluation,
} from "../../../../../src/platform/state-evidence/memory/layer-transition-service.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createTestMemory(overrides: Partial<MemoryRecord> & { scope: string }): MemoryRecord {
  const base: MemoryRecord = {
    id: "mem_test_1",
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    memoryLayer: "layer_5",
    scope: "session",
    contentJson: JSON.stringify({ text: "Test memory content" }),
    classification: "general",
    sourceTrustLevel: "trusted",
    qualityScore: 0.7,
    hitCount: 5,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(), // 24 hours ago
    lastAccessedAt: null,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general",
    status: "active",
    importanceScore: 0.8,
    freshnessScore: 0.9,
    contentHash: "hash123",
  };
  return { ...base, ...overrides };
}

test("mapScopeToSixLayer returns working for task_runtime", () => {
  assert.equal(mapScopeToSixLayer("task_runtime"), "working");
});

test("mapScopeToSixLayer returns working for working", () => {
  assert.equal(mapScopeToSixLayer("working"), "working");
});

test("mapScopeToSixLayer returns session for session", () => {
  assert.equal(mapScopeToSixLayer("session"), "session");
});

test("mapScopeToSixLayer returns episodic for agent", () => {
  assert.equal(mapScopeToSixLayer("agent"), "episodic");
});

test("mapScopeToSixLayer returns episodic for episodic", () => {
  assert.equal(mapScopeToSixLayer("episodic"), "episodic");
});

test("mapScopeToSixLayer returns semantic for project", () => {
  assert.equal(mapScopeToSixLayer("project"), "semantic");
});

test("mapScopeToSixLayer returns semantic for workspace", () => {
  assert.equal(mapScopeToSixLayer("workspace"), "semantic");
});

test("mapScopeToSixLayer returns procedural for user", () => {
  assert.equal(mapScopeToSixLayer("user"), "procedural");
});

test("mapScopeToSixLayer returns meta for experience", () => {
  assert.equal(mapScopeToSixLayer("experience"), "meta");
});

test("mapScopeToSixLayer defaults to session for unknown scopes", () => {
  assert.equal(mapScopeToSixLayer("unknown"), "session");
  assert.equal(mapScopeToSixLayer(""), "session");
});

test("mapLayerToScope returns correct scope for each layer", () => {
  assert.equal(mapLayerToScope("working"), "working");
  assert.equal(mapLayerToScope("session"), "session");
  assert.equal(mapLayerToScope("episodic"), "episodic");
  assert.equal(mapLayerToScope("semantic"), "semantic");
  assert.equal(mapLayerToScope("procedural"), "procedural");
  assert.equal(mapLayerToScope("meta"), "meta");
});

test("getNextLayer returns correct next layer", () => {
  assert.equal(getNextLayer("working"), "session");
  assert.equal(getNextLayer("session"), "episodic");
  assert.equal(getNextLayer("episodic"), "semantic");
  assert.equal(getNextLayer("semantic"), "procedural");
  assert.equal(getNextLayer("procedural"), "meta");
  assert.equal(getNextLayer("meta"), null);
});

test("getPreviousLayer returns correct previous layer", () => {
  assert.equal(getPreviousLayer("working"), null);
  assert.equal(getPreviousLayer("session"), "working");
  assert.equal(getPreviousLayer("episodic"), "session");
  assert.equal(getPreviousLayer("semantic"), "episodic");
  assert.equal(getPreviousLayer("procedural"), "semantic");
  assert.equal(getPreviousLayer("meta"), "procedural");
});

test("getLayerMetadata returns correct metadata", () => {
  const meta = getLayerMetadata("working");
  assert.ok(meta);
  assert.equal(meta!.layer, "working");
  assert.equal(meta!.displayName, "Working Memory");
  assert.ok(meta!.typicalRetentionSeconds > 0);
});

test("getLayerPriority returns correct priorities", () => {
  assert.ok(getLayerPriority("working") > getLayerPriority("session"));
  assert.ok(getLayerPriority("session") > getLayerPriority("episodic"));
  assert.ok(getLayerPriority("episodic") > getLayerPriority("semantic"));
  assert.ok(getLayerPriority("semantic") > getLayerPriority("procedural"));
  assert.ok(getLayerPriority("procedural") > getLayerPriority("meta"));
});

test("DEFAULT_SIX_LAYER_TRANSITION_RULES has 5 rules for 5 transitions", () => {
  assert.equal(DEFAULT_SIX_LAYER_TRANSITION_RULES.length, 5);
});

test("DEFAULT_SIX_LAYER_TRANSITION_RULES has monotonic promotion thresholds", () => {
  for (let i = 1; i < DEFAULT_SIX_LAYER_TRANSITION_RULES.length; i++) {
    const prev = DEFAULT_SIX_LAYER_TRANSITION_RULES[i - 1]!;
    const curr = DEFAULT_SIX_LAYER_TRANSITION_RULES[i]!;
    assert.ok(curr.minHitCount > prev.minHitCount);
    assert.ok(curr.minQualityScore >= prev.minQualityScore);
    assert.ok(curr.minImportanceScore > prev.minImportanceScore);
    assert.ok(curr.minAgeHours > prev.minAgeHours);
  }
});

test("LayerTransitionService evaluateTransition allows promotion when thresholds met", () => {
  const service = new LayerTransitionService();
  // Working memory with sufficient hit count, quality, importance, and age
  const memory = createTestMemory({
    scope: "working",
    hitCount: 10,
    qualityScore: 0.8,
    importanceScore: 0.8,
    createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  });

  const evaluation = service.evaluateTransition(memory);
  assert.equal(evaluation.canTransition, true);
  assert.equal(evaluation.targetLayer, "session");
  assert.equal(evaluation.blockers.length, 0);
});

test("LayerTransitionService evaluateTransition blocks when hitCount insufficient", () => {
  const service = new LayerTransitionService();
  const memory = createTestMemory({
    scope: "working",
    hitCount: 1, // Below threshold of 3
    qualityScore: 0.8,
    importanceScore: 0.8,
  });

  const evaluation = service.evaluateTransition(memory);
  assert.equal(evaluation.canTransition, false);
  assert.ok(evaluation.blockers.some(b => b.includes("hitCount")));
});

test("LayerTransitionService evaluateTransition blocks when qualityScore insufficient", () => {
  const service = new LayerTransitionService();
  const memory = createTestMemory({
    scope: "working",
    hitCount: 10,
    qualityScore: 0.2, // Below threshold of 0.4
    importanceScore: 0.8,
  });

  const evaluation = service.evaluateTransition(memory);
  assert.equal(evaluation.canTransition, false);
  assert.ok(evaluation.blockers.some(b => b.includes("qualityScore")));
});

test("LayerTransitionService evaluateTransition blocks when importanceScore insufficient", () => {
  const service = new LayerTransitionService();
  const memory = createTestMemory({
    scope: "working",
    hitCount: 10,
    qualityScore: 0.8,
    importanceScore: 0.1, // Below threshold of 0.3
  });

  const evaluation = service.evaluateTransition(memory);
  assert.equal(evaluation.canTransition, false);
  assert.ok(evaluation.blockers.some(b => b.includes("importanceScore")));
});

test("LayerTransitionService evaluateTransition blocks when memory too young", () => {
  const service = new LayerTransitionService();
  const memory = createTestMemory({
    scope: "working",
    hitCount: 10,
    qualityScore: 0.8,
    importanceScore: 0.8,
    createdAt: new Date().toISOString(), // Just now
  });

  const evaluation = service.evaluateTransition(memory);
  assert.equal(evaluation.canTransition, false);
  assert.ok(evaluation.blockers.some(b => b.includes("age")));
});

test("LayerTransitionService evaluateTransition blocks at meta layer", () => {
  const service = new LayerTransitionService();
  const memory = createTestMemory({
    scope: "meta",
    hitCount: 100,
    qualityScore: 1.0,
    importanceScore: 1.0,
  });

  const evaluation = service.evaluateTransition(memory);
  assert.equal(evaluation.canTransition, false);
  assert.ok(evaluation.blockers.includes("at_max_layer"));
});

test("LayerTransitionService getTransitionDirection returns up for promotable memory", () => {
  const service = new LayerTransitionService();
  const memory = createTestMemory({
    scope: "working",
    hitCount: 10,
    qualityScore: 0.8,
    importanceScore: 0.8,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  });

  const direction = service.getTransitionDirection(memory);
  assert.equal(direction, "up");
});

test("LayerTransitionService getTransitionDirection returns lateral for non-promotable", () => {
  const service = new LayerTransitionService();
  const memory = createTestMemory({
    scope: "working",
    hitCount: 1,
    qualityScore: 0.2,
    importanceScore: 0.2,
  });

  const direction = service.getTransitionDirection(memory);
  assert.equal(direction, "lateral");
});

test("LayerTransitionService getRule returns rule for valid layer", () => {
  const service = new LayerTransitionService();
  const rule = service.getRule("working");
  assert.ok(rule);
  assert.equal(rule!.from, "working");
  assert.equal(rule!.to, "session");
});

test("LayerTransitionService getRule returns null for meta layer", () => {
  const service = new LayerTransitionService();
  const rule = service.getRule("meta");
  assert.equal(rule, null);
});

test("LayerTransitionService getRules returns all rules", () => {
  const service = new LayerTransitionService();
  const rules = service.getRules();
  assert.equal(rules.length, 5);
});

test("LayerTransitionService createTransitionRecord returns record for valid transition", () => {
  const service = new LayerTransitionService();
  const memory = createTestMemory({
    scope: "working",
    hitCount: 10,
    qualityScore: 0.8,
    importanceScore: 0.8,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  });

  const evaluation: LayerTransitionEvaluation = {
    canTransition: true,
    targetLayer: "session",
    reason: "All thresholds met",
    blockers: [],
  };

  const record = service.createTransitionRecord(memory, evaluation);
  assert.ok(record);
  assert.equal(record!.memoryId, memory.id);
  assert.equal(record!.fromLayer, "working");
  assert.equal(record!.toLayer, "session");
});

test("LayerTransitionService createTransitionRecord returns null for invalid transition", () => {
  const service = new LayerTransitionService();
  const memory = createTestMemory({
    scope: "working",
    hitCount: 1,
    qualityScore: 0.2,
    importanceScore: 0.2,
  });

  const evaluation: LayerTransitionEvaluation = {
    canTransition: false,
    targetLayer: "session",
    reason: "Blocked",
    blockers: ["hitCount"],
  };

  const record = service.createTransitionRecord(memory, evaluation);
  assert.equal(record, null);
});

test("LayerTransitionService evaluates session to episodic transition", () => {
  const service = new LayerTransitionService();
  const memory = createTestMemory({
    scope: "session",
    hitCount: 15,
    qualityScore: 0.7,
    importanceScore: 0.7,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(), // 5 hours ago
  });

  const evaluation = service.evaluateTransition(memory);
  assert.equal(evaluation.canTransition, true);
  assert.equal(evaluation.targetLayer, "episodic");
});

test("LayerTransitionService handles null qualityScore with fallback", () => {
  const service = new LayerTransitionService();
  const memory = createTestMemory({
    scope: "working",
    hitCount: 10,
    qualityScore: null as any,
    importanceScore: 0.8,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  });

  const evaluation = service.evaluateTransition(memory);
  assert.equal(evaluation.canTransition, false);
  assert.ok(evaluation.blockers.some(b => b.includes("qualityScore")));
});

test("LayerTransitionService handles null importanceScore with fallback", () => {
  const service = new LayerTransitionService();
  const memory = createTestMemory({
    scope: "working",
    hitCount: 10,
    qualityScore: 0.8,
    importanceScore: null as any,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  });

  const evaluation = service.evaluateTransition(memory);
  assert.equal(evaluation.canTransition, false);
  assert.ok(evaluation.blockers.some(b => b.includes("importanceScore")));
});

test("LAYER_METADATA has correct number of entries", () => {
  assert.equal(LAYER_METADATA.length, 6);
});

test("LAYER_METADATA has valid retention values", () => {
  for (const meta of LAYER_METADATA) {
    assert.ok(meta.typicalRetentionSeconds > 0 || Number.isFinite(meta.typicalRetentionSeconds));
    assert.ok(meta.priority > 0);
  }
});

test("LAYER_METADATA meta layer has infinite retention", () => {
  const meta = getLayerMetadata("meta");
  assert.ok(meta);
  assert.equal(meta!.typicalRetentionSeconds, Number.POSITIVE_INFINITY);
});
