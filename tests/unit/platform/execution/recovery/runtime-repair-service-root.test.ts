import assert from "node:assert/strict";
import test from "node:test";

import {
  RuntimeRepairService,
  type RepairExecutionResult,
} from "../../../../../src/platform/five-plane-execution/recovery/runtime-repair-service-root.js";
import type { RepairAction, StartupConsistencyReport } from "../../../../../src/platform/five-plane-execution/startup/startup-consistency-checker.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

// Mock database
function createMockDb() {
  return {
    transaction: (fn: () => void) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
}

// Mock store helper
function createMockStore(overrides: {
  executions?: Array<{ id: string; taskId: string; status: string; attempt?: number }>;
  sessions?: Array<{ id: string; taskId: string; status: string }>;
  tasks?: Array<{ id: string; status: string; priority?: string }>;
  events?: Array<{ id: string }>;
  locks?: { deleteFileLock?: () => void };
  workflow?: { updateWorkflowRecoveryState?: () => void; loadTaskSnapshot?: () => { task: { id: string; status: string }; execution: { id: string; status: string } | null; workflow: { status: string; currentStepIndex?: number; outputsJson?: string; resumableFromStep?: number; retryCount?: number; lastErrorCode?: string | null } | null; session: { id: string; status: string; channel?: string; externalSessionId?: string } | null } };
  task?: { setTaskState?: () => void; getTask?: (id: string) => { id: string; status: string; priority?: string } | null };
  execution?: { updateExecutionStatus?: () => void };
  session?: { updateSessionStatus?: () => void; insertSession?: () => void };
  dispatch?: { getExecution?: (id: string) => { id: string; taskId: string; status: string; attempt?: number } | null; getSession?: (id: string) => { id: string; taskId: string; status: string } | null };
  event?: { insertEvent?: () => void; getEvent?: (id: string) => { id: string; eventType: string; eventTier: string } | null; countPendingTier1Acks?: () => number; ensureEventConsumerAckPending?: () => void; listFailedEventsForConsumer?: () => unknown[]; listPendingEventsForConsumer?: () => unknown[] };
  worker?: { getActiveExecutionTicket?: () => { id: string; status: string; attempt?: number } | null; listExecutionTicketsByExecution?: () => Array<{ id: string; attempt: number }>; getExecutionTicket?: () => null };
} = {}) {
  return {
    dispatch: {
      getExecution: overrides.dispatch?.getExecution ?? ((id: string) => overrides.executions?.find((e) => e.id === id) ?? null),
      getSession: overrides.dispatch?.getSession ?? ((id: string) => overrides.sessions?.find((s) => s.id === id) ?? null),
    },
    task: {
      getTask: overrides.task?.getTask ?? ((id: string) => overrides.tasks?.find((t) => t.id === id) ?? null),
      setTaskState: overrides.task?.setTaskState ?? (() => {}),
    },
    event: {
      insertEvent: overrides.event?.insertEvent ?? (() => {}),
      getEvent: overrides.event?.getEvent ?? (() => null),
      countPendingTier1Acks: overrides.event?.countPendingTier1Acks ?? (() => 0),
      ensureEventConsumerAckPending: overrides.event?.ensureEventConsumerAckPending ?? (() => {}),
      listFailedEventsForConsumer: overrides.event?.listFailedEventsForConsumer ?? (() => []),
      listPendingEventsForConsumer: overrides.event?.listPendingEventsForConsumer ?? (() => []),
    },
    execution: {
      updateExecutionStatus: overrides.execution?.updateExecutionStatus ?? (() => {}),
    },
    session: {
      updateSessionStatus: overrides.session?.updateSessionStatus ?? (() => {}),
      insertSession: overrides.session?.insertSession ?? (() => {}),
    },
    lock: {
      deleteFileLock: overrides.locks?.deleteFileLock ?? (() => {}),
    },
    workflow: {
      updateWorkflowRecoveryState: overrides.workflow?.updateWorkflowRecoveryState ?? (() => {}),
    },
    operations: {
      loadTaskSnapshot: overrides.workflow?.loadTaskSnapshot ?? (() => ({
        task: { id: "task-1", status: "pending" },
        execution: null,
        workflow: null,
        session: null,
      })),
    },
    worker: {
      getActiveExecutionTicket: overrides.worker?.getActiveExecutionTicket ?? (() => null),
      listExecutionTicketsByExecution: overrides.worker?.listExecutionTicketsByExecution ?? (() => []),
      getExecutionTicket: overrides.worker?.getExecutionTicket ?? (() => null),
      getActiveExecutionLease: () => null,
      closeExecutionLease: () => {},
      insertLeaseAudit: () => {},
      getExecutionLease: () => null,
      getWorkerSnapshot: () => null,
    },
  } as unknown as AuthoritativeTaskStore;
}

test("RuntimeRepairService can be instantiated", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new RuntimeRepairService(db, store);

  assert.ok(service != null);
});

test("RuntimeRepairService.apply handles empty repair actions", async () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new RuntimeRepairService(db, store);

  const report: StartupConsistencyReport = {
    taskId: "task-1",
    generatedAt: new Date().toISOString(),
    repairActions: [],
  };

  const results = await service.apply(report);

  assert.deepEqual(results, []);
});

test("RepairExecutionResult has correct structure", () => {
  const result: RepairExecutionResult = {
    action: "requeue_execution",
    targetId: "exec-1",
    applied: true,
    detail: "execution requeued",
  };

  assert.ok("action" in result);
  assert.ok("targetId" in result);
  assert.ok("applied" in result);
  assert.ok("detail" in result);
});

test("RuntimeRepairService.apply returns manual_intervention_required when action is manual_intervention", async () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new RuntimeRepairService(db, store);

  const report: StartupConsistencyReport = {
    taskId: "task-1",
    generatedAt: new Date().toISOString(),
    repairActions: [
      {
        action: "manual_intervention_required",
        targetId: "exec-1",
        reason: "complex failure",
      },
    ],
  };

  const results = await service.apply(report);

  assert.equal(results.length, 1);
  assert.equal(results[0]!.action, "manual_intervention_required");
  assert.equal(results[0]!.applied, false);
  assert.equal(results[0]!.detail, "manual intervention required");
});

test("RuntimeRepairService.apply handles requeue_execution with pending ticket", async () => {
  const db = createMockDb();
  let executionUpdated = false;
  let taskUpdated = false;
  const store = createMockStore({
    executions: [{ id: "exec-1", taskId: "task-1", status: "failed", attempt: 1 }],
    tasks: [{ id: "task-1", status: "failed", priority: "normal" }],
    execution: {
      updateExecutionStatus: () => { executionUpdated = true; },
    },
    task: {
      getTask: (id: string) => ({ id, status: "failed", priority: "normal" }),
      setTaskState: () => { taskUpdated = true; },
    },
    worker: {
      getActiveExecutionTicket: () => ({ id: "ticket-1", status: "pending", attempt: 1 }),
      listExecutionTicketsByExecution: () => [],
      getExecutionTicket: () => null,
    },
  });
  const service = new RuntimeRepairService(db, store);

  const results = await service.apply({
    taskId: "task-1",
    generatedAt: new Date().toISOString(),
    repairActions: [{ action: "requeue_execution", targetId: "exec-1", reason: "stale execution" }],
  });

  assert.equal(results[0]!.action, "requeue_execution");
  assert.equal(results[0]!.applied, true);
  assert.equal(results[0]!.detail, "execution requeued");
  assert.equal(executionUpdated, true);
  assert.equal(taskUpdated, true);
});

test("RuntimeRepairService.apply handles reconcile_dispatch_ticket when ticket missing", async () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new RuntimeRepairService(db, store);

  const results = await service.apply({
    taskId: "task-1",
    generatedAt: new Date().toISOString(),
    repairActions: [{ action: "reconcile_dispatch_ticket", targetId: "ticket-1", reason: "missing ticket" }],
  });

  assert.equal(results[0]!.action, "reconcile_dispatch_ticket");
  assert.equal(results[0]!.applied, false);
  assert.equal(results[0]!.detail, "dispatch ticket already healthy or missing");
});

test("RuntimeRepairService.apply handles reconcile_terminal_state when workflow missing", async () => {
  const db = createMockDb();
  const store = createMockStore({
    workflow: {
      loadTaskSnapshot: () => ({
        task: { id: "task-1", status: "pending" },
        execution: null,
        workflow: null,
        session: null,
      }),
    },
  });
  const service = new RuntimeRepairService(db, store);

  const results = await service.apply({
    taskId: "task-1",
    generatedAt: new Date().toISOString(),
    repairActions: [{ action: "reconcile_terminal_state", targetId: "task-1", reason: "workflow missing" }],
  });

  assert.equal(results[0]!.applied, false);
  assert.equal(results[0]!.detail, "workflow missing");
});

test("RuntimeRepairService.apply handles close_orphan_session", async () => {
  const db = createMockDb();
  let sessionUpdated = false;
  const store = createMockStore({
    sessions: [{ id: "sess-1", taskId: "task-1", status: "open" }],
    session: {
      updateSessionStatus: () => { sessionUpdated = true; },
      insertSession: () => {},
    },
  });
  const service = new RuntimeRepairService(db, store);

  const results = await service.apply({
    taskId: "task-1",
    generatedAt: new Date().toISOString(),
    repairActions: [{ action: "close_orphan_session", targetId: "sess-1", reason: "orphan session" }],
  });

  assert.equal(results[0]!.applied, true);
  assert.equal(results[0]!.detail, "orphan session closed");
  assert.equal(sessionUpdated, true);
});

test("RuntimeRepairService.apply handles replace_terminal_session", async () => {
  const db = createMockDb();
  let inserted = false;
  const store = createMockStore({
    sessions: [{ id: "sess-1", taskId: "task-1", status: "completed" }],
    tasks: [{ id: "task-1", status: "in_progress", priority: "normal" }],
    workflow: {
      loadTaskSnapshot: () => ({
        task: { id: "task-1", status: "in_progress" },
        execution: null,
        workflow: null,
        session: { id: "sess-1", taskId: "task-1", status: "completed", channel: "chat", externalSessionId: "ext-1" },
      }),
    },
    session: {
      updateSessionStatus: () => {},
      insertSession: () => { inserted = true; },
    },
  });
  const service = new RuntimeRepairService(db, store);

  const results = await service.apply({
    taskId: "task-1",
    generatedAt: new Date().toISOString(),
    repairActions: [{ action: "replace_terminal_session", targetId: "sess-1", reason: "replace session" }],
  });

  assert.equal(results[0]!.applied, true);
  assert.match(results[0]!.detail, /replacement session created:/);
  assert.equal(inserted, true);
});

test("RuntimeRepairService.apply handles release_stale_lock", async () => {
  const db = createMockDb();
  let lockDeleted = false;
  const store = createMockStore({
    locks: {
      deleteFileLock: () => {
        lockDeleted = true;
      },
    },
  });
  const service = new RuntimeRepairService(db, store);

  const report: StartupConsistencyReport = {
    taskId: "task-1",
    generatedAt: new Date().toISOString(),
    repairActions: [
      {
        action: "release_stale_lock",
        targetId: "lock-1",
        reason: "stale lock found",
      },
    ],
  };

  const results = await service.apply(report);

  assert.equal(results.length, 1);
  assert.equal(results[0]!.action, "release_stale_lock");
  assert.equal(results[0]!.applied, true);
  assert.equal(results[0]!.detail, "stale lock released");
  assert.equal(lockDeleted, true);
});

test("RuntimeRepairService.apply handles rebuild_ack for missing event without draining changes", async () => {
  const db = createMockDb();
  const store = createMockStore({
    event: {
      getEvent: () => null,
      insertEvent: () => {},
      countPendingTier1Acks: () => 0,
      ensureEventConsumerAckPending: () => {},
      listFailedEventsForConsumer: () => [],
      listPendingEventsForConsumer: () => [],
    },
  });
  const service = new RuntimeRepairService(db, store);

  const results = await service.apply({
    taskId: "task-1",
    generatedAt: new Date().toISOString(),
    repairActions: [{ action: "rebuild_ack", targetId: "evt-1", reason: "missing ack" }],
  });

  assert.equal(results[0]!.applied, false);
  assert.equal(results[0]!.detail, "pending acknowledgements drained from 0 to 0");
});

test("RuntimeRepairService applies multiple repair actions in sequence", async () => {
  const db = createMockDb();
  const store = createMockStore({
    locks: {
      deleteFileLock: () => {},
    },
  });
  const service = new RuntimeRepairService(db, store);

  const report: StartupConsistencyReport = {
    taskId: "task-1",
    generatedAt: new Date().toISOString(),
    repairActions: [
      {
        action: "manual_intervention_required",
        targetId: "exec-1",
        reason: "complex failure",
      },
      {
        action: "release_stale_lock",
        targetId: "lock-1",
        reason: "stale lock",
      },
    ],
  };

  const results = await service.apply(report);

  assert.equal(results.length, 2);
  assert.equal(results[0]!.action, "manual_intervention_required");
  assert.equal(results[1]!.action, "release_stale_lock");
});
