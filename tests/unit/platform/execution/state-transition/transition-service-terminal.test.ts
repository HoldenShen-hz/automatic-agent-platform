import assert from "node:assert/strict";
import test from "node:test";

import { TransitionService } from "../../../../../src/platform/five-plane-execution/state-transition/transition-service.js";
import type {
  AuthoritativeSqlDatabase,
} from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type {
  AuthoritativeTaskStore,
} from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type {
  RuntimeLifecycleRepository,
} from "../../../../../src/platform/five-plane-state-evidence/truth/repositories/runtime-lifecycle-repository.js";
import type {
  TransitionAuditContext,
  WorkflowStateRecord,
  EventRecord,
} from "../../../../../src/platform/contracts/types/domain.js";
import type {
  TaskStatus,
  WorkflowStatus,
  SessionStatus,
  ExecutionStatus,
} from "../../../../../src/platform/contracts/types/status.js";

// ---------------------------------------------------------------------------
// Mock Database
// ---------------------------------------------------------------------------

function createMockDatabase(): AuthoritativeSqlDatabase {
  const transactionCalls: Array<() => void> = [];

  return {
    filePath: ":memory:",
    backendType: "sqlite",
    connection: {} as AuthoritativeSqlDatabase["connection"],
    migrate() {},
    getSchemaStatus() {
      return { currentVersion: 1, expectedVersion: 1, upToDate: true, pendingVersions: [], checksumMismatches: [] };
    },
    assertSchemaCurrent() {},
    integrityCheck() {
      return [];
    },
    healthCheck() {
      return Promise.resolve(true);
    },
    transaction<T>(fn: () => T): T {
      transactionCalls.push(fn);
      return fn();
    },
    readTransaction<T>(fn: () => T): T {
      return fn();
    },
  } as AuthoritativeSqlDatabase;
}

// ---------------------------------------------------------------------------
// Mock Repository
// ---------------------------------------------------------------------------

interface Tier1Event {
  taskId: string;
  executionId: string | null;
  eventType: string;
  traceId: string;
  payload: Record<string, unknown>;
}

interface MockRepositoryState {
  taskStatuses: Map<string, { status: TaskStatus; updatedAt: string }>;
  workflowStates: Map<string, { status: WorkflowStatus; currentStepIndex: number; updatedAt: string }>;
  sessionStatuses: Map<string, { status: SessionStatus; updatedAt: string }>;
  executionStatuses: Map<string, { status: ExecutionStatus; startedAt: string | null; finishedAt: string | null; lastErrorCode: string | null; updatedAt: string }>;
  tier1Events: Tier1Event[];
  taskOutputs: Map<string, string>;
}

type MockRepository = RuntimeLifecycleRepository & {
  mockState: MockRepositoryState;
  getWorkflowStateInvocations: string[];
  updateTaskStatusCasCalls: Array<{ entityId: string; fromStatus: string; toStatus: string }>;
  updateWorkflowStateCasCalls: string[];
  updateSessionStatusCasCalls: string[];
  updateExecutionStatusCasCalls: string[];
};

function createMockRepository(): MockRepository {
  const mockState: MockRepositoryState = {
    taskStatuses: new Map(),
    workflowStates: new Map(),
    sessionStatuses: new Map(),
    executionStatuses: new Map(),
    tier1Events: [],
    taskOutputs: new Map(),
  };

  const getWorkflowStateInvocations: string[] = [];
  const updateTaskStatusCasCalls: Array<{ entityId: string; fromStatus: string; toStatus: string }> = [];
  const updateWorkflowStateCasCalls: string[] = [];
  const updateSessionStatusCasCalls: string[] = [];
  const updateExecutionStatusCasCalls: string[] = [];

  const repo: MockRepository = {
    mockState,

    getWorkflowState(entityId: string): WorkflowStateRecord | null {
      getWorkflowStateInvocations.push(entityId);
      const state = mockState.workflowStates.get(entityId);
      if (!state) return null;
      return {
        taskId: entityId,
        divisionId: "division-1",
        workflowId: "workflow-1",
        currentStepIndex: state.currentStepIndex,
        status: state.status,
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: state.updatedAt,
        updatedAt: state.updatedAt,
      };
    },

    getTask(taskId: string): import("../../../../../src/platform/contracts/types/domain.js").TaskRecord | null {
      const state = mockState.taskStatuses.get(taskId);
      if (!state) return null;
      return {
        id: taskId,
        divisionId: "division-1",
        status: state.status,
        createdAt: state.updatedAt,
        updatedAt: state.updatedAt,
      };
    },

    getSession(sessionId: string): import("../../../../../src/platform/contracts/types/domain.js").SessionRecord | null {
      const state = mockState.sessionStatuses.get(sessionId);
      if (!state) return null;
      return {
        id: sessionId,
        taskId: "task-1",
        status: state.status,
        createdAt: state.updatedAt,
        updatedAt: state.updatedAt,
      };
    },

    getExecution(executionId: string): import("../../../../../src/platform/contracts/types/domain.js").ExecutionRecord | null {
      const state = mockState.executionStatuses.get(executionId);
      if (!state) return null;
      return {
        id: executionId,
        taskId: "task-1",
        status: state.status,
        startedAt: state.startedAt ?? null,
        finishedAt: state.finishedAt ?? null,
        lastErrorCode: state.lastErrorCode ?? null,
        createdAt: state.updatedAt,
        updatedAt: state.updatedAt,
      };
    },

    updateTaskStatusCas(
      entityId: string,
      fromStatus: string,
      toStatus: string,
      occurredAt: string,
      _reasonCode?: string | null,
      _completedAt?: string | null,
    ): number {
      updateTaskStatusCasCalls.push({ entityId, fromStatus, toStatus });
      const current = mockState.taskStatuses.get(entityId);
      if (current && current.status === fromStatus) {
        mockState.taskStatuses.set(entityId, { status: toStatus as TaskStatus, updatedAt: occurredAt });
        return 1;
      }
      return 0;
    },

    updateWorkflowStateCas(
      entityId: string,
      expectedVersion: number,
      expectedStatus: string,
      toStatus: string,
      currentStepIndex: number,
      outputsJson: string,
      occurredAt: string,
      _resumableFromStep?: string | null,
    ): number {
      updateWorkflowStateCasCalls.push(entityId);
      const current = mockState.workflowStates.get(entityId);
      if (current && current.status === expectedStatus && current.currentStepIndex === expectedVersion) {
        mockState.workflowStates.set(entityId, { status: toStatus as WorkflowStatus, currentStepIndex, updatedAt: occurredAt });
        return 1;
      }
      return 0;
    },

    updateSessionStatusCas(
      entityId: string,
      fromStatus: string,
      toStatus: string,
      occurredAt: string,
    ): number {
      updateSessionStatusCasCalls.push(entityId);
      const current = mockState.sessionStatuses.get(entityId);
      if (current && current.status === fromStatus) {
        mockState.sessionStatuses.set(entityId, { status: toStatus as SessionStatus, updatedAt: occurredAt });
        return 1;
      }
      return 0;
    },

    updateExecutionStatusCas(
      entityId: string,
      fromStatus: string,
      toStatus: string,
      occurredAt: string,
      startedAt?: string | null,
      finishedAt?: string | null,
      lastErrorCode?: string | null,
    ): number {
      updateExecutionStatusCasCalls.push(entityId);
      const current = mockState.executionStatuses.get(entityId);
      if (current && current.status === fromStatus) {
        mockState.executionStatuses.set(entityId, {
          status: toStatus as ExecutionStatus,
          startedAt: startedAt ?? current.startedAt,
          finishedAt: finishedAt ?? current.finishedAt,
          lastErrorCode: lastErrorCode ?? current.lastErrorCode,
          updatedAt: occurredAt,
        });
        return 1;
      }
      return 0;
    },

    createTier1StatusEvent(input: {
      taskId: string;
      executionId: string | null;
      eventType: string;
      traceId: string;
      payload: Record<string, unknown>;
    }): EventRecord {
      const event: Tier1Event = {
        taskId: input.taskId,
        executionId: input.executionId,
        eventType: input.eventType,
        traceId: input.traceId,
        payload: input.payload,
      };
      mockState.tier1Events.push(event);
      return {
        id: `event-${mockState.tier1Events.length}`,
        taskId: input.taskId,
        sessionId: null,
        executionId: input.executionId,
        eventType: input.eventType,
        eventTier: "tier_1",
        payloadJson: JSON.stringify(input.payload),
        traceId: input.traceId,
        createdAt: new Date().toISOString(),
      };
    },

    appendPlatformFactEvent(_event: unknown): EventRecord {
      return {
        id: `event-${Date.now()}`,
        taskId: "task-1",
        sessionId: null,
        executionId: null,
        eventType: "platform.fact",
        eventTier: "tier_1",
        payloadJson: "{}",
        traceId: "trace-1",
        createdAt: new Date().toISOString(),
      };
    },

    updateTaskOutput(taskId: string, outputJson: string, _occurredAt: string): void {
      mockState.taskOutputs.set(taskId, outputJson);
    },

    updateTaskOutputCas(
      taskId: string,
      _expectedTaskUpdatedAt: string,
      _expectedStatus: string,
      outputJson: string,
      occurredAt: string,
    ): number {
      mockState.taskOutputs.set(taskId, outputJson);
      return 1;
    },

    updateTaskStatus(
      taskId: string,
      status: string,
      occurredAt: string,
      _errorCode?: string | null,
      _completedAt?: string | null,
    ): void {
      mockState.taskStatuses.set(taskId, { status: status as TaskStatus, updatedAt: occurredAt });
    },

    updateWorkflowState(
      taskId: string,
      status: string,
      currentStepIndex: number,
      outputsJson: string,
      occurredAt: string,
      _resumableFromStep?: string | null,
    ): void {
      mockState.workflowStates.set(taskId, { status: status as WorkflowStatus, currentStepIndex, updatedAt: occurredAt });
    },

    updateSessionStatus(sessionId: string, status: string, occurredAt: string): void {
      mockState.sessionStatuses.set(sessionId, { status: status as SessionStatus, updatedAt: occurredAt });
    },

    updateExecutionStatus(
      executionId: string,
      status: string,
      occurredAt: string,
      _startedAt?: string | null,
      finishedAt?: string | null,
      lastErrorCode?: string | null,
    ): void {
      mockState.executionStatuses.set(executionId, { status: status as ExecutionStatus, startedAt: null, finishedAt: finishedAt ?? null, lastErrorCode: lastErrorCode ?? null, updatedAt: occurredAt });
    },

    insertApproval(_approval: unknown): void {
      // no-op for terminal transition tests
    },

    getApproval(_approvalId: string): unknown {
      return null;
    },

    listApprovalsByTask(_taskId: string): unknown[] {
      return [];
    },

    updateApprovalDecision(_input: unknown): void {
      // no-op
    },

    updateApprovalDecisionCas(input: { approvalId: string; expectedStatus: string; status: string; responseJson: string; respondedAt: string }): number {
      return 1;
    },

    updateApprovalRequest(_input: { id: string; requestJson: string }): void {
      // no-op
    },

    insertEvent(event: {
      taskId?: string | null;
      sessionId?: string | null;
      executionId?: string | null;
      eventType?: string;
      eventTier?: "tier_1" | "tier_2";
      payloadJson?: string;
      traceId?: string | null;
      createdAt?: string;
    }): EventRecord {
      return {
        id: `event-${Date.now()}`,
        taskId: event.taskId ?? null,
        sessionId: event.sessionId ?? null,
        executionId: null,
        eventType: event.eventType ?? "unknown",
        eventTier: event.eventTier ?? "tier_1",
        payloadJson: "{}",
        traceId: event.traceId ?? null,
        createdAt: new Date().toISOString(),
      };
    },

    // Track calls
    getWorkflowStateInvocations,
    updateTaskStatusCasCalls,
    updateWorkflowStateCasCalls,
    updateSessionStatusCasCalls,
    updateExecutionStatusCasCalls,
  } as unknown as MockRepository;

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

function makeTerminalInput(overrides?: Partial<{
  taskId: string;
  sessionId: string;
  executionId: string;
  currentTaskStatus: TaskStatus;
  currentWorkflowStatus: WorkflowStatus;
  currentSessionStatus: SessionStatus;
  currentExecutionStatus: ExecutionStatus;
  terminalStatus: TaskTerminalStatus;
  taskOutputJson: string;
  outputsJson: string;
  context: TransitionAuditContext;
}>): {
  taskId: string;
  sessionId: string;
  executionId: string;
  currentTaskStatus: TaskStatus;
  currentWorkflowStatus: WorkflowStatus;
  currentSessionStatus: SessionStatus;
  currentExecutionStatus: ExecutionStatus;
  terminalStatus: "done" | "failed" | "cancelled";
  taskOutputJson: string;
  outputsJson: string;
  context: TransitionAuditContext;
} {
  return {
    taskId: "task-1",
    sessionId: "session-1",
    executionId: "exec-1",
    currentTaskStatus: "in_progress",
    currentWorkflowStatus: "running",
    currentSessionStatus: "streaming",
    currentExecutionStatus: "executing",
    terminalStatus: "done",
    taskOutputJson: "{}",
    outputsJson: "{}",
    context: makeContext(),
    ...overrides,
  };
}

type TaskTerminalStatus = "done" | "failed" | "cancelled";

// ---------------------------------------------------------------------------
// TaskTerminalTransitionService Tests (via TransitionService.applyTaskTerminalState)
// ---------------------------------------------------------------------------

test("TaskTerminalTransitionService.apply() uses CAS updates for task status", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  // Initialize all entity statuses
  repository.mockState.taskStatuses.set("task-1", { status: "in_progress", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  service.applyTaskTerminalState(makeTerminalInput({
    currentTaskStatus: "in_progress",
    terminalStatus: "done",
  }));

  // Verify CAS was called with correct current status
  const taskCasCall = repository.updateTaskStatusCasCalls.find(c => c.entityId === "task-1");
  assert.ok(taskCasCall, "updateTaskStatusCas should be called for task");
  assert.equal(taskCasCall!.fromStatus, "in_progress", "CAS should verify current status is in_progress");
  assert.equal(taskCasCall!.toStatus, "done", "CAS should update to done status");
});

test("TaskTerminalTransitionService.apply() uses CAS updates for workflow status", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  repository.mockState.taskStatuses.set("task-1", { status: "in_progress", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  service.applyTaskTerminalState(makeTerminalInput({
    currentWorkflowStatus: "running",
    terminalStatus: "done",
  }));

  // Verify workflow CAS was called
  assert.ok(repository.updateWorkflowStateCasCalls.includes("task-1"), "updateWorkflowStateCas should be called");
});

test("TaskTerminalTransitionService.apply() uses CAS updates for session status", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  repository.mockState.taskStatuses.set("task-1", { status: "in_progress", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  service.applyTaskTerminalState(makeTerminalInput({
    currentSessionStatus: "streaming",
    terminalStatus: "done",
  }));

  // Verify session CAS was called
  assert.ok(repository.updateSessionStatusCasCalls.includes("session-1"), "updateSessionStatusCas should be called");
});

test("TaskTerminalTransitionService.apply() uses CAS updates for execution status", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  repository.mockState.taskStatuses.set("task-1", { status: "in_progress", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  service.applyTaskTerminalState(makeTerminalInput({
    currentExecutionStatus: "executing",
    terminalStatus: "done",
  }));

  // Verify execution CAS was called
  assert.ok(repository.updateExecutionStatusCasCalls.includes("exec-1"), "updateExecutionStatusCas should be called");
});

test("TaskTerminalTransitionService.apply() throws when workflow status doesn't match expected", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  // Set workflow to "completed" (terminal) but we try to transition from "running"
  repository.mockState.taskStatuses.set("task-1", { status: "in_progress", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "completed", currentStepIndex: 0, updatedAt: new Date().toISOString() }); // mismatch!
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  assert.throws(
    () =>
      service.applyTaskTerminalState(makeTerminalInput({
        currentWorkflowStatus: "running", // We expect "running" but actual is "completed"
        terminalStatus: "done",
      })),
    /workflow.transition_cas_failed/,
    "Should throw when workflow CAS fails due to status mismatch",
  );
});

test("TaskTerminalTransitionService.apply() throws when task status CAS fails", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  // Set task to "done" but we try to transition from "in_progress"
  repository.mockState.taskStatuses.set("task-1", { status: "done", updatedAt: new Date().toISOString() }); // mismatch!
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  assert.throws(
    () =>
      service.applyTaskTerminalState(makeTerminalInput({
        currentTaskStatus: "in_progress", // We expect "in_progress" but actual is "done"
        terminalStatus: "done",
      })),
    /task.transition_cas_failed/,
    "Should throw when task CAS fails due to status mismatch",
  );
});

test("TaskTerminalTransitionService.apply() throws when session status CAS fails", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  repository.mockState.taskStatuses.set("task-1", { status: "in_progress", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "completed", updatedAt: new Date().toISOString() }); // mismatch!
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  assert.throws(
    () =>
      service.applyTaskTerminalState(makeTerminalInput({
        currentSessionStatus: "streaming", // We expect "streaming" but actual is "completed"
        terminalStatus: "done",
      })),
    /session.transition_cas_failed/,
    "Should throw when session CAS fails due to status mismatch",
  );
});

test("TaskTerminalTransitionService.apply() throws when execution status CAS fails", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  repository.mockState.taskStatuses.set("task-1", { status: "in_progress", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "succeeded", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() }); // mismatch!

  const service = new TransitionService(db, mockStore, repository);

  assert.throws(
    () =>
      service.applyTaskTerminalState(makeTerminalInput({
        currentExecutionStatus: "executing", // We expect "executing" but actual is "succeeded"
        terminalStatus: "done",
      })),
    /execution.transition_cas_failed/,
    "Should throw when execution CAS fails due to status mismatch",
  );
});

test("TaskTerminalTransitionService.apply() correctly transitions task to done status", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  repository.mockState.taskStatuses.set("task-1", { status: "in_progress", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  service.applyTaskTerminalState(makeTerminalInput({
    currentTaskStatus: "in_progress",
    terminalStatus: "done",
  }));

  assert.equal(repository.mockState.taskStatuses.get("task-1")?.status, "done", "Task should be transitioned to done");
});

test("TaskTerminalTransitionService.apply() correctly transitions task to failed status", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  repository.mockState.taskStatuses.set("task-1", { status: "in_progress", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  service.applyTaskTerminalState(makeTerminalInput({
    currentTaskStatus: "in_progress",
    currentWorkflowStatus: "running",
    currentSessionStatus: "streaming",
    currentExecutionStatus: "executing",
    terminalStatus: "failed",
    context: makeContext({ reasonCode: "ERR_OOM" }),
  }));

  assert.equal(repository.mockState.taskStatuses.get("task-1")?.status, "failed", "Task should be transitioned to failed");
});

test("TaskTerminalTransitionService.apply() correctly transitions task to cancelled status", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  repository.mockState.taskStatuses.set("task-1", { status: "in_progress", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  service.applyTaskTerminalState(makeTerminalInput({
    currentTaskStatus: "in_progress",
    currentWorkflowStatus: "running",
    currentSessionStatus: "streaming",
    currentExecutionStatus: "executing",
    terminalStatus: "cancelled",
  }));

  assert.equal(repository.mockState.taskStatuses.get("task-1")?.status, "cancelled", "Task should be transitioned to cancelled");
});

test("TaskTerminalTransitionService.apply() maps done terminal status to workflow completed", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  repository.mockState.taskStatuses.set("task-1", { status: "in_progress", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  service.applyTaskTerminalState(makeTerminalInput({
    terminalStatus: "done",
  }));

  assert.equal(repository.mockState.workflowStates.get("task-1")?.status, "completed", "Workflow should be transitioned to completed");
  assert.equal(repository.mockState.sessionStatuses.get("session-1")?.status, "completed", "Session should be transitioned to completed");
  assert.equal(repository.mockState.executionStatuses.get("exec-1")?.status, "succeeded", "Execution should be transitioned to succeeded");
});

test("TaskTerminalTransitionService.apply() maps failed terminal status correctly", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  repository.mockState.taskStatuses.set("task-1", { status: "in_progress", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  service.applyTaskTerminalState(makeTerminalInput({
    terminalStatus: "failed",
    context: makeContext({ reasonCode: "ERR_TEST" }),
  }));

  assert.equal(repository.mockState.workflowStates.get("task-1")?.status, "failed", "Workflow should be transitioned to failed");
  assert.equal(repository.mockState.sessionStatuses.get("session-1")?.status, "failed", "Session should be transitioned to failed");
  assert.equal(repository.mockState.executionStatuses.get("exec-1")?.status, "failed", "Execution should be transitioned to failed");
});

test("TaskTerminalTransitionService.apply() maps cancelled terminal status correctly", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  repository.mockState.taskStatuses.set("task-1", { status: "in_progress", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  service.applyTaskTerminalState(makeTerminalInput({
    terminalStatus: "cancelled",
  }));

  assert.equal(repository.mockState.workflowStates.get("task-1")?.status, "cancelled", "Workflow should be transitioned to cancelled");
  assert.equal(repository.mockState.sessionStatuses.get("session-1")?.status, "cancelled", "Session should be transitioned to cancelled");
  assert.equal(repository.mockState.executionStatuses.get("exec-1")?.status, "cancelled", "Execution should be transitioned to cancelled");
});

test("Transition service rejects invalid state transition from in_progress to done via terminal service", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  // Set task to "queued" - invalid transition to "done" (must go through pending/in_progress)
  repository.mockState.taskStatuses.set("task-1", { status: "queued", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "open", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "created", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  assert.throws(
    () =>
      service.applyTaskTerminalState(makeTerminalInput({
        currentTaskStatus: "queued", // Invalid - queued cannot go directly to done
        currentSessionStatus: "open",
        currentExecutionStatus: "created",
        terminalStatus: "done",
      })),
    /invalid_transition/,
    "Should reject invalid task transition from queued to done",
  );
});

test("Transition service rejects invalid workflow state transition to terminal", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  // Set workflow to "cancelled" - invalid transition to "completed"
  repository.mockState.taskStatuses.set("task-1", { status: "in_progress", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "cancelled", currentStepIndex: 0, updatedAt: new Date().toISOString() }); // Cannot transition from cancelled
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  assert.throws(
    () =>
      service.applyTaskTerminalState(makeTerminalInput({
        currentWorkflowStatus: "cancelled", // Invalid - cancelled cannot go to completed
        terminalStatus: "done",
      })),
    /invalid_transition/,
    "Should reject invalid workflow transition from cancelled to completed",
  );
});

test("verifyTransitionAllowed correctly validates task state machine rules", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  repository.mockState.taskStatuses.set("task-1", { status: "in_progress", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  // Valid: in_progress -> done is allowed
  service.applyTaskTerminalState(makeTerminalInput({
    currentTaskStatus: "in_progress",
    terminalStatus: "done",
  }));

  assert.equal(repository.mockState.taskStatuses.get("task-1")?.status, "done");
});

test("verifyTransitionAllowed treats no-op transitions as idempotent", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  // Task already in done, trying to transition to done again
  repository.mockState.taskStatuses.set("task-1", { status: "done", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  assert.doesNotThrow(
    () =>
      service.applyTaskTerminalState(makeTerminalInput({
        currentTaskStatus: "done",
        terminalStatus: "done",
      })),
  );
});

test("TaskTerminalTransitionService.apply() emits tier1 event on successful transition", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  repository.mockState.taskStatuses.set("task-1", { status: "in_progress", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  service.applyTaskTerminalState(makeTerminalInput({
    currentTaskStatus: "in_progress",
    terminalStatus: "done",
  }));

  assert.equal(repository.mockState.tier1Events.length, 1, "Should emit exactly one tier1 event");
  assert.equal(repository.mockState.tier1Events[0]!.eventType, "task:status_changed");
  assert.equal(repository.mockState.tier1Events[0]!.taskId, "task-1");
});

test("TaskTerminalTransitionService.apply() updates task output", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  repository.mockState.taskStatuses.set("task-1", { status: "in_progress", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  const taskOutput = JSON.stringify({ result: "success", data: { key: "value" } });
  service.applyTaskTerminalState(makeTerminalInput({
    currentTaskStatus: "in_progress",
    taskOutputJson: taskOutput,
  }));

  assert.equal(repository.mockState.taskOutputs.get("task-1"), taskOutput, "Task output should be stored");
});

test("TaskTerminalTransitionService.apply() sets error code on failed terminal status", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  repository.mockState.taskStatuses.set("task-1", { status: "in_progress", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  const context = makeContext({ reasonCode: "ERR_OOM" });
  service.applyTaskTerminalState(makeTerminalInput({
    currentTaskStatus: "in_progress",
    currentWorkflowStatus: "running",
    currentSessionStatus: "streaming",
    currentExecutionStatus: "executing",
    terminalStatus: "failed",
    context,
  }));

  // When task transitions to failed, execution should also get the error code
  const execution = repository.mockState.executionStatuses.get("exec-1");
  assert.ok(execution);
  assert.equal(execution!.lastErrorCode, "ERR_OOM", "Execution should have error code set on failed terminal transition");
});

test("TaskTerminalTransitionService.transition() wraps apply in database transaction", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  const mockStore = {} as AuthoritativeTaskStore;

  repository.mockState.taskStatuses.set("task-1", { status: "in_progress", updatedAt: new Date().toISOString() });
  repository.mockState.workflowStates.set("task-1", { status: "running", currentStepIndex: 0, updatedAt: new Date().toISOString() });
  repository.mockState.sessionStatuses.set("session-1", { status: "streaming", updatedAt: new Date().toISOString() });
  repository.mockState.executionStatuses.set("exec-1", { status: "executing", startedAt: null, finishedAt: null, lastErrorCode: null, updatedAt: new Date().toISOString() });

  const service = new TransitionService(db, mockStore, repository);

  service.transitionTaskTerminalState(makeTerminalInput({
    currentTaskStatus: "in_progress",
  }));

  // All entities should be updated successfully within transaction
  assert.equal(repository.mockState.taskStatuses.get("task-1")?.status, "done");
  assert.equal(repository.mockState.workflowStates.get("task-1")?.status, "completed");
  assert.equal(repository.mockState.sessionStatuses.get("session-1")?.status, "completed");
  assert.equal(repository.mockState.executionStatuses.get("exec-1")?.status, "succeeded");
});
