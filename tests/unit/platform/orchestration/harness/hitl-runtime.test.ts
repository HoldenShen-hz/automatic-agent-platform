import assert from "node:assert/strict";
import test from "node:test";

import {
  HitlRuntime,
  InMemoryHitlStore,
  type HitlPersistenceStore,
  type HitlRequest,
} from "../../../../../src/platform/five-plane-orchestration/harness/hitl-runtime.js";

class SeedStore implements HitlPersistenceStore {
  public constructor(private readonly requests: HitlRequest[]) {}

  public saveRequest(request: HitlRequest): void {
    this.requests = [...this.requests.filter((item) => item.requestId !== request.requestId), request];
  }

  public loadRequests(): HitlRequest[] {
    return [...this.requests];
  }

  public deleteRequest(requestId: string): void {
    this.requests = this.requests.filter((item) => item.requestId !== requestId);
  }
}

test("HitlRuntime.open creates a pending request with expiry metadata", () => {
  const runtime = new HitlRuntime({ store: new InMemoryHitlStore() });
  const request = runtime.open({
    runId: "run-1",
    domainId: "domain-a",
    reason: "needs approval",
    evidenceRefs: ["evidence-1", "evidence-2"],
  });

  assert.ok(request.requestId.startsWith("hitl_request_"));
  assert.equal(request.status, "pending");
  assert.equal(request.resolvedAt, null);
  assert.equal(request.resolvedBy, null);
  assert.deepEqual(request.evidenceRefs, ["evidence-1", "evidence-2"]);
  assert.ok(typeof request.expiresAt === "string");
});

test("HitlRuntime.resolve returns request and responsibility record", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-1",
    domainId: "domain-a",
    reason: "test",
    evidenceRefs: [],
  });

  const resolved = runtime.resolve(request.requestId, "approved", "operator-1");

  assert.equal(resolved.request.status, "approved");
  assert.equal(resolved.request.resolvedBy, "operator-1");
  assert.equal(resolved.record.actor, "operator-1");
  assert.equal(resolved.record.action, "resume");
  assert.equal(runtime.getResponsibilityRecord(request.requestId)?.recordId, resolved.record.recordId);
});

test("HitlRuntime.resolve rejects already resolved requests", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-1",
    domainId: "domain-a",
    reason: "test",
    evidenceRefs: [],
  });

  runtime.resolve(request.requestId, "approved", "operator-1");

  assert.throws(
    () => runtime.resolve(request.requestId, "approved", "operator-2"),
    /harness\.hitl\.request_already_resolved/,
  );
});

test("HitlRuntime.pause and resume transition request status through current states", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-2",
    domainId: "domain-b",
    reason: "manual intervention",
    evidenceRefs: [],
  });

  const paused = runtime.pause(request.requestId, "operator-1", "hold execution");
  const resumed = runtime.resume(request.requestId, "operator-2");

  assert.equal(paused.request.status, "paused");
  assert.equal(resumed.request.status, "approved");
  assert.equal(resumed.request.mode, "resume");
  assert.equal(resumed.record.actor, "operator-2");
});

test("HitlRuntime auto-expires pending requests on read", () => {
  const expiredRequest: HitlRequest = {
    requestId: "hitl_request_expired",
    runId: "run-expired",
    domainId: "domain-expired",
    mode: "inspect",
    reason: "expired",
    evidenceRefs: [],
    requestedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T00:00:01.000Z",
    status: "pending",
    resolvedAt: null,
    resolvedBy: null,
  };
  const runtime = new HitlRuntime({
    store: new SeedStore([expiredRequest]),
  });

  const loaded = runtime.get(expiredRequest.requestId);

  assert.equal(loaded?.status, "rejected");
  assert.equal(loaded?.resolvedBy, "system:hitl_timeout");
  assert.equal(runtime.getResponsibilityRecord(expiredRequest.requestId)?.actor, "system:hitl_timeout");
});
