/**
 * Executable Contracts Factory Extended Unit Tests
 *
 * Extended tests for executable-contracts factories and types beyond
 * what exists in executable-contracts.test.ts and schemas-validation.test.ts.
 *
 * @see src/platform/contracts/executable-contracts/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

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
  normalizeDomainBindingId,
  CONTRACT_SCHEMA_VERSION,
  type ArtifactRef,
  type PrincipalRef,
  type BudgetIntent,
  type PlanGraph,
  type RiskPreview,
} from "../../../../src/platform/contracts/executable-contracts/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

// =============================================================================
// Helper Functions
// =============================================================================

function createTestPrincipalRef(overrides?: Partial<PrincipalRef>): PrincipalRef {
  return createPrincipalRef({
    principalId: "test-user",
    tenantId: "test-tenant",
    roles: ["operator"],
    ...overrides,
  });
}

function createTestArtifactRef(overrides?: Partial<ArtifactRef>): ArtifactRef {
  return {
    artifactId: "artifact-1",
    uri: "artifact://artifact-1",
    hash: "sha256:test",
    version: "1.0.0",
    ...overrides,
  };
}

function createTestBudgetIntent(): BudgetIntent {
  return {
    amount: 100,
    currency: "USD",
    resourceKinds: ["token", "tool"],
  };
}

function createTestRiskPreview(riskClass: "low" | "medium" | "high" | "critical" = "low"): RiskPreview {
  return {
    riskClass,
    reasons: ["test reason"],
  };
}

function createMinimalPlanGraph(): PlanGraph {
  return {
    graphId: "graph-1",
    nodes: [
      {
        nodeId: "node-1",
        nodeType: "tool",
        inputRefs: [],
        outputSchemaRef: "schema://output",
        riskClass: "low",
        budgetIntent: createTestBudgetIntent(),
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
    graphHash: "hash-graph-1",
  };
}

// =============================================================================
// PrincipalRef Factory Tests
// =============================================================================

test("executable-contracts: createPrincipalRef with all fields", () => {
  const principal = createPrincipalRef({
    principalId: "user_full",
    tenantId: "tenant_full",
    roles: ["admin", "operator"],
    displayName: "Full User",
    authorizationLevel: "admin",
  });

  assert.equal(principal.principalId, "user_full");
  assert.equal(principal.tenantId, "tenant_full");
  assert.deepEqual(principal.roles, ["admin", "operator"]);
  assert.equal(principal.displayName, "Full User");
  assert.equal(principal.authorizationLevel, "admin");
});

test("executable-contracts: createPrincipalRef requires non-empty principalId", () => {
  assert.throws(
    () =>
      createPrincipalRef({
        principalId: "",
        tenantId: "tenant",
        roles: [],
      }),
    /principal_id_required/,
  );
});

test("executable-contracts: createPrincipalRef requires non-empty tenantId", () => {
  assert.throws(
    () =>
      createPrincipalRef({
        principalId: "user",
        tenantId: "",
        roles: [],
      }),
    /tenant_id_required/,
  );
});

test("executable-contracts: createPrincipalRef defaults roles to empty array", () => {
  const principal = createPrincipalRef({
    principalId: "user_minimal",
    tenantId: "tenant_minimal",
  });

  assert.deepEqual(principal.roles, []);
});

// =============================================================================
// normalizeDomainBindingId Tests
// =============================================================================

test("executable-contracts: normalizeDomainBindingId handles standard domains", () => {
  assert.equal(normalizeDomainBindingId("coding"), "coding");
  assert.equal(normalizeDomainBindingId("data-engineering"), "data-engineering");
});

test("executable-contracts: normalizeDomainBindingId resolves legacy aliases", () => {
  // Engineering aliases
  assert.equal(normalizeDomainBindingId("engineering"), "coding");
  assert.equal(normalizeDomainBindingId("platform_engineering"), "coding");
  assert.equal(normalizeDomainBindingId("engineering_ops"), "coding");

  // Content aliases
  assert.equal(normalizeDomainBindingId("content"), "creative-production");
  assert.equal(normalizeDomainBindingId("content_production"), "creative-production");
  assert.equal(normalizeDomainBindingId("design"), "creative-production");

  // Data aliases
  assert.equal(normalizeDomainBindingId("data"), "data-engineering");
  assert.equal(normalizeDomainBindingId("data_analysis"), "data-engineering");
  assert.equal(normalizeDomainBindingId("analytics"), "data-engineering");

  // QA alias
  assert.equal(normalizeDomainBindingId("qa"), "quality-assurance");
  assert.equal(normalizeDomainBindingId("quality_assurance"), "quality-assurance");
});

test("executable-contracts: normalizeDomainBindingId normalizes whitespace and case", () => {
  assert.equal(normalizeDomainBindingId("  Data-Engineering  "), "data-engineering");
  assert.equal(normalizeDomainBindingId("DATA-ANALYTICS"), "data-engineering");
});

// =============================================================================
// TaskDraft Factory Tests
// =============================================================================

test("executable-contracts: createTaskDraft requires domainId", () => {
  const principal = createTestPrincipalRef();

  // Without domainId in explicit or normalizedIntent, should throw
  assert.throws(
    () =>
      createTaskDraft({
        tenantId: "tenant-1",
        principal,
        source: "nl",
        normalizedIntent: {},
        riskPreview: createTestRiskPreview("low"),
      }),
    /domain_id_required/,
  );
});

test("executable-contracts: createTaskDraft extracts domainId from normalizedIntent", () => {
  const principal = createTestPrincipalRef();

  const draft = createTaskDraft({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    normalizedIntent: { domainId: "coding" },
    riskPreview: createTestRiskPreview("low"),
  });

  assert.equal(draft.domainId, "coding");
});

test("executable-contracts: createTaskDraft uses explicit domainId over normalizedIntent", () => {
  const principal = createTestPrincipalRef();

  const draft = createTaskDraft({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    domainId: "explicit-coding",
    normalizedIntent: { domainId: "implicit-data" },
    riskPreview: createTestRiskPreview("low"),
  });

  assert.equal(draft.domainId, "explicit-coding");
});

test("executable-contracts: createTaskDraft defaults ambiguityPolicy to require_confirmation", () => {
  const principal = createTestPrincipalRef();

  const draft = createTaskDraft({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    domainId: "coding",
    normalizedIntent: {},
    riskPreview: createTestRiskPreview("low"),
  });

  assert.equal(draft.ambiguityPolicy, "require_confirmation");
});

test("executable-contracts: createTaskDraft allows rawInputRef", () => {
  const principal = createTestPrincipalRef();
  const artifact = createTestArtifactRef();

  const draft = createTaskDraft({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    domainId: "coding",
    normalizedIntent: {},
    riskPreview: createTestRiskPreview("low"),
    rawInputRef: artifact,
  });

  assert.equal(draft.rawInputRef?.artifactId, "artifact-1");
});

// =============================================================================
// ConfirmedTaskSpec Factory Tests
// =============================================================================

test("executable-contracts: createConfirmedTaskSpec high-risk requires confirmation", () => {
  const principal = createTestPrincipalRef();

  // High risk without confirmation should throw
  assert.throws(
    () =>
      createConfirmedTaskSpec({
        taskDraftId: "draft-1",
        tenantId: "tenant-1",
        principal,
        domainId: "coding",
        goal: "test goal",
        inputs: {},
        constraintPackRef: "cp://constraint",
        riskClass: "high",
        idempotencyKey: "idem-1",
        traceId: "trace-1",
      }),
    /confirmation_required/,
  );
});

test("executable-contracts: createConfirmedTaskSpec critical-risk requires confirmation", () => {
  const principal = createTestPrincipalRef();

  assert.throws(
    () =>
      createConfirmedTaskSpec({
        taskDraftId: "draft-1",
        tenantId: "tenant-1",
        principal,
        domainId: "coding",
        goal: "test goal",
        inputs: {},
        constraintPackRef: "cp://constraint",
        riskClass: "critical",
        idempotencyKey: "idem-1",
        traceId: "trace-1",
      }),
    /confirmation_required/,
  );
});

test("executable-contracts: createConfirmedTaskSpec allows low-risk without confirmation", () => {
  const principal = createTestPrincipalRef();

  const spec = createConfirmedTaskSpec({
    taskDraftId: "draft-1",
    tenantId: "tenant-1",
    principal,
    domainId: "coding",
    goal: "test goal",
    inputs: {},
    constraintPackRef: "cp://constraint",
    riskClass: "low",
    idempotencyKey: "idem-1",
    traceId: "trace-1",
  });

  assert.equal(spec.goal, "test goal");
  assert.equal(spec.riskClass, "low");
});

test("executable-contracts: createConfirmedTaskSpec requires non-empty goal", () => {
  const principal = createTestPrincipalRef();

  assert.throws(
    () =>
      createConfirmedTaskSpec({
        taskDraftId: "draft-1",
        tenantId: "tenant-1",
        principal,
        domainId: "coding",
        goal: "",
        inputs: {},
        constraintPackRef: "cp://constraint",
        riskClass: "low",
        idempotencyKey: "idem-1",
        traceId: "trace-1",
      }),
    /goal_required/,
  );
});

test("executable-contracts: createConfirmedTaskSpec requires constraintPackRef", () => {
  const principal = createTestPrincipalRef();

  assert.throws(
    () =>
      createConfirmedTaskSpec({
        taskDraftId: "draft-1",
        tenantId: "tenant-1",
        principal,
        domainId: "coding",
        goal: "test",
        inputs: {},
        constraintPackRef: "",
        riskClass: "low",
        idempotencyKey: "idem-1",
        traceId: "trace-1",
      }),
    /constraint_pack_required/,
  );
});

// =============================================================================
// RequestEnvelopeFromConfirmedTask Factory Tests
// =============================================================================

test("executable-contracts: createRequestEnvelopeFromConfirmedTask", () => {
  const principal = createTestPrincipalRef();

  const confirmed = createConfirmedTaskSpec({
    taskDraftId: "draft-1",
    tenantId: "tenant-1",
    principal,
    domainId: "coding",
    goal: "test goal",
    inputs: { key: "value" },
    constraintPackRef: "cp://constraint",
    riskClass: "low",
    idempotencyKey: "idem-1",
    traceId: "trace-1",
  });

  const envelope = createRequestEnvelopeFromConfirmedTask({
    confirmedTaskSpec: confirmed,
    budgetIntent: createTestBudgetIntent(),
  });

  assert.equal(envelope.confirmedTaskSpecId, confirmed.confirmedTaskSpecId);
  assert.equal(envelope.tenantId, "tenant-1");
  assert.equal(envelope.domainId, "coding");
  assert.equal(envelope.principal.principalId, "test-user");
  assert.ok(envelope.requestId.startsWith("request_"));
  assert.ok(envelope.requestHash.startsWith("reqhash_"));
});

test("executable-contracts: createRequestEnvelopeFromConfirmedTask accepts custom requestId", () => {
  const principal = createTestPrincipalRef();

  const confirmed = createConfirmedTaskSpec({
    taskDraftId: "draft-1",
    tenantId: "tenant-1",
    principal,
    domainId: "coding",
    goal: "test goal",
    inputs: {},
    constraintPackRef: "cp://constraint",
    riskClass: "low",
    idempotencyKey: "idem-1",
    traceId: "trace-1",
  });

  const envelope = createRequestEnvelopeFromConfirmedTask({
    confirmedTaskSpec: confirmed,
    budgetIntent: createTestBudgetIntent(),
    requestId: "custom-request-id",
    requestHash: "custom-hash",
    priority: 5,
  });

  assert.equal(envelope.requestId, "custom-request-id");
  assert.equal(envelope.requestHash, "custom-hash");
  assert.equal(envelope.priority, 5);
});

// =============================================================================
// NodeAttempt Factory Tests
// =============================================================================

test("executable-contracts: createNodeAttempt requires attemptNo >= 1", () => {
  assert.throws(
    () =>
      createNodeAttempt({
        nodeRunId: "nrun-1",
        attemptNo: 0,
        attemptKind: "initial",
        executorRef: "worker-1",
        inputSnapshotRef: createTestArtifactRef(),
      }),
    /attempt_no_invalid/,
  );
});

test("executable-contracts: createNodeAttempt accepts all attempt kinds", () => {
  const kinds: Array<"initial" | "retry" | "redrive" | "recovery"> = [
    "initial",
    "retry",
    "redrive",
    "recovery",
  ];

  for (const kind of kinds) {
    const attempt = createNodeAttempt({
      nodeRunId: "nrun-1",
      attemptNo: 1,
      attemptKind: kind,
      executorRef: "worker-1",
      inputSnapshotRef: createTestArtifactRef(),
    });

    assert.equal(attempt.attemptKind, kind);
  }
});

// =============================================================================
// SideEffectRecord Factory Tests
// =============================================================================

test("executable-contracts: createSideEffectRecord default status is proposed", () => {
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "nrun-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-1",
    riskClass: "high",
    preCommitPolicyProofRef: createTestArtifactRef(),
    deadline: "2026-04-02T00:00:00.000Z",
  });

  assert.equal(sideEffect.status, "proposed");
});

test("executable-contracts: createSideEffectRecord all effect kinds", () => {
  const kinds: Array<"file_write" | "external_api" | "message_send" | "transaction" | "tool_commit" | "other"> = [
    "file_write",
    "external_api",
    "message_send",
    "transaction",
    "tool_commit",
    "other",
  ];

  for (const kind of kinds) {
    const sideEffect = createSideEffectRecord({
      harnessRunId: "run-1",
      nodeRunId: "nrun-1",
      nodeAttemptId: "attempt-1",
      effectKind: kind,
      idempotencyKey: `idem-${kind}`,
      riskClass: "low",
      preCommitPolicyProofRef: createTestArtifactRef(),
      deadline: "2026-04-02T00:00:00.000Z",
    });

    assert.equal(sideEffect.effectKind, kind);
  }
});

// =============================================================================
// BudgetLedger Factory Tests
// =============================================================================

test("executable-contracts: createBudgetLedger rejects negative hardCap", () => {
  assert.throws(
    () =>
      createBudgetLedger({
        tenantId: "tenant-1",
        harnessRunId: "run-1",
        currency: "USD",
        hardCap: -100,
      }),
    /hard_cap_invalid/,
  );
});

test("executable-contracts: reserveBudgetHardCap requires correct version", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  // Wrong version should throw
  assert.throws(
    () =>
      reserveBudgetHardCap({
        ledger,
        amount: 10,
        resourceKind: "token",
        expiresAt: "2026-04-02T00:00:00.000Z",
        expectedVersion: 5, // Wrong version
      }),
    /version_cas_failed/,
  );
});

test("executable-contracts: reserveBudgetHardCap rejects amount exceeding remaining", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  // Reserve some first
  reserveBudgetHardCap({
    ledger,
    amount: 90,
    resourceKind: "token",
    expiresAt: "2026-04-02T00:00:00.000Z",
    expectedVersion: 0,
  });

  // Try to reserve more than remaining (10 remaining, requesting 20)
  const updatedLedger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 1,
  });

  assert.throws(
    () =>
      reserveBudgetHardCap({
        ledger: updatedLedger,
        amount: 20,
        resourceKind: "token",
        expiresAt: "2026-04-02T00:00:00.000Z",
        expectedVersion: 1,
      }),
    /hard_cap_exceeded/,
  );
});

// =============================================================================
// BudgetReservation Factory Tests
// =============================================================================

test("executable-contracts: createBudgetReservation requires positive amount", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
  });

  assert.throws(
    () =>
      createBudgetReservation({
        budgetLedgerId: ledger.budgetLedgerId,
        harnessRunId: "run-1",
        amount: -5,
        resourceKind: "token",
        expiresAt: "2026-04-02T00:00:00.000Z",
      }),
    /amount_invalid/,
  );
});

test("executable-contracts: createBudgetReservation accepts all resource kinds", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
  });

  const kinds: Array<"token" | "tool" | "api" | "compute" | "human" | "side_effect" | "other"> = [
    "token",
    "tool",
    "api",
    "compute",
    "human",
    "side_effect",
    "other",
  ];

  for (const kind of kinds) {
    const reservation = createBudgetReservation({
      budgetLedgerId: ledger.budgetLedgerId,
      harnessRunId: "run-1",
      amount: 10,
      resourceKind: kind,
      expiresAt: "2026-04-02T00:00:00.000Z",
    });

    assert.equal(reservation.resourceKind, kind);
  }
});

// =============================================================================
// BudgetSettlement Factory Tests
// =============================================================================

test("executable-contracts: createBudgetSettlement accepts all settlement kinds", () => {
  const kinds: Array<"final" | "partial" | "release_unused" | "correction"> = [
    "final",
    "partial",
    "release_unused",
    "correction",
  ];

  for (const kind of kinds) {
    const settlement = createBudgetSettlement({
      budgetReservationId: "bresv-1",
      actualAmount: 50,
      settlementKind: kind,
    });

    assert.equal(settlement.settlementKind, kind);
  }
});

test("executable-contracts: createBudgetSettlement accepts zero actualAmount", () => {
  const settlement = createBudgetSettlement({
    budgetReservationId: "bresv-1",
    actualAmount: 0,
    settlementKind: "release_unused",
  });

  assert.equal(settlement.actualAmount, 0);
});

test("executable-contracts: createBudgetSettlement rejects negative actualAmount", () => {
  assert.throws(
    () =>
      createBudgetSettlement({
        budgetReservationId: "bresv-1",
        actualAmount: -10,
        settlementKind: "final",
      }),
    /actual_amount_invalid/,
  );
});

// =============================================================================
// RunVersionLock Factory Tests
// =============================================================================

test("executable-contracts: createRunVersionLock defaults schemaVersion to CONTRACT_SCHEMA_VERSION", () => {
  const versionLock = createRunVersionLock({
    harnessRunId: "run-1",
    runtimeProfileVersion: "profile-1",
  });

  assert.equal(versionLock.schemaVersion, CONTRACT_SCHEMA_VERSION);
});

// =============================================================================
// ArtifactVersionLockSet Factory Tests
// =============================================================================

test("executable-contracts: createArtifactVersionLockSet requires at least one lock", () => {
  assert.throws(
    () =>
      createArtifactVersionLockSet({
        harnessRunId: "run-1",
        artifactLocks: [],
      }),
    /artifact_locks_required/,
  );
});

test("executable-contracts: createArtifactVersionLockSet accepts multiple locks", () => {
  const lockSet = createArtifactVersionLockSet({
    harnessRunId: "run-1",
    artifactLocks: [
      {
        artifactId: "artifact-1",
        version: "v1",
        hash: "sha256:1",
        storageUri: "s3://bucket/1",
        retentionPolicyRef: "policy-1",
      },
      {
        artifactId: "artifact-2",
        version: "v2",
        hash: "sha256:2",
        storageUri: "s3://bucket/2",
        retentionPolicyRef: "policy-2",
      },
    ],
  });

  assert.equal(lockSet.artifactLocks.length, 2);
});

// =============================================================================
// HumanResponsibilityRecord Factory Tests
// =============================================================================

test("executable-contracts: createHumanResponsibilityRecord high-risk requires expiresAt", () => {
  const principal = createTestPrincipalRef();

  assert.throws(
    () =>
      createHumanResponsibilityRecord({
        harnessDecisionId: "hdecision-1",
        humanActorRef: principal,
        responsibilityScope: "approval",
        acknowledgedRiskClass: "high",
        acknowledgementReceiptRef: createTestArtifactRef(),
        // Missing expiresAt for high risk
      }),
    /expires_at_required/,
  );
});

test("executable-contracts: createHumanResponsibilityRecord critical-risk requires expiresAt", () => {
  const principal = createTestPrincipalRef();

  assert.throws(
    () =>
      createHumanResponsibilityRecord({
        harnessDecisionId: "hdecision-1",
        humanActorRef: principal,
        responsibilityScope: "approval",
        acknowledgedRiskClass: "critical",
        acknowledgementReceiptRef: createTestArtifactRef(),
        // Missing expiresAt for critical risk
      }),
    /expires_at_required/,
  );
});

test("executable-contracts: createHumanResponsibilityRecord accepts all responsibility scopes", () => {
  const principal = createTestPrincipalRef();
  const scopes: Array<"approval" | "override" | "takeover" | "patch" | "resume" | "abort" | "compensation"> = [
    "approval",
    "override",
    "takeover",
    "patch",
    "resume",
    "abort",
    "compensation",
  ];

  for (const scope of scopes) {
    const record = createHumanResponsibilityRecord({
      harnessDecisionId: "hdecision-1",
      humanActorRef: principal,
      responsibilityScope: scope,
      acknowledgedRiskClass: "low",
      acknowledgementReceiptRef: createTestArtifactRef(),
    });

    assert.equal(record.responsibilityScope, scope);
  }
});

// =============================================================================
// Event Type Guards Tests
// =============================================================================

test("executable-contracts: isPlatformFactEvent returns true for platform.* events", () => {
  const fact = createPlatformFactEvent({
    eventType: "platform.harness_run.created",
    aggregateType: "HarnessRun",
    aggregateId: "run-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: { status: "created" },
  });

  assert.equal(isPlatformFactEvent(fact), true);
});

test("executable-contracts: isPlatformFactEvent returns false for oapeflir events", () => {
  const view = createOapeflirViewEvent({
    eventType: "oapeflir.view.run_lifecycle",
    aggregateType: "HarnessRun",
    aggregateId: "run-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
    derivedFromEventIds: ["evt-1"],
  });

  assert.equal(isPlatformFactEvent(view), false);
});

test("executable-contracts: isOapeflirViewEvent returns true for oapeflir.view.* events", () => {
  const view = createOapeflirViewEvent({
    eventType: "oapeflir.view.run_lifecycle",
    aggregateType: "HarnessRun",
    aggregateId: "run-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
    derivedFromEventIds: ["evt-1"],
  });

  assert.equal(isOapeflirViewEvent(view), true);
});

test("executable-contracts: isOapeflirViewEvent returns true for oapeflir.rationale.* events", () => {
  const view = createOapeflirViewEvent({
    eventType: "oapeflir.rationale.decision",
    aggregateType: "Rationale",
    aggregateId: "rat-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
    derivedFromEventIds: ["evt-1"],
  });

  assert.equal(isOapeflirViewEvent(view), true);
});

test("executable-contracts: canTruthConsumerConsume returns true for platform fact events", () => {
  const fact = createPlatformFactEvent({
    eventType: "platform.task.created",
    aggregateType: "Task",
    aggregateId: "task-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
  });

  assert.equal(canTruthConsumerConsume(fact), true);
});

test("executable-contracts: canTruthConsumerConsume returns false for OAPEFLIR view events", () => {
  const view = createOapeflirViewEvent({
    eventType: "oapeflir.view.task_lifecycle",
    aggregateType: "TaskLifecycle",
    aggregateId: "tl-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
    derivedFromEventIds: ["evt-1"],
  });

  assert.equal(canTruthConsumerConsume(view), false);
});

// =============================================================================
// PlatformFactEvent Factory Tests
// =============================================================================

test("executable-contracts: createPlatformFactEvent requires platform.* eventType", () => {
  assert.throws(
    () =>
      createPlatformFactEvent({
        eventType: "user.task.created" as any,
        aggregateType: "Task",
        aggregateId: "task-1",
        aggregateSeq: 1,
        tenantId: "tenant-1",
        runId: "run-1",
        traceId: "trace-1",
        payload: {},
      }),
    /namespace_required/,
  );
});

test("executable-contracts: createPlatformFactEvent defaults replayBehavior to replay_as_fact", () => {
  const fact = createPlatformFactEvent({
    eventType: "platform.task.created",
    aggregateType: "Task",
    aggregateId: "task-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
  });

  assert.equal(fact.replayBehavior, "replay_as_fact");
  assert.equal(fact.sourceOfTruth, "platform");
});

// =============================================================================
// OapeflirViewEvent Factory Tests
// =============================================================================

test("executable-contracts: createOapeflirViewEvent requires oapeflir.view.* or oapeflir.rationale.*", () => {
  assert.throws(
    () =>
      createOapeflirViewEvent({
        eventType: "platform.task.created" as any,
        aggregateType: "Task",
        aggregateId: "task-1",
        aggregateSeq: 1,
        tenantId: "tenant-1",
        runId: "run-1",
        traceId: "trace-1",
        payload: {},
        derivedFromEventIds: ["evt-1"],
      }),
    /namespace_required/,
  );
});

test("executable-contracts: createOapeflirViewEvent requires non-empty derivedFromEventIds", () => {
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
    /derived_from_required/,
  );
});

test("executable-contracts: createOapeflirViewEvent defaults replayBehavior to simulate", () => {
  const view = createOapeflirViewEvent({
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

  assert.equal(view.replayBehavior, "simulate");
  assert.equal(view.sourceOfTruth, "projection");
  assert.equal(view.projectionOnly, true);
});
