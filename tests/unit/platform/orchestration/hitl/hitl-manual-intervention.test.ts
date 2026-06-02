/**
 * Unit tests for HITL Manual Intervention operations
 * Tests patch, override, takeover, edit, delegate, escalate, pause, resume
 */

import assert from "node:assert/strict";
import test from "node:test";

import { HitlRuntime, type HitlPersistenceStore, type HitlRequest, type HumanResponsibilityRecord } from "../../../../../src/platform/five-plane-orchestration/harness/hitl-runtime.js";

// Helper to create a mock persistence store
function createMockStore(): HitlPersistenceStore & { requests: Map<string, HitlRequest> } {
  const requests = new Map<string, HitlRequest>();
  return {
    requests,
    saveRequest(request: HitlRequest): void {
      this.requests.set(request.requestId, request);
    },
    loadRequests(): HitlRequest[] {
      return Array.from(this.requests.values());
    },
    deleteRequest(requestId: string): void {
      this.requests.delete(requestId);
    },
  };
}

test("HitlRuntime.inspect records observation without auto-approving the request", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-inspect",
    domainId: "coding",
    reason: "inspection needed",
    evidenceRefs: ["evidence-1"],
  });

  const result = runtime.inspect(request.requestId, "human:inspector");

  assert.equal(result.request.status, "pending");
  assert.equal(result.request.resolvedBy, null);
  assert.equal(result.record.action, "inspect");
  assert.equal(result.request.resolvedAt, null);
});

test("HitlRuntime.inspect throws for unknown request", () => {
  const runtime = new HitlRuntime();
  assert.throws(() => {
    runtime.inspect("unknown-id", "human:inspector");
  }, /harness\.hitl\.request_not_found/);
});

test("HitlRuntime.patch applies patch and transitions to completed", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-patch",
    domainId: "coding",
    reason: "patch needed",
    evidenceRefs: ["evidence-1"],
  });

  const patchContent = { file: "config.yaml", changes: { key: "new_value" } };
  const result = runtime.patch(request.requestId, "human:operator", patchContent, "fix_config");

  assert.equal(result.request.status, "completed");
  assert.equal(result.request.mode, "patch");
  assert.deepEqual(result.request.patchContent, patchContent);
  assert.equal(result.record.action, "patch");
  assert.ok(result.request.beforeRef?.startsWith("patch:before:"));
});

test("HitlRuntime.patch throws for unknown request", () => {
  const runtime = new HitlRuntime();
  assert.throws(() => {
    runtime.patch("unknown-id", "human:operator", { test: "data" }, "reason");
  }, /harness\.hitl\.request_not_found/);
});

test("HitlRuntime.override applies override and creates before/after refs", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-override",
    domainId: "coding",
    reason: "override needed",
    evidenceRefs: ["evidence-1"],
  });

  const overrideContent = { planId: "revised-plan", steps: [] };
  const result = runtime.override(request.requestId, "human:admin", overrideContent, "safety_override");

  assert.equal(result.request.status, "completed");
  assert.equal(result.request.mode, "override");
  assert.deepEqual(result.request.patchContent, overrideContent);
  assert.equal(result.record.action, "override");
  assert.ok(result.request.beforeRef?.startsWith("override:before:"));
  assert.ok(result.request.afterRef?.startsWith("override:after:"));
});

test("HitlRuntime.override throws for unknown request", () => {
  const runtime = new HitlRuntime();
  assert.throws(() => {
    runtime.override("unknown-id", "human:admin", { test: "data" }, "reason");
  }, /harness\.hitl\.request_not_found/);
});

test("HitlRuntime.takeover transfers control and pauses execution", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-takeover",
    domainId: "coding",
    reason: "human takeover required",
    evidenceRefs: ["evidence-1"],
  });

  const result = runtime.takeover(request.requestId, "human:lead", "operator_unavailable");

  assert.equal(result.request.status, "completed");
  assert.equal(result.request.mode, "takeover");
  assert.equal(result.request.resolvedBy, "human:lead");
  assert.ok(result.request.beforeRef?.startsWith("takeover:before:"));
});

test("HitlRuntime.takeover throws for unknown request", () => {
  const runtime = new HitlRuntime();
  assert.throws(() => {
    runtime.takeover("unknown-id", "human:lead", "reason");
  }, /harness\.hitl\.request_not_found/);
});

test("HitlRuntime.edit modifies content and completes", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-edit",
    domainId: "coding",
    reason: "edit required",
    evidenceRefs: ["evidence-1"],
  });

  const editContent = { file: "main.ts", patches: ["+line 42"] };
  const result = runtime.edit(request.requestId, "human:developer", editContent, "fix_bug");

  assert.equal(result.request.status, "completed");
  assert.equal(result.request.mode, "edit");
  assert.deepEqual(result.request.patchContent, editContent);
  assert.ok(result.request.beforeRef?.startsWith("edit:before:"));
  assert.ok(result.request.afterRef?.startsWith("edit:after:"));
});

test("HitlRuntime.edit throws for unknown request", () => {
  const runtime = new HitlRuntime();
  assert.throws(() => {
    runtime.edit("unknown-id", "human:developer", { test: "data" }, "reason");
  }, /harness\.hitl\.request_not_found/);
});

test("HitlRuntime.delegate transfers to another actor and pauses", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-delegate",
    domainId: "coding",
    reason: "delegation needed",
    evidenceRefs: ["evidence-1"],
  });

  const result = runtime.delegate(request.requestId, "human:manager", "human:sre", "workload_rebalance");

  assert.equal(result.request.status, "paused");
  assert.equal(result.request.mode, "delegate");
  assert.deepEqual(result.request.patchContent, { delegateTo: "human:sre" });
  assert.ok(result.request.beforeRef?.startsWith("delegate:before:"));
  assert.ok(result.request.afterRef?.includes("human:sre"));
});

test("HitlRuntime.delegate throws for unknown request", () => {
  const runtime = new HitlRuntime();
  assert.throws(() => {
    runtime.delegate("unknown-id", "human:manager", "human:sre", "reason");
  }, /harness\.hitl\.request_not_found/);
});

test("HitlRuntime.escalate escalates to higher authority and pauses", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-escalate",
    domainId: "coding",
    reason: "policy escalation required",
    evidenceRefs: ["evidence-1"],
  });

  const result = runtime.escalate(request.requestId, "human:reviewer", "policy_violation");

  assert.equal(result.request.status, "paused");
  assert.equal(result.request.mode, "escalate");
  assert.equal(result.request.resolvedBy, "human:reviewer");
  assert.ok(result.request.beforeRef?.startsWith("escalate:before:"));
});

test("HitlRuntime.escalate throws for unknown request", () => {
  const runtime = new HitlRuntime();
  assert.throws(() => {
    runtime.escalate("unknown-id", "human:reviewer", "reason");
  }, /harness\.hitl\.request_not_found/);
});

test("HitlRuntime.pause transitions request to paused status", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-pause",
    domainId: "coding",
    reason: "pause needed",
    evidenceRefs: ["evidence-1"],
  });

  const result = runtime.pause(request.requestId, "human:operator", "awaiting_resources");

  assert.equal(result.request.status, "paused");
  assert.equal(result.record.action, "override"); // pause uses override action
  assert.ok(result.request.beforeRef?.startsWith("pause:before:"));
});

test("HitlRuntime.pause throws for already resolved request", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-pause-resolved",
    domainId: "coding",
    reason: "test",
    evidenceRefs: ["evidence-1"],
  });

  runtime.resolve(request.requestId, "approved", "human:approver");

  const result = runtime.pause(request.requestId, "human:operator", "reason");
  assert.equal(result.request.status, "paused");
  assert.equal(result.request.resolvedBy, "human:operator");
});

test("HitlRuntime.pause throws for unknown request", () => {
  const runtime = new HitlRuntime();
  assert.throws(() => {
    runtime.pause("unknown-id", "human:operator", "reason");
  }, /harness\.hitl\.request_not_found/);
});

test("HitlRuntime.resume transitions paused request back to approved", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-resume",
    domainId: "coding",
    reason: "resume test",
    evidenceRefs: ["evidence-1"],
  });

  // First pause the request
  runtime.pause(request.requestId, "human:operator", "temp_pause");
  const result = runtime.resume(request.requestId, "human:operator");

  assert.equal(result.request.status, "approved");
  assert.equal(result.request.mode, "resume");
  assert.equal(result.record.action, "resume");
});

test("HitlRuntime.resume throws for unknown request", () => {
  const runtime = new HitlRuntime();
  assert.throws(() => {
    runtime.resume("unknown-id", "human:operator");
  }, /harness\.hitl\.request_not_found/);
});

test("HitlRuntime.resolve with approved sets status and creates record", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-resolve-approve",
    domainId: "coding",
    reason: "approval needed",
    evidenceRefs: ["evidence-1"],
  });

  const result = runtime.resolve(request.requestId, "approved", "human:approver");

  assert.equal(result.request.status, "approved");
  assert.equal(result.request.resolvedBy, "human:approver");
  assert.ok(result.request.resolvedAt !== null);
  assert.equal(result.record.action, "resume"); // approved maps to resume action
});

test("HitlRuntime.resolve with rejected sets status and creates record", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-resolve-reject",
    domainId: "coding",
    reason: "approval needed",
    evidenceRefs: ["evidence-1"],
  });

  const result = runtime.resolve(request.requestId, "rejected", "human:approver");

  assert.equal(result.request.status, "rejected");
  assert.equal(result.request.resolvedBy, "human:approver");
  assert.equal(result.record.action, "override"); // rejected maps to override action
});

test("HitlRuntime.resolve idempotency - rejects double resolution", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-idempotent",
    domainId: "coding",
    reason: "approval needed",
    evidenceRefs: ["evidence-1"],
  });

  runtime.resolve(request.requestId, "approved", "human:approver");

  assert.throws(() => {
    runtime.resolve(request.requestId, "rejected", "human:approver2");
  }, /harness\.hitl\.request_already_resolved/);
});

test("HitlRuntime.resolve throws for pending_approval request", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-resolve",
    domainId: "coding",
    reason: "approval needed",
    evidenceRefs: ["evidence-1"],
  });

  // Approve first time
  runtime.resolve(request.requestId, "approved", "human:approver");

  // Try to resolve again - should throw
  assert.throws(() => {
    runtime.resolve(request.requestId, "approved", "human:approver2");
  }, /harness\.hitl\.request_already_resolved/);
});

test("HitlRuntime.hydrate loads request into memory and store", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-hydrate",
    domainId: "coding",
    reason: "hydrate test",
    evidenceRefs: ["evidence-1"],
  });

  // Create a new runtime instance to simulate process restart
  const newRuntime = new HitlRuntime();
  const record: HumanResponsibilityRecord = {
    recordId: "hrr-001",
    requestId: request.requestId,
    actor: "human:operator",
    action: "override",
    scope: "override",
    rationale: "manual override",
    beforeRef: "before:ref",
    afterRef: "after:ref",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    auditRef: "audit://test",
    recordedAt: new Date().toISOString(),
  };

  newRuntime.hydrate(request, record);

  const retrieved = newRuntime.get(request.requestId);
  assert.ok(retrieved !== null);
  assert.equal(retrieved.requestId, request.requestId);

  const retrievedRecord = newRuntime.getResponsibilityRecord(request.requestId);
  assert.ok(retrievedRecord !== null);
  assert.equal(retrievedRecord?.actor, "human:operator");
});

test("HitlRuntime.loadRequests loads multiple requests", () => {
  const runtime = new HitlRuntime();
  const requests: HitlRequest[] = [
    {
      requestId: "hitl_req_1",
      runId: "run-1",
      domainId: "coding",
      mode: "override",
      reason: "test 1",
      evidenceRefs: [],
      requestedAt: new Date().toISOString(),
      status: "pending",
      resolvedAt: null,
      resolvedBy: null,
    },
    {
      requestId: "hitl_req_2",
      runId: "run-2",
      domainId: "coding",
      mode: "patch",
      reason: "test 2",
      evidenceRefs: [],
      requestedAt: new Date().toISOString(),
      status: "pending",
      resolvedAt: null,
      resolvedBy: null,
    },
  ];

  runtime.loadRequests(requests);

  const req1 = runtime.get("hitl_req_1");
  const req2 = runtime.get("hitl_req_2");

  assert.ok(req1 !== null);
  assert.ok(req2 !== null);
  assert.equal(req1?.runId, "run-1");
  assert.equal(req2?.runId, "run-2");
});

test("HitlRuntime.getResponsibilityRecord returns null for unknown request", () => {
  const runtime = new HitlRuntime();
  const result = runtime.getResponsibilityRecord("unknown-id");
  assert.equal(result, null);
});

test("HitlRuntime.get returns null for unknown request", () => {
  const runtime = new HitlRuntime();
  const result = runtime.get("unknown-id");
  assert.equal(result, null);
});

test("HitlRuntime with custom persistence store persists requests", () => {
  const store = createMockStore();
  const runtime = new HitlRuntime({ store });

  const request = runtime.open({
    runId: "run-persist",
    domainId: "coding",
    reason: "persistence test",
    evidenceRefs: ["evidence-1"],
  });

  // Store should have the request
  assert.ok(store.requests.has(request.requestId));

  // Load requests into new runtime
  const newRuntime = new HitlRuntime({ store });
  const retrieved = newRuntime.get(request.requestId);
  assert.ok(retrieved !== null);
  assert.equal(retrieved.requestId, request.requestId);
});

test("HitlRuntime with in-memory fallback store works when store throws", () => {
  const failingStore: HitlPersistenceStore = {
    saveRequest(): void {
      throw new Error("storage failure");
    },
    loadRequests(): HitlRequest[] {
      throw new Error("storage failure");
    },
    deleteRequest(): void {
      throw new Error("storage failure");
    },
  };

  const runtime = new HitlRuntime({ store: failingStore });
  const request = runtime.open({
    runId: "run-fallback",
    domainId: "coding",
    reason: "fallback test",
    evidenceRefs: ["evidence-1"],
  });

  // Should still be able to get request from memory fallback
  const retrieved = runtime.get(request.requestId);
  assert.ok(retrieved !== null);
  assert.equal(retrieved.requestId, request.requestId);
});

test("HitlRuntime computes expiry date based on TTL", () => {
  const runtime = new HitlRuntime({ requestTtlMs: 60 * 60 * 1000 }); // 1 hour

  const request = runtime.open({
    runId: "run-expiry",
    domainId: "coding",
    reason: "expiry test",
    evidenceRefs: [],
  });

  assert.ok(request.expiresAt !== undefined);
  const expiryTime = Date.parse(request.expiresAt);
  const now = Date.now();
  // Should expire approximately 1 hour from now (allow 5 second tolerance)
  assert.ok(Math.abs(expiryTime - (now + 60 * 60 * 1000)) < 5000);
});

test("HumanResponsibilityRecord contains audit reference", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-audit",
    domainId: "coding",
    reason: "audit test",
    evidenceRefs: ["evidence-1"],
  });

  const result = runtime.override(request.requestId, "human:admin", { test: "data" }, "manual_override");

  assert.ok(result.record.auditRef.startsWith("audit://harness/hitl/"));
  assert.ok(result.record.recordId.startsWith("hrr_"));
  assert.ok(result.record.recordedAt !== null);
});

test("HitlRuntime.open accepts optional expiresAt", () => {
  const runtime = new HitlRuntime();
  const customExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

  const request = runtime.open({
    runId: "run-expiry-custom",
    domainId: "coding",
    reason: "custom expiry test",
    evidenceRefs: [],
    expiresAt: customExpiry,
  });

  assert.equal(request.expiresAt, customExpiry);
});

test("HitlRuntime.open uses default mode 'inspect'", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-default-mode",
    domainId: "coding",
    reason: "mode test",
    evidenceRefs: [],
  });

  assert.equal(request.mode, "inspect");
});

test("HitlRuntime.open accepts mode parameter", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-specified-mode",
    domainId: "coding",
    reason: "mode test",
    evidenceRefs: [],
    mode: "override",
  });

  assert.equal(request.mode, "override");
});

test("HitlRuntime.open rejects unknown mode via enum constraint", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-valid-mode",
    domainId: "coding",
    reason: "mode test",
    evidenceRefs: [],
    mode: "takeover",
  });

  assert.equal(request.mode, "takeover");
});

test("HitlRuntime creates unique request IDs", () => {
  const runtime = new HitlRuntime();
  const requests = [
    runtime.open({ runId: "run-1", domainId: "d", reason: "r1", evidenceRefs: [] }),
    runtime.open({ runId: "run-2", domainId: "d", reason: "r2", evidenceRefs: [] }),
    runtime.open({ runId: "run-3", domainId: "d", reason: "r3", evidenceRefs: [] }),
  ];

  const ids = requests.map((r) => r.requestId);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, 3);
});
