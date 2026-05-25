/**
 * Executable Contracts Schema Validation Tests
 *
 * Tests Zod schema validation for all executable contract schemas:
 * - Valid inputs pass schema.parse()
 * - Invalid inputs throw/detect errors correctly
 * - Default values are applied correctly
 * - Transform/preprocess works as expected
 */

import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import {
  RiskClassSchema,
  TaskInputSourceSchema,
  AmbiguityPolicySchema,
  BudgetResourceKindSchema,
  JsonValueSchema,
  PrincipalRefSchema,
  ArtifactRefSchema,
  RiskPreviewSchema,
  UserConfirmationReceiptSchema,
  BudgetIntentSchema,
  TaskDraftSchema,
  ConfirmedTaskSpecSchema,
  RequestEnvelopeSchema,
  HarnessRunStatusSchema,
  HarnessRunSchema,
  PlanNodeTypeSchema,
  DependencyTypeSchema,
  SideEffectProfileSchema,
  PlanNodeSchema,
  PlanEdgeSchema,
  PlanGraphSchema,
  ReadyNodeSchedulingPolicySchema,
  GraphValidationReportSchema,
  PlanGraphBundleSchema,
  GraphPatchOperationTypeSchema,
  GraphPatchOperationSchema,
  GraphPatchSchema,
  NodeRunStatusSchema,
  NodeRunSchema,
  NodeAttemptSchema,
  AttemptLineageSchema,
  AppErrorRefSchema,
  NodeAttemptReceiptSchema,
  SideEffectStatusSchema,
  SideEffectRecordSchema,
  ReconciliationRecordSchema,
  CompensationRecordSchema,
  BudgetLedgerSchema,
  BudgetReservationSchema,
  BudgetSettlementSchema,
  RunVersionLockSchema,
  ArtifactVersionLockSchema,
  ArtifactVersionLockSetSchema,
  PolicyFindingSchema,
  DecisionInputBundleSchema,
  HarnessDecisionSchema,
  HumanResponsibilityRecordSchema,
  EventEnvelopeSchema,
  PlatformFactEventSchema,
  OapeflirViewEventSchema,
  CONTRACT_ZOD_SCHEMAS,
} from "../../../../../src/platform/contracts/executable-contracts/schemas.js";

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createValidPrincipalRef() {
  return {
    principalId: "user-123",
    tenantId: "tenant-456",
    roles: ["operator", "admin"],
    displayName: "Test User",
  };
}

function createValidArtifactRef() {
  return {
    artifactId: "artifact-789",
    uri: "artifact://storage/artifact-789",
    hash: "sha256:abc123",
    version: "1.0.0",
  };
}

function createValidBudgetIntent() {
  return {
    amount: 1000.50,
    currency: "USD",
    resourceKinds: ["token", "tool", "compute"] as const,
  };
}

function createValidRiskPreview() {
  return {
    riskClass: "low" as const,
    reasons: ["no external effects", "standard operation"],
  };
}

// ---------------------------------------------------------------------------
// RiskClassSchema Tests
// ---------------------------------------------------------------------------

test("RiskClassSchema accepts valid risk classes", () => {
  const validClasses = ["low", "medium", "high", "critical"];
  for (const riskClass of validClasses) {
    const result = RiskClassSchema.safeParse(riskClass);
    assert.equal(result.success, true, `RiskClass '${riskClass}' should be valid`);
  }
});

test("RiskClassSchema rejects invalid risk classes", () => {
  const invalidClasses = ["unknown", "safe", "high_risk", "", "LOW", 123];
  for (const riskClass of invalidClasses) {
    const result = RiskClassSchema.safeParse(riskClass);
    assert.equal(result.success, false, `RiskClass '${String(riskClass)}' should be invalid`);
  }
});

// ---------------------------------------------------------------------------
// TaskInputSourceSchema Tests
// ---------------------------------------------------------------------------

test("TaskInputSourceSchema accepts valid sources", () => {
  const validSources = ["nl", "webhook", "ui", "cli", "scheduler", "external_event"];
  for (const source of validSources) {
    const result = TaskInputSourceSchema.safeParse(source);
    assert.equal(result.success, true, `Source '${source}' should be valid`);
  }
});

test("TaskInputSourceSchema rejects invalid sources", () => {
  const invalidSources = ["api", "file", "", "NL", 123, null];
  for (const source of invalidSources) {
    const result = TaskInputSourceSchema.safeParse(source);
    assert.equal(result.success, false, `Source '${String(source)}' should be invalid`);
  }
});

// ---------------------------------------------------------------------------
// AmbiguityPolicySchema Tests
// ---------------------------------------------------------------------------

test("AmbiguityPolicySchema accepts valid policies", () => {
  const validPolicies = ["safe_default", "require_confirmation", "reject"];
  for (const policy of validPolicies) {
    const result = AmbiguityPolicySchema.safeParse(policy);
    assert.equal(result.success, true, `Policy '${policy}' should be valid`);
  }
});

test("AmbiguityPolicySchema rejects invalid policies", () => {
  const invalidPolicies = ["unknown", "ask", ""];
  for (const policy of invalidPolicies) {
    const result = AmbiguityPolicySchema.safeParse(policy);
    assert.equal(result.success, false, `Policy '${policy}' should be invalid`);
  }
});

// ---------------------------------------------------------------------------
// BudgetResourceKindSchema Tests
// ---------------------------------------------------------------------------

test("BudgetResourceKindSchema accepts valid resource kinds", () => {
  const validKinds = ["token", "tool", "api", "compute", "human", "side_effect", "other"];
  for (const kind of validKinds) {
    const result = BudgetResourceKindSchema.safeParse(kind);
    assert.equal(result.success, true, `ResourceKind '${kind}' should be valid`);
  }
});

test("BudgetResourceKindSchema rejects invalid resource kinds", () => {
  const invalidKinds = ["tokens", "cpu", "", 123];
  for (const kind of invalidKinds) {
    const result = BudgetResourceKindSchema.safeParse(kind);
    assert.equal(result.success, false, `ResourceKind '${String(kind)}' should be invalid`);
  }
});

// ---------------------------------------------------------------------------
// JsonValueSchema Tests
// ---------------------------------------------------------------------------

test("JsonValueSchema accepts null", () => {
  const result = JsonValueSchema.safeParse(null);
  assert.equal(result.success, true);
  assert.equal(result.data, null);
});

test("JsonValueSchema accepts boolean values", () => {
  assert.equal(JsonValueSchema.safeParse(true).success, true);
  assert.equal(JsonValueSchema.safeParse(false).success, true);
});

test("JsonValueSchema accepts number values", () => {
  assert.equal(JsonValueSchema.safeParse(0).success, true);
  assert.equal(JsonValueSchema.safeParse(42).success, true);
  assert.equal(JsonValueSchema.safeParse(-3.14).success, true);
  assert.equal(JsonValueSchema.safeParse(1e10).success, true);
});

test("JsonValueSchema accepts string values", () => {
  assert.equal(JsonValueSchema.safeParse("").success, true);
  assert.equal(JsonValueSchema.safeParse("hello").success, true);
  assert.equal(JsonValueSchema.safeParse("nested \"quotes\"").success, true);
});

test("JsonValueSchema accepts arrays", () => {
  assert.equal(JsonValueSchema.safeParse([]).success, true);
  assert.equal(JsonValueSchema.safeParse([1, 2, 3]).success, true);
  assert.equal(JsonValueSchema.safeParse(["a", "b"]).success, true);
  assert.equal(JsonValueSchema.safeParse([null, true, "str", 42]).success, true);
  assert.equal(JsonValueSchema.safeParse([[1, 2], [3, 4]]).success, true);
});

test("JsonValueSchema accepts objects", () => {
  assert.equal(JsonValueSchema.safeParse({}).success, true);
  assert.equal(JsonValueSchema.safeParse({ key: "value" }).success, true);
  assert.equal(JsonValueSchema.safeParse({ nested: { deep: { value: 1 } } }).success, true);
  assert.equal(JsonValueSchema.safeParse({ arr: [1, 2, 3], obj: { a: true } }).success, true);
});

test("JsonValueSchema accepts mixed nested structures", () => {
  const complex = {
    user: {
      name: "Alice",
      age: 30,
      active: true,
      tags: ["admin", "developer"],
      metadata: {
        lastLogin: "2026-04-01T00:00:00.000Z",
        score: 95.5,
      },
    },
    items: [
      { id: 1, name: "Item 1" },
      { id: 2, name: "Item 2" },
    ],
    count: 42,
    enabled: false,
    empty: null,
  };
  const result = JsonValueSchema.safeParse(complex);
  assert.equal(result.success, true);
});

test("JsonValueSchema rejects functions", () => {
  assert.equal(JsonValueSchema.safeParse(() => {}).success, false);
  assert.equal(JsonValueSchema.safeParse(function() {}).success, false);
});

test("JsonValueSchema rejects undefined", () => {
  assert.equal(JsonValueSchema.safeParse(undefined).success, false);
});

// ---------------------------------------------------------------------------
// PrincipalRefSchema Tests
// ---------------------------------------------------------------------------

test("PrincipalRefSchema accepts valid principal", () => {
  const valid = createValidPrincipalRef();
  const result = PrincipalRefSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("PrincipalRefSchema accepts minimal principal", () => {
  const minimal = {
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  };
  const result = PrincipalRefSchema.safeParse(minimal);
  assert.equal(result.success, true);
});

test("PrincipalRefSchema rejects empty principalId", () => {
  const invalid = { ...createValidPrincipalRef(), principalId: "" };
  const result = PrincipalRefSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("PrincipalRefSchema rejects empty tenantId", () => {
  const invalid = { ...createValidPrincipalRef(), tenantId: "" };
  const result = PrincipalRefSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("PrincipalRefSchema rejects non-array roles", () => {
  const invalid = { ...createValidPrincipalRef(), roles: "operator" };
  const result = PrincipalRefSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("PrincipalRefSchema allows optional displayName", () => {
  const without = { principalId: "user-1", tenantId: "tenant-1", roles: [] };
  const result = PrincipalRefSchema.safeParse(without);
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// ArtifactRefSchema Tests
// ---------------------------------------------------------------------------

test("ArtifactRefSchema accepts valid artifact ref", () => {
  const valid = createValidArtifactRef();
  const result = ArtifactRefSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("ArtifactRefSchema accepts minimal artifact ref", () => {
  const minimal = {
    artifactId: "artifact-1",
    uri: "artifact://storage/path",
  };
  const result = ArtifactRefSchema.safeParse(minimal);
  assert.equal(result.success, true);
});

test("ArtifactRefSchema rejects empty artifactId", () => {
  const invalid = { artifactId: "", uri: "artifact://path" };
  const result = ArtifactRefSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("ArtifactRefSchema rejects empty uri", () => {
  const invalid = { artifactId: "artifact-1", uri: "" };
  const result = ArtifactRefSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("ArtifactRefSchema allows optional hash and version", () => {
  const without = {
    artifactId: "artifact-1",
    uri: "artifact://storage/path",
  };
  const result = ArtifactRefSchema.safeParse(without);
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// RiskPreviewSchema Tests
// ---------------------------------------------------------------------------

test("RiskPreviewSchema accepts valid risk preview", () => {
  const valid = createValidRiskPreview();
  const result = RiskPreviewSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("RiskPreviewSchema accepts low risk preview", () => {
  const valid = { riskClass: "low" as const, reasons: [] };
  const result = RiskPreviewSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("RiskPreviewSchema accepts critical risk with reasons", () => {
  const valid = {
    riskClass: "critical" as const,
    reasons: ["external API call", "modifies data", "long-running operation"],
  };
  const result = RiskPreviewSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("RiskPreviewSchema rejects invalid risk class", () => {
  const invalid = { riskClass: "extreme" as const, reasons: [] };
  const result = RiskPreviewSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("RiskPreviewSchema rejects non-array reasons", () => {
  const invalid = { riskClass: "low", reasons: "not an array" };
  const result = RiskPreviewSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// BudgetIntentSchema Tests
// ---------------------------------------------------------------------------

test("BudgetIntentSchema accepts valid budget intent", () => {
  const valid = createValidBudgetIntent();
  const result = BudgetIntentSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("BudgetIntentSchema accepts zero amount", () => {
  const valid = { amount: 0, currency: "USD", resourceKinds: ["token"] as const };
  const result = BudgetIntentSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("BudgetIntentSchema rejects negative amount", () => {
  const invalid = { amount: -100, currency: "USD", resourceKinds: ["token"] as const };
  const result = BudgetIntentSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("BudgetIntentSchema rejects empty currency", () => {
  const invalid = { amount: 100, currency: "", resourceKinds: ["token"] as const };
  const result = BudgetIntentSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("BudgetIntentSchema accepts empty resourceKinds", () => {
  const valid = { amount: 100, currency: "USD", resourceKinds: [] };
  const result = BudgetIntentSchema.safeParse(valid);
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// HarnessRunStatusSchema Tests
// ---------------------------------------------------------------------------

test("HarnessRunStatusSchema accepts all canonical statuses", () => {
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
  for (const status of canonicalStatuses) {
    const result = HarnessRunStatusSchema.safeParse(status);
    assert.equal(result.success, true, `Status '${status}' should be valid`);
  }
});

test("HarnessRunStatusSchema rejects legacy statuses", () => {
  const legacyStatuses = ["idle", "executing", "sleeping", "initializing"];
  for (const status of legacyStatuses) {
    const result = HarnessRunStatusSchema.safeParse(status);
    assert.equal(result.success, false, `Legacy status '${status}' should be rejected`);
  }
});

// ---------------------------------------------------------------------------
// NodeRunStatusSchema Tests
// ---------------------------------------------------------------------------

test("NodeRunStatusSchema accepts all canonical node run statuses", () => {
  const statuses = [
    "created",
    "ready",
    "leased",
    "running",
    "retry_wait",
    "awaiting_hitl",
    "reconciling",
    "succeeded",
    "failed",
    "skipped",
    "cancelled",
    "dependency_failed",
    "policy_blocked",
    "aborted",
  ];
  for (const status of statuses) {
    const result = NodeRunStatusSchema.safeParse(status);
    assert.equal(result.success, true, `Status '${status}' should be valid`);
  }
});

test("NodeRunStatusSchema rejects invalid statuses", () => {
  const invalid = ["completed", "pending", "blocked", "unknown"];
  for (const status of invalid) {
    const result = NodeRunStatusSchema.safeParse(status);
    assert.equal(result.success, false, `Invalid status '${status}' should be rejected`);
  }
});

// ---------------------------------------------------------------------------
// PlanNodeTypeSchema Tests
// ---------------------------------------------------------------------------

test("PlanNodeTypeSchema accepts all valid node types", () => {
  const nodeTypes = ["tool", "llm", "hitl_wait", "subgraph", "evaluator", "router", "compensation"];
  for (const type of nodeTypes) {
    const result = PlanNodeTypeSchema.safeParse(type);
    assert.equal(result.success, true, `NodeType '${type}' should be valid`);
  }
});

test("PlanNodeTypeSchema rejects invalid node types", () => {
  const invalid = ["action", "task", "workflow", "atomic"];
  for (const type of invalid) {
    const result = PlanNodeTypeSchema.safeParse(type);
    assert.equal(result.success, false, `Invalid NodeType '${type}' should be rejected`);
  }
});

// ---------------------------------------------------------------------------
// DependencyTypeSchema Tests
// ---------------------------------------------------------------------------

test("DependencyTypeSchema accepts all valid dependency types", () => {
  const types = ["hard", "soft", "compensation", "retry", "replan"];
  for (const type of types) {
    const result = DependencyTypeSchema.safeParse(type);
    assert.equal(result.success, true, `DependencyType '${type}' should be valid`);
  }
});

// ---------------------------------------------------------------------------
// SideEffectProfileSchema Tests
// ---------------------------------------------------------------------------

test("SideEffectProfileSchema accepts valid profile", () => {
  const valid = {
    mayCommitExternalEffect: false,
    reversible: true,
  };
  const result = SideEffectProfileSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("SideEffectProfileSchema rejects non-boolean mayCommitExternalEffect", () => {
  const invalid = {
    mayCommitExternalEffect: "false",
    reversible: true,
  };
  const result = SideEffectProfileSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// SideEffectStatusSchema Tests
// ---------------------------------------------------------------------------

test("SideEffectStatusSchema accepts all valid statuses", () => {
  const statuses = [
    "proposed",
    "approved",
    "reserved",
    "committing",
    "committed",
    "confirming",
    "confirmed",
    "ambiguous",
    "manual_review_required",
    "reconciling",
    "compensation_required",
    "compensating",
    "compensated",
    "failed",
    "revoked",
    "expired",
  ];
  for (const status of statuses) {
    const result = SideEffectStatusSchema.safeParse(status);
    assert.equal(result.success, true, `Status '${status}' should be valid`);
  }
});

// ---------------------------------------------------------------------------
// AppErrorRefSchema Tests
// ---------------------------------------------------------------------------

test("AppErrorRefSchema accepts valid error ref", () => {
  const valid = {
    code: "ERR_TEST",
    message: "Something went wrong",
    retryable: true,
  };
  const result = AppErrorRefSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("AppErrorRefSchema accepts non-retryable error", () => {
  const valid = {
    code: "ERR_PERMANENT",
    message: "Cannot recover",
    retryable: false,
  };
  const result = AppErrorRefSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("AppErrorRefSchema rejects empty code", () => {
  const invalid = { code: "", message: "Error", retryable: false };
  const result = AppErrorRefSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("AppErrorRefSchema rejects empty message", () => {
  const invalid = { code: "ERR", message: "", retryable: false };
  const result = AppErrorRefSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("AppErrorRefSchema rejects non-boolean retryable", () => {
  const invalid = { code: "ERR", message: "Error", retryable: "yes" };
  const result = AppErrorRefSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// TaskDraftSchema Tests
// ---------------------------------------------------------------------------

test("TaskDraftSchema accepts valid task draft", () => {
  const valid = {
    taskDraftId: "draft_123",
    tenantId: "tenant_456",
    principal: createValidPrincipalRef(),
    source: "nl",
    normalizedIntent: { goal: "send report" },
    missingFields: [],
    riskPreview: createValidRiskPreview(),
    ambiguityPolicy: "require_confirmation",
    domainId: "coding",
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = TaskDraftSchema.safeParse(valid);
  assert.equal(result.success, true, `TaskDraft should be valid: ${JSON.stringify(result.error?.issues)}`);
});

test("TaskDraftSchema accepts all valid sources", () => {
  for (const source of ["nl", "webhook", "ui", "cli", "scheduler", "external_event"]) {
    const valid = {
      taskDraftId: "draft_123",
      tenantId: "tenant_456",
      principal: createValidPrincipalRef(),
      source,
      normalizedIntent: { goal: "test" },
      missingFields: [],
      riskPreview: createValidRiskPreview(),
      ambiguityPolicy: "safe_default",
      domainId: "coding",
      createdAt: "2026-04-01T00:00:00.000Z",
    };
    const result = TaskDraftSchema.safeParse(valid);
    assert.equal(result.success, true, `Source '${source}' should be valid`);
  }
});

test("TaskDraftSchema accepts all valid ambiguity policies", () => {
  for (const policy of ["safe_default", "require_confirmation", "reject"]) {
    const valid = {
      taskDraftId: "draft_123",
      tenantId: "tenant_456",
      principal: createValidPrincipalRef(),
      source: "nl",
      normalizedIntent: { goal: "test" },
      missingFields: [],
      riskPreview: createValidRiskPreview(),
      ambiguityPolicy: policy,
      domainId: "coding",
      createdAt: "2026-04-01T00:00:00.000Z",
    };
    const result = TaskDraftSchema.safeParse(valid);
    assert.equal(result.success, true, `Policy '${policy}' should be valid`);
  }
});

test("TaskDraftSchema allows optional rawInputRef", () => {
  const valid = {
    taskDraftId: "draft_123",
    tenantId: "tenant_456",
    principal: createValidPrincipalRef(),
    source: "nl",
    normalizedIntent: { goal: "test" },
    missingFields: [],
    riskPreview: createValidRiskPreview(),
    ambiguityPolicy: "safe_default",
    domainId: "coding",
    createdAt: "2026-04-01T00:00:00.000Z",
    rawInputRef: createValidArtifactRef(),
  };
  const result = TaskDraftSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("TaskDraftSchema allows optional expiresAt", () => {
  const valid = {
    taskDraftId: "draft_123",
    tenantId: "tenant_456",
    principal: createValidPrincipalRef(),
    source: "nl",
    normalizedIntent: { goal: "test" },
    missingFields: [],
    riskPreview: createValidRiskPreview(),
    ambiguityPolicy: "safe_default",
    domainId: "coding",
    createdAt: "2026-04-01T00:00:00.000Z",
    expiresAt: "2026-04-02T00:00:00.000Z",
  };
  const result = TaskDraftSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("TaskDraftSchema rejects empty taskDraftId", () => {
  const invalid = {
    taskDraftId: "",
    tenantId: "tenant_456",
    principal: createValidPrincipalRef(),
    source: "nl",
    normalizedIntent: { goal: "test" },
    missingFields: [],
    riskPreview: createValidRiskPreview(),
    ambiguityPolicy: "safe_default",
    domainId: "coding",
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = TaskDraftSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("TaskDraftSchema rejects invalid risk class in riskPreview", () => {
  const invalid = {
    taskDraftId: "draft_123",
    tenantId: "tenant_456",
    principal: createValidPrincipalRef(),
    source: "nl",
    normalizedIntent: { goal: "test" },
    missingFields: [],
    riskPreview: { riskClass: "invalid", reasons: [] },
    ambiguityPolicy: "safe_default",
    domainId: "coding",
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = TaskDraftSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// ConfirmedTaskSpecSchema Tests
// ---------------------------------------------------------------------------

test("ConfirmedTaskSpecSchema accepts valid spec", () => {
  const valid = {
    confirmedTaskSpecId: "ctspec_123",
    taskDraftId: "draft_456",
    tenantId: "tenant_789",
    principal: createValidPrincipalRef(),
    goal: "Complete the quarterly report",
    inputs: { format: "pdf", includeCharts: true },
    constraintPackRef: "constraint-pack-1",
    riskClass: "medium",
    domainId: "coding",
    idempotencyKey: "idem_123",
    traceId: "trace_456",
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = ConfirmedTaskSpecSchema.safeParse(valid);
  assert.equal(result.success, true, `ConfirmedTaskSpec should be valid: ${JSON.stringify(result.error?.issues)}`);
});

test("ConfirmedTaskSpecSchema allows optional confirmationReceipt", () => {
  const valid = {
    confirmedTaskSpecId: "ctspec_123",
    taskDraftId: "draft_456",
    tenantId: "tenant_789",
    principal: createValidPrincipalRef(),
    goal: "Complete the quarterly report",
    inputs: {},
    constraintPackRef: "constraint-pack-1",
    riskClass: "low",
    domainId: "coding",
    confirmationReceipt: {
      receiptId: "receipt_123",
      confirmedBy: createValidPrincipalRef(),
      riskClass: "low",
      confirmedAt: "2026-04-01T00:00:00.000Z",
      state: "confirmed",
    },
    idempotencyKey: "idem_123",
    traceId: "trace_456",
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = ConfirmedTaskSpecSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("ConfirmedTaskSpecSchema rejects empty goal", () => {
  const invalid = {
    confirmedTaskSpecId: "ctspec_123",
    taskDraftId: "draft_456",
    tenantId: "tenant_789",
    principal: createValidPrincipalRef(),
    goal: "",
    inputs: {},
    constraintPackRef: "constraint-pack-1",
    riskClass: "low",
    domainId: "coding",
    idempotencyKey: "idem_123",
    traceId: "trace_456",
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = ConfirmedTaskSpecSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// RequestEnvelopeSchema Tests
// ---------------------------------------------------------------------------

test("RequestEnvelopeSchema accepts valid envelope", () => {
  const valid = {
    requestId: "req_123",
    confirmedTaskSpecId: "ctspec_456",
    tenantId: "tenant_789",
    principal: createValidPrincipalRef(),
    traceId: "trace_abc",
    idempotencyKey: "idem_def",
    requestHash: "hash_xyz",
    constraintPackRef: "constraint-pack-1",
    budgetIntent: createValidBudgetIntent(),
    policyContext: { version: 1 },
    artifactRefs: [createValidArtifactRef()],
    domainId: "coding",
    priority: 0,
    submittedAt: "2026-04-01T00:00:00.000Z",
    sourcePlane: "P2",
    targetPlane: "P4",
  };
  const result = RequestEnvelopeSchema.safeParse(valid);
  assert.equal(result.success, true, `RequestEnvelope should be valid: ${JSON.stringify(result.error?.issues)}`);
});

test("RequestEnvelopeSchema allows empty artifactRefs", () => {
  const valid = {
    requestId: "req_123",
    confirmedTaskSpecId: "ctspec_456",
    tenantId: "tenant_789",
    principal: createValidPrincipalRef(),
    traceId: "trace_abc",
    idempotencyKey: "idem_def",
    requestHash: "hash_xyz",
    constraintPackRef: "constraint-pack-1",
    budgetIntent: createValidBudgetIntent(),
    policyContext: {},
    artifactRefs: [],
    domainId: "coding",
    priority: 0,
    submittedAt: "2026-04-01T00:00:00.000Z",
  };
  const result = RequestEnvelopeSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("RequestEnvelopeSchema rejects empty requestId", () => {
  const invalid = {
    requestId: "",
    confirmedTaskSpecId: "ctspec_456",
    tenantId: "tenant_789",
    principal: createValidPrincipalRef(),
    traceId: "trace_abc",
    idempotencyKey: "idem_def",
    requestHash: "hash_xyz",
    constraintPackRef: "constraint-pack-1",
    budgetIntent: createValidBudgetIntent(),
    policyContext: {},
    artifactRefs: [],
    domainId: "coding",
    priority: 0,
    submittedAt: "2026-04-01T00:00:00.000Z",
  };
  const result = RequestEnvelopeSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// HarnessRunSchema Tests
// ---------------------------------------------------------------------------

test("HarnessRunSchema accepts valid harness run", () => {
  const valid = {
    harnessRunId: "hrun_123",
    tenantId: "tenant_456",
    orgId: "org_456",
    traceId: "trace_456",
    goal: "stabilize gateway retries",
    mode: "operator_assisted",
    riskLevel: "medium",
    riskProfile: createValidRiskPreview(),
    ownership: { ownerId: "owner_1", ownerType: "principal" },
    auditRefs: [],
    auditTrail: { auditRefs: [], evidenceRefs: [] },
    confirmedTaskSpecId: "ctspec_789",
    requestEnvelopeId: "req_env_abc",
    requestHash: "hash_def",
    status: "created",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "vlock_xyz",
    budgetLedgerId: "bledger_uvw",
    budgetEnvelope: {
      budgetLedgerId: "bledger_uvw",
      currency: "USD",
      maxCost: 100,
    },
    currentSeq: 0,
    domainId: "coding",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    fencingToken: "fence_hrun_123_0",
  };
  const result = HarnessRunSchema.safeParse(valid);
  assert.equal(result.success, true, `HarnessRun should be valid: ${JSON.stringify(result.error?.issues)}`);
});

test("HarnessRunSchema preserves optional goal and mode fields", () => {
  const valid = {
    harnessRunId: "hrun_goal_mode",
    tenantId: "tenant_456",
    orgId: "org_456",
    traceId: "trace_456",
    goal: "close review drift",
    mode: "solo",
    riskLevel: "medium",
    riskProfile: createValidRiskPreview(),
    ownership: { ownerId: "owner_1", ownerType: "principal" },
    auditRefs: [],
    auditTrail: { auditRefs: [], evidenceRefs: [] },
    confirmedTaskSpecId: "ctspec_789",
    requestEnvelopeId: "req_env_abc",
    requestHash: "hash_def",
    status: "created",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "vlock_xyz",
    budgetLedgerId: "bledger_uvw",
    budgetEnvelope: {
      budgetLedgerId: "bledger_uvw",
      currency: "USD",
    },
    currentSeq: 0,
    domainId: "coding",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    fencingToken: "fence_hrun_goal_mode_0",
  };
  const result = HarnessRunSchema.parse(valid);
  assert.equal(result.goal, "close review drift");
  assert.equal(result.mode, "solo");
});

test("HarnessRunSchema accepts all valid statuses", () => {
  const statuses = [
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
  for (const status of statuses) {
    const valid = {
      harnessRunId: "hrun_123",
      tenantId: "tenant_456",
      orgId: "org_456",
      traceId: "trace_456",
      riskLevel: "medium",
      riskProfile: createValidRiskPreview(),
      ownership: { ownerId: "owner_1", ownerType: "principal" },
      auditRefs: [],
      auditTrail: { auditRefs: [], evidenceRefs: [] },
      confirmedTaskSpecId: "ctspec_789",
      requestEnvelopeId: "req_env_abc",
      requestHash: "hash_def",
      status,
      constraintPackRef: "constraint-pack-1",
      versionLockId: "vlock_xyz",
      budgetLedgerId: "bledger_uvw",
      budgetEnvelope: {
        budgetLedgerId: "bledger_uvw",
        currency: "USD",
      },
      currentSeq: 0,
      domainId: "coding",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
      fencingToken: "fence_hrun_123_0",
    };
    const result = HarnessRunSchema.safeParse(valid);
    assert.equal(result.success, true, `Status '${status}' should be valid`);
  }
});

test("HarnessRunSchema allows optional terminal fields", () => {
  const valid = {
    harnessRunId: "hrun_123",
    tenantId: "tenant_456",
    orgId: "org_456",
    traceId: "trace_456",
    riskLevel: "high",
    riskProfile: { riskClass: "high", reasons: ["requires approval"] },
    ownership: { ownerId: "owner_1", ownerType: "principal" },
    auditRefs: ["audit-1"],
    auditTrail: { auditRefs: ["audit-1"], evidenceRefs: [] },
    confirmedTaskSpecId: "ctspec_789",
    requestEnvelopeId: "req_env_abc",
    requestHash: "hash_def",
    status: "failed",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "vlock_xyz",
    budgetLedgerId: "bledger_uvw",
    budgetEnvelope: {
      budgetLedgerId: "bledger_uvw",
      currency: "USD",
      maxCost: 100,
    },
    currentSeq: 42,
    domainId: "coding",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T01:00:00.000Z",
    terminalAt: "2026-04-01T01:30:00.000Z",
    terminalReason: "Execution timed out",
    fencingToken: "fence_hrun_123_42",
  };
  const result = HarnessRunSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("HarnessRunSchema rejects negative currentSeq", () => {
  const invalid = {
    harnessRunId: "hrun_123",
    tenantId: "tenant_456",
    orgId: "org_456",
    traceId: "trace_456",
    riskLevel: "medium",
    riskProfile: createValidRiskPreview(),
    ownership: { ownerId: "owner_1", ownerType: "principal" },
    auditRefs: [],
    auditTrail: { auditRefs: [], evidenceRefs: [] },
    confirmedTaskSpecId: "ctspec_789",
    requestEnvelopeId: "req_env_abc",
    requestHash: "hash_def",
    status: "created",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "vlock_xyz",
    budgetLedgerId: "bledger_uvw",
    budgetEnvelope: {
      budgetLedgerId: "bledger_uvw",
      currency: "USD",
    },
    currentSeq: -1,
    domainId: "coding",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    fencingToken: "fence_hrun_123_bad",
  };
  const result = HarnessRunSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// PlanNodeSchema Tests
// ---------------------------------------------------------------------------

test("PlanNodeSchema accepts valid plan node", () => {
  const valid = {
    nodeId: "node_123",
    nodeType: "tool",
    inputRefs: ["input_1", "input_2"],
    outputSchemaRef: "schema://output",
    riskClass: "medium",
    budgetIntent: createValidBudgetIntent(),
    sideEffectProfile: {
      mayCommitExternalEffect: true,
      reversible: false,
    },
    retryPolicyRef: "retry://default",
    timeoutMs: 60000,
  };
  const result = PlanNodeSchema.safeParse(valid);
  assert.equal(result.success, true, `PlanNode should be valid: ${JSON.stringify(result.error?.issues)}`);
});

test("PlanNodeSchema rejects negative timeoutMs", () => {
  const invalid = {
    nodeId: "node_123",
    nodeType: "tool",
    inputRefs: [],
    outputSchemaRef: "schema://output",
    riskClass: "low",
    budgetIntent: createValidBudgetIntent(),
    sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
    retryPolicyRef: "retry://default",
    timeoutMs: -1000,
  };
  const result = PlanNodeSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("PlanNodeSchema rejects zero timeoutMs", () => {
  const invalid = {
    nodeId: "node_123",
    nodeType: "tool",
    inputRefs: [],
    outputSchemaRef: "schema://output",
    riskClass: "low",
    budgetIntent: createValidBudgetIntent(),
    sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
    retryPolicyRef: "retry://default",
    timeoutMs: 0,
  };
  const result = PlanNodeSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("PlanNodeSchema accepts all valid node types", () => {
  const nodeTypes = ["tool", "llm", "hitl_wait", "subgraph", "evaluator", "router", "compensation"];
  for (const nodeType of nodeTypes) {
    const valid = {
      nodeId: "node_123",
      nodeType,
      inputRefs: [],
      outputSchemaRef: "schema://output",
      riskClass: "low",
      budgetIntent: createValidBudgetIntent(),
      sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
      retryPolicyRef: "retry://default",
      timeoutMs: 30000,
    };
    const result = PlanNodeSchema.safeParse(valid);
    assert.equal(result.success, true, `NodeType '${nodeType}' should be valid`);
  }
});

// ---------------------------------------------------------------------------
// PlanEdgeSchema Tests
// ---------------------------------------------------------------------------

test("PlanEdgeSchema accepts valid plan edge", () => {
  const valid = {
    edgeId: "edge_123",
    fromNodeId: "node_1",
    toNodeId: "node_2",
    condition: { type: "always" },
    dependencyType: "hard",
  };
  const result = PlanEdgeSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("PlanEdgeSchema accepts all dependency types", () => {
  const types = ["hard", "soft", "compensation", "retry", "replan"];
  for (const type of types) {
    const valid = {
      edgeId: "edge_123",
      fromNodeId: "node_1",
      toNodeId: "node_2",
      condition: true,
      dependencyType: type,
    };
    const result = PlanEdgeSchema.safeParse(valid);
    assert.equal(result.success, true, `DependencyType '${type}' should be valid`);
  }
});

// ---------------------------------------------------------------------------
// PlanGraphSchema Tests
// ---------------------------------------------------------------------------

test("PlanGraphSchema accepts valid plan graph", () => {
  const valid = {
    graphId: "graph_123",
    nodes: [
      {
        nodeId: "node_1",
        nodeType: "tool",
        inputRefs: [],
        outputSchemaRef: "schema://output",
        riskClass: "low",
        budgetIntent: createValidBudgetIntent(),
        sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
        retryPolicyRef: "retry://default",
        timeoutMs: 30000,
      },
    ],
    edges: [],
    entryNodeIds: ["node_1"],
    terminalNodeIds: ["node_1"],
    joinStrategy: "all",
    graphHash: "sha256:abc123",
  };
  const result = PlanGraphSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("PlanGraphSchema requires at least one node", () => {
  const invalid = {
    graphId: "graph_123",
    nodes: [],
    edges: [],
    entryNodeIds: [],
    terminalNodeIds: [],
    joinStrategy: "all",
    graphHash: "sha256:abc123",
  };
  const result = PlanGraphSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("PlanGraphSchema accepts all join strategies", () => {
  const strategies = ["all", "any", "first_success", "policy"];
  for (const strategy of strategies) {
    const valid = {
      graphId: "graph_123",
      nodes: [
        {
          nodeId: "node_1",
          nodeType: "tool",
          inputRefs: [],
          outputSchemaRef: "schema://output",
          riskClass: "low",
          budgetIntent: createValidBudgetIntent(),
          sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
          retryPolicyRef: "retry://default",
          timeoutMs: 30000,
        },
      ],
      edges: [],
      entryNodeIds: ["node_1"],
      terminalNodeIds: ["node_1"],
      joinStrategy: strategy,
      graphHash: "sha256:abc123",
    };
    const result = PlanGraphSchema.safeParse(valid);
    assert.equal(result.success, true, `Strategy '${strategy}' should be valid`);
  }
});

// ---------------------------------------------------------------------------
// NodeRunSchema Tests
// ---------------------------------------------------------------------------

test("NodeRunSchema accepts valid node run", () => {
  const valid = {
    nodeRunId: "nrun_123",
    harnessRunId: "hrun_456",
    planGraphBundleId: "pgb_789",
    graphVersion: 1,
    nodeId: "node_abc",
    status: "created",
    attemptCount: 0,
    sideEffects: [],
    compensation: [],
    fencingToken: "fence_nrun_123_0",
    currentSeq: 0,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  };
  const result = NodeRunSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("NodeRunSchema accepts all valid statuses", () => {
  const statuses = [
    "created",
    "ready",
    "leased",
    "running",
    "retry_wait",
    "awaiting_hitl",
    "reconciling",
    "succeeded",
    "failed",
    "skipped",
    "cancelled",
    "dependency_failed",
    "policy_blocked",
    "aborted",
  ];
  for (const status of statuses) {
    const valid = {
      nodeRunId: "nrun_123",
      harnessRunId: "hrun_456",
      planGraphBundleId: "pgb_789",
      graphVersion: 1,
      nodeId: "node_abc",
      status,
      attemptCount: 0,
      sideEffects: [],
      compensation: [],
      fencingToken: "fence_nrun_123_0",
      currentSeq: 0,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    };
    const result = NodeRunSchema.safeParse(valid);
    assert.equal(result.success, true, `Status '${status}' should be valid`);
  }
});

test("NodeRunSchema accepts lease metadata and lifecycle refs", () => {
  const valid = {
    nodeRunId: "nrun_123",
    harnessRunId: "hrun_456",
    planGraphBundleId: "pgb_789",
    graphVersion: 1,
    nodeId: "node_abc",
    status: "leased",
    attemptCount: 0,
    sideEffects: ["se_1"],
    compensation: ["comp_1"],
    currentSeq: 0,
    leaseId: "lease_xyz",
    fencingToken: "fence_uvw",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  };
  const result = NodeRunSchema.safeParse(valid);
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// NodeAttemptSchema Tests
// ---------------------------------------------------------------------------

test("NodeAttemptSchema accepts valid node attempt", () => {
  const valid = {
    nodeAttemptId: "nattempt_123",
    nodeRunId: "nrun_456",
    attemptNo: 1,
    attemptKind: "initial",
    startedAt: "2026-04-01T00:00:00.000Z",
    executorRef: "worker_1",
    inputSnapshotRef: createValidArtifactRef(),
  };
  const result = NodeAttemptSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("NodeAttemptSchema accepts all attempt kinds", () => {
  const kinds = ["initial", "retry", "redrive", "recovery"];
  for (const kind of kinds) {
    const valid = {
      nodeAttemptId: `nattempt_${kind}`,
      nodeRunId: "nrun_456",
      attemptNo: 1,
      attemptKind: kind,
      startedAt: "2026-04-01T00:00:00.000Z",
      executorRef: "worker_1",
      inputSnapshotRef: createValidArtifactRef(),
    };
    const result = NodeAttemptSchema.safeParse(valid);
    assert.equal(result.success, true, `AttemptKind '${kind}' should be valid`);
  }
});

test("NodeAttemptSchema rejects zero attemptNo", () => {
  const invalid = {
    nodeAttemptId: "nattempt_123",
    nodeRunId: "nrun_456",
    attemptNo: 0,
    attemptKind: "initial",
    startedAt: "2026-04-01T00:00:00.000Z",
    executorRef: "worker_1",
    inputSnapshotRef: createValidArtifactRef(),
  };
  const result = NodeAttemptSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// AttemptLineageSchema Tests
// ---------------------------------------------------------------------------

test("AttemptLineageSchema accepts valid lineage", () => {
  const valid = {
    attemptLineageId: "alineage_123",
    nodeRunId: "nrun_456",
    reason: "initial attempt started",
    createdBy: "scheduler",
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = AttemptLineageSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("AttemptLineageSchema allows optional previousAttemptId and nextAttemptId", () => {
  const valid = {
    attemptLineageId: "alineage_123",
    nodeRunId: "nrun_456",
    previousAttemptId: "nattempt_prev",
    nextAttemptId: "nattempt_next",
    reason: "attempt transition",
    createdBy: "scheduler",
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = AttemptLineageSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("AttemptLineageSchema rejects empty reason", () => {
  const invalid = {
    attemptLineageId: "alineage_123",
    nodeRunId: "nrun_456",
    reason: "",
    createdBy: "scheduler",
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = AttemptLineageSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// NodeAttemptReceiptSchema Tests
// ---------------------------------------------------------------------------

test("NodeAttemptReceiptSchema accepts valid receipt", () => {
  const valid = {
    nodeAttemptReceiptId: "nreceipt_123",
    nodeAttemptId: "nattempt_456",
    nodeRunId: "nrun_789",
    harnessRunId: "hrun_abc",
    planGraphId: "pgb_def",
    graphVersion: 1,
    receiptKind: "tool",
    status: "succeeded",
    duration: 1500,
    errorDetail: "success",
    sideEffectRefs: [],
    budgetSettlementRefs: [],
    evidenceRefs: [],
    producedAt: "2026-04-01T00:00:00.000Z",
  };
  const result = NodeAttemptReceiptSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("NodeAttemptReceiptSchema accepts all receipt kinds", () => {
  const kinds = ["tool", "llm", "hitl", "subgraph", "evaluator", "router"];
  for (const kind of kinds) {
    const valid = {
      nodeAttemptReceiptId: `nreceipt_${kind}`,
      nodeAttemptId: "nattempt_456",
      nodeRunId: "nrun_789",
      harnessRunId: "hrun_abc",
      planGraphId: "pgb_def",
      graphVersion: 1,
      receiptKind: kind,
      status: "succeeded",
      duration: 100,
      errorDetail: "success",
      sideEffectRefs: [],
      budgetSettlementRefs: [],
      evidenceRefs: [],
      producedAt: "2026-04-01T00:00:00.000Z",
    };
    const result = NodeAttemptReceiptSchema.safeParse(valid);
    assert.equal(result.success, true, `ReceiptKind '${kind}' should be valid`);
  }
});

test("NodeAttemptReceiptSchema accepts all status values", () => {
  const statuses = ["succeeded", "failed", "partial", "blocked"];
  for (const status of statuses) {
    const valid = {
      nodeAttemptReceiptId: "nreceipt_123",
      nodeAttemptId: "nattempt_456",
      nodeRunId: "nrun_789",
      harnessRunId: "hrun_abc",
      planGraphId: "pgb_def",
      graphVersion: 1,
      receiptKind: "tool",
      status,
      duration: 100,
      errorDetail: status === "succeeded" ? "success" : "error occurred",
      sideEffectRefs: [],
      budgetSettlementRefs: [],
      evidenceRefs: [],
      producedAt: "2026-04-01T00:00:00.000Z",
    };
    const result = NodeAttemptReceiptSchema.safeParse(valid);
    assert.equal(result.success, true, `Status '${status}' should be valid`);
  }
});

test("NodeAttemptReceiptSchema allows optional outputRef and error", () => {
  const valid = {
    nodeAttemptReceiptId: "nreceipt_123",
    nodeAttemptId: "nattempt_456",
    nodeRunId: "nrun_789",
    harnessRunId: "hrun_abc",
    planGraphId: "pgb_def",
    graphVersion: 1,
    receiptKind: "tool",
    status: "succeeded",
    duration: 1500,
    outputRef: createValidArtifactRef(),
    errorDetail: "success",
    sideEffectRefs: [],
    budgetSettlementRefs: [],
    evidenceRefs: [],
    producedAt: "2026-04-01T00:00:00.000Z",
  };
  const result = NodeAttemptReceiptSchema.safeParse(valid);
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// BudgetLedgerSchema Tests
// ---------------------------------------------------------------------------

test("BudgetLedgerSchema accepts valid ledger", () => {
  const valid = {
    budgetLedgerId: "bledger_123",
    tenantId: "tenant_456",
    harnessRunId: "hrun_789",
    currency: "USD",
    hardCap: 10000,
    reservedAmount: 5000,
    settledAmount: 2000,
    releasedAmount: 1000,
    status: "open",
    version: 1,
  };
  const result = BudgetLedgerSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("BudgetLedgerSchema allows optional softCap", () => {
  const valid = {
    budgetLedgerId: "bledger_123",
    tenantId: "tenant_456",
    harnessRunId: "hrun_789",
    currency: "USD",
    hardCap: 10000,
    softCap: 8000,
    reservedAmount: 5000,
    settledAmount: 2000,
    releasedAmount: 1000,
    status: "open",
    version: 1,
  };
  const result = BudgetLedgerSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("BudgetLedgerSchema accepts all status values", () => {
  const statuses = ["open", "soft_cap_reached", "hard_cap_reached", "closed", "settling", "reserving", "releasing"];
  for (const status of statuses) {
    const valid = {
      budgetLedgerId: "bledger_123",
      tenantId: "tenant_456",
      harnessRunId: "hrun_789",
      currency: "USD",
      hardCap: 10000,
      reservedAmount: 0,
      settledAmount: 0,
      releasedAmount: 0,
      status,
      version: 1,
    };
    const result = BudgetLedgerSchema.safeParse(valid);
    assert.equal(result.success, true, `Status '${status}' should be valid`);
  }
});

test("BudgetLedgerSchema rejects negative hardCap", () => {
  const invalid = {
    budgetLedgerId: "bledger_123",
    tenantId: "tenant_456",
    harnessRunId: "hrun_789",
    currency: "USD",
    hardCap: -100,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    status: "open",
    version: 1,
  };
  const result = BudgetLedgerSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// BudgetReservationSchema Tests
// ---------------------------------------------------------------------------

test("BudgetReservationSchema accepts valid reservation", () => {
  const valid = {
    budgetReservationId: "bresv_123",
    budgetLedgerId: "bledger_456",
    harnessRunId: "hrun_789",
    amount: 1000,
    resourceKind: "token",
    status: "reserved",
    expiresAt: "2026-04-02T00:00:00.000Z",
    createdAt: "2026-04-01T00:00:00.000Z",
    version: 0,
  };
  const result = BudgetReservationSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("BudgetReservationSchema accepts all resource kinds", () => {
  const kinds = ["token", "tool", "api", "compute", "human", "side_effect", "other"];
  for (const kind of kinds) {
    const valid = {
      budgetReservationId: `bresv_${kind}`,
      budgetLedgerId: "bledger_456",
      harnessRunId: "hrun_789",
      amount: 1000,
      resourceKind: kind,
      status: "reserved",
      expiresAt: "2026-04-02T00:00:00.000Z",
      createdAt: "2026-04-01T00:00:00.000Z",
      version: 0,
    };
    const result = BudgetReservationSchema.safeParse(valid);
    assert.equal(result.success, true, `ResourceKind '${kind}' should be valid`);
  }
});

test("BudgetReservationSchema accepts all status values", () => {
  const statuses = ["reserved", "settled", "released", "expired", "rejected"];
  for (const status of statuses) {
    const valid = {
      budgetReservationId: "bresv_123",
      budgetLedgerId: "bledger_456",
      harnessRunId: "hrun_789",
      amount: 1000,
      resourceKind: "token",
      status,
      expiresAt: "2026-04-02T00:00:00.000Z",
      createdAt: "2026-04-01T00:00:00.000Z",
      version: 0,
    };
    const result = BudgetReservationSchema.safeParse(valid);
    assert.equal(result.success, true, `Status '${status}' should be valid`);
  }
});

test("BudgetReservationSchema rejects zero amount", () => {
  const invalid = {
    budgetReservationId: "bresv_123",
    budgetLedgerId: "bledger_456",
    harnessRunId: "hrun_789",
    amount: 0,
    resourceKind: "token",
    status: "reserved",
    expiresAt: "2026-04-02T00:00:00.000Z",
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = BudgetReservationSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// BudgetSettlementSchema Tests
// ---------------------------------------------------------------------------

test("BudgetSettlementSchema accepts valid settlement", () => {
  const valid = {
    budgetSettlementId: "bsettle_123",
    budgetReservationId: "bresv_456",
    actualAmount: 800,
    settlementKind: "final",
    evidenceRefs: [],
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = BudgetSettlementSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("BudgetSettlementSchema accepts all settlement kinds", () => {
  const kinds = ["final", "partial", "release_unused", "correction"];
  for (const kind of kinds) {
    const valid = {
      budgetSettlementId: `bsettle_${kind}`,
      budgetReservationId: "bresv_456",
      actualAmount: 100,
      settlementKind: kind,
      evidenceRefs: [],
      createdAt: "2026-04-01T00:00:00.000Z",
    };
    const result = BudgetSettlementSchema.safeParse(valid);
    assert.equal(result.success, true, `SettlementKind '${kind}' should be valid`);
  }
});

test("BudgetSettlementSchema accepts zero actualAmount", () => {
  const valid = {
    budgetSettlementId: "bsettle_123",
    budgetReservationId: "bresv_456",
    actualAmount: 0,
    settlementKind: "release_unused",
    evidenceRefs: [],
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = BudgetSettlementSchema.safeParse(valid);
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// RunVersionLockSchema Tests
// ---------------------------------------------------------------------------

test("RunVersionLockSchema accepts valid version lock", () => {
  const valid = {
    runVersionLockId: "rvlock_123",
    harnessRunId: "hrun_456",
    schemaVersion: "v4.3",
    runtimeProfileVersion: "profile_v1",
    promptVersions: { "prompt_1": "v1.0" },
    policyVersions: { "policy_1": "v1.0" },
    toolVersions: { "tool_1": "v1.0" },
    modelVersions: { "model_1": "v1.0" },
    evalVersions: { "eval_1": "v1.0" },
    guardrailVersions: { "guard_1": "v1.0" },
    domainVersions: { "domain_1": "v1.0" },
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = RunVersionLockSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("RunVersionLockSchema allows empty version maps", () => {
  const valid = {
    runVersionLockId: "rvlock_123",
    harnessRunId: "hrun_456",
    schemaVersion: "v4.3",
    runtimeProfileVersion: "profile_v1",
    promptVersions: {},
    policyVersions: {},
    toolVersions: {},
    modelVersions: {},
    evalVersions: {},
    guardrailVersions: {},
    domainVersions: {},
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = RunVersionLockSchema.safeParse(valid);
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// ArtifactVersionLockSchema Tests
// ---------------------------------------------------------------------------

test("ArtifactVersionLockSchema accepts valid artifact lock", () => {
  const valid = {
    artifactId: "artifact_123",
    version: "v1.0.0",
    hash: "sha256:abc123",
    storageUri: "s3://bucket/path",
    retentionPolicyRef: "policy_30d",
  };
  const result = ArtifactVersionLockSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("ArtifactVersionLockSchema rejects empty artifactId", () => {
  const invalid = {
    artifactId: "",
    version: "v1.0.0",
    hash: "sha256:abc123",
    storageUri: "s3://bucket/path",
    retentionPolicyRef: "policy_30d",
  };
  const result = ArtifactVersionLockSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// ArtifactVersionLockSetSchema Tests
// ---------------------------------------------------------------------------

test("ArtifactVersionLockSetSchema accepts valid lock set", () => {
  const valid = {
    artifactVersionLockSetId: "avlocks_123",
    harnessRunId: "hrun_456",
    artifactLocks: [
      {
        artifactId: "artifact_1",
        version: "v1.0.0",
        hash: "sha256:abc123",
        storageUri: "s3://bucket/path1",
        retentionPolicyRef: "policy_30d",
      },
      {
        artifactId: "artifact_2",
        version: "v2.0.0",
        hash: "sha256:def456",
        storageUri: "s3://bucket/path2",
        retentionPolicyRef: "policy_30d",
      },
    ],
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = ArtifactVersionLockSetSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("ArtifactVersionLockSetSchema requires at least one artifact lock", () => {
  const invalid = {
    artifactVersionLockSetId: "avlocks_123",
    harnessRunId: "hrun_456",
    artifactLocks: [],
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = ArtifactVersionLockSetSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// PolicyFindingSchema Tests
// ---------------------------------------------------------------------------

test("PolicyFindingSchema accepts valid policy finding", () => {
  const valid = {
    code: "POLICY_001",
    severity: "high",
    message: "External API call detected",
  };
  const result = PolicyFindingSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("PolicyFindingSchema accepts all severity levels", () => {
  const severities = ["low", "medium", "high", "critical"];
  for (const severity of severities) {
    const valid = {
      code: "POLICY_001",
      severity,
      message: "Test finding",
    };
    const result = PolicyFindingSchema.safeParse(valid);
    assert.equal(result.success, true, `Severity '${severity}' should be valid`);
  }
});

// ---------------------------------------------------------------------------
// DecisionInputBundleSchema Tests
// ---------------------------------------------------------------------------

test("DecisionInputBundleSchema accepts valid bundle", () => {
  const valid = {
    decisionInputBundleId: "dib_123",
    harnessRunId: "hrun_456",
    decisionKind: "approve",
    riskClass: "medium",
    contextRefs: [],
    evidenceRefs: [],
    policyFindings: [],
    sideEffectRefs: [],
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = DecisionInputBundleSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("DecisionInputBundleSchema accepts all decision kinds", () => {
  const kinds = ["approve", "reject", "patch", "takeover", "resume", "abort", "retry", "replan"];
  for (const kind of kinds) {
    const valid = {
      decisionInputBundleId: `dib_${kind}`,
      harnessRunId: "hrun_456",
      decisionKind: kind,
      riskClass: "low",
      contextRefs: [],
      evidenceRefs: [],
      policyFindings: [],
      sideEffectRefs: [],
      createdAt: "2026-04-01T00:00:00.000Z",
    };
    const result = DecisionInputBundleSchema.safeParse(valid);
    assert.equal(result.success, true, `DecisionKind '${kind}' should be valid`);
  }
});

// ---------------------------------------------------------------------------
// HarnessDecisionSchema Tests
// ---------------------------------------------------------------------------

test("HarnessDecisionSchema accepts valid decision", () => {
  const valid = {
    harnessDecisionId: "hdecision_123",
    decisionInputBundleId: "dib_456",
    decisionKind: "approve",
    decision: "accept",
    deciderType: "system",
    deciderRef: "policy_engine",
    reasonCode: "AUTO_APPROVE",
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = HarnessDecisionSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("HarnessDecisionSchema accepts all decision values - canonical 6 + production extensions", () => {
  // R2-26/R2-27/R2-28 fix: §58.6 defines 6 basic decisions + 4 production extensions
  const decisions = [
    // Basic 6 per §58.6
    "accept",
    "retry_same_plan",
    "replan",
    "escalate_to_human",
    "downgrade_mode",
    "abort",
    // Production extensions
    "quarantine",
    "revoke_approval",
    "pause_for_external",
    "require_revalidation",
  ];
  for (const decision of decisions) {
    const valid = {
      harnessDecisionId: `hdecision_${decision}`,
      decisionInputBundleId: "dib_456",
      decisionKind: "approve",
      decision,
      deciderType: "system",
      deciderRef: "policy_engine",
      reasonCode: "TEST",
      createdAt: "2026-04-01T00:00:00.000Z",
    };
    const result = HarnessDecisionSchema.safeParse(valid);
    assert.equal(result.success, true, `Decision '${decision}' should be valid`);
  }
});

test("HarnessDecisionSchema rejects legacy decision values", () => {
  // R2-26/R2-27 fix: reject/return/retry/escalate/takeover/patch are no longer valid
  const legacyDecisions = ["reject", "retry", "escalate", "takeover", "patch"];
  for (const decision of legacyDecisions) {
    const invalid = {
      harnessDecisionId: `hdecision_${decision}`,
      decisionInputBundleId: "dib_456",
      decisionKind: "approve",
      decision,
      deciderType: "system",
      deciderRef: "policy_engine",
      reasonCode: "TEST",
      createdAt: "2026-04-01T00:00:00.000Z",
    };
    const result = HarnessDecisionSchema.safeParse(invalid);
    assert.equal(result.success, false, `Legacy decision '${decision}' should be rejected`);
  }
});

test("HarnessDecisionSchema accepts all decider types", () => {
  // R2-26 fix: llm added as valid deciderType per §58.6
  const deciderTypes = ["system", "policy", "evaluator", "human", "operator", "llm"];
  for (const type of deciderTypes) {
    const valid = {
      harnessDecisionId: `hdecision_${type}`,
      decisionInputBundleId: "dib_456",
      decisionKind: "approve",
      decision: "accept",
      deciderType: type,
      deciderRef: "test_ref",
      reasonCode: "TEST",
      createdAt: "2026-04-01T00:00:00.000Z",
    };
    const result = HarnessDecisionSchema.safeParse(valid);
    assert.equal(result.success, true, `DeciderType '${type}' should be valid`);
  }
});

// ---------------------------------------------------------------------------
// HumanResponsibilityRecordSchema Tests
// ---------------------------------------------------------------------------

test("HumanResponsibilityRecordSchema accepts valid record", () => {
  const valid = {
    humanResponsibilityRecordId: "hrrecord_123",
    harnessDecisionId: "hdecision_456",
    humanActorRef: createValidPrincipalRef(),
    responsibilityScope: "approval",
    acknowledgedRiskClass: "high",
    acknowledgementReceiptRef: createValidArtifactRef(),
    effectiveFrom: "2026-04-01T00:00:00.000Z",
  };
  const result = HumanResponsibilityRecordSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("HumanResponsibilityRecordSchema accepts all responsibility scopes", () => {
  const scopes = ["approval", "override", "takeover", "patch", "resume", "abort", "compensation"];
  for (const scope of scopes) {
    const valid = {
      humanResponsibilityRecordId: `hrrecord_${scope}`,
      harnessDecisionId: "hdecision_456",
      humanActorRef: createValidPrincipalRef(),
      responsibilityScope: scope,
      acknowledgedRiskClass: "medium",
      acknowledgementReceiptRef: createValidArtifactRef(),
      effectiveFrom: "2026-04-01T00:00:00.000Z",
    };
    const result = HumanResponsibilityRecordSchema.safeParse(valid);
    assert.equal(result.success, true, `Scope '${scope}' should be valid`);
  }
});

// ---------------------------------------------------------------------------
// EventEnvelopeSchema Tests
// ---------------------------------------------------------------------------

test("EventEnvelopeSchema accepts valid envelope", () => {
  const valid = {
    eventId: "evt_123",
    runId: "run_456",
    eventType: "platform.task.created",
    schemaVersion: 1,
    aggregateType: "Task",
    aggregateId: "task_789",
    aggregateSeq: 1,
    tenantId: "tenant_abc",
    traceId: "trace_def",
    payloadHash: "sha256:hash123",
    payload: { taskId: "task_789" },
    replayBehavior: "replay_as_fact",
    occurredAt: "2026-04-01T00:00:00.000Z",
  };
  const result = EventEnvelopeSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("EventEnvelopeSchema accepts all replay behaviors", () => {
  const behaviors = ["replay_as_fact", "skip_side_effect", "simulate", "forbidden"];
  for (const behavior of behaviors) {
    const valid = {
      eventId: "evt_123",
      runId: "run_456",
      eventType: "platform.task.created",
      schemaVersion: 1,
      aggregateType: "Task",
      aggregateId: "task_789",
      aggregateSeq: 1,
      tenantId: "tenant_abc",
      traceId: "trace_def",
      payloadHash: "sha256:hash123",
      payload: {},
      replayBehavior: behavior,
      occurredAt: "2026-04-01T00:00:00.000Z",
    };
    const result = EventEnvelopeSchema.safeParse(valid);
    assert.equal(result.success, true, `ReplayBehavior '${behavior}' should be valid`);
  }
});

test("EventEnvelopeSchema allows optional fields", () => {
  const valid = {
    eventId: "evt_123",
    runId: "run_456",
    eventType: "platform.task.created",
    schemaVersion: 1,
    aggregateType: "Task",
    aggregateId: "task_789",
    aggregateSeq: 1,
    tenantId: "tenant_abc",
    traceId: "trace_def",
    payloadHash: "sha256:hash123",
    payload: {},
    replayBehavior: "replay_as_fact",
    causationId: "evt_parent",
    correlationId: "corr_123",
    sourceOfTruth: "platform",
    schemaOwner: "platform-runtime",
    consumerContractTests: ["test_1", "test_2"],
    occurredAt: "2026-04-01T00:00:00.000Z",
  };
  const result = EventEnvelopeSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("EventEnvelopeSchema rejects negative schemaVersion", () => {
  const invalid = {
    eventId: "evt_123",
    runId: "run_456",
    eventType: "platform.task.created",
    schemaVersion: -1,
    aggregateType: "Task",
    aggregateId: "task_789",
    aggregateSeq: 1,
    tenantId: "tenant_abc",
    traceId: "trace_def",
    payloadHash: "sha256:hash123",
    payload: {},
    replayBehavior: "replay_as_fact",
    occurredAt: "2026-04-01T00:00:00.000Z",
  };
  const result = EventEnvelopeSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("EventEnvelopeSchema rejects zero aggregateSeq", () => {
  const invalid = {
    eventId: "evt_123",
    runId: "run_456",
    eventType: "platform.task.created",
    schemaVersion: 1,
    aggregateType: "Task",
    aggregateId: "task_789",
    aggregateSeq: 0,
    tenantId: "tenant_abc",
    traceId: "trace_def",
    payloadHash: "sha256:hash123",
    payload: {},
    replayBehavior: "replay_as_fact",
    occurredAt: "2026-04-01T00:00:00.000Z",
  };
  const result = EventEnvelopeSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// PlatformFactEventSchema Tests
// ---------------------------------------------------------------------------

test("PlatformFactEventSchema requires platform.* event type", () => {
  const valid = {
    eventId: "evt_123",
    runId: "run_456",
    eventType: "platform.task.created",
    schemaVersion: 1,
    aggregateType: "Task",
    aggregateId: "task_789",
    aggregateSeq: 1,
    tenantId: "tenant_abc",
    traceId: "trace_def",
    correlationId: "run_456",
    source: "platform-runtime",
    payloadHash: "sha256:hash123",
    payload: {},
    replayBehavior: "replay_as_fact",
    occurredAt: "2026-04-01T00:00:00.000Z",
  };
  const result = PlatformFactEventSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("PlatformFactEventSchema rejects non-platform event type", () => {
  const invalid = {
    eventId: "evt_123",
    runId: "run_456",
    eventType: "user.task.created",
    schemaVersion: 1,
    aggregateType: "Task",
    aggregateId: "task_789",
    aggregateSeq: 1,
    tenantId: "tenant_abc",
    traceId: "trace_def",
    correlationId: "run_456",
    source: "platform-runtime",
    payloadHash: "sha256:hash123",
    payload: {},
    replayBehavior: "replay_as_fact",
    occurredAt: "2026-04-01T00:00:00.000Z",
  };
  const result = PlatformFactEventSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// OapeflirViewEventSchema Tests
// ---------------------------------------------------------------------------

test("OapeflirViewEventSchema requires oapeflir.view.* event type", () => {
  const valid = {
    eventId: "evt_123",
    runId: "run_456",
    eventType: "oapeflir.view.run_lifecycle",
    schemaVersion: 1,
    aggregateType: "RunLifecycle",
    aggregateId: "run_789",
    aggregateSeq: 1,
    tenantId: "tenant_abc",
    traceId: "trace_def",
    payloadHash: "sha256:hash123",
    payload: {},
    replayBehavior: "simulate",
    derivedFromEventIds: ["evt_1", "evt_2"],
    projectionOnly: true as const,
    occurredAt: "2026-04-01T00:00:00.000Z",
  };
  const result = OapeflirViewEventSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("OapeflirViewEventSchema requires oapeflir.rationale.* event type", () => {
  const valid = {
    eventId: "evt_123",
    runId: "run_456",
    eventType: "oapeflir.rationale.decision_making",
    schemaVersion: 1,
    aggregateType: "Rationale",
    aggregateId: "rat_789",
    aggregateSeq: 1,
    tenantId: "tenant_abc",
    traceId: "trace_def",
    payloadHash: "sha256:hash123",
    payload: {},
    replayBehavior: "simulate",
    derivedFromEventIds: ["evt_1"],
    projectionOnly: true as const,
    occurredAt: "2026-04-01T00:00:00.000Z",
  };
  const result = OapeflirViewEventSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("OapeflirViewEventSchema rejects non-oapeflir event type", () => {
  const invalid = {
    eventId: "evt_123",
    runId: "run_456",
    eventType: "platform.task.created",
    schemaVersion: 1,
    aggregateType: "Task",
    aggregateId: "task_789",
    aggregateSeq: 1,
    tenantId: "tenant_abc",
    traceId: "trace_def",
    payloadHash: "sha256:hash123",
    payload: {},
    replayBehavior: "simulate",
    derivedFromEventIds: ["evt_1"],
    projectionOnly: true as const,
    occurredAt: "2026-04-01T00:00:00.000Z",
  };
  const result = OapeflirViewEventSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("OapeflirViewEventSchema requires non-empty derivedFromEventIds", () => {
  const invalid = {
    eventId: "evt_123",
    runId: "run_456",
    eventType: "oapeflir.view.test",
    schemaVersion: 1,
    aggregateType: "Test",
    aggregateId: "test_789",
    aggregateSeq: 1,
    tenantId: "tenant_abc",
    traceId: "trace_def",
    payloadHash: "sha256:hash123",
    payload: {},
    replayBehavior: "simulate",
    derivedFromEventIds: [],
    projectionOnly: true as const,
    occurredAt: "2026-04-01T00:00:00.000Z",
  };
  const result = OapeflirViewEventSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("OapeflirViewEventSchema requires projectionOnly to be true", () => {
  const invalid = {
    eventId: "evt_123",
    runId: "run_456",
    eventType: "oapeflir.view.test",
    schemaVersion: 1,
    aggregateType: "Test",
    aggregateId: "test_789",
    aggregateSeq: 1,
    tenantId: "tenant_abc",
    traceId: "trace_def",
    payloadHash: "sha256:hash123",
    payload: {},
    replayBehavior: "simulate",
    derivedFromEventIds: ["evt_1"],
    projectionOnly: false,
    occurredAt: "2026-04-01T00:00:00.000Z",
  };
  const result = OapeflirViewEventSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// SideEffectRecordSchema Tests
// ---------------------------------------------------------------------------

test("SideEffectRecordSchema accepts valid side effect record", () => {
  const valid = {
    sideEffectId: "seffect_123",
    harnessRunId: "hrun_456",
    nodeRunId: "nrun_789",
    nodeAttemptId: "nattempt_abc",
    effectKind: "external_api",
    idempotencyKey: "idem_def",
    status: "proposed",
    riskClass: "high",
    preCommitPolicyProofRef: createValidArtifactRef(),
    deadline: "2026-04-02T00:00:00.000Z",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    version: 0,
  };
  const result = SideEffectRecordSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("SideEffectRecordSchema accepts all effect kinds", () => {
  const kinds = ["file_write", "external_api", "message_send", "transaction", "tool_commit", "other"];
  for (const kind of kinds) {
    const valid = {
      sideEffectId: `seffect_${kind}`,
      harnessRunId: "hrun_456",
      nodeRunId: "nrun_789",
      nodeAttemptId: "nattempt_abc",
      effectKind: kind,
      idempotencyKey: "idem_def",
      status: "proposed",
      riskClass: "low",
      preCommitPolicyProofRef: createValidArtifactRef(),
      deadline: "2026-04-02T00:00:00.000Z",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
      version: 0,
    };
    const result = SideEffectRecordSchema.safeParse(valid);
    assert.equal(result.success, true, `EffectKind '${kind}' should be valid`);
  }
});

test("SideEffectRecordSchema accepts all side effect statuses", () => {
  const statuses = [
    "proposed",
    "approved",
    "reserved",
    "committing",
    "committed",
    "confirming",
    "confirmed",
    "ambiguous",
    "manual_review_required",
    "reconciling",
    "compensation_required",
    "compensating",
    "compensated",
    "failed",
    "revoked",
    "expired",
  ];
  for (const status of statuses) {
    const valid = {
      sideEffectId: `seffect_${status}`,
      harnessRunId: "hrun_456",
      nodeRunId: "nrun_789",
      nodeAttemptId: "nattempt_abc",
      effectKind: "external_api",
      idempotencyKey: "idem_def",
      status,
      riskClass: "low",
      preCommitPolicyProofRef: createValidArtifactRef(),
      deadline: "2026-04-02T00:00:00.000Z",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
      version: 0,
    };
    const result = SideEffectRecordSchema.safeParse(valid);
    assert.equal(result.success, true, `Status '${status}' should be valid`);
  }
});

// ---------------------------------------------------------------------------
// ReconciliationRecordSchema Tests
// ---------------------------------------------------------------------------

test("ReconciliationRecordSchema accepts valid reconciliation record", () => {
  const valid = {
    reconciliationId: "recon_123",
    sideEffectId: "seffect_456",
    probeKind: "http_get",
    externalObservedState: { status: 200, body: "ok" },
    result: "confirmed",
    evidenceRefs: [createValidArtifactRef()],
    nextAction: "mark_confirmed",
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = ReconciliationRecordSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("ReconciliationRecordSchema accepts all result values", () => {
  const results = ["confirmed", "not_found", "ambiguous", "failed"];
  for (const resultVal of results) {
    const valid = {
      reconciliationId: `recon_${resultVal}`,
      sideEffectId: "seffect_456",
      probeKind: "test_probe",
      externalObservedState: {},
      result: resultVal,
      evidenceRefs: [],
      nextAction: "mark_confirmed",
      createdAt: "2026-04-01T00:00:00.000Z",
    };
    const result = ReconciliationRecordSchema.safeParse(valid);
    assert.equal(result.success, true, `Result '${resultVal}' should be valid`);
  }
});

test("ReconciliationRecordSchema accepts all next action values", () => {
  const actions = ["mark_confirmed", "retry_probe", "compensate", "escalate_hitl", "mark_failed"];
  for (const action of actions) {
    const valid = {
      reconciliationId: `recon_${action}`,
      sideEffectId: "seffect_456",
      probeKind: "test_probe",
      externalObservedState: {},
      result: "confirmed",
      evidenceRefs: [],
      nextAction: action,
      createdAt: "2026-04-01T00:00:00.000Z",
    };
    const result = ReconciliationRecordSchema.safeParse(valid);
    assert.equal(result.success, true, `NextAction '${action}' should be valid`);
  }
});

// ---------------------------------------------------------------------------
// CompensationRecordSchema Tests
// ---------------------------------------------------------------------------

test("CompensationRecordSchema accepts valid compensation record", () => {
  const valid = {
    compensationId: "comp_123",
    sideEffectId: "seffect_456",
    harnessRunId: "hrun_789",
    planRef: createValidArtifactRef(),
    status: "planned",
    evidenceRefs: [],
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = CompensationRecordSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("CompensationRecordSchema accepts all status values", () => {
  const statuses = ["planned", "running", "succeeded", "failed", "requires_human"];
  for (const status of statuses) {
    const valid = {
      compensationId: `comp_${status}`,
      sideEffectId: "seffect_456",
      harnessRunId: "hrun_789",
      planRef: createValidArtifactRef(),
      status,
      evidenceRefs: [],
      createdAt: "2026-04-01T00:00:00.000Z",
    };
    const result = CompensationRecordSchema.safeParse(valid);
    assert.equal(result.success, true, `Status '${status}' should be valid`);
  }
});

test("CompensationRecordSchema allows optional completedAt", () => {
  const valid = {
    compensationId: "comp_123",
    sideEffectId: "seffect_456",
    harnessRunId: "hrun_789",
    planRef: createValidArtifactRef(),
    status: "succeeded",
    evidenceRefs: [],
    createdAt: "2026-04-01T00:00:00.000Z",
    completedAt: "2026-04-01T01:00:00.000Z",
  };
  const result = CompensationRecordSchema.safeParse(valid);
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// CONTRACT_ZOD_SCHEMAS Integration Tests
// ---------------------------------------------------------------------------

test("CONTRACT_ZOD_SCHEMAS contains all canonical contract schemas", () => {
  const expectedSchemas: Array<keyof typeof CONTRACT_ZOD_SCHEMAS> = [
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
  ];

  for (const name of expectedSchemas) {
    assert.ok(
      CONTRACT_ZOD_SCHEMAS[name] != null,
      `CONTRACT_ZOD_SCHEMAS should contain '${name}'`,
    );
    assert.equal(
      typeof CONTRACT_ZOD_SCHEMAS[name].safeParse,
      "function",
      `Schema '${name}' should have safeParse method`,
    );
  }
});

test("CONTRACT_ZOD_SCHEMAS schemas can parse their corresponding factory-created objects", () => {
  // This test verifies that the schemas align with the factory functions
  // by testing that valid factory output passes schema validation

  const principal = createValidPrincipalRef();
  const artifact = createValidArtifactRef();
  const budgetIntent = createValidBudgetIntent();
  const riskPreview = createValidRiskPreview();

  // Test TaskDraft schema
  const taskDraftData = {
    taskDraftId: "draft_123",
    tenantId: "tenant_456",
    principal,
    source: "nl",
    normalizedIntent: { goal: "test" },
    missingFields: [],
    riskPreview,
    ambiguityPolicy: "safe_default" as const,
    domainId: "coding",
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const taskDraftResult = CONTRACT_ZOD_SCHEMAS.TaskDraft.safeParse(taskDraftData);
  assert.equal(taskDraftResult.success, true, `TaskDraft should parse: ${JSON.stringify(taskDraftResult.error?.issues)}`);

  // Test HarnessRun schema
  const harnessRunData = {
    harnessRunId: "hrun_123",
    tenantId: "tenant_456",
    orgId: "org_456",
    traceId: "trace_456",
    riskLevel: "medium" as const,
    riskProfile: riskPreview,
    ownership: { ownerId: "owner_1", ownerType: "principal" },
    auditRefs: [],
    auditTrail: { auditRefs: [], evidenceRefs: [] },
    confirmedTaskSpecId: "ctspec_789",
    requestEnvelopeId: "req_env_abc",
    requestHash: "hash_def",
    status: "created" as const,
    constraintPackRef: "constraint-pack-1",
    versionLockId: "vlock_xyz",
    budgetLedgerId: "bledger_uvw",
    budgetEnvelope: {
      budgetLedgerId: "bledger_uvw",
      currency: "USD",
      maxCost: 100,
    },
    currentSeq: 0,
    domainId: "coding",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    fencingToken: "fence_hrun_123_0",
  };
  const harnessRunResult = CONTRACT_ZOD_SCHEMAS.HarnessRun.safeParse(harnessRunData);
  assert.equal(harnessRunResult.success, true, `HarnessRun should parse: ${JSON.stringify(harnessRunResult.error?.issues)}`);

  // Test NodeRun schema
  const nodeRunData = {
    nodeRunId: "nrun_123",
    harnessRunId: "hrun_456",
    planGraphBundleId: "pgb_789",
    graphVersion: 1,
    nodeId: "node_abc",
    status: "created" as const,
    attemptCount: 0,
    sideEffects: [],
    compensation: [],
    fencingToken: "fence_nrun_123_0",
    currentSeq: 0,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  };
  const nodeRunResult = CONTRACT_ZOD_SCHEMAS.NodeRun.safeParse(nodeRunData);
  assert.equal(nodeRunResult.success, true, `NodeRun should parse: ${JSON.stringify(nodeRunResult.error?.issues)}`);

  // Test BudgetLedger schema
  const budgetLedgerData = {
    budgetLedgerId: "bledger_123",
    tenantId: "tenant_456",
    harnessRunId: "hrun_789",
    currency: "USD",
    hardCap: 10000,
    reservedAmount: 5000,
    settledAmount: 2000,
    releasedAmount: 1000,
    status: "open" as const,
    version: 1,
  };
  const budgetLedgerResult = CONTRACT_ZOD_SCHEMAS.BudgetLedger.safeParse(budgetLedgerData);
  assert.equal(budgetLedgerResult.success, true, `BudgetLedger should parse: ${JSON.stringify(budgetLedgerResult.error?.issues)}`);
});

// ---------------------------------------------------------------------------
// GraphPatchOperationTypeSchema Tests
// ---------------------------------------------------------------------------

test("GraphPatchOperationTypeSchema accepts all valid operation types", () => {
  const operationTypes = [
    "add_node",
    "add_edge",
    "disable_edge",
    "add_compensation_node",
    "add_failure_path",
    "mark_skipped",
    "append_subgraph",
  ];
  for (const type of operationTypes) {
    const result = GraphPatchOperationTypeSchema.safeParse(type);
    assert.equal(result.success, true, `OperationType '${type}' should be valid`);
  }
});

// ---------------------------------------------------------------------------
// GraphPatchSchema Tests
// ---------------------------------------------------------------------------

test("GraphPatchSchema accepts valid graph patch", () => {
  const valid = {
    graphPatchId: "gpatch_123",
    harnessRunId: "hrun_456",
    baseGraphVersion: 1,
    newGraphVersion: 2,
    operations: [
      {
        operationId: "op_1",
        operationType: "add_node",
        targetRef: "node_new",
        payload: { nodeType: "tool" },
      },
    ],
    affectedExecutedNodes: [],
    affectedSideEffects: [],
    compatibilityClass: "safe_append",
    policyProofRef: createValidArtifactRef(),
    auditRef: createValidArtifactRef(),
  };
  const result = GraphPatchSchema.safeParse(valid);
  assert.equal(result.success, true, `GraphPatch should be valid: ${JSON.stringify(result.error?.issues)}`);
});

test("GraphPatchSchema accepts all compatibility classes", () => {
  const classes = [
    "safe_append",
    "requires_checkpoint_revalidation",
    "requires_human_approval",
    "incompatible_restart_required",
  ];
  for (const cls of classes) {
    const valid = {
      graphPatchId: "gpatch_123",
      harnessRunId: "hrun_456",
      baseGraphVersion: 1,
      newGraphVersion: 2,
      operations: [
        {
          operationId: "op_1",
          operationType: "add_node",
          targetRef: "node_new",
          payload: {},
        },
      ],
      affectedExecutedNodes: [],
      affectedSideEffects: [],
      compatibilityClass: cls,
      policyProofRef: createValidArtifactRef(),
      auditRef: createValidArtifactRef(),
    };
    const result = GraphPatchSchema.safeParse(valid);
    assert.equal(result.success, true, `CompatibilityClass '${cls}' should be valid`);
  }
});

// ---------------------------------------------------------------------------
// GraphPatchOperationSchema Tests
// ---------------------------------------------------------------------------

test("GraphPatchOperationSchema accepts valid operation", () => {
  const valid = {
    operationId: "op_123",
    operationType: "add_node",
    targetRef: "node_1",
    payload: { type: "tool", name: "test_tool" },
  };
  const result = GraphPatchOperationSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("GraphPatchOperationSchema accepts any payload structure", () => {
  const payloads = [
    { type: "string" },
    123,
    true,
    null,
    [{ nested: "array" }],
    { deep: { nested: { value: 1 } } },
  ];
  for (const payload of payloads) {
    const valid = {
      operationId: "op_1",
      operationType: "add_node",
      targetRef: "node_1",
      payload,
    };
    const result = GraphPatchOperationSchema.safeParse(valid);
    assert.equal(result.success, true, `Payload ${JSON.stringify(payload)} should be valid`);
  }
});

// ---------------------------------------------------------------------------
// ReadyNodeSchedulingPolicySchema Tests
// ---------------------------------------------------------------------------

test("ReadyNodeSchedulingPolicySchema accepts valid policy", () => {
  const valid = {
    policyId: "policy_123",
    strategy: "deterministic_fifo",
  };
  const result = ReadyNodeSchedulingPolicySchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("ReadyNodeSchedulingPolicySchema accepts all strategies", () => {
  const strategies = ["deterministic_fifo", "priority_then_fifo", "risk_isolated"];
  for (const strategy of strategies) {
    const valid = {
      policyId: `policy_${strategy}`,
      strategy,
    };
    const result = ReadyNodeSchedulingPolicySchema.safeParse(valid);
    assert.equal(result.success, true, `Strategy '${strategy}' should be valid`);
  }
});

// ---------------------------------------------------------------------------
// GraphValidationReportSchema Tests
// ---------------------------------------------------------------------------

test("GraphValidationReportSchema accepts valid report", () => {
  const valid = {
    valid: true,
    findings: [],
  };
  const result = GraphValidationReportSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("GraphValidationReportSchema accepts report with all optional fields", () => {
  const valid = {
    valid: false,
    findings: ["Node timeout exceeded", "Budget limit reached"],
    normalizedNodeIds: ["node_1", "node_2"],
    riskPropagation: [
      {
        nodeId: "node_1",
        inheritedRiskClass: "high",
        reasons: ["depends on failed node"],
      },
    ],
    worstPath: {
      pathNodeIds: ["node_1", "node_2", "node_3"],
      riskClass: "critical",
      estimatedBudgetAmount: 5000,
      timeoutMs: 120000,
    },
  };
  const result = GraphValidationReportSchema.safeParse(valid);
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// PlanGraphBundleSchema Tests
// ---------------------------------------------------------------------------

test("PlanGraphBundleSchema accepts valid bundle", () => {
  const validBudgetIntent = createValidBudgetIntent();
  const validRiskPreview = createValidRiskPreview();
  const valid = {
    planGraphBundleId: "pgb_123",
    harnessRunId: "hrun_456",
    graphVersion: 1,
    graph: {
      graphId: "graph_1",
      nodes: [
        {
          nodeId: "node_1",
          nodeType: "tool",
          inputRefs: [],
          outputSchemaRef: "schema://output",
          riskClass: "low",
          budgetIntent: validBudgetIntent,
          sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
          retryPolicyRef: "retry://default",
          timeoutMs: 30000,
        },
      ],
      edges: [],
      entryNodeIds: ["node_1"],
      terminalNodeIds: ["node_1"],
      joinStrategy: "all" as const,
      graphHash: "sha256:abc123",
    },
    schedulerPolicy: {
      policyId: "policy_1",
      strategy: "deterministic_fifo" as const,
    },
    budgetPlanRef: "budget-plan-1",
    riskProfile: validRiskPreview,
    validationReport: { valid: true, findings: [] },
    artifactRefs: [],
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const result = PlanGraphBundleSchema.safeParse(valid);
  assert.equal(result.success, true, `PlanGraphBundle should be valid: ${JSON.stringify(result.error?.issues)}`);
});
