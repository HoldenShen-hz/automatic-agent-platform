import assert from "node:assert/strict";
import test from "node:test";

import type {
  TraceContext,
  TransitionAuditContext,
  TransitionPrincipalLike,
  TransitionCommand,
  TaskStatusTransitionCommand,
  WorkflowStatusTransitionCommand,
  SessionStatusTransitionCommand,
  ExecutionStatusTransitionCommand,
  ApprovalStatusTransitionCommand,
  TaskSnapshot,
} from "../../../../../../src/platform/contracts/types/domain/core-types.js";
import type { TransitionEntityKind, TransitionActorType } from "../../../../../../src/platform/contracts/types/domain/primitives.js";
import type { TaskStatus, WorkflowStatus, ExecutionStatus, SessionStatus, ApprovalStatus } from "../../../../../../src/platform/contracts/types/status.js";
import type { TaskRecord } from "../../../../../../src/platform/contracts/types/domain/task-types.js";
import type { ExecutionRecord } from "../../../../../../src/platform/contracts/types/domain/execution-types.js";
import type { SessionRecord } from "../../../../../../src/platform/contracts/types/domain/session-types.js";
import type { WorkflowStateRecord, StepOutputRecord } from "../../../../../../src/platform/contracts/types/domain/task-types.js";

test("TraceContext structure is correct", () => {
  const ctx: TraceContext = {
    traceId: "trace_abc123",
    spanId: "span_456",
    parentSpanId: "span_789",
    correlationId: "corr_xyz",
  };
  assert.equal(ctx.traceId, "trace_abc123");
  assert.equal(ctx.spanId, "span_456");
  assert.equal(ctx.parentSpanId, "span_789");
  assert.equal(ctx.correlationId, "corr_xyz");
});

test("TraceContext allows null optional fields", () => {
  const ctx: TraceContext = {
    traceId: "trace_abc",
    spanId: null,
    parentSpanId: null,
    correlationId: null,
  };
  assert.equal(ctx.spanId, null);
  assert.equal(ctx.parentSpanId, null);
  assert.equal(ctx.correlationId, null);
});

test("TransitionAuditContext structure is correct", () => {
  const ctx: TransitionAuditContext = {
    reasonCode: "task.completed",
    reasonDetail: "Task finished successfully",
    traceId: "trace_abc",
    spanId: "span_123",
    parentSpanId: null,
    correlationId: "corr_xyz",
    actorType: "agent",
    actorId: "worker_456",
    idempotencyKey: "idempotent_789",
    occurredAt: "2026-04-14T00:00:00.000Z",
    metadataJson: '{"extra":"data"}',
  };
  assert.equal(ctx.reasonCode, "task.completed");
  assert.equal(ctx.actorType, "agent");
  assert.equal(ctx.actorId, "worker_456");
});

test("TransitionAuditContext allows minimal definition", () => {
  const ctx: TransitionAuditContext = {
    reasonCode: "system.scheduled",
    traceId: "trace_min",
    actorType: "system",
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(ctx.reasonCode, "system.scheduled");
  assert.equal(ctx.actorType, "system");
  assert.equal(ctx.reasonDetail, undefined);
  assert.equal(ctx.actorId, undefined);
});

test("TransitionAuditContext actorType accepts all valid values", () => {
  const types: TransitionActorType[] = ["user", "agent", "system", "scheduler", "admin", "webhook", "recovery"];
  assert.equal(types.length, 7);
});

test("TransitionEntityKind accepts all valid values", () => {
  const kinds: TransitionEntityKind[] = ["task", "workflow", "session", "approval", "execution"];
  assert.equal(kinds.length, 5);
});

test("TransitionCommand structure is correct", () => {
  const principal: TransitionPrincipalLike = {
    principalId: "principal_1",
    tenantId: "tenant_1",
    roles: ["operator"],
  };
  const cmd: TransitionCommand<"task", TaskStatus> = {
    entityKind: "task",
    entityId: "task_123",
    fromStatus: "in_progress",
    toStatus: "done",
    reasonCode: "task.done",
    traceId: "trace_abc",
    actorType: "agent",
    principal,
    leaseId: "lease_1",
    fencingToken: "fence_1",
    event: "task.transitioned",
    payload: { status: "done" },
    expectedVersion: 3,
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(cmd.entityKind, "task");
  assert.equal(cmd.toStatus, "done");
  assert.equal(cmd.principal?.principalId, "principal_1");
  assert.equal(cmd.leaseId, "lease_1");
  assert.equal(cmd.expectedVersion, 3);
});

test("TaskStatusTransitionCommand structure is correct", () => {
  const cmd: TaskStatusTransitionCommand = {
    entityKind: "task",
    entityId: "task_456",
    fromStatus: "pending",
    toStatus: "in_progress",
    executionId: "exec_789",
    reasonCode: "task.started",
    traceId: "trace_def",
    actorType: "scheduler",
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(cmd.entityKind, "task");
  assert.equal(cmd.fromStatus, "pending");
  assert.equal(cmd.toStatus, "in_progress");
  assert.equal(cmd.executionId, "exec_789");
});

test("TaskStatusTransitionCommand allows null executionId", () => {
  const cmd: TaskStatusTransitionCommand = {
    entityKind: "task",
    entityId: "task_abc",
    fromStatus: "queued",
    toStatus: "cancelled",
    executionId: null,
    reasonCode: "task.cancelled",
    traceId: "trace_ghi",
    actorType: "user",
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(cmd.executionId, null);
});

test("WorkflowStatusTransitionCommand structure is correct", () => {
  const cmd: WorkflowStatusTransitionCommand = {
    entityKind: "workflow",
    entityId: "wf_123",
    fromStatus: "running",
    toStatus: "paused",
    currentStepIndex: 2,
    outputsJson: '{"step1":"output1"}',
    reasonCode: "workflow.paused",
    traceId: "trace_wf",
    actorType: "agent",
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(cmd.entityKind, "workflow");
  assert.equal(cmd.fromStatus, "running");
  assert.equal(cmd.toStatus, "paused");
  assert.equal(cmd.currentStepIndex, 2);
});

test("SessionStatusTransitionCommand structure is correct", () => {
  const cmd: SessionStatusTransitionCommand = {
    entityKind: "session",
    entityId: "sess_123",
    fromStatus: "open",
    toStatus: "completed",
    reasonCode: "session.completed",
    traceId: "trace_sess",
    actorType: "agent",
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(cmd.entityKind, "session");
  assert.equal(cmd.fromStatus, "open");
  assert.equal(cmd.toStatus, "completed");
});

test("ExecutionStatusTransitionCommand structure is correct", () => {
  const cmd: ExecutionStatusTransitionCommand = {
    entityKind: "execution",
    entityId: "exec_123",
    fromStatus: "prechecking",
    toStatus: "executing",
    reasonCode: "execution.started",
    traceId: "trace_exec",
    actorType: "scheduler",
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(cmd.entityKind, "execution");
  assert.equal(cmd.fromStatus, "prechecking");
  assert.equal(cmd.toStatus, "executing");
});

test("ApprovalStatusTransitionCommand structure is correct", () => {
  const cmd: ApprovalStatusTransitionCommand = {
    entityKind: "approval",
    entityId: "approval_123",
    fromStatus: "requested",
    toStatus: "approved",
    responseJson: '{"decision":"approved","reason":"looks good"}',
    reasonCode: "approval.approved",
    traceId: "trace_appr",
    actorType: "user",
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(cmd.entityKind, "approval");
  assert.equal(cmd.fromStatus, "requested");
  assert.equal(cmd.toStatus, "approved");
});

test("TaskStatus accepts all valid values", () => {
  const statuses: TaskStatus[] = ["queued", "pending", "in_progress", "awaiting_decision", "done", "failed", "cancelled"];
  assert.equal(statuses.length, 7);
});

test("WorkflowStatus accepts all valid values", () => {
  const statuses: WorkflowStatus[] = ["running", "paused", "resuming", "completed", "failed", "cancelling", "cancelled"];
  assert.equal(statuses.length, 7);
});

test("SessionStatus accepts all valid values", () => {
  const statuses: SessionStatus[] = ["open", "streaming", "awaiting_user", "paused", "completed", "failed", "cancelled"];
  assert.equal(statuses.length, 7);
});

test("ExecutionStatus accepts all valid values", () => {
  const statuses: ExecutionStatus[] = ["created", "prechecking", "executing", "blocked", "succeeded", "failed", "cancelled", "superseded"];
  assert.equal(statuses.length, 8);
});

test("ApprovalStatus accepts all valid values", () => {
  const statuses: ApprovalStatus[] = ["requested", "approved", "rejected", "expired", "cancelled"];
  assert.equal(statuses.length, 5);
});

test("TaskSnapshot structure is correct", () => {
  const snapshot: TaskSnapshot = {
    task: {
      id: "task_123",
      parentId: null,
      rootId: "task_123",
      divisionId: "div_abc",
      tenantId: "tenant_abc",
      title: "Test task",
      status: "in_progress",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: null,
      outputJson: null,
      estimatedCostUsd: null,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:01:00.000Z",
      completedAt: null,
    },
    workflow: {
      taskId: "task_123",
      divisionId: "div_abc",
      workflowId: "wf_456",
      status: "running",
      currentStepIndex: 1,
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:01:00.000Z",
    },
    execution: {
      id: "exec_789",
      taskId: "task_123",
      workflowId: null,
      parentExecutionId: null,
      harnessRunId: null,
      agentId: "agent_abc",
      roleId: null,
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId: "trace_abc",
      attempt: 1,
      timeoutMs: 300000,
      budgetUsdLimit: null,
      budgetReservationId: null,
      budgetLedgerId: null,
      requiresApproval: 0,
      sandboxMode: null,
      allowedToolsJson: null,
      allowedPathsJson: null,
      maxRetries: 3,
      retryBackoff: "exponential",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:01:00.000Z",
    },
    session: {
      id: "sess_def",
      taskId: "task_123",
      channel: "cli",
      status: "open",
      externalSessionId: null,
      createdAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:01:00.000Z",
    },
    stepOutputs: [],
    events: [],
  };
  assert.equal(snapshot.task.id, "task_123");
  assert.equal(snapshot.workflow?.workflowId, "wf_456");
  assert.equal(snapshot.execution?.status, "executing");
  assert.equal(snapshot.session?.status, "open");
});

test("TaskSnapshot allows null workflow", () => {
  const snapshot: TaskSnapshot = {
    task: {
      id: "task_simple",
      parentId: null,
      rootId: "task_simple",
      divisionId: null,
      tenantId: "tenant_abc",
      title: "Simple task",
      status: "queued",
      source: "user",
      priority: "low",
      inputJson: "{}",
      normalizedInputJson: null,
      outputJson: null,
      estimatedCostUsd: null,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:00:00.000Z",
      completedAt: null,
    },
    workflow: null,
    execution: null,
    session: null,
    stepOutputs: [],
    events: [],
  };
  assert.equal(snapshot.workflow, null);
  assert.equal(snapshot.execution, null);
  assert.equal(snapshot.session, null);
});
