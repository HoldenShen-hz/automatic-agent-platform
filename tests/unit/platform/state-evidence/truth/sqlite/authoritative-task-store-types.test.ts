import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveTenantScope,
  parseDispatchDecisionTrace,
  mapRuntimeRecoveryRecord,
  type TaskSnapshot,
  type PendingAckEvent,
  type ActiveTaskWithoutWorkflow,
  type InvalidWorkflowState,
  type StaleExecutionRecord,
  type OrphanSessionRecord,
  type GatewaySessionTargetCandidate,
  type WorkflowTerminalMismatchRecord,
  type ActiveTaskTerminalSessionRecord,
  type PendingTier1AckRecord,
  type ActiveExecutionConflictRecord,
  type ActiveExecutionActivityRecord,
  type RuntimeRecoveryRecord,
  type Tier1EventRegistryCoverageRecord,
  type Tier1AuditIntegrityVerificationRow,
  type TaskBoardItem,
  type ExecutionAuthoritativeView,
} from "../../../../../../src/platform/state-evidence/truth/sqlite/authoritative-task-store-types.js";

test("resolveTenantScope returns undefined when tenantId is undefined", () => {
  const result = resolveTenantScope(undefined);
  assert.equal(result, undefined);
});

test("resolveTenantScope returns undefined when tenantId is null", () => {
  const result = resolveTenantScope(null);
  assert.equal(result, undefined);
});

test("resolveTenantScope returns tenantId when provided as string", () => {
  const result = resolveTenantScope("tenant-123");
  assert.equal(result, "tenant-123");
});

test("resolveTenantScope returns empty string when provided as empty string", () => {
  const result = resolveTenantScope("");
  assert.equal(result, "");
});

test("parseDispatchDecisionTrace returns null for invalid JSON", () => {
  const result = parseDispatchDecisionTrace("not valid json");
  assert.equal(result, null);
});

test("parseDispatchDecisionTrace returns null for null input", () => {
  const result = parseDispatchDecisionTrace("null");
  assert.equal(result, null);
});

test("parseDispatchDecisionTrace returns null for array input", () => {
  const result = parseDispatchDecisionTrace('[{"ticketId": "123"}]');
  assert.equal(result, null);
});

test("parseDispatchDecisionTrace returns null for non-object JSON", () => {
  const result = parseDispatchDecisionTrace('"string"');
  assert.equal(result, null);
});

test("parseDispatchDecisionTrace returns null for object missing required fields", () => {
  const result = parseDispatchDecisionTrace('{"ticketId": "123"}');
  assert.equal(result, null);
});

test("parseDispatchDecisionTrace accepts valid minimal trace", () => {
  const validTrace = {
    ticketId: "ticket-123",
    executionId: "exec-456",
    taskId: "task-789",
    queueName: null,
    preferredWorkerId: null,
    requiredCapabilities: [],
    evaluations: [],
  };
  const result = parseDispatchDecisionTrace(JSON.stringify(validTrace));
  assert.deepEqual(result, validTrace);
});

test("mapRuntimeRecoveryRecord maps all fields correctly", () => {
  const row = {
    executionId: "exec-123",
    taskId: "task-456",
    divisionId: "div-789",
    taskStatus: "running",
    status: "active",
    attempt: 2,
    traceId: "trace-abc",
    workflowId: "wf-xyz",
    latestErrorCode: "ERR_TIMEOUT",
    updatedAt: "2026-04-26T12:00:00.000Z",
    lastHeartbeatAt: "2026-04-26T11:59:00.000Z",
    pendingApprovalId: "approval-123",
    precheckId: "precheck-456",
    precheckExecutionId: "exec-789",
    precheckAllowed: 1,
    precheckReasonCode: null,
    precheckResolvedBudgetUsd: 10.5,
    precheckResolvedTimeoutMs: 30000,
    precheckResolvedSandboxMode: "restricted",
    precheckResolvedToolsJson: '["tool1", "tool2"]',
    precheckResolvedPathsJson: '["/path"]',
    precheckCheckedAt: "2026-04-26T11:58:00.000Z",
  };

  const result = mapRuntimeRecoveryRecord(row);

  assert.equal(result.executionId, "exec-123");
  assert.equal(result.taskId, "task-456");
  assert.equal(result.divisionId, "div-789");
  assert.equal(result.taskStatus, "running");
  assert.equal(result.status, "active");
  assert.equal(result.attempt, 2);
  assert.equal(result.traceId, "trace-abc");
  assert.equal(result.workflowId, "wf-xyz");
  assert.equal(result.latestErrorCode, "ERR_TIMEOUT");
  assert.equal(result.updatedAt, "2026-04-26T12:00:00.000Z");
  assert.equal(result.lastHeartbeatAt, "2026-04-26T11:59:00.000Z");
  assert.equal(result.pendingApprovalId, "approval-123");
  assert.ok(result.latestPrecheck !== null);
  assert.equal(result.latestPrecheck!.id, "precheck-456");
  assert.equal(result.latestPrecheck!.resolvedBudgetUsd, 10.5);
});

test("mapRuntimeRecoveryRecord handles missing precheck", () => {
  const row = {
    executionId: "exec-123",
    taskId: "task-456",
    divisionId: null,
    taskStatus: "completed",
    status: "finished",
    attempt: 1,
    traceId: "trace-xyz",
    workflowId: null,
    latestErrorCode: null,
    updatedAt: "2026-04-26T12:00:00.000Z",
    lastHeartbeatAt: null,
    pendingApprovalId: null,
    precheckId: null,
    precheckExecutionId: null,
    precheckAllowed: null,
    precheckReasonCode: null,
    precheckResolvedBudgetUsd: null,
    precheckResolvedTimeoutMs: null,
    precheckResolvedSandboxMode: null,
    precheckResolvedToolsJson: null,
    precheckResolvedPathsJson: null,
    precheckCheckedAt: null,
  };

  const result = mapRuntimeRecoveryRecord(row);

  assert.equal(result.executionId, "exec-123");
  assert.equal(result.divisionId, null);
  assert.equal(result.workflowId, null);
  assert.equal(result.latestErrorCode, null);
  assert.equal(result.lastHeartbeatAt, null);
  assert.equal(result.pendingApprovalId, null);
  assert.equal(result.latestPrecheck, null);
});

test("TaskSnapshot interface structure", () => {
  const snapshot: TaskSnapshot = {
    task: {
      id: "task-123",
      parentId: null,
      rootId: "task-123",
      divisionId: "div-456",
      tenantId: "tenant-789",
      title: "Test Task",
      status: "running",
      source: "api",
      priority: "medium",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 1.0,
      actualCostUsd: null,
      errorCode: null,
      createdAt: "2026-04-26T10:00:00.000Z",
      updatedAt: "2026-04-26T10:30:00.000Z",
      completedAt: null,
    },
    workflow: null,
    execution: null,
    session: null,
    stepOutputs: [],
    artifacts: [],
    events: [],
    consistency: "authoritative",
    observedAt: "2026-04-26T10:30:00.000Z",
  };

  assert.equal(snapshot.task.id, "task-123");
  assert.equal(snapshot.consistency, "authoritative");
  assert.equal(snapshot.observedAt, "2026-04-26T10:30:00.000Z");
});

test("PendingAckEvent interface structure", () => {
  const pendingAckEvent: PendingAckEvent = {
    event: {
      id: "evt-123",
      taskId: "task-456",
      sessionId: null,
      executionId: "exec-789",
      eventType: "task.status.changed",
      eventTier: "tier_1",
      payloadJson: '{"status": "completed"}',
      traceId: "trace-abc",
      createdAt: "2026-04-26T10:00:00.000Z",
    },
    ack: {
      id: "ack-123",
      eventId: "evt-123",
      consumerId: "consumer-xyz",
      status: "pending",
      lastAttemptAt: null,
      ackedAt: null,
      errorCode: null,
      attemptCount: 0,
    },
  };

  assert.equal(pendingAckEvent.event.id, "evt-123");
  assert.equal(pendingAckEvent.ack.consumerId, "consumer-xyz");
  assert.equal(pendingAckEvent.ack.status, "pending");
});

test("ActiveTaskWithoutWorkflow interface structure", () => {
  const activeTask: ActiveTaskWithoutWorkflow = {
    taskId: "task-123",
    taskStatus: "running",
  };
  assert.equal(activeTask.taskId, "task-123");
  assert.equal(activeTask.taskStatus, "running");
});

test("InvalidWorkflowState interface structure", () => {
  const invalidState: InvalidWorkflowState = {
    taskId: "task-123",
    workflowId: "wf-456",
    currentStepIndex: 5,
  };
  assert.equal(invalidState.taskId, "task-123");
  assert.equal(invalidState.workflowId, "wf-456");
  assert.equal(invalidState.currentStepIndex, 5);
});

test("StaleExecutionRecord interface structure", () => {
  const stale: StaleExecutionRecord = {
    executionId: "exec-123",
    taskId: "task-456",
    status: "active",
    updatedAt: "2026-04-25T10:00:00.000Z",
  };
  assert.equal(stale.executionId, "exec-123");
  assert.equal(stale.status, "active");
});

test("OrphanSessionRecord interface structure", () => {
  const orphan: OrphanSessionRecord = {
    sessionId: "sess-123",
    taskId: "task-456",
    sessionStatus: "completed",
    taskStatus: "running",
  };
  assert.equal(orphan.sessionId, "sess-123");
  assert.equal(orphan.taskStatus, "running");
});

test("GatewaySessionTargetCandidate interface structure", () => {
  const candidate: GatewaySessionTargetCandidate = {
    sessionId: "sess-123",
    taskId: "task-456",
    channel: "web",
    sessionStatus: "active",
    externalSessionId: "ext-789",
    taskTitle: "Test Task",
    latestMessage: "Hello",
    latestMessageAt: "2026-04-26T10:00:00.000Z",
    lastSeenAt: "2026-04-26T10:30:00.000Z",
  };
  assert.equal(candidate.channel, "web");
  assert.equal(candidate.externalSessionId, "ext-789");
  assert.equal(candidate.latestMessage, "Hello");
});

test("WorkflowTerminalMismatchRecord interface structure", () => {
  const mismatch: WorkflowTerminalMismatchRecord = {
    taskId: "task-123",
    workflowStatus: "completed",
    workflowUpdatedAt: "2026-04-26T10:00:00.000Z",
    taskStatus: "running",
    sessionId: "sess-456",
    sessionStatus: "active",
  };
  assert.equal(mismatch.workflowStatus, "completed");
  assert.equal(mismatch.taskStatus, "running");
});

test("ActiveTaskTerminalSessionRecord interface structure", () => {
  const record: ActiveTaskTerminalSessionRecord = {
    taskId: "task-123",
    taskStatus: "running",
    sessionId: "sess-456",
    sessionStatus: "failed",
  };
  assert.equal(record.taskStatus, "running");
  assert.equal(record.sessionStatus, "failed");
});

test("PendingTier1AckRecord interface structure", () => {
  const record: PendingTier1AckRecord = {
    eventId: "evt-123",
    taskId: "task-456",
    consumerId: "consumer-xyz",
    eventType: "task.status.changed",
    eventCreatedAt: "2026-04-26T10:00:00.000Z",
  };
  assert.equal(record.eventType, "task.status.changed");
  assert.equal(record.consumerId, "consumer-xyz");
});

test("ActiveExecutionConflictRecord interface structure", () => {
  const record: ActiveExecutionConflictRecord = {
    taskId: "task-123",
    activeExecutionIds: ["exec-1", "exec-2", "exec-3"],
  };
  assert.equal(record.taskId, "task-123");
  assert.equal(record.activeExecutionIds.length, 3);
});

test("ActiveExecutionActivityRecord interface structure", () => {
  const record: ActiveExecutionActivityRecord = {
    executionId: "exec-123",
    taskId: "task-456",
    agentId: "agent-789",
    status: "active",
    updatedAt: "2026-04-26T10:00:00.000Z",
    latestEventAt: "2026-04-26T09:59:00.000Z",
    latestHeartbeatAt: "2026-04-26T09:58:00.000Z",
  };
  assert.equal(record.status, "active");
  assert.equal(record.latestEventAt, "2026-04-26T09:59:00.000Z");
});

test("RuntimeRecoveryRecord interface structure", () => {
  const record: RuntimeRecoveryRecord = {
    executionId: "exec-123",
    taskId: "task-456",
    divisionId: "div-789",
    taskStatus: "running",
    status: "active",
    attempt: 1,
    traceId: "trace-abc",
    workflowId: "wf-xyz",
    latestErrorCode: null,
    updatedAt: "2026-04-26T10:00:00.000Z",
    lastHeartbeatAt: "2026-04-26T09:59:00.000Z",
    pendingApprovalId: null,
    latestPrecheck: null,
  };
  assert.equal(record.attempt, 1);
  assert.equal(record.latestPrecheck, null);
});

test("Tier1EventRegistryCoverageRecord interface structure", () => {
  const record: Tier1EventRegistryCoverageRecord = {
    eventId: "evt-123",
    eventType: "task.status.changed",
    ackConsumers: ["consumer-1", "consumer-2"],
  };
  assert.equal(record.ackConsumers.length, 2);
});

test("Tier1AuditIntegrityVerificationRow interface structure", () => {
  const record: Tier1AuditIntegrityVerificationRow = {
    eventId: "evt-123",
    chainPosition: 1,
    eventType: "task.status.changed",
    eventCreatedAt: "2026-04-26T10:00:00.000Z",
    eventChecksum: "abc123",
    previousChainHash: null,
    chainHash: "def456",
    recordedAt: "2026-04-26T10:00:01.000Z",
    currentEventType: "task.status.changed",
    taskId: "task-456",
    sessionId: "sess-789",
    executionId: "exec-abc",
    eventTier: "tier_1",
    payloadJson: '{"test": true}',
    traceId: "trace-xyz",
    createdAt: "2026-04-26T10:00:00.000Z",
  };
  assert.equal(record.chainPosition, 1);
  assert.equal(record.eventTier, "tier_1");
});

test("TaskBoardItem interface structure", () => {
  const item: TaskBoardItem = {
    taskId: "task-123",
    title: "Test Task",
    priority: "high",
    taskStatus: "running",
    workflowStatus: "active",
    divisionId: "div-456",
    currentStepIndex: 3,
    sessionStatus: "active",
    latestEventAt: "2026-04-26T10:00:00.000Z",
    updatedAt: "2026-04-26T10:30:00.000Z",
  };
  assert.equal(item.priority, "high");
  assert.equal(item.currentStepIndex, 3);
});

test("ExecutionAuthoritativeView interface structure", () => {
  const view: ExecutionAuthoritativeView = {
    execution: {
      id: "exec-123",
      taskId: "task-456",
      workflowId: "wf-789",
      parentExecutionId: null,
      agentId: "agent-abc",
      roleId: null,
      runKind: "execute",
      status: "active",
      inputRef: null,
      traceId: "trace-xyz",
      attempt: 1,
      timeoutMs: 60000,
      budgetUsdLimit: null,
      requiresApproval: false,
      sandboxMode: null,
      allowedToolsJson: null,
      allowedPathsJson: null,
      maxRetries: 3,
      retryBackoff: "exponential",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: "2026-04-26T10:00:00.000Z",
      finishedAt: null,
      createdAt: "2026-04-26T10:00:00.000Z",
      updatedAt: "2026-04-26T10:30:00.000Z",
    },
    task: null,
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: "2026-04-26T10:30:00.000Z",
  };
  assert.equal(view.execution.id, "exec-123");
  assert.equal(view.consistency, "authoritative");
});