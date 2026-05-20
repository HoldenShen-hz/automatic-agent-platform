import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowStateError } from "../../../../../src/platform/contracts/errors.js";
import {
  createBudgetLedger,
  createBudgetReservation,
  createHarnessRun,
  createNodeRun,
  createSideEffectRecord,
  type ArtifactRef,
  type HarnessRunStatus,
  type NodeRunStatus,
  type SideEffectStatus,
} from "../../../../../src/platform/contracts/executable-contracts/index.js";
import {
  RuntimeStateMachine,
  isTruthConsumerEvent,
  type RuntimeTransitionCommand,
  type RuntimeTransitionResult,
} from "../../../../../src/platform/five-plane-execution/runtime-state-machine.js";

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

const artifact: ArtifactRef = {
  artifactId: "artifact-1",
  uri: "artifact://artifact-1",
  hash: "sha256:test",
};

function createMachine(): RuntimeStateMachine {
  return new RuntimeStateMachine({ persistEvent: () => {} });
}

function makeCommand<T extends import("../../../../../src/platform/five-plane-execution/runtime-state-machine.js").RuntimeStateAggregate>(
  overrides: Partial<RuntimeTransitionCommand<T>>,
): RuntimeTransitionCommand<T> {
  return {
    commandId: "cmd-1",
    entityType: "HarnessRun",
    entityId: "entity-1",
    principal: "principal-1",
    aggregateType: "HarnessRun",
    aggregate: createHarnessRun({
      harnessRunId: "run-1",
      tenantId: "tenant-1",
      confirmedTaskSpecId: "ctspec-1",
      requestEnvelopeId: "request-1",
      requestHash: "request-hash-1",
      constraintPackRef: "constraint-pack-1",
      versionLockId: "rvlock-1",
      budgetLedgerId: "ledger-1",
    }) as T,
    fromStatus: "created" as any,
    toStatus: "admitted" as any,
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "test",
    emittedBy: "test",
    occurredAt: "2026-04-28T00:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// RuntimeStateMachine - Basic Construction
// ---------------------------------------------------------------------------

test("RuntimeStateMachine can be instantiated", () => {
  const machine = createMachine();
  assert.ok(machine);
});

// ---------------------------------------------------------------------------
// State Transition Validation
// ---------------------------------------------------------------------------

test("RuntimeStateMachine validates HarnessRun allowed transitions", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    status: "created",
    currentSeq: 0,
  });

  // Valid: created -> admitted
  const result = machine.transition({
    aggregateType: "HarnessRun",
    aggregate: run,
    fromStatus: "created",
    toStatus: "admitted",
    expectedSeq: 0,
    leaseId: "lease-1",
    fencingToken: "fence-1",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "admission_ok",
    emittedBy: "admission-controller",
    runVersionLockId: "rvlock-1",
    policyGuard: { allowed: true, policyProofRef: "policy-proof-1" },
    auditRef: "audit://run-1/admission",
  });

  assert.equal(result.aggregate.status, "admitted");
  assert.equal(result.event.eventType, "platform.harness_run.status_changed");
});

test("RuntimeStateMachine rejects invalid HarnessRun transition", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    status: "created",
    currentSeq: 0,
  });

  // Invalid: created -> running (must go through admitted, planning, ready)
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "created",
        toStatus: "running",
        expectedSeq: 0,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "invalid_jump",
        emittedBy: "test",
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.invalid_transition",
  );
});

test("RuntimeStateMachine validates NodeRun allowed transitions", () => {
  const machine = createMachine();
  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "ready",
    currentSeq: 0,
  });

  // Valid: ready -> leased (with lease/fencing)
  const result = machine.transition({
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "ready",
    toStatus: "leased",
    expectedSeq: 0,
    leaseId: "lease-1",
    fencingToken: "node-1-fence",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "lease_granted",
    emittedBy: "scheduler",
  });

  assert.equal(result.aggregate.status, "leased");
  assert.equal(result.aggregate.leaseId, "lease-1");
  assert.equal(result.aggregate.fencingToken, "node-1-fence");
});

test("RuntimeStateMachine rejects invalid NodeRun transition", () => {
  const machine = createMachine();
  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "created",
    currentSeq: 0,
  });

  // Invalid: created -> succeeded (must go through ready, leased, running)
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "created",
        toStatus: "succeeded",
        expectedSeq: 0,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "invalid_jump",
        emittedBy: "test",
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.invalid_transition",
  );
});

test("RuntimeStateMachine validates SideEffectRecord allowed transitions", () => {
  const machine = createMachine();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-1",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
    status: "proposed",
  });

  // Valid: proposed -> approved (with safety preCommitPolicyProofRef)
  const result = machine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "proposed",
    toStatus: "approved",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "policy_approved",
    emittedBy: "policy-evaluator",
    sideEffectSafety: { preCommitPolicyProofRef: "proof-ref-1" },
    auditRef: "audit://side-effect-1/approved",
  });

  assert.equal(result.aggregate.status, "approved");
  assert.equal(result.event.eventType, "platform.side_effect.status_changed");
});

test("RuntimeStateMachine validates BudgetLedger allowed transitions", () => {
  const machine = createMachine();
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  // Valid: open -> soft_cap_reached
  const result = machine.transition({
    aggregateType: "BudgetLedger",
    aggregate: ledger,
    fromStatus: "open",
    toStatus: "soft_cap_reached",
    expectedVersion: 0,
    leaseId: "lease-1",
    fencingToken: "fence-1",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "soft_cap_hit",
    emittedBy: "budget-allocator",
  });

  assert.equal(result.aggregate.status, "soft_cap_reached");
  assert.equal(result.aggregate.version, 1);
  assert.equal(result.event.eventType, "platform.budget_ledger.status_changed");
});

test("RuntimeStateMachine validates BudgetReservation allowed transitions", () => {
  const machine = createMachine();
  const reservation = createBudgetReservation({
    budgetLedgerId: "ledger-1",
    harnessRunId: "run-1",
    amount: 10,
    resourceKind: "token",
    expiresAt: "2026-04-28T01:00:00.000Z",
  });

  // Valid: reserved -> settled
  const result = machine.transition({
    aggregateType: "BudgetReservation",
    aggregate: reservation,
    fromStatus: "reserved",
    toStatus: "settled",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "budget_settled",
    emittedBy: "budget-allocator",
  });

  assert.equal(result.aggregate.status, "settled");
  assert.equal(result.event.eventType, "platform.budget_reservation.status_changed");
});

// ---------------------------------------------------------------------------
// No-Op Transition Rejection
// ---------------------------------------------------------------------------

test("RuntimeStateMachine rejects no-op transitions", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    status: "running",
    currentSeq: 4,
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "running",
        toStatus: "running",
        expectedSeq: 4,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "noop",
        emittedBy: "test",
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.noop_transition_denied",
  );
});

// ---------------------------------------------------------------------------
// CAS (Compare-And-Swap) Semantics per R9-02
// ---------------------------------------------------------------------------

test("RuntimeStateMachine enforces CAS on currentSeq for HarnessRun", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    status: "created",
    currentSeq: 5,
  });

  // Stale CAS: expectedSeq is 3 but aggregate.currentSeq is 5
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "created",
        toStatus: "admitted",
        expectedSeq: 3,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "stale_writer",
        emittedBy: "test",
        runVersionLockId: "rvlock-1",
        policyGuard: { allowed: true, policyProofRef: "proof-1" },
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.cas_failed",
  );
});

test("RuntimeStateMachine enforces CAS on version for BudgetLedger", () => {
  const machine = createMachine();
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 10,
  });

  // Stale CAS: expectedVersion is 5 but ledger.version is 10
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "BudgetLedger",
        aggregate: ledger,
        fromStatus: "open",
        toStatus: "soft_cap_reached",
        expectedVersion: 5,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "stale_writer",
        emittedBy: "budget-allocator",
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.version_cas_failed",
  );
});

test("RuntimeStateMachine allows valid CAS sequence", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    status: "created",
    currentSeq: 0,
  });

  // Valid CAS: expectedSeq matches currentSeq
  const result = machine.transition({
    aggregateType: "HarnessRun",
    aggregate: run,
    fromStatus: "created",
    toStatus: "admitted",
    expectedSeq: 0,
    leaseId: "lease-1",
    fencingToken: "fence-1",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "admission_ok",
    emittedBy: "test",
    runVersionLockId: "rvlock-1",
    policyGuard: { allowed: true, policyProofRef: "proof-1" },
    auditRef: "audit://run-1/admission",
  });

  assert.equal(result.aggregate.status, "admitted");
  assert.equal(result.aggregate.currentSeq, 1); // Incremented
});

test("RuntimeStateMachine increments currentSeq after successful transition", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    status: "created",
    currentSeq: 0,
  });

  const result = machine.transition({
    aggregateType: "HarnessRun",
    aggregate: run,
    fromStatus: "created",
    toStatus: "admitted",
    expectedSeq: 0,
    leaseId: "lease-1",
    fencingToken: "fence-1",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "admission_ok",
    emittedBy: "test",
    runVersionLockId: "rvlock-1",
    policyGuard: { allowed: true, policyProofRef: "proof-1" },
    auditRef: "audit://run-1/admission",
  });

  assert.equal(result.aggregate.currentSeq, 1);
});

// ---------------------------------------------------------------------------
// Terminal State Transitions
// ---------------------------------------------------------------------------

test("RuntimeStateMachine seals HarnessRun terminal states (completed)", () => {
  const machine = createMachine();
  const completed = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    status: "completed",
    currentSeq: 9,
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "HarnessRun",
        aggregate: completed,
        fromStatus: "completed",
        toStatus: "running",
        expectedSeq: 9,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "illegal_resume",
        emittedBy: "test",
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.invalid_transition",
  );
});

test("RuntimeStateMachine seals HarnessRun terminal states (failed)", () => {
  const machine = createMachine();
  const failed = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    status: "failed",
    currentSeq: 7,
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "HarnessRun",
        aggregate: failed,
        fromStatus: "failed",
        toStatus: "running",
        expectedSeq: 7,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "illegal_retry",
        emittedBy: "test",
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.invalid_transition",
  );
});

test("RuntimeStateMachine rejects compatibility reopen from aborted to paused", () => {
  const machine = createMachine();
  const aborted = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    status: "aborted",
    currentSeq: 3,
  });

  assert.throws(
    () => machine.transition({
      aggregateType: "HarnessRun",
      aggregate: aborted,
      fromStatus: "aborted",
      toStatus: "paused",
      expectedSeq: 3,
      traceId: "trace-1",
      tenantId: "tenant-1",
      reasonCode: "compatibility_resume",
      emittedBy: "test",
      fencingToken: "fence:run-1:3",
      auditRef: "audit://run-1/compatibility-resume",
    }),
    (error: unknown) => (error as { code?: string }).code === "runtime_state_machine.invalid_transition",
  );
});

test("RuntimeStateMachine seals NodeRun terminal states", () => {
  const machine = createMachine();
  const succeeded = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "succeeded",
    currentSeq: 5,
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "NodeRun",
        aggregate: succeeded,
        fromStatus: "succeeded",
        toStatus: "running",
        expectedSeq: 5,
        leaseId: "lease-1",
        fencingToken: "fence-1",
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "illegal_resume",
        emittedBy: "test",
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.invalid_transition",
  );
});

test("RuntimeStateMachine seals SideEffectRecord terminal states (compensated)", () => {
  const machine = createMachine();
  const compensated = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-1",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
    status: "compensated",
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "SideEffectRecord",
        aggregate: compensated,
        fromStatus: "compensated",
        toStatus: "committing",
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "illegal_reactivation",
        emittedBy: "test",
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.invalid_transition",
  );
});

test("RuntimeStateMachine sets terminalAt and terminalReason for terminal HarnessRun", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    status: "running",
    currentSeq: 5,
  });

  const result = machine.transition({
    aggregateType: "HarnessRun",
    aggregate: run,
    fromStatus: "running",
    toStatus: "completed",
    expectedSeq: 5,
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "all_steps_succeeded",
    emittedBy: "workflow-controller",
    auditRef: "audit://run-1/completion",
  });

  assert.equal(result.aggregate.status, "completed");
  assert.ok(result.aggregate.terminalAt);
  assert.equal(result.aggregate.terminalReason, "all_steps_succeeded");
});

test("RuntimeStateMachine sets terminalReason for terminal NodeRun", () => {
  const machine = createMachine();
  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "running",
    currentSeq: 3,
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  const result = machine.transition({
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "running",
    toStatus: "succeeded",
    expectedSeq: 3,
    leaseId: "lease-1",
    fencingToken: "fence-1",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "step_completed",
    emittedBy: "worker-1",
    auditRef: "audit://node-run-1/succeeded",
  });

  assert.equal(result.aggregate.status, "succeeded");
  assert.equal(result.aggregate.terminalReason, "step_completed");
});

// ---------------------------------------------------------------------------
// Invalid Transition Rejection
// ---------------------------------------------------------------------------

test("RuntimeStateMachine rejects transition when status mismatch", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    status: "admitted", // Aggregate is in admitted state
    currentSeq: 1,
  });

  // Command says fromStatus is created but aggregate status is admitted
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "created", // Mismatch: should be "admitted"
        toStatus: "planning",
        expectedSeq: 1,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "status_mismatch",
        emittedBy: "test",
        runVersionLockId: "rvlock-1",
        policyGuard: { allowed: true, policyProofRef: "proof-1" },
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.status_mismatch",
  );
});

test("RuntimeStateMachine rejects HarnessRun admission without RunVersionLockId", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
  });

  // Missing runVersionLockId for admission transition
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "created",
        toStatus: "admitted",
        expectedSeq: 0,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "admit",
        emittedBy: "test",
        policyGuard: { allowed: true, policyProofRef: "proof-1" },
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.run_version_lock_required",
  );
});

test("RuntimeStateMachine rejects HarnessRun admission when policy guard denies", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "created",
        toStatus: "admitted",
        expectedSeq: 0,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "admit",
        emittedBy: "test",
        runVersionLockId: "rvlock-1",
        policyGuard: { allowed: false, policyProofRef: "policy-proof-1" },
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.policy_denied",
  );
});

test("RuntimeStateMachine requires policyGuard.policyProofRef to be non-empty", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "created",
        toStatus: "admitted",
        expectedSeq: 0,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "admit",
        emittedBy: "test",
        runVersionLockId: "rvlock-1",
        policyGuard: { allowed: true, policyProofRef: "   " }, // Empty after trim
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.policy_proof_required",
  );
});

// ---------------------------------------------------------------------------
// Lease and Fencing (assertLeaseAndFencing)
// ---------------------------------------------------------------------------

test("RuntimeStateMachine requires lease and fencing for NodeRun execution transitions", () => {
  const machine = createMachine();
  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "ready",
    currentSeq: 0,
  });

  // Missing leaseId
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "ready",
        toStatus: "leased",
        expectedSeq: 0,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "lease",
        emittedBy: "scheduler",
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.lease_and_fencing_required",
  );

  // Missing fencingToken
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "ready",
        toStatus: "leased",
        expectedSeq: 0,
        leaseId: "lease-1",
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "lease",
        emittedBy: "scheduler",
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.lease_and_fencing_required",
  );
});

test("RuntimeStateMachine requires lease and fencing for HarnessRun status transitions", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    status: "admitted",
    currentSeq: 1,
  });

  // Critical HarnessRun transitions now require fencing.
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "admitted",
        toStatus: "planning",
        expectedSeq: 1,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "start_planning",
        emittedBy: "planner",
        runVersionLockId: "rvlock-1",
        policyGuard: { allowed: true, policyProofRef: "proof-1" },
        auditRef: "audit://run-1/planning",
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.harness_fencing_required",
  );
});

test("RuntimeStateMachine requires lease and fencing for SideEffectRecord commit transitions", () => {
  const machine = createMachine();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-1",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
    status: "proposed",
  });

  // Commit-affecting side-effect transitions require an active lease and fencing token.
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "SideEffectRecord",
        aggregate: sideEffect,
        fromStatus: "proposed",
        toStatus: "approved",
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "policy_approved",
        emittedBy: "policy-evaluator",
        sideEffectSafety: { preCommitPolicyProofRef: "proof-1" },
        auditRef: "audit://side-effect-1/approved",
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.side_effect_fencing_required",
  );
});

test("RuntimeStateMachine validates leaseId mismatch for NodeRun", () => {
  const machine = createMachine();
  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "running",
    currentSeq: 3,
    leaseId: "active-lease",
    fencingToken: "active-fence",
  });

  // Wrong leaseId
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "running",
        toStatus: "succeeded",
        expectedSeq: 3,
        leaseId: "wrong-lease",
        fencingToken: "active-fence",
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "writeback",
        emittedBy: "worker-1",
        auditRef: "audit://node-run-1/succeeded",
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.lease_mismatch",
  );
});

test("RuntimeStateMachine validates fencingToken mismatch for NodeRun", () => {
  const machine = createMachine();
  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "running",
    currentSeq: 3,
    leaseId: "active-lease",
    fencingToken: "active-fence",
  });

  // Wrong fencingToken
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "running",
        toStatus: "succeeded",
        expectedSeq: 3,
        leaseId: "active-lease",
        fencingToken: "wrong-fence",
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "writeback",
        emittedBy: "worker-1",
        auditRef: "audit://node-run-1/succeeded",
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.fencing_token_mismatch",
  );
});

test("RuntimeStateMachine accepts alternate leaseId for HarnessRun when required fields are present", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    status: "running",
    currentSeq: 5,
    leaseId: "active-lease",
    fencingToken: "active-fence",
  });

  const result = machine.transition({
    aggregateType: "HarnessRun",
    aggregate: run,
    fromStatus: "running",
    toStatus: "paused",
    expectedSeq: 5,
    leaseId: "wrong-lease",
    fencingToken: "active-fence",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "pause",
    emittedBy: "controller",
    auditRef: "audit://run-1/paused",
  });

  assert.equal(result.aggregate.status, "paused");
});

test("RuntimeStateMachine rejects alternate fencingToken for HarnessRun when active fencing exists", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    status: "running",
    currentSeq: 5,
    leaseId: "active-lease",
    fencingToken: "active-fence",
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "running",
        toStatus: "paused",
        expectedSeq: 5,
        leaseId: "active-lease",
        fencingToken: "wrong-fence",
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "pause",
        emittedBy: "controller",
        auditRef: "audit://run-1/paused",
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.harness_fencing_token_mismatch",
  );
});

test("RuntimeStateMachine rejects alternate leaseId for SideEffectRecord when active lease exists", () => {
  const machine = createMachine();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-1",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
    status: "committing",
    leaseId: "active-lease",
    fencingToken: "active-fence",
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "SideEffectRecord",
        aggregate: sideEffect,
        fromStatus: "committing",
        toStatus: "committed",
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "commit",
        emittedBy: "side-effect-manager",
        leaseId: "wrong-lease",
        fencingToken: "active-fence",
        sideEffectSafety: { preCommitPolicyProofRef: "proof-1" },
        auditRef: "audit://side-effect-1/committed",
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.side_effect_lease_mismatch",
  );
});

test("RuntimeStateMachine rejects alternate fencingToken for SideEffectRecord when active fencing exists", () => {
  const machine = createMachine();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-1",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
    status: "committing",
    leaseId: "active-lease",
    fencingToken: "active-fence",
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "SideEffectRecord",
        aggregate: sideEffect,
        fromStatus: "committing",
        toStatus: "committed",
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "commit",
        emittedBy: "side-effect-manager",
        leaseId: "active-lease",
        fencingToken: "wrong-fence",
        sideEffectSafety: { preCommitPolicyProofRef: "proof-1" },
        auditRef: "audit://side-effect-1/committed",
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.side_effect_fencing_token_mismatch",
  );
});

// ---------------------------------------------------------------------------
// Budget Precondition
// ---------------------------------------------------------------------------

test("RuntimeStateMachine rejects transition when budget hard cap not satisfied", () => {
  const machine = createMachine();
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "BudgetLedger",
        aggregate: ledger,
        fromStatus: "open",
        toStatus: "hard_cap_reached",
        expectedVersion: 0,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "hard_cap",
        emittedBy: "budget-allocator",
        budgetPrecondition: { reservationId: "res-1", hardCapSatisfied: false },
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.budget_hard_cap_not_satisfied",
  );
});

test("RuntimeStateMachine allows transition when budget hard cap satisfied", () => {
  const machine = createMachine();
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  const result = machine.transition({
    aggregateType: "BudgetLedger",
    aggregate: ledger,
    fromStatus: "open",
    toStatus: "hard_cap_reached",
    expectedVersion: 0,
    leaseId: "lease-1",
    fencingToken: "fence-1",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "hard_cap",
    emittedBy: "budget-allocator",
    budgetPrecondition: { reservationId: "res-1", hardCapSatisfied: true },
  });

  assert.equal(result.aggregate.status, "hard_cap_reached");
});

// ---------------------------------------------------------------------------
// Side Effect Safety
// ---------------------------------------------------------------------------

test("RuntimeStateMachine requires preCommitPolicyProofRef for commit-affecting transitions", () => {
  const machine = createMachine();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-1",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
    status: "proposed",
  });

  // Missing sideEffectSafety.preCommitPolicyProofRef
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "SideEffectRecord",
        aggregate: sideEffect,
        fromStatus: "proposed",
        toStatus: "approved",
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "policy_approved",
        emittedBy: "policy-evaluator",
        leaseId: "lease-1",
        fencingToken: "fence-1",
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.side_effect_policy_proof_required",
  );
});

test("RuntimeStateMachine requires human approval for high/critical risk side effects", () => {
  const machine = createMachine();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-1",
    riskClass: "critical", // High risk
    preCommitPolicyProofRef: artifact,
    status: "proposed",
  });

  // Missing humanApprovalRef for critical risk
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "SideEffectRecord",
        aggregate: sideEffect,
        fromStatus: "proposed",
        toStatus: "approved",
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "policy_approved",
        emittedBy: "policy-evaluator",
        sideEffectSafety: { preCommitPolicyProofRef: "proof-1" }, // No humanApprovalRef
      }),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "runtime_state_machine.side_effect_human_approval_required",
  );
});

// ---------------------------------------------------------------------------
// isTruthConsumerEvent
// ---------------------------------------------------------------------------

test("isTruthConsumerEvent returns true for platform.* events", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
  });

  const result = machine.transition({
    aggregateType: "HarnessRun",
    aggregate: run,
    fromStatus: "created",
    toStatus: "admitted",
    expectedSeq: 0,
    leaseId: "lease-1",
    fencingToken: "fence-1",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "admission_ok",
    emittedBy: "test",
    runVersionLockId: "rvlock-1",
    policyGuard: { allowed: true, policyProofRef: "proof-1" },
    auditRef: "audit://run-1/admission",
  });

  assert.equal(isTruthConsumerEvent(result.event), true);
  assert.equal(result.event.eventType.startsWith("platform."), true);
});

// ---------------------------------------------------------------------------
// Event Payload
// ---------------------------------------------------------------------------

test("RuntimeStateMachine event contains correct transition details", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
  });

  const result = machine.transition({
    aggregateType: "HarnessRun",
    aggregate: run,
    fromStatus: "created",
    toStatus: "admitted",
    expectedSeq: 0,
    leaseId: "lease-1",
    fencingToken: "fence-1",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "admission_ok",
    emittedBy: "admission-controller",
    runVersionLockId: "rvlock-1",
    policyGuard: { allowed: true, policyProofRef: "proof-1" },
    auditRef: "audit-ref-1",
  });

  const payload = result.event.payload as Record<string, unknown>;
  assert.equal(payload.fromStatus, "created");
  assert.equal(payload.toStatus, "admitted");
  assert.equal(payload.reasonCode, "admission_ok");
  assert.equal(payload.emittedBy, "admission-controller");
  assert.equal(payload.aggregateType, "HarnessRun");
});

test("RuntimeStateMachine event includes runVersionLockId when provided", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
  });

  const result = machine.transition({
    aggregateType: "HarnessRun",
    aggregate: run,
    fromStatus: "created",
    toStatus: "admitted",
    expectedSeq: 0,
    leaseId: "lease-1",
    fencingToken: "fence-1",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "admission_ok",
    emittedBy: "test",
    runVersionLockId: "rvlock-123",
    policyGuard: { allowed: true, policyProofRef: "proof-1" },
    auditRef: "audit://run-1/admission",
  });

  const payload = result.event.payload as Record<string, unknown>;
  assert.equal((payload as any).runVersionLockId, "rvlock-123");
});

// ---------------------------------------------------------------------------
// BudgetLedger Budget-Modifying Transitions
// ---------------------------------------------------------------------------

test("RuntimeStateMachine requires lease and fencing for BudgetLedger budget-modifying transitions", () => {
  const machine = createMachine();
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  assert.throws(
    () => machine.transition({
      aggregateType: "BudgetLedger",
      aggregate: ledger,
      fromStatus: "open",
      toStatus: "soft_cap_reached",
      expectedVersion: 0,
      traceId: "trace-1",
      tenantId: "tenant-1",
      reasonCode: "soft_cap",
      emittedBy: "budget-allocator",
    }),
    (error: unknown) => (error as { code?: string }).code === "runtime_state_machine.budget_ledger_fencing_required",
  );
});

test("RuntimeStateMachine accepts alternate leaseId for BudgetLedger when required fields are present", () => {
  const machine = createMachine();
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
    leaseId: "active-lease",
    fencingToken: "active-fence",
  });

  const result = machine.transition({
    aggregateType: "BudgetLedger",
    aggregate: ledger,
    fromStatus: "open",
    toStatus: "soft_cap_reached",
    expectedVersion: 0,
    leaseId: "wrong-lease",
    fencingToken: "active-fence",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "soft_cap",
    emittedBy: "budget-allocator",
  });

  assert.equal(result.aggregate.status, "soft_cap_reached");
});
