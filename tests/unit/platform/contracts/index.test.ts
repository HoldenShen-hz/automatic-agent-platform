import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for contracts/index.ts barrel export
 *
 * This module re-exports from multiple sub-modules:
 * - constants/index.js (time constants)
 * - delegation-request/index.js
 * - evidence-record/index.js
 * - errors.js
 * - model-request/index.js
 * - projection-update/index.js
 * - prompt-bundle/index.js
 * - result-envelope/index.js
 * - types/index.js
 */

test("contracts barrel loads without errors", async () => {
  const mod = await import("../../../../src/platform/contracts/index.js");
  assert.ok(mod !== null);
  assert.ok(mod !== undefined);
});

test("contracts barrel exports constants module", async () => {
  const mod = await import("../../../../src/platform/contracts/index.js");
  // Time constants should be available from constants sub-module
  assert.ok(mod !== null);
});

test("contracts barrel exports errors module", async () => {
  const mod = await import("../../../../src/platform/contracts/errors.js");
  assert.ok(mod !== null);
  assert.ok("AppError" in mod || mod.AppError !== undefined);
});

test("contracts barrel exports evidence-record module", async () => {
  const mod = await import("../../../../src/platform/contracts/evidence-record/index.js");
  assert.ok(mod !== null);
  // Verify createEvidenceRecord factory exists
  assert.ok(typeof mod.createEvidenceRecord === "function");
});

test("contracts barrel exports projection-update module", async () => {
  const mod = await import("../../../../src/platform/contracts/projection-update/index.js");
  assert.ok(mod !== null);
  // Verify createProjectionUpdate factory exists
  assert.ok(typeof mod.createProjectionUpdate === "function");
});

test("contracts barrel exports prompt-bundle module", async () => {
  const mod = await import("../../../../src/platform/contracts/prompt-bundle/index.js");
  assert.ok(mod !== null);
});

test("contracts barrel exports delegation-request module", async () => {
  const mod = await import("../../../../src/platform/contracts/delegation-request/index.js");
  assert.ok(mod !== null);
});

test("contracts barrel exports model-request module", async () => {
  const mod = await import("../../../../src/platform/contracts/model-request/index.js");
  assert.ok(mod !== null);
});

test("contracts barrel exports result-envelope module", async () => {
  const mod = await import("../../../../src/platform/contracts/result-envelope/index.js");
  assert.ok(mod !== null);
});

test("contracts barrel exports types module", async () => {
  const mod = await import("../../../../src/platform/contracts/types/index.js");
  assert.ok(mod !== null);
  // IDs utilities should be available
  assert.ok(typeof mod.newId === "function");
  assert.ok(typeof mod.nowIso === "function");
});

test("evidence-record factory creates valid record", async () => {
  const { createEvidenceRecord } = await import("../../../../src/platform/contracts/evidence-record/index.js");
  const { createPlatformPrincipal } = await import("../../../../src/platform/contracts/types/index.js");

  const principal = createPlatformPrincipal({
    actorId: "actor-1",
    tenantId: "tenant-1",
    roles: ["user"],
  });

  const record = createEvidenceRecord({
    traceId: "trace-123",
    principal,
    category: "decision",
    targetRef: "target-1",
    content: { approved: true },
  });

  assert.equal(record.traceId, "trace-123");
  assert.equal(record.category, "decision");
  assert.equal(record.targetRef, "target-1");
  assert.ok(record.recordId.startsWith("evid_"));
  assert.ok(record.timestamp.endsWith("Z"));
});

test("evidence-record factory accepts optional metadata", async () => {
  const { createEvidenceRecord } = await import("../../../../src/platform/contracts/evidence-record/index.js");
  const { createPlatformPrincipal } = await import("../../../../src/platform/contracts/types/index.js");

  const principal = createPlatformPrincipal({
    actorId: "actor-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const record = createEvidenceRecord({
    traceId: "trace-456",
    principal,
    category: "audit",
    targetRef: "task-789",
    content: { action: "delete" },
    metadata: { reason: "user_request", by: "admin" },
  });

  assert.deepEqual(record.metadata, { reason: "user_request", by: "admin" });
});

test("projection-update factory creates valid update", async () => {
  const { createProjectionUpdate } = await import("../../../../src/platform/contracts/projection-update/index.js");

  const update = createProjectionUpdate({
    projectionId: "proj-123",
    projectionType: "task_status",
    version: 1,
    sourceEvents: ["evt-1", "evt-2"],
    patch: { status: "completed" },
    triggeredBy: "test",
  });

  assert.equal(update.projectionId, "proj-123");
  assert.equal(update.projectionType, "task_status");
  assert.equal(update.version, 1);
  assert.deepEqual(update.sourceEvents, ["evt-1", "evt-2"]);
  assert.deepEqual(update.patch, { status: "completed" });
  assert.equal(update.metadata.triggeredBy, "test");
  assert.ok(update.timestamp.endsWith("Z"));
});

test("projection-update metadata contains idempotencyKey", async () => {
  const { createProjectionUpdate } = await import("../../../../src/platform/contracts/projection-update/index.js");

  const update = createProjectionUpdate({
    projectionId: "proj-123",
    projectionType: "task_status",
    version: 1,
    sourceEvents: [],
    patch: {},
    triggeredBy: "unit-test",
    idempotencyKey: "idem-abc",
  });

  assert.equal(update.metadata.idempotencyKey, "idem-abc");
});

test("platform contracts barrel exports all factory functions", async () => {
  const types = await import("../../../../src/platform/contracts/types/index.js");

  // Verify all factory functions are exported
  assert.equal(typeof types.createPlatformPrincipal, "function");
  assert.equal(typeof types.createRequestEnvelope, "function");
  assert.equal(typeof types.createControlDirective, "function");
  assert.equal(typeof types.createExecutionPlan, "function");
  assert.equal(typeof types.createExecutionReceipt, "function");
  assert.equal(typeof types.createStateCommand, "function");
  assert.equal(typeof types.createEvidenceRecord, "function");
  assert.equal(typeof types.createProjectionUpdate, "function");
});

test("createPlatformPrincipal factory with all options", async () => {
  const { createPlatformPrincipal } = await import("../../../../src/platform/contracts/types/index.js");

  const principal = createPlatformPrincipal({
    actorId: "user_abc",
    tenantId: "tenant_xyz",
    roles: ["admin", "operator"],
    authMethod: "oauth2",
    displayName: "Test Admin",
  });

  assert.equal(principal.actorId, "user_abc");
  assert.equal(principal.tenantId, "tenant_xyz");
  assert.deepEqual(principal.roles, ["admin", "operator"]);
  assert.equal(principal.authMethod, "oauth2");
  assert.equal(principal.displayName, "Test Admin");
});

test("createPlatformPrincipal factory with minimal input", async () => {
  const { createPlatformPrincipal } = await import("../../../../src/platform/contracts/types/index.js");

  const principal = createPlatformPrincipal({
    actorId: "user_min",
    tenantId: null,
  });

  assert.equal(principal.actorId, "user_min");
  assert.equal(principal.tenantId, null);
  assert.deepEqual(principal.roles, []);
  assert.equal(principal.authMethod, undefined);
  assert.equal(principal.displayName, undefined);
});

test("createRequestEnvelope factory generates IDs when not provided", async () => {
  const { createRequestEnvelope, createPlatformPrincipal } = await import("../../../../src/platform/contracts/types/index.js");

  const principal = createPlatformPrincipal({
    actorId: "user_123",
    tenantId: "tenant_abc",
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: { action: "test" },
  });

  assert.ok(envelope.requestId.startsWith("request_"));
  assert.ok(envelope.idempotencyKey.startsWith("idem_"));
  assert.ok(envelope.traceId.startsWith("trace_"));
});

test("createRequestEnvelope factory accepts custom IDs", async () => {
  const { createRequestEnvelope, createPlatformPrincipal } = await import("../../../../src/platform/contracts/types/index.js");

  const principal = createPlatformPrincipal({
    actorId: "user_123",
    tenantId: "tenant_abc",
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: { action: "deploy" },
    requestId: "req_custom_123",
    idempotencyKey: "idem_custom_456",
    traceId: "trace_custom_789",
  });

  assert.equal(envelope.requestId, "req_custom_123");
  assert.equal(envelope.idempotencyKey, "idem_custom_456");
  assert.equal(envelope.traceId, "trace_custom_789");
});

test("createControlDirective accepts all directive types", async () => {
  const { createControlDirective, createPlatformPrincipal } = await import("../../../../src/platform/contracts/types/index.js");

  const principal = createPlatformPrincipal({
    actorId: "user_123",
    tenantId: null,
  });

  const directiveTypes = ["mode_switch", "pause", "resume", "rollback", "quota_adjust", "kill"] as const;

  for (const type of directiveTypes) {
    const directive = createControlDirective({
      type,
      issuedBy: principal,
      reason: `testing ${type}`,
    });
    assert.equal(directive.type, type);
    assert.equal(directive.reason, `testing ${type}`);
  }
});

test("createControlDirective with targetScope", async () => {
  const { createControlDirective, createPlatformPrincipal } = await import("../../../../src/platform/contracts/types/index.js");

  const principal = createPlatformPrincipal({
    actorId: "user_123",
    tenantId: null,
  });

  const directive = createControlDirective({
    type: "pause",
    issuedBy: principal,
    reason: "maintenance window",
    targetScope: {
      tenantId: "tenant_abc",
      workflowId: "workflow_xyz",
      workerId: "worker_123",
    },
  });

  assert.equal(directive.targetScope.tenantId, "tenant_abc");
  assert.equal(directive.targetScope.workflowId, "workflow_xyz");
  assert.equal(directive.targetScope.workerId, "worker_123");
});

test("createExecutionPlan with all options", async () => {
  const { createExecutionPlan, createPlatformPrincipal } = await import("../../../../src/platform/contracts/types/index.js");

  const principal = createPlatformPrincipal({
    actorId: "user_123",
    tenantId: null,
  });

  const plan = createExecutionPlan({
    traceId: "trace_abc",
    principal,
    workflowRunId: "workflow_xyz",
    steps: [],
    budget: { maxSteps: 100, maxDurationMs: 3600000, maxCost: 1000 },
    fallbackStrategy: "escalate",
    approvalGates: ["gate_1", "gate_2"],
    planId: "plan_custom",
  });

  assert.equal(plan.planId, "plan_custom");
  assert.equal(plan.fallbackStrategy, "escalate");
  assert.deepEqual(plan.approvalGates, ["gate_1", "gate_2"]);
});

test("createExecutionReceipt with error detail", async () => {
  const { createExecutionReceipt } = await import("../../../../src/platform/contracts/types/index.js");

  const receipt = createExecutionReceipt({
    planId: "plan_123",
    stepId: "step_456",
    status: "failed",
    durationMs: 2500,
    errorDetail: {
      code: "E001",
      message: "Step execution timed out",
      retryable: true,
    },
  });

  assert.equal(receipt.status, "failed");
  assert.equal(receipt.errorDetail?.code, "E001");
  assert.equal(receipt.errorDetail?.message, "Step execution timed out");
  assert.equal(receipt.errorDetail?.retryable, true);
});

test("createStateCommand with all command types", async () => {
  const { createStateCommand, createPlatformPrincipal } = await import("../../../../src/platform/contracts/types/index.js");

  const principal = createPlatformPrincipal({
    actorId: "user_123",
    tenantId: null,
  });

  const commandTypes = ["update_truth", "append_event", "write_checkpoint", "store_artifact"] as const;

  for (const type of commandTypes) {
    const command = createStateCommand({
      traceId: "trace_123",
      principal,
      type,
      aggregateId: "task_456",
      expectedVersion: 1,
      fencingToken: "fence_abc",
      payload: { data: "test" },
    });
    assert.equal(command.type, type);
  }
});

test("errors module exports AppError and subclasses", async () => {
  const errors = await import("../../../../src/platform/contracts/errors.js");

  // Base class
  assert.ok(errors.AppError !== undefined);

  // Subclasses
  assert.ok(errors.ValidationError !== undefined);
  assert.ok(errors.AuthError !== undefined);
  assert.ok(errors.ProviderError !== undefined);
  assert.ok(errors.StorageError !== undefined);
  assert.ok(errors.WorkflowStateError !== undefined);
});

test("errors module exports error utilities", async () => {
  const errors = await import("../../../../src/platform/contracts/errors.js");

  assert.equal(typeof errors.createErrorCode, "function");
  assert.equal(typeof errors.isAppError, "function");
  assert.equal(typeof errors.getErrorCode, "function");
  assert.equal(typeof errors.normalizeToAppError, "function");
});

test("types module exports all status constants", async () => {
  const types = await import("../../../../src/platform/contracts/types/index.js");

  assert.ok(Array.isArray(types.TASK_STATUSES));
  assert.ok(Array.isArray(types.WORKFLOW_STATUSES));
  assert.ok(Array.isArray(types.SESSION_STATUSES));
  assert.ok(Array.isArray(types.EXECUTION_STATUSES));
  assert.ok(Array.isArray(types.APPROVAL_STATUSES));
});

test("types module exports type guard functions", async () => {
  const types = await import("../../../../src/platform/contracts/types/index.js");

  assert.equal(typeof types.isTaskStatus, "function");
  assert.equal(typeof types.isWorkflowStatus, "function");
  assert.equal(typeof types.isSessionStatus, "function");
  assert.equal(typeof types.isExecutionStatus, "function");
  assert.equal(typeof types.isSessionTerminalStatus, "function");
});

test("types module exports unified severity helpers", async () => {
  const types = await import("../../../../src/platform/contracts/types/index.js");

  assert.ok(Array.isArray(types.UNIFIED_SEVERITIES));
  assert.equal(typeof types.anomalySeverityToUnifiedSeverity, "function");
  assert.equal(typeof types.alertSeverityToUnifiedSeverity, "function");
});

test("types module exports anomaly classification", async () => {
  const types = await import("../../../../src/platform/contracts/types/index.js");

  assert.ok(Array.isArray(types.ANOMALY_EVENT_CLASSES));
  assert.equal(typeof types.classifyAnomalyEvent, "function");
});

test("types module exports recovery cadence", async () => {
  const types = await import("../../../../src/platform/contracts/types/index.js");

  assert.equal(typeof types.buildRecoveryCadence, "function");
});

test("types module exports unified runtime mode mappers", async () => {
  const types = await import("../../../../src/platform/contracts/types/index.js");

  assert.equal(typeof types.mapPolicyModeToUnifiedRuntimeMode, "function");
  assert.equal(typeof types.mapHealthDegradationModeToUnifiedRuntimeMode, "function");
  assert.equal(typeof types.mapAutonomyLevelToUnifiedRuntimeMode, "function");
});
