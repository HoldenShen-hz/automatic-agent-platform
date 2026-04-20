import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ExecutionDispatchService } from "../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import { ExecutionDispatchReconciliationService } from "../../../../src/platform/execution/dispatcher/execution-dispatch-reconciliation-service.js";
import { ExecutionLeaseService } from "../../../../src/platform/execution/lease/execution-lease-service.js";
import { WorkerRegistryService } from "../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

test("execution dispatch reconciliation service requeues claimed tickets that lost their active lease", () => {
  const workspace = createTempWorkspace("aa-dispatch-reconcile-");
  const dbPath = join(workspace, "dispatch-reconcile-orphan.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const leases = new ExecutionLeaseService(db, store);
    const reconcile = new ExecutionDispatchReconciliationService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-reconcile",
      executionId: "exec-dispatch-reconcile",
      traceId: "trace-dispatch-reconcile",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-reconcile");
    workers.recordHeartbeat({
      workerId: "worker-dispatch-reconcile",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T14:00:00.000Z",
    });

    const created = dispatch.createTicket({
      executionId: "exec-dispatch-reconcile",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T14:00:05.000Z",
    });
    const claimed = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T14:00:06.000Z",
    });
    leases.releaseLease({
      leaseId: claimed.leaseId ?? "",
      workerId: "worker-dispatch-reconcile",
      reasonCode: "test.seed",
      occurredAt: "2026-04-04T14:00:07.000Z",
    });

    const issues = reconcile.scan("2026-04-04T14:00:08.000Z");
    const repaired = reconcile.repair("2026-04-04T14:00:08.000Z");
    const tickets = store.listExecutionTicketsByExecution("exec-dispatch-reconcile");
    const events = store.listEventsForTask("task-dispatch-reconcile");
    db.close();

    assert.ok(issues.some((issue) => issue.issueType === "orphan_queue_claim"));
    assert.ok(repaired.applied.some((item) => item.applied && item.replacementTicketId != null));
    assert.equal(tickets.length, 2);
    assert.equal(tickets[0]?.id, created.ticket.id);
    assert.equal(tickets[0]?.status, "expired");
    assert.equal(tickets[1]?.status, "pending");
    assert.ok(events.some((event) => event.eventType === "dispatch:ticket_reconciled"));
    assert.ok(events.some((event) => event.eventType === "dispatch:ticket_requeued"));
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch reconciliation service cancels pending tickets that point at terminal executions", () => {
  const workspace = createTempWorkspace("aa-dispatch-reconcile-");
  const dbPath = join(workspace, "dispatch-reconcile-terminal.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const dispatch = new ExecutionDispatchService(db, store);
    const reconcile = new ExecutionDispatchReconciliationService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-terminal",
      executionId: "exec-dispatch-terminal",
      traceId: "trace-dispatch-terminal",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-terminal");
    const created = dispatch.createTicket({
      executionId: "exec-dispatch-terminal",
      queueName: "default",
      occurredAt: "2026-04-04T14:10:05.000Z",
    });
    store.updateExecutionStatus(
      "exec-dispatch-terminal",
      "succeeded",
      "2026-04-04T14:10:06.000Z",
      null,
      "2026-04-04T14:10:06.000Z",
      null,
    );

    const issues = reconcile.scan("2026-04-04T14:10:07.000Z");
    const repaired = reconcile.repair("2026-04-04T14:10:07.000Z");
    const ticket = store.getExecutionTicket(created.ticket.id);
    db.close();

    assert.ok(issues.some((issue) => issue.issueType === "terminal_execution_ticket"));
    assert.ok(repaired.applied.some((item) => item.applied && item.resolutionAction === "invalidate_ticket"));
    assert.equal(ticket?.status, "cancelled");
  } finally {
    cleanupPath(workspace);
  }
});
