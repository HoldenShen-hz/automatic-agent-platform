import assert from "node:assert/strict";
import test from "node:test";

import { ProjectMemoryStore } from "../../../../../src/platform/five-plane-state-evidence/memory/project-memory-store.js";
import { UserMemoryStore } from "../../../../../src/platform/five-plane-state-evidence/memory/user-memory-store.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";

// =============================================================================
// Mock Factory
// =============================================================================

function createMockMemoryRecord(id: string, contentJson: string = "test content"): MemoryRecord {
  return {
    id,
    taskId: null,
    sessionId: null,
    agentId: null,
    executionId: null,
    memoryLayer: "layer_3",
    scope: "project",
    contentJson,
    classification: "general",
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
  };
}

// =============================================================================
// ProjectMemoryStore Tests
// =============================================================================

test("ProjectMemoryStore.upsert creates entry with correct projectId", () => {
  const store = new ProjectMemoryStore();
  const memory = createMockMemoryRecord("mem_1", "content");

  const entry = store.upsert("proj_abc", memory);

  assert.equal(entry.projectId, "proj_abc");
  assert.equal(entry.memory.id, "mem_1");
});

test("ProjectMemoryStore.upsert uses provided promotedAt timestamp", () => {
  const store = new ProjectMemoryStore();
  const memory = createMockMemoryRecord("mem_ts", "content");
  const customTs = "2025-06-15T12:00:00.000Z";

  const entry = store.upsert("proj_ts", memory, customTs);

  assert.equal(entry.promotedAt, customTs);
});

test("ProjectMemoryStore.upsert defaults promotedAt to current time", () => {
  const store = new ProjectMemoryStore();
  const memory = createMockMemoryRecord("mem_now", "content");
  const before = new Date().toISOString();

  const entry = store.upsert("proj_now", memory);

  const after = new Date().toISOString();
  assert.ok(entry.promotedAt >= before && entry.promotedAt <= after);
});

test("ProjectMemoryStore.upsert overwrites existing entry with same memory id", () => {
  const store = new ProjectMemoryStore();
  const memory1 = createMockMemoryRecord("mem_id", "original");
  const memory2 = createMockMemoryRecord("mem_id", "updated");

  store.upsert("proj_overwrite", memory1);
  const updated = store.upsert("proj_overwrite", memory2);

  assert.equal(updated.memory.contentJson, "updated");
  assert.equal(store.list("proj_overwrite").length, 1);
});

test("ProjectMemoryStore.list returns empty array for unknown project", () => {
  const store = new ProjectMemoryStore();

  const result = store.list("nonexistent");

  assert.deepEqual(result, []);
});

test("ProjectMemoryStore.list returns all entries for project", () => {
  const store = new ProjectMemoryStore();
  store.upsert("proj_list", createMockMemoryRecord("mem_a", "content a"));
  store.upsert("proj_list", createMockMemoryRecord("mem_b", "content b"));

  const result = store.list("proj_list");

  assert.equal(result.length, 2);
});

test("ProjectMemoryStore.list returns separate entries per project", () => {
  const store = new ProjectMemoryStore();
  store.upsert("proj_x", createMockMemoryRecord("mem_x", "x content"));
  store.upsert("proj_y", createMockMemoryRecord("mem_y", "y content"));

  const listX = store.list("proj_x");
  const listY = store.list("proj_y");

  assert.equal(listX.length, 1);
  assert.equal(listY.length, 1);
  assert.equal(listX[0]?.memory.contentJson, "x content");
  assert.equal(listY[0]?.memory.contentJson, "y content");
});

test("ProjectMemoryStore.get returns null for unknown project", () => {
  const store = new ProjectMemoryStore();

  const result = store.get("unknown_proj", "mem_1");

  assert.equal(result, null);
});

test("ProjectMemoryStore.get returns null for unknown memory id", () => {
  const store = new ProjectMemoryStore();
  store.upsert("proj_known", createMockMemoryRecord("mem_known", "content"));

  const result = store.get("proj_known", "mem_unknown");

  assert.equal(result, null);
});

test("ProjectMemoryStore.get returns correct entry", () => {
  const store = new ProjectMemoryStore();
  const memory = createMockMemoryRecord("mem_target", "target content");
  store.upsert("proj_t", memory);

  const result = store.get("proj_t", "mem_target");

  assert.notEqual(result, null);
  assert.equal(result?.projectId, "proj_t");
  assert.equal(result?.memory.id, "mem_target");
});

// =============================================================================
// UserMemoryStore Tests
// =============================================================================

test("UserMemoryStore.upsert creates entry with correct userId", () => {
  const store = new UserMemoryStore();
  const memory = createMockMemoryRecord("mem_u1", "user content");

  const entry = store.upsert("user_123", memory);

  assert.equal(entry.userId, "user_123");
  assert.equal(entry.memory.id, "mem_u1");
});

test("UserMemoryStore.upsert uses provided promotedAt timestamp", () => {
  const store = new UserMemoryStore();
  const memory = createMockMemoryRecord("mem_uts", "content");
  const customTs = "2025-07-20T09:30:00.000Z";

  const entry = store.upsert("user_ts", memory, customTs);

  assert.equal(entry.promotedAt, customTs);
});

test("UserMemoryStore.upsert defaults promotedAt to current time", () => {
  const store = new UserMemoryStore();
  const memory = createMockMemoryRecord("mem_unow", "content");
  const before = new Date().toISOString();

  const entry = store.upsert("user_now", memory);

  const after = new Date().toISOString();
  assert.ok(entry.promotedAt >= before && entry.promotedAt <= after);
});

test("UserMemoryStore.upsert overwrites existing entry with same memory id", () => {
  const store = new UserMemoryStore();
  const memory1 = createMockMemoryRecord("mem_uid", "first");
  const memory2 = createMockMemoryRecord("mem_uid", "second");

  store.upsert("user_overwrite", memory1);
  const updated = store.upsert("user_overwrite", memory2);

  assert.equal(updated.memory.contentJson, "second");
  assert.equal(store.list("user_overwrite").length, 1);
});

test("UserMemoryStore.list returns empty array for unknown user", () => {
  const store = new UserMemoryStore();

  const result = store.list("unknown_user");

  assert.deepEqual(result, []);
});

test("UserMemoryStore.list returns all entries for user", () => {
  const store = new UserMemoryStore();
  store.upsert("user_list", createMockMemoryRecord("mem_ua", "a content"));
  store.upsert("user_list", createMockMemoryRecord("mem_ub", "b content"));

  const result = store.list("user_list");

  assert.equal(result.length, 2);
});

test("UserMemoryStore.get returns null for unknown user", () => {
  const store = new UserMemoryStore();

  const result = store.get("unknown_user", "mem_1");

  assert.equal(result, null);
});

test("UserMemoryStore.get returns null for unknown memory id", () => {
  const store = new UserMemoryStore();
  store.upsert("user_known", createMockMemoryRecord("mem_uk", "content"));

  const result = store.get("user_known", "mem_unknown");

  assert.equal(result, null);
});

test("UserMemoryStore.get returns correct entry", () => {
  const store = new UserMemoryStore();
  const memory = createMockMemoryRecord("mem_utarget", "user target content");
  store.upsert("user_t", memory);

  const result = store.get("user_t", "mem_utarget");

  assert.notEqual(result, null);
  assert.equal(result?.userId, "user_t");
  assert.equal(result?.memory.id, "mem_utarget");
});

// =============================================================================
// Isolation Tests
// =============================================================================

test("ProjectMemoryStore entries are isolated from UserMemoryStore", () => {
  const projStore = new ProjectMemoryStore();
  const userStore = new UserMemoryStore();
  const memory = createMockMemoryRecord("mem_iso", "isolated");

  projStore.upsert("proj_iso", memory);
  userStore.upsert("user_iso", memory);

  const projResult = projStore.get("proj_iso", "mem_iso");
  const userResult = userStore.get("user_iso", "mem_iso");

  assert.notEqual(projResult, null);
  assert.notEqual(userResult, null);
  assert.equal(projResult?.projectId, "proj_iso");
  assert.equal(userResult?.userId, "user_iso");
});

test("ProjectMemoryStore does not leak to UserMemoryStore", () => {
  const projStore = new ProjectMemoryStore();
  const userStore = new UserMemoryStore();

  projStore.upsert("proj_leak", createMockMemoryRecord("mem_leak", "leak content"));

  assert.deepEqual(userStore.list("proj_leak"), []);
  assert.equal(userStore.get("proj_leak", "mem_leak"), null);
});

test("UserMemoryStore does not leak to ProjectMemoryStore", () => {
  const projStore = new ProjectMemoryStore();
  const userStore = new UserMemoryStore();

  userStore.upsert("user_leak", createMockMemoryRecord("mem_uleak", "uleak content"));

  assert.deepEqual(projStore.list("user_leak"), []);
  assert.equal(projStore.get("user_leak", "mem_uleak"), null);
});

// =============================================================================
// Edge Cases
// =============================================================================

test("ProjectMemoryStore handles same memory id across different projects", () => {
  const store = new ProjectMemoryStore();
  const memory1 = createMockMemoryRecord("mem_shared", "proj1 content");
  const memory2 = createMockMemoryRecord("mem_shared", "proj2 content");

  store.upsert("project_1", memory1);
  store.upsert("project_2", memory2);

  const entry1 = store.get("project_1", "mem_shared");
  const entry2 = store.get("project_2", "mem_shared");

  assert.notEqual(entry1, null);
  assert.notEqual(entry2, null);
  assert.equal(entry1?.memory.contentJson, "proj1 content");
  assert.equal(entry2?.memory.contentJson, "proj2 content");
});

test("UserMemoryStore handles same memory id across different users", () => {
  const store = new UserMemoryStore();
  const memory1 = createMockMemoryRecord("mem_ushared", "user1 content");
  const memory2 = createMockMemoryRecord("mem_ushared", "user2 content");

  store.upsert("user_1", memory1);
  store.upsert("user_2", memory2);

  const entry1 = store.get("user_1", "mem_ushared");
  const entry2 = store.get("user_2", "mem_ushared");

  assert.notEqual(entry1, null);
  assert.notEqual(entry2, null);
  assert.equal(entry1?.memory.contentJson, "user1 content");
  assert.equal(entry2?.memory.contentJson, "user2 content");
});

test("ProjectMemoryStore preserves memory record fields", () => {
  const store = new ProjectMemoryStore();
  const memory = createMockMemoryRecord("mem_fields", "json content");
  memory.qualityScore = 0.95;
  memory.hitCount = 42;
  memory.scope = "agent";

  store.upsert("proj_fields", memory);
  const entry = store.get("proj_fields", "mem_fields");

  assert.notEqual(entry, null);
  assert.equal(entry?.memory.qualityScore, 0.95);
  assert.equal(entry?.memory.hitCount, 42);
  assert.equal(entry?.memory.scope, "agent");
});

test("UserMemoryStore preserves memory record fields", () => {
  const store = new UserMemoryStore();
  const memory = createMockMemoryRecord("mem_ufields", "json content");
  memory.qualityScore = 0.88;
  memory.hitCount = 100;

  store.upsert("user_fields", memory);
  const entry = store.get("user_fields", "mem_ufields");

  assert.notEqual(entry, null);
  assert.equal(entry?.memory.qualityScore, 0.88);
  assert.equal(entry?.memory.hitCount, 100);
});

test("ProjectMemoryStore.list returns new array each call", () => {
  const store = new ProjectMemoryStore();
  store.upsert("proj_arr", createMockMemoryRecord("mem_arr", "content"));

  const list1 = store.list("proj_arr");
  const list2 = store.list("proj_arr");

  assert.deepEqual(list1, list2);
  list1.push({} as any);
  const list3 = store.list("proj_arr");
  assert.equal(list3.length, 1);
});

test("UserMemoryStore.list returns new array each call", () => {
  const store = new UserMemoryStore();
  store.upsert("user_arr", createMockMemoryRecord("mem_uarr", "content"));

  const list1 = store.list("user_arr");
  const list2 = store.list("user_arr");

  assert.deepEqual(list1, list2);
  list1.push({} as any);
  const list3 = store.list("user_arr");
  assert.equal(list3.length, 1);
});