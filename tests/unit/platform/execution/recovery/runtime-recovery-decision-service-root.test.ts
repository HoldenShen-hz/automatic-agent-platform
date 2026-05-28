import assert from "node:assert/strict";
import test from "node:test";

import {
  RuntimeRecoveryDecisionService,
  type RecoveryDecisionRecord,
  type RecoveryDecisionApplyResult,
} from "../../../../../src/platform/five-plane-execution/recovery/runtime-recovery-decision-service.js";
import type { RuntimeRecoveryCandidate } from "../../../../../src/platform/five-plane-execution/recovery/runtime-recovery-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

// Mock database
function createMockDb() {
  return {
    transaction: (fn: () => void) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
}

// Mock store helper - minimal mock for basic instantiation tests
function createMinimalMockStore() {
  return {
    dispatch: {
      getExecution: () => null,
      listDeadLettersByTask: () => [],
    },
    task: {
      getTask: () => null,
    },
    event: {
      insertEvent: () => {},
      listEventsForTask: () => [],
    },
    execution: {
      updateExecutionFailure: () => {},
      insertDeadLetter: () => {},
      getExecutionPrecheck: () => null,
    },
    approval: {
      listApprovalsByTask: () => [],
    },
    artifact: {
      listArtifactsByTask: () => [],
    },
    operations: {
      buildRuntimeRecoveryView: () => [],
    },
    memory: {
      findMemoryByContentHash: () => null,
      recordMemoryAccess: () => {},
      insertMemory: () => {},
    },
  } as unknown as AuthoritativeTaskStore;
}

function createRecoveryRecord(overrides: Record<string, unknown> = {}) {
  return {
    executionId: "exec-1",
    taskId: "task-1",
    divisionId: "division-1",
    taskStatus: "in_progress",
    status: "executing",
    attempt: 1,
    traceId: "trace-1",
    workflowId: null,
    latestErrorCode: null,
    updatedAt: new Date().toISOString(),
    lastHeartbeatAt: null,
    pendingApprovalId: null,
    latestPrecheck: null,
    ...overrides,
  };
}

function createFullMockStore(overrides: {
  executions?: Array<Record<string, unknown>>;
  tasks?: Array<Record<string, unknown>>;
  recoveryRecords?: Array<Record<string, unknown>>;
  insertEvent?: () => void;
  updateExecutionFailure?: () => void;
  insertDeadLetter?: () => void;
} = {}) {
  return {
    dispatch: {
      getExecution: (id: string) => overrides.executions?.find((item) => item.id === id) ?? null,
      listDeadLettersByTask: () => [],
    },
    task: {
      getTask: (id: string) => overrides.tasks?.find((item) => item.id === id) ?? null,
    },
    event: {
      insertEvent: overrides.insertEvent ?? (() => {}),
      listEventsForTask: () => [],
    },
    execution: {
      updateExecutionFailure: overrides.updateExecutionFailure ?? (() => {}),
      insertDeadLetter: overrides.insertDeadLetter ?? (() => {}),
      getExecutionPrecheck: () => null,
    },
    approval: {
      listApprovalsByTask: () => [],
    },
    artifact: {
      listArtifactsByTask: () => [],
    },
    operations: {
      buildRuntimeRecoveryView: () => overrides.recoveryRecords ?? [],
    },
    memory: {
      findMemoryByContentHash: () => null,
      recordMemoryAccess: () => {},
      insertMemory: () => {},
    },
  } as unknown as AuthoritativeTaskStore;
}

test("RuntimeRecoveryDecisionService can be instantiated [runtime-recovery-decision-service-root]", () => {
  const db = createMockDb();
  const store = createMinimalMockStore();
  const service = new RuntimeRecoveryDecisionService(db, store);

  assert.ok(service != null);
});

test("RuntimeRecoveryDecisionService.decide throws when execution not found [runtime-recovery-decision-service-root]", () => {
  const db = createMockDb();
  const store = createMinimalMockStore();
  const service = new RuntimeRecoveryDecisionService(db, store);

  assert.throws(
    () => service.decide("nonexistent-exec"),
    (err: unknown) => (err as Error).message.includes("Execution not found"),
  );
});

test("RuntimeRecoveryDecisionService.apply throws when execution not found [runtime-recovery-decision-service-root]", () => {
  const db = createMockDb();
  const store = createMinimalMockStore();
  const service = new RuntimeRecoveryDecisionService(db, store);

  assert.throws(
    () => service.apply("nonexistent-exec"),
    (err: unknown) => (err as Error).message.includes("Execution not found"),
  );
});

test("RuntimeRecoveryDecisionService.decide returns decision record [runtime-recovery-decision-service-root]", () => {
  const db = createMockDb();
  const store = createFullMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1" }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    recoveryRecords: [
      createRecoveryRecord({
        latestPrecheck: {
          allowed: false,
          reasonCode: "budget_exceeded",
          resolvedBudgetUsd: 100,
          resolvedTimeoutMs: 60000,
          resolvedSandboxMode: "workspace",
          resolvedToolsJson: "[]",
          resolvedPathsJson: "[]",
          checkedAt: new Date().toISOString(),
        },
      }),
    ],
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  const decision = service.decide("exec-1");

  assert.equal(decision.executionId, "exec-1");
  assert.equal(decision.taskId, "task-1");
  assert.equal(decision.reason, "precheck_denied:budget_exceeded");
  assert.equal(decision.action, "cancel");
});

test("RuntimeRecoveryDecisionService.decide uses custom decidedBy [runtime-recovery-decision-service-root]", () => {
  const db = createMockDb();
  const store = createFullMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1" }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    recoveryRecords: [
      createRecoveryRecord({
        latestPrecheck: {
          allowed: false,
          reasonCode: "tool_not_found",
          resolvedBudgetUsd: 100,
          resolvedTimeoutMs: 60000,
          resolvedSandboxMode: "workspace",
          resolvedToolsJson: "[]",
          resolvedPathsJson: "[]",
          checkedAt: new Date().toISOString(),
        },
      }),
    ],
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  assert.equal(service.decide("exec-1", "custom_service").decidedBy, "custom_service");
});

test("RuntimeRecoveryDecisionService.decide throws when candidate not found [runtime-recovery-decision-service-root]", () => {
  const db = createMockDb();
  const store = createFullMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing" }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    recoveryRecords: [],
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  assert.throws(() => service.decide("exec-1"), /Recovery candidate not found/);
});

test("RuntimeRecoveryDecisionService.apply throws when candidate not found [runtime-recovery-decision-service-root]", () => {
  const db = createMockDb();
  const store = createFullMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing" }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    recoveryRecords: [],
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  assert.throws(() => service.apply("exec-1"), /Recovery candidate not found/);
});

test("RuntimeRecoveryDecisionService.apply handles cancel action [runtime-recovery-decision-service-root]", () => {
  const db = createMockDb();
  let updated = false;
  const store = createFullMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1", lastErrorCode: null, lastErrorMessage: null }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    recoveryRecords: [
      createRecoveryRecord({
        latestPrecheck: {
          allowed: false,
          reasonCode: "budget_exceeded",
          resolvedBudgetUsd: 100,
          resolvedTimeoutMs: 60000,
          resolvedSandboxMode: "workspace",
          resolvedToolsJson: "[]",
          resolvedPathsJson: "[]",
          checkedAt: new Date().toISOString(),
        },
      }),
    ],
    updateExecutionFailure: () => { updated = true; },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  const result = service.apply("exec-1");
  assert.equal(result.applied, true);
  assert.equal(result.deadLetter, null);
  assert.equal(result.decision.action, "cancel");
  assert.equal(updated, true);
});

test("RuntimeRecoveryDecisionService.apply handles move_dead_letter action [runtime-recovery-decision-service-root]", () => {
  const db = createMockDb();
  let deadLetterInserted = false;
  const store = createFullMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1", lastErrorCode: "E1", lastErrorMessage: "Execution failed", attempt: 2, agentId: "agent-1" }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    recoveryRecords: [createRecoveryRecord({ latestErrorCode: "E1", attempt: 2 })],
    insertDeadLetter: () => { deadLetterInserted = true; },
    updateExecutionFailure: () => {},
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  const result = service.apply("exec-1");
  assert.equal(result.applied, true);
  assert.equal(result.decision.action, "move_dead_letter");
  assert.ok(result.deadLetter);
  assert.equal(deadLetterInserted, true);
});

test("RecoveryDecisionRecord has correct structure [runtime-recovery-decision-service-root]", () => {
  const record: RecoveryDecisionRecord = {
    decisionId: "rdec-1",
    executionId: "exec-1",
    taskId: "task-1",
    reason: "execution_error:E1",
    action: "cancel",
    decidedAt: "2026-04-24T00:00:00.000Z",
    decidedBy: "test",
  };

  assert.equal(record.executionId, "exec-1");
  assert.equal(record.action, "cancel");
});

test("RecoveryDecisionApplyResult has correct structure [runtime-recovery-decision-service-root]", () => {
  const record: RecoveryDecisionRecord = {
    decisionId: "rdec-1",
    executionId: "exec-1",
    taskId: "task-1",
    reason: "execution_error:E1",
    action: "move_dead_letter",
    decidedAt: "2026-04-24T00:00:00.000Z",
    decidedBy: "test",
  };
  const result: RecoveryDecisionApplyResult = {
    decision: record,
    deadLetter: null,
    applied: true,
  };

  assert.equal(result.applied, true);
  assert.equal(result.decision.action, "move_dead_letter");
});

test("RuntimeRecoveryDecisionService.decide records decision event [runtime-recovery-decision-service-root]", () => {
  const db = createMockDb();
  let inserted = 0;
  const store = createFullMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1" }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    recoveryRecords: [
      createRecoveryRecord({
        latestPrecheck: {
          allowed: false,
          reasonCode: "budget_exceeded",
          resolvedBudgetUsd: 100,
          resolvedTimeoutMs: 60000,
          resolvedSandboxMode: "workspace",
          resolvedToolsJson: "[]",
          resolvedPathsJson: "[]",
          checkedAt: new Date().toISOString(),
        },
      }),
    ],
    insertEvent: () => { inserted += 1; },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  service.decide("exec-1");
  assert.equal(inserted, 1);
});

test("RuntimeRecoveryDecisionService.apply records decision and action events [runtime-recovery-decision-service-root]", () => {
  const db = createMockDb();
  let inserted = 0;
  const store = createFullMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1", lastErrorCode: null, lastErrorMessage: null }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    recoveryRecords: [
      createRecoveryRecord({
        latestPrecheck: {
          allowed: false,
          reasonCode: "budget_exceeded",
          resolvedBudgetUsd: 100,
          resolvedTimeoutMs: 60000,
          resolvedSandboxMode: "workspace",
          resolvedToolsJson: "[]",
          resolvedPathsJson: "[]",
          checkedAt: new Date().toISOString(),
        },
      }),
    ],
    insertEvent: () => { inserted += 1; },
    updateExecutionFailure: () => {},
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  service.apply("exec-1");
  assert.ok(inserted >= 2);
});
