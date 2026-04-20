import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ExecutionDispatchService } from "../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import { ExecutionLeaseService } from "../../../../src/platform/execution/lease/execution-lease-service.js";
import { OrphanCleanupService } from "../../../../src/platform/execution/execution-engine/orphan-cleanup-service.js";
import { WorkerRegistryService } from "../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

test("orphan cleanup service closes orphan sessions, requeues orphan claims, and prunes worker execution refs", () => {
  const workspace = createTempWorkspace("aa-orphan-cleanup-");
  const dbPath = join(workspace, "orphan-cleanup.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const leases = new ExecutionLeaseService(db, store);
    const cleanup = new OrphanCleanupService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-orphan-cleanup",
      executionId: "exec-orphan-cleanup",
      traceId: "trace-orphan-cleanup",
    });
    seedTaskAndExecution(db, store, {
      taskId: "task-worker-valid-int",
      executionId: "exec-worker-valid-int",
      traceId: "trace-worker-valid-int",
    });
    seedTaskAndExecution(db, store, {
      taskId: "task-worker-terminal-int",
      executionId: "exec-worker-terminal-int",
      traceId: "trace-worker-terminal-int",
    });
    db.connection.prepare(`UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?`).run(
      "done",
      "2026-04-07T13:00:01.000Z",
      "task-orphan-cleanup",
    );
    store.insertSession({
      id: "sess-orphan-cleanup",
      taskId: "task-orphan-cleanup",
      channel: "cli",
      status: "open",
      externalSessionId: null,
      createdAt: "2026-04-07T13:00:00.000Z",
      updatedAt: "2026-04-07T13:00:00.000Z",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-orphan-cleanup");
    workers.recordHeartbeat({
      workerId: "worker-orphan-cleanup",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-orphan-cleanup", "exec-worker-valid-int", "exec-worker-terminal-int", "exec-missing-int"],
      activeLeaseCount: 4,
      maxConcurrency: 5,
      queueAffinity: "default",
      occurredAt: "2026-04-07T13:00:02.000Z",
    });
    db.transaction(() => {
      store.insertExecutionLease({
        id: "lease-worker-valid-int",
        executionId: "exec-worker-valid-int",
        workerId: "worker-orphan-cleanup",
        attempt: 1,
        fencingToken: 1,
        queueName: "default",
        status: "active",
        leasedAt: "2026-04-07T13:00:02.000Z",
        expiresAt: "2026-04-07T13:10:00.000Z",
        lastHeartbeatAt: "2026-04-07T13:00:02.000Z",
        releasedAt: null,
        reasonCode: null,
      });
    });
    store.updateExecutionStatus(
      "exec-worker-terminal-int",
      "failed",
      "2026-04-07T13:00:03.000Z",
      null,
      "2026-04-07T13:00:03.000Z",
      "tool_failed",
    );

    const created = dispatch.createTicket({
      executionId: "exec-orphan-cleanup",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-07T13:00:04.000Z",
    });
    const claimed = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-07T13:00:05.000Z",
    });
    leases.releaseLease({
      leaseId: claimed.leaseId ?? "",
      workerId: "worker-orphan-cleanup",
      reasonCode: "test.seed",
      occurredAt: "2026-04-07T13:00:06.000Z",
    });

    const preview = cleanup.preview("2026-04-07T13:00:07.000Z");
    const report = cleanup.enforce("2026-04-07T13:00:08.000Z");
    const session = store.getSession("sess-orphan-cleanup");
    const tickets = store.listExecutionTicketsByExecution("exec-orphan-cleanup");
    const worker = store.getWorkerSnapshot("worker-orphan-cleanup");
    const taskEvents = store.listEventsForTask("task-orphan-cleanup");
    db.close();

    assert.ok(preview.issues.some((issue) => issue.issueType === "orphan_session" && issue.entityId === "sess-orphan-cleanup"));
    assert.ok(preview.issues.some((issue) => issue.issueType === "orphan_queue_claim" && issue.entityId === created.ticket.id));
    assert.ok(preview.issues.some((issue) => issue.issueType === "worker_execution_reference_orphan" && issue.entityId === "worker-orphan-cleanup"));
    assert.ok(report.applied?.some((item) => item.action === "close_orphan_session" && item.applied));
    assert.ok(report.applied?.some((item) => item.action === "requeue_ticket" && item.applied));
    assert.ok(report.applied?.some((item) => item.action === "clean_worker_execution_refs" && item.applied));
    assert.equal(session?.status, "completed");
    assert.equal(tickets.length, 2);
    assert.equal(tickets[0]?.id, created.ticket.id);
    assert.equal(tickets[0]?.status, "expired");
    assert.equal(tickets[1]?.status, "pending");
    assert.equal(worker?.runningExecutionsJson, JSON.stringify(["exec-worker-valid-int"]));
    assert.equal(worker?.activeLeaseCount, 1);
    assert.ok(taskEvents.some((event) => event.eventType === "maintenance:orphan_cleanup_applied"));
    assert.ok(taskEvents.some((event) => event.eventType === "dispatch:ticket_requeued"));
  } finally {
    cleanupPath(workspace);
  }
});
