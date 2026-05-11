import assert from "node:assert/strict";
import test from "node:test";

import {
  MemoryPromotionEngine as LegacyMemoryPromotionEngine,
} from "../../../../../src/platform/state-evidence/memory/memory-promotion-engine.js";
import {
  MemoryPromotionEngine as FivePlaneMemoryPromotionEngine,
} from "../../../../../src/platform/five-plane-state-evidence/memory/memory-promotion-engine.js";
import type {
  MemoryRecord,
  MemoryKind,
  MemoryLayer,
  MemorySourceTrustLevel,
  MemoryStatus,
} from "../../../../../src/platform/contracts/types/domain.js";

function createMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  const createdAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const lastAccessedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  return {
    id: "mem_001",
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    memoryLayer: "layer_5" as MemoryLayer,
    scope: "agent",
    contentJson: "{\"note\":\"memory\"}",
    classification: "general",
    sourceTrustLevel: "trusted" as MemorySourceTrustLevel,
    qualityScore: 0.8,
    hitCount: 10,
    createdAt,
    lastAccessedAt,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general" as MemoryKind,
    status: "active" as MemoryStatus,
    importanceScore: 0.65,
    freshnessScore: 0.8,
    contentHash: "hash",
    ...overrides,
  };
}

const ENGINES = [
  ["legacy", LegacyMemoryPromotionEngine],
  ["five-plane", FivePlaneMemoryPromotionEngine],
] as const;

for (const [label, EngineClass] of ENGINES) {
  test(`${label} MemoryPromotionEngine promotes agent memories only when the ADR thresholds are met`, () => {
    const engine = new EngineClass();

    const promoted = engine.evaluatePromotion(createMemory());
    const rejected = engine.evaluatePromotion(createMemory({ qualityScore: 0.79 }));

    assert.equal(promoted.targetLayer, "project");
    assert.equal(rejected.targetLayer, null);
  });

  test(`${label} MemoryPromotionEngine evaluates stale session memory for demotion`, () => {
    const engine = new EngineClass();
    const staleSessionMemory = createMemory({
      scope: "session",
      createdAt: "2026-04-01T00:00:00.000Z",
      lastAccessedAt: "2026-04-01T00:00:00.000Z",
      hitCount: 1,
      qualityScore: 0.2,
      importanceScore: 0.2,
    });

    const candidate = engine.evaluateDemotion(staleSessionMemory);

    assert.equal(candidate.currentLayer, "session");
    assert.equal(candidate.targetLayer, "runtime");
  });

test(`${label} MemoryPromotionEngine runPromotionCycle returns promoted, retained, and demoted outcomes in one pass`, () => {
    const engine = new EngineClass();
    const result = engine.runPromotionCycle(
      [
        createMemory({ id: "promote_me", scope: "agent", hitCount: 10, qualityScore: 0.8, importanceScore: 0.65 }),
        createMemory({ id: "retain_me", scope: "agent", hitCount: 9, qualityScore: 0.8, importanceScore: 0.65 }),
        createMemory({ id: "demote_me", scope: "session", createdAt: "2026-04-01T00:00:00.000Z", lastAccessedAt: "2026-04-01T00:00:00.000Z", hitCount: 1, qualityScore: 0.2, importanceScore: 0.2 }),
      ],
      { projectId: "project_alpha" },
    );

    assert.equal(result.promoted.length, 1);
    assert.equal(result.promoted[0]?.memory.id, "promote_me");
    assert.equal(result.projectEntries.length, 1);
    assert.equal(result.rejected.length, 1);
    assert.equal(result.retained.length, 1);
    assert.equal(result.retained[0]?.memory.id, "retain_me");
    assert.equal(result.demoted.length, 1);
    assert.equal(result.demoted[0]?.memory.id, "demote_me");
  });
}
