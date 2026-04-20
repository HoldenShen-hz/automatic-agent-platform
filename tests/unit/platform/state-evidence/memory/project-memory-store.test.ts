import assert from "node:assert/strict";
import test from "node:test";

import { ProjectMemoryStore, type ProjectMemoryEntry } from "../../../../../src/platform/state-evidence/memory/project-memory-store.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createMockMemoryRecord(id: string, contentJson: string): MemoryRecord {
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

test("ProjectMemoryStore type exports are correct", () => {
  const store = new ProjectMemoryStore();
  assert.ok(store !== undefined);
});

test("ProjectMemoryStore.upsert creates a new entry", () => {
  const store = new ProjectMemoryStore();
  const memory = createMockMemoryRecord("mem_1", "test content");

  const entry = store.upsert("proj_1", memory);

  assert.equal(entry.projectId, "proj_1");
  assert.equal(entry.memory.id, "mem_1");
  assert.equal(entry.promotedAt.length > 0, true);
});

test("ProjectMemoryStore.upsert updates existing entry with same memory id", () => {
  const store = new ProjectMemoryStore();
  const memory1 = createMockMemoryRecord("mem_same", "original content");
  const memory2 = createMockMemoryRecord("mem_same", "updated content");

  store.upsert("proj_1", memory1);
  const updated = store.upsert("proj_1", memory2);

  // Should return the new entry
  assert.equal(updated.memory.contentJson, "updated content");
  // List should have only one entry
  const list = store.list("proj_1");
  assert.equal(list.length, 1);
  const firstEntry = list[0];
  assert.ok(firstEntry !== undefined);
  assert.equal(firstEntry.memory.contentJson, "updated content");
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

  assert.ok(result !== null);
  assert.equal(result?.projectId, "proj_target");
  assert.equal(result?.memory.id, "mem_target");
  assert.equal(result?.memory.contentJson, "target content");
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

test("ProjectMemoryStore.list returns separate entries per project", () => {
  const store = new ProjectMemoryStore();
  const memory1 = createMockMemoryRecord("mem_proj1", "proj1 content");
  const memory2 = createMockMemoryRecord("mem_proj2", "proj2 content");

  store.upsert("project_a", memory1);
  store.upsert("project_b", memory2);

  const projAList = store.list("project_a");
  const projBList = store.list("project_b");

  assert.equal(projAList.length, 1);
  const firstProjA = projAList[0];
  assert.ok(firstProjA !== undefined);
  assert.equal(firstProjA.memory.contentJson, "proj1 content");
  assert.equal(projBList.length, 1);
  const firstProjB = projBList[0];
  assert.ok(firstProjB !== undefined);
  assert.equal(firstProjB.memory.contentJson, "proj2 content");
});
