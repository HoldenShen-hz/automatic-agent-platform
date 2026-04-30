/**
 * Platform Contracts Extended Unit Tests
 *
 * Additional tests for platform-contracts types beyond what exists in types.test.ts.
 * Tests platform-level contract types and factories.
 *
 * @see src/platform/contracts/types/platform-contracts.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createPlatformPrincipal,
  createRequestEnvelope,
  createEvidenceRecord,
  createProjectionUpdate,
  createStateCommand,
  type PlatformPrincipal,
  type EvidenceRecord,
  type ProjectionUpdate,
  type SideEffectExpectation,
  type ExecutionPlanBudget,
  type ExecutionReceiptErrorDetail,
  type StateCommand,
  type StateCommandType,
} from "../../../../src/platform/contracts/types/platform-contracts.js";

// =============================================================================
// SideEffectExpectation Tests
// =============================================================================

test("platform-contracts: SideEffectExpectation structure", () => {
  const expectation: SideEffectExpectation = {
    effectId: "effect_123",
    category: "external_api",
    targetRef: "api_endpoint_1",
    requiredReceipt: true,
    reversible: false,
  };

  assert.equal(expectation.effectId, "effect_123");
  assert.equal(expectation.category, "external_api");
  assert.equal(expectation.requiredReceipt, true);
  assert.equal(expectation.reversible, false);
});

test("platform-contracts: SideEffectExpectation categories", () => {
  const categories: SideEffectExpectation["category"][] = [
    "read",
    "write",
    "notification",
    "artifact",
    "external_api",
  ];

  for (const category of categories) {
    const expectation: SideEffectExpectation = {
      effectId: `effect_${category}`,
      category,
      targetRef: "ref",
      requiredReceipt: false,
      reversible: true,
    };
    assert.equal(expectation.category, category);
  }
});

// =============================================================================
// ExecutionPlanBudget Tests
// =============================================================================

test("platform-contracts: ExecutionPlanBudget structure", () => {
  const budget: ExecutionPlanBudget = {
    maxSteps: 100,
    maxDurationMs: 300000,
    maxCost: 10.50,
  };

  assert.equal(budget.maxSteps, 100);
  assert.equal(budget.maxDurationMs, 300000);
  assert.equal(budget.maxCost, 10.50);
});

test("platform-contracts: ExecutionPlanBudget allows zero values", () => {
  const budget: ExecutionPlanBudget = {
    maxSteps: 0,
    maxDurationMs: 0,
    maxCost: 0,
  };

  assert.equal(budget.maxSteps, 0);
  assert.equal(budget.maxDurationMs, 0);
  assert.equal(budget.maxCost, 0);
});

// =============================================================================
// ExecutionReceiptErrorDetail Tests
// =============================================================================

test("platform-contracts: ExecutionReceiptErrorDetail structure", () => {
  const error: ExecutionReceiptErrorDetail = {
    code: "ERR_TASK_FAILED",
    message: "Task execution failed",
    retryable: true,
  };

  assert.equal(error.code, "ERR_TASK_FAILED");
  assert.equal(error.message, "Task execution failed");
  assert.equal(error.retryable, true);
});

test("platform-contracts: ExecutionReceiptErrorDetail non-retryable", () => {
  const error: ExecutionReceiptErrorDetail = {
    code: "ERR_PERMANENT",
    message: "Cannot recover from this error",
    retryable: false,
  };

  assert.equal(error.retryable, false);
});

// =============================================================================
// StateCommand Tests
// =============================================================================

test("platform-contracts: createStateCommand creates valid command", () => {
  const principal = createPlatformPrincipal({
    actorId: "system",
    tenantId: "global",
    roles: ["admin"],
  });

  const command = createStateCommand({
    traceId: "trace_cmd_1",
    principal,
    leaseId: "lease_123",
    fencingToken: "fence_abc",
    event: "task_completed",
    type: "append_event",
    aggregateId: "task_456",
    expectedVersion: 1,
    payload: { taskId: "task_456", status: "completed" },
  });

  assert.ok(command.commandId.startsWith("statecmd_"));
  assert.equal(command.traceId, "trace_cmd_1");
  assert.equal(command.leaseId, "lease_123");
  assert.equal(command.fencingToken, "fence_abc");
  assert.equal(command.event, "task_completed");
  assert.equal(command.type, "append_event");
  assert.equal(command.aggregateId, "task_456");
  assert.equal(command.expectedVersion, 1);
  assert.deepEqual(command.payload, { taskId: "task_456", status: "completed" });
});

test("platform-contracts: StateCommandType values", () => {
  const types: StateCommandType[] = [
    "update_truth",
    "append_event",
    "write_checkpoint",
    "store_artifact",
  ];

  for (const type of types) {
    assert.ok(type.length > 0);
  }
});

test("platform-contracts: createStateCommand uses custom commandId", () => {
  const principal = createPlatformPrincipal({
    actorId: "system",
    tenantId: "global",
    roles: [],
  });

  const command = createStateCommand({
    commandId: "custom_cmd_id",
    traceId: "trace_custom",
    principal,
    leaseId: "lease_1",
    fencingToken: "fence_1",
    event: "test_event",
    type: "append_event",
    aggregateId: "agg_1",
    expectedVersion: 0,
    payload: {},
  });

  assert.equal(command.commandId, "custom_cmd_id");
});

// =============================================================================
// RequestEnvelope Factory - Additional Edge Cases
// =============================================================================

test("platform-contracts: createRequestEnvelope with all optional params", () => {
  const principal = createPlatformPrincipal({
    actorId: "full_test_user",
    tenantId: "full_test_tenant",
    roles: ["operator", "admin"],
    authMethod: "api_key",
    displayName: "Full Test User",
  });

  const envelope = createRequestEnvelope({
    principal,
    tenantId: "custom_tenant",
    payload: { complex: { nested: { data: [1, 2, 3] } } },
    metadata: { source: "test", version: "1.0" },
    requestId: "custom_request_id",
    idempotencyKey: "custom_idem_key",
    traceId: "custom_trace_id",
    timestamp: "2026-01-15T10:30:00.000Z",
  });

  assert.equal(envelope.requestId, "custom_request_id");
  assert.equal(envelope.idempotencyKey, "custom_idem_key");
  assert.equal(envelope.traceId, "custom_trace_id");
  assert.equal(envelope.tenantId, "custom_tenant");
  assert.equal(envelope.timestamp, "2026-01-15T10:30:00.000Z");
  assert.equal(envelope.metadata.source, "test");
  assert.equal(envelope.metadata.version, "1.0");
});

test("platform-contracts: createRequestEnvelope defaults to global tenant", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_no_tenant",
    tenantId: null,
    roles: [],
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: {},
  });

  assert.equal(envelope.tenantId, "global");
});

test("platform-contracts: createRequestEnvelope metadata conversion", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_meta",
    tenantId: "tenant_meta",
    roles: [],
  });

  // Number and boolean values should be converted to strings
  const envelope = createRequestEnvelope({
    principal,
    payload: {},
    metadata: {
      count: 42 as unknown as string,
      active: true as unknown as string,
    },
  });

  assert.equal(envelope.metadata.count, "42");
  assert.equal(envelope.metadata.active, "true");
});

// =============================================================================
// ProjectionUpdate Factory - Additional Edge Cases
// =============================================================================

test("platform-contracts: createProjectionUpdate with all optional fields", () => {
  const projection = createProjectionUpdate({
    projectionId: "proj_full",
    projectionType: "full_test",
    version: 10,
    sourceEvents: ["event_1", "event_2", "event_3"],
    patch: { status: "completed", result: { score: 100 } },
    triggeredBy: "recovery_service",
    rebuiltAt: "2026-01-01T00:00:00.000Z",
    idempotencyKey: "custom_proj_idem",
  });

  assert.equal(projection.projectionId, "proj_full");
  assert.equal(projection.version, 10);
  assert.deepEqual(projection.sourceEvents, ["event_1", "event_2", "event_3"]);
  assert.deepEqual(projection.patch, { status: "completed", result: { score: 100 } });
  assert.equal(projection.metadata.triggeredBy, "recovery_service");
  assert.equal(projection.metadata.rebuiltAt, "2026-01-01T00:00:00.000Z");
  assert.equal(projection.metadata.idempotencyKey, "custom_proj_idem");
});

test("platform-contracts: createProjectionUpdate without optional fields", () => {
  const projection = createProjectionUpdate({
    projectionId: "proj_minimal",
    projectionType: "minimal_test",
    version: 1,
    sourceEvents: [],
    patch: {},
    triggeredBy: "test",
  });

  assert.equal(projection.projectionId, "proj_minimal");
  assert.equal(projection.metadata.rebuiltAt, undefined);
  assert.ok(projection.metadata.idempotencyKey.startsWith("projupd_"));
});

// =============================================================================
// PlatformPrincipal Edge Cases
// =============================================================================

test("platform-contracts: createPlatformPrincipal with null tenantId", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_null_tenant",
    tenantId: null,
    roles: ["viewer"],
  });

  assert.equal(principal.tenantId, null);
  assert.deepEqual(principal.roles, ["viewer"]);
});

test("platform-contracts: createPlatformPrincipal with empty roles array", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_empty_roles",
    tenantId: "tenant",
    roles: [],
  });

  assert.deepEqual(principal.roles, []);
});

test("platform-contracts: createPlatformPrincipal with all optional fields", () => {
  const principal = createPlatformPrincipal({
    actorId: "full_user",
    tenantId: "full_tenant",
    roles: ["admin", "operator", "developer"],
    authMethod: "oauth2",
    displayName: "Full Featured User",
  });

  assert.equal(principal.authMethod, "oauth2");
  assert.equal(principal.displayName, "Full Featured User");
  assert.equal(principal.roles.length, 3);
});

// =============================================================================
// EvidenceRecord Edge Cases
// =============================================================================

test("platform-contracts: createEvidenceRecord with custom recordId", () => {
  const principal = createPlatformPrincipal({
    actorId: "system",
    tenantId: "global",
    roles: ["system"],
  });

  const record = createEvidenceRecord({
    recordId: "custom_evid_123",
    traceId: "trace_custom",
    principal,
    category: "execution",
    targetRef: "task_789",
    content: { status: "running" },
  });

  assert.equal(record.recordId, "custom_evid_123");
});

test("platform-contracts: createEvidenceRecord with empty metadata", () => {
  const principal = createPlatformPrincipal({
    actorId: "system",
    tenantId: "global",
    roles: [],
  });

  const record = createEvidenceRecord({
    traceId: "trace_no_meta",
    principal,
    category: "audit",
    targetRef: "ref_no_meta",
    content: null,
    metadata: {},
  });

  assert.deepEqual(record.metadata, {});
});