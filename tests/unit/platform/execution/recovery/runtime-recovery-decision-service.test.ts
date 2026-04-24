import assert from "node:assert/strict";
import test from "node:test";

import {
  RuntimeRecoveryDecisionService,
  type RecoveryDecisionRecord,
  type RecoveryDecisionApplyResult,
} from "../../../../../src/platform/execution/recovery/runtime-recovery-decision-service.js";
import type { RuntimeRecoveryCandidate } from "../../../../../src/platform/execution/recovery/runtime-recovery-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";

// Mock database factory
function createMockDb(): AuthoritativeSqlDatabase {
  return {
    transaction: (fn: () => void) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
}

// Mock store factory
function createMockStore(overrides: {
  executions?: Array<{
    id: string;
    taskId: string;
    status: string;
    traceId?: string;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    attempt?: number;
    agentId?: string;
  }>;
  tasks?: Array<{ id: string; status: string; divisionId?: string | null }>;
  events?: Array<{ id: string; eventType: string; eventTier?: string; payloadJson?: string; traceId?: string | null }>;
  deadLetters?: Array<{ id: string; executionId: string; taskId: string; finalReasonCode: string; retryCount: number; lastErrorMessage: string; movedAt: string }>;
  candidates?: RuntimeRecoveryCandidate[];
  approvals?: Array<{ id: string; taskId: string; status: string }>;
  artifacts?: Array<{ id: string; taskId: string; artifactId: string; artifactType: string }>;
  recoveryView?: { candidates: RuntimeRecoveryCandidate[]; requestedApprovals: Array<{ id: string; taskId: string; status: string }>; deadLetters: Array<{ id: string; executionId: string; taskId: string; finalReasonCode: string; retryCount: number; lastErrorMessage: string; movedAt: string }>; latestCheckpoint: null; recentRecoveryEvents: Array<{ eventId: string; eventType: string; createdAt: string; traceId: string | null; repairAction: string | null; decisionAction: string | null; targetId: string | null; deadLetterId: string | null }> };
  execution?: {
    updateExecutionFailure?: (input: {
      executionId: string;
      status: string;
      updatedAt: string;
      finishedAt: string | null;
      lastErrorCode: string | null;
      lastErrorMessage: string | null;
    }) => void;
    insertDeadLetter?: () => void;
    getExecutionPrecheck?: () => null;
  };
  approval?: {
    listApprovalsByTask?: () => Array<{ id: string; taskId: string; status: string }>;
  };
  artifact?: {
    listArtifactsByTask?: () => Array<{ id: string; taskId: string; artifactId: string; artifactType: string }>;
  };
  event?: {
    insertEvent?: () => void;
    listEventsForTask?: () => Array<{ id: string; eventType: string; eventTier?: string; payloadJson?: string; traceId?: string | null }>;
  };
  operations?: {
    buildRuntimeRecoveryView?: () => RuntimeRecoveryCandidate[];
  };
  dispatch?: {
    getExecution?: (id: string) => {
      id: string;
      taskId: string;
      status: string;
      traceId?: string;
      lastErrorCode?: string | null;
      lastErrorMessage?: string | null;
      attempt?: number;
      agentId?: string;
    } | null;
    listDeadLettersByTask?: () => Array<{ id: string; executionId: string; taskId: string; finalReasonCode: string; retryCount: number; lastErrorMessage: string; movedAt: string }>;
  };
  memory?: {
    recordFailureMemory?: () => void;
  };
} = {}): AuthoritativeTaskStore {
  return {
    dispatch: {
      getExecution: (id: string) => overrides.executions?.find((e) => e.id === id) ?? null,
      listDeadLettersByTask: overrides.dispatch?.listDeadLettersByTask ?? (() => []),
    },
    task: {
      getTask: (id: string) => overrides.tasks?.find((t) => t.id === id) ?? null,
    },
    event: {
      insertEvent: overrides.event?.insertEvent ?? (() => {}),
      listEventsForTask: overrides.event?.listEventsForTask ?? (() => []),
    },
    execution: {
      updateExecutionFailure: overrides.execution?.updateExecutionFailure ?? (() => {}),
      insertDeadLetter: overrides.execution?.insertDeadLetter ?? (() => {}),
      getExecutionPrecheck: overrides.execution?.getExecutionPrecheck ?? (() => null),
    },
    approval: {
      listApprovalsByTask: overrides.approval?.listApprovalsByTask ?? (() => []),
    },
    artifact: {
      listArtifactsByTask: overrides.artifact?.listArtifactsByTask ?? (() => []),
    },
    operations: {
      buildRuntimeRecoveryView: overrides.operations?.buildRuntimeRecoveryView ?? (() => overrides.candidates ?? []),
    },
    memory: {
      findMemoryByContentHash: () => null,
      recordMemoryAccess: () => {},
      insertMemory: overrides.memory?.recordFailureMemory ?? (() => {}),
    },
  } as unknown as AuthoritativeTaskStore;
}

// Helper to create a mock recovery candidate
function createMockCandidate(overrides: Partial<RuntimeRecoveryCandidate> = {}): RuntimeRecoveryCandidate {
  return {
    executionId: "exec-1",
    taskId: "task-1",
    divisionId: "division-1",
    taskStatus: "in_progress",
    status: "executing",
    attempt: 1,
    traceId: "trace-1",
    workflowId: null,
    latestErrorCode: "E1",
    updatedAt: new Date().toISOString(),
    lastHeartbeatAt: null,
    pendingApprovalId: null,
    latestPrecheck: null,
    reason: "execution_error:E1",
    suggestedAction: "move_dead_letter",
    ...overrides,
  };
}

test("RuntimeRecoveryDecisionService can be instantiated", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new RuntimeRecoveryDecisionService(db, store);

  assert.ok(service != null);
});

test("RuntimeRecoveryDecisionService.decide throws when execution not found", () => {
  const db = createMockDb();
  const store = createMockStore({
    executions: [],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  assert.throws(
    () => service.decide("nonexistent-exec"),
    (err: unknown) => (err as Error).message.includes("Execution not found"),
  );
});

test("RuntimeRecoveryDecisionService.apply throws when execution not found", () => {
  const db = createMockDb();
  const store = createMockStore({
    executions: [],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  assert.throws(
    () => service.apply("nonexistent-exec"),
    (err: unknown) => (err as Error).message.includes("Execution not found"),
  );
});

test("RuntimeRecoveryDecisionService.decide throws when candidate not found", () => {
  const db = createMockDb();
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing" }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    candidates: [],
    operations: {
      buildRuntimeRecoveryView: () => [],
    },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  assert.throws(
    () => service.decide("exec-1"),
    (err: unknown) => (err as Error).message.includes("Recovery candidate not found"),
  );
});

test("RuntimeRecoveryDecisionService.decide returns decision record", () => {
  const db = createMockDb();
  const candidate = createMockCandidate({
    executionId: "exec-1",
    latestErrorCode: null,
    latestPrecheck: {
      allowed: false,
      reasonCode: "budget_exceeded",
      resolvedBudgetUsd: 100,
      resolvedTimeoutMs: 60000,
      resolvedSandboxMode: "workspace",
      resolvedTools: [],
      resolvedPaths: [],
      checkedAt: new Date().toISOString(),
    },
  });
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing" }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    operations: {
      buildRuntimeRecoveryView: () => [candidate],
    },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  const decision = service.decide("exec-1");

  assert.ok(decision.decisionId.length > 0);
  assert.equal(decision.executionId, "exec-1");
  assert.equal(decision.taskId, "task-1");
  assert.equal(decision.reason, "precheck_denied:budget_exceeded");
  assert.equal(decision.action, "cancel");
  assert.ok(decision.decidedAt.length > 0);
  assert.equal(decision.decidedBy, "runtime_recovery_decision_service");
});

test("RuntimeRecoveryDecisionService.decide uses custom decidedBy", () => {
  const db = createMockDb();
  const candidate = createMockCandidate({
    executionId: "exec-1",
    latestErrorCode: null,
    latestPrecheck: {
      allowed: false,
      reasonCode: "tool_not_found",
      resolvedBudgetUsd: 100,
      resolvedTimeoutMs: 60000,
      resolvedSandboxMode: "workspace",
      resolvedTools: [],
      resolvedPaths: [],
      checkedAt: new Date().toISOString(),
    },
  });
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing" }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    operations: {
      buildRuntimeRecoveryView: () => [candidate],
    },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  const decision = service.decide("exec-1", "custom_service");

  assert.equal(decision.decidedBy, "custom_service");
  assert.equal(decision.action, "cancel");
});

test("RuntimeRecoveryDecisionService.apply handles cancel action", () => {
  const db = createMockDb();
  let failureUpdated = false;
  let eventInserted = false;
  const candidate = createMockCandidate({
    executionId: "exec-1",
    latestErrorCode: null,
    latestPrecheck: {
      allowed: false,
      reasonCode: "budget_exceeded",
      resolvedBudgetUsd: 100,
      resolvedTimeoutMs: 60000,
      resolvedSandboxMode: "workspace",
      resolvedTools: [],
      resolvedPaths: [],
      checkedAt: new Date().toISOString(),
    },
  });
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1" }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    operations: {
      buildRuntimeRecoveryView: () => [candidate],
    },
    execution: {
      updateExecutionFailure: () => { failureUpdated = true; },
      insertDeadLetter: () => {},
      getExecutionPrecheck: () => null,
    },
    event: {
      insertEvent: () => { eventInserted = true; },
      listEventsForTask: () => [],
    },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  const result = service.apply("exec-1");

  assert.equal(result.applied, true);
  assert.equal(result.deadLetter, null);
  assert.equal(result.decision.action, "cancel");
  assert.equal(failureUpdated, true);
  assert.equal(eventInserted, true);
});

test("RuntimeRecoveryDecisionService.apply handles cancel action with precheck_denied reason", () => {
  const db = createMockDb();
  let failureUpdated = false;
  const candidate = createMockCandidate({
    executionId: "exec-1",
    reason: "precheck_denied:budget_exceeded",
    suggestedAction: "cancel",
    latestPrecheck: {
      allowed: false,
      reasonCode: "budget_exceeded",
      resolvedBudgetUsd: 100,
      resolvedTimeoutMs: 60000,
      resolvedSandboxMode: "workspace",
      resolvedTools: [],
      resolvedPaths: [],
      checkedAt: new Date().toISOString(),
    },
  });
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1", lastErrorCode: null, lastErrorMessage: null }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    operations: {
      buildRuntimeRecoveryView: () => [candidate],
    },
    execution: {
      updateExecutionFailure: () => { failureUpdated = true; },
      insertDeadLetter: () => {},
      getExecutionPrecheck: () => null,
    },
    event: {
      insertEvent: () => {},
      listEventsForTask: () => [],
    },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  const result = service.apply("exec-1");

  assert.equal(result.applied, true);
  assert.equal(result.decision.action, "cancel");
  assert.equal(failureUpdated, true);
});

test("RuntimeRecoveryDecisionService.apply handles move_dead_letter action", () => {
  const db = createMockDb();
  let deadLetterInserted = false;
  const candidate = createMockCandidate({
    executionId: "exec-1",
    attempt: 2,
    latestErrorCode: "E1",
  });
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1", lastErrorCode: "E1", lastErrorMessage: "Execution failed", attempt: 2, agentId: "agent-1" }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    operations: {
      buildRuntimeRecoveryView: () => [candidate],
    },
    execution: {
      updateExecutionFailure: () => {},
      insertDeadLetter: () => { deadLetterInserted = true; },
      getExecutionPrecheck: () => null,
    },
    event: {
      insertEvent: () => {},
      listEventsForTask: () => [],
    },
    memory: {
      recordFailureMemory: () => {},
    },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  const result = service.apply("exec-1");

  assert.equal(result.applied, true);
  assert.ok(result.deadLetter != null);
  assert.equal(result.deadLetter!.executionId, "exec-1");
  assert.equal(result.deadLetter!.taskId, "task-1");
  assert.equal(result.decision.action, "move_dead_letter");
  assert.equal(deadLetterInserted, true);
});

test("RecoveryDecisionRecord has correct structure", () => {
  const record: RecoveryDecisionRecord = {
    decisionId: "rdec-1",
    executionId: "exec-1",
    taskId: "task-1",
    reason: "execution_error:E1",
    action: "cancel",
    decidedAt: "2026-04-24T00:00:00.000Z",
    decidedBy: "test_service",
  };

  assert.ok("decisionId" in record);
  assert.ok("executionId" in record);
  assert.ok("taskId" in record);
  assert.ok("reason" in record);
  assert.ok("action" in record);
  assert.ok("decidedAt" in record);
  assert.ok("decidedBy" in record);
});

test("RecoveryDecisionApplyResult has correct structure", () => {
  const record: RecoveryDecisionRecord = {
    decisionId: "rdec-1",
    executionId: "exec-1",
    taskId: "task-1",
    reason: "execution_error:E1",
    action: "move_dead_letter",
    decidedAt: "2026-04-24T00:00:00.000Z",
    decidedBy: "test_service",
  };

  const result: RecoveryDecisionApplyResult = {
    decision: record,
    deadLetter: null,
    applied: true,
  };

  assert.ok("decision" in result);
  assert.ok("deadLetter" in result);
  assert.ok("applied" in result);
});

test("RuntimeRecoveryDecisionService.decide records decision event", () => {
  const db = createMockDb();
  let eventInserted = false;
  const candidate = createMockCandidate({
    executionId: "exec-1",
    latestErrorCode: null,
    latestPrecheck: {
      allowed: false,
      reasonCode: "budget_exceeded",
      resolvedBudgetUsd: 100,
      resolvedTimeoutMs: 60000,
      resolvedSandboxMode: "workspace",
      resolvedTools: [],
      resolvedPaths: [],
      checkedAt: new Date().toISOString(),
    },
  });
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1" }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    operations: {
      buildRuntimeRecoveryView: () => [candidate],
    },
    event: {
      insertEvent: () => { eventInserted = true; },
      listEventsForTask: () => [],
    },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  service.decide("exec-1");

  assert.equal(eventInserted, true);
});

test("RuntimeRecoveryDecisionService.apply records decision and action events", () => {
  const db = createMockDb();
  const events: string[] = [];
  const candidate = createMockCandidate({
    executionId: "exec-1",
    latestErrorCode: null,
    latestPrecheck: {
      allowed: false,
      reasonCode: "budget_exceeded",
      resolvedBudgetUsd: 100,
      resolvedTimeoutMs: 60000,
      resolvedSandboxMode: "workspace",
      resolvedTools: [],
      resolvedPaths: [],
      checkedAt: new Date().toISOString(),
    },
  });
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1" }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    operations: {
      buildRuntimeRecoveryView: () => [candidate],
    },
    execution: {
      updateExecutionFailure: () => {},
      insertDeadLetter: () => {},
      getExecutionPrecheck: () => null,
    },
    event: {
      insertEvent: () => { events.push("event"); },
      listEventsForTask: () => [],
    },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  service.apply("exec-1");

  // Should have at least 2 events: decision_recorded and recovery:cancelled
  assert.ok(events.length >= 2);
});

test("RuntimeRecoveryDecisionService handles precheck denial as cancel action", () => {
  const db = createMockDb();
  const candidate = createMockCandidate({
    executionId: "exec-1",
    reason: "precheck_denied:tool_not_found",
    attempt: 2,
    latestErrorCode: null,
    latestPrecheck: {
      allowed: false,
      reasonCode: "tool_not_found",
      resolvedBudgetUsd: 50,
      resolvedTimeoutMs: 30000,
      resolvedSandboxMode: "workspace",
      resolvedTools: [],
      resolvedPaths: [],
      checkedAt: new Date().toISOString(),
    },
  });
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1", lastErrorCode: null, lastErrorMessage: null, attempt: 1, agentId: "agent-1" }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    operations: {
      buildRuntimeRecoveryView: () => [candidate],
    },
    execution: {
      updateExecutionFailure: () => {},
      insertDeadLetter: () => {},
      getExecutionPrecheck: () => null,
    },
    event: {
      insertEvent: () => {},
      listEventsForTask: () => [],
    },
    memory: {
      recordFailureMemory: () => {},
    },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  const result = service.apply("exec-1");

  assert.equal(result.applied, true);
  assert.equal(result.deadLetter, null);
  assert.equal(result.decision.action, "cancel");
});

test("RuntimeRecoveryDecisionService leaves active execution unapplied when no terminal recovery action is inferred", () => {
  const db = createMockDb();
  const candidate = createMockCandidate({
    executionId: "exec-1",
    latestErrorCode: null,
    latestPrecheck: null,
  });
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1", lastErrorCode: null, lastErrorMessage: null, attempt: 1, agentId: "agent-1" }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    operations: {
      buildRuntimeRecoveryView: () => [candidate],
    },
    execution: {
      updateExecutionFailure: () => {},
      insertDeadLetter: () => {},
      getExecutionPrecheck: () => null,
    },
    event: {
      insertEvent: () => {},
      listEventsForTask: () => [],
    },
    memory: {
      recordFailureMemory: () => {},
    },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  const result = service.apply("exec-1");

  assert.equal(result.applied, false);
  assert.equal(result.deadLetter, null);
  assert.equal(result.decision.action, "resume_same_worker");
});

test("RuntimeRecoveryDecisionService.apply throws when candidate not found", () => {
  const db = createMockDb();
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing" }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    operations: {
      buildRuntimeRecoveryView: () => [],
    },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  assert.throws(
    () => service.apply("exec-1"),
    (err: unknown) => (err as Error).message.includes("Recovery candidate not found"),
  );
});

test("RuntimeRecoveryDecisionService handles move_dead_letter with execution_error reason using lastErrorMessage", () => {
  const db = createMockDb();
  let failureUpdated = false;
  let lastErrorCode = "";
  let lastErrorMessage = "";
  const candidate = createMockCandidate({
    executionId: "exec-1",
    latestErrorCode: "E1",
    attempt: 2,
    latestPrecheck: null,
  });
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1", lastErrorCode: "E1", lastErrorMessage: "Original error message" }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    operations: {
      buildRuntimeRecoveryView: () => [candidate],
    },
    execution: {
      updateExecutionFailure: (input: { executionId: string; status: string; updatedAt: string; finishedAt: string | null; lastErrorCode: string | null; lastErrorMessage: string | null; }) => {
        failureUpdated = true;
        lastErrorCode = input.lastErrorCode ?? "";
        lastErrorMessage = input.lastErrorMessage ?? "";
      },
      insertDeadLetter: () => {},
      getExecutionPrecheck: () => null,
    },
    event: {
      insertEvent: () => {},
      listEventsForTask: () => [],
    },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  const result = service.apply("exec-1");

  assert.equal(result.applied, true);
  assert.equal(failureUpdated, true);
  assert.equal(lastErrorCode, "E1");
  assert.equal(lastErrorMessage, "Original error message");
  assert.equal(result.decision.action, "move_dead_letter");
});

test("RuntimeRecoveryDecisionService deadLetter contains retry count from execution", () => {
  const db = createMockDb();
  const candidate = createMockCandidate({
    executionId: "exec-1",
    attempt: 5,
    latestErrorCode: "E1",
  });
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1", lastErrorCode: "E1", lastErrorMessage: "Error", attempt: 5, agentId: "agent-1" }],
    tasks: [{ id: "task-1", status: "in_progress", divisionId: "division-1" }],
    operations: {
      buildRuntimeRecoveryView: () => [candidate],
    },
    execution: {
      updateExecutionFailure: () => {},
      insertDeadLetter: () => {},
      getExecutionPrecheck: () => null,
    },
    event: {
      insertEvent: () => {},
      listEventsForTask: () => [],
    },
    memory: {
      recordFailureMemory: () => {},
    },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  const result = service.apply("exec-1");

  assert.ok(result.deadLetter != null);
  assert.equal(result.deadLetter!.retryCount, 5);
});
