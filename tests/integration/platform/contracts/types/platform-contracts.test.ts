/**
 * Platform Contracts Integration Tests
 *
 * Tests the platform contract factory functions including
 * PlatformPrincipal, RequestEnvelope, ControlDirective, ExecutionPlan,
 * ExecutionReceipt, StateCommand, EvidenceRecord, and ProjectionUpdate.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  createPlatformPrincipal,
  createRequestEnvelope,
  createControlDirective,
  createExecutionPlan,
  createExecutionReceipt,
  createStateCommand,
  createEvidenceRecord,
  createProjectionUpdate,
} from "../../../../../src/platform/contracts/types/index.js";

test("platform-contracts: createPlatformPrincipal generates valid principal", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_123",
    tenantId: "tenant_abc",
    roles: ["admin", "developer"],
    authMethod: "oauth",
    displayName: "Test User",
  });

  assert.equal(principal.actorId, "user_123");
  assert.equal(principal.tenantId, "tenant_abc");
  assert.deepEqual(principal.roles, ["admin", "developer"]);
  assert.equal(principal.authMethod, "oauth");
  assert.equal(principal.displayName, "Test User");
});

test("platform-contracts: createPlatformPrincipal handles optional fields", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_123",
    tenantId: null,
  });

  assert.equal(principal.actorId, "user_123");
  assert.equal(principal.tenantId, null);
  assert.deepEqual(principal.roles, []);
  assert.equal(principal.authMethod, undefined);
  assert.equal(principal.displayName, undefined);
});

test("platform-contracts: createRequestEnvelope generates valid envelope", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_123",
    tenantId: "tenant_abc",
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: { data: "test" },
    metadata: { source: "test" },
  });

  assert.ok(envelope.requestId.startsWith("request_"));
  assert.ok(envelope.idempotencyKey.startsWith("idem_"));
  assert.ok(envelope.traceId.startsWith("trace_"));
  assert.equal(envelope.tenantId, "tenant_abc");
  assert.deepEqual(envelope.payload, { data: "test" });
  assert.deepEqual(envelope.metadata, { source: "test" });
});

test("platform-contracts: createControlDirective generates valid directive", () => {
  const principal = createPlatformPrincipal({
    actorId: "operator_1",
    tenantId: "tenant_abc",
  });

  assert.throws(
    () =>
      createControlDirective({
        type: "pause",
        targetScope: { workflowId: "wf_123" },
        issuedBy: principal,
        reason: "maintenance",
        params: { duration: "1h" },
      }),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as Error & { code?: string }).code === "platform_contracts.legacy_control_directive_forbidden",
  );
});

test("platform-contracts: createControlDirective handles optional expiresAt", () => {
  const principal = createPlatformPrincipal({
    actorId: "operator_1",
    tenantId: null,
  });

  assert.throws(
    () =>
      createControlDirective({
        type: "resume",
        issuedBy: principal,
        reason: "resume after maintenance",
        expiresAt: "2026-12-31T23:59:59.000Z",
      }),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as Error & { code?: string }).code === "platform_contracts.legacy_control_directive_forbidden",
  );
});

test("platform-contracts: createExecutionPlan generates valid plan", () => {
  const principal = createPlatformPrincipal({
    actorId: "system",
    tenantId: null,
  });

  assert.throws(
    () =>
      createExecutionPlan({
        traceId: "trace_abc",
        principal,
        workflowRunId: "wf_run_123",
        steps: [],
        budget: { maxSteps: 10, maxDurationMs: 60000, maxCost: 10 },
      }),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as Error & { code?: string }).code === "execution_plan.legacy_contract_forbidden",
  );
});

test("platform-contracts: createExecutionReceipt generates valid receipt", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "plan_123",
        stepId: "step_1",
        status: "succeeded",
        durationMs: 5000,
        sideEffects: [],
        evidenceRefs: ["ref_1", "ref_2"],
      }),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as Error & { code?: string }).code === "execution_receipt.legacy_contract_forbidden",
  );
});

test("platform-contracts: createExecutionReceipt handles error detail", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "plan_123",
        stepId: "step_1",
        status: "failed",
        durationMs: 1000,
        errorDetail: {
          code: "ERR_FAILED",
          message: "Step failed",
          retryable: true,
        },
      }),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as Error & { code?: string }).code === "execution_receipt.legacy_contract_forbidden",
  );
});

test("platform-contracts: createStateCommand generates valid command", () => {
  const principal = createPlatformPrincipal({
    actorId: "system",
    tenantId: null,
  });

  // createStateCommand is deprecated and always throws
  assert.throws(
    () =>
      createStateCommand({
        traceId: "trace_xyz",
        principal,
        type: "update_truth",
        aggregateId: "task_123",
        expectedVersion: 5,
        fencingToken: "token_abc",
        payload: { status: "done" },
      }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      (error as Error & { code?: string }).code === "DEPRECATED_STATE_COMMAND",
  );
});

test("platform-contracts: createEvidenceRecord generates valid record", () => {
  const principal = createPlatformPrincipal({
    actorId: "system",
    tenantId: "tenant_abc",
  });

  const record = createEvidenceRecord({
    traceId: "trace_123",
    principal,
    category: "decision",
    targetRef: "task_456",
    content: { decision: "approved", reason: "sla_met" },
    metadata: { source: "automation" },
  });

  assert.ok(record.recordId.startsWith("evid_"));
  assert.equal(record.traceId, "trace_123");
  assert.equal(record.category, "decision");
  assert.equal(record.targetRef, "task_456");
  assert.deepEqual(record.content, { decision: "approved", reason: "sla_met" });
});

test("platform-contracts: createProjectionUpdate generates valid update", () => {
  const update = createProjectionUpdate({
    projectionId: "proj_123",
    projectionType: "task_summary",
    version: 3,
    sourceEvents: ["task_created", "task_updated", "task_completed"],
    patch: { totalTasks: 100, completedTasks: 50 },
    triggeredBy: "event_processor",
    rebuiltAt: "2026-01-01T00:00:00.000Z",
    idempotencyKey: "idem_456",
  });

  assert.equal(update.projectionId, "proj_123");
  assert.equal(update.projectionType, "task_summary");
  assert.equal(update.version, 3);
  assert.deepEqual(update.sourceEvents, ["task_created", "task_updated", "task_completed"]);
  assert.deepEqual(update.patch, { totalTasks: 100, completedTasks: 50 });
  assert.equal(update.metadata.triggeredBy, "event_processor");
  assert.equal(update.metadata.rebuiltAt, "2026-01-01T00:00:00.000Z");
  assert.equal(update.metadata.idempotencyKey, "idem_456");
});

test("platform-contracts: createProjectionUpdate generates idempotencyKey if not provided", () => {
  const update = createProjectionUpdate({
    projectionId: "proj_123",
    projectionType: "task_summary",
    version: 1,
    sourceEvents: ["task_created"],
    patch: {},
    triggeredBy: "system",
  });

  assert.ok(update.metadata.idempotencyKey.startsWith("projupd_"));
});
