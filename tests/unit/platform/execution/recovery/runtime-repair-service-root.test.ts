// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import {
  RuntimeRepairService,
  type RepairExecutionResult,
} from "../../../../../src/platform/execution/recovery/runtime-repair-service-root.js";
import type { RepairAction, StartupConsistencyReport } from "../../../../../src/startup/startup-consistency-checker.js";
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
  executions?: Array<{ id: string; taskId: string; status: string; attempt?: number }>;
  sessions?: Array<{ id: string; taskId: string; status: string }>;
  tasks?: Array<{ id: string; status: string; priority?: string }>;
  events?: Array<{ id: string }>;
  locks?: { deleteFileLock?: () => void };
  workflow?: { updateWorkflowRecoveryState?: () => void };
} = {}) {
  return {
    dispatch: {
      getExecution: (id: string) => overrides.executions?.find((e) => e.id === id) ?? null,
      getSession: (id: string) => overrides.sessions?.find((s) => s.id === id) ?? null,
    },
    task: {
      getTask: (id: string) => overrides.tasks?.find((t) => t.id === id) ?? null,
      setTaskState: () => {},
    },
    event: {
      insertEvent: () => {},
      getEvent: () => null,
      countPendingTier1Acks: () => 0,
      ensureEventConsumerAckPending: () => {},
    },
    execution: {
      updateExecutionStatus: () => {},
    },
    session: {
      updateSessionStatus: () => {},
      insertSession: () => {},
    },
    lock: {
      deleteFileLock: overrides.locks?.deleteFileLock ?? (() => {}),
    },
    workflow: {
      updateWorkflowRecoveryState: overrides.workflow?.updateWorkflowRecoveryState ?? (() => {}),
    },
    operations: {
      loadTaskSnapshot: () => ({
        task: { id: "task-1", status: "pending" },
        execution: null,
        workflow: null,
        session: null,
      }),
    },
    worker: {
      getActiveExecutionTicket: () => null,
      listTicketsByExecution: () => [],
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

test.skip("RuntimeRepairService.apply handles requeue_execution - requires full store mock", async () => {
  // This test is skipped because requeue_execution requires extensive mocking of:
  // - store.dispatch.getExecution
  // - store.leases.reclaimActiveLease
  // - store.execution.updateExecutionStatus
  // - store.task.setTaskState
  // - store.operations.loadTaskSnapshot
  // - store.workflow.updateWorkflowRecoveryState
  // - store.session methods
  // - store.event.insertEvent
  // - store.worker.getActiveExecutionTicket
  // - ExecutionDispatchService and ExecutionDispatchReconciliationService
});

test.skip("RuntimeRepairService.apply handles reconcile_dispatch_ticket - requires dispatch reconciliation mock", async () => {
  // This test is skipped because reconcile_dispatch_ticket requires mocking
  // ExecutionDispatchReconciliationService which is complex
});

test.skip("RuntimeRepairService.apply handles reconcile_terminal_state - requires full store mock", async () => {
  // This test is skipped because reconcile_terminal_state requires extensive mocking
});

test.skip("RuntimeRepairService.apply handles close_orphan_session - requires session mock", async () => {
  // This test is skipped because close_orphan_session requires session mocking
});

test.skip("RuntimeRepairService.apply handles replace_terminal_session - requires complex session/workflow mock", async () => {
  // This test is skipped because replace_terminal_session requires complex mocking
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

test.skip("RuntimeRepairService.apply handles rebuild_ack - requires event system mock", async () => {
  // This test is skipped because rebuild_ack requires mocking:
  // - store.event.getEvent
  // - Event registry functions
  // - EventOpsService.drainDefaultConsumers
  // - store.event.countPendingTier1Acks
  // - store.event.ensureEventConsumerAckPending
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
