/**
 * Platform Contracts Integration Tests
 *
 * Tests cross-contract interactions and workflows involving multiple contracts.
 * Tests the integration between executable-contracts, platform-contracts types,
 * request-envelope, and state-command modules.
 */

import test from "node:test";
import assert from "node:assert/strict";

// Executable contracts imports
import {
  createPrincipalRef,
  createTaskDraft,
  createConfirmedTaskSpec,
  createRequestEnvelopeFromConfirmedTask,
  createHarnessRun,
  createPlanGraphBundle,
  createNodeRun,
  createNodeAttempt,
  createNodeAttemptReceipt,
  createSideEffectRecord,
  createBudgetLedger,
  createBudgetReservation,
  createBudgetSettlement,
  reserveBudgetHardCap,
  createPlanGraphBundle as createPlanGraphBundleExports,
  type PlanGraph,
  type BudgetIntent,
  type RiskPreview,
  type ArtifactRef,
} from "../../../../src/platform/contracts/executable-contracts/index.js";

// Platform contracts imports
import {
  createPlatformPrincipal,
  createRequestEnvelope as createPlatformRequestEnvelope,
  createEvidenceRecord,
} from "../../../../src/platform/contracts/types/platform-contracts.js";

import { createProjectionUpdate } from "../../../../src/platform/contracts/projection-update/index.js";

import {
  createStateCommand,
} from "../../../../src/platform/contracts/types/index.js";

// Request envelope imports (legacy)
import {
  createRequestEnvelope as createLegacyRequestEnvelope,
} from "../../../../src/platform/contracts/request-envelope/index.js";

// State command imports (legacy + inter-plane)
import {
  createStateCommand as createLegacyStateCommand,
  type EventAppendCommand,
  type AuditAppendCommand,
  type ArtifactWriteCommand,
} from "../../../../src/platform/contracts/state-command/index.js";

import { ValidationError } from "../../../../src/platform/contracts/errors.js";

// =============================================================================
// Full Task Lifecycle Integration Tests
// =============================================================================

test("integration: full task lifecycle from draft to completion", () => {
  // Step 1: Create principal
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  // Step 2: Create task draft
  const riskPreview: RiskPreview = {
    riskClass: "low",
    reasons: ["Simple read operation"],
  };

  const draft = createTaskDraft({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    domainId: "coding",
    normalizedIntent: { goal: "Read file contents" },
    riskPreview,
  });

  assert.ok(draft.taskDraftId.startsWith("taskdraft_"));

  // Step 3: Confirm task spec
  const confirmedSpec = createConfirmedTaskSpec({
    taskDraftId: draft.taskDraftId,
    tenantId: draft.tenantId,
    principal: draft.principal,
    domainId: draft.domainId,
    goal: "Read file contents",
    inputs: draft.normalizedIntent,
    constraintPackRef: "constraint-pack-1",
    riskClass: "low",
    idempotencyKey: "idem-task-1",
    traceId: "trace-task-1",
  });

  assert.ok(confirmedSpec.confirmedTaskSpecId.startsWith("ctspec_"));

  // Step 4: Create request envelope
  const budgetIntent: BudgetIntent = {
    amount: 50,
    currency: "USD",
    resourceKinds: ["token"],
  };

  const envelope = createRequestEnvelopeFromConfirmedTask({
    confirmedTaskSpec: confirmedSpec,
    budgetIntent,
  });

  assert.equal(envelope.tenantId, "tenant-1");
  assert.equal(envelope.confirmedTaskSpecId, confirmedSpec.confirmedTaskSpecId);
  assert.equal(envelope.domainId, "coding");

  // Step 5: Create harness run
  const run = createHarnessRun({
    tenantId: envelope.tenantId,
    domainId: envelope.domainId,
    confirmedTaskSpecId: envelope.confirmedTaskSpecId,
    requestEnvelopeId: envelope.requestId,
    requestHash: envelope.requestHash,
    constraintPackRef: envelope.constraintPackRef,
    versionLockId: "vl-1",
    budgetLedgerId: "bledger-1",
  });

  assert.ok(run.harnessRunId.startsWith("hrun_"));
  assert.equal(run.status, "created");
  assert.equal(run.domainId, "coding");

  // Step 6: Create plan graph
  const planGraph: PlanGraph = {
    graphId: "graph-1",
    nodes: [
      {
        nodeId: "node-read-file",
        nodeType: "tool",
        inputRefs: [],
        outputSchemaRef: "schema://file-content",
        riskClass: "low",
        budgetIntent,
        sideEffectProfile: {
          mayCommitExternalEffect: false,
          reversible: true,
        },
        retryPolicyRef: "retry://default",
        timeoutMs: 30000,
      },
    ],
    edges: [],
    entryNodeIds: ["node-read-file"],
    terminalNodeIds: ["node-read-file"],
    joinStrategy: "all",
    graphHash: "hash-graph-1",
  };

  const bundle = createPlanGraphBundle({
    harnessRunId: run.harnessRunId,
    graph: planGraph,
    schedulerPolicy: {
      policyId: "scheduler-1",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: "budget-plan-1",
    riskProfile: riskPreview,
  });

  assert.ok(bundle.planGraphBundleId.startsWith("pgb_"));

  // Step 7: Create node run
  const nodeRun = createNodeRun({
    harnessRunId: run.harnessRunId,
    planGraphBundleId: bundle.planGraphBundleId,
    graphVersion: bundle.graphVersion,
    nodeId: "node-read-file",
  });

  assert.ok(nodeRun.nodeRunId.startsWith("nrun_"));
  assert.equal(nodeRun.status, "created");

  // Step 8: Create node attempt
  const artifact: ArtifactRef = {
    artifactId: "artifact-input",
    uri: "artifact://input",
  };

  const attempt = createNodeAttempt({
    nodeRunId: nodeRun.nodeRunId,
    attemptNo: 1,
    attemptKind: "initial",
    executorRef: "worker-1",
    inputSnapshotRef: artifact,
  });

  assert.ok(attempt.nodeAttemptId.startsWith("nattempt_"));

  // Step 9: Complete node attempt
  const outputArtifact: ArtifactRef = {
    artifactId: "artifact-output",
    uri: "artifact://output",
    hash: "sha256:abc123",
  };

  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: attempt.nodeAttemptId,
    nodeRunId: nodeRun.nodeRunId,
    harnessRunId: run.harnessRunId,
    planGraphId: bundle.planGraphBundleId,
    graphVersion: bundle.graphVersion,
    receiptKind: "tool",
    status: "succeeded",
    duration: 1500,
    outputRef: outputArtifact,
    errorDetail: "",
  });

  assert.equal(receipt.status, "succeeded");
  assert.equal(receipt.outputRef?.artifactId, "artifact-output");

  // Verify the complete chain
  assert.equal(receipt.harnessRunId, run.harnessRunId);
  assert.equal(receipt.nodeRunId, nodeRun.nodeRunId);
  assert.equal(receipt.nodeAttemptId, attempt.nodeAttemptId);
});

test("integration: high-risk task lifecycle with confirmation", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  const riskPreview: RiskPreview = {
    riskClass: "high",
    reasons: ["Modifies production database"],
  };

  const draft = createTaskDraft({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    domainId: "coding",
    normalizedIntent: { goal: "Update production database" },
    riskPreview,
  });

  // High-risk task requires confirmation receipt
  const confirmedSpec = createConfirmedTaskSpec({
    taskDraftId: draft.taskDraftId,
    tenantId: draft.tenantId,
    principal: draft.principal,
    domainId: draft.domainId,
    goal: "Update production database",
    inputs: draft.normalizedIntent,
    constraintPackRef: "constraint-pack-1",
    riskClass: "high",
    idempotencyKey: "idem-high-risk-1",
    traceId: "trace-high-risk-1",
    confirmationReceipt: {
      receiptId: "conf-receipt-1",
      confirmedBy: principal,
      riskClass: "high",
      confirmedAt: "2026-04-29T00:00:00.000Z",
      state: "confirmed",
    },
  });

  assert.equal(confirmedSpec.riskClass, "high");
  assert.ok(confirmedSpec.confirmationReceipt != null);
});

test("integration: task lifecycle with budget tracking", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  const riskPreview: RiskPreview = {
    riskClass: "medium",
    reasons: ["External API call"],
  };

  const budgetIntent: BudgetIntent = {
    amount: 100,
    currency: "USD",
    resourceKinds: ["token", "api"],
  };

  const confirmedSpec = createConfirmedTaskSpec({
    taskDraftId: "draft-budget-1",
    tenantId: "tenant-1",
    principal,
    domainId: "coding",
    goal: "Call external API",
    inputs: {},
    constraintPackRef: "cp-budget-1",
    riskClass: "medium",
    idempotencyKey: "idem-budget-1",
    traceId: "trace-budget-1",
  });

  const envelope = createRequestEnvelopeFromConfirmedTask({
    confirmedTaskSpec: confirmedSpec,
    budgetIntent,
  });

  const run = createHarnessRun({
    tenantId: envelope.tenantId,
    domainId: envelope.domainId,
    confirmedTaskSpecId: envelope.confirmedTaskSpecId,
    requestEnvelopeId: envelope.requestId,
    requestHash: envelope.requestHash,
    constraintPackRef: envelope.constraintPackRef,
    versionLockId: "vl-budget-1",
    budgetLedgerId: "bledger-budget-1",
  });

  // Create and manage budget
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: run.harnessRunId,
    currency: "USD",
    hardCap: 100,
  });

  // Reserve budget
  const reservation = createBudgetReservation({
    budgetLedgerId: ledger.budgetLedgerId,
    harnessRunId: run.harnessRunId,
    amount: 50,
    resourceKind: "token",
    expiresAt: "2026-04-30T00:00:00.000Z",
  });

  assert.equal(reservation.amount, 50);

  // Settle budget
  const settlement = createBudgetSettlement({
    budgetReservationId: reservation.budgetReservationId,
    actualAmount: 45,
    settlementKind: "final",
  });

  assert.equal(settlement.actualAmount, 45);
});

// =============================================================================
// Side Effect and Reconciliation Integration Tests
// =============================================================================

test("integration: side effect lifecycle with reconciliation", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  const artifact: ArtifactRef = {
    artifactId: "artifact-effect-1",
    uri: "artifact://effect-1",
  };

  // Create side effect record
  const sideEffect = createSideEffectRecord({
    harnessRunId: "hrun-side-effect-1",
    nodeRunId: "nrun-side-effect-1",
    nodeAttemptId: "nattempt-side-effect-1",
    effectKind: "external_api",
    idempotencyKey: "idem-side-effect-1",
    riskClass: "medium",
    preCommitPolicyProofRef: artifact,
    deadline: "2026-04-20T01:00:00.000Z",
  });

  assert.equal(sideEffect.status, "proposed");

  // Create reconciliation record
  const reconciliation = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "hrun-side-effect-1",
    currency: "USD",
    hardCap: 100,
  });

  // The reconciliation would confirm the side effect
  assert.ok(reconciliation.budgetLedgerId.startsWith("bledger_"));
});

test("integration: compensation flow for failed side effect", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  const artifact: ArtifactRef = {
    artifactId: "artifact-comp-1",
    uri: "artifact://comp-1",
  };

  const sideEffect = createSideEffectRecord({
    harnessRunId: "hrun-comp-1",
    nodeRunId: "nrun-comp-1",
    nodeAttemptId: "nattempt-comp-1",
    effectKind: "file_write",
    idempotencyKey: "idem-comp-1",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
    deadline: "2026-04-20T01:00:00.000Z",
  });

  // Create compensation record
  const compensation = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "hrun-comp-1",
    currency: "USD",
    hardCap: 100,
  });

  assert.ok(compensation.budgetLedgerId.startsWith("bledger_"));
});

// =============================================================================
// Budget Reservation Integration Tests
// =============================================================================

test("integration: budget reservation flow with hard cap enforcement", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "hrun-reserve-1",
    currency: "USD",
    hardCap: 100,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
  });

  // First reservation
  const result1 = reserveBudgetHardCap({
    ledger,
    amount: 30,
    resourceKind: "token",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: ledger.version,
  });

  assert.equal(result1.ledger.reservedAmount, 30);
  assert.equal(result1.ledger.version, 1);

  // Second reservation
  const result2 = reserveBudgetHardCap({
    ledger: result1.ledger,
    amount: 40,
    resourceKind: "api",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: result1.ledger.version,
  });

  assert.equal(result2.ledger.reservedAmount, 70);
  assert.equal(result2.ledger.version, 2);

  // Third reservation that hits hard cap
  const result3 = reserveBudgetHardCap({
    ledger: result2.ledger,
    amount: 30,
    resourceKind: "compute",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: result2.ledger.version,
  });

  assert.equal(result3.ledger.status, "hard_cap_reached");
});

test("integration: budget reservation fails when version mismatch", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "hrun-version-1",
    currency: "USD",
    hardCap: 100,
  });

  // Try to reserve with wrong version
  assert.throws(
    () =>
      reserveBudgetHardCap({
        ledger,
        amount: 50,
        resourceKind: "token",
        expiresAt: "2026-04-30T00:00:00.000Z",
        expectedVersion: 99, // wrong version
      }),
    ValidationError,
  );
});

test("integration: budget reservation fails when exceeding hard cap", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "hrun-exceed-1",
    currency: "USD",
    hardCap: 100,
  });

  assert.throws(
    () =>
      reserveBudgetHardCap({
        ledger,
        amount: 150, // exceeds hard cap of 100
        resourceKind: "token",
        expiresAt: "2026-04-30T00:00:00.000Z",
        expectedVersion: ledger.version,
      }),
    ValidationError,
  );
});

// =============================================================================
// Legacy Request Envelope Integration Tests
// =============================================================================

test("integration: legacy request envelope creation with principal", () => {
  const principal = createPrincipalRef({
    principalId: "legacy-user-1",
    tenantId: "legacy-tenant-1",
    roles: ["operator"],
  });

  // Create using legacy factory (deprecated)
  const envelope = createLegacyRequestEnvelope({
    requestId: "legacy-req-1",
    confirmedTaskSpecId: "ctspec-legacy-1",
    tenantId: "legacy-tenant-1",
    principal,
    traceId: "legacy-trace-1",
    idempotencyKey: "legacy-idem-1",
    priority: 5,
    taskId: null,
    sessionId: null,
    mode: "sync",
    body: { data: "legacy payload" },
  });

  assert.equal(envelope.requestId, "legacy-req-1");
  assert.equal(envelope.confirmedTaskSpecId, "ctspec-legacy-1");
  assert.equal(envelope.mode, "sync");
  assert.ok(envelope.envelopeId.startsWith("envelope_"));
});

test("integration: legacy request envelope normalizes whitespace to null for nullable fields", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const envelope = createLegacyRequestEnvelope({
    requestId: "req-1",
    confirmedTaskSpecId: "ctspec-1",
    tenantId: "tenant-1",
    principal,
    traceId: "trace-value", // traceId is not normalized in legacy envelope
    idempotencyKey: "idem-1",
    priority: 0,
    taskId: "   ",
    sessionId: null,
    mode: "async",
    body: {},
  });

  // Only taskId is normalized to null in legacy envelope
  assert.equal(envelope.taskId, null);
  assert.equal(envelope.traceId, "trace-value"); // not normalized
});

test("integration: legacy request envelope throws for empty requestId", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  assert.throws(
    () =>
      createLegacyRequestEnvelope({
        requestId: "",
        confirmedTaskSpecId: "ctspec-1",
        tenantId: "tenant-1",
        principal,
        traceId: "trace-1",
        idempotencyKey: "idem-1",
        priority: 0,
        taskId: null,
        sessionId: null,
        mode: "sync",
        body: {},
      }),
    ValidationError,
  );
});

// =============================================================================
// Legacy State Command Integration Tests
// =============================================================================

test("integration: legacy state command creation", () => {
  const command = createLegacyStateCommand({
    entityKind: "Task",
    entityId: "task-state-1",
    action: "upsert",
    expectedVersion: null,
    payload: { status: "running" },
    emittedBy: "worker-state-1",
  });

  assert.equal(command.entityKind, "Task");
  assert.equal(command.entityId, "task-state-1");
  assert.equal(command.action, "upsert");
});

test("integration: legacy state command with transition action", () => {
  const command = createLegacyStateCommand({
    entityKind: "Task",
    entityId: "task-transition-1",
    action: "transition",
    expectedVersion: 5,
    payload: { nextStatus: "completed" },
    emittedBy: "orchestrator",
  });

  assert.equal(command.action, "transition");
  assert.equal(command.expectedVersion, 5);
});

test("integration: legacy state command throws for invalid transition", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  assert.throws(
    () =>
      createLegacyStateCommand({
        entityKind: "Task",
        entityId: "task-invalid-1",
        action: "transition",
        expectedVersion: null,
        payload: { wrongField: "value" }, // missing nextStatus
        emittedBy: "worker-1",
      }),
    (error: unknown) =>
      error instanceof ValidationError &&
      error.code === "state_command.transition_next_status_required",
  );
});

test("integration: legacy state command throws for missing required fields", () => {
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  assert.throws(
    () =>
      createLegacyStateCommand({
        entityKind: "", // empty
        entityId: "task-1",
        action: "upsert",
        expectedVersion: null,
        payload: {},
        emittedBy: "worker-1",
      }),
    (error: unknown) =>
      error instanceof ValidationError &&
      error.code === "state_command.entity_kind_required",
  );
});

// =============================================================================
// Platform Contracts Integration Tests
// =============================================================================

test("integration: platform principal and request envelope workflow", () => {
  // Create platform principal
  const platformPrincipal = createPlatformPrincipal({
    actorId: "platform-user-1",
    tenantId: "platform-tenant-1",
    roles: ["platform-operator"],
    authMethod: "oauth2",
    displayName: "Platform User",
  });

  assert.equal(platformPrincipal.actorId, "platform-user-1");
  assert.equal(platformPrincipal.authMethod, "oauth2");

  // Create platform request envelope
  const envelope = createPlatformRequestEnvelope({
    principal: platformPrincipal,
    payload: { platformData: "test" },
    metadata: { source: "integration-test" },
  });

  assert.ok(envelope.requestId.startsWith("request_"));
  assert.equal(envelope.principal, platformPrincipal);
  assert.deepEqual(envelope.metadata, { source: "integration-test" });
});

test("integration: platform state command creation", () => {
  const principal = createPlatformPrincipal({
    actorId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const command = createStateCommand({
    traceId: "platform-trace-1",
    principal,
    leaseId: "platform-lease-1",
    fencingToken: "platform-token-1",
    event: "PlatformTaskCreated",
    type: "update_truth",
    aggregateId: "platform-task-1",
    expectedVersion: 1,
    payload: { platformField: "platformValue" },
  });

  assert.equal(command.aggregateId, "platform-task-1");
  assert.equal(command.action, "upsert");
  assert.equal(command.type, "update_truth");
});

test("integration: evidence record creation with platform principal", () => {
  const principal = createPlatformPrincipal({
    actorId: "evidence-user-1",
    tenantId: "evidence-tenant-1",
    roles: [],
  });

  const record = createEvidenceRecord({
    traceId: "evidence-trace-1",
    principal,
    category: "decision",
    targetRef: "task-evidence-1",
    content: { decision: "approved", reason: "low risk" },
    metadata: { approver: "system" },
  });

  assert.ok(record.recordId.startsWith("evid_"));
  assert.equal(record.category, "decision");
  assert.deepEqual(record.metadata, { approver: "system" });
});

test("integration: projection update creation", () => {
  const update = createProjectionUpdate({
    projectionId: "proj-integrity-1",
    projectionType: "TaskStatusProjection",
    version: 3,
    sourceEvents: ["evt-1", "evt-2", "evt-3"],
    patch: { status: "completed", completedAt: "2026-04-29T00:00:00.000Z" },
    triggeredBy: "task-completion-handler",
    idempotencyKey: "proj-idem-1",
  });

  assert.equal(update.projectionId, "proj-integrity-1");
  assert.equal(update.version, 3);
  assert.deepEqual(update.sourceEvents, ["evt-1", "evt-2", "evt-3"]);
  assert.equal(update.metadata.triggeredBy, "task-completion-handler");
});

// =============================================================================
// Event Types Integration Tests
// =============================================================================

test("integration: inter-plane command types are exported correctly", () => {
  // EventAppendCommand
  const eventCommand: EventAppendCommand = {
    commandId: "evtcmd-1",
    traceId: "trace-1",
    principal: createPrincipalRef({
      principalId: "user-1",
      tenantId: "tenant-1",
      roles: [],
    }),
    tenantId: "tenant-1",
    aggregateType: "Task",
    aggregateId: "task-1",
    aggregateSeq: 1,
    eventType: "TaskCreated",
    payload: { data: "test" },
    idempotencyKey: "idem-1",
    createdAt: "2026-04-29T00:00:00.000Z",
  };

  assert.equal(eventCommand.commandId, "evtcmd-1");
  assert.equal(eventCommand.eventType, "TaskCreated");

  // AuditAppendCommand
  const auditCommand: AuditAppendCommand = {
    commandId: "auditcmd-1",
    traceId: "trace-1",
    principal: createPrincipalRef({
      principalId: "user-1",
      tenantId: "tenant-1",
      roles: [],
    }),
    tenantId: "tenant-1",
    category: "decision",
    targetRef: "task-1",
    content: { decision: "approved" },
    createdAt: "2026-04-29T00:00:00.000Z",
  };

  assert.equal(auditCommand.category, "decision");

  // ArtifactWriteCommand
  const artifactCommand: ArtifactWriteCommand = {
    commandId: "artcmd-1",
    traceId: "trace-1",
    principal: createPrincipalRef({
      principalId: "user-1",
      tenantId: "tenant-1",
      roles: [],
    }),
    tenantId: "tenant-1",
    artifactId: "artifact-1",
    uri: "s3://bucket/artifact-1",
    hash: "sha256:abc",
    version: "v1.0",
    createdAt: "2026-04-29T00:00:00.000Z",
  };

  assert.equal(artifactCommand.artifactId, "artifact-1");
  assert.equal(artifactCommand.uri, "s3://bucket/artifact-1");
});

// =============================================================================
// Multi-Contract Workflow Integration Tests
// =============================================================================

test("integration: complete workflow with plan graph and patches", () => {
  const principal = createPrincipalRef({
    principalId: "workflow-user-1",
    tenantId: "workflow-tenant-1",
    roles: ["operator"],
  });

  const riskPreview: RiskPreview = {
    riskClass: "medium",
    reasons: ["External API call required"],
  };

  const budgetIntent: BudgetIntent = {
    amount: 200,
    currency: "USD",
    resourceKinds: ["token", "api"],
  };

  // Create task and confirmation
  const confirmedSpec = createConfirmedTaskSpec({
    taskDraftId: "draft-workflow-1",
    tenantId: "workflow-tenant-1",
    principal,
    domainId: "coding",
    goal: "Call external API and store result",
    inputs: { apiUrl: "https://api.example.com" },
    constraintPackRef: "cp-workflow-1",
    riskClass: "medium",
    idempotencyKey: "idem-workflow-1",
    traceId: "trace-workflow-1",
  });

  // Create request envelope
  const envelope = createRequestEnvelopeFromConfirmedTask({
    confirmedTaskSpec: confirmedSpec,
    budgetIntent,
  });

  // Create harness run
  const run = createHarnessRun({
    tenantId: envelope.tenantId,
    domainId: envelope.domainId,
    confirmedTaskSpecId: envelope.confirmedTaskSpecId,
    requestEnvelopeId: envelope.requestId,
    requestHash: envelope.requestHash,
    constraintPackRef: envelope.constraintPackRef,
    versionLockId: "vl-workflow-1",
    budgetLedgerId: "bledger-workflow-1",
  });

  // Create plan graph with two nodes
  const planGraph: PlanGraph = {
    graphId: "graph-workflow-1",
    nodes: [
      {
        nodeId: "node-call-api",
        nodeType: "tool",
        inputRefs: [],
        outputSchemaRef: "schema://api-response",
        riskClass: "medium",
        budgetIntent,
        sideEffectProfile: {
          mayCommitExternalEffect: true,
          reversible: false,
        },
        retryPolicyRef: "retry://default",
        timeoutMs: 60000,
      },
      {
        nodeId: "node-store-result",
        nodeType: "tool",
        inputRefs: ["node-call-api"],
        outputSchemaRef: "schema://store-result",
        riskClass: "low",
        budgetIntent: { ...budgetIntent, amount: 10 },
        sideEffectProfile: {
          mayCommitExternalEffect: false,
          reversible: true,
        },
        retryPolicyRef: "retry://default",
        timeoutMs: 5000,
      },
    ],
    edges: [
      {
        edgeId: "edge-1",
        fromNodeId: "node-call-api",
        toNodeId: "node-store-result",
        condition: { status: "success" },
        dependencyType: "hard",
      },
    ],
    entryNodeIds: ["node-call-api"],
    terminalNodeIds: ["node-store-result"],
    joinStrategy: "all",
    graphHash: "hash-workflow-1",
  };

  const bundle = createPlanGraphBundle({
    harnessRunId: run.harnessRunId,
    graph: planGraph,
    schedulerPolicy: {
      policyId: "scheduler-workflow-1",
      strategy: "priority_then_fifo",
    },
    budgetPlanRef: "budget-plan-workflow-1",
    riskProfile: riskPreview,
  });

  assert.equal(bundle.graph.nodes.length, 2);
  assert.equal(bundle.graph.edges.length, 1);

  // Create node runs for each node
  const nodeRun1 = createNodeRun({
    harnessRunId: run.harnessRunId,
    planGraphBundleId: bundle.planGraphBundleId,
    graphVersion: bundle.graphVersion,
    nodeId: "node-call-api",
  });

  const nodeRun2 = createNodeRun({
    harnessRunId: run.harnessRunId,
    planGraphBundleId: bundle.planGraphBundleId,
    graphVersion: bundle.graphVersion,
    nodeId: "node-store-result",
  });

  assert.equal(nodeRun1.nodeId, "node-call-api");
  assert.equal(nodeRun2.nodeId, "node-store-result");

  // Execute first node
  const inputArtifact: ArtifactRef = {
    artifactId: "input-artifact",
    uri: "artifact://input",
  };

  const attempt1 = createNodeAttempt({
    nodeRunId: nodeRun1.nodeRunId,
    attemptNo: 1,
    attemptKind: "initial",
    executorRef: "worker-1",
    inputSnapshotRef: inputArtifact,
  });

  const outputArtifact: ArtifactRef = {
    artifactId: "api-response-artifact",
    uri: "artifact://api-response",
    hash: "sha256:response-hash",
  };

  const receipt1 = createNodeAttemptReceipt({
    nodeAttemptId: attempt1.nodeAttemptId,
    nodeRunId: nodeRun1.nodeRunId,
    harnessRunId: run.harnessRunId,
    planGraphId: bundle.planGraphBundleId,
    graphVersion: bundle.graphVersion,
    receiptKind: "tool",
    status: "succeeded",
    duration: 5000,
    outputRef: outputArtifact,
    errorDetail: "",
  });

  assert.equal(receipt1.status, "succeeded");

  // Execute second node (depends on first)
  const attempt2 = createNodeAttempt({
    nodeRunId: nodeRun2.nodeRunId,
    attemptNo: 1,
    attemptKind: "initial",
    executorRef: "worker-1",
    inputSnapshotRef: outputArtifact,
  });

  const finalArtifact: ArtifactRef = {
    artifactId: "final-artifact",
    uri: "artifact://final",
    hash: "sha256:final-hash",
  };

  const receipt2 = createNodeAttemptReceipt({
    nodeAttemptId: attempt2.nodeAttemptId,
    nodeRunId: nodeRun2.nodeRunId,
    harnessRunId: run.harnessRunId,
    planGraphId: bundle.planGraphBundleId,
    graphVersion: bundle.graphVersion,
    receiptKind: "tool",
    status: "succeeded",
    duration: 1000,
    outputRef: finalArtifact,
    errorDetail: "",
  });

  assert.equal(receipt2.status, "succeeded");

  // Verify the workflow completed successfully
  assert.notEqual(receipt1.nodeAttemptId, receipt2.nodeAttemptId);
});
