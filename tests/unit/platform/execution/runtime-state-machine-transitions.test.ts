import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowStateError } from "../../../../src/platform/contracts/errors.js";
import {
  createBudgetLedger,
  createBudgetReservation,
  createHarnessRun,
  createNodeRun,
  createSideEffectRecord,
} from "../../../../src/platform/contracts/executable-contracts/index.js";
import { RuntimeStateMachine, type PlatformFactEvent } from "../../../../src/platform/five-plane-execution/runtime-state-machine.js";

// Track persisted events for testing
const persistedEvents: PlatformFactEvent[] = [];

// Test subject
function createMachine(): RuntimeStateMachine {
  return new RuntimeStateMachine({
    persistEvent: (event) => {
      persistedEvents.push(event);
    },
  });
}

function clearPersistedEvents(): void {
  persistedEvents.length = 0;
}

// ---------------------------------------------------------------------------
// HarnessRun Transitions
// ---------------------------------------------------------------------------

test("RuntimeStateMachine allows valid HarnessRun transitions", () => {
  clearPersistedEvents();
  const machine = createMachine();

  const validTransitions: Array<[HarnessRunStatus, HarnessRunStatus]> = [
    ["created", "admitted"],
    ["created", "failed"],
    ["created", "aborted"],
    ["admitted", "planning"],
    ["admitted", "ready"],
    ["admitted", "failed"],
    ["admitted", "aborted"],
    ["planning", "ready"],
    ["planning", "replanning"],
    ["planning", "failed"],
    ["planning", "aborted"],
    ["ready", "running"],
    ["ready", "paused"],
    ["ready", "failed"],
    ["ready", "aborted"],
    ["running", "pausing"],
    ["running", "paused"],
    ["running", "replanning"],
    ["running", "compensating"],
    ["running", "completed"],
    ["running", "failed"],
    ["running", "aborted"],
    ["pausing", "paused"],
    ["pausing", "failed"],
    ["pausing", "aborted"],
    ["paused", "resuming"],
    ["paused", "replanning"],
    ["paused", "failed"],
    ["paused", "aborted"],
    ["resuming", "running"],
    ["resuming", "failed"],
    ["resuming", "aborted"],
    ["replanning", "ready"],
    ["replanning", "running"],
    ["replanning", "failed"],
    ["replanning", "aborted"],
    ["compensating", "completed"],
    ["compensating", "failed"],
    ["compensating", "aborted"],
  ];

  for (const [from, to] of validTransitions) {
    const run = createHarnessRun({
      harnessRunId: `run-${from}-${to}`,
      tenantId: "tenant-1",
      confirmedTaskSpecId: "ctspec-1",
      requestEnvelopeId: "request-1",
      requestHash: "request-hash-1",
      constraintPackRef: "constraint-pack-1",
      versionLockId: "rvlock-1",
      budgetLedgerId: "ledger-1",
      status: from,
      currentSeq: 0,
    });

    const command = {
      aggregateType: "HarnessRun" as const,
      aggregate: run,
      fromStatus: from,
      toStatus: to,
      expectedSeq: 0,
      traceId: "trace-1",
      tenantId: "tenant-1",
      reasonCode: "test",
      emittedBy: "test",
      runVersionLockId: "rvlock-1",
      policyGuard: { allowed: true, policyProofRef: "proof-1" },
      auditRef: "audit-1",
      occurredAt: "2026-04-27T00:00:00.000Z",
    };

    // Should not throw
    const result = machine.transition(command);
    assert.equal(result.aggregate.status, to, `Failed for ${from} -> ${to}`);
  }
});

test("RuntimeStateMachine rejects invalid HarnessRun transitions", () => {
  const machine = createMachine();

  const invalidTransitions: Array<[HarnessRunStatus, HarnessRunStatus]> = [
    ["completed", "running"],
    ["failed", "admitted"],
    ["aborted", "ready"],
    ["created", "running"],
    ["admitted", "completed"],
    ["planning", "running"],
  ];

  for (const [from, to] of invalidTransitions) {
    const run = createHarnessRun({
      harnessRunId: `run-${from}-${to}`,
      tenantId: "tenant-1",
      confirmedTaskSpecId: "ctspec-1",
      requestEnvelopeId: "request-1",
      requestHash: "request-hash-1",
      constraintPackRef: "constraint-pack-1",
      versionLockId: "rvlock-1",
      budgetLedgerId: "ledger-1",
      status: from,
      currentSeq: 0,
    });

    assert.throws(
      () =>
        machine.transition({
          aggregateType: "HarnessRun",
          aggregate: run,
          fromStatus: from,
          toStatus: to,
          expectedSeq: 0,
          traceId: "trace-1",
          tenantId: "tenant-1",
          reasonCode: "test",
          emittedBy: "test",
          runVersionLockId: "rvlock-1",
          policyGuard: { allowed: true, policyProofRef: "proof-1" },
          auditRef: "audit-1",
        }),
      WorkflowStateError,
      `Should reject ${from} -> ${to}`,
    );
  }
});

// ---------------------------------------------------------------------------
// NodeRun Transitions
// ---------------------------------------------------------------------------

test("RuntimeStateMachine allows valid NodeRun transitions", () => {
  const machine = createMachine();

  // Execution states require lease and fencing token
  const executionStatuses = ["leased", "running", "retry_wait", "awaiting_hitl", "reconciling", "succeeded", "failed"];

  const validTransitions: Array<[NodeRunStatus, NodeRunStatus]> = [
    ["created", "ready"],
    ["created", "policy_blocked"],
    ["created", "dependency_failed"],
    ["created", "aborted"],
    ["ready", "leased"],
    ["ready", "policy_blocked"],
    ["ready", "dependency_failed"],
    ["ready", "skipped"],
    ["ready", "aborted"],
    ["leased", "running"],
    ["leased", "ready"],
    ["leased", "cancelled"],
    ["leased", "aborted"],
    ["running", "retry_wait"],
    ["running", "awaiting_hitl"],
    ["running", "reconciling"],
    ["running", "succeeded"],
    ["running", "failed"],
    ["running", "cancelled"],
    ["running", "aborted"],
    ["retry_wait", "ready"],
    ["retry_wait", "failed"],
    ["retry_wait", "aborted"],
    ["awaiting_hitl", "ready"],
    ["awaiting_hitl", "running"],
    ["awaiting_hitl", "failed"],
    ["awaiting_hitl", "cancelled"],
    ["awaiting_hitl", "aborted"],
    ["reconciling", "succeeded"],
    ["reconciling", "failed"],
    ["reconciling", "aborted"],
  ];

  for (const [from, to] of validTransitions) {
    const needsLease = executionStatuses.includes(to);
    const nodeRun = createNodeRun({
      harnessRunId: "run-1",
      planGraphBundleId: "pgb-1",
      graphVersion: 1,
      nodeId: "node-1",
      status: from,
      currentSeq: 0,
      leaseId: needsLease ? "lease-1" : undefined,
      fencingToken: needsLease ? "fence-1" : undefined,
    });

    // For non-execution transitions, we still need to pass the nodeRun's existing fencingToken
    // to avoid mismatch error (nodeRun has default fencingToken from createNodeRun)
    const commandFencingToken = needsLease ? "fence-1" : nodeRun.fencingToken;

    const command = {
      aggregateType: "NodeRun" as const,
      aggregate: nodeRun,
      fromStatus: from,
      toStatus: to,
      expectedSeq: 0,
      traceId: "trace-1",
      tenantId: "tenant-1",
      reasonCode: "test",
      emittedBy: "test",
      leaseId: needsLease ? "lease-1" : undefined,
      fencingToken: commandFencingToken,
      occurredAt: "2026-04-27T00:00:00.000Z",
    };

    const result = machine.transition(command);
    assert.equal(result.aggregate.status, to, `Failed for ${from} -> ${to}`);
  }
});

test("RuntimeStateMachine rejects invalid NodeRun transitions", () => {
  const machine = createMachine();

  const invalidTransitions: Array<[NodeRunStatus, NodeRunStatus]> = [
    ["succeeded", "running"],
    ["failed", "ready"],
    ["skipped", "running"],
    ["cancelled", "ready"],
    ["created", "running"],
    ["ready", "running"],
  ];

  for (const [from, to] of invalidTransitions) {
    const nodeRun = createNodeRun({
      harnessRunId: "run-1",
      planGraphBundleId: "pgb-1",
      graphVersion: 1,
      nodeId: "node-1",
      status: from,
      currentSeq: 0,
    });

    assert.throws(
      () =>
        machine.transition({
          aggregateType: "NodeRun",
          aggregate: nodeRun,
          fromStatus: from,
          toStatus: to,
          expectedSeq: 0,
          traceId: "trace-1",
          tenantId: "tenant-1",
          reasonCode: "test",
          emittedBy: "test",
        }),
      WorkflowStateError,
      `Should reject ${from} -> ${to}`,
    );
  }
});

// ---------------------------------------------------------------------------
// SideEffectRecord Transitions - basic (no safety checks)
// ---------------------------------------------------------------------------

test("RuntimeStateMachine allows SideEffectRecord simple transitions", () => {
  const machine = createMachine();

  // Transitions that don't require sideEffectSafety
  const simpleTransitions: Array<[SideEffectStatus, SideEffectStatus]> = [
    ["proposed", "revoked"],
    ["proposed", "expired"],
    ["proposed", "failed"],
    ["approved", "revoked"],
    ["approved", "expired"],
    ["approved", "failed"],
    ["reserved", "revoked"],
    ["reserved", "expired"],
    ["reserved", "failed"],
    ["committing", "failed"],
    ["committed", "failed"],
    ["confirming", "failed"],
    ["ambiguous", "failed"],
    ["ambiguous", "reconciling"],
    ["ambiguous", "manual_review_required"],
    ["ambiguous", "compensation_required"],
    ["ambiguous", "compensating"],
    ["manual_review_required", "failed"],
    ["reconciling", "failed"],
    ["compensation_required", "failed"],
  ];

  for (const [from, to] of simpleTransitions) {
    const sideEffect = createSideEffectRecord({
      harnessRunId: "run-1",
      nodeRunId: "node-run-1",
      nodeAttemptId: "attempt-1",
      effectKind: "external_api",
      idempotencyKey: "key-1",
      status: from,
      riskClass: "low",
      preCommitPolicyProofRef: {} as any,
      leaseId: "lease-1",
      fencingToken: "fence-1",
    });

    const result = machine.transition({
      aggregateType: "SideEffectRecord" as const,
      aggregate: sideEffect,
      fromStatus: from,
      toStatus: to,
      traceId: "trace-1",
      tenantId: "tenant-1",
      reasonCode: "test",
      emittedBy: "test",
    });

    assert.equal(result.aggregate.status, to, `Failed for ${from} -> ${to}`);
  }
});

test("RuntimeStateMachine allows SideEffectRecord commit-path transitions with safety", () => {
  const machine = createMachine();

  // Transitions that require sideEffectSafety with preCommitPolicyProofRef
  const commitPathTransitions: Array<[SideEffectStatus, SideEffectStatus]> = [
    ["proposed", "approved"],
    ["proposed", "reserved"],
    ["approved", "reserved"],
    ["approved", "committing"],
    ["reserved", "committing"],
    ["committing", "committed"],
    ["committing", "confirming"],
    ["committing", "confirmed"],
    ["committing", "ambiguous"],
    ["committing", "manual_review_required"],
    ["committed", "confirming"],
    ["committed", "confirmed"],
    ["committed", "ambiguous"],
    ["committed", "compensation_required"],
    ["confirming", "confirmed"],
    ["confirming", "ambiguous"],
    ["confirming", "manual_review_required"],
    ["confirmed", "reconciling"],
    ["confirmed", "compensation_required"],
    ["confirmed", "compensating"],
  ];

  for (const [from, to] of commitPathTransitions) {
    const sideEffect = createSideEffectRecord({
      harnessRunId: "run-1",
      nodeRunId: "node-run-1",
      nodeAttemptId: "attempt-1",
      effectKind: "external_api",
      idempotencyKey: "key-1",
      status: from,
      riskClass: "low",
      preCommitPolicyProofRef: {} as any,
    });

    const result = machine.transition({
      aggregateType: "SideEffectRecord" as const,
      aggregate: sideEffect,
      fromStatus: from,
      toStatus: to,
      traceId: "trace-1",
      tenantId: "tenant-1",
      reasonCode: "test",
      emittedBy: "test",
      sideEffectSafety: {
        preCommitPolicyProofRef: "proof-ref-1",
      },
      leaseId: "lease-1",
      fencingToken: "fence-1",
    });

    assert.equal(result.aggregate.status, to, `Failed for ${from} -> ${to}`);
  }
});

test("RuntimeStateMachine rejects invalid SideEffectRecord transitions", () => {
  const machine = createMachine();

  const invalidTransitions: Array<[SideEffectStatus, SideEffectStatus]> = [
    ["proposed", "committed"],
    ["approved", "compensated"],
    ["reserved", "confirmed"],
    ["compensated", "committed"],
    ["failed", "running"],
  ];

  for (const [from, to] of invalidTransitions) {
    const sideEffect = createSideEffectRecord({
      harnessRunId: "run-1",
      nodeRunId: "node-run-1",
      nodeAttemptId: "attempt-1",
      effectKind: "external_api",
      idempotencyKey: "key-1",
      status: from,
      riskClass: "low",
      preCommitPolicyProofRef: {} as any,
    });

    assert.throws(
      () =>
        machine.transition({
          aggregateType: "SideEffectRecord",
          aggregate: sideEffect,
          fromStatus: from,
          toStatus: to,
          traceId: "trace-1",
          tenantId: "tenant-1",
          reasonCode: "test",
          emittedBy: "test",
        }),
      WorkflowStateError,
      `Should reject ${from} -> ${to}`,
    );
  }
});

// ---------------------------------------------------------------------------
// BudgetLedger Transitions
// ---------------------------------------------------------------------------

test("RuntimeStateMachine allows valid BudgetLedger transitions", () => {
  const machine = createMachine();

  const validTransitions: Array<[BudgetLedgerStatus, BudgetLedgerStatus]> = [
    ["open", "soft_cap_reached"],
    ["open", "hard_cap_reached"],
    ["open", "closed"],
    ["soft_cap_reached", "open"],
    ["soft_cap_reached", "hard_cap_reached"],
    ["soft_cap_reached", "closed"],
    ["hard_cap_reached", "closed"],
  ];

  for (const [from, to] of validTransitions) {
    const ledger = createBudgetLedger({
      tenantId: "tenant-1",
      harnessRunId: "run-1",
      currency: "USD",
      hardCap: 100,
      status: from,
      version: 0,
    });

    const result = machine.transition({
      aggregateType: "BudgetLedger" as const,
      aggregate: ledger,
      fromStatus: from,
      toStatus: to,
      expectedVersion: 0,
      traceId: "trace-1",
      tenantId: "tenant-1",
      reasonCode: "test",
      emittedBy: "test",
    });

    assert.equal(result.aggregate.status, to, `Failed for ${from} -> ${to}`);
  }
});

test("RuntimeStateMachine rejects invalid BudgetLedger transitions", () => {
  const machine = createMachine();

  const invalidTransitions: Array<[BudgetLedgerStatus, BudgetLedgerStatus]> = [
    ["closed", "open"],
    ["hard_cap_reached", "soft_cap_reached"],
    ["hard_cap_reached", "open"],
  ];

  for (const [from, to] of invalidTransitions) {
    const ledger = createBudgetLedger({
      tenantId: "tenant-1",
      harnessRunId: "run-1",
      currency: "USD",
      hardCap: 100,
      status: from,
      version: 0,
    });

    assert.throws(
      () =>
        machine.transition({
          aggregateType: "BudgetLedger",
          aggregate: ledger,
          fromStatus: from,
          toStatus: to,
          expectedVersion: 0,
          traceId: "trace-1",
          tenantId: "tenant-1",
          reasonCode: "test",
          emittedBy: "test",
        }),
      WorkflowStateError,
      `Should reject ${from} -> ${to}`,
    );
  }
});

// ---------------------------------------------------------------------------
// BudgetReservation Transitions
// ---------------------------------------------------------------------------

test("RuntimeStateMachine allows valid BudgetReservation transitions", () => {
  const machine = createMachine();

  const validTransitions: Array<[BudgetReservationStatus, BudgetReservationStatus]> = [
    ["reserved", "settled"],
    ["reserved", "released"],
    ["reserved", "expired"],
    ["reserved", "rejected"],
  ];

  for (const [from, to] of validTransitions) {
    const reservation = createBudgetReservation({
      budgetLedgerId: "ledger-1",
      harnessRunId: "run-1",
      amount: 10,
      resourceKind: "token",
      expiresAt: "2026-04-27T01:00:00.000Z",
      status: from,
    });

    const result = machine.transition({
      aggregateType: "BudgetReservation" as const,
      aggregate: reservation,
      fromStatus: from,
      toStatus: to,
      traceId: "trace-1",
      tenantId: "tenant-1",
      reasonCode: "test",
      emittedBy: "test",
    });

    assert.equal(result.aggregate.status, to, `Failed for ${from} -> ${to}`);
  }
});

test("RuntimeStateMachine rejects invalid BudgetReservation transitions", () => {
  const machine = createMachine();

  const invalidTransitions: Array<[BudgetReservationStatus, BudgetReservationStatus]> = [
    ["settled", "reserved"],
    ["released", "settled"],
    ["expired", "released"],
  ];

  for (const [from, to] of invalidTransitions) {
    const reservation = createBudgetReservation({
      budgetLedgerId: "ledger-1",
      harnessRunId: "run-1",
      amount: 10,
      resourceKind: "token",
      expiresAt: "2026-04-27T01:00:00.000Z",
      status: from,
    });

    assert.throws(
      () =>
        machine.transition({
          aggregateType: "BudgetReservation",
          aggregate: reservation,
          fromStatus: from,
          toStatus: to,
          traceId: "trace-1",
          tenantId: "tenant-1",
          reasonCode: "test",
          emittedBy: "test",
        }),
      WorkflowStateError,
      `Should reject ${from} -> ${to}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Type aliases for readability
// ---------------------------------------------------------------------------

type HarnessRunStatus = "created" | "admitted" | "planning" | "ready" | "running" | "pausing" | "paused" | "resuming" | "replanning" | "compensating" | "completed" | "failed" | "aborted";

type NodeRunStatus = "created" | "ready" | "leased" | "running" | "retry_wait" | "awaiting_hitl" | "reconciling" | "succeeded" | "failed" | "skipped" | "cancelled" | "dependency_failed" | "policy_blocked" | "aborted";

type SideEffectStatus = "proposed" | "approved" | "reserved" | "committing" | "committed" | "confirming" | "confirmed" | "ambiguous" | "manual_review_required" | "reconciling" | "compensation_required" | "compensating" | "compensated" | "failed" | "revoked" | "expired";

type BudgetLedgerStatus = "open" | "soft_cap_reached" | "hard_cap_reached" | "closed";

type BudgetReservationStatus = "reserved" | "settled" | "released" | "expired" | "rejected";
