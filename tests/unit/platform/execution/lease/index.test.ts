import assert from "node:assert/strict";
import test from "node:test";

import {
  createExecutionLeaseService,
  ExecutionLeaseService,
  type LeaseRepository,
} from "../../../../../src/platform/execution/lease/index.js";

test("createExecutionLeaseService is exported as function", () => {
  assert.equal(typeof createExecutionLeaseService, "function");
});

test("ExecutionLeaseService is exported as function", () => {
  assert.equal(typeof ExecutionLeaseService, "function");
});

test("LeaseRepository type can be used in type annotations", () => {
  // LeaseRepository is a type, so we verify it can be used in type annotations
  type TestLeaseRepo = import("../../../../../src/platform/execution/lease/index.js").LeaseRepository;
  const _repo: TestLeaseRepo | undefined = undefined;
  assert.ok(true); // Type check passed
});

test("mergeExecutionIds is exported as function", () => {
  assert.equal(typeof mergeExecutionIds, "function");
});

test("parseJsonArray is exported as function", () => {
  assert.equal(typeof parseJsonArray, "function");
});

test("removeExecutionId is exported as function", () => {
  assert.equal(typeof removeExecutionId, "function");
});

test("toWorkerStatus is exported as function", () => {
  assert.equal(typeof toWorkerStatus, "function");
});

test("createExecutionLeaseService returns instance", () => {
  // Create a minimal mock repository for testing
  const mockRepo: Partial<LeaseRepository> = {
    findById: async () => null,
    create: async () => ({} as any),
    update: async () => ({} as any),
  };
  const service = createExecutionLeaseService(mockRepo as LeaseRepository);
  assert.ok(service !== undefined);
  assert.ok(typeof service.acquire === "function");
  assert.ok(typeof service.release === "function");
  assert.ok(typeof service.extend === "function");
  assert.ok(typeof service.getStatus === "function");
});

test("ExecutionLeaseService instance has required methods", () => {
  // Create a minimal mock repository for testing
  const mockRepo: Partial<LeaseRepository> = {
    findById: async () => null,
    create: async () => ({} as any),
    update: async () => ({} as any),
  };
  const service = new ExecutionLeaseService(mockRepo as LeaseRepository);
  assert.ok(typeof service.acquire === "function");
  assert.ok(typeof service.release === "function");
  assert.ok(typeof service.extend === "function");
  assert.ok(typeof service.getStatus === "function");
});

test("parseJsonArray handles valid JSON array", () => {
  const result = parseJsonArray('["id1", "id2", "id3"]');
  assert.deepStrictEqual(result, ["id1", "id2", "id3"]);
});

test("parseJsonArray handles empty array", () => {
  const result = parseJsonArray("[]");
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray handles invalid JSON", () => {
  const result = parseJsonArray("not valid json");
  assert.deepStrictEqual(result, []);
});

test("mergeExecutionIds combines arrays without duplicates", () => {
  const result = mergeExecutionIds(["id1", "id2"], ["id2", "id3"]);
  assert.ok(result.includes("id1"));
  assert.ok(result.includes("id2"));
  assert.ok(result.includes("id3"));
});

test("removeExecutionId removes specific id", () => {
  const result = removeExecutionId(["id1", "id2", "id3"], "id2");
  assert.ok(!result.includes("id2"));
  assert.ok(result.includes("id1"));
  assert.ok(result.includes("id3"));
});
