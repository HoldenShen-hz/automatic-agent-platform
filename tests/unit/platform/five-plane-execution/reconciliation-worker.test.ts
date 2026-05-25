/**
 * Reconciliation Worker Unit Tests
 *
 * Tests reconciliation logic, result determination, expiration checking,
 * and escalation rules for ambiguous side effects.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ReconciliationWorker, type ReconciliationProbeResult } from "../../../../src/platform/five-plane-execution/reconciliation-worker.js";
import type { ReconciliationRecord, ArtifactRef } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

const TEST_TENANT = "test_tenant";

// ---------------------------------------------------------------------------
// Tests: determineNextAction
// ---------------------------------------------------------------------------

test("determineNextAction: confirmed -> mark_confirmed", () => {
  const worker = new ReconciliationWorker();
  const action = worker.determineNextAction("confirmed", "medium");

  assert.equal(action, "mark_confirmed");
});

test("determineNextAction: not_found + low risk -> mark_failed", () => {
  const worker = new ReconciliationWorker();
  const action = worker.determineNextAction("not_found", "low");

  assert.equal(action, "mark_failed");
});

test("determineNextAction: not_found + medium risk -> compensate", () => {
  const worker = new ReconciliationWorker();
  const action = worker.determineNextAction("not_found", "medium");

  assert.equal(action, "compensate");
});

test("determineNextAction: not_found + high risk -> compensate", () => {
  const worker = new ReconciliationWorker();
  const action = worker.determineNextAction("not_found", "high");

  assert.equal(action, "compensate");
});

test("determineNextAction: not_found + critical risk -> compensate", () => {
  const worker = new ReconciliationWorker();
  const action = worker.determineNextAction("not_found", "critical");

  assert.equal(action, "compensate");
});

test("determineNextAction: ambiguous -> retry_probe", () => {
  const worker = new ReconciliationWorker();
  const action = worker.determineNextAction("ambiguous", "medium");

  assert.equal(action, "retry_probe");
});

test("determineNextAction: failed + critical risk -> escalate_hitl", () => {
  const worker = new ReconciliationWorker();
  const action = worker.determineNextAction("failed", "critical");

  assert.equal(action, "escalate_hitl");
});

test("determineNextAction: failed + high risk -> escalate_hitl", () => {
  const worker = new ReconciliationWorker();
  const action = worker.determineNextAction("failed", "high");

  assert.equal(action, "escalate_hitl");
});

test("determineNextAction: failed + medium risk -> compensate", () => {
  const worker = new ReconciliationWorker();
  const action = worker.determineNextAction("failed", "medium");

  assert.equal(action, "compensate");
});

test("determineNextAction: failed + low risk -> mark_failed", () => {
  const worker = new ReconciliationWorker();
  const action = worker.determineNextAction("failed", "low");

  assert.equal(action, "mark_failed");
});

// ---------------------------------------------------------------------------
// Tests: createReconciliationRecord
// ---------------------------------------------------------------------------

test("createReconciliationRecord creates valid record", () => {
  const worker = new ReconciliationWorker();
  const sideEffectId = newId("se");
  const probeKind = "http_probe";
  const observedState = { status: "confirmed" };
  const result = "confirmed";
  const nextAction = "mark_confirmed";

  const record = worker.createReconciliationRecord(
    sideEffectId,
    probeKind,
    observedState,
    result,
    nextAction,
  );

  assert.equal(record.sideEffectId, sideEffectId);
  assert.equal(record.probeKind, probeKind);
  assert.deepEqual(record.externalObservedState, observedState);
  assert.equal(record.result, result);
  assert.equal(record.nextAction, nextAction);
  assert.ok(record.reconciliationId);
  assert.ok(record.createdAt);
});

test("createReconciliationRecord with evidence refs", () => {
  const worker = new ReconciliationWorker();
  const evidenceRefs: readonly ArtifactRef[] = [
    { artifactId: newId("art1"), uri: "s3://bucket/path1" },
    { artifactId: newId("art2"), uri: "s3://bucket/path2" },
  ];

  const record = worker.createReconciliationRecord(
    newId("se"),
    "http_probe",
    { status: "confirmed" },
    "confirmed",
    "mark_confirmed",
    evidenceRefs,
  );

  assert.equal(record.evidenceRefs.length, 2);
  assert.equal(record.evidenceRefs[0]?.artifactId, evidenceRefs[0]?.artifactId);
  assert.equal(record.evidenceRefs[1]?.artifactId, evidenceRefs[1]?.artifactId);
});

// ---------------------------------------------------------------------------
// Tests: isReconciliationExpired
// ---------------------------------------------------------------------------

test("isReconciliationExpired: record within window returns false", () => {
  const worker = new ReconciliationWorker({ defaultReconciliationWindowMs: 30_000 });
  const createdAt = new Date(Date.now() - 10_000).toISOString(); // 10 seconds ago

  const expired = worker.isReconciliationExpired(createdAt);

  assert.equal(expired, false);
});

test("isReconciliationExpired: record beyond window returns true", () => {
  const worker = new ReconciliationWorker({ defaultReconciliationWindowMs: 30_000 });
  const createdAt = new Date(Date.now() - 60_000).toISOString(); // 60 seconds ago

  const expired = worker.isReconciliationExpired(createdAt);

  assert.equal(expired, true);
});

test("isReconciliationExpired: custom window", () => {
  const worker = new ReconciliationWorker({ defaultReconciliationWindowMs: 30_000 });
  const createdAt = new Date(Date.now() - 15_000).toISOString(); // 15 seconds ago
  const customWindowMs = 10_000; // 10 seconds

  const expired = worker.isReconciliationExpired(createdAt, customWindowMs);

  assert.equal(expired, true);
});

test("isReconciliationExpired: at exact boundary", () => {
  const worker = new ReconciliationWorker({ defaultReconciliationWindowMs: 30_000 });
  const createdAt = new Date(Date.now() - 30_000).toISOString(); // exactly 30 seconds ago

  const expired = worker.isReconciliationExpired(createdAt);

  // At the boundary, it should be considered expired (now - created > window)
  assert.equal(expired, true);
});

test("isReconciliationExpired: invalid timestamp returns true", () => {
  const worker = new ReconciliationWorker({ defaultReconciliationWindowMs: 30_000 });

  const expired = worker.isReconciliationExpired("invalid-date");

  assert.equal(expired, true);
});

// ---------------------------------------------------------------------------
// Tests: getTargetStatus
// ---------------------------------------------------------------------------

test("getTargetStatus: mark_confirmed -> confirmed", () => {
  const worker = new ReconciliationWorker();
  const targetStatus = worker.getTargetStatus("mark_confirmed");

  assert.equal(targetStatus, "confirmed");
});

test("getTargetStatus: retry_probe -> reconciling", () => {
  const worker = new ReconciliationWorker();
  const targetStatus = worker.getTargetStatus("retry_probe");

  assert.equal(targetStatus, "reconciling");
});

test("getTargetStatus: compensate -> compensation_required", () => {
  const worker = new ReconciliationWorker();
  const targetStatus = worker.getTargetStatus("compensate");

  assert.equal(targetStatus, "compensation_required");
});

test("getTargetStatus: escalate_hitl -> manual_review_required", () => {
  const worker = new ReconciliationWorker();
  const targetStatus = worker.getTargetStatus("escalate_hitl");

  assert.equal(targetStatus, "manual_review_required");
});

test("getTargetStatus: mark_failed -> failed", () => {
  const worker = new ReconciliationWorker();
  const targetStatus = worker.getTargetStatus("mark_failed");

  assert.equal(targetStatus, "failed");
});

// ---------------------------------------------------------------------------
// Tests: requiresEscalation
// ---------------------------------------------------------------------------

test("requiresEscalation: ambiguous + max retries -> true", () => {
  const worker = new ReconciliationWorker({ maxRetryAttempts: 3 });
  const result = worker.requiresEscalation("ambiguous", 3, "medium");

  assert.equal(result, true);
});

test("requiresEscalation: ambiguous + below max retries -> false", () => {
  const worker = new ReconciliationWorker({ maxRetryAttempts: 3 });
  const result = worker.requiresEscalation("ambiguous", 2, "medium");

  assert.equal(result, false);
});

test("requiresEscalation: confirmed + max retries -> false", () => {
  const worker = new ReconciliationWorker({ maxRetryAttempts: 3 });
  const result = worker.requiresEscalation("confirmed", 3, "medium");

  assert.equal(result, false);
});

test("requiresEscalation: failed + critical risk -> true", () => {
  const worker = new ReconciliationWorker({ maxRetryAttempts: 3 });
  const result = worker.requiresEscalation("failed", 1, "critical");

  assert.equal(result, true);
});

test("requiresEscalation: failed + high risk -> false", () => {
  const worker = new ReconciliationWorker({ maxRetryAttempts: 3 });
  const result = worker.requiresEscalation("failed", 1, "high");

  assert.equal(result, false);
});

test("requiresEscalation: failed + medium risk -> false", () => {
  const worker = new ReconciliationWorker({ maxRetryAttempts: 3 });
  const result = worker.requiresEscalation("failed", 1, "medium");

  assert.equal(result, false);
});

test("requiresEscalation: failed + low risk -> false", () => {
  const worker = new ReconciliationWorker({ maxRetryAttempts: 3 });
  const result = worker.requiresEscalation("failed", 1, "low");

  assert.equal(result, false);
});

test("requiresEscalation: not_found + critical risk -> false (not a failed result)", () => {
  const worker = new ReconciliationWorker({ maxRetryAttempts: 3 });
  const result = worker.requiresEscalation("not_found", 1, "critical");

  assert.equal(result, false);
});

// ---------------------------------------------------------------------------
// Tests: Custom Configuration
// ---------------------------------------------------------------------------

test("ReconciliationWorker with custom defaultReconciliationWindowMs", () => {
  const worker = new ReconciliationWorker({ defaultReconciliationWindowMs: 60_000 });
  const createdAt = new Date(Date.now() - 45_000).toISOString(); // 45 seconds ago

  // With default window of 60s, 45s old record is not expired
  const expired = worker.isReconciliationExpired(createdAt);

  assert.equal(expired, false);
});

test("ReconciliationWorker with custom maxRetryAttempts", () => {
  const worker = new ReconciliationWorker({ maxRetryAttempts: 5 });
  const result = worker.requiresEscalation("ambiguous", 5, "medium");

  assert.equal(result, true);
});

test("ReconciliationWorker with custom probeTimeoutMs", () => {
  const worker = new ReconciliationWorker({ probeTimeoutMs: 20_000 });

  // The probeTimeoutMs is stored but not directly tested in public methods
  // This test just verifies the option is accepted
  assert.ok(worker);
});

// ---------------------------------------------------------------------------
// Tests: ExternalStateProbe Interface
// ---------------------------------------------------------------------------

test("ExternalStateProbe interface structure", () => {
  const mockProbe: import("../../../../src/platform/five-plane-execution/reconciliation-worker.js").ExternalStateProbe = {
    probe: async (idempotencyKey: string, timeoutMs?: number) => {
      return {
        observedState: { status: "confirmed" },
        result: "confirmed",
        evidenceRefs: [],
      };
    },
  };

  // Test that the probe can be called
  mockProbe.probe("test-key").then((result) => {
    assert.equal(result.result, "confirmed");
  });
});

// ---------------------------------------------------------------------------
// Tests: Full Reconciliation Flow
// ---------------------------------------------------------------------------

test("full reconciliation flow: probe -> determine action -> get target status", () => {
  const worker = new ReconciliationWorker();

  // Simulate a probe result of "confirmed"
  const probeResult: ReconciliationProbeResult = {
    observedState: { committed: true },
    result: "confirmed",
    evidenceRefs: [],
  };

  // Determine next action based on result
  const nextAction = worker.determineNextAction(probeResult.result, "medium");

  // Get target status
  const targetStatus = worker.getTargetStatus(nextAction);

  // Verify the flow
  assert.equal(nextAction, "mark_confirmed");
  assert.equal(targetStatus, "confirmed");
});

test("full reconciliation flow: not_found -> compensate -> compensation_required", () => {
  const worker = new ReconciliationWorker();

  const probeResult: ReconciliationProbeResult = {
    observedState: null,
    result: "not_found",
    evidenceRefs: [],
  };

  const nextAction = worker.determineNextAction(probeResult.result, "medium");
  const targetStatus = worker.getTargetStatus(nextAction);

  assert.equal(nextAction, "compensate");
  assert.equal(targetStatus, "compensation_required");
});

test("full reconciliation flow: failed + critical -> escalate_hitl -> manual_review_required", () => {
  const worker = new ReconciliationWorker();

  const probeResult: ReconciliationProbeResult = {
    observedState: { error: "timeout" },
    result: "failed",
    evidenceRefs: [],
  };

  const nextAction = worker.determineNextAction(probeResult.result, "critical");
  const targetStatus = worker.getTargetStatus(nextAction);

  assert.equal(nextAction, "escalate_hitl");
  assert.equal(targetStatus, "manual_review_required");
});

test("full reconciliation flow: ambiguous -> retry_probe -> reconciling", () => {
  const worker = new ReconciliationWorker();

  const probeResult: ReconciliationProbeResult = {
    observedState: { uncertain: true },
    result: "ambiguous",
    evidenceRefs: [],
  };

  const nextAction = worker.determineNextAction(probeResult.result, "medium");
  const targetStatus = worker.getTargetStatus(nextAction);

  assert.equal(nextAction, "retry_probe");
  assert.equal(targetStatus, "reconciling");
});

test("full reconciliation flow with low risk not_found -> mark_failed -> failed", () => {
  const worker = new ReconciliationWorker();

  const probeResult: ReconciliationProbeResult = {
    observedState: null,
    result: "not_found",
    evidenceRefs: [],
  };

  const nextAction = worker.determineNextAction(probeResult.result, "low");
  const targetStatus = worker.getTargetStatus(nextAction);

  assert.equal(nextAction, "mark_failed");
  assert.equal(targetStatus, "failed");
});

// ---------------------------------------------------------------------------
// Tests: Expiration Handling
// ---------------------------------------------------------------------------

test("expired reconciliation triggers escalate_hitl for critical risk", () => {
  const worker = new ReconciliationWorker();

  // Even though result is "ambiguous", expired reconciliation with critical risk
  // should escalate
  const result = worker.requiresEscalation("ambiguous", 5, "critical");

  assert.equal(result, true);
});
