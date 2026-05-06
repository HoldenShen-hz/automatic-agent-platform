// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import {
  ExecutionTransitionService,
  SessionTransitionService,
  TransitionService,
  WorkflowTransitionService,
} from "../../../../../src/platform/five-plane-execution/state-transition/transition-service.js";

function createMockDatabase() {
  const transactionCalls = [];
  return {
    transactionCalls,
    transaction(fn) {
      transactionCalls.push(fn);
      return fn();
    },
    readTransaction(fn) {
      return fn();
    },
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
    filePath: ":memory:",
    backendType: "sqlite",
    connection: {},
  };
}

function createMockRepository() {
  const state = {
    tasks: new Map(),
    workflows: new Map(),
    sessions: new Map(),
    executions: new Map(),
    taskOutputs: new Map(),
    tier1Events: [],
    taskOutputCasCalls: [],
    taskStatusCasCalls: [],
    workflowStateCasCalls: [],
    sessionStatusCasCalls: [],
    executionStatusCasCalls: [],
  };

  return {
    state,
    getTask(taskId) {
      const current = state.tasks.get(taskId);
      return current == null
        ? null
        : {
            id: taskId,
            status: current.status,
            updatedAt: current.updatedAt,
            completedAt: null,
            errorCode: null,
          };
    },
    getWorkflowState(taskId) {
      const current = state.workflows.get(taskId);
      return current == null
        ? null
        : {
            taskId,
            divisionId: "division-1",
            workflowId: "workflow-1",
            currentStepIndex: current.currentStepIndex,
            status: current.status,
            outputsJson: "{}",
            lastErrorCode: null,
            retryCount: 0,
            resumableFromStep: null,
            startedAt: current.updatedAt,
            updatedAt: current.updatedAt,
          };
    },
    getSession(sessionId) {
      const current = state.sessions.get(sessionId);
      return current == null
        ? null
        : {
            id: sessionId,
            taskId: current.taskId,
            status: current.status,
            updatedAt: current.updatedAt,
          };
    },
    getExecution(executionId) {
      const current = state.executions.get(executionId);
      return current == null
        ? null
        : {
            id: executionId,
            taskId: current.taskId,
            status: current.status,
            startedAt: current.startedAt,
            finishedAt: current.finishedAt,
            lastErrorCode: current.lastErrorCode,
            updatedAt: current.updatedAt,
          };
    },
    updateTaskOutputCas(taskId, expectedUpdatedAt, expectedStatus, outputJson, updatedAt) {
      state.taskOutputCasCalls.push({ taskId, expectedUpdatedAt, expectedStatus, outputJson, updatedAt });
      const current = state.tasks.get(taskId);
      if (current == null || current.updatedAt !== expectedUpdatedAt || current.status !== expectedStatus) {
        return 0;
      }
      state.taskOutputs.set(taskId, outputJson);
      return 1;
    },
    updateTaskStatusCas(taskId, fromStatus, toStatus, occurredAt) {
      state.taskStatusCasCalls.push({ taskId, fromStatus, toStatus, occurredAt });
      const current = state.tasks.get(taskId);
      if (current == null || current.status !== fromStatus) {
        return 0;
      }
      state.tasks.set(taskId, { ...current, status: toStatus, updatedAt: occurredAt });
      return 1;
    },
    updateWorkflowStateCas(taskId, expectedStepIndex, expectedStatus, toStatus, currentStepIndex, _outputsJson, occurredAt) {
      state.workflowStateCasCalls.push({
        taskId,
        expectedStepIndex,
        expectedStatus,
        toStatus,
        currentStepIndex,
        occurredAt,
      });
      const current = state.workflows.get(taskId);
      if (
        current == null
        || current.status !== expectedStatus
        || current.currentStepIndex !== expectedStepIndex
      ) {
        return 0;
      }
      state.workflows.set(taskId, {
        ...current,
        status: toStatus,
        currentStepIndex,
        updatedAt: occurredAt,
      });
      return 1;
    },
    updateSessionStatusCas(sessionId, fromStatus, toStatus, occurredAt) {
      state.sessionStatusCasCalls.push({ sessionId, fromStatus, toStatus, occurredAt });
      const current = state.sessions.get(sessionId);
      if (current == null || current.status !== fromStatus) {
        return 0;
      }
      state.sessions.set(sessionId, { ...current, status: toStatus, updatedAt: occurredAt });
      return 1;
    },
    updateExecutionStatusCas(executionId, fromStatus, toStatus, occurredAt, startedAt, finishedAt, lastErrorCode) {
      state.executionStatusCasCalls.push({
        executionId,
        fromStatus,
        toStatus,
        occurredAt,
        startedAt,
        finishedAt,
        lastErrorCode,
      });
      const current = state.executions.get(executionId);
      if (current == null || current.status !== fromStatus) {
        return 0;
      }
      state.executions.set(executionId, {
        ...current,
        status: toStatus,
        updatedAt: occurredAt,
        startedAt: startedAt ?? current.startedAt,
        finishedAt: finishedAt ?? current.finishedAt,
        lastErrorCode: lastErrorCode ?? current.lastErrorCode,
      });
      return 1;
    },
    createTier1StatusEvent(input) {
      state.tier1Events.push(input);
      return {
        id: `event-${state.tier1Events.length}`,
        taskId: input.taskId ?? null,
        sessionId: input.sessionId ?? null,
        executionId: input.executionId ?? null,
        eventType: input.eventType,
        eventTier: "tier_1",
        payloadJson: JSON.stringify(input.payload),
        traceId: input.traceId,
        createdAt: new Date().toISOString(),
      };
    },
    appendPlatformFactEvent(event) {
      return {
        id: "pfe-1",
        taskId: event.aggregateId ?? null,
        sessionId: null,
        executionId: null,
        eventType: event.eventType ?? "platform.status_changed",
        eventTier: "tier_1",
        payloadJson: JSON.stringify(event.payload ?? {}),
        traceId: event.traceId ?? null,
        createdAt: new Date().toISOString(),
      };
    },
  };
}

function makeContext(overrides = {}) {
  return {
    reasonCode: "test.transition",
    traceId: "trace-1",
    actorType: "system",
    occurredAt: "2026-05-06T10:00:00.000Z",
    ...overrides,
  };
}

test("TaskTerminalTransitionService.apply uses CAS writers for task/workflow/session/execution (R19-15)", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();

  repository.state.tasks.set("task-1", {
    status: "in_progress",
    updatedAt: "2026-05-06T09:59:00.000Z",
  });
  repository.state.workflows.set("task-1", {
    status: "running",
    currentStepIndex: 2,
    updatedAt: "2026-05-06T09:59:00.000Z",
  });
  repository.state.sessions.set("session-1", {
    taskId: "task-1",
    status: "streaming",
    updatedAt: "2026-05-06T09:59:00.000Z",
  });
  repository.state.executions.set("exec-1", {
    taskId: "task-1",
    status: "executing",
    startedAt: "2026-05-06T09:58:00.000Z",
    finishedAt: null,
    lastErrorCode: null,
    updatedAt: "2026-05-06T09:59:00.000Z",
  });

  const service = new TransitionService(db, {}, repository);

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

  assert.equal(repository.state.taskOutputCasCalls.length, 1);
  assert.equal(repository.state.taskStatusCasCalls.length, 1);
  assert.equal(repository.state.workflowStateCasCalls.length, 1);
  assert.equal(repository.state.sessionStatusCasCalls.length, 1);
  assert.equal(repository.state.executionStatusCasCalls.length, 1);
  assert.equal(repository.state.tasks.get("task-1").status, "done");
  assert.equal(repository.state.workflows.get("task-1").status, "completed");
  assert.equal(repository.state.sessions.get("session-1").status, "completed");
  assert.equal(repository.state.executions.get("exec-1").status, "succeeded");
});

test("WorkflowTransitionService.transition is transaction-wrapped and emits workflow status events (R19-19/R19-20)", () => {
  const db = createMockDatabase();
  const repository = createMockRepository();
  repository.state.workflows.set("task-2", {
    status: "running",
    currentStepIndex: 0,
    updatedAt: "2026-05-06T09:58:00.000Z",
  });

  const service = new WorkflowTransitionService(db, repository);
  service.transition({
    entityKind: "workflow",
    entityId: "task-2",
    fromStatus: "running",
    toStatus: "paused",
    currentStepIndex: 1,
    outputsJson: "{}",
    ...makeContext({ traceId: "trace-workflow" }),
  });

  assert.equal(db.transactionCalls.length, 1);
  assert.equal(repository.state.tier1Events.at(-1).eventType, "workflow:status_changed");
});

test("SessionTransitionService.apply emits tier-1 session status events (R19-20)", () => {
  const repository = createMockRepository();
  repository.state.sessions.set("session-2", {
    taskId: "task-2",
    status: "open",
    updatedAt: "2026-05-06T09:58:00.000Z",
  });

  const service = new SessionTransitionService(repository);
  service.apply({
    entityKind: "session",
    entityId: "session-2",
    fromStatus: "open",
    toStatus: "streaming",
    ...makeContext({ traceId: "trace-session" }),
  });

  assert.equal(repository.state.tier1Events.at(-1).eventType, "session:status_changed");
  assert.equal(repository.state.tier1Events.at(-1).sessionId, "session-2");
});

test("ExecutionTransitionService.apply emits tier-1 execution status events (R19-20)", () => {
  const repository = createMockRepository();
  repository.state.executions.set("exec-2", {
    taskId: "task-2",
    status: "created",
    startedAt: null,
    finishedAt: null,
    lastErrorCode: null,
    updatedAt: "2026-05-06T09:58:00.000Z",
  });

  const service = new ExecutionTransitionService(repository);
  service.apply({
    entityKind: "execution",
    entityId: "exec-2",
    fromStatus: "created",
    toStatus: "prechecking",
    ...makeContext({ traceId: "trace-execution" }),
  });

  assert.equal(repository.state.tier1Events.at(-1).eventType, "execution:status_changed");
  assert.equal(repository.state.tier1Events.at(-1).executionId, "exec-2");
});
