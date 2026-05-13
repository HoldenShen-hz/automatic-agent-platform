import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import {
  CANONICAL_CONTRACT_NAMES,
  CONTRACT_JSON_SCHEMAS,
  EXECUTABLE_CONTRACT_NAMES,
  EXECUTABLE_CONTRACT_PACKAGE,
  canTruthConsumerConsume,
  createBudgetLedger,
  createBudgetReservation,
  createBudgetSettlement,
  createCompensationRecord,
  createConfirmedTaskSpec,
  createDecisionInputBundle,
  createArtifactVersionLockSet,
  createAttemptLineage,
  createGraphPatch,
  createHarnessDecision,
  createHarnessRun,
  createHumanResponsibilityRecord,
  createNodeAttempt,
  createNodeAttemptReceipt,
  createNodeRun,
  createOapeflirViewEvent,
  createPlanGraphBundle,
  createPlatformFactEvent,
  createPrincipalRef,
  createReconciliationRecord,
  createRequestEnvelopeFromConfirmedTask,
  createRunVersionLock,
  createSideEffectRecord,
  createTaskDraft,
  reserveBudgetHardCap,
  validateExecutableContract,
  type ArtifactRef,
  type BudgetIntent,
  type PlanGraph,
} from "../../../../../src/platform/contracts/executable-contracts/index.js";

const principal = createPrincipalRef({
  principalId: "user-1",
  tenantId: "tenant-1",
  roles: ["operator"],
});

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

const graph: PlanGraph = {
  graphId: "graph-1",
  nodes: [
    {
      nodeId: "node-1",
      nodeType: "tool",
      inputRefs: [],
      outputSchemaRef: "schema://output",
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
  entryNodeIds: ["node-1"],
  terminalNodeIds: ["node-1"],
  joinStrategy: "all",
  graphHash: "graph-hash",
};

test("v4.3 registry lists all frozen canonical contracts", () => {
  assert.deepEqual(
    [...CANONICAL_CONTRACT_NAMES],
    [
      "TaskDraft",
      "ConfirmedTaskSpec",
      "RequestEnvelope",
      "HarnessRun",
      "PlanGraphBundle",
      "PlanGraph",
      "PlanNode",
      "PlanEdge",
      "GraphPatch",
      "GraphPatchOperation",
      "NodeRun",
      "NodeAttempt",
      "AttemptLineage",
      "NodeAttemptReceipt",
      "SideEffectRecord",
      "ReconciliationRecord",
      "CompensationRecord",
      "BudgetLedger",
      "BudgetReservation",
      "BudgetSettlement",
      "RunVersionLock",
      "ArtifactVersionLockSet",
      "DecisionInputBundle",
      "HarnessDecision",
      "HumanResponsibilityRecord",
      "EventEnvelope",
      "PlatformFactEvent",
      "OapeflirViewEvent",
    ],
  );
});

test("v4.3 executable contract package exposes Zod and JSON Schema entries for every frozen contract", () => {
  assert.deepEqual([...EXECUTABLE_CONTRACT_NAMES], [...CANONICAL_CONTRACT_NAMES]);

  for (const contractName of CANONICAL_CONTRACT_NAMES) {
    const descriptor = EXECUTABLE_CONTRACT_PACKAGE[contractName];
    assert.equal(descriptor.name, contractName);
    assert.equal(descriptor.schemaVersion, "v4.3");
    assert.equal(typeof descriptor.zodSchema.safeParse, "function");
    assert.equal(descriptor.jsonSchema.title, contractName);
    assert.equal(descriptor.jsonSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.ok(CONTRACT_JSON_SCHEMAS[contractName].required.length > 0);
  }
});

test("intake factories enforce confirmation before request envelope", () => {
  const draft = createTaskDraft({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    domainId: "platform_contracts",
    normalizedIntent: { goal: "ship contract freeze", domainId: "platform_contracts" },
    riskPreview: { riskClass: "high", reasons: ["external side effect"] },
  });

  assert.throws(
    () =>
      createConfirmedTaskSpec({
        taskDraftId: draft.taskDraftId,
        tenantId: "tenant-1",
        principal,
        goal: "ship",
        inputs: {},
        constraintPackRef: "constraint-pack-1",
        riskClass: "high",
        idempotencyKey: "idem-1",
        traceId: "trace-1",
      }),
    ValidationError,
  );

  const confirmed = createConfirmedTaskSpec({
    taskDraftId: draft.taskDraftId,
    tenantId: "tenant-1",
    principal,
    goal: "ship",
    inputs: {},
    constraintPackRef: "constraint-pack-1",
    riskClass: "high",
    confirmationReceipt: {
      receiptId: "receipt-1",
      confirmedBy: principal,
      riskClass: "high",
      confirmedAt: "2026-04-27T00:00:00.000Z",
      state: "confirmed",
    },
    idempotencyKey: "idem-1",
    traceId: "trace-1",
  });

  const envelope = createRequestEnvelopeFromConfirmedTask({
    confirmedTaskSpec: confirmed,
    budgetIntent,
    requestHash: "request-hash-1",
  });

  const validatedDraft = validateExecutableContract("TaskDraft", draft);
  const validatedConfirmed = validateExecutableContract("ConfirmedTaskSpec", confirmed);
  const validatedEnvelope = validateExecutableContract("RequestEnvelope", envelope);

  assert.equal(validatedDraft.taskDraftId, draft.taskDraftId);
  assert.equal(validatedDraft.tenantId, draft.tenantId);
  assert.equal(validatedConfirmed.confirmedTaskSpecId, confirmed.confirmedTaskSpecId);
  assert.equal(validatedConfirmed.confirmationReceipt.receiptId, "receipt-1");
  assert.equal(validatedEnvelope.requestId, envelope.requestId);
  assert.equal(validatedEnvelope.confirmedTaskSpecId, confirmed.confirmedTaskSpecId);
  assert.throws(() => validateExecutableContract("RequestEnvelope", { requestId: "" }), ValidationError);

  assert.equal(envelope.confirmedTaskSpecId, confirmed.confirmedTaskSpecId);
  assert.equal(envelope.constraintPackRef, "constraint-pack-1");
  assert.equal(envelope.idempotencyKey, "idem-1");
});

test("runtime factories create harness, graph, node, attempt, and receipt records", () => {
  const run = createHarnessRun({
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
  });

  const bundle = createPlanGraphBundle({
    harnessRunId: run.harnessRunId,
    graph,
    schedulerPolicy: {
      policyId: "scheduler-1",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: "budget-plan-1",
    riskProfile: { riskClass: "low", reasons: [] },
  });

  const nodeRun = createNodeRun({
    harnessRunId: run.harnessRunId,
    planGraphBundleId: bundle.planGraphBundleId,
    graphVersion: bundle.graphVersion,
    nodeId: "node-1",
  });

  const attempt = createNodeAttempt({
    nodeRunId: nodeRun.nodeRunId,
    attemptNo: 1,
    attemptKind: "initial",
    executorRef: "worker-1",
    inputSnapshotRef: artifact,
  });
  const lineage = createAttemptLineage({
    nodeRunId: nodeRun.nodeRunId,
    nextAttemptId: attempt.nodeAttemptId,
    reason: "initial attempt",
    createdBy: "scheduler",
  });

  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: attempt.nodeAttemptId,
    nodeRunId: nodeRun.nodeRunId,
    receiptKind: "tool",
    status: "succeeded",
    outputRef: artifact,
  });

  assert.equal(run.status, "created");
  assert.equal(bundle.graph.nodes.length, 1);
  assert.equal(nodeRun.attemptCount, 0);
  assert.equal(attempt.attemptNo, 1);
  assert.equal(lineage.nextAttemptId, attempt.nodeAttemptId);
  assert.equal(receipt.status, "succeeded");
});

test("SideEffectRecord factory preserves rollback handler and deadline metadata", () => {
  const record = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api_call",
    idempotencyKey: "idem-side-effect-1",
    riskClass: "high",
    preCommitPolicyProofRef: artifact,
    deadline: "2026-05-01T00:00:00.000Z",
    rollbackHandler: {
      handler: "workflow.rollback.refund",
      timeout: 30_000,
    },
    compensationPlan: "comp-plan-1",
  });

  assert.equal(record.rollbackHandler?.handler, "workflow.rollback.refund");
  assert.equal(record.rollbackHandler?.timeout, 30_000);
  assert.equal(record.deadline, "2026-05-01T00:00:00.000Z");
});

test("HarnessRun status schema matches the canonical 13-state runtime model", async () => {
  const { HarnessRunStatusSchema } = await import("../../../../../src/platform/contracts/executable-contracts/schemas.js");

  const canonicalStatuses = [
    "created",
    "admitted",
    "planning",
    "ready",
    "running",
    "pausing",
    "paused",
    "resuming",
    "replanning",
    "compensating",
    "completed",
    "failed",
    "aborted",
  ];
  const legacyStatuses = [
    "idle",
    "executing",
    "sleeping",
    "initializing",
    "awaiting_approval",
    "rolling_back",
    "suspended",
    "draining",
  ];

  for (const status of canonicalStatuses) {
    assert.equal(HarnessRunStatusSchema.safeParse(status).success, true, `expected canonical status ${status} to be accepted`);
  }
  for (const status of legacyStatuses) {
    assert.equal(HarnessRunStatusSchema.safeParse(status).success, false, `expected legacy status ${status} to be rejected`);
  }
});

test("GraphPatch requires version advance and at least one operation", () => {
  assert.throws(
    () =>
      createGraphPatch({
        harnessRunId: "run-1",
        baseGraphVersion: 2,
        newGraphVersion: 2,
        operations: [
          {
            operationId: "op-1",
            operationType: "add_node",
            targetRef: "node-2",
            payload: {},
          },
        ],
        policyProofRef: artifact,
        auditRef: artifact,
      }),
    ValidationError,
  );

  const patch = createGraphPatch({
    harnessRunId: "run-1",
    baseGraphVersion: 1,
    newGraphVersion: 2,
    operations: [
      {
        operationId: "op-1",
        operationType: "add_failure_path",
        targetRef: "node-2",
        payload: {},
      },
    ],
    policyProofRef: artifact,
    auditRef: artifact,
  });

  assert.equal(patch.compatibilityClass, "safe_append");
});

test("GraphPatch safety rejects silent rewrites of executed nodes and side effects", () => {
  assert.throws(
    () =>
      createGraphPatch({
        harnessRunId: "run-1",
        baseGraphVersion: 1,
        newGraphVersion: 2,
        operations: [
          {
            operationId: "op-1",
            operationType: "add_node",
            targetRef: "node-2",
            payload: {},
          },
        ],
        affectedExecutedNodes: ["node-1"],
        compatibilityClass: "safe_append",
        policyProofRef: artifact,
        auditRef: artifact,
      }),
    ValidationError,
  );

  assert.throws(
    () =>
      createGraphPatch({
        harnessRunId: "run-1",
        baseGraphVersion: 1,
        newGraphVersion: 2,
        operations: [
          {
            operationId: "op-1",
            operationType: "mark_skipped",
            targetRef: "node-1",
            payload: {},
          },
        ],
        affectedExecutedNodes: ["node-1"],
        compatibilityClass: "requires_human_approval",
        policyProofRef: artifact,
        auditRef: artifact,
      }),
    ValidationError,
  );

  assert.throws(
    () =>
      createGraphPatch({
        harnessRunId: "run-1",
        baseGraphVersion: 1,
        newGraphVersion: 2,
        operations: [
          {
            operationId: "op-1",
            operationType: "add_failure_path",
            targetRef: "node-2",
            payload: {},
          },
        ],
        affectedSideEffects: ["side-effect-1"],
        compatibilityClass: "requires_human_approval",
        policyProofRef: artifact,
        auditRef: artifact,
      }),
    ValidationError,
  );

  const patch = createGraphPatch({
    harnessRunId: "run-1",
    baseGraphVersion: 1,
    newGraphVersion: 2,
    operations: [
      {
        operationId: "op-1",
        operationType: "add_compensation_node",
        targetRef: "node-2",
        payload: {},
      },
    ],
    affectedSideEffects: ["side-effect-1"],
    compatibilityClass: "requires_human_approval",
    compensationPlanRef: artifact,
    policyProofRef: artifact,
    auditRef: artifact,
  });

  assert.equal(patch.compensationPlanRef?.artifactId, "artifact-1");
});

test("budget and HITL factories enforce v4.3 safety defaults", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 1000,
  });
  const reservation = createBudgetReservation({
    budgetLedgerId: ledger.budgetLedgerId,
    harnessRunId: "run-1",
    amount: 10,
    resourceKind: "token",
    expiresAt: "2026-04-27T01:00:00.000Z",
  });
  const settlement = createBudgetSettlement({
    budgetReservationId: reservation.budgetReservationId,
    actualAmount: 8,
    settlementKind: "final",
  });
  const versionLock = createRunVersionLock({
    harnessRunId: "run-1",
    runtimeProfileVersion: "runtime-profile-1",
  });
  const artifactLocks = createArtifactVersionLockSet({
    harnessRunId: "run-1",
    artifactLocks: [
      {
        artifactId: "artifact-1",
        version: "v1",
        hash: "sha256:test",
        storageUri: "artifact://artifact-1",
        retentionPolicyRef: "retention://audit",
      },
    ],
  });
  const inputBundle = createDecisionInputBundle({
    harnessRunId: "run-1",
    decisionKind: "approve",
    riskClass: "critical",
    evidenceRefs: [artifact],
  });
  const decision = createHarnessDecision({
    decisionInputBundleId: inputBundle.decisionInputBundleId,
    decisionKind: "approve",
    decision: "accept",
    deciderType: "human",
    deciderRef: "user-1",
    reasonCode: "approved_by_operator",
  });

  assert.throws(
    () =>
      createHumanResponsibilityRecord({
        harnessDecisionId: decision.harnessDecisionId,
        humanActorRef: principal,
        responsibilityScope: "approval",
        acknowledgedRiskClass: "critical",
        acknowledgementReceiptRef: artifact,
      }),
    ValidationError,
  );

  const responsibility = createHumanResponsibilityRecord({
    harnessDecisionId: decision.harnessDecisionId,
    humanActorRef: principal,
    responsibilityScope: "approval",
    acknowledgedRiskClass: "critical",
    acknowledgementReceiptRef: artifact,
    expiresAt: "2026-04-27T01:00:00.000Z",
  });

  assert.equal(reservation.status, "reserved");
  assert.equal(settlement.actualAmount, 8);
  assert.equal(versionLock.schemaVersion, "v4.3");
  assert.equal(artifactLocks.artifactLocks.length, 1);
  assert.equal(responsibility.responsibilityScope, "approval");
});

test("budget hard-cap reservation uses version CAS and rejects over-reservation", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  const first = reserveBudgetHardCap({
    ledger,
    amount: 60,
    resourceKind: "token",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
  });

  assert.equal(first.ledger.reservedAmount, 60);
  assert.equal(first.ledger.version, 1);
  assert.equal(first.reservation.amount, 60);

  assert.throws(
    () =>
      reserveBudgetHardCap({
        ledger: first.ledger,
        amount: 10,
        resourceKind: "tool",
        expiresAt: "2026-04-27T01:00:00.000Z",
        expectedVersion: 0,
      }),
    ValidationError,
  );

  assert.throws(
    () =>
      reserveBudgetHardCap({
        ledger: first.ledger,
        amount: 41,
        resourceKind: "tool",
        expiresAt: "2026-04-27T01:00:00.000Z",
        expectedVersion: 1,
      }),
    ValidationError,
  );

  const second = reserveBudgetHardCap({
    ledger: first.ledger,
    amount: 40,
    resourceKind: "tool",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 1,
  });

  assert.equal(second.ledger.status, "hard_cap_reached");
  assert.equal(second.ledger.reservedAmount, 100);
});

test("side effect factories create append-only reconciliation and compensation records", () => {
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "external-idem-1",
    riskClass: "high",
    preCommitPolicyProofRef: artifact,
  });
  const reconciliation = createReconciliationRecord({
    sideEffectId: sideEffect.sideEffectId,
    probeKind: "external_get",
    externalObservedState: { status: "unknown" },
    result: "ambiguous",
    nextAction: "escalate_hitl",
    evidenceRefs: [artifact],
  });
  const compensation = createCompensationRecord({
    sideEffectId: sideEffect.sideEffectId,
    harnessRunId: "run-1",
    planRef: artifact,
  });

  assert.equal(sideEffect.status, "proposed");
  assert.equal(reconciliation.result, "ambiguous");
  assert.equal(compensation.status, "planned");
});

test("event factories separate platform facts from OAPEFLIR view events", () => {
  const fact = createPlatformFactEvent({
    eventType: "platform.harness_run.created",
    aggregateType: "HarnessRun",
    aggregateId: "run-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    traceId: "trace-1",
    payload: { status: "created" },
  });
  const view = createOapeflirViewEvent({
    eventType: "oapeflir.view.run_lifecycle",
    aggregateType: "HarnessRun",
    aggregateId: "run-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    traceId: "trace-1",
    payload: { stage: "observe" },
    derivedFromEventIds: [fact.eventId],
  });

  assert.equal(canTruthConsumerConsume(fact), true);
  assert.equal(canTruthConsumerConsume(view), false);
  assert.equal(view.projectionOnly, true);
});
