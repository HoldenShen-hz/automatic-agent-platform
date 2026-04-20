import assert from "node:assert/strict";
import test from "node:test";

import { UserMemoryStore, type UserMemoryEntry } from "../../../../../src/platform/state-evidence/memory/user-memory-store.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createMockMemoryRecord(id: string, contentJson: string): MemoryRecord {
  return {
    id,
    taskId: null,
    sessionId: null,
    agentId: null,
    executionId: null,
    memoryLayer: "layer_3",
    scope: "user",
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

test("UserMemoryStore type exports are correct", () => {
  const store = new UserMemoryStore();
  assert.ok(store !== undefined);
});

test("UserMemoryStore.upsert creates a new entry", () => {
  const store = new UserMemoryStore();
  const memory = createMockMemoryRecord("mem_1", "test content");

  const entry = store.upsert("user_1", memory);

  assert.equal(entry.userId, "user_1");
  assert.equal(entry.memory.id, "mem_1");
  assert.equal(entry.promotedAt.length > 0, true);
});

test("UserMemoryStore.upsert updates existing entry with same memory id", () => {
  const store = new UserMemoryStore();
  const memory1 = createMockMemoryRecord("mem_same", "original content");
  const memory2 = createMockMemoryRecord("mem_same", "updated content");

  store.upsert("user_1", memory1);
  const updated = store.upsert("user_1", memory2);

  // Should return the new entry
  assert.equal(updated.memory.contentJson, "updated content");
  // List should have only one entry
  const list = store.list("user_1");
  assert.equal(list.length, 1);
  const firstEntry = list[0];
  assert.ok(firstEntry !== undefined);
  assert.equal(firstEntry.memory.contentJson, "updated content");
});

test("UserMemoryStore.list returns empty array for unknown user", () => {
  const store = new UserMemoryStore();

  const result = store.list("nonexistent_user");

  assert.deepEqual(result, []);
});

test("UserMemoryStore.list returns all entries for a user", () => {
  const store = new UserMemoryStore();
  const memory1 = createMockMemoryRecord("mem_1", "content 1");
  const memory2 = createMockMemoryRecord("mem_2", "content 2");

  store.upsert("user_list", memory1);
  store.upsert("user_list", memory2);

  const result = store.list("user_list");

  assert.equal(result.length, 2);
});

test("UserMemoryStore.get returns null for unknown user", () => {
  const store = new UserMemoryStore();

  const result = store.get("nonexistent_user", "mem_1");

  assert.equal(result, null);
});

test("UserMemoryStore.get returns null for unknown memoryId", () => {
  const store = new UserMemoryStore();
  const memory = createMockMemoryRecord("mem_known", "content");

  store.upsert("user_get", memory);

  const result = store.get("user_get", "mem_unknown");

  assert.equal(result, null);
});

test("UserMemoryStore.get returns correct entry", () => {
  const store = new UserMemoryStore();
  const memory = createMockMemoryRecord("mem_target", "target content");

  store.upsert("user_target", memory);
  const result = store.get("user_target", "mem_target");

  assert.ok(result !== null);
  assert.equal(result?.userId, "user_target");
  assert.equal(result?.memory.id, "mem_target");
  assert.equal(result?.memory.contentJson, "target content");
});

test("UserMemoryStore.upsert uses provided promotedAt timestamp", () => {
  const store = new UserMemoryStore();
  const memory = createMockMemoryRecord("mem_ts", "content");
  const customTimestamp = "2024-01-15T10:30:00.000Z";

  const entry = store.upsert("user_ts", memory, customTimestamp);

  assert.equal(entry.promotedAt, customTimestamp);
});

test("UserMemoryStore.upsert defaults promotedAt to current time", () => {
  const store = new UserMemoryStore();
  const memory = createMockMemoryRecord("mem_default", "content");
  const before = new Date().toISOString();

  const entry = store.upsert("user_default", memory);

  const after = new Date().toISOString();
  assert.ok(entry.promotedAt >= before && entry.promotedAt <= after);
});

test("UserMemoryStore.list returns separate entries per user", () => {
  const store = new UserMemoryStore();
  const memory1 = createMockMemoryRecord("mem_user1", "user1 content");
  const memory2 = createMockMemoryRecord("mem_user2", "user2 content");

  store.upsert("user_a", memory1);
  store.upsert("user_b", memory2);

  const userAList = store.list("user_a");
  const userBList = store.list("user_b");

  assert.equal(userAList.length, 1);
  const firstUserA = userAList[0];
  assert.ok(firstUserA !== undefined);
  assert.equal(firstUserA.memory.contentJson, "user1 content");
  assert.equal(userBList.length, 1);
  const firstUserB = userBList[0];
  assert.ok(firstUserB !== undefined);
  assert.equal(firstUserB.memory.contentJson, "user2 content");
});
