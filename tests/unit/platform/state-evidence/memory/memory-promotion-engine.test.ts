import assert from "node:assert/strict";
import test from "node:test";

import { MemoryPromotionEngine } from "../../../../../src/platform/state-evidence/memory/memory-promotion-engine.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain/task-types.js";

function createMemory(id: string, scope: string, hitCount: number, qualityScore: number, importanceScore: number): MemoryRecord {
  return {
    id,
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    memoryLayer: "layer_5",
    scope,
    contentJson: "{\"note\":\"memory\"}",
    classification: "general",
    sourceTrustLevel: "trusted",
    qualityScore,
    hitCount,
    createdAt: "2026-04-17T00:00:00.000Z",
    lastAccessedAt: null,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general",
    status: "active",
    importanceScore,
    freshnessScore: 0.8,
    contentHash: "hash",
  };
}

test("MemoryPromotionEngine promotes agent memory into project store when thresholds pass", () => {
  const engine = new MemoryPromotionEngine();
  const result = engine.promote([
    createMemory("mem_project", "agent", 9, 0.8, 0.7),
  ], {
    projectId: "project_alpha",
  });

  assert.equal(result.promoted.length, 1);
  assert.equal(result.promoted[0]?.targetLayer, "project");
  assert.equal(result.projectEntries.length, 1);
  assert.equal(result.projectEntries[0]?.memory.scope, "project");
});

test("MemoryPromotionEngine promotes project memory into user store when thresholds pass", () => {
  const engine = new MemoryPromotionEngine();
  const result = engine.promote([
    createMemory("mem_user", "project", 14, 0.85, 0.8),
  ], {
    userId: "user_alpha",
  });

  assert.equal(result.promoted.length, 1);
  assert.equal(result.promoted[0]?.targetLayer, "user");
  assert.equal(result.userEntries.length, 1);
  assert.equal(result.userEntries[0]?.memory.scope, "user");
});

test("MemoryPromotionEngine rejects memories below thresholds", () => {
  const engine = new MemoryPromotionEngine();
  const result = engine.promote([
    createMemory("mem_reject", "session", 1, 0.4, 0.2),
  ], {
    projectId: "project_alpha",
    userId: "user_alpha",
  });

  assert.equal(result.promoted.length, 0);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.projectEntries.length, 0);
  assert.equal(result.userEntries.length, 0);
});

test("MemoryPromotionEngine listProjectMemory returns entries after promotion", () => {
  const engine = new MemoryPromotionEngine();
  engine.promote([
    createMemory("mem_proj_1", "agent", 10, 0.9, 0.8),
  ], {
    projectId: "proj_list_test",
  });

  const entries = engine.listProjectMemory("proj_list_test");
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.memory.id, "mem_proj_1");
});

test("MemoryPromotionEngine listUserMemory returns entries after promotion", () => {
  const engine = new MemoryPromotionEngine();
  engine.promote([
    createMemory("mem_user_1", "project", 15, 0.9, 0.8),
  ], {
    userId: "user_list_test",
  });

  const entries = engine.listUserMemory("user_list_test");
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.memory.id, "mem_user_1");
});

test("MemoryPromotionEngine listProjectMemory returns empty for unknown project", () => {
  const engine = new MemoryPromotionEngine();
  const entries = engine.listProjectMemory("nonexistent_project");
  assert.deepEqual(entries, []);
});

test("MemoryPromotionEngine listUserMemory returns empty for unknown user", () => {
  const engine = new MemoryPromotionEngine();
  const entries = engine.listUserMemory("nonexistent_user");
  assert.deepEqual(entries, []);
});

test("MemoryPromotionEngine getRules returns configured rules", () => {
  const engine = new MemoryPromotionEngine();
  const rules = engine.getRules();
  assert.ok(rules.length > 0);
  assert.equal(rules[0]?.from, "session");
});

test("MemoryPromotionEngine handles user promotion without userId context", () => {
  // When targetLayer is "user" but context.userId is null, userStore.upsert should not be called
  const engine = new MemoryPromotionEngine();
  const result = engine.promote([
    createMemory("mem_user_only", "project", 15, 0.9, 0.8),
  ], {
    projectId: "proj_without_user",  // userId is undefined
  });

  assert.equal(result.promoted.length, 1);
  assert.equal(result.promoted[0]?.targetLayer, "user");
  assert.equal(result.userEntries.length, 0);  // No userId, so no user entry
  assert.equal(result.projectEntries.length, 0);  // targetLayer is user, not project
});

test("MemoryPromotionEngine handles project promotion without projectId context", () => {
  // When targetLayer is "project" but context.projectId is null, projectStore.upsert should not be called
  const engine = new MemoryPromotionEngine();
  const result = engine.promote([
    createMemory("mem_proj_only", "agent", 10, 0.9, 0.8),
  ], {
    userId: "user_without_proj",  // projectId is undefined
  });

  assert.equal(result.promoted.length, 1);
  assert.equal(result.promoted[0]?.targetLayer, "project");
  assert.equal(result.projectEntries.length, 0);  // No projectId, so no project entry
  assert.equal(result.userEntries.length, 0);  // targetLayer is project, not user
});

test("MemoryPromotionEngine project store get returns entry after upsert", () => {
  const engine = new MemoryPromotionEngine();
  // Access the internal store directly to test get
  const projectStore = (engine as any).projectStore;
  projectStore.upsert("proj_get_test", createMemory("mem_get", "agent", 10, 0.9, 0.8));

  const entry = projectStore.get("proj_get_test", "mem_get");
  assert.ok(entry !== null);
  assert.equal(entry?.memory.id, "mem_get");
});

test("MemoryPromotionEngine user store get returns entry after upsert", () => {
  const engine = new MemoryPromotionEngine();
  // Access the internal store directly to test get
  const userStore = (engine as any).userStore;
  userStore.upsert("user_get_test", createMemory("mem_get_user", "project", 15, 0.9, 0.8));

  const entry = userStore.get("user_get_test", "mem_get_user");
  assert.ok(entry !== null);
  assert.equal(entry?.memory.id, "mem_get_user");
});

test("MemoryPromotionEngine project store get returns null for nonexistent", () => {
  const engine = new MemoryPromotionEngine();
  const projectStore = (engine as any).projectStore;

  const entry = projectStore.get("nonexistent", "nonexistent");
  assert.equal(entry, null);
});

test("MemoryPromotionEngine handles memory with null qualityScore and importanceScore", () => {
  const engine = new MemoryPromotionEngine();
  // Create memory with null qualityScore and importanceScore
  const memory = createMemory("mem_null_scores", "agent", 10, 0, 0) as any;
  memory.qualityScore = null;
  memory.importanceScore = null;

  // Even with null scores, the ?? 0 fallback should allow promotion if other values meet thresholds
  const result = engine.promote([memory], {
    projectId: "proj_null_test",
  });

  // With null scores becoming 0 via ?? 0, the memory should be rejected (0 < thresholds)
  assert.equal(result.promoted.length, 0);
  assert.equal(result.rejected.length, 1);
});

test("MemoryPromotionEngine promotes memory with valid scores despite other memories having null", () => {
  const engine = new MemoryPromotionEngine();
  // Create one memory with valid scores and one with null scores
  const validMemory = createMemory("mem_valid", "agent", 10, 0.85, 0.75);

  // Create memory with explicit null importanceScore
  const nullImportanceMemory = {
    ...createMemory("mem_null_importance", "agent", 10, 0.85, 0.75),
    importanceScore: null as any,
  };

  const result = engine.promote([validMemory, nullImportanceMemory], {
    projectId: "proj_mixed_test",
  });

  // null importanceScore becomes 0 via ?? 0, so only validMemory should be promoted
  assert.equal(result.promoted.length, 1);
  assert.equal(result.promoted[0]?.memory.id, "mem_valid");
});

