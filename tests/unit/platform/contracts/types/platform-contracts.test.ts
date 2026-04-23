import assert from "node:assert/strict";
import test from "node:test";

import {
  createPlatformPrincipal,
  createRequestEnvelope,
  createControlDirective,
  createExecutionPlan,
  createExecutionReceipt,
  createStateCommand,
  createEvidenceRecord,
  createProjectionUpdate,
  type PlatformPrincipal,
  type RequestEnvelope,
  type ControlDirective,
  type ControlDirectiveType,
  type SideEffectExpectation,
  type SideEffectRecord,
  type ExecutionPlanBudget,
  type ExecutionPlan,
  type ExecutionReceipt,
  type ExecutionReceiptErrorDetail,
  type StateCommand,
  type EvidenceRecord,
  type ProjectionUpdate,
} from "../../../../../src/platform/contracts/types/platform-contracts.js";

// Minimal PlanStep for testing (normally imported from oapeflir)
// Note: retryPolicy uses maxRetries (not maxAttempts)
const mockPlanStep = {
  stepId: "step-1",
  action: "test.action",
  title: "Test Step",
  inputs: {},
  dependencies: [],
  status: "pending" as const,
  timeout: 30000,
  retryPolicy: { maxRetries: 3, backoffMs: 1000 },
};

// Helper to create a minimal principal for testing
function createTestPrincipal(overrides?: Partial<PlatformPrincipal>): PlatformPrincipal {
  return {
    actorId: "actor-1",
    tenantId: "tenant-1",
    roles: ["user"],
    authMethod: "bearer",
    displayName: "Test User",
    ...overrides,
  };
}

// =============================================================================
// createPlatformPrincipal Tests
// =============================================================================

test("createPlatformPrincipal creates principal with required fields", () => {
  const result = createPlatformPrincipal({
    actorId: "actor-123",
    tenantId: "tenant-456",
  });
  assert.equal(result.actorId, "actor-123");
  assert.equal(result.tenantId, "tenant-456");
  assert.deepEqual(result.roles, []);
});

test("createPlatformPrincipal applies optional fields when provided", () => {
  const result = createPlatformPrincipal({
    actorId: "actor-123",
    tenantId: "tenant-456",
    roles: ["admin", "user"],
    authMethod: "api-key",
    displayName: "Test Admin",
  });
  assert.deepEqual(result.roles, ["admin", "user"]);
  assert.equal(result.authMethod, "api-key");
  assert.equal(result.displayName, "Test Admin");
});

test("createPlatformPrincipal defaults roles to empty array", () => {
  const result = createPlatformPrincipal({
    actorId: "actor-123",
    tenantId: "tenant-456",
  });
  assert.deepEqual(result.roles, []);
});

test("createPlatformPrincipal handles null tenantId", () => {
  const result = createPlatformPrincipal({
    actorId: "actor-123",
    tenantId: null,
  });
  assert.equal(result.tenantId, null);
});

// =============================================================================
// createRequestEnvelope Tests
// =============================================================================

test("createRequestEnvelope creates envelope with defaults", () => {
  const principal = createTestPrincipal();
  const envelope = createRequestEnvelope({
    principal,
    payload: { data: "test" },
  });
  assert.ok(envelope.requestId.startsWith("request_"));
  assert.ok(envelope.idempotencyKey.startsWith("idem_"));
  assert.ok(envelope.traceId.startsWith("trace_"));
  assert.equal(envelope.principal, principal);
  assert.equal(envelope.tenantId, "tenant-1");
  assert.equal(envelope.payload.data, "test");
  assert.deepEqual(envelope.metadata, {});
});

test("createRequestEnvelope uses principal.tenantId when tenantId not provided", () => {
  const principal = createTestPrincipal({ tenantId: "principal-tenant" });
  const envelope = createRequestEnvelope({
    principal,
    payload: {},
  });
  assert.equal(envelope.tenantId, "principal-tenant");
});

test("createRequestEnvelope falls back to 'global' when no tenantId", () => {
  const principal = createTestPrincipal({ tenantId: null });
  const envelope = createRequestEnvelope({
    principal,
    payload: {},
  });
  assert.equal(envelope.tenantId, "global");
});

test("createRequestEnvelope accepts custom overrides", () => {
  const envelope = createRequestEnvelope({
    principal: createTestPrincipal(),
    tenantId: "custom-tenant",
    payload: { data: 123 },
    requestId: "custom-request-id",
    idempotencyKey: "custom-idem-key",
    traceId: "custom-trace-id",
    timestamp: "2026-01-01T00:00:00.000Z",
    metadata: { key: "value" },
  });
  assert.equal(envelope.requestId, "custom-request-id");
  assert.equal(envelope.idempotencyKey, "custom-idem-key");
  assert.equal(envelope.traceId, "custom-trace-id");
  assert.equal(envelope.tenantId, "custom-tenant");
  assert.equal(envelope.timestamp, "2026-01-01T00:00:00.000Z");
  assert.equal(envelope.metadata.key, "value");
});

test("createRequestEnvelope stringifies metadata values", () => {
  const envelope = createRequestEnvelope({
    principal: createTestPrincipal(),
    payload: {},
    metadata: { number: 42, boolean: true },
  });
  assert.equal(envelope.metadata.number, "42");
  assert.equal(envelope.metadata.boolean, "true");
});

// =============================================================================
// createControlDirective Tests
// =============================================================================

test("createControlDirective creates directive with required fields", () => {
  const principal = createTestPrincipal();
  const directive = createControlDirective({
    type: "pause",
    issuedBy: principal,
    reason: "Maintenance window",
  });
  assert.ok(directive.directiveId.startsWith("directive_"));
  assert.equal(directive.type, "pause");
  assert.deepEqual(directive.targetScope, {});
  assert.equal(directive.issuedBy, principal);
  assert.equal(directive.reason, "Maintenance window");
  assert.deepEqual(directive.params, {});
});

test("createControlDirective accepts all directive types", () => {
  const principal = createTestPrincipal();
  const types: ControlDirectiveType[] = [
    "mode_switch",
    "pause",
    "resume",
    "rollback",
    "quota_adjust",
    "kill",
  ];
  for (const type of types) {
    const directive = createControlDirective({
      type,
      issuedBy: principal,
      reason: `Testing ${type}`,
    });
    assert.equal(directive.type, type);
  }
});

test("createControlDirective applies optional fields", () => {
  const principal = createTestPrincipal();
  const directive = createControlDirective({
    type: "quota_adjust",
    issuedBy: principal,
    reason: "Scale up",
    directiveId: "custom-directive-id",
    targetScope: { tenantId: "tenant-1", workflowId: "wf-1" },
    params: { maxTokens: 100000 },
    expiresAt: "2026-12-31T23:59:59.000Z",
  });
  assert.equal(directive.directiveId, "custom-directive-id");
  assert.equal(directive.targetScope.tenantId, "tenant-1");
  assert.equal(directive.targetScope.workflowId, "wf-1");
  assert.equal(directive.params.maxTokens, 100000);
  assert.equal(directive.expiresAt, "2026-12-31T23:59:59.000Z");
});

// =============================================================================
// createExecutionPlan Tests
// =============================================================================

test("createExecutionPlan creates plan with required fields", () => {
  const principal = createTestPrincipal();
  const budget: ExecutionPlanBudget = {
    maxSteps: 10,
    maxDurationMs: 60000,
    maxCost: 100,
  };
  const plan = createExecutionPlan({
    traceId: "trace-123",
    principal,
    workflowRunId: "wf-run-456",
    steps: [mockPlanStep],
    budget,
  });
  assert.ok(plan.planId.startsWith("plan_"));
  assert.equal(plan.traceId, "trace-123");
  assert.equal(plan.principal, principal);
  assert.equal(plan.workflowRunId, "wf-run-456");
  assert.deepEqual(plan.steps, [mockPlanStep]);
  assert.equal(plan.fallbackStrategy, "retry");
  assert.deepEqual(plan.approvalGates, []);
  assert.deepEqual(plan.sideEffectExpectations, []);
  assert.deepEqual(plan.budget, budget);
});

test("createExecutionPlan applies optional fields", () => {
  const principal = createTestPrincipal();
  const budget: ExecutionPlanBudget = { maxSteps: 5, maxDurationMs: 30000, maxCost: 50 };
  const sideEffect: SideEffectExpectation = {
    effectId: "effect-1",
    category: "write",
    targetRef: "resource-1",
    requiredReceipt: true,
    reversible: false,
  };
  const plan = createExecutionPlan({
    traceId: "trace-123",
    principal,
    workflowRunId: "wf-run-456",
    steps: [mockPlanStep],
    budget,
    planId: "custom-plan-id",
    fallbackStrategy: "escalate",
    approvalGates: ["gate-1", "gate-2"],
    sideEffectExpectations: [sideEffect],
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(plan.planId, "custom-plan-id");
  assert.equal(plan.fallbackStrategy, "escalate");
  assert.deepEqual(plan.approvalGates, ["gate-1", "gate-2"]);
  assert.deepEqual(plan.sideEffectExpectations, [sideEffect]);
  assert.equal(plan.createdAt, "2026-01-01T00:00:00.000Z");
});

test("createExecutionPlan defaults fallbackStrategy to retry", () => {
  const plan = createExecutionPlan({
    traceId: "trace-123",
    principal: createTestPrincipal(),
    workflowRunId: "wf-run-456",
    steps: [mockPlanStep],
    budget: { maxSteps: 5, maxDurationMs: 30000, maxCost: 50 },
  });
  assert.equal(plan.fallbackStrategy, "retry");
});

// =============================================================================
// createExecutionReceipt Tests
// =============================================================================

test("createExecutionReceipt creates receipt with required fields", () => {
  const receipt = createExecutionReceipt({
    planId: "plan-123",
    stepId: "step-456",
    status: "succeeded",
    durationMs: 1500,
  });
  assert.ok(receipt.receiptId.startsWith("receipt_"));
  assert.equal(receipt.planId, "plan-123");
  assert.equal(receipt.stepId, "step-456");
  assert.equal(receipt.status, "succeeded");
  assert.equal(receipt.durationMs, 1500);
  assert.deepEqual(receipt.sideEffects, []);
  assert.deepEqual(receipt.evidenceRefs, []);
});

test("createExecutionReceipt accepts all status values", () => {
  const statuses: ExecutionReceipt["status"][] = [
    "succeeded",
    "failed",
    "timeout",
    "cancelled",
    "awaiting_approval",
  ];
  for (const status of statuses) {
    const receipt = createExecutionReceipt({
      planId: "plan-123",
      stepId: "step-456",
      status,
      durationMs: 100,
    });
    assert.equal(receipt.status, status);
  }
});

test("createExecutionReceipt applies optional fields", () => {
  const sideEffect: SideEffectRecord = {
    effectId: "effect-1",
    category: "write",
    targetRef: "resource-1",
    status: "committed",
    summary: "Data written",
  };
  const errorDetail: ExecutionReceiptErrorDetail = {
    code: "ERR_TIMEOUT",
    message: "Operation timed out",
    retryable: true,
  };
  const receipt = createExecutionReceipt({
    planId: "plan-123",
    stepId: "step-456",
    status: "failed",
    durationMs: 5000,
    receiptId: "custom-receipt-id",
    sideEffects: [sideEffect],
    evidenceRefs: ["ev-1", "ev-2"],
    errorDetail,
  });
  assert.equal(receipt.receiptId, "custom-receipt-id");
  assert.deepEqual(receipt.sideEffects, [sideEffect]);
  assert.deepEqual(receipt.evidenceRefs, ["ev-1", "ev-2"]);
  assert.deepEqual(receipt.errorDetail, errorDetail);
});

// =============================================================================
// createStateCommand Tests
// =============================================================================

test("createStateCommand creates command with required fields", () => {
  const principal = createTestPrincipal();
  const command = createStateCommand({
    traceId: "trace-123",
    principal,
    type: "update_truth",
    aggregateId: "aggregate-456",
    expectedVersion: 1,
    fencingToken: "token-789",
    payload: { data: "test" },
  });
  assert.ok(command.commandId.startsWith("statecmd_"));
  assert.equal(command.traceId, "trace-123");
  assert.equal(command.principal, principal);
  assert.equal(command.type, "update_truth");
  assert.equal(command.aggregateId, "aggregate-456");
  assert.equal(command.expectedVersion, 1);
  assert.equal(command.fencingToken, "token-789");
  assert.deepEqual(command.payload, { data: "test" });
});

test("createStateCommand accepts all state command types", () => {
  const principal = createTestPrincipal();
  const types: StateCommand["type"][] = [
    "update_truth",
    "append_event",
    "write_checkpoint",
    "store_artifact",
  ];
  for (const type of types) {
    const command = createStateCommand({
      traceId: "trace-123",
      principal,
      type,
      aggregateId: "agg-1",
      expectedVersion: 1,
      fencingToken: "token",
      payload: {},
    });
    assert.equal(command.type, type);
  }
});

test("createStateCommand applies custom commandId", () => {
  const command = createStateCommand({
    traceId: "trace-123",
    principal: createTestPrincipal(),
    type: "append_event",
    aggregateId: "agg-1",
    expectedVersion: 5,
    fencingToken: "custom-token",
    payload: { event: "test" },
    commandId: "my-custom-command",
  });
  assert.equal(command.commandId, "my-custom-command");
  assert.equal(command.fencingToken, "custom-token");
});

// =============================================================================
// createEvidenceRecord Tests
// =============================================================================

test("createEvidenceRecord creates record with required fields", () => {
  const principal = createTestPrincipal();
  const record = createEvidenceRecord({
    traceId: "trace-123",
    principal,
    category: "decision",
    targetRef: "target-456",
    content: { decision: "approved" },
  });
  assert.ok(record.recordId.startsWith("evid_"));
  assert.equal(record.traceId, "trace-123");
  assert.equal(record.principal, principal);
  assert.equal(record.category, "decision");
  assert.equal(record.targetRef, "target-456");
  assert.deepEqual(record.content, { decision: "approved" });
  assert.ok(record.timestamp.length > 0);
  assert.deepEqual(record.metadata, {});
});

test("createEvidenceRecord accepts all category types", () => {
  const principal = createTestPrincipal();
  const categories: EvidenceRecord["category"][] = [
    "decision",
    "execution",
    "approval",
    "audit",
    "compliance",
  ];
  for (const category of categories) {
    const record = createEvidenceRecord({
      traceId: "trace-123",
      principal,
      category,
      targetRef: "target-1",
      content: {},
    });
    assert.equal(record.category, category);
  }
});

test("createEvidenceRecord applies optional fields", () => {
  const principal = createTestPrincipal();
  const record = createEvidenceRecord({
    traceId: "trace-123",
    principal,
    category: "execution",
    targetRef: "target-456",
    content: { result: "success" },
    recordId: "custom-record-id",
    metadata: { region: "us-east-1", env: "prod" },
  });
  assert.equal(record.recordId, "custom-record-id");
  assert.equal(record.metadata.region, "us-east-1");
  assert.equal(record.metadata.env, "prod");
});

// =============================================================================
// createProjectionUpdate Tests
// =============================================================================

test("createProjectionUpdate creates update with required fields", () => {
  const update = createProjectionUpdate({
    projectionId: "proj-123",
    projectionType: "task-status",
    version: 1,
    sourceEvents: ["evt-1", "evt-2"],
    patch: { status: "completed" },
    triggeredBy: "system",
  });
  assert.equal(update.projectionId, "proj-123");
  assert.equal(update.projectionType, "task-status");
  assert.equal(update.version, 1);
  assert.deepEqual(update.sourceEvents, ["evt-1", "evt-2"]);
  assert.deepEqual(update.patch, { status: "completed" });
  assert.equal(update.metadata.triggeredBy, "system");
  assert.ok(update.metadata.idempotencyKey.startsWith("projupd_"));
  assert.ok(update.timestamp.length > 0);
});

test("createProjectionUpdate applies optional fields", () => {
  const update = createProjectionUpdate({
    projectionId: "proj-123",
    projectionType: "task-status",
    version: 5,
    sourceEvents: ["evt-1"],
    patch: { data: "updated" },
    triggeredBy: "manual-trigger",
    rebuiltAt: "2026-01-01T00:00:00.000Z",
    idempotencyKey: "custom-idem-key",
  });
  assert.equal(update.metadata.rebuiltAt, "2026-01-01T00:00:00.000Z");
  assert.equal(update.metadata.triggeredBy, "manual-trigger");
  assert.equal(update.metadata.idempotencyKey, "custom-idem-key");
  assert.equal(update.version, 5);
});

test("createProjectionUpdate generates idempotency key when not provided", () => {
  const update = createProjectionUpdate({
    projectionId: "proj-123",
    projectionType: "type-1",
    version: 1,
    sourceEvents: [],
    patch: {},
    triggeredBy: "system",
  });
  assert.ok(update.metadata.idempotencyKey.startsWith("projupd_"));
});

// =============================================================================
// Type Interface Tests (verify structure)
// =============================================================================

test("PlatformPrincipal has correct readonly properties", () => {
  const principal = createPlatformPrincipal({
    actorId: "actor-1",
    tenantId: "tenant-1",
    roles: ["admin"],
  });
  // Verify readonly by attempting to reassign (should fail in TypeScript)
  // At runtime we verify the property exists
  assert.equal(principal.actorId, "actor-1");
  assert.equal(principal.tenantId, "tenant-1");
  assert.deepEqual(principal.roles, ["admin"]);
});

test("ControlDirectiveScope allows optional fields", () => {
  const principal = createTestPrincipal();
  const directive1 = createControlDirective({
    type: "pause",
    issuedBy: principal,
    reason: "test",
    targetScope: { tenantId: "t1" },
  });
  assert.equal(directive1.targetScope.tenantId, "t1");
  assert.equal(directive1.targetScope.workflowId, undefined);

  const directive2 = createControlDirective({
    type: "pause",
    issuedBy: principal,
    reason: "test",
    targetScope: { workerId: "w1" },
  });
  assert.equal(directive2.targetScope.workerId, "w1");
});

test("SideEffectExpectation category types", () => {
  const categories: SideEffectExpectation["category"][] = [
    "read",
    "write",
    "notification",
    "artifact",
    "external_api",
  ];
  for (const category of categories) {
    const effect: SideEffectExpectation = {
      effectId: "e1",
      category,
      targetRef: "r1",
      requiredReceipt: false,
      reversible: true,
    };
    assert.equal(effect.category, category);
  }
});

test("SideEffectRecord status types", () => {
  const statuses: SideEffectRecord["status"][] = [
    "proposed",
    "committed",
    "rolled_back",
    "failed",
  ];
  for (const status of statuses) {
    const record: SideEffectRecord = {
      effectId: "e1",
      category: "write",
      targetRef: "r1",
      status,
    };
    assert.equal(record.status, status);
  }
});

test("ExecutionPlanBudget has required numeric fields", () => {
  const budget: ExecutionPlanBudget = {
    maxSteps: 100,
    maxDurationMs: 3600000,
    maxCost: 1000,
  };
  assert.equal(budget.maxSteps, 100);
  assert.equal(budget.maxDurationMs, 3600000);
  assert.equal(budget.maxCost, 1000);
});

test("ProjectionUpdate metadata structure", () => {
  const update: ProjectionUpdate = {
    projectionId: "p1",
    projectionType: "t1",
    version: 1,
    timestamp: "2026-01-01T00:00:00.000Z",
    sourceEvents: [],
    patch: {},
    metadata: {
      triggeredBy: "system",
      idempotencyKey: "key1",
    },
  };
  assert.equal(update.metadata.triggeredBy, "system");
  assert.equal(update.metadata.idempotencyKey, "key1");
  assert.equal(update.metadata.rebuiltAt, undefined);
});

test("ProjectionUpdate metadata with rebuiltAt", () => {
  const update: ProjectionUpdate = {
    projectionId: "p1",
    projectionType: "t1",
    version: 2,
    timestamp: "2026-01-01T00:00:00.000Z",
    sourceEvents: [],
    patch: {},
    metadata: {
      rebuiltAt: "2026-01-02T00:00:00.000Z",
      triggeredBy: "rebuild",
      idempotencyKey: "key2",
    },
  };
  assert.equal(update.metadata.rebuiltAt, "2026-01-02T00:00:00.000Z");
});
