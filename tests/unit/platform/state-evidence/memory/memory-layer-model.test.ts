import assert from "node:assert/strict";
import test from "node:test";

import {
  cloneMemoryWithLayer,
  DEFAULT_MEMORY_PROMOTION_RULES as legacyRules,
  mapMemoryScopeToLayer,
} from "../../../../../src/platform/state-evidence/memory/memory-layer-model.js";
import {
  DEFAULT_MEMORY_PROMOTION_RULES as fivePlaneRules,
} from "../../../../../src/platform/five-plane-state-evidence/memory/memory-layer-model.js";
import {
  DEFAULT_SIX_LAYER_TRANSITION_RULES as legacyTransitionRules,
} from "../../../../../src/platform/state-evidence/memory/layer-transition-service.js";
import {
  DEFAULT_SIX_LAYER_TRANSITION_RULES as fivePlaneTransitionRules,
} from "../../../../../src/platform/five-plane-state-evidence/memory/layer-transition-service.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain/task-types.js";

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
  };
}

test("mapMemoryScopeToLayer still maps known legacy scopes", () => {
  assert.equal(mapMemoryScopeToLayer("task_runtime"), "runtime");
  assert.equal(mapMemoryScopeToLayer("workspace"), "project");
});

test("mapMemoryScopeToLayer throws for unknown scopes instead of silently routing them", () => {
  assert.throws(() => mapMemoryScopeToLayer("unknown_scope"), /memory\.layer_unknown/);
});

test("agent to project promotion rule uses the ADR-aligned 10 hits and 0.8 quality threshold in both trees", () => {
  const legacyRule = legacyRules.find((rule) => rule.from === "agent" && rule.to === "project");
  const fivePlaneRule = fivePlaneRules.find((rule) => rule.from === "agent" && rule.to === "project");

  assert.equal(legacyRule?.minHitCount, 10);
  assert.equal(legacyRule?.minQualityScore, 0.8);
  assert.equal(fivePlaneRule?.minHitCount, 10);
  assert.equal(fivePlaneRule?.minQualityScore, 0.8);
});

test("episodic to semantic transition rule stays in sync with the promotion rule in both trees", () => {
  const legacyRule = legacyTransitionRules.find((rule) => rule.from === "episodic" && rule.to === "semantic");
  const fivePlaneRule = fivePlaneTransitionRules.find((rule) => rule.from === "episodic" && rule.to === "semantic");

  assert.equal(legacyRule?.minHitCount, 10);
  assert.equal(legacyRule?.minQualityScore, 0.8);
  assert.equal(fivePlaneRule?.minHitCount, 10);
  assert.equal(fivePlaneRule?.minQualityScore, 0.8);
});

test("cloneMemoryWithLayer updates only the target scope", () => {
  const memory = createTestMemory({ scope: "session", hitCount: 9 });
  const cloned = cloneMemoryWithLayer(memory, "agent");

  assert.equal(cloned.scope, "agent");
  assert.equal(cloned.id, memory.id);
  assert.equal(cloned.hitCount, 9);
});
