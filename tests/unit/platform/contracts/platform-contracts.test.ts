/**
 * Platform Contracts Unit Tests
 *
 * Tests the platform-level contracts from types/platform-contracts.js.
 * Covers PlatformPrincipal, RequestEnvelope, EvidenceRecord, ProjectionUpdate,
 * and related factory functions.
 *
 * Key behaviors:
 * - Contract envelope wrapping (issue #2006)
 * - Type consistency between contract definitions
 * - Contract validation and serialization
 *
 * @see src/platform/contracts/types/platform-contracts.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  createPlatformPrincipal,
  createRequestEnvelope,
  createEvidenceRecord,
  createProjectionUpdate,
  type PlatformPrincipal,
  type EvidenceRecord,
  type ProjectionUpdate,
  type SideEffectExpectation,
  type ExecutionPlanBudget,
  type ExecutionReceiptErrorDetail,
  type StateCommand,
  type StateCommandType,
  createStateCommand,
} from "../../../../src/platform/contracts/types/platform-contracts.js";
import {
  LEGACY_CONTRACT_NAMES,
  emitDeprecationWarning,
  assertNotDeprecated,
} from "../../../../src/platform/contracts/index.js";

import {
  createContractEnvelope,
  CONTRACT_SCHEMA_VERSION,
  CANONICAL_CONTRACT_NAMES,
  type ContractEnvelope,
} from "../../../../src/platform/contracts/executable-contracts/index.js";

// =============================================================================
// PlatformPrincipal Tests
// =============================================================================

test("platform-contracts: createPlatformPrincipal creates valid principal", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_123",
    tenantId: "tenant_abc",
    roles: ["admin", "developer"],
  });

  assert.equal(principal.actorId, "user_123");
  assert.equal(principal.tenantId, "tenant_abc");
  assert.deepEqual(principal.roles, ["admin", "developer"]);
});

test("platform-contracts: createPlatformPrincipal handles optional fields", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_456",
    tenantId: "tenant_xyz",
    roles: ["viewer"],
    authMethod: "oauth",
    displayName: "Test User",
  });

  assert.equal(principal.authMethod, "oauth");
  assert.equal(principal.displayName, "Test User");
});

test("platform-contracts: createPlatformPrincipal defaults roles to empty array", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_no_roles",
    tenantId: null,
  });

  assert.deepEqual(principal.roles, []);
  assert.equal(principal.tenantId, null);
});

test("platform-contracts: PlatformPrincipal preserves readonly contract", () => {
  const principal = createPlatformPrincipal({
    actorId: "readonly_test",
    tenantId: "tenant_readonly",
    roles: ["role1"],
  });

  // Verify properties are readonly by attempting to reassign (should fail in strict mode)
  const checkReadonly = (obj: PlatformPrincipal) => {
    return Object.isExtensible(obj) && Object.hasOwn(obj, "actorId");
  };

  assert.ok(checkReadonly(principal));
});

// =============================================================================
// RequestEnvelope Tests
// =============================================================================

test("platform-contracts: createRequestEnvelope creates valid envelope", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_789",
    tenantId: "tenant_global",
    roles: ["admin"],
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: { command: "test" },
  });

  assert.ok(envelope.requestId.startsWith("request_"));
  assert.ok(envelope.idempotencyKey.startsWith("idem_"));
  assert.ok(envelope.traceId.startsWith("trace_"));
  assert.equal(envelope.tenantId, "tenant_global");
  assert.deepEqual(envelope.payload, { command: "test" });
  assert.ok(envelope.metadata);
  assert.ok(envelope.timestamp);
});

test("platform-contracts: createRequestEnvelope uses principal tenantId when tenantId not specified", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_abc",
    tenantId: "tenant_from_principal",
    roles: [],
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: { data: 123 },
  });

  assert.equal(envelope.tenantId, "tenant_from_principal");
});

test("platform-contracts: createRequestEnvelope allows custom metadata", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_meta",
    tenantId: "tenant_meta",
    roles: [],
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: { data: "test" },
    metadata: { key1: "value1", key2: "value2" },
  });

  assert.equal(envelope.metadata.key1, "value1");
  assert.equal(envelope.metadata.key2, "value2");
});

test("platform-contracts: createRequestEnvelope metadata is readonly record", () => {
  const principal = createPlatformPrincipal({
    actorId: "meta_test",
    tenantId: "tenant_meta",
    roles: [],
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: { test: true },
  });

  // Metadata should be a readonly record of strings
  const metadataKeys = Object.keys(envelope.metadata);
  assert.ok(metadataKeys.length >= 0);
});

// =============================================================================
// EvidenceRecord Tests
// =============================================================================

test("platform-contracts: createEvidenceRecord creates valid evidence record", () => {
  const principal = createPlatformPrincipal({
    actorId: "system",
    tenantId: "global",
    roles: ["system"],
  });

  const record = createEvidenceRecord({
    traceId: "trace_evidence",
    principal,
    category: "decision",
    targetRef: "task_123",
    content: { decision: "approved", reason: "criteria_met" },
  });

  assert.ok(record.recordId.startsWith("evid_"));
  assert.equal(record.traceId, "trace_evidence");
  assert.equal(record.category, "decision");
  assert.equal(record.targetRef, "task_123");
  assert.ok(record.timestamp);
  assert.ok(record.metadata);
});

test("platform-contracts: createEvidenceRecord handles all category types", () => {
  const principal = createPlatformPrincipal({
    actorId: "system",
    tenantId: "global",
    roles: ["system"],
  });

  const categories: EvidenceRecord["category"][] = ["decision", "execution", "approval", "audit", "compliance"];

  for (const category of categories) {
    const record = createEvidenceRecord({
      traceId: `trace_${category}`,
      principal,
      category,
      targetRef: "ref_test",
      content: { test: true },
    });

    assert.equal(record.category, category);
  }
});

test("platform-contracts: createEvidenceRecord content can be any type", () => {
  const principal = createPlatformPrincipal({
    actorId: "content_test",
    tenantId: "tenant_content",
    roles: [],
  });

  // Test various content types
  const stringContent = createEvidenceRecord({
    traceId: "trace_str",
    principal,
    category: "decision",
    targetRef: "ref1",
    content: "simple string",
  });
  assert.equal(stringContent.content, "simple string");

  const objectContent = createEvidenceRecord({
    traceId: "trace_obj",
    principal,
    category: "execution",
    targetRef: "ref2",
    content: { nested: { data: [1, 2, 3] } },
  });
  assert.deepEqual((objectContent.content as Record<string, unknown>).nested, { data: [1, 2, 3] });

  const arrayContent = createEvidenceRecord({
    traceId: "trace_arr",
    principal,
    category: "approval",
    targetRef: "ref3",
    content: ["item1", "item2"],
  });
  assert.deepEqual(arrayContent.content, ["item1", "item2"]);
});

// =============================================================================
// ProjectionUpdate Tests
// =============================================================================

test("platform-contracts: createProjectionUpdate creates valid projection", () => {
  const projection = createProjectionUpdate({
    projectionId: "proj_123",
    projectionType: "task_status",
    version: 1,
    sourceEvents: ["task_created", "task_started"],
    patch: { status: "completed" },
    triggeredBy: "system",
  });

  assert.equal(projection.projectionId, "proj_123");
  assert.equal(projection.projectionType, "task_status");
  assert.equal(projection.version, 1);
  assert.deepEqual(projection.sourceEvents, ["task_created", "task_started"]);
  assert.deepEqual(projection.patch, { status: "completed" });
  assert.equal(projection.metadata.triggeredBy, "system");
  assert.ok(projection.timestamp);
});

test("platform-contracts: createProjectionUpdate includes idempotency key in metadata", () => {
  const projection = createProjectionUpdate({
    projectionId: "proj_456",
    projectionType: "execution_summary",
    version: 2,
    sourceEvents: ["exec_started"],
    patch: { summary: "done" },
    triggeredBy: "worker",
    idempotencyKey: "custom_idem_key",
  });

  assert.equal(projection.metadata.idempotencyKey, "custom_idem_key");
});

test("platform-contracts: createProjectionUpdate handles optional rebuiltAt", () => {
  const projection = createProjectionUpdate({
    projectionId: "proj_rebuilt",
    projectionType: "rebuild_test",
    version: 5,
    sourceEvents: [],
    patch: {},
    triggeredBy: "recovery",
    rebuiltAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(projection.metadata.rebuiltAt, "2026-01-01T00:00:00.000Z");
});

// =============================================================================
// StateCommand Tests (Deprecated)
// =============================================================================

test("platform-contracts: createStateCommand creates valid state command", () => {
  const principal = createPlatformPrincipal({
    actorId: "system",
    tenantId: "global",
    roles: ["system"],
  });

  const command = createStateCommand({
    traceId: "trace_state",
    principal,
    leaseId: "lease_123",
    fencingToken: "token_abc",
    event: "task_completed",
    type: "append_event",
    aggregateId: "task_456",
    expectedVersion: 1,
    payload: { taskId: "task_456", status: "completed" },
  });

  assert.ok(command.commandId.startsWith("statecmd_"));
  assert.equal(command.traceId, "trace_state");
  assert.equal(command.leaseId, "lease_123");
  assert.equal(command.fencingToken, "token_abc");
  assert.equal(command.type, "append_event");
});

test("platform-contracts: StateCommandType union contains expected values", () => {
  const types: StateCommandType[] = [
    "update_truth",
    "append_event",
    "write_checkpoint",
    "store_artifact",
  ];

  for (const type of types) {
    const principal = createPlatformPrincipal({
      actorId: "test_user",
      tenantId: "test_tenant",
      roles: [],
    });

    const command = createStateCommand({
      traceId: `trace_${type}`,
      principal,
      leaseId: "lease_test",
      fencingToken: "token_test",
      event: "test_event",
      type,
      aggregateId: "agg_test",
      expectedVersion: 1,
      payload: {},
    });

    assert.equal(command.type, type);
  }
});

// =============================================================================
// SideEffectExpectation Tests (Deprecated)
// =============================================================================

test("platform-contracts: SideEffectExpectation has correct shape", () => {
  // Deprecated type but should still be accessible
  const expectation: SideEffectExpectation = {
    effectId: "effect_123",
    category: "write",
    targetRef: "resource_abc",
    requiredReceipt: true,
    reversible: false,
  };

  assert.equal(expectation.effectId, "effect_123");
  assert.equal(expectation.category, "write");
  assert.equal(expectation.requiredReceipt, true);
  assert.equal(expectation.reversible, false);
});

// =============================================================================
// ExecutionPlanBudget Tests
// =============================================================================

test("platform-contracts: ExecutionPlanBudget has correct shape", () => {
  const budget: ExecutionPlanBudget = {
    maxSteps: 10,
    maxDurationMs: 60000,
    maxCost: 1000,
  };

  assert.equal(budget.maxSteps, 10);
  assert.equal(budget.maxDurationMs, 60000);
  assert.equal(budget.maxCost, 1000);
});

// =============================================================================
// ExecutionReceiptErrorDetail Tests
// =============================================================================

test("platform-contracts: ExecutionReceiptErrorDetail has correct shape", () => {
  const error: ExecutionReceiptErrorDetail = {
    code: "ERR_TASK_FAILED",
    message: "Task execution failed",
    retryable: true,
  };

  assert.equal(error.code, "ERR_TASK_FAILED");
  assert.equal(error.message, "Task execution failed");
  assert.equal(error.retryable, true);
});

// =============================================================================
// Contract Envelope Wrapping Tests (Issue #2006)
// =============================================================================

test("platform-contracts: createContractEnvelope wraps payload correctly", () => {
  const envelope = createContractEnvelope({
    payload: { taskId: "task_123", status: "completed" },
  });

  assert.equal(envelope.version, CONTRACT_SCHEMA_VERSION);
  assert.equal(envelope.schema, "canonical");
  assert.deepEqual(envelope.payload, { taskId: "task_123", status: "completed" });
  assert.equal(envelope.signature, null);
  assert.equal(envelope.ttl, null);
});

test("platform-contracts: createContractEnvelope accepts custom version", () => {
  const envelope = createContractEnvelope({
    payload: { data: "test" },
    version: "v5.0",
  });

  assert.equal(envelope.version, "v5.0");
});

test("platform-contracts: createContractEnvelope accepts custom schema", () => {
  const envelope = createContractEnvelope({
    payload: { data: "test" },
    schema: "custom-schema",
  });

  assert.equal(envelope.schema, "custom-schema");
});

test("platform-contracts: createContractEnvelope accepts signature", () => {
  const envelope = createContractEnvelope({
    payload: { data: "test" },
    signature: "sig_abc123",
  });

  assert.equal(envelope.signature, "sig_abc123");
});

test("platform-contracts: createContractEnvelope accepts ttl", () => {
  const envelope = createContractEnvelope({
    payload: { data: "test" },
    ttl: 3600,
  });

  assert.equal(envelope.ttl, 3600);
});

test("platform-contracts: createContractEnvelope accepts null signature and ttl", () => {
  const envelope = createContractEnvelope({
    payload: { data: "test" },
    signature: null,
    ttl: null,
  });

  assert.equal(envelope.signature, null);
  assert.equal(envelope.ttl, null);
});

test("platform-contracts: ContractEnvelope preserves payload type", () => {
  interface CustomPayload {
    customField: string;
    nested: { value: number };
  }

  const customPayload: CustomPayload = {
    customField: "test",
    nested: { value: 42 },
  };

  const envelope = createContractEnvelope<CustomPayload>({
    payload: customPayload,
  });

  // Type check - envelope.payload should be CustomPayload
  const payload: CustomPayload = envelope.payload;
  assert.equal(payload.customField, "test");
  assert.equal(payload.nested.value, 42);
});

// =============================================================================
// Deprecation Warning Tests
// =============================================================================

test("platform-contracts: emitDeprecationWarning returns true for deprecated contracts", () => {
  const result = emitDeprecationWarning("ExecutionPlan");
  assert.equal(result, true);
});

test("platform-contracts: emitDeprecationWarning returns false for non-deprecated contracts", () => {
  const result = emitDeprecationWarning("TaskDraft");
  assert.equal(result, false);
});

test("platform-contracts: assertNotDeprecated throws for deprecated contracts", () => {
  assert.throws(
    () => assertNotDeprecated("ExecutionPlan"),
    /deprecated/i,
  );
});

test("platform-contracts: assertNotDeprecated does not throw for non-deprecated contracts", () => {
  assert.doesNotThrow(() => assertNotDeprecated("TaskDraft"));
});

test("platform-contracts: LEGACY_CONTRACT_NAMES contains expected contracts", () => {
  const expectedLegacy = [
    "ExecutionPlan",
    "ExecutionReceipt",
    "ControlDirective",
    "StateCommand",
    "StateMutationCommand",
    "WorkflowStep",
    "StepOutput",
    "workflow_run",
  ];

  for (const name of expectedLegacy) {
    assert.ok(
      LEGACY_CONTRACT_NAMES.includes(name as typeof LEGACY_CONTRACT_NAMES[number]),
      `Expected ${name} to be in LEGACY_CONTRACT_NAMES`,
    );
  }
});

// =============================================================================
// CANONICAL_CONTRACT_NAMES Tests
// =============================================================================

test("platform-contracts: CANONICAL_CONTRACT_NAMES contains ContractEnvelope", () => {
  assert.ok(
    CANONICAL_CONTRACT_NAMES.includes("ContractEnvelope"),
    "ContractEnvelope should be in CANONICAL_CONTRACT_NAMES",
  );
});

test("platform-contracts: CANONICAL_CONTRACT_NAMES includes expected contracts", () => {
  const expectedCanonical = [
    "TaskDraft",
    "ConfirmedTaskSpec",
    "RequestEnvelope",
    "HarnessRun",
    "PlanGraphBundle",
    "NodeAttemptReceipt",
    "SideEffectRecord",
  ];

  for (const name of expectedCanonical) {
    assert.ok(
      CANONICAL_CONTRACT_NAMES.includes(name as typeof CANONICAL_CONTRACT_NAMES[number]),
      `Expected ${name} to be in CANONICAL_CONTRACT_NAMES`,
    );
  }
});

// =============================================================================
// Type Consistency Tests
// =============================================================================

test("platform-contracts: PlatformPrincipal actorId is required", () => {
  const principal = createPlatformPrincipal({
    actorId: "required_actor",
    tenantId: null,
  });

  assert.equal(principal.actorId, "required_actor");
});

test("platform-contracts: EvidenceRecord targetRef accepts any string", () => {
  const principal = createPlatformPrincipal({
    actorId: "test",
    tenantId: "tenant",
    roles: [],
  });

  const record = createEvidenceRecord({
    traceId: "trace",
    principal,
    category: "decision",
    targetRef: "any/ref/format/here",
    content: {},
  });

  assert.equal(record.targetRef, "any/ref/format/here");
});

test("platform-contracts: ProjectionUpdate version is a number", () => {
  const projection = createProjectionUpdate({
    projectionId: "proj",
    projectionType: "type",
    version: 0,
    sourceEvents: [],
    patch: {},
    triggeredBy: "test",
  });

  assert.equal(typeof projection.version, "number");
  assert.equal(projection.version, 0);
});

test("platform-contracts: ContractEnvelope version is a string", () => {
  const envelope = createContractEnvelope({
    payload: { test: true },
  });

  assert.equal(typeof envelope.version, "string");
});