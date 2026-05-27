/**
 * Reconciliation Worker Unit Tests
 *
 * Tests for the ReconciliationWorker class covering:
 * - Reconciliation action determination
 * - Reconciliation record creation
 * - Expiration checking
 * - Target status mapping
 * - Escalation logic
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ReconciliationWorker } from "../../../../src/platform/five-plane-execution/reconciliation-worker.js";

// ── Next Action Determination Tests ─────────────────────────────────────────────

test("ReconciliationWorker: determineNextAction for confirmed result [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker();

  const action = worker.determineNextAction("confirmed", "low");

  assert.equal(action, "mark_confirmed");
});

test("ReconciliationWorker: determineNextAction for not_found with low risk [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker();

  const action = worker.determineNextAction("not_found", "low");

  // Low risk: mark as failed
  assert.equal(action, "mark_failed");
});

test("ReconciliationWorker: determineNextAction for not_found with high risk [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker();

  const action = worker.determineNextAction("not_found", "high");

  // High risk: compensate
  assert.equal(action, "compensate");
});

test("ReconciliationWorker: determineNextAction for ambiguous result [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker();

  const action = worker.determineNextAction("ambiguous", "medium");

  // Ambiguous: retry probe
  assert.equal(action, "retry_probe");
});

test("ReconciliationWorker: determineNextAction for failed with critical risk [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker();

  const action = worker.determineNextAction("failed", "critical");

  // Critical risk and failed: escalate to HITL
  assert.equal(action, "escalate_hitl");
});

test("ReconciliationWorker: determineNextAction for failed with low risk [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker();

  const action = worker.determineNextAction("failed", "low");

  // Low-risk failed effects are terminally marked failed; high/critical require HITL escalation.
  assert.equal(action, "mark_failed");
});

// ── Expiration Checking Tests ──────────────────────────────────────────────────

test("ReconciliationWorker: isReconciliationExpired returns true for expired [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker({
    defaultReconciliationWindowMs: 30000, // 30 seconds
  });

  // Created 1 minute ago
  const createdAt = new Date(Date.now() - 60000).toISOString();

  const isExpired = worker.isReconciliationExpired(createdAt);

  assert.equal(isExpired, true);
});

test("ReconciliationWorker: isReconciliationExpired returns false for recent [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker({
    defaultReconciliationWindowMs: 30000, // 30 seconds
  });

  // Created 10 seconds ago
  const createdAt = new Date(Date.now() - 10000).toISOString();

  const isExpired = worker.isReconciliationExpired(createdAt);

  assert.equal(isExpired, false);
});

test("ReconciliationWorker: isReconciliationExpired uses custom window [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker({
    defaultReconciliationWindowMs: 60000, // 60 seconds default
  });

  // Created 30 seconds ago - within custom window
  const createdAt = new Date(Date.now() - 30000).toISOString();

  const isExpired = worker.isReconciliationExpired(createdAt, 120000); // 2 minute window

  assert.equal(isExpired, false);
});

test("ReconciliationWorker: isReconciliationExpired with very old record [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker({
    defaultReconciliationWindowMs: 30000,
  });

  // Created 1 hour ago
  const createdAt = new Date(Date.now() - 3600000).toISOString();

  const isExpired = worker.isReconciliationExpired(createdAt);

  assert.equal(isExpired, true);
});

// ── Target Status Mapping Tests ────────────────────────────────────────────────

test("ReconciliationWorker: getTargetStatus for mark_confirmed [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker();

  const status = worker.getTargetStatus("mark_confirmed");

  assert.equal(status, "confirmed");
});

test("ReconciliationWorker: getTargetStatus for retry_probe [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker();

  const status = worker.getTargetStatus("retry_probe");

  assert.equal(status, "reconciling");
});

test("ReconciliationWorker: getTargetStatus for compensate [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker();

  const status = worker.getTargetStatus("compensate");

  assert.equal(status, "compensation_required");
});

test("ReconciliationWorker: getTargetStatus for escalate_hitl [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker();

  const status = worker.getTargetStatus("escalate_hitl");

  assert.equal(status, "manual_review_required");
});

test("ReconciliationWorker: getTargetStatus for mark_failed [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker();

  const status = worker.getTargetStatus("mark_failed");

  assert.equal(status, "failed");
});

// ── Escalation Logic Tests ─────────────────────────────────────────────────────

test("ReconciliationWorker: requiresEscalation on max retries exceeded [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker({
    maxRetryAttempts: 3,
  });

  const needsEscalation = worker.requiresEscalation("ambiguous", 3, "low");

  assert.equal(needsEscalation, true);
});

test("ReconciliationWorker: requiresEscalation before max retries [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker({
    maxRetryAttempts: 3,
  });

  const needsEscalation = worker.requiresEscalation("ambiguous", 2, "low");

  assert.equal(needsEscalation, false);
});

test("ReconciliationWorker: requiresEscalation for critical failed [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker();

  const needsEscalation = worker.requiresEscalation("failed", 1, "critical");

  assert.equal(needsEscalation, true);
});

test("ReconciliationWorker: no escalation for non-critical failed [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker();

  const needsEscalation = worker.requiresEscalation("failed", 1, "medium");

  assert.equal(needsEscalation, false);
});

test("ReconciliationWorker: no escalation for successful confirmed [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker();

  const needsEscalation = worker.requiresEscalation("confirmed", 1, "critical");

  assert.equal(needsEscalation, false);
});

// ── Configuration Tests ─────────────────────────────────────────────────────

test("ReconciliationWorker: uses default configuration [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker();

  // Default: 30 second window, 3 max retries, 10 second probe timeout
  const isExpired = worker.isReconciliationExpired(
    new Date(Date.now() - 60000).toISOString() // 1 minute ago
  );

  assert.equal(isExpired, true);
});

test("ReconciliationWorker: respects custom configuration [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker({
    defaultReconciliationWindowMs: 60000, // 1 minute
    maxRetryAttempts: 5,
    probeTimeoutMs: 20000, // 20 seconds
  });

  // 30 seconds ago - should NOT be expired with 60 second window
  const createdAt = new Date(Date.now() - 30000).toISOString();

  const isExpired = worker.isReconciliationExpired(createdAt);

  assert.equal(isExpired, false);
});

// ── Reconciliation Record Creation Tests ──────────────────────────────────────

test("ReconciliationWorker: createReconciliationRecord [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker();

  const record = worker.createReconciliationRecord(
    "side-effect-1",
    "http_check",
    { status: "confirmed" },
    "confirmed",
    "mark_confirmed",
    []
  );

  assert.equal(record.sideEffectId, "side-effect-1");
  assert.equal(record.probeKind, "http_check");
  assert.deepEqual(record.externalObservedState, { status: "confirmed" });
  assert.equal(record.result, "confirmed");
  assert.equal(record.nextAction, "mark_confirmed");
});

test("ReconciliationWorker: createReconciliationRecord with evidence refs [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker();

  const evidenceRefs = [
    { artifactId: "art-1", uri: "artifact://art-1", hash: "sha256:abc" },
  ];

  const record = worker.createReconciliationRecord(
    "side-effect-1",
    "http_check",
    { status: "confirmed" },
    "confirmed",
    "mark_confirmed",
    evidenceRefs
  );

  assert.deepEqual(record.evidenceRefs, evidenceRefs);
});

// ── Action Combinations Tests ─────────────────────────────────────────────────

test("ReconciliationWorker: all reconciliation results have next actions [reconciliation-worker]", () => {
  const worker = new ReconciliationWorker();
  const results: Array<"confirmed" | "not_found" | "ambiguous" | "failed"> = [
    "confirmed",
    "not_found",
    "ambiguous",
    "failed",
  ];
  const riskLevels: Array<"low" | "medium" | "high" | "critical"> = [
    "low",
    "medium",
    "high",
    "critical",
  ];

  for (const result of results) {
    for (const risk of riskLevels) {
      const action = worker.determineNextAction(result, risk);
      const status = worker.getTargetStatus(action);

      assert.ok(action);
      assert.ok(status);
    }
  }
});
