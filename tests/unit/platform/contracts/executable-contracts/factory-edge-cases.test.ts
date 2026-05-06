/**
 * Executable Contracts - Domain Binding and Factory Edge Case Tests
 *
 * Tests for:
 * - normalizeDomainBindingId (legacy alias resolution)
 * - extractDomainBindingId / extractDomainBindingIdFromRef
 * - resolveDomainBindingId
 * - Factory function edge cases not covered in index.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import {
  normalizeDomainBindingId,
  createTaskDraft,
  createConfirmedTaskSpec,
  createHarnessRun,
  createPrincipalRef,
  createNodeAttempt,
  createBudgetLedger,
  createBudgetReservation,
  reserveBudgetHardCap,
  createHumanResponsibilityRecord,
  createPlatformFactEvent,
  createOapeflirViewEvent,
  type PrincipalRef,
  type ArtifactRef,
} from "../../../../../src/platform/contracts/executable-contracts/index.js";

// =============================================================================
// Helper Functions
// =============================================================================

const minimalPrincipal: PrincipalRef = {
  principalId: "user-1",
  tenantId: "tenant-1",
  roles: ["operator"],
};

const minimalArtifact: ArtifactRef = {
  artifactId: "artifact-1",
  uri: "artifact://artifact-1",
};

// =============================================================================
// normalizeDomainBindingId Tests
// =============================================================================

test("normalizeDomainBindingId returns canonical form for standard domain IDs", () => {
  assert.equal(normalizeDomainBindingId("coding"), "coding");
  assert.equal(normalizeDomainBindingId("project-management"), "project-management");
});

test("normalizeDomainBindingId applies legacy aliases", () => {
  assert.equal(normalizeDomainBindingId("engineering"), "coding");
  assert.equal(normalizeDomainBindingId("engineering_ops"), "coding");
  assert.equal(normalizeDomainBindingId("general_ops"), "project-management");
  assert.equal(normalizeDomainBindingId("content_production"), "creative-production");
  assert.equal(normalizeDomainBindingId("content"), "creative-production");
  assert.equal(normalizeDomainBindingId("design"), "creative-production");
  assert.equal(normalizeDomainBindingId("support"), "customer-service");
  assert.equal(normalizeDomainBindingId("devops"), "it-operations");
  assert.equal(normalizeDomainBindingId("analytics"), "data-engineering");
});

test("normalizeDomainBindingId is case-insensitive for aliases", () => {
  assert.equal(normalizeDomainBindingId("ENGINEERING"), "coding");
  assert.equal(normalizeDomainBindingId("Engineering"), "coding");
});

test("normalizeDomainBindingId normalizes whitespace and lowercase", () => {
  assert.equal(normalizeDomainBindingId("Project Management"), "project-management");
  assert.equal(normalizeDomainBindingId("  Data-Analysis  "), "data-analysis");
});

test("normalizeDomainBindingId returns unknown domains unchanged", () => {
  assert.equal(normalizeDomainBindingId("my-custom-domain"), "my-custom-domain");
  assert.equal(normalizeDomainBindingId("chatbot"), "chatbot");
});

test("normalizeDomainBindingId rejects empty string", () => {
  assert.throws(
    () => normalizeDomainBindingId(""),
    ValidationError,
  );
});

test("normalizeDomainBindingId rejects whitespace-only string", () => {
  assert.throws(
    () => normalizeDomainBindingId("   "),
    ValidationError,
  );
});

// =============================================================================
// createPrincipalRef Tests
// =============================================================================

test("createPrincipalRef creates valid principal", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["admin", "operator"],
  });

  assert.equal(principal.principalId, "user-1");
  assert.equal(principal.tenantId, "tenant-1");
  assert.deepEqual(principal.roles, ["admin", "operator"]);
});

test("createPrincipalRef defaults roles to empty array", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
  });

  assert.deepEqual(principal.roles, []);
});

test("createPrincipalRef includes optional displayName", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    displayName: "Test User",
  });

  assert.equal(principal.displayName, "Test User");
});

test("createPrincipalRef includes optional authorizationLevel", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
    authorizationLevel: "admin",
  });

  assert.equal(principal.authorizationLevel, "admin");
});

test("createPrincipalRef rejects empty principalId", () => {
  assert.throws(
    () =>
      createPrincipalRef({
        principalId: "",
        tenantId: "tenant-1",
      }),
    ValidationError,
  );
});

test("createPrincipalRef rejects whitespace principalId", () => {
  assert.throws(
    () =>
      createPrincipalRef({
        principalId: "   ",
        tenantId: "tenant-1",
      }),
    ValidationError,
  );
});

test("createPrincipalRef rejects empty tenantId", () => {
  assert.throws(
    () =>
      createPrincipalRef({
        principalId: "user-1",
        tenantId: "",
      }),
    ValidationError,
  );
});

// =============================================================================
// createTaskDraft Tests - Domain Binding Edge Cases
// =============================================================================

test("createTaskDraft derives domainId from normalizedIntent when not provided", () => {
  const draft = createTaskDraft({
    tenantId: "tenant-1",
    principal: minimalPrincipal,
    source: "nl",
    normalizedIntent: { domainId: "coding", goal: "build something" },
    riskPreview: { riskClass: "low", reasons: [] },
  });

  assert.equal(draft.domainId, "coding");
});

test("createConfirmedTaskSpec derives domainId from constraintPackRef", () => {
  const spec = createConfirmedTaskSpec({
    taskDraftId: "draft-1",
    tenantId: "tenant-1",
    principal: minimalPrincipal,
    goal: "build something",
    inputs: {},
    constraintPackRef: "constraint_pack:coding",
    riskClass: "low",
    idempotencyKey: "idem-1",
    traceId: "trace-1",
  });

  assert.equal(spec.domainId, "coding");
});

test("createTaskDraft rejects when no domain binding available", () => {
  assert.throws(
    () =>
      createTaskDraft({
        tenantId: "tenant-1",
        principal: minimalPrincipal,
        source: "nl",
        normalizedIntent: { goal: "build something" },
        riskPreview: { riskClass: "low", reasons: [] },
      }),
    ValidationError,
  );
});

test("createTaskDraft applies legacy alias to derived domainId", () => {
  const draft = createTaskDraft({
    tenantId: "tenant-1",
    principal: minimalPrincipal,
    source: "nl",
    normalizedIntent: { domainId: "engineering", goal: "build something" },
    riskPreview: { riskClass: "low", reasons: [] },
  });

  assert.equal(draft.domainId, "coding");
});

test("createTaskDraft respects explicit domainId override", () => {
  const draft = createTaskDraft({
    tenantId: "tenant-1",
    principal: minimalPrincipal,
    source: "nl",
    domainId: "project-management",
    normalizedIntent: { goal: "build something" },
    riskPreview: { riskClass: "low", reasons: [] },
  });

  assert.equal(draft.domainId, "project-management");
});

test("createTaskDraft generates taskDraftId with prefix when not provided", () => {
  const draft = createTaskDraft({
    tenantId: "tenant-1",
    principal: minimalPrincipal,
    source: "nl",
    domainId: "coding",
    normalizedIntent: { goal: "build something" },
    riskPreview: { riskClass: "low", reasons: [] },
  });

  assert.equal(draft.taskDraftId.startsWith("taskdraft_"), true);
});

test("createTaskDraft uses provided taskDraftId", () => {
  const draft = createTaskDraft({
    tenantId: "tenant-1",
    principal: minimalPrincipal,
    source: "nl",
    domainId: "coding",
    normalizedIntent: { goal: "build something" },
    riskPreview: { riskClass: "low", reasons: [] },
    taskDraftId: "custom-draft-id",
  });

  assert.equal(draft.taskDraftId, "custom-draft-id");
});

// =============================================================================
// createConfirmedTaskSpec - Domain Binding Edge Cases
// =============================================================================

test("createConfirmedTaskSpec derives domainId from constraintPackRef", () => {
  const spec = createConfirmedTaskSpec({
    taskDraftId: "draft-1",
    tenantId: "tenant-1",
    principal: minimalPrincipal,
    goal: "build feature",
    inputs: { feature: "xyz" },
    constraintPackRef: "constraint_pack:project-management",
    riskClass: "low",
    idempotencyKey: "idem-1",
    traceId: "trace-1",
  });

  assert.equal(spec.domainId, "project-management");
});

test("createConfirmedTaskSpec rejects high-risk without confirmation", () => {
  assert.throws(
    () =>
      createConfirmedTaskSpec({
        taskDraftId: "draft-1",
        tenantId: "tenant-1",
        principal: minimalPrincipal,
        goal: "build feature",
        inputs: {},
        constraintPackRef: "constraint-pack-1",
        riskClass: "high",
        idempotencyKey: "idem-1",
        traceId: "trace-1",
      }),
    ValidationError,
  );
});

test("createConfirmedTaskSpec accepts high-risk with confirmation", () => {
  const spec = createConfirmedTaskSpec({
    taskDraftId: "draft-1",
    tenantId: "tenant-1",
    principal: minimalPrincipal,
    goal: "build feature",
    inputs: {},
    constraintPackRef: "constraint-pack-1",
    riskClass: "high",
    confirmationReceipt: {
      receiptId: "receipt-1",
      confirmedBy: minimalPrincipal,
      riskClass: "high",
      confirmedAt: "2026-04-27T00:00:00.000Z",
    },
    idempotencyKey: "idem-1",
    traceId: "trace-1",
  });

  assert.equal(spec.riskClass, "high");
  assert.ok(spec.confirmationReceipt != null);
});

test("createConfirmedTaskSpec rejects empty goal", () => {
  assert.throws(
    () =>
      createConfirmedTaskSpec({
        taskDraftId: "draft-1",
        tenantId: "tenant-1",
        principal: minimalPrincipal,
        goal: "",
        inputs: {},
        constraintPackRef: "constraint-pack-1",
        riskClass: "low",
        idempotencyKey: "idem-1",
        traceId: "trace-1",
      }),
    ValidationError,
  );
});

test("createConfirmedTaskSpec rejects empty constraintPackRef", () => {
  assert.throws(
    () =>
      createConfirmedTaskSpec({
        taskDraftId: "draft-1",
        tenantId: "tenant-1",
        principal: minimalPrincipal,
        goal: "build feature",
        inputs: {},
        constraintPackRef: "",
        riskClass: "low",
        idempotencyKey: "idem-1",
        traceId: "trace-1",
      }),
    ValidationError,
  );
});

// =============================================================================
// createHarnessRun - Domain Binding Edge Cases
// =============================================================================

test("createHarnessRun derives domainId from constraintPackRef", () => {
  const run = createHarnessRun({
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "constraint_pack:data-engineering",
    versionLockId: "vlock-1",
    budgetLedgerId: "bledger-1",
  });

  assert.equal(run.domainId, "data-engineering");
});

test("createHarnessRun rejects when no domain binding available", () => {
  assert.throws(
    () =>
      createHarnessRun({
        tenantId: "tenant-1",
        confirmedTaskSpecId: "ctspec-1",
        requestEnvelopeId: "request-1",
        requestHash: "hash-1",
        constraintPackRef: "constraint-pack-without-domain",
        versionLockId: "vlock-1",
        budgetLedgerId: "bledger-1",
      }),
    ValidationError,
  );
});

test("createHarnessRun respects explicit domainId override", () => {
  const run = createHarnessRun({
    tenantId: "tenant-1",
    domainId: "healthcare",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "constraint_pack:general",
    versionLockId: "vlock-1",
    budgetLedgerId: "bledger-1",
  });

  assert.equal(run.domainId, "healthcare");
});

test("createHarnessRun generates harnessRunId with prefix when not provided", () => {
  const run = createHarnessRun({
    tenantId: "tenant-1",
    domainId: "coding",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "vlock-1",
    budgetLedgerId: "bledger-1",
  });

  assert.equal(run.harnessRunId.startsWith("hrun_"), true);
});

// =============================================================================
// createNodeAttempt Tests
// =============================================================================

test("createNodeAttempt rejects zero attemptNo", () => {
  assert.throws(
    () =>
      createNodeAttempt({
        nodeRunId: "nrun-1",
        attemptNo: 0,
        attemptKind: "initial",
        executorRef: "worker-1",
        inputSnapshotRef: minimalArtifact,
      }),
    ValidationError,
  );
});

test("createNodeAttempt rejects negative attemptNo", () => {
  assert.throws(
    () =>
      createNodeAttempt({
        nodeRunId: "nrun-1",
        attemptNo: -1,
        attemptKind: "initial",
        executorRef: "worker-1",
        inputSnapshotRef: minimalArtifact,
      }),
    ValidationError,
  );
});

test("createNodeAttempt accepts attemptNo starting at 1", () => {
  const attempt = createNodeAttempt({
    nodeRunId: "nrun-1",
    attemptNo: 1,
    attemptKind: "initial",
    executorRef: "worker-1",
    inputSnapshotRef: minimalArtifact,
  });

  assert.equal(attempt.attemptNo, 1);
});

test("createNodeAttempt accepts retry attemptKind", () => {
  const attempt = createNodeAttempt({
    nodeRunId: "nrun-1",
    attemptNo: 2,
    attemptKind: "retry",
    executorRef: "worker-1",
    inputSnapshotRef: minimalArtifact,
  });

  assert.equal(attempt.attemptKind, "retry");
});

test("createNodeAttempt accepts redrive attemptKind", () => {
  const attempt = createNodeAttempt({
    nodeRunId: "nrun-1",
    attemptNo: 3,
    attemptKind: "redrive",
    executorRef: "worker-1",
    inputSnapshotRef: minimalArtifact,
  });

  assert.equal(attempt.attemptKind, "redrive");
});

test("createNodeAttempt accepts recovery attemptKind", () => {
  const attempt = createNodeAttempt({
    nodeRunId: "nrun-1",
    attemptNo: 4,
    attemptKind: "recovery",
    executorRef: "worker-1",
    inputSnapshotRef: minimalArtifact,
  });

  assert.equal(attempt.attemptKind, "recovery");
});

test("createNodeAttempt generates nodeAttemptId when not provided", () => {
  const attempt = createNodeAttempt({
    nodeRunId: "nrun-1",
    attemptNo: 1,
    attemptKind: "initial",
    executorRef: "worker-1",
    inputSnapshotRef: minimalArtifact,
  });

  assert.equal(attempt.nodeAttemptId.startsWith("nattempt_"), true);
});

test("createNodeAttempt sets startedAt to nowIso when not provided", () => {
  const before = Date.now();
  const attempt = createNodeAttempt({
    nodeRunId: "nrun-1",
    attemptNo: 1,
    attemptKind: "initial",
    executorRef: "worker-1",
    inputSnapshotRef: minimalArtifact,
  });
  const after = Date.now();

  const startedAt = new Date(attempt.startedAt).getTime();
  assert.ok(startedAt >= before && startedAt <= after);
});

test("createNodeAttempt accepts optional completedAt", () => {
  const attempt = createNodeAttempt({
    nodeRunId: "nrun-1",
    attemptNo: 1,
    attemptKind: "initial",
    executorRef: "worker-1",
    inputSnapshotRef: minimalArtifact,
    completedAt: "2026-04-27T01:00:00.000Z",
  });

  assert.equal(attempt.completedAt, "2026-04-27T01:00:00.000Z");
});

// =============================================================================
// Budget Reservation Edge Cases
// =============================================================================

test("createBudgetLedger rejects negative hardCap", () => {
  assert.throws(
    () =>
      createBudgetLedger({
        tenantId: "tenant-1",
        harnessRunId: "run-1",
        currency: "USD",
        hardCap: -100,
      }),
    ValidationError,
  );
});

test("createBudgetLedger accepts zero hardCap", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 0,
  });

  assert.equal(ledger.hardCap, 0);
});

test("reserveBudgetHardCap rejects version mismatch", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  assert.throws(
    () =>
      reserveBudgetHardCap({
        ledger,
        amount: 10,
        resourceKind: "token",
        expiresAt: "2026-04-27T01:00:00.000Z",
        expectedVersion: 1, // Wrong version
      }),
    ValidationError,
  );
});

test("reserveBudgetHardCap rejects amount exceeding hardCap", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  assert.throws(
    () =>
      reserveBudgetHardCap({
        ledger,
        amount: 101,
        resourceKind: "token",
        expiresAt: "2026-04-27T01:00:00.000Z",
        expectedVersion: 0,
      }),
    ValidationError,
  );
});

test("reserveBudgetHardCap rejects negative amount", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  assert.throws(
    () =>
      reserveBudgetHardCap({
        ledger,
        amount: -10,
        resourceKind: "token",
        expiresAt: "2026-04-27T01:00:00.000Z",
        expectedVersion: 0,
      }),
    ValidationError,
  );
});

test("reserveBudgetHardCap rejects zero amount", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  assert.throws(
    () =>
      reserveBudgetHardCap({
        ledger,
        amount: 0,
        resourceKind: "token",
        expiresAt: "2026-04-27T01:00:00.000Z",
        expectedVersion: 0,
      }),
    ValidationError,
  );
});

test("reserveBudgetHardCap updates ledger status to hard_cap_reached when exactly at limit", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    reservedAmount: 50,
    settledAmount: 0,
    releasedAmount: 0,
    version: 0,
  });

  const result = reserveBudgetHardCap({
    ledger,
    amount: 50,
    resourceKind: "token",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
  });

  assert.equal(result.ledger.status, "hard_cap_reached");
  assert.equal(result.ledger.reservedAmount, 100);
});

test("reserveBudgetHardCap preserves softCap in ledger", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    softCap: 80,
    version: 0,
  });

  const result = reserveBudgetHardCap({
    ledger,
    amount: 20,
    resourceKind: "token",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
  });

  assert.equal(result.ledger.softCap, 80);
});

// =============================================================================
// createHumanResponsibilityRecord Edge Cases
// =============================================================================

test("createHumanResponsibilityRecord rejects critical risk without expiresAt", () => {
  assert.throws(
    () =>
      createHumanResponsibilityRecord({
        harnessDecisionId: "decision-1",
        humanActorRef: minimalPrincipal,
        responsibilityScope: "approval",
        acknowledgedRiskClass: "critical",
        acknowledgementReceiptRef: minimalArtifact,
      }),
    ValidationError,
  );
});

test("createHumanResponsibilityRecord rejects high risk without expiresAt", () => {
  assert.throws(
    () =>
      createHumanResponsibilityRecord({
        harnessDecisionId: "decision-1",
        humanActorRef: minimalPrincipal,
        responsibilityScope: "approval",
        acknowledgedRiskClass: "high",
        acknowledgementReceiptRef: minimalArtifact,
      }),
    ValidationError,
  );
});

test("createHumanResponsibilityRecord accepts critical risk with expiresAt", () => {
  const record = createHumanResponsibilityRecord({
    harnessDecisionId: "decision-1",
    humanActorRef: minimalPrincipal,
    responsibilityScope: "approval",
    acknowledgedRiskClass: "critical",
    acknowledgementReceiptRef: minimalArtifact,
    expiresAt: "2026-04-27T01:00:00.000Z",
  });

  assert.equal(record.acknowledgedRiskClass, "critical");
  assert.ok(record.expiresAt != null);
});

test("createHumanResponsibilityRecord accepts low risk without expiresAt", () => {
  const record = createHumanResponsibilityRecord({
    harnessDecisionId: "decision-1",
    humanActorRef: minimalPrincipal,
    responsibilityScope: "approval",
    acknowledgedRiskClass: "low",
    acknowledgementReceiptRef: minimalArtifact,
  });

  assert.equal(record.acknowledgedRiskClass, "low");
  assert.equal(record.expiresAt, undefined);
});

test("createHumanResponsibilityRecord accepts medium risk without expiresAt", () => {
  const record = createHumanResponsibilityRecord({
    harnessDecisionId: "decision-1",
    humanActorRef: minimalPrincipal,
    responsibilityScope: "override",
    acknowledgedRiskClass: "medium",
    acknowledgementReceiptRef: minimalArtifact,
  });

  assert.equal(record.acknowledgedRiskClass, "medium");
});

// =============================================================================
// createPlatformFactEvent Edge Cases
// =============================================================================

test("createPlatformFactEvent requires platform.* eventType", () => {
  assert.throws(
    () =>
      createPlatformFactEvent({
        eventType: "user.task.created",
        aggregateType: "Task",
        aggregateId: "task-1",
        aggregateSeq: 1,
        tenantId: "tenant-1",
        runId: "run-1",
        traceId: "trace-1",
        payload: { status: "created" },
      }),
    ValidationError,
  );
});

test("createPlatformFactEvent accepts platform.* eventType", () => {
  const event = createPlatformFactEvent({
    eventType: "platform.task.created",
    aggregateType: "Task",
    aggregateId: "task-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: { status: "created" },
  });

  assert.equal(event.eventType, "platform.task.created");
});

test("createPlatformFactEvent sets sourceOfTruth to platform", () => {
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

  assert.equal(event.sourceOfTruth, "platform");
});

test("createPlatformFactEvent defaults replayBehavior to replay_as_fact", () => {
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

  assert.equal(event.replayBehavior, "replay_as_fact");
});

test("createPlatformFactEvent accepts explicit replayBehavior override", () => {
  const event = createPlatformFactEvent({
    eventType: "platform.task.created",
    aggregateType: "Task",
    aggregateId: "task-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
    replayBehavior: "skip_side_effect",
  });

  assert.equal(event.replayBehavior, "skip_side_effect");
});

// =============================================================================
// createOapeflirViewEvent Edge Cases
// =============================================================================

test("createOapeflirViewEvent requires oapeflir.view.* eventType", () => {
  assert.throws(
    () =>
      createOapeflirViewEvent({
        eventType: "platform.task.created",
        aggregateType: "Task",
        aggregateId: "task-1",
        aggregateSeq: 1,
        tenantId: "tenant-1",
        runId: "run-1",
        traceId: "trace-1",
        payload: { summary: "task summary" },
        derivedFromEventIds: ["evt-1"],
      }),
    ValidationError,
  );
});

test("createOapeflirViewEvent requires oapeflir.rationale.* eventType", () => {
  const event = createOapeflirViewEvent({
    eventType: "oapeflir.rationale.decision_making",
    aggregateType: "Rationale",
    aggregateId: "rat-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: { reasoning: "because" },
    derivedFromEventIds: ["evt-1"],
  });

  assert.equal(event.eventType, "oapeflir.rationale.decision_making");
});

test("createOapeflirViewEvent rejects empty derivedFromEventIds", () => {
  assert.throws(
    () =>
      createOapeflirViewEvent({
        eventType: "oapeflir.view.task_summary",
        aggregateType: "TaskSummary",
        aggregateId: "ts-1",
        aggregateSeq: 1,
        tenantId: "tenant-1",
        runId: "run-1",
        traceId: "trace-1",
        payload: { summary: "task summary" },
        derivedFromEventIds: [], // Empty array
      }),
    ValidationError,
  );
});

test("createOapeflirViewEvent sets sourceOfTruth to projection", () => {
  const event = createOapeflirViewEvent({
    eventType: "oapeflir.view.run_lifecycle",
    aggregateType: "RunLifecycle",
    aggregateId: "rl-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: { stage: "running" },
    derivedFromEventIds: ["evt-1"],
  });

  assert.equal(event.sourceOfTruth, "projection");
});

test("createOapeflirViewEvent sets projectionOnly to true", () => {
  const event = createOapeflirViewEvent({
    eventType: "oapeflir.view.run_summary",
    aggregateType: "RunSummary",
    aggregateId: "rs-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
    derivedFromEventIds: ["evt-1", "evt-2"],
  });

  assert.equal(event.projectionOnly, true);
});

test("createOapeflirViewEvent defaults replayBehavior to simulate", () => {
  const event = createOapeflirViewEvent({
    eventType: "oapeflir.view.task_summary",
    aggregateType: "TaskSummary",
    aggregateId: "ts-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
    derivedFromEventIds: ["evt-1"],
  });

  assert.equal(event.replayBehavior, "simulate");
});

test("createOapeflirViewEvent accepts multiple derivedFromEventIds", () => {
  const event = createOapeflirViewEvent({
    eventType: "oapeflir.view.run_summary",
    aggregateType: "RunSummary",
    aggregateId: "rs-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
    derivedFromEventIds: ["evt-a", "evt-b", "evt-c"],
  });

  assert.equal(event.derivedFromEventIds.length, 3);
});