import assert from "node:assert/strict";
import test from "node:test";

import { ProjectMemoryStore, type ProjectMemoryEntry } from "../../../../../src/platform/state-evidence/memory/project-memory-store.js";
import { UserMemoryStore, type UserMemoryEntry } from "../../../../../src/platform/state-evidence/memory/user-memory-store.js";
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

test("ProjectMemoryStore.upsert creates a new entry with correct fields", () => {
  const store = new ProjectMemoryStore();
  const memory = createMockMemoryRecord("mem_1", "test content");

  const entry = store.upsert("proj_1", memory);

  assert.equal(entry.projectId, "proj_1");
  assert.equal(entry.memory.id, "mem_1");
  assert.equal(entry.memory.contentJson, "test content");
  assert.ok(entry.promotedAt.length > 0);
});

test("ProjectMemoryStore.upsert uses provided promotedAt timestamp", () => {
  const store = new ProjectMemoryStore();
  const memory = createMockMemoryRecord("mem_ts", "content");
  const customTimestamp = "2024-01-15T10:30:00.000Z";

  const entry = store.upsert("proj_ts", memory, customTimestamp);

  assert.equal(entry.promotedAt, customTimestamp);
});

test("ProjectMemoryStore.upsert defaults promotedAt to current time", () => {
  const store = new ProjectMemoryStore();
  const memory = createMockMemoryRecord("mem_default", "content");
  const before = new Date().toISOString();

  const entry = store.upsert("proj_default", memory);

  const after = new Date().toISOString();
  assert.ok(entry.promotedAt >= before && entry.promotedAt <= after);
});

test("ProjectMemoryStore.upsert updates existing entry with same memory id", () => {
  const store = new ProjectMemoryStore();
  const memory1 = createMockMemoryRecord("mem_same", "original content");
  const memory2 = createMockMemoryRecord("mem_same", "updated content");

  store.upsert("proj_1", memory1);
  const updated = store.upsert("proj_1", memory2);

  assert.equal(updated.memory.contentJson, "updated content");
  const list = store.list("proj_1");
  assert.equal(list.length, 1);
  assert.equal(list[0].memory.contentJson, "updated content");
});

test("ProjectMemoryStore.list returns empty array for unknown project", () => {
  const store = new ProjectMemoryStore();

  const result = store.list("nonexistent_project");

  assert.deepEqual(result, []);
});

test("ProjectMemoryStore.list returns all entries for a project", () => {
  const store = new ProjectMemoryStore();
  const memory1 = createMockMemoryRecord("mem_1", "content 1");
  const memory2 = createMockMemoryRecord("mem_2", "content 2");

  store.upsert("proj_list", memory1);
  store.upsert("proj_list", memory2);

  const result = store.list("proj_list");

  assert.equal(result.length, 2);
});

test("ProjectMemoryStore.list returns separate entries per project", () => {
  const store = new ProjectMemoryStore();
  const memory1 = createMockMemoryRecord("mem_proj1", "proj1 content");
  const memory2 = createMockMemoryRecord("mem_proj2", "proj2 content");

  store.upsert("project_a", memory1);
  store.upsert("project_b", memory2);

  const projAList = store.list("project_a");
  const projBList = store.list("project_b");

  assert.equal(projAList.length, 1);
  assert.equal(projAList[0].memory.contentJson, "proj1 content");
  assert.equal(projBList.length, 1);
  assert.equal(projBList[0].memory.contentJson, "proj2 content");
});

test("ProjectMemoryStore.get returns null for unknown project", () => {
  const store = new ProjectMemoryStore();

  const result = store.get("nonexistent_project", "mem_1");

  assert.equal(result, null);
});

test("ProjectMemoryStore.get returns null for unknown memoryId", () => {
  const store = new ProjectMemoryStore();
  const memory = createMockMemoryRecord("mem_known", "content");

  store.upsert("proj_get", memory);

  const result = store.get("proj_get", "mem_unknown");

  assert.equal(result, null);
});

test("ProjectMemoryStore.get returns correct entry", () => {
  const store = new ProjectMemoryStore();
  const memory = createMockMemoryRecord("mem_target", "target content");

  store.upsert("proj_target", memory);
  const result = store.get("proj_target", "mem_target");

  assert.notEqual(result, null);
  assert.equal(result?.projectId, "proj_target");
  assert.equal(result?.memory.id, "mem_target");
  assert.equal(result?.memory.contentJson, "target content");
});

test("ProjectMemoryStore.upsert stores full memory record", () => {
  const store = new ProjectMemoryStore();
  const memory = createMockMemoryRecord("mem_full", '{"key":"value"}');
  memory.qualityScore = 0.95;
  memory.hitCount = 42;

  store.upsert("proj_full", memory);
  const result = store.get("proj_full", "mem_full");

  assert.notEqual(result, null);
  assert.equal(result?.memory.qualityScore, 0.95);
  assert.equal(result?.memory.hitCount, 42);
});

// =============================================================================
// UserMemoryStore Tests
// =============================================================================

test("UserMemoryStore.upsert creates a new entry with correct fields", () => {
  const store = new UserMemoryStore();
  const memory = createMockMemoryRecord("mem_u1", "user memory content");

  const entry = store.upsert("user_1", memory);

  assert.equal(entry.userId, "user_1");
  assert.equal(entry.memory.id, "mem_u1");
  assert.equal(entry.memory.contentJson, "user memory content");
  assert.ok(entry.promotedAt.length > 0);
});

test("UserMemoryStore.upsert uses provided promotedAt timestamp", () => {
  const store = new UserMemoryStore();
  const memory = createMockMemoryRecord("mem_uts", "content");
  const customTimestamp = "2024-02-20T15:45:00.000Z";

  const entry = store.upsert("user_ts", memory, customTimestamp);

  assert.equal(entry.promotedAt, customTimestamp);
});

test("UserMemoryStore.upsert defaults promotedAt to current time", () => {
  const store = new UserMemoryStore();
  const memory = createMockMemoryRecord("mem_udefault", "content");
  const before = new Date().toISOString();

  const entry = store.upsert("user_default", memory);

  const after = new Date().toISOString();
  assert.ok(entry.promotedAt >= before && entry.promotedAt <= after);
});

test("UserMemoryStore.upsert updates existing entry with same memory id", () => {
  const store = new UserMemoryStore();
  const memory1 = createMockMemoryRecord("mem_usame", "original user content");
  const memory2 = createMockMemoryRecord("mem_usame", "updated user content");

  store.upsert("user_1", memory1);
  const updated = store.upsert("user_1", memory2);

  assert.equal(updated.memory.contentJson, "updated user content");
  const list = store.list("user_1");
  assert.equal(list.length, 1);
  assert.equal(list[0].memory.contentJson, "updated user content");
});

test("UserMemoryStore.list returns empty array for unknown user", () => {
  const store = new UserMemoryStore();

  const result = store.list("nonexistent_user");

  assert.deepEqual(result, []);
});

test("UserMemoryStore.list returns all entries for a user", () => {
  const store = new UserMemoryStore();
  const memory1 = createMockMemoryRecord("mem_u1", "user content 1");
  const memory2 = createMockMemoryRecord("mem_u2", "user content 2");

  store.upsert("user_list", memory1);
  store.upsert("user_list", memory2);

  const result = store.list("user_list");

  assert.equal(result.length, 2);
});

test("UserMemoryStore.list returns separate entries per user", () => {
  const store = new UserMemoryStore();
  const memory1 = createMockMemoryRecord("mem_usera1", "userA content");
  const memory2 = createMockMemoryRecord("mem_userb1", "userB content");

  store.upsert("user_a", memory1);
  store.upsert("user_b", memory2);

  const userAList = store.list("user_a");
  const userBList = store.list("user_b");

  assert.equal(userAList.length, 1);
  assert.equal(userAList[0].memory.contentJson, "userA content");
  assert.equal(userBList.length, 1);
  assert.equal(userBList[0].memory.contentJson, "userB content");
});

test("UserMemoryStore.get returns null for unknown user", () => {
  const store = new UserMemoryStore();

  const result = store.get("nonexistent_user", "mem_1");

  assert.equal(result, null);
});

test("UserMemoryStore.get returns null for unknown memoryId", () => {
  const store = new UserMemoryStore();
  const memory = createMockMemoryRecord("mem_uknown", "content");

  store.upsert("user_get", memory);

  const result = store.get("user_get", "mem_unknown");

  assert.equal(result, null);
});

test("UserMemoryStore.get returns correct entry", () => {
  const store = new UserMemoryStore();
  const memory = createMockMemoryRecord("mem_utarget", "target user content");

  store.upsert("user_target", memory);
  const result = store.get("user_target", "mem_utarget");

  assert.notEqual(result, null);
  assert.equal(result?.userId, "user_target");
  assert.equal(result?.memory.id, "mem_utarget");
  assert.equal(result?.memory.contentJson, "target user content");
});

test("UserMemoryStore.upsert stores full memory record", () => {
  const store = new UserMemoryStore();
  const memory = createMockMemoryRecord("mem_ufull", '{"userKey":"userValue"}');
  memory.qualityScore = 0.88;
  memory.hitCount = 100;

  store.upsert("user_full", memory);
  const result = store.get("user_full", "mem_ufull");

  assert.notEqual(result, null);
  assert.equal(result?.memory.qualityScore, 0.88);
  assert.equal(result?.memory.hitCount, 100);
});

// =============================================================================
// Cross-Store Isolation Tests
// =============================================================================

test("ProjectMemoryStore and UserMemoryStore are isolated", () => {
  const projectStore = new ProjectMemoryStore();
  const userStore = new UserMemoryStore();
  const memory = createMockMemoryRecord("mem_iso", "isolated content");

  projectStore.upsert("proj_iso", memory);
  userStore.upsert("user_iso", memory);

  const projectResult = projectStore.get("proj_iso", "mem_iso");
  const userResult = userStore.get("user_iso", "mem_iso");

  assert.notEqual(projectResult, null);
  assert.notEqual(userResult, null);
  assert.equal(projectResult?.projectId, "proj_iso");
  assert.equal(userResult?.userId, "user_iso");
});

test("ProjectMemoryStore does not leak entries to UserMemoryStore", () => {
  const projectStore = new ProjectMemoryStore();
  const userStore = new UserMemoryStore();

  projectStore.upsert("proj_leak", createMockMemoryRecord("mem_leak", "leak content"));

  const userList = userStore.list("proj_leak");
  const userGet = userStore.get("proj_leak", "mem_leak");

  assert.deepEqual(userList, []);
  assert.equal(userGet, null);
});

test("UserMemoryStore does not leak entries to ProjectMemoryStore", () => {
  const projectStore = new ProjectMemoryStore();
  const userStore = new UserMemoryStore();

  userStore.upsert("user_leak", createMockMemoryRecord("mem_uleak", "uleak content"));

  const projectList = projectStore.list("user_leak");
  const projectGet = projectStore.get("user_leak", "mem_uleak");

  assert.deepEqual(projectList, []);
  assert.equal(projectGet, null);
});

// =============================================================================
// Edge Cases
// =============================================================================

test("ProjectMemoryStore handles multiple upserts with same id across different projects", () => {
  const store = new ProjectMemoryStore();
  const memory1 = createMockMemoryRecord("mem_shared", "project1 content");
  const memory2 = createMockMemoryRecord("mem_shared", "project2 content");

  store.upsert("project_1", memory1);
  store.upsert("project_2", memory2);

  const proj1Entry = store.get("project_1", "mem_shared");
  const proj2Entry = store.get("project_2", "mem_shared");

  assert.notEqual(proj1Entry, null);
  assert.notEqual(proj2Entry, null);
  assert.equal(proj1Entry?.memory.contentJson, "project1 content");
  assert.equal(proj2Entry?.memory.contentJson, "project2 content");
});

test("UserMemoryStore handles multiple upserts with same id across different users", () => {
  const store = new UserMemoryStore();
  const memory1 = createMockMemoryRecord("mem_ushared", "user1 content");
  const memory2 = createMockMemoryRecord("mem_ushared", "user2 content");

  store.upsert("user_1", memory1);
  store.upsert("user_2", memory2);

  const user1Entry = store.get("user_1", "mem_ushared");
  const user2Entry = store.get("user_2", "mem_ushared");

  assert.notEqual(user1Entry, null);
  assert.notEqual(user2Entry, null);
  assert.equal(user1Entry?.memory.contentJson, "user1 content");
  assert.equal(user2Entry?.memory.contentJson, "user2 content");
});

test("ProjectMemoryStore entry preserves original memory scope", () => {
  const store = new ProjectMemoryStore();
  const memory = createMockMemoryRecord("mem_scope", "scope content");
  memory.scope = "agent";

  store.upsert("proj_scope", memory);
  const entry = store.get("proj_scope", "mem_scope");

  assert.notEqual(entry, null);
  assert.equal(entry?.memory.scope, "agent");
});

test("UserMemoryStore entry preserves original memory scope", () => {
  const store = new UserMemoryStore();
  const memory = createMockMemoryRecord("mem_uscope", "uscope content");
  memory.scope = "project";

  store.upsert("user_scope", memory);
  const entry = store.get("user_scope", "mem_uscope");

  assert.notEqual(entry, null);
  assert.equal(entry?.memory.scope, "project");
});

test("ProjectMemoryStore.list returns new array each call", () => {
  const store = new ProjectMemoryStore();
  store.upsert("proj_array", createMockMemoryRecord("mem_array", "content"));

  const list1 = store.list("proj_array");
  const list2 = store.list("proj_array");

  assert.deepEqual(list1, list2);
  // Verify they are different array instances
  list1.push({} as ProjectMemoryEntry);
  const list3 = store.list("proj_array");
  assert.equal(list3.length, 1);
});

test("UserMemoryStore.list returns new array each call", () => {
  const store = new UserMemoryStore();
  store.upsert("user_array", createMockMemoryRecord("mem_uarray", "ucontent"));

  const list1 = store.list("user_array");
  const list2 = store.list("user_array");

  assert.deepEqual(list1, list2);
  // Verify they are different array instances
  list1.push({} as UserMemoryEntry);
  const list3 = store.list("user_array");
  assert.equal(list3.length, 1);
});
