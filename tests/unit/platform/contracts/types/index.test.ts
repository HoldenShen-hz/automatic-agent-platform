import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for types/index.ts barrel export
 *
 * This module re-exports:
 * - IDs utilities (ids.ts)
 * - Status types and type guards (status.ts)
 * - Unified severity mappings (unified-severity.ts)
 * - Anomaly event classification (anomaly-event-classification.ts)
 * - Platform contracts factory functions (platform-contracts.ts)
 * - Recovery cadence types (recovery-cadence.ts)
 * - Unified runtime mode types (unified-runtime-mode.ts)
 */

import {
  // IDs utilities
  newId,
  nowIso,
  // Status constants
  TASK_STATUSES,
  WORKFLOW_STATUSES,
  SESSION_STATUSES,
  EXECUTION_STATUSES,
  APPROVAL_STATUSES,
  // Status type guards
  isTaskStatus,
  isWorkflowStatus,
  isSessionStatus,
  isExecutionStatus,
  isSessionTerminalStatus,
  // Unified severity
  UNIFIED_SEVERITIES,
  UNIFIED_SEVERITY_SLA,
  anomalySeverityToUnifiedSeverity,
  alertSeverityToUnifiedSeverity,
  runbookSeverityToUnifiedSeverity,
  diagnosticSeverityToUnifiedSeverity,
  // Anomaly classification
  ANOMALY_EVENT_CLASSES,
  classifyAnomalyEvent,
  // Platform contracts
  createPlatformPrincipal,
  createRequestEnvelope,
  createControlDirective,
  createExecutionPlan,
  createExecutionReceipt,
  createStateCommand,
  createEvidenceRecord,
  createProjectionUpdate,
  // Recovery cadence
  buildRecoveryCadence,
  // Unified runtime mode
  mapPolicyModeToUnifiedRuntimeMode,
  mapHealthDegradationModeToUnifiedRuntimeMode,
  mapAutonomyLevelToUnifiedRuntimeMode,
} from "../../../../../src/platform/contracts/types/index.js";

test("newId generates unique IDs with semantic prefix", () => {
  const id = newId("task");
  assert.ok(id.startsWith("task_"), "ID should start with task_ prefix");
  assert.ok(id.length > "task_".length, "ID should have UUID part after prefix");
});

test("newId generates different IDs on each call", () => {
  const id1 = newId("task");
  const id2 = newId("task");
  assert.notEqual(id1, id2, "Each call should generate unique ID");
});

test("newId works with various prefixes", () => {
  const prefixes = ["task", "exec", "sess", "workflow", "plan", "receipt"];
  for (const prefix of prefixes) {
    const id = newId(prefix);
    assert.ok(id.startsWith(`${prefix}_`), `ID should start with ${prefix}_`);
  }
});

test("nowIso returns valid ISO 8601 timestamp", () => {
  const timestamp = nowIso();
  // Should be parseable as a Date
  const date = new Date(timestamp);
  assert.ok(!isNaN(date.getTime()), "Timestamp should be valid date");
  assert.ok(timestamp.endsWith("Z"), "Timestamp should end with Z (UTC)");
  assert.ok(timestamp.includes("T"), "Timestamp should contain T separator");
});

test("nowIso returns current time within acceptable window", () => {
  const before = Date.now();
  const timestamp = nowIso();
  const after = Date.now();
  const date = new Date(timestamp);
  // Allow 1 second tolerance for test execution time
  assert.ok(date.getTime() >= before, "Timestamp should be >= before");
  assert.ok(date.getTime() <= after + 1000, "Timestamp should be <= after + 1s");
});

// TASK_STATUSES tests
test("TASK_STATUSES contains all expected terminal states", () => {
  const expected = ["queued", "pending", "in_progress", "awaiting_decision", "done", "failed", "cancelled"];
  assert.deepEqual(TASK_STATUSES, expected);
});

test("TASK_STATUSES is readonly tuple", () => {
  assert.ok(Array.isArray(TASK_STATUSES));
  assert.equal(TASK_STATUSES.length, 7);
});

// WORKFLOW_STATUSES tests
test("WORKFLOW_STATUSES contains all expected states", () => {
  const expected = ["running", "paused", "resuming", "completed", "failed", "cancelling", "cancelled"];
  assert.deepEqual(WORKFLOW_STATUSES, expected);
});

test("WORKFLOW_STATUSES is readonly tuple", () => {
  assert.ok(Array.isArray(WORKFLOW_STATUSES));
  assert.equal(WORKFLOW_STATUSES.length, 7);
});

// SESSION_STATUSES tests
test("SESSION_STATUSES contains all expected states", () => {
  const expected = ["open", "streaming", "awaiting_user", "paused", "completed", "failed", "cancelled"];
  assert.deepEqual(SESSION_STATUSES, expected);
});

test("SESSION_STATUSES is readonly tuple", () => {
  assert.ok(Array.isArray(SESSION_STATUSES));
  assert.equal(SESSION_STATUSES.length, 7);
});

// EXECUTION_STATUSES tests
test("EXECUTION_STATUSES contains all expected states", () => {
  const expected = [
    "created",
    "prechecking",
    "ready",
    "queued",
    "dispatching",
    "executing",
    "blocked",
    "paused",
    "resuming",
    "recovering",
    "timed_out",
    "succeeded",
    "failed",
    "cancelled",
    "superseded",
  ];
  assert.deepEqual(EXECUTION_STATUSES, expected);
});

test("EXECUTION_STATUSES is readonly tuple", () => {
  assert.ok(Array.isArray(EXECUTION_STATUSES));
  assert.equal(EXECUTION_STATUSES.length, 15);
});

// APPROVAL_STATUSES tests
test("APPROVAL_STATUSES contains all expected states", () => {
  const expected = ["requested", "approved", "rejected", "expired", "cancelled"];
  assert.deepEqual(APPROVAL_STATUSES, expected);
});

test("APPROVAL_STATUSES is readonly tuple", () => {
  assert.ok(Array.isArray(APPROVAL_STATUSES));
  assert.equal(APPROVAL_STATUSES.length, 5);
});

// Type guard tests
test("isTaskStatus returns true for valid statuses", () => {
  for (const status of TASK_STATUSES) {
    assert.equal(isTaskStatus(status), true, `${status} should be valid`);
  }
});

test("isTaskStatus returns false for invalid statuses", () => {
  assert.equal(isTaskStatus("invalid"), false);
  assert.equal(isTaskStatus(""), false);
  assert.equal(isTaskStatus("DONE"), false); // case-sensitive
});

test("isWorkflowStatus returns true for valid statuses", () => {
  for (const status of WORKFLOW_STATUSES) {
    assert.equal(isWorkflowStatus(status), true, `${status} should be valid`);
  }
});

test("isWorkflowStatus returns false for invalid statuses", () => {
  assert.equal(isWorkflowStatus("running_test"), false);
  assert.equal(isWorkflowStatus(""), false);
});

test("isSessionStatus returns true for valid statuses", () => {
  for (const status of SESSION_STATUSES) {
    assert.equal(isSessionStatus(status), true, `${status} should be valid`);
  }
});

test("isSessionStatus returns false for invalid statuses", () => {
  assert.equal(isSessionStatus("open_test"), false);
});

test("isExecutionStatus returns true for valid statuses", () => {
  for (const status of EXECUTION_STATUSES) {
    assert.equal(isExecutionStatus(status), true, `${status} should be valid`);
  }
});

test("isExecutionStatus returns false for invalid statuses", () => {
  assert.equal(isExecutionStatus("running"), false);
  assert.equal(isExecutionStatus("done"), false);
});

test("isSessionTerminalStatus returns true for terminal statuses", () => {
  assert.equal(isSessionTerminalStatus("completed"), true);
  assert.equal(isSessionTerminalStatus("failed"), true);
  assert.equal(isSessionTerminalStatus("cancelled"), true);
});

test("isSessionTerminalStatus returns false for non-terminal statuses", () => {
  assert.equal(isSessionTerminalStatus("open"), false);
  assert.equal(isSessionTerminalStatus("streaming"), false);
  assert.equal(isSessionTerminalStatus("awaiting_user"), false);
  assert.equal(isSessionTerminalStatus("paused"), false);
});

// Unified severity tests
test("UNIFIED_SEVERITIES contains SEV1 through SEV4", () => {
  assert.deepEqual(UNIFIED_SEVERITIES, ["SEV1", "SEV2", "SEV3", "SEV4"]);
});

test("UNIFIED_SEVERITY_SLA has entries for all severities", () => {
  for (const severity of UNIFIED_SEVERITIES) {
    assert.ok(UNIFIED_SEVERITY_SLA[severity], `SLA should exist for ${severity}`);
    assert.ok(typeof UNIFIED_SEVERITY_SLA[severity].acknowledgeWithinMinutes === "number");
    assert.ok(typeof UNIFIED_SEVERITY_SLA[severity].mitigateWithinMinutes === "number");
    assert.ok(typeof UNIFIED_SEVERITY_SLA[severity].ownerExpectation === "string");
  }
});

test("anomalySeverityToUnifiedSeverity maps correctly", () => {
  assert.equal(anomalySeverityToUnifiedSeverity("emergency"), "SEV1");
  assert.equal(anomalySeverityToUnifiedSeverity("critical"), "SEV2");
  assert.equal(anomalySeverityToUnifiedSeverity("warning"), "SEV3");
  assert.equal(anomalySeverityToUnifiedSeverity("info"), "SEV4");
  // Default fallback
  assert.equal(anomalySeverityToUnifiedSeverity("unknown" as any), "SEV4");
});

test("alertSeverityToUnifiedSeverity maps correctly", () => {
  assert.equal(alertSeverityToUnifiedSeverity("page"), "SEV1");
  assert.equal(alertSeverityToUnifiedSeverity("critical"), "SEV2");
  assert.equal(alertSeverityToUnifiedSeverity("warning"), "SEV3");
  assert.equal(alertSeverityToUnifiedSeverity("info"), "SEV4");
});

test("runbookSeverityToUnifiedSeverity maps correctly", () => {
  assert.equal(runbookSeverityToUnifiedSeverity("P0"), "SEV1");
  assert.equal(runbookSeverityToUnifiedSeverity("P1"), "SEV2");
  assert.equal(runbookSeverityToUnifiedSeverity("P2"), "SEV3");
  assert.equal(runbookSeverityToUnifiedSeverity("P3"), "SEV4");
});

test("diagnosticSeverityToUnifiedSeverity maps correctly", () => {
  assert.equal(diagnosticSeverityToUnifiedSeverity("critical"), "SEV2");
  assert.equal(diagnosticSeverityToUnifiedSeverity("warning"), "SEV3");
  assert.equal(diagnosticSeverityToUnifiedSeverity("info"), "SEV4");
});

// Anomaly event classification tests
test("ANOMALY_EVENT_CLASSES contains all expected classes", () => {
  const expected = ["E1_BUSINESS", "E2_EXECUTION", "E3_EXTERNAL_DEPENDENCY", "E4_SECURITY", "E5_DATA", "E6_GOVERNANCE"];
  assert.deepEqual(ANOMALY_EVENT_CLASSES, expected);
});

test("classifyAnomalyEvent detects security signals", () => {
  const result = classifyAnomalyEvent({
    metricName: "auth_failure_rate",
    legacySeverity: "critical",
    context: { statusCode: 401 },
  });
  assert.equal(result.anomalyEventClass, "E4_SECURITY");
  assert.equal(result.unifiedSeverity, "SEV2");
  assert.ok(result.reason.includes("security"));
});

test("classifyAnomalyEvent detects external dependency signals", () => {
  const result = classifyAnomalyEvent({
    metricName: "provider_503_rate",
    legacySeverity: "emergency",
    context: { statusCode: 503 },
  });
  assert.equal(result.anomalyEventClass, "E3_EXTERNAL_DEPENDENCY");
  assert.equal(result.unifiedSeverity, "SEV1");
});

test("classifyAnomalyEvent detects data signals", () => {
  const result = classifyAnomalyEvent({
    metricName: "database_connection_errors",
    legacySeverity: "warning",
    context: { db: "postgres" },
  });
  assert.equal(result.anomalyEventClass, "E5_DATA");
});

test("classifyAnomalyEvent detects execution signals", () => {
  const result = classifyAnomalyEvent({
    metricName: "workflow_queue_depth",
    legacySeverity: "warning",
    context: { queue: "default" },
  });
  assert.equal(result.anomalyEventClass, "E2_EXECUTION");
});

test("classifyAnomalyEvent defaults to E1_BUSINESS when no pattern matches", () => {
  const result = classifyAnomalyEvent({
    metricName: "random_metric",
    legacySeverity: "info",
    context: { unrelated: "value" },
  });
  assert.equal(result.anomalyEventClass, "E1_BUSINESS");
  assert.equal(result.reason, "business_signal_default");
});

test("classifyAnomalyEvent includes all classification fields", () => {
  const result = classifyAnomalyEvent({
    metricName: "test_metric",
    legacySeverity: "warning",
    context: null,
  });
  assert.equal(result.metricName, "test_metric");
  assert.equal(result.legacySeverity, "warning");
  assert.ok(ANOMALY_EVENT_CLASSES.includes(result.anomalyEventClass));
});

// Platform contracts factory tests
test("createPlatformPrincipal creates principal with minimal input", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_123",
    tenantId: null,
  });
  assert.equal(principal.actorId, "user_123");
  assert.equal(principal.tenantId, null);
  assert.deepEqual(principal.roles, []);
});

test("createPlatformPrincipal accepts all optional fields", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_123",
    tenantId: "tenant_abc",
    roles: ["admin", "operator"],
    authMethod: "jwt",
    displayName: "Test User",
  });
  assert.equal(principal.actorId, "user_123");
  assert.equal(principal.tenantId, "tenant_abc");
  assert.deepEqual(principal.roles, ["admin", "operator"]);
  assert.equal(principal.authMethod, "jwt");
  assert.equal(principal.displayName, "Test User");
});

test("createRequestEnvelope creates envelope with defaults", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_123",
    tenantId: null,
  });
  const envelope = createRequestEnvelope({
    principal,
    payload: { action: "test" },
  });
  assert.ok(envelope.requestId.startsWith("request_"));
  assert.ok(envelope.traceId.startsWith("trace_"));
  assert.equal(envelope.principal, principal);
  assert.deepEqual(envelope.payload, { action: "test" });
});

test("createRequestEnvelope accepts custom values", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_123",
    tenantId: "tenant_abc",
  });
  const envelope = createRequestEnvelope({
    principal,
    tenantId: "custom_tenant",
    payload: { action: "deploy" },
    requestId: "req_custom",
    idempotencyKey: "idem_custom",
    traceId: "trace_custom",
    timestamp: "2026-04-24T00:00:00.000Z",
    metadata: { source: "api", confirmationRequired: true },
  });
  assert.equal(envelope.requestId, "req_custom");
  assert.equal(envelope.idempotencyKey, "idem_custom");
  assert.equal(envelope.traceId, "trace_custom");
  assert.equal(envelope.tenantId, "custom_tenant");
  assert.equal(envelope.timestamp, "2026-04-24T00:00:00.000Z");
});

test("createControlDirective creates directive with minimal input", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "pause",
        targetRef: "task_123",
        reasonCode: "maintenance",
        issuedBy: "operator_1",
        tenantId: null,
        executionId: null,
        metadata: {},
      }),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as Error & { code?: string }).code === "control_directive.legacy_contract_forbidden",
  );
});

test("createControlDirective accepts all directive types", () => {
  const types = ["pause", "resume", "cancel", "rollback", "escalate"] as const;
  for (const type of types) {
    assert.throws(
      () =>
        createControlDirective({
          kind: type,
          targetRef: "task_123",
          reasonCode: `testing_${type}`,
          issuedBy: "operator_1",
          tenantId: null,
          executionId: null,
          metadata: {},
        }),
      (error: unknown) =>
        error instanceof Error
        && "code" in error
        && (error as Error & { code?: string }).code === "control_directive.legacy_contract_forbidden",
    );
  }
});

test("createControlDirective accepts target scope", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "pause",
        targetRef: "task_123",
        reasonCode: "targeted_pause",
        issuedBy: "operator_1",
        tenantId: null,
        executionId: null,
        metadata: {},
        targetScope: { tenantId: "tenant_abc", workflowId: "workflow_123" },
      }),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as Error & { code?: string }).code === "control_directive.legacy_contract_forbidden",
  );
});

test("createExecutionPlan creates plan with minimal input", () => {
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: "task_123",
        tenantId: "tenant_abc",
        version: 1,
        steps: [],
      }),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as Error & { code?: string }).code === "execution_plan.legacy_contract_forbidden",
  );
});

test("createExecutionReceipt creates receipt with minimal input", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "plan_123",
        stepId: "step_456",
        status: "succeeded",
        durationMs: 1500,
      }),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as Error & { code?: string }).code === "execution_receipt.legacy_contract_forbidden",
  );
});

test("createExecutionReceipt accepts error detail", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "plan_123",
        stepId: "step_456",
        status: "failed",
        durationMs: 500,
        errorDetail: { code: "E001", message: "Step failed", retryable: true },
      }),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as Error & { code?: string }).code === "execution_receipt.legacy_contract_forbidden",
  );
});

test("createStateCommand creates command with all fields", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_123",
    tenantId: null,
  });
  const command = createStateCommand({
    traceId: "trace_123",
    principal,
    type: "append_event",
    aggregateId: "task_456",
    expectedVersion: 3,
    fencingToken: "fence_abc",
    payload: { eventType: "task.completed" },
  });
  assert.ok(command.commandId.startsWith("statecmd_"));
  assert.equal(command.type, "append_event");
  assert.equal(command.aggregateId, "task_456");
  assert.equal(command.expectedVersion, 3);
  assert.equal(command.fencingToken, "fence_abc");
});

test("createEvidenceRecord creates record with minimal input", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_123",
    tenantId: null,
  });
  const record = createEvidenceRecord({
    traceId: "trace_123",
    principal,
    category: "decision",
    targetRef: "task_456",
    content: { decision: "approved" },
  });
  assert.ok(record.recordId.startsWith("evid_"));
  assert.equal(record.traceId, "trace_123");
  assert.equal(record.category, "decision");
  assert.ok(record.timestamp.endsWith("Z"));
});

test("createEvidenceRecord accepts metadata", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_123",
    tenantId: null,
  });
  const record = createEvidenceRecord({
    traceId: "trace_123",
    principal,
    category: "audit",
    targetRef: "task_456",
    content: { action: "delete" },
    metadata: { reason: "user_requested", approver: "admin" },
  });
  assert.deepEqual(record.metadata, { reason: "user_requested", approver: "admin" });
});

test("createProjectionUpdate creates update with all fields", () => {
  const update = createProjectionUpdate({
    projectionId: "proj_123",
    projectionType: "task_status",
    version: 5,
    sourceEvents: ["evt_1", "evt_2"],
    patch: { status: "completed" },
    triggeredBy: "test",
  });
  assert.equal(update.projectionId, "proj_123");
  assert.equal(update.projectionType, "task_status");
  assert.equal(update.version, 5);
  assert.deepEqual(update.sourceEvents, ["evt_1", "evt_2"]);
  assert.deepEqual(update.patch, { status: "completed" });
  assert.equal(update.metadata.triggeredBy, "test");
  assert.ok(update.timestamp.endsWith("Z"));
});

test("createProjectionUpdate accepts optional idempotencyKey", () => {
  const update = createProjectionUpdate({
    projectionId: "proj_123",
    projectionType: "task_status",
    version: 1,
    sourceEvents: [],
    patch: {},
    triggeredBy: "test",
    idempotencyKey: "idem_test",
  });
  assert.equal(update.metadata.idempotencyKey, "idem_test");
});

// Recovery cadence tests
test("buildRecoveryCadence creates cadence with minimal input", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 5000 });
  assert.equal(cadence.intervalMs, 5000);
  assert.equal(cadence.maxConcurrent, 1);
  assert.equal(cadence.priority, "normal");
});

test("buildRecoveryCadence applies defaults correctly", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 10000, maxConcurrent: 5, priority: "high" });
  assert.equal(cadence.intervalMs, 10000);
  assert.equal(cadence.maxConcurrent, 5);
  assert.equal(cadence.priority, "high");
});

test("buildRecoveryCadence clamps negative values", () => {
  const cadence = buildRecoveryCadence({ intervalMs: -100, maxConcurrent: -5 });
  assert.equal(cadence.intervalMs, 1);
  assert.equal(cadence.maxConcurrent, 1);
});

// Unified runtime mode mapping tests
test("mapPolicyModeToUnifiedRuntimeMode maps full-auto", () => {
  assert.equal(mapPolicyModeToUnifiedRuntimeMode("full-auto"), "full_auto");
});

test("mapPolicyModeToUnifiedRuntimeMode maps auto to supervised_auto", () => {
  assert.equal(mapPolicyModeToUnifiedRuntimeMode("auto"), "supervised_auto");
});

test("mapPolicyModeToUnifiedRuntimeMode maps supervised to manual_only", () => {
  assert.equal(mapPolicyModeToUnifiedRuntimeMode("supervised"), "manual_only");
});

test("mapPolicyModeToUnifiedRuntimeMode maps read-only", () => {
  assert.equal(mapPolicyModeToUnifiedRuntimeMode("read-only"), "read_only");
});

test("mapPolicyModeToUnifiedRuntimeMode maps maintenance to no_rollout", () => {
  assert.equal(mapPolicyModeToUnifiedRuntimeMode("maintenance"), "no_rollout");
});

test("mapPolicyModeToUnifiedRuntimeMode maps incident-mode", () => {
  assert.equal(mapPolicyModeToUnifiedRuntimeMode("incident-mode"), "incident_mode");
});

test("mapPolicyModeToUnifiedRuntimeMode maps degraded", () => {
  assert.equal(mapPolicyModeToUnifiedRuntimeMode("degraded"), "no_external_call");
});

test("mapPolicyModeToUnifiedRuntimeMode maps emergency to no_write", () => {
  assert.equal(mapPolicyModeToUnifiedRuntimeMode("emergency"), "no_write");
});

test("mapHealthDegradationModeToUnifiedRuntimeMode maps none to full_auto", () => {
  assert.equal(mapHealthDegradationModeToUnifiedRuntimeMode("none"), "full_auto");
});

test("mapHealthDegradationModeToUnifiedRuntimeMode maps fast_only", () => {
  assert.equal(mapHealthDegradationModeToUnifiedRuntimeMode("fast_only"), "supervised_auto");
});

test("mapHealthDegradationModeToUnifiedRuntimeMode maps queue_only", () => {
  assert.equal(mapHealthDegradationModeToUnifiedRuntimeMode("queue_only"), "no_external_call");
});

test("mapHealthDegradationModeToUnifiedRuntimeMode maps pause_non_critical", () => {
  assert.equal(mapHealthDegradationModeToUnifiedRuntimeMode("pause_non_critical"), "manual_only");
});

test("mapHealthDegradationModeToUnifiedRuntimeMode maps read_only_operations_only", () => {
  assert.equal(mapHealthDegradationModeToUnifiedRuntimeMode("read_only_operations_only"), "read_only");
});

test("mapAutonomyLevelToUnifiedRuntimeMode maps full_auto", () => {
  assert.equal(mapAutonomyLevelToUnifiedRuntimeMode("full_auto"), "full_auto");
});

test("mapAutonomyLevelToUnifiedRuntimeMode maps semi_auto", () => {
  assert.equal(mapAutonomyLevelToUnifiedRuntimeMode("semi_auto"), "supervised_auto");
});

test("mapAutonomyLevelToUnifiedRuntimeMode maps supervised", () => {
  assert.equal(mapAutonomyLevelToUnifiedRuntimeMode("supervised"), "manual_only");
});

test("mapAutonomyLevelToUnifiedRuntimeMode maps suggestion", () => {
  assert.equal(mapAutonomyLevelToUnifiedRuntimeMode("suggestion"), "no_write");
});

test("mapAutonomyLevelToUnifiedRuntimeMode maps frozen to incident_mode", () => {
  assert.equal(mapAutonomyLevelToUnifiedRuntimeMode("frozen"), "incident_mode");
});
