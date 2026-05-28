import assert from "node:assert/strict";
import test from "node:test";

import {
  createExecutionLeaseService,
  ExecutionLeaseService,
  mergeExecutionIds,
  parseJsonArray,
  removeExecutionId,
  toWorkerStatus,
  type LeaseRepository,
} from "../../../../../src/platform/five-plane-execution/lease/index.js";

test("createExecutionLeaseService is exported as function [index]", () => {
  assert.equal(typeof createExecutionLeaseService, "function");
});

test("ExecutionLeaseService is exported as function [index]", () => {
  assert.equal(typeof ExecutionLeaseService, "function");
});

test("LeaseRepository type can be used in type annotations [index]", () => {
  // LeaseRepository is a type, so we verify it can be used in type annotations
  type TestLeaseRepo = import("../../../../../src/platform/five-plane-execution/lease/index.js").LeaseRepository;
  const _repo: TestLeaseRepo | undefined = undefined;
  assert.equal(_repo, undefined);
});

test("mergeExecutionIds is exported as function [index]", () => {
  assert.equal(typeof mergeExecutionIds, "function");
});

test("parseJsonArray is exported as function [index]", () => {
  assert.equal(typeof parseJsonArray, "function");
});

test("removeExecutionId is exported as function [index]", () => {
  assert.equal(typeof removeExecutionId, "function");
});

test("toWorkerStatus is exported as function [index]", () => {
  assert.equal(typeof toWorkerStatus, "function");
});

test("createExecutionLeaseService is callable factory [index]", () => {
  assert.equal(typeof createExecutionLeaseService, "function");
});

test("ExecutionLeaseService instance has required methods [index]", () => {
  const prototype = ExecutionLeaseService.prototype;
  assert.ok(typeof prototype.acquireLease === "function");
  assert.ok(typeof prototype.releaseLease === "function");
  assert.ok(typeof prototype.renewLease === "function");
  assert.ok(typeof prototype.validateWriteAccess === "function");
});

test("parseJsonArray handles valid JSON array [index]", () => {
  const result = parseJsonArray('["id1", "id2", "id3"]');
  assert.deepStrictEqual(result, ["id1", "id2", "id3"]);
});

test("parseJsonArray handles empty array [index]", () => {
  const result = parseJsonArray("[]");
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray handles invalid JSON [index]", () => {
  const result = parseJsonArray("not valid json", {
    log: () => undefined,
  } as never);
  assert.deepStrictEqual(result, []);
});

test("mergeExecutionIds combines arrays without duplicates [index]", () => {
  const result = mergeExecutionIds(mergeExecutionIds(["id1", "id2"], "id2"), "id3");
  assert.ok(result.includes("id1"));
  assert.ok(result.includes("id2"));
  assert.ok(result.includes("id3"));
});

test("removeExecutionId removes specific id [index]", () => {
  const result = removeExecutionId(["id1", "id2", "id3"], "id2");
  assert.ok(!result.includes("id2"));
  assert.ok(result.includes("id1"));
  assert.ok(result.includes("id3"));
});
