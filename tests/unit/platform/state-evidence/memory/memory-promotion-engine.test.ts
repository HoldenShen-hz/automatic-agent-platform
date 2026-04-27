import assert from "node:assert/strict";
import test from "node:test";

import { MemoryPromotionEngine, DEFAULT_MEMORY_PROMOTION_RULES } from "../../../../../src/platform/state-evidence/memory/index.js";
import type { MemoryRecord, MemoryLayer, MemorySourceTrustLevel, MemoryKind, MemoryStatus } from "../../../../../src/platform/contracts/types/domain.js";

function createMemory(
  id: string,
  scope: string,
  hitCount: number,
  qualityScore: number,
  importanceScore: number,
): MemoryRecord {
  return {
    id,
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    memoryLayer: "layer_5" as MemoryLayer,
    scope,
    contentJson: "{\"note\":\"memory\"}",
    classification: "general",
    sourceTrustLevel: "trusted" as MemorySourceTrustLevel,
    qualityScore,
    hitCount,
    createdAt: "2026-04-17T00:00:00.000Z",
    lastAccessedAt: null,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general" as MemoryKind,
    status: "active" as MemoryStatus,
    importanceScore,
    freshnessScore: 0.8,
    contentHash: "hash",
  };
}

// =============================================================================
// MemoryPromotionEngine.evaluatePromotion tests
// =============================================================================

test("evaluatePromotion returns correct candidate for session memory below thresholds", () => {
  const engine = new MemoryPromotionEngine();
  const memory = createMemory("mem_001", "session", 2, 0.5, 0.4);
  const candidate = engine.evaluatePromotion(memory);

  assert.equal(candidate.memory, memory);
  assert.equal(candidate.currentLayer, "session");
  assert.equal(candidate.targetLayer, null);
  assert.equal(candidate.satisfiedRule, null);
});

test("evaluatePromotion returns correct candidate for session memory meeting thresholds", () => {
  const engine = new MemoryPromotionEngine();
  // Rule: session -> agent requires minHitCount: 3, minQualityScore: 0.6, minImportanceScore: 0.5
  const memory = createMemory("mem_002", "session", 3, 0.6, 0.5);
  const candidate = engine.evaluatePromotion(memory);

  assert.equal(candidate.currentLayer, "session");
  assert.equal(candidate.targetLayer, "agent");
  assert.ok(candidate.satisfiedRule !== null);
  assert.equal(candidate.satisfiedRule?.from, "session");
  assert.equal(candidate.satisfiedRule?.to, "agent");
});

test("evaluatePromotion returns correct candidate for agent memory meeting project thresholds", () => {
  const engine = new MemoryPromotionEngine();
  // Rule: agent -> project requires minHitCount: 8, minQualityScore: 0.75, minImportanceScore: 0.65
  const memory = createMemory("mem_003", "agent", 8, 0.75, 0.65);
  const candidate = engine.evaluatePromotion(memory);

  assert.equal(candidate.currentLayer, "agent");
  assert.equal(candidate.targetLayer, "project");
  assert.ok(candidate.satisfiedRule !== null);
});

test("evaluatePromotion returns correct candidate for project memory meeting user thresholds", () => {
  const engine = new MemoryPromotionEngine();
  // Rule: project -> user requires minHitCount: 12, minQualityScore: 0.8, minImportanceScore: 0.75
  const memory = createMemory("mem_004", "project", 12, 0.8, 0.75);
  const candidate = engine.evaluatePromotion(memory);

  assert.equal(candidate.currentLayer, "project");
  assert.equal(candidate.targetLayer, "user");
});

test("evaluatePromotion returns correct candidate for user memory meeting evolution thresholds", () => {
  const engine = new MemoryPromotionEngine();
  // Rule: user -> evolution requires minHitCount: 20, minQualityScore: 0.9, minImportanceScore: 0.85
  const memory = createMemory("mem_005", "user", 20, 0.9, 0.85);
  const candidate = engine.evaluatePromotion(memory);

  assert.equal(candidate.currentLayer, "user");
  assert.equal(candidate.targetLayer, "evolution");
});

test("evaluatePromotion handles null qualityScore with ?? 0 fallback", () => {
  const engine = new MemoryPromotionEngine();
  const memory = createMemory("mem_006", "session", 10, 0, 0.5) as any;
  memory.qualityScore = null;
  const candidate = engine.evaluatePromotion(memory);

  // null ?? 0 = 0, which is below threshold, so no promotion
  assert.equal(candidate.targetLayer, null);
});

test("evaluatePromotion handles null importanceScore with ?? 0 fallback", () => {
  const engine = new MemoryPromotionEngine();
  const memory = createMemory("mem_007", "session", 10, 0.7, 0) as any;
  memory.importanceScore = null;
  const candidate = engine.evaluatePromotion(memory);

  // null ?? 0 = 0, which is below threshold, so no promotion
  assert.equal(candidate.targetLayer, null);
});

test("evaluatePromotion uses legacy runtime scope mapping", () => {
  const engine = new MemoryPromotionEngine();
  // task_runtime should map to runtime layer
  const memory = createMemory("mem_008", "task_runtime", 10, 0.85, 0.75);
  const candidate = engine.evaluatePromotion(memory);

  // task_runtime maps to runtime, not session
  assert.equal(candidate.currentLayer, "runtime");
});

// =============================================================================
// MemoryPromotionEngine.promote tests
// =============================================================================

test("promote adds to projectEntries when targetLayer is project and projectId provided", () => {
  const engine = new MemoryPromotionEngine();
  const result = engine.promote(
    [createMemory("mem_project", "agent", 9, 0.8, 0.7)],
    { projectId: "project_alpha" },
  );

  assert.equal(result.promoted.length, 1);
  assert.equal(result.promoted[0]?.targetLayer, "project");
  assert.equal(result.projectEntries.length, 1);
  assert.equal(result.projectEntries[0]?.memory.scope, "project");
});

test("promote adds to userEntries when targetLayer is user and userId provided", () => {
  const engine = new MemoryPromotionEngine();
  const result = engine.promote(
    [createMemory("mem_user", "project", 14, 0.85, 0.8)],
    { userId: "user_alpha" },
  );

  assert.equal(result.promoted.length, 1);
  assert.equal(result.promoted[0]?.targetLayer, "user");
  assert.equal(result.userEntries.length, 1);
  assert.equal(result.userEntries[0]?.memory.scope, "user");
});

test("promote does not promote when below all thresholds", () => {
  const engine = new MemoryPromotionEngine();
  const result = engine.promote(
    [createMemory("mem_reject", "session", 1, 0.4, 0.2)],
    { projectId: "project_alpha", userId: "user_alpha" },
  );

  assert.equal(result.promoted.length, 0);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.projectEntries.length, 0);
  assert.equal(result.userEntries.length, 0);
});

test("promote handles empty array", () => {
  const engine = new MemoryPromotionEngine();
  const result = engine.promote([], { projectId: "project_alpha" });

  assert.equal(result.promoted.length, 0);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.projectEntries.length, 0);
  assert.equal(result.userEntries.length, 0);
});

test("promote handles multiple memories with mixed promotion results", () => {
  const engine = new MemoryPromotionEngine();
  const memories = [
    createMemory("mem_promote", "agent", 10, 0.85, 0.75), // Should promote to project
    createMemory("mem_reject", "session", 1, 0.4, 0.2), // Should reject
  ];
  const result = engine.promote(memories, { projectId: "proj_001" });

  assert.equal(result.promoted.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.promoted[0]?.memory.id, "mem_promote");
  assert.equal(result.projectEntries.length, 1);
});

test("promote does not add to projectEntries when targetLayer is user (only adds to userEntries)", () => {
  const engine = new MemoryPromotionEngine();
  const result = engine.promote(
    [createMemory("mem_user_only", "project", 15, 0.9, 0.8)],
    { projectId: "proj_001", userId: "user_001" },
  );

  assert.equal(result.promoted.length, 1);
  assert.equal(result.promoted[0]?.targetLayer, "user");
  assert.equal(result.projectEntries.length, 0);
  assert.equal(result.userEntries.length, 1);
});

test("promote does not add to userEntries when targetLayer is project (only adds to projectEntries)", () => {
  const engine = new MemoryPromotionEngine();
  const result = engine.promote(
    [createMemory("mem_proj_only", "agent", 10, 0.85, 0.75)],
    { projectId: "proj_001", userId: "user_001" },
  );

  assert.equal(result.promoted.length, 1);
  assert.equal(result.promoted[0]?.targetLayer, "project");
  assert.equal(result.projectEntries.length, 1);
  assert.equal(result.userEntries.length, 0);
});

test("promote with no projectId context skips project store", () => {
  const engine = new MemoryPromotionEngine();
  const result = engine.promote(
    [createMemory("mem_proj_no_context", "agent", 10, 0.85, 0.75)],
    { userId: "user_001" }, // No projectId
  );

  assert.equal(result.promoted.length, 1);
  assert.equal(result.projectEntries.length, 0);
});

test("promote with no userId context skips user store", () => {
  const engine = new MemoryPromotionEngine();
  const result = engine.promote(
    [createMemory("mem_user_no_context", "project", 15, 0.9, 0.8)],
    { projectId: "proj_001" }, // No userId
  );

  assert.equal(result.promoted.length, 1);
  assert.equal(result.userEntries.length, 0);
});

test("promote with null projectId skips project store", () => {
  const engine = new MemoryPromotionEngine();
  const result = engine.promote(
    [createMemory("mem_proj_null", "agent", 10, 0.85, 0.75)],
    { projectId: null, userId: "user_001" },
  );

  assert.equal(result.promoted.length, 1);
  assert.equal(result.projectEntries.length, 0);
});

test("promote with null userId skips user store", () => {
  const engine = new MemoryPromotionEngine();
  const result = engine.promote(
    [createMemory("mem_user_null", "project", 15, 0.9, 0.8)],
    { projectId: "proj_001", userId: null },
  );

  assert.equal(result.promoted.length, 1);
  assert.equal(result.userEntries.length, 0);
});

test("promote clones memory with correct layer into project store", () => {
  const engine = new MemoryPromotionEngine();
  const originalMemory = createMemory("mem_clone", "agent", 10, 0.85, 0.75);
  const result = engine.promote([originalMemory], { projectId: "proj_clone_test" });

  assert.equal(result.projectEntries.length, 1);
  assert.equal(result.projectEntries[0]?.memory.scope, "project");
  assert.equal(result.projectEntries[0]?.memory.id, "mem_clone");
});

test("promote clones memory with correct layer into user store", () => {
  const engine = new MemoryPromotionEngine();
  const originalMemory = createMemory("mem_user_clone", "project", 15, 0.9, 0.8);
  const result = engine.promote([originalMemory], { userId: "user_clone_test" });

  assert.equal(result.userEntries.length, 1);
  assert.equal(result.userEntries[0]?.memory.scope, "user");
  assert.equal(result.userEntries[0]?.memory.id, "mem_user_clone");
});

// =============================================================================
// MemoryPromotionEngine.listProjectMemory tests
// =============================================================================

test("listProjectMemory returns entries after promotion", () => {
  const engine = new MemoryPromotionEngine();
  engine.promote(
    [createMemory("mem_proj_1", "agent", 10, 0.9, 0.8)],
    { projectId: "proj_list_test" },
  );

  const entries = engine.listProjectMemory("proj_list_test");
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.memory.id, "mem_proj_1");
});

test("listProjectMemory returns empty for unknown project", () => {
  const engine = new MemoryPromotionEngine();
  const entries = engine.listProjectMemory("nonexistent_project");
  assert.deepEqual(entries, []);
});

test("listProjectMemory returns multiple entries for same project", () => {
  const engine = new MemoryPromotionEngine();
  engine.promote(
    [createMemory("mem_proj_a", "agent", 10, 0.9, 0.8)],
    { projectId: "proj_multi" },
  );
  engine.promote(
    [createMemory("mem_proj_b", "agent", 12, 0.85, 0.75)],
    { projectId: "proj_multi" },
  );

  const entries = engine.listProjectMemory("proj_multi");
  assert.equal(entries.length, 2);
});

test("listProjectMemory only returns entries for specified project", () => {
  const engine = new MemoryPromotionEngine();
  engine.promote(
    [createMemory("mem_proj_1", "agent", 10, 0.9, 0.8)],
    { projectId: "proj_a" },
  );
  engine.promote(
    [createMemory("mem_proj_2", "agent", 12, 0.85, 0.75)],
    { projectId: "proj_b" },
  );

  const entriesA = engine.listProjectMemory("proj_a");
  const entriesB = engine.listProjectMemory("proj_b");
  assert.equal(entriesA.length, 1);
  assert.equal(entriesB.length, 1);
  assert.equal(entriesA[0]?.memory.id, "mem_proj_1");
  assert.equal(entriesB[0]?.memory.id, "mem_proj_2");
});

// =============================================================================
// MemoryPromotionEngine.listUserMemory tests
// =============================================================================

test("listUserMemory returns entries after promotion", () => {
  const engine = new MemoryPromotionEngine();
  engine.promote(
    [createMemory("mem_user_1", "project", 15, 0.9, 0.8)],
    { userId: "user_list_test" },
  );

  const entries = engine.listUserMemory("user_list_test");
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.memory.id, "mem_user_1");
});

test("listUserMemory returns empty for unknown user", () => {
  const engine = new MemoryPromotionEngine();
  const entries = engine.listUserMemory("nonexistent_user");
  assert.deepEqual(entries, []);
});

test("listUserMemory returns multiple entries for same user", () => {
  const engine = new MemoryPromotionEngine();
  engine.promote(
    [createMemory("mem_user_a", "project", 15, 0.9, 0.8)],
    { userId: "user_multi" },
  );
  engine.promote(
    [createMemory("mem_user_b", "project", 20, 0.85, 0.75)],
    { userId: "user_multi" },
  );

  const entries = engine.listUserMemory("user_multi");
  assert.equal(entries.length, 2);
});

test("listUserMemory only returns entries for specified user", () => {
  const engine = new MemoryPromotionEngine();
  engine.promote(
    [createMemory("mem_user_1", "project", 15, 0.9, 0.8)],
    { userId: "user_a" },
  );
  engine.promote(
    [createMemory("mem_user_2", "project", 20, 0.85, 0.75)],
    { userId: "user_b" },
  );

  const entriesA = engine.listUserMemory("user_a");
  const entriesB = engine.listUserMemory("user_b");
  assert.equal(entriesA.length, 1);
  assert.equal(entriesB.length, 1);
  assert.equal(entriesA[0]?.memory.id, "mem_user_1");
  assert.equal(entriesB[0]?.memory.id, "mem_user_2");
});

// =============================================================================
// MemoryPromotionEngine.getRules tests
// =============================================================================

test("getRules returns configured rules", () => {
  const engine = new MemoryPromotionEngine();
  const rules = engine.getRules();
  assert.ok(rules.length > 0);
});

test("getRules returns default promotion rules", () => {
  const engine = new MemoryPromotionEngine();
  const rules = engine.getRules();
  assert.equal(rules.length, DEFAULT_MEMORY_PROMOTION_RULES.length);
});

test("getRules first rule starts from session", () => {
  const engine = new MemoryPromotionEngine();
  const rules = engine.getRules();
  assert.equal(rules[0]?.from, "session");
});

test("getRules returns immutable copy", () => {
  const engine = new MemoryPromotionEngine();
  const rules1 = engine.getRules();
  const rules2 = engine.getRules();
  // Should be equal but not same reference
  assert.equal(rules1.length, rules2.length);
});

// =============================================================================
// Default rules verification
// =============================================================================

test("DEFAULT_MEMORY_PROMOTION_RULES has correct session->agent rule", () => {
  const rule = DEFAULT_MEMORY_PROMOTION_RULES.find((r) => r.from === "session");
  assert.ok(rule !== undefined);
  assert.equal(rule.to, "agent");
  assert.equal(rule.minHitCount, 3);
  assert.equal(rule.minQualityScore, 0.6);
  assert.equal(rule.minImportanceScore, 0.5);
});

test("DEFAULT_MEMORY_PROMOTION_RULES has correct agent->project rule", () => {
  const rule = DEFAULT_MEMORY_PROMOTION_RULES.find((r) => r.from === "agent");
  assert.ok(rule !== undefined);
  assert.equal(rule.to, "project");
  assert.equal(rule.minHitCount, 8);
  assert.equal(rule.minQualityScore, 0.75);
  assert.equal(rule.minImportanceScore, 0.65);
});

test("DEFAULT_MEMORY_PROMOTION_RULES has correct project->user rule", () => {
  const rule = DEFAULT_MEMORY_PROMOTION_RULES.find((r) => r.from === "project");
  assert.ok(rule !== undefined);
  assert.equal(rule.to, "user");
  assert.equal(rule.minHitCount, 12);
  assert.equal(rule.minQualityScore, 0.8);
  assert.equal(rule.minImportanceScore, 0.75);
});

test("DEFAULT_MEMORY_PROMOTION_RULES has correct user->evolution rule", () => {
  const rule = DEFAULT_MEMORY_PROMOTION_RULES.find((r) => r.from === "user");
  assert.ok(rule !== undefined);
  assert.equal(rule.to, "evolution");
  assert.equal(rule.minHitCount, 20);
  assert.equal(rule.minQualityScore, 0.9);
  assert.equal(rule.minImportanceScore, 0.85);
});

// =============================================================================
// Edge cases
// =============================================================================

test("promote handles memory exactly at hitCount threshold", () => {
  const engine = new MemoryPromotionEngine();
  // session->agent requires minHitCount: 3
  const memory = createMemory("mem_exact", "session", 3, 0.6, 0.5);
  const result = engine.promote([memory], { projectId: "proj_exact" });

  assert.equal(result.promoted.length, 1);
});

test("promote handles memory exactly at qualityScore threshold", () => {
  const engine = new MemoryPromotionEngine();
  const memory = createMemory("mem_quality", "session", 3, 0.6, 0.5);
  const result = engine.promote([memory], { projectId: "proj_quality" });

  assert.equal(result.promoted.length, 1);
});

test("promote handles memory exactly at importanceScore threshold", () => {
  const engine = new MemoryPromotionEngine();
  const memory = createMemory("mem_importance", "session", 3, 0.6, 0.5);
  const result = engine.promote([memory], { projectId: "proj_importance" });

  assert.equal(result.promoted.length, 1);
});

test("promote handles memory one below hitCount threshold", () => {
  const engine = new MemoryPromotionEngine();
  const memory = createMemory("mem_below", "session", 2, 0.6, 0.5);
  const result = engine.promote([memory], { projectId: "proj_below" });

  assert.equal(result.promoted.length, 0);
});

test("promote handles memory one below qualityScore threshold", () => {
  const engine = new MemoryPromotionEngine();
  const memory = createMemory("mem_below_q", "session", 3, 0.59, 0.5);
  const result = engine.promote([memory], { projectId: "proj_below_q" });

  assert.equal(result.promoted.length, 0);
});

test("promote handles memory one below importanceScore threshold", () => {
  const engine = new MemoryPromotionEngine();
  const memory = createMemory("mem_below_i", "session", 3, 0.6, 0.49);
  const result = engine.promote([memory], { projectId: "proj_below_i" });

  assert.equal(result.promoted.length, 0);
});

test("MemoryPromotionResult structure is correct", () => {
  const engine = new MemoryPromotionEngine();
  const result = engine.promote([], {});

  assert.ok(Array.isArray(result.promoted));
  assert.ok(Array.isArray(result.rejected));
  assert.ok(Array.isArray(result.projectEntries));
  assert.ok(Array.isArray(result.userEntries));
});

test("promote updates rejected array for memories not meeting thresholds", () => {
  const engine = new MemoryPromotionEngine();
  const memories = [
    createMemory("mem_reject1", "session", 1, 0.3, 0.2),
    createMemory("mem_reject2", "session", 2, 0.4, 0.3),
  ];
  const result = engine.promote(memories, { projectId: "proj_reject" });

  assert.equal(result.promoted.length, 0);
  assert.equal(result.rejected.length, 2);
});

test("promote separates promoted and rejected correctly", () => {
  const engine = new MemoryPromotionEngine();
  const memories = [
    createMemory("mem_promote", "agent", 10, 0.85, 0.75), // Should promote
    createMemory("mem_reject", "session", 1, 0.3, 0.2), // Should reject
  ];
  const result = engine.promote(memories, { projectId: "proj_mixed" });

  assert.equal(result.promoted.length, 1);
  assert.equal(result.promoted[0]?.memory.id, "mem_promote");
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0]?.memory.id, "mem_reject");
});
