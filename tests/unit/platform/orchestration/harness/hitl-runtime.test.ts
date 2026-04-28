import test from "node:test";
import assert from "node:assert/strict";
import { HitlRuntime } from "../../../../../src/platform/orchestration/harness/hitl-runtime.js";
import type { HarnessRun } from "../../../../../src/platform/orchestration/harness/index.js";
import { HarnessRuntimeService, type ConstraintPack } from "../../../../../src/platform/orchestration/harness/index.js";
import { DurableHarnessService } from "../../../../../src/platform/orchestration/harness/durable/durable-harness-service.js";
import { RecoveryController } from "../../../../../src/platform/orchestration/harness/recovery-controller.js";

// ─────────────────────────────────────────────────────────────────────────────
// HitlRuntime Action Methods Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HitlRuntime.inspect transitions request to approved and creates record", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-1",
    domainId: "domain-a",
    reason: "needs inspection",
    evidenceRefs: ["evidence-1"],
  });

  const { request: inspected, record } = runtime.inspect(request.requestId, "operator-1");

  assert.equal(inspected.status, "approved");
  assert.equal(inspected.resolvedBy, "operator-1");
  assert.ok(inspected.resolvedAt !== null);
  assert.ok(record.recordId.startsWith("hrr_"));
  assert.equal(record.action, "inspect");
  assert.equal(record.actor, "operator-1");
  assert.equal(record.scope, "inspect");
});

test("HitlRuntime.patch transitions request to patched and records beforeRef", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-1",
    domainId: "domain-a",
    reason: "needs patch",
    evidenceRefs: [],
  });

  const patchContent = { key: "value" };
  const { request: patched, record } = runtime.patch(request.requestId, "operator-1", patchContent, "fixing bug");

  assert.equal(patched.status, "patched");
  assert.equal(patched.resolvedBy, "operator-1");
  assert.deepEqual(patched.patchContent, patchContent);
  assert.ok(patched.beforeRef !== null);
  assert.ok(patched.beforeRef.startsWith("patch:before:"));
  assert.equal(record.action, "patch");
  assert.equal(record.rationale, "fixing bug");
  assert.ok(record.beforeRef.length > 0);
});

test("HitlRuntime.override transitions request to overridden with beforeRef and afterRef", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-1",
    domainId: "domain-a",
    reason: "needs override",
    evidenceRefs: [],
  });

  const overrideContent = { forced: true };
  const { request: overridden, record } = runtime.override(request.requestId, "operator-1", overrideContent, "operator decision");

  assert.equal(overridden.status, "overridden");
  assert.equal(overridden.resolvedBy, "operator-1");
  assert.deepEqual(overridden.patchContent, overrideContent);
  assert.ok(overridden.beforeRef !== null);
  assert.ok(overridden.afterRef !== null);
  assert.ok(overridden.beforeRef.startsWith("override:before:"));
  assert.ok(overridden.afterRef.startsWith("override:after:"));
  assert.equal(record.action, "override");
  assert.equal(record.rationale, "operator decision");
  assert.ok(record.beforeRef.length > 0);
  assert.ok(record.afterRef.length > 0);
});

test("HitlRuntime.takeover transitions request to taken_over", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-1",
    domainId: "domain-a",
    reason: "needs takeover",
    evidenceRefs: [],
  });

  const { request: takenOver, record } = runtime.takeover(request.requestId, "operator-1", "human intervention required");

  assert.equal(takenOver.status, "taken_over");
  assert.equal(takenOver.resolvedBy, "operator-1");
  assert.ok(takenOver.beforeRef !== null);
  assert.ok(takenOver.beforeRef.startsWith("takeover:before:"));
  assert.equal(record.action, "takeover");
  assert.equal(record.rationale, "human intervention required");
});

test("HitlRuntime.resume transitions request to approved with resume rationale", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-1",
    domainId: "domain-a",
    reason: "needs resume",
    evidenceRefs: [],
  });

  const { request: resumed, record } = runtime.resume(request.requestId, "operator-1");

  assert.equal(resumed.status, "approved");
  assert.equal(resumed.resolvedBy, "operator-1");
  assert.equal(record.action, "resume");
  assert.equal(record.rationale, "resume_execution");
});

test("HitlRuntime action methods throw for unknown requestId", () => {
  const runtime = new HitlRuntime();

  assert.throws(() => runtime.inspect("unknown-id", "op-1"), /harness\.hitl\.request_not_found/);
  assert.throws(() => runtime.patch("unknown-id", "op-1", {}, "reason"), /harness\.hitl\.request_not_found/);
  assert.throws(() => runtime.override("unknown-id", "op-1", {}, "reason"), /harness\.hitl\.request_not_found/);
  assert.throws(() => runtime.takeover("unknown-id", "op-1", "reason"), /harness\.hitl\.request_not_found/);
  assert.throws(() => runtime.resume("unknown-id", "op-1"), /harness\.hitl\.request_not_found/);
});

test("HitlRuntime.getResponsibilityRecord returns record after action method", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-1",
    domainId: "domain-a",
    reason: "test",
    evidenceRefs: [],
  });

  runtime.inspect(request.requestId, "operator-1");
  const record = runtime.getResponsibilityRecord(request.requestId);

  assert.ok(record !== null);
  assert.equal(record?.requestId, request.requestId);
  assert.equal(record?.actor, "operator-1");
  assert.ok(record?.expiresAt !== null);
  assert.ok(record?.auditRef.startsWith("audit://harness/hitl/"));
});

test("HitlRuntime.getResponsibilityRecord returns null for unknown requestId", () => {
  const runtime = new HitlRuntime();
  const result = runtime.getResponsibilityRecord("unknown-id");
  assert.equal(result, null);
});

test("HitlRuntime.resume preserves original request fields", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-resume-test",
    domainId: "domain-resume",
    mode: "patch",
    reason: "original reason",
    evidenceRefs: ["evidence-a", "evidence-b"],
  });

  const { request: resumed } = runtime.resume(request.requestId, "operator-1");

  assert.equal(resumed.requestId, request.requestId);
  assert.equal(resumed.runId, "run-resume-test");
  assert.equal(resumed.domainId, "domain-resume");
  assert.equal(resumed.mode, "patch");
  assert.equal(resumed.reason, "original reason");
  assert.equal(resumed.evidenceRefs.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// HITL Integration with HarnessRuntimeService Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HarnessRuntimeService.openHitlReview creates HITL request and pauses run", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-hitl-test",
    domainId: "coding",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: ["read"] },
      risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const paused = service.openHitlReview(run, "budget_exhausted", ["evidence-1"]);

  assert.equal(paused.status, "paused");
  assert.equal(paused.pauseReason, "hitl");
  assert.ok(paused.hitlRequest !== null);
  assert.equal(paused.hitlRequest?.status, "pending");
  assert.equal(paused.hitlRequest?.reason, "budget_exhausted");
  assert.ok(paused.timeline.some(e => e.type === "hitl_requested"));
});

test("HarnessRuntimeService.resolveHitlReview approves and resumes run", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-hitl-approve",
    domainId: "coding",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: ["read"] },
      risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const paused = service.openHitlReview(run, "needs approval", []);
  const resumed = service.resolveHitlReview(paused, "approved", "operator-1");

  assert.equal(resumed.status, "running");
  assert.equal(resumed.pauseReason, null);
  assert.ok(resumed.hitlRequest !== null);
  assert.equal(resumed.hitlRequest?.status, "approved");
  assert.ok(resumed.timeline.some(e => e.type === "hitl_resolved"));
});

test("HarnessRuntimeService.resolveHitlReview rejects and aborts run", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-hitl-reject",
    domainId: "coding",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: ["read"] },
      risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const paused = service.openHitlReview(run, "needs approval", []);
  const aborted = service.resolveHitlReview(paused, "rejected", "operator-2");

  assert.equal(aborted.status, "aborted");
  assert.ok(aborted.completedAt !== null);
  assert.equal(aborted.hitlRequest?.status, "rejected");
});

test("HarnessRuntimeService.resolveHitlReview throws when no HITL request exists", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-no-hitl",
    domainId: "coding",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  assert.throws(() => {
    service.resolveHitlReview(run, "approved", "operator-1");
  }, /harness\.hitl\.request_not_found_for_run/);
});

// ─────────────────────────────────────────────────────────────────────────────
// HITL Modes Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HitlRuntime defaults mode to inspect when not specified", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-1",
    domainId: "domain-a",
    reason: "test",
    evidenceRefs: [],
  });

  assert.equal(request.mode, "inspect");
});

test("HitlRuntime accepts all valid modes", () => {
  const runtime = new HitlRuntime();
  const modes = ["inspect", "patch", "override", "takeover", "resume"] as const;

  for (const mode of modes) {
    const request = runtime.open({
      runId: `run-${mode}`,
      domainId: "domain-a",
      mode,
      reason: `test mode ${mode}`,
      evidenceRefs: [],
    });
    assert.equal(request.mode, mode);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Human Responsibility Record Expiry Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HumanResponsibilityRecord expiresAt is 30 days in future", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-expiry",
    domainId: "domain-a",
    reason: "test",
    evidenceRefs: [],
  });

  const before = Date.now();
  runtime.inspect(request.requestId, "operator-1");
  const record = runtime.getResponsibilityRecord(request.requestId);
  const after = Date.now();

  const expiresAtMs = Date.parse(record!.expiresAt);
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  // expiresAt should be approximately 30 days from now
  assert.ok(expiresAtMs >= before + thirtyDaysMs - 1000);
  assert.ok(expiresAtMs <= after + thirtyDaysMs + 1000);
});
