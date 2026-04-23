import assert from "node:assert/strict";
import test from "node:test";

import {
  RuntimeRecoveryDecisionService,
  type RecoveryDecisionRecord,
  type RecoveryDecisionApplyResult,
} from "../../../../../src/platform/execution/recovery/runtime-recovery-decision-service-root.js";
import type { RuntimeRecoveryCandidate, RecoverySuggestedAction } from "../../../../../src/platform/execution/recovery/runtime-recovery-service-root.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../../src/state-evidence/truth/authoritative-task-store.js";

// Mock database
function createMockDb() {
  return {
    transaction: (fn: () => void) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
}

// Mock store helper
function createMockStore(overrides: {
  executions?: Array<{ id: string; taskId: string; status: string; traceId: string; lastErrorCode?: string | null; lastErrorMessage?: string | null; attempt?: number; agentId?: string }>;
  tasks?: Array<{ id: string; status: string }>;
  events?: Array<{ id: string; taskId: string | null; executionId: string | null; eventType: string; payloadJson: string; eventTier: string; traceId: string | null; createdAt: string }>;
  recoveryView?: { candidates: RuntimeRecoveryCandidate[] };
} = {}) {
  return {
    dispatch: {
      getExecution: (id: string) => overrides.executions?.find((e) => e.id === id) ?? null,
    },
    task: {
      getTask: (id: string) => overrides.tasks?.find((t) => t.id === id) ?? null,
    },
    event: {
      insertEvent: () => {},
      listEventsForTask: () => overrides.events ?? [],
    },
    execution: {
      updateExecutionFailure: () => {},
      insertDeadLetter: () => {},
      getExecutionPrecheck: () => null,
    },
    operations: {
      buildRuntimeRecoveryView: () => overrides.recoveryView?.candidates ?? [],
    },
  } as unknown as AuthoritativeTaskStore;
}

test("RuntimeRecoveryDecisionService can be instantiated", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new RuntimeRecoveryDecisionService(db, store);

  assert.ok(service != null);
});

test("RuntimeRecoveryDecisionService.decide throws when execution not found", () => {
  const db = createMockDb();
  const store = createMockStore({ executions: [] });
  const service = new RuntimeRecoveryDecisionService(db, store);

  assert.throws(
    () => service.decide("nonexistent-exec"),
    (err: unknown) => (err as Error).message.includes("Execution not found"),
  );
});

test("RuntimeRecoveryDecisionService.decide throws when candidate not found", () => {
  const db = createMockDb();
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1" }],
    recoveryView: { candidates: [] }, // No candidates
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  assert.throws(
    () => service.decide("exec-1"),
    (err: unknown) => (err as Error).message.includes("Recovery candidate not found"),
  );
});

test("RuntimeRecoveryDecisionService.decide returns decision record", () => {
  const db = createMockDb();
  const candidate: RuntimeRecoveryCandidate = {
    executionId: "exec-1",
    taskId: "task-1",
    divisionId: null,
    taskStatus: "pending",
    status: "executing",
    attempt: 1,
    traceId: "trace-1",
    workflowId: null,
    latestErrorCode: null,
    updatedAt: new Date().toISOString(),
    lastHeartbeatAt: null,
    pendingApprovalId: null,
    latestPrecheck: null,
    reason: "active_execution",
    suggestedAction: "resume_same_worker",
  };
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1" }],
    recoveryView: { candidates: [candidate] },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  const decision = service.decide("exec-1");

  assert.ok(decision);
  assert.equal(decision.executionId, "exec-1");
  assert.equal(decision.taskId, "task-1");
  assert.equal(decision.action, "resume_same_worker");
  assert.equal(decision.reason, "active_execution");
  assert.ok(decision.decisionId);
  assert.ok(decision.decidedAt);
  assert.equal(decision.decidedBy, "runtime_recovery_decision_service");
});

test("RuntimeRecoveryDecisionService.decide uses custom decidedBy", () => {
  const db = createMockDb();
  const candidate: RuntimeRecoveryCandidate = {
    executionId: "exec-1",
    taskId: "task-1",
    divisionId: null,
    taskStatus: "pending",
    status: "executing",
    attempt: 1,
    traceId: "trace-1",
    workflowId: null,
    latestErrorCode: null,
    updatedAt: new Date().toISOString(),
    lastHeartbeatAt: null,
    pendingApprovalId: null,
    latestPrecheck: null,
    reason: "stale_execution",
    suggestedAction: "retry_new_ticket",
  };
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1" }],
    recoveryView: { candidates: [candidate] },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  const decision = service.decide("exec-1", "custom-service");

  assert.equal(decision.decidedBy, "custom-service");
});

test("RuntimeRecoveryDecisionService.apply throws when execution not found", () => {
  const db = createMockDb();
  const store = createMockStore({ executions: [] });
  const service = new RuntimeRecoveryDecisionService(db, store);

  assert.throws(
    () => service.apply("nonexistent-exec"),
    (err: unknown) => (err as Error).message.includes("Execution not found"),
  );
});

test("RuntimeRecoveryDecisionService.apply throws when candidate not found", () => {
  const db = createMockDb();
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1" }],
    recoveryView: { candidates: [] },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  assert.throws(
    () => service.apply("exec-1"),
    (err: unknown) => (err as Error).message.includes("Recovery candidate not found"),
  );
});

test("RuntimeRecoveryDecisionService.apply handles cancel action", () => {
  const db = createMockDb();
  const candidate: RuntimeRecoveryCandidate = {
    executionId: "exec-1",
    taskId: "task-1",
    divisionId: null,
    taskStatus: "pending",
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
    suggestedAction: "cancel",
  };
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1", lastErrorCode: "E1", lastErrorMessage: "error occurred" }],
    tasks: [{ id: "task-1", status: "pending" }],
    recoveryView: { candidates: [candidate] },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  const result = service.apply("exec-1");

  assert.ok(result);
  assert.equal(result.applied, true);
  assert.equal(result.decision.action, "cancel");
  assert.equal(result.deadLetter, null);
});

test("RuntimeRecoveryDecisionService.apply handles move_dead_letter action", () => {
  const db = createMockDb();
  const candidate: RuntimeRecoveryCandidate = {
    executionId: "exec-1",
    taskId: "task-1",
    divisionId: null,
    taskStatus: "pending",
    status: "executing",
    attempt: 2,
    traceId: "trace-1",
    workflowId: null,
    latestErrorCode: "E2",
    updatedAt: new Date().toISOString(),
    lastHeartbeatAt: null,
    pendingApprovalId: null,
    latestPrecheck: null,
    reason: "execution_error:E2",
    suggestedAction: "move_dead_letter",
  };
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1", lastErrorCode: "E2", lastErrorMessage: "failed" }],
    tasks: [{ id: "task-1", status: "pending" }],
    recoveryView: { candidates: [candidate] },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  const result = service.apply("exec-1");

  assert.ok(result);
  assert.equal(result.applied, true);
  assert.equal(result.decision.action, "move_dead_letter");
  assert.ok(result.deadLetter);
  assert.equal(result.deadLetter!.executionId, "exec-1");
  assert.equal(result.deadLetter!.taskId, "task-1");
});

test("RecoveryDecisionRecord has correct structure", () => {
  const db = createMockDb();
  const candidate: RuntimeRecoveryCandidate = {
    executionId: "exec-1",
    taskId: "task-1",
    divisionId: null,
    taskStatus: "pending",
    status: "executing",
    attempt: 1,
    traceId: "trace-1",
    workflowId: null,
    latestErrorCode: null,
    updatedAt: new Date().toISOString(),
    lastHeartbeatAt: null,
    pendingApprovalId: null,
    latestPrecheck: null,
    reason: "active_execution",
    suggestedAction: "none",
  };
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1" }],
    recoveryView: { candidates: [candidate] },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  const decision = service.decide("exec-1");

  assert.ok("decisionId" in decision);
  assert.ok("executionId" in decision);
  assert.ok("taskId" in decision);
  assert.ok("reason" in decision);
  assert.ok("action" in decision);
  assert.ok("decidedAt" in decision);
  assert.ok("decidedBy" in decision);
});

test("RecoveryDecisionApplyResult has correct structure", () => {
  const db = createMockDb();
  const candidate: RuntimeRecoveryCandidate = {
    executionId: "exec-1",
    taskId: "task-1",
    divisionId: null,
    taskStatus: "pending",
    status: "executing",
    attempt: 1,
    traceId: "trace-1",
    workflowId: null,
    latestErrorCode: null,
    updatedAt: new Date().toISOString(),
    lastHeartbeatAt: null,
    pendingApprovalId: null,
    latestPrecheck: null,
    reason: "stale_execution",
    suggestedAction: "retry_new_ticket",
  };
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1" }],
    tasks: [{ id: "task-1", status: "pending" }],
    recoveryView: { candidates: [candidate] },
  });
  const service = new RuntimeRecoveryDecisionService(db, store);

  const result = service.apply("exec-1");

  assert.ok("decision" in result);
  assert.ok("deadLetter" in result);
  assert.ok("applied" in result);
});

test("RuntimeRecoveryDecisionService.decide records decision event", () => {
  const db = createMockDb();
  const events: Array<{ id: string; taskId: string | null; executionId: string | null; eventType: string; payloadJson: string; eventTier: string; traceId: string | null; createdAt: string }> = [];
  const candidate: RuntimeRecoveryCandidate = {
    executionId: "exec-1",
    taskId: "task-1",
    divisionId: null,
    taskStatus: "pending",
    status: "executing",
    attempt: 1,
    traceId: "trace-1",
    workflowId: null,
    latestErrorCode: null,
    updatedAt: new Date().toISOString(),
    lastHeartbeatAt: null,
    pendingApprovalId: null,
    latestPrecheck: null,
    reason: "active_execution",
    suggestedAction: "resume_same_worker",
  };
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1" }],
    recoveryView: { candidates: [candidate] },
    events: [],
  });
  // Override event insert to capture events
  store.event = {
    ...store.event,
    insertEvent: (event: typeof events[0]) => events.push(event),
    listEventsForTask: () => events,
  };
  const service = new RuntimeRecoveryDecisionService(db, store);

  service.decide("exec-1");

  // Decision should have been recorded
  assert.equal(events.length, 1);
  assert.equal(events[0]!.eventType, "recovery:decision_recorded");
});

test("RuntimeRecoveryDecisionService.apply records decision and action events", () => {
  const db = createMockDb();
  const events: Array<{ id: string; taskId: string | null; executionId: string | null; eventType: string; payloadJson: string; eventTier: string; traceId: string | null; createdAt: string }> = [];
  const candidate: RuntimeRecoveryCandidate = {
    executionId: "exec-1",
    taskId: "task-1",
    divisionId: null,
    taskStatus: "pending",
    status: "executing",
    attempt: 1,
    traceId: "trace-1",
    workflowId: null,
    latestErrorCode: null,
    updatedAt: new Date().toISOString(),
    lastHeartbeatAt: null,
    pendingApprovalId: null,
    latestPrecheck: null,
    reason: "stale_execution",
    suggestedAction: "cancel",
  };
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1" }],
    tasks: [{ id: "task-1", status: "pending" }],
    recoveryView: { candidates: [candidate] },
  });
  // Override event insert to capture events
  store.event = {
    insertEvent: (event: typeof events[0]) => events.push(event),
    listEventsForTask: () => events,
  };
  const service = new RuntimeRecoveryDecisionService(db, store);

  service.apply("exec-1");

  // Should have at least the decision event
  assert.ok(events.length >= 1);
  assert.equal(events.some((e) => e.eventType === "recovery:decision_recorded"), true);
});
