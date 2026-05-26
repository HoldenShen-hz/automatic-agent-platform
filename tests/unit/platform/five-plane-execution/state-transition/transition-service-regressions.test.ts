import assert from "node:assert/strict";
import test from "node:test";

import type { EventRecord, WorkflowStateRecord } from "../../../../../src/platform/contracts/types/domain.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { RuntimeLifecycleRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/repositories/runtime-lifecycle-repository.js";
import {
  ExecutionTransitionService,
  SessionTransitionService,
  TransitionService,
  WorkflowTransitionService,
} from "../../../../../src/platform/five-plane-execution/state-transition/transition-service.js";

function createDatabaseMock() {
  const transactionCalls: Array<() => unknown> = [];
  const db: AuthoritativeSqlDatabase & { transactionCalls: Array<() => unknown> } = {
    transactionCalls,
    filePath: ":memory:",
    backendType: "sqlite",
    connection: {
      exec: () => {},
      prepare: (sql: string) => ({
        get: (value: string) => {
          if (sql.includes("SELECT 1 FROM executions WHERE id = ? LIMIT 1")) {
            return value.startsWith("exec-") ? { 1: 1 } : undefined;
          }
          if (sql.includes("SELECT task_id FROM executions WHERE id = ? LIMIT 1")) {
            if (!value.startsWith("exec-")) {
              return undefined;
            }
            return { task_id: value.replace(/^exec-/, "task-") };
          }
          if (sql.includes("SELECT 1 FROM tasks WHERE id = ? LIMIT 1")) {
            return value.startsWith("task-") ? { 1: 1 } : undefined;
          }
          throw new Error(`unexpected_sql:${sql}`);
        },
      }),
    },
    migrate: () => {},
    getSchemaStatus: () => ({
      currentVersion: 1,
      expectedVersion: 1,
      upToDate: true,
      pendingVersions: [],
      checksumMismatches: [],
    }),
    assertSchemaCurrent: () => {},
    integrityCheck: () => [],
    healthCheck: async () => true,
    close: () => {},
    transaction: <T>(work: () => T): T => {
      transactionCalls.push(work);
      return work();
    },
    readTransaction: <T>(work: () => T): T => work(),
  };
  return db;
}

function createRepositoryMock() {
  const state = {
    taskStatus: "in_progress",
    workflowStatus: "running",
    workflowStepIndex: 2,
    sessionStatus: "streaming",
    executionStatus: "executing",
    events: [] as Array<{ eventType: string; taskId: string | null; sessionId?: string | null; executionId: string | null }>,
  };

  const repository: RuntimeLifecycleRepository & {
    state: typeof state;
    getSession?: (sessionId: string) => { taskId?: string | null } | null;
  } = {
    state,
    updateTaskStatus: () => {},
    updateTaskStatusCas: () => {
      state.taskStatus = "done";
      return 1;
    },
    updateTaskOutput: () => {},
    updateWorkflowState: () => {},
    updateWorkflowStateCas: (_taskId, _expectedVersion, _expectedStatus, status, currentStepIndex) => {
      state.workflowStatus = status;
      state.workflowStepIndex = currentStepIndex;
      return 1;
    },
    getWorkflowState: (taskId) => ({
      taskId,
      divisionId: "division-1",
      workflowId: "workflow-1",
      currentStepIndex: state.workflowStepIndex,
      status: state.workflowStatus as WorkflowStateRecord["status"],
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: "2026-05-06T09:58:00.000Z",
      updatedAt: "2026-05-06T09:59:00.000Z",
    }),
    updateSessionStatus: () => {},
    updateSessionStatusCas: () => {
      state.sessionStatus = "completed";
      return 1;
    },
    updateExecutionStatus: () => {},
    updateExecutionStatusCas: () => {
      state.executionStatus = "succeeded";
      return 1;
    },
    createTier1StatusEvent: (input) => {
      state.events.push(input);
      return {
        id: `event-${state.events.length}`,
        taskId: input.taskId,
        sessionId: input.sessionId ?? null,
        executionId: input.executionId,
        eventType: input.eventType,
        eventTier: "tier_1",
        payloadJson: JSON.stringify(input.payload),
        traceId: input.traceId,
        createdAt: "2026-05-06T10:00:00.000Z",
      } as EventRecord;
    },
    insertApproval: () => {},
    getApproval: () => null,
    listApprovalsByTask: () => [],
    updateApprovalDecision: () => {},
    updateApprovalDecisionCas: () => 1,
    updateApprovalRequest: () => {},
    insertEvent: () => ({
      id: "event-inserted",
      taskId: null,
      sessionId: null,
      executionId: null,
      eventType: "platform.status_changed",
      eventTier: "tier_1",
      payloadJson: "{}",
      traceId: null,
      createdAt: "2026-05-06T10:00:00.000Z",
    } as EventRecord),
    getSession: (sessionId) => ({ taskId: sessionId === "session-2" ? "task-2" : "task-1" }),
  };

  return repository;
}

function makeContext() {
  return {
    reasonCode: "test.transition",
    traceId: "trace-1",
    actorType: "system" as const,
    occurredAt: "2026-05-06T10:00:00.000Z",
  };
}

test("TransitionService.applyTaskTerminalState cascades task, workflow, session, and execution updates", () => {
  const db = createDatabaseMock();
  const repository = createRepositoryMock();
  const service = new TransitionService(db, {} as never, repository);

  service.applyTaskTerminalState({
    taskId: "task-1",
    sessionId: "session-1",
    executionId: "exec-1",
    currentTaskStatus: "in_progress",
    currentWorkflowStatus: "running",
    currentSessionStatus: "streaming",
    currentExecutionStatus: "executing",
    terminalStatus: "done",
    taskOutputJson: "{\"result\":\"ok\"}",
    outputsJson: "{\"step\":\"ok\"}",
    context: makeContext(),
    expectedTaskUpdatedAt: "2026-05-06T09:59:00.000Z",
    expectedWorkflowStepIndex: 2,
    expectedSessionUpdatedAt: "2026-05-06T09:59:00.000Z",
    expectedExecutionUpdatedAt: "2026-05-06T09:59:00.000Z",
  });

  assert.equal(repository.state.taskStatus, "done");
  assert.equal(repository.state.workflowStatus, "completed");
  assert.equal(repository.state.sessionStatus, "completed");
  assert.equal(repository.state.executionStatus, "succeeded");
});

test("WorkflowTransitionService.transition executes within the provided database transaction", () => {
  const db = createDatabaseMock();
  const repository = createRepositoryMock();
  const service = new WorkflowTransitionService(db, repository);

  service.transition({
    entityKind: "workflow",
    entityId: "task-2",
    fromStatus: "running",
    toStatus: "paused",
    currentStepIndex: 1,
    outputsJson: "{}",
    ...makeContext(),
  });

  assert.equal(db.transactionCalls.length, 1);
  assert.equal(repository.state.events.at(-1)?.eventType, "workflow:status_changed");
});

test("SessionTransitionService and ExecutionTransitionService emit canonical tier-1 status events", () => {
  const repository = createRepositoryMock();
  const sessionService = new SessionTransitionService(repository);
  const executionService = new ExecutionTransitionService(repository, null);

  sessionService.apply({
    entityKind: "session",
    entityId: "session-2",
    fromStatus: "streaming",
    toStatus: "completed",
    ...makeContext(),
  });
  executionService.apply({
    entityKind: "execution",
    entityId: "exec-2",
    fromStatus: "executing",
    toStatus: "succeeded",
    ...makeContext(),
  });

  assert.equal(repository.state.events.at(-2)?.eventType, "session:status_changed");
  assert.equal(repository.state.events.at(-1)?.eventType, "execution:status_changed");
});
