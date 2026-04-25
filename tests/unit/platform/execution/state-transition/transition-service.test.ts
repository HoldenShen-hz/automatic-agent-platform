import assert from "node:assert/strict";
import test from "node:test";

import {
  TransitionService,
  TaskTransitionService,
  WorkflowTransitionService,
  SessionTransitionService,
  ExecutionTransitionService,
  ApprovalTransitionService,
} from "../../../../src/platform/execution/state-transition/transition-service.js";
import type {
  AuthoritativeSqlDatabase,
} from "../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type {
  AuthoritativeTaskStore,
} from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type {
  RuntimeLifecycleRepository,
} from "../../../../src/platform/state-evidence/truth/repositories/runtime-lifecycle-repository.js";
import type {
  TaskStatusTransitionCommand,
  WorkflowStatusTransitionCommand,
  SessionStatusTransitionCommand,
  ExecutionStatusTransitionCommand,
  ApprovalStatusTransitionCommand,
  TransitionAuditContext,
} from "../../../../src/platform/contracts/types/domain.js";
import type {
  TaskStatus,
  WorkflowStatus,
  SessionStatus,
  ExecutionStatus,
  ApprovalStatus,
} from "../../../../src/platform/contracts/types/status.js";

// ---------------------------------------------------------------------------
// Mock Database
// ---------------------------------------------------------------------------

interface MockDatabase extends AuthoritativeSqlDatabase {
  transactionCalls: Array<() => void>;
  transactionResults: unknown[];
}

function createMockDatabase(): MockDatabase {
  const transactionCalls: Array<() => void> = [];
  const transactionResults: unknown[] = [];

  return {
    transaction(fn) {
      transactionCalls.push(fn);
      const result = fn();
      transactionResults.push(result);
      return result;
    },
    transactionCalls,
    transactionResults,
  };
}

// ---------------------------------------------------------------------------
// Mock Repository
// ---------------------------------------------------------------------------

interface Tier1Event {
  taskId: string;
  executionId: string;
  eventType: string;
  traceId: string;
  payload: Record<string, unknown>;
}

interface MockRepositoryState {
  taskStatuses: Map<string, { status: TaskStatus; updatedAt: string }>;
  workflowStates: Map<string, { status: WorkflowStatus; currentStepIndex: number; updatedAt: string }>;
  sessionStatuses: Map<string, { status: SessionStatus; updatedAt: string }>;
  executionStatuses: Map<string, { status: ExecutionStatus; startedAt: string | null; finishedAt: string | null; lastErrorCode: string | null; updatedAt: string }>;
  approvalDecisions: Map<string, { status: ApprovalStatus; responseJson: string | null; respondedAt: string | null }>;
  tier1Events: Tier1Event[];
  taskOutputs: Map<string, string>;
}

interface MockRepository extends RuntimeLifecycleRepository {
  mockState: MockRepositoryState;
  getWorkflowStateCalls: string[];
  updateTaskStatusCasCalls: Array<{ entityId: string; fromStatus: TaskStatus; toStatus: TaskStatus }>;
  updateWorkflowStateCasCalls: string[];
  updateSessionStatusCasCalls: string[];
  updateExecutionStatusCasCalls: string[];
  updateApprovalDecisionCasCalls: Array<{ approvalId: string; expectedStatus: ApprovalStatus }>;
}

function createMockRepository(initialTaskStatus?: TaskStatus, initialWorkflowStatus?: WorkflowStatus): MockRepository {
  const mockState: MockRepositoryState = {
    taskStatuses: new Map(),
    workflowStates: new Map(),
    sessionStatuses: new Map(),
    executionStatuses: new Map(),
    approvalDecisions: new Map(),
    tier1Events: [],
    taskOutputs: new Map(),
  };

  const getWorkflowStateCalls: string[] = [];
  const updateTaskStatusCasCalls: Array<{ entityId: string; fromStatus: TaskStatus; toStatus: TaskStatus }> = [];
  const updateWorkflowStateCasCalls: string[] = [];
  const updateSessionStatusCasCalls: string[] = [];
  const updateExecutionStatusCasCalls: string[] = [];
  const updateApprovalDecisionCasCalls: Array<{ approvalId: string; expectedStatus: ApprovalStatus }> = [];

  const repo: MockRepository = {
    mockState,

    getWorkflowState(entityId: string) {
      getWorkflowStateCalls.push(entityId);
      return mockState.workflowStates.get(entityId) ?? null;
    },

    updateTaskStatusCas(entityId, fromStatus, toStatus, occurredAt, reasonCode, completedAt) {
      updateTaskStatusCasCalls.push({ entityId, fromStatus, toStatus });
      const current = mockState.taskStatuses.get(entityId);
      if (current && current.status === fromStatus) {
        mockState.taskStatuses.set(entityId, { status: toStatus, updatedAt: occurredAt });
        return 1;
      }
      return 0;
    },

    updateWorkflowStateCas(entityId, expectedStepIndex, expectedStatus, toStatus, currentStepIndex, outputsJson, occurredAt) {
      updateWorkflowStateCasCalls.push(entityId);
      const current = mockState.workflowStates.get(entityId);
      if (current && current.status === expectedStatus && current.currentStepIndex === expectedStepIndex) {
        mockState.workflowStates.set(entityId, { status: toStatus, currentStepIndex, updatedAt: occurredAt });
        return 1;
      }
      return 0;
    },

    updateSessionStatusCas(entityId, fromStatus, toStatus, occurredAt) {
      updateSessionStatusCasCalls.push(entityId);
      const current = mockState.sessionStatuses.get(entityId);
      if (current && current.status === fromStatus) {
        mockState.sessionStatuses.set(entityId, { status: toStatus, updatedAt: occurredAt });
        return 1;
      }
      return 0;
    },

    updateExecutionStatusCas(entityId, fromStatus, toStatus, occurredAt, startedAt, finishedAt, lastErrorCode) {
      updateExecutionStatusCasCalls.push(entityId);
      const current = mockState.executionStatuses.get(entityId);
      if (current && current.status === fromStatus) {
        mockState.executionStatuses.set(entityId, {
          status: toStatus,
          startedAt: startedAt ?? current.startedAt,
          finishedAt: finishedAt ?? current.finishedAt,
          lastErrorCode: lastErrorCode ?? current.lastErrorCode,
          updatedAt: occurredAt,
        });
        return 1;
      }
      return 0;
    },

    updateApprovalDecisionCas({ approvalId, expectedStatus, status, responseJson, respondedAt }) {
      updateApprovalDecisionCasCalls.push({ approvalId, expectedStatus });
      const current = mockState.approvalDecisions.get(approvalId);
      if (current && current.status === expectedStatus) {
        mockState.approvalDecisions.set(approvalId, { status, responseJson, respondedAt });
        return 1;
      }
      return 0;
    },

    createTier1StatusEvent(event) {
      mockState.tier1Events.push(event);
    },

    updateTaskOutput(taskId, outputJson, occurredAt) {
      mockState.taskOutputs.set(taskId, outputJson);
    },

    updateTaskStatus(taskId, status, occurredAt, reasonCode, completedAt) {
      mockState.taskStatuses.set(taskId, { status, updatedAt: occurredAt });
    },

    updateWorkflowState(taskId, status, currentStepIndex, outputsJson, occurredAt) {
      mockState.workflowStates.set(taskId, { status, currentStepIndex, updatedAt: occurredAt });
    },

    updateSessionStatus(sessionId, status, occurredAt) {
      mockState.sessionStatuses.set(sessionId, { status, updatedAt: occurredAt });
    },

    updateExecutionStatus(executionId, status, occurredAt, reasonCode, finishedAt, lastErrorCode) {
      mockState.executionStatuses.set(executionId, { status, startedAt: null, finishedAt, lastErrorCode, updatedAt: occurredAt });
    },

    insertApproval(approval) {
      mockState.approvalDecisions.set(approval.id, {
        status: approval.status,
        responseJson: approval.responseJson,
        respondedAt: approval.respondedAt,
      });
    },

    insertEvent(event) {
      // Mock event insertion
    },

    getTaskStatus(taskId) {
      return mockState.taskStatuses.get(taskId) ?? null;
    },

    getSessionStatus(sessionId) {
      return mockState.sessionStatuses.get(sessionId) ?? null;
    },

    getExecutionStatus(executionId) {
      return mockState.executionStatuses.get(executionId) ?? null;
    },

    // Track calls
    getWorkflowStateCalls,
    updateTaskStatusCasCalls,
    updateWorkflowStateCasCalls,
    updateSessionStatusCasCalls,
    updateExecutionStatusCasCalls,
    updateApprovalDecisionCasCalls,
  };

  // Initialize with provided statuses if given
  const now = new Date().toISOString();
  if (initialTaskStatus) {
    mockState.taskStatuses.set("task-1", { status: initialTaskStatus, updatedAt: now });
  }
  if (initialWorkflowStatus) {
    mockState.workflowStates.set("task-1", { status: initialWorkflowStatus, currentStepIndex: 0, updatedAt: now });
  }

  return repo;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeContext(overrides?: Partial<TransitionAuditContext>): TransitionAuditContext {
  return {
    reasonCode: "test",
    traceId: "trace-1",
    actorType: "system",
    occurredAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TaskTransitionService Tests
// ---------------------------------------------------------------------------

test("TaskTransitionService - successful status transition emits tier1 event", () => {
  const db = createMockDatabase();
  const repository = createMockRepository("queued");

  const service = new TaskTransitionService(db, repository);

  service.transition({
    entityKind: "task",
    entityId: "task-1",
    fromStatus: "queued",
    toStatus: "pending",
    executionId: "exec-1",
    ...makeContext(),
  });

  assert.equal(repository.updateTaskStatusCasCalls.length, 1);
  assert.equal(repository.updateTaskStatusCasCalls[0].entityId, "task-1");
  assert.equal(repository.updateTaskStatusCasCalls[0].fromStatus, "queued");
  assert.equal(repository.updateTaskStatusCasCalls[0].toStatus, "pending");
  assert.equal(repository.mockState.tier1Events.length, 1);
  assert.equal(repository.mockState.tier1Events[0].eventType, "task:status_changed");
});

test("TaskTransitionService - CAS failure throws error on concurrent modification", () => {
  const db = createMockDatabase();
  // Do not initialize task status - simulates concurrent modification
  const repository = createMockRepository();

  const service = new TaskTransitionService(db, repository);

  assert.throws(
    () =>
      service.transition({
        entityKind: "task",
        entityId: "task-1",
        fromStatus: "queued",
        toStatus: "pending",
        executionId: "exec-1",
        ...makeContext(),
      }),
    /task.transition_cas_failed/,
  );
});

test("TaskTransitionService - invalid transition throws WorkflowStateError", () => {
  const db = createMockDatabase();
  const repository = createMockRepository("done");

  const service = new TaskTransitionService(db, repository);

  assert.throws(
    () =>
      service.transition({
        entityKind: "task",
        entityId: "task-1",
        fromStatus: "done",
        toStatus: "in_progress",
        executionId: "exec-1",
        ...makeContext(),
      }),
    /invalid_transition/,
  );
});

test("TaskTransitionService - terminal status transition validation", () => {
  const db = createMockDatabase();
  const repository = createMockRepository("in_progress");

  const service = new TaskTransitionService(db, repository);

  service.transition({
    entityKind: "task",
    entityId: "task-1",
    fromStatus: "in_progress",
    toStatus: "done",
    executionId: "exec-1",
    ...makeContext(),
  });

  assert.equal(repository.mockState.taskStatuses.get("task-1")?.status, "done");
});

test("TaskTransitionService - failed status sets reasonCode", () => {
  const db = createMockDatabase();
  const repository = createMockRepository("in_progress");

  const service = new TaskTransitionService(db, repository);

  service.transition({
    entityKind: "task",
    entityId: "task-1",
    fromStatus: "in_progress",
    toStatus: "failed",
    executionId: "exec-1",
    reasonCode: "ERR_OOM",
    ...makeContext({ reasonCode: "ERR_OOM" }),
  });

  assert.equal(repository.mockState.taskStatuses.get("task-1")?.status, "failed");
});

test("TaskTransitionService - wraps in database transaction for atomicity", () => {
  const db = createMockDatabase();
  const repository = createMockRepository("queued");

  const service = new TaskTransitionService(db, repository);

  service.transition({
    entityKind: "task",
    entityId: "task-1",
    fromStatus: "queued",
    toStatus: "pending",
    executionId: "exec-1",
    ...makeContext(),
  });

  assert.equal(db.transactionCalls.length, 1);
});

test("TaskTransitionService - event payload contains correct transition details", () => {
  const db = createMockDatabase();
  const repository = createMockRepository("queued");

  const service = new TaskTransitionService(db, repository);
  const context = makeContext();

  service.transition({
    entityKind: "task",
    entityId: "task-1",
    fromStatus: "queued",
    toStatus: "pending",
    executionId: "exec-1",
    ...context,
  });

  const event = repository.mockState.tier1Events[0];
  assert.equal(event.taskId, "task-1");
  assert.equal(event.executionId, "exec-1");
  assert.equal(event.eventType, "task:status_changed");
  assert.ok(event.payload);
});

// ---------------------------------------------------------------------------
// WorkflowTransitionService Tests
// ---------------------------------------------------------------------------

test("WorkflowTransitionService - successful status transition", () => {
  const repository = createMockRepository("queued", "running");

  const service = new WorkflowTransitionService(repository);

  service.transition({
    entityKind: "workflow",
    entityId: "task-1",
    fromStatus: "running",
    toStatus: "paused",
    currentStepIndex: 0,
    outputsJson: "{}",
    ...makeContext(),
  });

  assert.equal(repository.updateWorkflowStateCasCalls.length, 1);
  assert.equal(repository.updateWorkflowStateCasCalls[0], "task-1");
  assert.equal(repository.mockState.workflowStates.get("task-1")?.status, "paused");
});

test("WorkflowTransitionService - CAS failure when status mismatch", () => {
  const repository = createMockRepository("queued", "completed"); // workflow already in terminal state

  const service = new WorkflowTransitionService(repository);

  assert.throws(
    () =>
      service.transition({
        entityKind: "workflow",
        entityId: "task-1",
        fromStatus: "running",
        toStatus: "paused",
        currentStepIndex: 0,
        outputsJson: "{}",
        ...makeContext(),
      }),
    /workflow.transition_fromStatus_mismatch/,
  );
});

test("WorkflowTransitionService - workflow not found throws error", () => {
  const repository = createMockRepository("queued"); // No workflow state initialized

  const service = new WorkflowTransitionService(repository);

  assert.throws(
    () =>
      service.transition({
        entityKind: "workflow",
        entityId: "task-1",
        fromStatus: "running",
        toStatus: "paused",
        currentStepIndex: 0,
        outputsJson: "{}",
        ...makeContext(),
      }),
    /workflow.not_found/,
  );
});

test("WorkflowTransitionService - invalid transition throws error", () => {
  const repository = createMockRepository("queued", "completed");

  const service = new WorkflowTransitionService(repository);

  assert.throws(
    () =>
      service.transition({
        entityKind: "workflow",
        entityId: "task-1",
        fromStatus: "completed",
        toStatus: "running",
        currentStepIndex: 1,
        outputsJson: "{}",
        ...makeContext(),
      }),
    /invalid_transition/,
  );
});

test("WorkflowTransitionService - updates step index on transition", () => {
  const repository = createMockRepository("queued", "running");
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });

  const service = new WorkflowTransitionService(repository);

  service.transition({
    entityKind: "workflow",
    entityId: "task-1",
    fromStatus: "running",
    toStatus: "paused",
    currentStepIndex: 1,
    outputsJson: '{"step1": "result"}',
    ...makeContext(),
  });

  assert.equal(repository.mockState.workflowStates.get("task-1")?.currentStepIndex, 1);
});

// ---------------------------------------------------------------------------
// SessionTransitionService Tests
// ---------------------------------------------------------------------------

test("SessionTransitionService - successful status transition", () => {
  const repository = createMockRepository();
  repository.mockState.sessionStatuses.set("session-1", { status: "open", updatedAt: new Date().toISOString() });

  const service = new SessionTransitionService(repository);

  service.transition({
    entityKind: "session",
    entityId: "session-1",
    fromStatus: "open",
    toStatus: "streaming",
    ...makeContext(),
  });

  assert.equal(repository.updateSessionStatusCasCalls.length, 1);
  assert.equal(repository.updateSessionStatusCasCalls[0], "session-1");
  assert.equal(repository.mockState.sessionStatuses.get("session-1")?.status, "streaming");
});

test("SessionTransitionService - CAS failure throws error on concurrent modification", () => {
  const repository = createMockRepository();
  // Session already in streaming state but we try to transition from open
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });

  const service = new SessionTransitionService(repository);

  assert.throws(
    () =>
      service.transition({
        entityKind: "session",
        entityId: "session-1",
        fromStatus: "open",
        toStatus: "streaming",
        ...makeContext(),
      }),
    /session.transition_cas_failed/,
  );
});

test("SessionTransitionService - invalid transition throws error", () => {
  const repository = createMockRepository();
  repository.mockState.sessionStatuses.set("session-1", { status: "completed", updatedAt: new Date().toISOString() });

  const service = new SessionTransitionService(repository);

  assert.throws(
    () =>
      service.transition({
        entityKind: "session",
        entityId: "session-1",
        fromStatus: "completed",
        toStatus: "streaming",
        ...makeContext(),
      }),
    /invalid_transition/,
  );
});

test("SessionTransitionService - validates allowed transitions", () => {
  const repository = createMockRepository();
  repository.mockState.sessionStatuses.set("session-1", { status: "open", updatedAt: new Date().toISOString() });

  const service = new SessionTransitionService(repository);

  // Valid: open -> streaming
  service.transition({
    entityKind: "session",
    entityId: "session-1",
    fromStatus: "open",
    toStatus: "streaming",
    ...makeContext(),
  });
  assert.equal(repository.mockState.sessionStatuses.get("session-1")?.status, "streaming");
});

test("SessionTransitionService - rejects invalid transition from terminal state", () => {
  const repository = createMockRepository();
  repository.mockState.sessionStatuses.set("session-1", { status: "completed", updatedAt: new Date().toISOString() });

  const service = new SessionTransitionService(repository);

  assert.throws(
    () =>
      service.transition({
        entityKind: "session",
        entityId: "session-1",
        fromStatus: "completed",
        toStatus: "streaming",
        ...makeContext(),
      }),
    /invalid_transition/,
  );
});

// ---------------------------------------------------------------------------
// ExecutionTransitionService Tests
// ---------------------------------------------------------------------------

test("ExecutionTransitionService - transition to executing sets startedAt timestamp", () => {
  const repository = createMockRepository();
  repository.mockState.executionStatuses.set("exec-1", { status: "created", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new ExecutionTransitionService(repository);

  const context = makeContext();
  service.transition({
    entityKind: "execution",
    entityId: "exec-1",
    fromStatus: "created",
    toStatus: "executing",
    occurredAt: context.occurredAt,
    traceId: context.traceId,
    reasonCode: null,
    reasonDetail: null,
    actorType: context.actorType,
    actorId: context.actorId,
    idempotencyKey: null,
    metadataJson: null,
  });

  assert.equal(repository.mockState.executionStatuses.get("exec-1")?.status, "executing");
  assert.ok(repository.mockState.executionStatuses.get("exec-1")?.startedAt);
});

test("ExecutionTransitionService - transition to succeeded sets finishedAt timestamp", () => {
  const repository = createMockRepository();
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: "2024-01-01T00:00:00Z", finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new ExecutionTransitionService(repository);

  const context = makeContext();
  service.transition({
    entityKind: "execution",
    entityId: "exec-1",
    fromStatus: "executing",
    toStatus: "succeeded",
    occurredAt: context.occurredAt,
    traceId: context.traceId,
    reasonCode: null,
    reasonDetail: null,
    actorType: context.actorType,
    actorId: context.actorId,
    idempotencyKey: null,
    metadataJson: null,
  });

  assert.equal(repository.mockState.executionStatuses.get("exec-1")?.status, "succeeded");
  assert.ok(repository.mockState.executionStatuses.get("exec-1")?.finishedAt);
});

test("ExecutionTransitionService - transition to failed sets lastErrorCode", () => {
  const repository = createMockRepository();
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: "2024-01-01T00:00:00Z", finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new ExecutionTransitionService(repository);

  const context = makeContext({ reasonCode: "ERR_TIMEOUT" });
  service.transition({
    entityKind: "execution",
    entityId: "exec-1",
    fromStatus: "executing",
    toStatus: "failed",
    occurredAt: context.occurredAt,
    traceId: context.traceId,
    reasonCode: "ERR_TIMEOUT",
    reasonDetail: null,
    actorType: context.actorType,
    actorId: context.actorId,
    idempotencyKey: null,
    metadataJson: null,
  });

  assert.equal(repository.mockState.executionStatuses.get("exec-1")?.status, "failed");
  assert.equal(repository.mockState.executionStatuses.get("exec-1")?.lastErrorCode, "ERR_TIMEOUT");
});

test("ExecutionTransitionService - CAS failure throws error on concurrent modification", () => {
  const repository = createMockRepository();
  // Execution already transitioned to succeeded
  repository.mockState.executionStatuses.set("exec-1", { status: "succeeded", startedAt: "2024-01-01T00:00:00Z", finishedAt: "2024-01-01T00:01:00Z", lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new ExecutionTransitionService(repository);

  const context = makeContext();
  assert.throws(
    () =>
      service.transition({
        entityKind: "execution",
        entityId: "exec-1",
        fromStatus: "executing",
        toStatus: "succeeded",
        occurredAt: context.occurredAt,
        traceId: context.traceId,
        reasonCode: null,
        reasonDetail: null,
        actorType: context.actorType,
        actorId: context.actorId,
        idempotencyKey: null,
        metadataJson: null,
      }),
    /execution.transition_cas_failed/,
  );
});

test("ExecutionTransitionService - validates allowed execution transitions", () => {
  const repository = createMockRepository();
  repository.mockState.executionStatuses.set("exec-1", { status: "created", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new ExecutionTransitionService(repository);

  const context = makeContext();

  // Valid: created -> prechecking
  service.transition({
    entityKind: "execution",
    entityId: "exec-1",
    fromStatus: "created",
    toStatus: "prechecking",
    occurredAt: context.occurredAt,
    traceId: context.traceId,
    reasonCode: null,
    reasonDetail: null,
    actorType: context.actorType,
    actorId: context.actorId,
    idempotencyKey: null,
    metadataJson: null,
  });

  assert.equal(repository.mockState.executionStatuses.get("exec-1")?.status, "prechecking");
});

// ---------------------------------------------------------------------------
// ApprovalTransitionService Tests
// ---------------------------------------------------------------------------

test("ApprovalTransitionService - successful transition to approved", () => {
  const repository = createMockRepository();
  repository.mockState.approvalDecisions.set("approval-1", { status: "requested", responseJson: null, respondedAt: null });

  const service = new ApprovalTransitionService(repository);

  const context = makeContext();
  service.transition({
    entityKind: "approval",
    entityId: "approval-1",
    fromStatus: "requested",
    toStatus: "approved",
    responseJson: '{"decision": "approved"}',
    occurredAt: context.occurredAt,
    traceId: context.traceId,
    reasonCode: null,
    reasonDetail: null,
    actorType: context.actorType,
    actorId: context.actorId,
    idempotencyKey: null,
    metadataJson: null,
  });

  assert.equal(repository.updateApprovalDecisionCasCalls.length, 1);
  assert.equal(repository.updateApprovalDecisionCasCalls[0].approvalId, "approval-1");
  assert.equal(repository.updateApprovalDecisionCasCalls[0].expectedStatus, "requested");
});

test("ApprovalTransitionService - CAS failure throws error on concurrent modification", () => {
  const repository = createMockRepository();
  // Approval already approved
  repository.mockState.approvalDecisions.set("approval-1", { status: "approved", responseJson: '{"decision": "approved"}', respondedAt: "2024-01-01T00:00:00Z" });

  const service = new ApprovalTransitionService(repository);

  const context = makeContext();
  assert.throws(
    () =>
      service.transition({
        entityKind: "approval",
        entityId: "approval-1",
        fromStatus: "requested",
        toStatus: "approved",
        responseJson: '{"decision": "approved"}',
        occurredAt: context.occurredAt,
        traceId: context.traceId,
        reasonCode: null,
        reasonDetail: null,
        actorType: context.actorType,
        actorId: context.actorId,
        idempotencyKey: null,
        metadataJson: null,
      }),
    /approval.transition_cas_failed/,
  );
});

test("ApprovalTransitionService - invalid transition throws error", () => {
  const repository = createMockRepository();
  repository.mockState.approvalDecisions.set("approval-1", { status: "approved", responseJson: '{"decision": "approved"}', respondedAt: "2024-01-01T00:00:00Z" });

  const service = new ApprovalTransitionService(repository);

  const context = makeContext();
  assert.throws(
    () =>
      service.transition({
        entityKind: "approval",
        entityId: "approval-1",
        fromStatus: "approved",
        toStatus: "rejected",
        responseJson: '{"decision": "rejected"}',
        occurredAt: context.occurredAt,
        traceId: context.traceId,
        reasonCode: null,
        reasonDetail: null,
        actorType: context.actorType,
        actorId: context.actorId,
        idempotencyKey: null,
        metadataJson: null,
      }),
    /invalid_transition/,
  );
});

test("ApprovalTransitionService - validates all approval status transitions", () => {
  const repository = createMockRepository();
  repository.mockState.approvalDecisions.set("approval-1", { status: "requested", responseJson: null, respondedAt: null });

  const service = new ApprovalTransitionService(repository);
  const context = makeContext();

  // Valid transitions from requested
  const validTransitions: ApprovalStatus[] = ["approved", "rejected", "expired", "cancelled"];

  for (const toStatus of validTransitions) {
    repository.mockState.approvalDecisions.set("approval-1", { status: "requested", responseJson: null, respondedAt: null });
    repository.updateApprovalDecisionCasCalls.length = 0;

    service.transition({
      entityKind: "approval",
      entityId: "approval-1",
      fromStatus: "requested",
      toStatus,
      responseJson: `{"decision": "${toStatus}"}`,
      occurredAt: context.occurredAt,
      traceId: context.traceId,
      reasonCode: null,
      reasonDetail: null,
      actorType: context.actorType,
      actorId: context.actorId,
      idempotencyKey: null,
      metadataJson: null,
    });

    assert.equal(repository.updateApprovalDecisionCasCalls.length, 1);
  }
});

// ---------------------------------------------------------------------------
// TransitionService Integration Tests
// ---------------------------------------------------------------------------

test("TransitionService - transitions task status via facade", () => {
  const db = createMockDatabase();
  const mockStore = {} as AuthoritativeTaskStore;
  const repository = createMockRepository("queued");
  repository.mockState.taskStatuses.set("task-1", { status: "queued", updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  service.transitionTaskStatus({
    entityKind: "task",
    entityId: "task-1",
    fromStatus: "queued",
    toStatus: "pending",
    executionId: "exec-1",
    ...makeContext(),
  });

  assert.equal(repository.mockState.taskStatuses.get("task-1")?.status, "pending");
});

test("TransitionService - transitions workflow status via facade", () => {
  const db = createMockDatabase();
  const mockStore = {} as AuthoritativeTaskStore;
  const repository = createMockRepository("queued", "running");

  const service = new TransitionService(db, mockStore, repository);

  service.transitionWorkflowStatus({
    entityKind: "workflow",
    entityId: "task-1",
    fromStatus: "running",
    toStatus: "paused",
    currentStepIndex: 0,
    outputsJson: "{}",
    ...makeContext(),
  });

  assert.equal(repository.mockState.workflowStates.get("task-1")?.status, "paused");
});

test("TransitionService - transitions session status via facade", () => {
  const db = createMockDatabase();
  const mockStore = {} as AuthoritativeTaskStore;
  const repository = createMockRepository();
  repository.mockState.sessionStatuses.set("session-1", { status: "open", updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  service.transitionSessionStatus({
    entityKind: "session",
    entityId: "session-1",
    fromStatus: "open",
    toStatus: "streaming",
    ...makeContext(),
  });

  assert.equal(repository.mockState.sessionStatuses.get("session-1")?.status, "streaming");
});

test("TransitionService - transitions execution status via facade", () => {
  const db = createMockDatabase();
  const mockStore = {} as AuthoritativeTaskStore;
  const repository = createMockRepository();
  repository.mockState.executionStatuses.set("exec-1", { status: "created", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  const context = makeContext();
  service.transitionExecutionStatus({
    entityKind: "execution",
    entityId: "exec-1",
    fromStatus: "created",
    toStatus: "prechecking",
    occurredAt: context.occurredAt,
    traceId: context.traceId,
    reasonCode: null,
    reasonDetail: null,
    actorType: context.actorType,
    actorId: context.actorId,
    idempotencyKey: null,
    metadataJson: null,
  });

  assert.equal(repository.mockState.executionStatuses.get("exec-1")?.status, "prechecking");
});

test("TransitionService - transitions approval status via facade", () => {
  const db = createMockDatabase();
  const mockStore = {} as AuthoritativeTaskStore;
  const repository = createMockRepository();
  repository.mockState.approvalDecisions.set("approval-1", { status: "requested", responseJson: null, respondedAt: null });

  const service = new TransitionService(db, mockStore, repository);

  const context = makeContext();
  service.transitionApprovalStatus({
    entityKind: "approval",
    entityId: "approval-1",
    fromStatus: "requested",
    toStatus: "approved",
    responseJson: '{"decision": "approved"}',
    occurredAt: context.occurredAt,
    traceId: context.traceId,
    reasonCode: null,
    reasonDetail: null,
    actorType: context.actorType,
    actorId: context.actorId,
    idempotencyKey: null,
    metadataJson: null,
  });

  assert.equal(repository.mockState.approvalDecisions.get("approval-1")?.status, "approved");
});

test("TransitionService - emits tier1 event on task transition", () => {
  const db = createMockDatabase();
  const mockStore = {} as AuthoritativeTaskStore;
  const repository = createMockRepository("queued");
  repository.mockState.taskStatuses.set("task-1", { status: "queued", updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  service.transitionTaskStatus({
    entityKind: "task",
    entityId: "task-1",
    fromStatus: "queued",
    toStatus: "pending",
    executionId: "exec-1",
    ...makeContext(),
  });

  assert.equal(repository.mockState.tier1Events.length, 1);
  assert.equal(repository.mockState.tier1Events[0].taskId, "task-1");
  assert.equal(repository.mockState.tier1Events[0].eventType, "task:status_changed");
});

test("TransitionService - task event contains transition payload with from/to status", () => {
  const db = createMockDatabase();
  const mockStore = {} as AuthoritativeTaskStore;
  const repository = createMockRepository("queued");
  repository.mockState.taskStatuses.set("task-1", { status: "queued", updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);
  const context = makeContext({ reasonCode: "USER_REQUEST" });

  service.transitionTaskStatus({
    entityKind: "task",
    entityId: "task-1",
    fromStatus: "queued",
    toStatus: "pending",
    executionId: "exec-1",
    ...context,
  });

  const event = repository.mockState.tier1Events[0];
  assert.equal(event.payload.fromStatus, "queued");
  assert.equal(event.payload.toStatus, "pending");
  assert.equal(event.payload.reasonCode, "USER_REQUEST");
});

test("TransitionService - guards against invalid task status transitions", () => {
  const db = createMockDatabase();
  const mockStore = {} as AuthoritativeTaskStore;
  const repository = createMockRepository("done");
  repository.mockState.taskStatuses.set("task-1", { status: "done", updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  assert.throws(
    () =>
      service.transitionTaskStatus({
        entityKind: "task",
        entityId: "task-1",
        fromStatus: "done",
        toStatus: "in_progress",
        executionId: "exec-1",
        ...makeContext(),
      }),
    /invalid_transition/,
  );
});

test("TransitionService - guards against invalid workflow status transitions", () => {
  const db = createMockDatabase();
  const mockStore = {} as AuthoritativeTaskStore;
  const repository = createMockRepository("queued", "completed");
  repository.mockState.workflowStates.set("task-1", { status: "completed", currentStepIndex: 1, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  assert.throws(
    () =>
      service.transitionWorkflowStatus({
        entityKind: "workflow",
        entityId: "task-1",
        fromStatus: "completed",
        toStatus: "running",
        currentStepIndex: 1,
        outputsJson: "{}",
        ...makeContext(),
      }),
    /invalid_transition/,
  );
});
