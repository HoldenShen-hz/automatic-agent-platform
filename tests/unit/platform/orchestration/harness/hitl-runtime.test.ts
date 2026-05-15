import test from "node:test";
import assert from "node:assert/strict";
import { HitlRuntime } from "../../../../../src/platform/five-plane-orchestration/harness/hitl-runtime.js";

test("HitlRuntime.open creates pending request", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-1",
    domainId: "domain-a",
    reason: "needs approval",
    evidenceRefs: ["evidence-1", "evidence-2"],
  });

  assert.ok(request.requestId.startsWith("hitl_"));
  assert.equal(request.runId, "run-1");
  assert.equal(request.domainId, "domain-a");
  assert.equal(request.reason, "needs approval");
  assert.deepEqual(request.evidenceRefs, ["evidence-1", "evidence-2"]);
  assert.equal(request.status, "pending");
  assert.equal(request.resolvedAt, null);
  assert.equal(request.resolvedBy, null);
});

test("HitlRuntime.resolve approved sets status and resolution", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-1",
    domainId: "domain-a",
    reason: "test",
    evidenceRefs: [],
  });

  const resolved = runtime.resolve(request.requestId, "approved", "operator-1");

  assert.equal(resolved.status, "approved");
  assert.equal(resolved.resolvedBy, "operator-1");
  assert.ok(resolved.resolvedAt !== null);
});

test("HitlRuntime.resolve rejected sets status and resolution", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-1",
    domainId: "domain-a",
    reason: "test",
    evidenceRefs: [],
  });

  const resolved = runtime.resolve(request.requestId, "rejected", "operator-2");

  assert.equal(resolved.status, "rejected");
  assert.equal(resolved.resolvedBy, "operator-2");
});

test("HitlRuntime.resolve throws for unknown requestId", () => {
  const runtime = new HitlRuntime();
  assert.throws(() => {
    runtime.resolve("unknown-id", "approved", "operator-1");
  }, /harness\.hitl\.request_not_found/);
});

test("HitlRuntime.get retrieves existing request", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-1",
    domainId: "domain-a",
    reason: "test",
    evidenceRefs: [],
  });

  const retrieved = runtime.get(request.requestId);
  assert.ok(retrieved !== null);
  assert.equal(retrieved.requestId, request.requestId);
});

test("HitlRuntime.get returns null for unknown requestId", () => {
  const runtime = new HitlRuntime();
  const result = runtime.get("unknown-id");
  assert.equal(result, null);
});

test("HitlRuntime.open stores multiple requests", () => {
  const runtime = new HitlRuntime();
  const request1 = runtime.open({ runId: "run-1", domainId: "d1", reason: "r1", evidenceRefs: [] });
  const request2 = runtime.open({ runId: "run-2", domainId: "d2", reason: "r2", evidenceRefs: [] });

  assert.notEqual(request1.requestId, request2.requestId);
  assert.ok(runtime.get(request1.requestId) !== null);
  assert.ok(runtime.get(request2.requestId) !== null);
});

test("HitlRuntime.resolve updates existing request", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-1",
    domainId: "domain-a",
    reason: "test",
    evidenceRefs: ["e1"],
  });

  const resolved = runtime.resolve(request.requestId, "approved", "op-1");

  // Resolved request has new status but original fields preserved
  assert.equal(resolved.status, "approved");
  assert.equal(resolved.resolvedBy, "op-1");
  assert.equal(resolved.runId, "run-1");
  assert.equal(resolved.evidenceRefs.length, 1);
});