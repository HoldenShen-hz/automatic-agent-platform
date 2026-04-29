/**
 * Executable Contracts Factory Functions Unit Tests
 *
 * Tests factory functions from executable-contracts not covered by existing tests.
 * Covers: createPrincipalRef, createTaskDraft, createConfirmedTaskSpec,
 * createRequestEnvelopeFromConfirmedTask, createNodeAttempt, createAttemptLineage,
 * createSideEffectRecord, createReconciliationRecord, createCompensationRecord,
 * createBudgetLedger, createBudgetReservation, createBudgetSettlement,
 * createRunVersionLock, createArtifactVersionLockSet, createDecisionInputBundle,
 * createHarnessDecision, createHumanResponsibilityRecord, createPlatformFactEvent,
 * createOapeflirViewEvent, isPlatformFactEvent, isOapeflirViewEvent,
 * canTruthConsumerConsume, assertGraphPatchSafety
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  createPrincipalRef,
  createTaskDraft,
  createConfirmedTaskSpec,
  createRequestEnvelopeFromConfirmedTask,
  createNodeAttempt,
  createAttemptLineage,
  createSideEffectRecord,
  createReconciliationRecord,
  createCompensationRecord,
  createBudgetLedger,
  createBudgetReservation,
  createBudgetSettlement,
  reserveBudgetHardCap,
  createRunVersionLock,
  createArtifactVersionLockSet,
  createDecisionInputBundle,
  createHarnessDecision,
  createHumanResponsibilityRecord,
  createPlatformFactEvent,
  createOapeflirViewEvent,
  isPlatformFactEvent,
  isOapeflirViewEvent,
  canTruthConsumerConsume,
  assertGraphPatchSafety,
  type ArtifactRef,
  type BudgetIntent,
  type RiskPreview,
  type PlanGraph,
  type SideEffectRecord,
  type GraphPatch,
} from "../../../../src/platform/contracts/executable-contracts/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

const artifact: ArtifactRef = {
  artifactId: "artifact-1",
  uri: "artifact://artifact-1",
  hash: "sha256:test",
};

const budgetIntent: BudgetIntent = {
  amount: 100,
  currency: "USD",
  resourceKinds: ["token", "tool"],
};

const riskPreview: RiskPreview = {
  riskClass: "low",
  reasons: ["reason1"],
};

// =============================================================================
// createPrincipalRef Tests
// =============================================================================

test("executable-contracts: createPrincipalRef creates valid principal", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  assert.equal(principal.principalId, "user-1");
  assert.equal(principal.tenantId, "tenant-1");
  assert.deepEqual(principal.roles, ["operator"]);
});

test("executable-contracts: createPrincipalRef defaults roles to empty array", () => {
  const principal = createPrincipalRef({
    principalId: "user-2",
    tenantId: "tenant-2",
  });

  assert.deepEqual(principal.roles, []);
});

test("executable-contracts: createPrincipalRef throws when principalId is empty", () => {
  assert.throws(
    () =>
      createPrincipalRef({
        principalId: "",
        tenantId: "tenant-1",
      }),
    ValidationError,
  );
});

test("executable-contracts: createPrincipalRef throws when tenantId is empty", () => {
  assert.throws(
    () =>
      createPrincipalRef({
        principalId: "user-1",
        tenantId: "   ",
      }),
    ValidationError,
  );
});

test("executable-contracts: createPrincipalRef includes optional displayName", () => {
  const principal = createPrincipalRef({
    principalId: "user-3",
    tenantId: "tenant-3",
    displayName: "Test User",
  });

  assert.equal(principal.displayName, "Test User");
});

// =============================================================================
// createTaskDraft Tests
// =============================================================================

test("executable-contracts: createTaskDraft creates valid task draft", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const draft = createTaskDraft({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    normalizedIntent: { goal: "test goal" },
    riskPreview,
  });

  assert.ok(draft.taskDraftId.startsWith("taskdraft_"));
  assert.equal(draft.tenantId, "tenant-1");
  assert.equal(draft.principal, principal);
  assert.equal(draft.source, "nl");
  assert.deepEqual(draft.normalizedIntent, { goal: "test goal" });
  assert.deepEqual(draft.riskPreview, riskPreview);
  assert.equal(draft.ambiguityPolicy, "require_confirmation");
  assert.deepEqual(draft.missingFields, []);
});

test("executable-contracts: createTaskDraft accepts all TaskInputSource values", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const sources = ["nl", "webhook", "ui", "cli", "scheduler", "external_event"] as const;

  for (const source of sources) {
    const draft = createTaskDraft({
      tenantId: "tenant-1",
      principal,
      source,
      normalizedIntent: {},
      riskPreview,
    });

    assert.equal(draft.source, source, `source '${source}' should be accepted`);
  }
});

test("executable-contracts: createTaskDraft accepts all AmbiguityPolicy values", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const policies = ["safe_default", "require_confirmation", "reject"] as const;

  for (const policy of policies) {
    const draft = createTaskDraft({
      tenantId: "tenant-1",
      principal,
      source: "nl",
      normalizedIntent: {},
      riskPreview,
      ambiguityPolicy: policy,
    });

    assert.equal(draft.ambiguityPolicy, policy, `policy '${policy}' should be accepted`);
  }
});

test("executable-contracts: createTaskDraft accepts optional fields", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const draft = createTaskDraft({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    normalizedIntent: {},
    riskPreview,
    taskDraftId: "custom-draft-id",
    rawInputRef: artifact,
    missingFields: ["field1", "field2"],
    expiresAt: "2026-12-31T23:59:59.999Z",
  });

  assert.equal(draft.taskDraftId, "custom-draft-id");
  assert.deepEqual(draft.rawInputRef, artifact);
  assert.deepEqual(draft.missingFields, ["field1", "field2"]);
  assert.equal(draft.expiresAt, "2026-12-31T23:59:59.999Z");
});

// =============================================================================
// createConfirmedTaskSpec Tests
// =============================================================================

test("executable-contracts: createConfirmedTaskSpec creates valid spec", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const spec = createConfirmedTaskSpec({
    taskDraftId: "draft-1",
    tenantId: "tenant-1",
    principal,
    goal: "complete task",
    inputs: { key: "value" },
    constraintPackRef: "constraint-pack-1",
    riskClass: "low",
    idempotencyKey: "idem-1",
    traceId: "trace-1",
  });

  assert.ok(spec.confirmedTaskSpecId.startsWith("ctspec_"));
  assert.equal(spec.taskDraftId, "draft-1");
  assert.equal(spec.goal, "complete task");
  assert.deepEqual(spec.inputs, { key: "value" });
  assert.equal(spec.constraintPackRef, "constraint-pack-1");
  assert.equal(spec.riskClass, "low");
  assert.equal(spec.idempotencyKey, "idem-1");
  assert.equal(spec.traceId, "trace-1");
});

test("executable-contracts: createConfirmedTaskSpec accepts low and medium RiskClass values", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const riskClasses = ["low", "medium"] as const;

  for (const riskClass of riskClasses) {
    const spec = createConfirmedTaskSpec({
      taskDraftId: "draft-1",
      tenantId: "tenant-1",
      principal,
      goal: "test goal",
      inputs: {},
      constraintPackRef: "cp-1",
      riskClass,
      idempotencyKey: `idem-${riskClass}`,
      traceId: "trace-1",
    });

    assert.equal(spec.riskClass, riskClass, `riskClass '${riskClass}' should be accepted`);
  }
});

test("executable-contracts: createConfirmedTaskSpec throws for high-risk without confirmation", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  assert.throws(
    () =>
      createConfirmedTaskSpec({
        taskDraftId: "draft-1",
        tenantId: "tenant-1",
        principal,
        goal: "high risk task",
        inputs: {},
        constraintPackRef: "cp-1",
        riskClass: "high",
        idempotencyKey: "idem-1",
        traceId: "trace-1",
      }),
    ValidationError,
  );
});

test("executable-contracts: createConfirmedTaskSpec throws for critical-risk without confirmation", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  assert.throws(
    () =>
      createConfirmedTaskSpec({
        taskDraftId: "draft-1",
        tenantId: "tenant-1",
        principal,
        goal: "critical risk task",
        inputs: {},
        constraintPackRef: "cp-1",
        riskClass: "critical",
        idempotencyKey: "idem-1",
        traceId: "trace-1",
      }),
    ValidationError,
  );
});

test("executable-contracts: createConfirmedTaskSpec accepts confirmation receipt for high-risk", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const spec = createConfirmedTaskSpec({
    taskDraftId: "draft-1",
    tenantId: "tenant-1",
    principal,
    goal: "high risk task with confirmation",
    inputs: {},
    constraintPackRef: "cp-1",
    riskClass: "high",
    idempotencyKey: "idem-1",
    traceId: "trace-1",
    confirmationReceipt: {
      receiptId: "receipt-1",
      confirmedBy: principal,
      riskClass: "high",
      confirmedAt: "2026-04-29T00:00:00.000Z",
    },
  });

  assert.equal(spec.riskClass, "high");
  assert.ok(spec.confirmationReceipt != null);
});

// =============================================================================
// createRequestEnvelopeFromConfirmedTask Tests
// =============================================================================

test("executable-contracts: createRequestEnvelopeFromConfirmedTask creates valid envelope", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const confirmedSpec = createConfirmedTaskSpec({
    taskDraftId: "draft-1",
    tenantId: "tenant-1",
    principal,
    goal: "test goal",
    inputs: {},
    constraintPackRef: "cp-1",
    riskClass: "low",
    idempotencyKey: "idem-1",
    traceId: "trace-1",
  });

  const envelope = createRequestEnvelopeFromConfirmedTask({
    confirmedTaskSpec: confirmedSpec,
    budgetIntent,
  });

  assert.ok(envelope.requestId.startsWith("request_"));
  assert.equal(envelope.confirmedTaskSpecId, confirmedSpec.confirmedTaskSpecId);
  assert.equal(envelope.tenantId, "tenant-1");
  assert.equal(envelope.principal, principal);
  assert.equal(envelope.traceId, "trace-1");
  assert.equal(envelope.idempotencyKey, "idem-1");
  assert.equal(envelope.priority, 0);
  assert.ok(envelope.requestHash.startsWith("reqhash_"));
  assert.equal(envelope.constraintPackRef, "cp-1");
  assert.deepEqual(envelope.budgetIntent, budgetIntent);
  assert.deepEqual(envelope.policyContext, {});
  assert.deepEqual(envelope.artifactRefs, []);
});

test("executable-contracts: createRequestEnvelopeFromConfirmedTask accepts optional parameters", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const confirmedSpec = createConfirmedTaskSpec({
    taskDraftId: "draft-1",
    tenantId: "tenant-1",
    principal,
    goal: "test goal",
    inputs: {},
    constraintPackRef: "cp-1",
    riskClass: "low",
    idempotencyKey: "idem-1",
    traceId: "trace-1",
  });

  const envelope = createRequestEnvelopeFromConfirmedTask({
    confirmedTaskSpec: confirmedSpec,
    budgetIntent,
    requestId: "custom-request-id",
    requestHash: "custom-hash",
    priority: 5,
    policyContext: { key: "value" },
    artifactRefs: [artifact],
  });

  assert.equal(envelope.requestId, "custom-request-id");
  assert.equal(envelope.requestHash, "custom-hash");
  assert.equal(envelope.priority, 5);
  assert.deepEqual(envelope.policyContext, { key: "value" });
  assert.deepEqual(envelope.artifactRefs, [artifact]);
});

// =============================================================================
// createNodeAttempt Tests
// =============================================================================

test("executable-contracts: createNodeAttempt creates valid attempt", () => {
  const attempt = createNodeAttempt({
    nodeRunId: "nrun-1",
    attemptNo: 1,
    attemptKind: "initial",
    executorRef: "worker-1",
    inputSnapshotRef: artifact,
  });

  assert.ok(attempt.nodeAttemptId.startsWith("nattempt_"));
  assert.equal(attempt.nodeRunId, "nrun-1");
  assert.equal(attempt.attemptNo, 1);
  assert.equal(attempt.attemptKind, "initial");
  assert.equal(attempt.executorRef, "worker-1");
  assert.equal(attempt.inputSnapshotRef, artifact);
  assert.ok(attempt.startedAt.length > 0);
});

test("executable-contracts: createNodeAttempt accepts all NodeAttemptKind values", () => {
  const kinds = ["initial", "retry", "redrive", "recovery"] as const;

  for (const kind of kinds) {
    const attempt = createNodeAttempt({
      nodeRunId: "nrun-1",
      attemptNo: 1,
      attemptKind: kind,
      executorRef: "worker-1",
      inputSnapshotRef: artifact,
    });

    assert.equal(attempt.attemptKind, kind, `kind '${kind}' should be accepted`);
  }
});

test("executable-contracts: createNodeAttempt throws when attemptNo is less than 1", () => {
  assert.throws(
    () =>
      createNodeAttempt({
        nodeRunId: "nrun-1",
        attemptNo: 0,
        attemptKind: "initial",
        executorRef: "worker-1",
        inputSnapshotRef: artifact,
      }),
    ValidationError,
  );
});

test("executable-contracts: createNodeAttempt accepts optional completedAt", () => {
  const attempt = createNodeAttempt({
    nodeRunId: "nrun-1",
    attemptNo: 1,
    attemptKind: "initial",
    executorRef: "worker-1",
    inputSnapshotRef: artifact,
    completedAt: "2026-04-29T01:00:00.000Z",
  });

  assert.equal(attempt.completedAt, "2026-04-29T01:00:00.000Z");
});

// =============================================================================
// createAttemptLineage Tests
// =============================================================================

test("executable-contracts: createAttemptLineage creates valid lineage", () => {
  const lineage = createAttemptLineage({
    nodeRunId: "nrun-1",
    reason: "retry after failure",
    createdBy: "orchestrator",
  });

  assert.ok(lineage.attemptLineageId.startsWith("alineage_"));
  assert.equal(lineage.nodeRunId, "nrun-1");
  assert.equal(lineage.reason, "retry after failure");
  assert.equal(lineage.createdBy, "orchestrator");
});

test("executable-contracts: createAttemptLineage throws when reason is empty", () => {
  assert.throws(
    () =>
      createAttemptLineage({
        nodeRunId: "nrun-1",
        reason: "",
        createdBy: "orchestrator",
      }),
    ValidationError,
  );
});

test("executable-contracts: createAttemptLineage accepts optional previousAttemptId and nextAttemptId", () => {
  const lineage = createAttemptLineage({
    nodeRunId: "nrun-1",
    reason: "retry chain",
    createdBy: "system",
    previousAttemptId: "prev-attempt-1",
    nextAttemptId: "next-attempt-1",
  });

  assert.equal(lineage.previousAttemptId, "prev-attempt-1");
  assert.equal(lineage.nextAttemptId, "next-attempt-1");
});

// =============================================================================
// createSideEffectRecord Tests
// =============================================================================

test("executable-contracts: createSideEffectRecord creates valid record", () => {
  const record = createSideEffectRecord({
    harnessRunId: "hrun-1",
    nodeRunId: "nrun-1",
    nodeAttemptId: "nattempt-1",
    effectKind: "file_write",
    idempotencyKey: "idem-1",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
  });

  assert.ok(record.sideEffectId.startsWith("seffect_"));
  assert.equal(record.harnessRunId, "hrun-1");
  assert.equal(record.nodeRunId, "nrun-1");
  assert.equal(record.nodeAttemptId, "nattempt-1");
  assert.equal(record.effectKind, "file_write");
  assert.equal(record.status, "proposed");
  assert.equal(record.riskClass, "low");
});

test("executable-contracts: createSideEffectRecord accepts all SideEffectKind values", () => {
  const kinds = ["file_write", "external_api", "message_send", "transaction", "tool_commit", "other"] as const;

  for (const kind of kinds) {
    const record = createSideEffectRecord({
      harnessRunId: "hrun-1",
      nodeRunId: "nrun-1",
      nodeAttemptId: "nattempt-1",
      effectKind: kind,
      idempotencyKey: "idem-1",
      riskClass: "low",
      preCommitPolicyProofRef: artifact,
    });

    assert.equal(record.effectKind, kind, `kind '${kind}' should be accepted`);
  }
});

test("executable-contracts: createSideEffectRecord accepts all SideEffectStatus values", () => {
  const statuses = [
    "proposed", "approved", "reserved", "committing", "committed", "confirming",
    "confirmed", "ambiguous", "manual_review_required", "reconciling",
    "compensation_required", "compensating", "compensated", "failed", "revoked", "expired",
  ] as const;

  for (const status of statuses) {
    const record = createSideEffectRecord({
      harnessRunId: "hrun-1",
      nodeRunId: "nrun-1",
      nodeAttemptId: "nattempt-1",
      effectKind: "file_write",
      idempotencyKey: "idem-1",
      riskClass: "low",
      preCommitPolicyProofRef: artifact,
      status,
    });

    assert.equal(record.status, status, `status '${status}' should be accepted`);
  }
});

// =============================================================================
// createReconciliationRecord Tests
// =============================================================================

test("executable-contracts: createReconciliationRecord creates valid record", () => {
  const record = createReconciliationRecord({
    sideEffectId: "seff-1",
    probeKind: "http_check",
    externalObservedState: { status: 200 },
    result: "confirmed",
    nextAction: "mark_confirmed",
  });

  assert.ok(record.reconciliationId.startsWith("recon_"));
  assert.equal(record.sideEffectId, "seff-1");
  assert.equal(record.probeKind, "http_check");
  assert.deepEqual(record.externalObservedState, { status: 200 });
  assert.equal(record.result, "confirmed");
  assert.equal(record.nextAction, "mark_confirmed");
  assert.deepEqual(record.evidenceRefs, []);
});

test("executable-contracts: createReconciliationRecord accepts all result values", () => {
  const results = ["confirmed", "not_found", "ambiguous", "failed"] as const;

  for (const result of results) {
    const record = createReconciliationRecord({
      sideEffectId: "seff-1",
      probeKind: "test",
      externalObservedState: {},
      result,
      nextAction: "mark_confirmed",
    });

    assert.equal(record.result, result, `result '${result}' should be accepted`);
  }
});

test("executable-contracts: createReconciliationRecord accepts all nextAction values", () => {
  const actions = ["mark_confirmed", "retry_probe", "compensate", "escalate_hitl", "mark_failed"] as const;

  for (const action of actions) {
    const record = createReconciliationRecord({
      sideEffectId: "seff-1",
      probeKind: "test",
      externalObservedState: {},
      result: "confirmed",
      nextAction: action,
    });

    assert.equal(record.nextAction, action, `action '${action}' should be accepted`);
  }
});

// =============================================================================
// createCompensationRecord Tests
// =============================================================================

test("executable-contracts: createCompensationRecord creates valid record", () => {
  const record = createCompensationRecord({
    sideEffectId: "seff-1",
    harnessRunId: "hrun-1",
    planRef: artifact,
  });

  assert.ok(record.compensationId.startsWith("comp_"));
  assert.equal(record.sideEffectId, "seff-1");
  assert.equal(record.harnessRunId, "hrun-1");
  assert.equal(record.planRef, artifact);
  assert.equal(record.status, "planned");
  assert.deepEqual(record.evidenceRefs, []);
});

test("executable-contracts: createCompensationRecord accepts all status values", () => {
  const statuses = ["planned", "running", "succeeded", "failed", "requires_human"] as const;

  for (const status of statuses) {
    const record = createCompensationRecord({
      sideEffectId: "seff-1",
      harnessRunId: "hrun-1",
      planRef: artifact,
      status,
    });

    assert.equal(record.status, status, `status '${status}' should be accepted`);
  }
});

// =============================================================================
// createBudgetLedger Tests
// =============================================================================

test("executable-contracts: createBudgetLedger creates valid ledger", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "hrun-1",
    currency: "USD",
    hardCap: 1000,
  });

  assert.ok(ledger.budgetLedgerId.startsWith("bledger_"));
  assert.equal(ledger.tenantId, "tenant-1");
  assert.equal(ledger.harnessRunId, "hrun-1");
  assert.equal(ledger.currency, "USD");
  assert.equal(ledger.hardCap, 1000);
  assert.equal(ledger.reservedAmount, 0);
  assert.equal(ledger.settledAmount, 0);
  assert.equal(ledger.releasedAmount, 0);
  assert.equal(ledger.status, "open");
  assert.equal(ledger.version, 0);
});

test("executable-contracts: createBudgetLedger throws when hardCap is negative", () => {
  assert.throws(
    () =>
      createBudgetLedger({
        tenantId: "tenant-1",
        harnessRunId: "hrun-1",
        currency: "USD",
        hardCap: -100,
      }),
    ValidationError,
  );
});

test("executable-contracts: createBudgetLedger accepts all status values", () => {
  const statuses = ["open", "soft_cap_reached", "hard_cap_reached", "closed"] as const;

  for (const status of statuses) {
    const ledger = createBudgetLedger({
      tenantId: "tenant-1",
      harnessRunId: "hrun-1",
      currency: "USD",
      hardCap: 1000,
      status,
    });

    assert.equal(ledger.status, status, `status '${status}' should be accepted`);
  }
});

// =============================================================================
// createBudgetReservation Tests
// =============================================================================

test("executable-contracts: createBudgetReservation creates valid reservation", () => {
  const reservation = createBudgetReservation({
    budgetLedgerId: "bledger-1",
    harnessRunId: "hrun-1",
    amount: 50,
    resourceKind: "token",
    expiresAt: "2026-04-30T00:00:00.000Z",
  });

  assert.ok(reservation.budgetReservationId.startsWith("bresv_"));
  assert.equal(reservation.budgetLedgerId, "bledger-1");
  assert.equal(reservation.harnessRunId, "hrun-1");
  assert.equal(reservation.amount, 50);
  assert.equal(reservation.resourceKind, "token");
  assert.equal(reservation.status, "reserved");
});

test("executable-contracts: createBudgetReservation throws when amount is not positive", () => {
  assert.throws(
    () =>
      createBudgetReservation({
        budgetLedgerId: "bledger-1",
        harnessRunId: "hrun-1",
        amount: 0,
        resourceKind: "token",
        expiresAt: "2026-04-30T00:00:00.000Z",
      }),
    ValidationError,
  );
});

test("executable-contracts: createBudgetReservation accepts all BudgetResourceKind values", () => {
  const kinds = ["token", "tool", "api", "compute", "human", "side_effect", "other"] as const;

  for (const kind of kinds) {
    const reservation = createBudgetReservation({
      budgetLedgerId: "bledger-1",
      harnessRunId: "hrun-1",
      amount: 10,
      resourceKind: kind,
      expiresAt: "2026-04-30T00:00:00.000Z",
    });

    assert.equal(reservation.resourceKind, kind, `kind '${kind}' should be accepted`);
  }
});

// =============================================================================
// reserveBudgetHardCap Tests
// =============================================================================

test("executable-contracts: reserveBudgetHardCap creates reservation and updates ledger", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "hrun-1",
    currency: "USD",
    hardCap: 1000,
  });

  const result = reserveBudgetHardCap({
    ledger,
    amount: 100,
    resourceKind: "token",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: 0,
  });

  assert.equal(result.ledger.reservedAmount, 100);
  assert.equal(result.ledger.version, 1);
  assert.equal(result.reservation.amount, 100);
});

test("executable-contracts: reserveBudgetHardCap throws when version mismatch", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "hrun-1",
    currency: "USD",
    hardCap: 1000,
  });

  assert.throws(
    () =>
      reserveBudgetHardCap({
        ledger,
        amount: 100,
        resourceKind: "token",
        expiresAt: "2026-04-30T00:00:00.000Z",
        expectedVersion: 5, // wrong version
      }),
    ValidationError,
  );
});

test("executable-contracts: reserveBudgetHardCap throws when hard cap exceeded", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "hrun-1",
    currency: "USD",
    hardCap: 100,
  });

  assert.throws(
    () =>
      reserveBudgetHardCap({
        ledger,
        amount: 150,
        resourceKind: "token",
        expiresAt: "2026-04-30T00:00:00.000Z",
        expectedVersion: 0,
      }),
    ValidationError,
  );
});

test("executable-contracts: reserveBudgetHardCap sets hard_cap_reached status when exactly at limit", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "hrun-1",
    currency: "USD",
    hardCap: 100,
  });

  const result = reserveBudgetHardCap({
    ledger,
    amount: 100,
    resourceKind: "token",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: 0,
  });

  assert.equal(result.ledger.status, "hard_cap_reached");
});

// =============================================================================
// createBudgetSettlement Tests
// =============================================================================

test("executable-contracts: createBudgetSettlement creates valid settlement", () => {
  const settlement = createBudgetSettlement({
    budgetReservationId: "bresv-1",
    actualAmount: 45,
    settlementKind: "final",
  });

  assert.ok(settlement.budgetSettlementId.startsWith("bsettle_"));
  assert.equal(settlement.budgetReservationId, "bresv-1");
  assert.equal(settlement.actualAmount, 45);
  assert.equal(settlement.settlementKind, "final");
  assert.deepEqual(settlement.evidenceRefs, []);
});

test("executable-contracts: createBudgetSettlement accepts all settlementKind values", () => {
  const kinds = ["final", "partial", "release_unused", "correction"] as const;

  for (const kind of kinds) {
    const settlement = createBudgetSettlement({
      budgetReservationId: "bresv-1",
      actualAmount: 10,
      settlementKind: kind,
    });

    assert.equal(settlement.settlementKind, kind, `kind '${kind}' should be accepted`);
  }
});

test("executable-contracts: createBudgetSettlement throws when actualAmount is negative", () => {
  assert.throws(
    () =>
      createBudgetSettlement({
        budgetReservationId: "bresv-1",
        actualAmount: -10,
        settlementKind: "final",
      }),
    ValidationError,
  );
});

// =============================================================================
// createRunVersionLock Tests
// =============================================================================

test("executable-contracts: createRunVersionLock creates valid lock", () => {
  const lock = createRunVersionLock({
    harnessRunId: "hrun-1",
    runtimeProfileVersion: "v1.0.0",
  });

  assert.ok(lock.runVersionLockId.startsWith("rvlock_"));
  assert.equal(lock.harnessRunId, "hrun-1");
  assert.equal(lock.schemaVersion, "v4.3"); // default
  assert.equal(lock.runtimeProfileVersion, "v1.0.0");
  assert.deepEqual(lock.promptVersions, {});
  assert.deepEqual(lock.policyVersions, {});
  assert.deepEqual(lock.toolVersions, {});
  assert.deepEqual(lock.modelVersions, {});
  assert.deepEqual(lock.evalVersions, {});
  assert.deepEqual(lock.guardrailVersions, {});
  assert.deepEqual(lock.domainVersions, {});
});

test("executable-contracts: createRunVersionLock accepts version maps", () => {
  const lock = createRunVersionLock({
    harnessRunId: "hrun-1",
    runtimeProfileVersion: "v1.0.0",
    promptVersions: { prompt1: "v1" },
    policyVersions: { policy1: "v2" },
  });

  assert.deepEqual(lock.promptVersions, { prompt1: "v1" });
  assert.deepEqual(lock.policyVersions, { policy1: "v2" });
});

// =============================================================================
// createArtifactVersionLockSet Tests
// =============================================================================

test("executable-contracts: createArtifactVersionLockSet creates valid lock set", () => {
  const lockSet = createArtifactVersionLockSet({
    harnessRunId: "hrun-1",
    artifactLocks: [
      {
        artifactId: "artifact-1",
        version: "v1.0",
        hash: "hash1",
        storageUri: "s3://bucket/artifact-1",
        retentionPolicyRef: "policy-1",
      },
    ],
  });

  assert.ok(lockSet.artifactVersionLockSetId.startsWith("avlocks_"));
  assert.equal(lockSet.harnessRunId, "hrun-1");
  assert.equal(lockSet.artifactLocks.length, 1);
});

test("executable-contracts: createArtifactVersionLockSet throws when artifactLocks is empty", () => {
  assert.throws(
    () =>
      createArtifactVersionLockSet({
        harnessRunId: "hrun-1",
        artifactLocks: [],
      }),
    ValidationError,
  );
});

// =============================================================================
// createDecisionInputBundle Tests
// =============================================================================

test("executable-contracts: createDecisionInputBundle creates valid bundle", () => {
  const bundle = createDecisionInputBundle({
    harnessRunId: "hrun-1",
    decisionKind: "approve",
    riskClass: "low",
  });

  assert.ok(bundle.decisionInputBundleId.startsWith("dib_"));
  assert.equal(bundle.harnessRunId, "hrun-1");
  assert.equal(bundle.decisionKind, "approve");
  assert.equal(bundle.riskClass, "low");
  assert.deepEqual(bundle.contextRefs, []);
  assert.deepEqual(bundle.evidenceRefs, []);
  assert.deepEqual(bundle.policyFindings, []);
  assert.deepEqual(bundle.sideEffectRefs, []);
});

test("executable-contracts: createDecisionInputBundle accepts all decisionKind values", () => {
  const kinds = ["approve", "reject", "patch", "takeover", "resume", "abort", "retry", "replan"] as const;

  for (const kind of kinds) {
    const bundle = createDecisionInputBundle({
      harnessRunId: "hrun-1",
      decisionKind: kind,
      riskClass: "low",
    });

    assert.equal(bundle.decisionKind, kind, `kind '${kind}' should be accepted`);
  }
});

// =============================================================================
// createHarnessDecision Tests
// =============================================================================

test("executable-contracts: createHarnessDecision creates valid decision", () => {
  const decision = createHarnessDecision({
    decisionInputBundleId: "dib-1",
    decisionKind: "approve",
    decision: "accept",
    deciderType: "system",
    deciderRef: "policy-engine",
    reasonCode: "APPROVED",
  });

  assert.ok(decision.harnessDecisionId.startsWith("hdecision_"));
  assert.equal(decision.decisionInputBundleId, "dib-1");
  assert.equal(decision.decisionKind, "approve");
  assert.equal(decision.decision, "accept");
  assert.equal(decision.deciderType, "system");
  assert.equal(decision.deciderRef, "policy-engine");
  assert.equal(decision.reasonCode, "APPROVED");
});

test("executable-contracts: createHarnessDecision accepts all decision values", () => {
  const decisions = ["accept", "reject", "retry", "replan", "escalate", "abort", "takeover", "patch"] as const;

  for (const decision of decisions) {
    const result = createHarnessDecision({
      decisionInputBundleId: "dib-1",
      decisionKind: "approve",
      decision,
      deciderType: "system",
      deciderRef: "ref-1",
      reasonCode: "CODE",
    });

    assert.equal(result.decision, decision, `decision '${decision}' should be accepted`);
  }
});

test("executable-contracts: createHarnessDecision accepts all deciderType values", () => {
  const types = ["system", "policy", "evaluator", "human", "operator"] as const;

  for (const type of types) {
    const decision = createHarnessDecision({
      decisionInputBundleId: "dib-1",
      decisionKind: "approve",
      decision: "accept",
      deciderType: type,
      deciderRef: "ref-1",
      reasonCode: "CODE",
    });

    assert.equal(decision.deciderType, type, `type '${type}' should be accepted`);
  }
});

// =============================================================================
// createHumanResponsibilityRecord Tests
// =============================================================================

test("executable-contracts: createHumanResponsibilityRecord creates valid record", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const record = createHumanResponsibilityRecord({
    harnessDecisionId: "hdecision-1",
    humanActorRef: principal,
    responsibilityScope: "approval",
    acknowledgedRiskClass: "low",
    acknowledgementReceiptRef: artifact,
  });

  assert.ok(record.humanResponsibilityRecordId.startsWith("hrrecord_"));
  assert.equal(record.harnessDecisionId, "hdecision-1");
  assert.equal(record.humanActorRef, principal);
  assert.equal(record.responsibilityScope, "approval");
  assert.equal(record.acknowledgedRiskClass, "low");
  assert.ok(record.effectiveFrom.length > 0);
});

test("executable-contracts: createHumanResponsibilityRecord accepts all responsibilityScope values", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const scopes = ["approval", "override", "takeover", "patch", "resume", "abort", "compensation"] as const;

  for (const scope of scopes) {
    const record = createHumanResponsibilityRecord({
      harnessDecisionId: "hdecision-1",
      humanActorRef: principal,
      responsibilityScope: scope,
      acknowledgedRiskClass: "low",
      acknowledgementReceiptRef: artifact,
    });

    assert.equal(record.responsibilityScope, scope, `scope '${scope}' should be accepted`);
  }
});

test("executable-contracts: createHumanResponsibilityRecord throws for high-risk without expiresAt", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  assert.throws(
    () =>
      createHumanResponsibilityRecord({
        harnessDecisionId: "hdecision-1",
        humanActorRef: principal,
        responsibilityScope: "approval",
        acknowledgedRiskClass: "high",
        acknowledgementReceiptRef: artifact,
      }),
    ValidationError,
  );
});

test("executable-contracts: createHumanResponsibilityRecord throws for critical-risk without expiresAt", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  assert.throws(
    () =>
      createHumanResponsibilityRecord({
        harnessDecisionId: "hdecision-1",
        humanActorRef: principal,
        responsibilityScope: "approval",
        acknowledgedRiskClass: "critical",
        acknowledgementReceiptRef: artifact,
      }),
    ValidationError,
  );
});

test("executable-contracts: createHumanResponsibilityRecord accepts expiresAt for high-risk", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const record = createHumanResponsibilityRecord({
    harnessDecisionId: "hdecision-1",
    humanActorRef: principal,
    responsibilityScope: "approval",
    acknowledgedRiskClass: "high",
    acknowledgementReceiptRef: artifact,
    expiresAt: "2026-12-31T23:59:59.999Z",
  });

  assert.equal(record.acknowledgedRiskClass, "high");
  assert.equal(record.expiresAt, "2026-12-31T23:59:59.999Z");
});

// =============================================================================
// createPlatformFactEvent Tests
// =============================================================================

test("executable-contracts: createPlatformFactEvent creates valid event", () => {
  const event = createPlatformFactEvent({
    eventType: "platform.task.created",
    aggregateType: "Task",
    aggregateId: "task-123",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: { taskId: "task-123" },
  });

  assert.ok(event.eventId.startsWith("evt_"));
  assert.equal(event.eventType, "platform.task.created");
  assert.equal(event.aggregateType, "Task");
  assert.equal(event.aggregateSeq, 1);
  assert.equal(event.sourceOfTruth, "platform");
  assert.equal(event.schemaOwner, "platform-runtime");
});

test("executable-contracts: createPlatformFactEvent throws for non-platform event type", () => {
  assert.throws(
    () =>
      createPlatformFactEvent({
        eventType: "external.something.happened", // invalid namespace
        aggregateType: "Test",
        aggregateId: "test-1",
        aggregateSeq: 1,
        tenantId: "tenant-1",
        runId: "run-1",
        traceId: "trace-1",
        payload: {},
      }),
    ValidationError,
  );
});

// =============================================================================
// createOapeflirViewEvent Tests
// =============================================================================

test("executable-contracts: createOapeflirViewEvent creates valid event", () => {
  const event = createOapeflirViewEvent({
    eventType: "oapeflir.view.taskSummary",
    aggregateType: "Task",
    aggregateId: "task-123",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: { summary: "task summary" },
    derivedFromEventIds: ["evt-1", "evt-2"],
  });

  assert.ok(event.eventId.startsWith("evt_"));
  assert.equal(event.eventType, "oapeflir.view.taskSummary");
  assert.equal(event.sourceOfTruth, "projection");
  assert.equal(event.schemaOwner, "oapeflir-projection");
  assert.deepEqual(event.derivedFromEventIds, ["evt-1", "evt-2"]);
  assert.equal(event.projectionOnly, true);
});

test("executable-contracts: createOapeflirViewEvent accepts oapeflir.rationale event types", () => {
  const event = createOapeflirViewEvent({
    eventType: "oapeflir.rationale.decisionReason",
    aggregateType: "Decision",
    aggregateId: "dec-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: { reason: "because" },
    derivedFromEventIds: ["evt-1"],
  });

  assert.equal(event.eventType, "oapeflir.rationale.decisionReason");
});

test("executable-contracts: createOapeflirViewEvent throws for invalid namespace", () => {
  assert.throws(
    () =>
      createOapeflirViewEvent({
        eventType: "invalid.namespace.event",
        aggregateType: "Test",
        aggregateId: "test-1",
        aggregateSeq: 1,
        tenantId: "tenant-1",
        runId: "run-1",
        traceId: "trace-1",
        payload: {},
        derivedFromEventIds: ["evt-1"],
      }),
    ValidationError,
  );
});

test("executable-contracts: createOapeflirViewEvent throws when derivedFromEventIds is empty", () => {
  assert.throws(
    () =>
      createOapeflirViewEvent({
        eventType: "oapeflir.view.test",
        aggregateType: "Test",
        aggregateId: "test-1",
        aggregateSeq: 1,
        tenantId: "tenant-1",
        runId: "run-1",
        traceId: "trace-1",
        payload: {},
        derivedFromEventIds: [],
      }),
    ValidationError,
  );
});

// =============================================================================
// Type Guards Tests
// =============================================================================

test("executable-contracts: isPlatformFactEvent returns true for platform.* event", () => {
  const event = createPlatformFactEvent({
    eventType: "platform.task.completed",
    aggregateType: "Task",
    aggregateId: "task-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
  });

  assert.equal(isPlatformFactEvent(event), true);
});

test("executable-contracts: isPlatformFactEvent returns false for oapeflir event", () => {
  const event = createOapeflirViewEvent({
    eventType: "oapeflir.view.test",
    aggregateType: "Test",
    aggregateId: "test-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
    derivedFromEventIds: ["evt-1"],
  });

  assert.equal(isPlatformFactEvent(event), false);
});

test("executable-contracts: isOapeflirViewEvent returns true for oapeflir.view.* event", () => {
  const event = createOapeflirViewEvent({
    eventType: "oapeflir.view.taskSummary",
    aggregateType: "Task",
    aggregateId: "task-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
    derivedFromEventIds: ["evt-1"],
  });

  assert.equal(isOapeflirViewEvent(event), true);
});

test("executable-contracts: isOapeflirViewEvent returns true for oapeflir.rationale.* event", () => {
  const event = createOapeflirViewEvent({
    eventType: "oapeflir.rationale.decisionReason",
    aggregateType: "Decision",
    aggregateId: "dec-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
    derivedFromEventIds: ["evt-1"],
  });

  assert.equal(isOapeflirViewEvent(event), true);
});

test("executable-contracts: isOapeflirViewEvent returns false for platform event", () => {
  const event = createPlatformFactEvent({
    eventType: "platform.task.created",
    aggregateType: "Task",
    aggregateId: "task-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
  });

  assert.equal(isOapeflirViewEvent(event), false);
});

test("executable-contracts: canTruthConsumerConsume returns true for platform fact event", () => {
  const event = createPlatformFactEvent({
    eventType: "platform.task.completed",
    aggregateType: "Task",
    aggregateId: "task-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
  });

  assert.equal(canTruthConsumerConsume(event), true);
});

test("executable-contracts: canTruthConsumerConsume returns false for oapeflir view event", () => {
  const event = createOapeflirViewEvent({
    eventType: "oapeflir.view.test",
    aggregateType: "Test",
    aggregateId: "test-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
    derivedFromEventIds: ["evt-1"],
  });

  assert.equal(canTruthConsumerConsume(event), false);
});

// =============================================================================
// assertGraphPatchSafety Tests
// =============================================================================

test("executable-contracts: assertGraphPatchSafety passes for safe_append without affected nodes", () => {
  const patch: GraphPatch = {
    graphPatchId: "gpatch-1",
    harnessRunId: "hrun-1",
    baseGraphVersion: 1,
    newGraphVersion: 2,
    operations: [
      {
        operationId: "op-1",
        operationType: "add_node",
        targetRef: "new-node-1",
        payload: {},
      },
    ],
    affectedExecutedNodes: [],
    affectedSideEffects: [],
    compatibilityClass: "safe_append",
    policyProofRef: artifact,
    auditRef: artifact,
  };

  assert.doesNotThrow(() => assertGraphPatchSafety(patch));
});

test("executable-contracts: assertGraphPatchSafety throws for safe_append with affected nodes", () => {
  const patch: GraphPatch = {
    graphPatchId: "gpatch-1",
    harnessRunId: "hrun-1",
    baseGraphVersion: 1,
    newGraphVersion: 2,
    operations: [
      {
        operationId: "op-1",
        operationType: "add_node",
        targetRef: "new-node-1",
        payload: {},
      },
    ],
    affectedExecutedNodes: ["executed-node-1"],
    affectedSideEffects: [],
    compatibilityClass: "safe_append",
    policyProofRef: artifact,
    auditRef: artifact,
  };

  assert.throws(() => assertGraphPatchSafety(patch), ValidationError);
});

test("executable-contracts: assertGraphPatchSafety throws for safe_append with affected side effects but no compensation plan", () => {
  const patch: GraphPatch = {
    graphPatchId: "gpatch-1",
    harnessRunId: "hrun-1",
    baseGraphVersion: 1,
    newGraphVersion: 2,
    operations: [
      {
        operationId: "op-1",
        operationType: "add_node",
        targetRef: "new-node-1",
        payload: {},
      },
    ],
    affectedExecutedNodes: [],
    affectedSideEffects: ["side-effect-1"],
    compatibilityClass: "safe_append",
    policyProofRef: artifact,
    auditRef: artifact,
  };

  assert.throws(() => assertGraphPatchSafety(patch), ValidationError);
});

test("executable-contracts: assertGraphPatchSafety throws for mark_skipped on executed node", () => {
  const patch: GraphPatch = {
    graphPatchId: "gpatch-1",
    harnessRunId: "hrun-1",
    baseGraphVersion: 1,
    newGraphVersion: 2,
    operations: [
      {
        operationId: "op-1",
        operationType: "mark_skipped",
        targetRef: "executed-node-1",
        payload: {},
      },
    ],
    affectedExecutedNodes: ["executed-node-1"],
    affectedSideEffects: [],
    compatibilityClass: "requires_checkpoint_revalidation",
    policyProofRef: artifact,
    auditRef: artifact,
  };

  assert.throws(() => assertGraphPatchSafety(patch), ValidationError);
});
