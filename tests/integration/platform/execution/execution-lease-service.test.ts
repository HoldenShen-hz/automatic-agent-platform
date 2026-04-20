import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ExecutionLeaseService } from "../../../../src/platform/execution/lease/execution-lease-service.js";
import { WorkerRegistryService } from "../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

test("execution lease service grants, renews, releases, and increments fencing across failover", () => {
  const workspace = createTempWorkspace("aa-execution-lease-");
  const dbPath = join(workspace, "execution-lease.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-lease",
      executionId: "exec-lease",
      traceId: "trace-lease",
    });

    const granted = service.acquireLease({
      executionId: "exec-lease",
      workerId: "worker-a",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T10:00:00.000Z",
    });
    const renewed = service.renewLease({
      leaseId: granted.lease?.id ?? "",
      workerId: "worker-a",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T10:00:10.000Z",
    });
    const blocked = service.acquireLease({
      executionId: "exec-lease",
      workerId: "worker-b",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T10:00:20.000Z",
    });
    const released = service.releaseLease({
      leaseId: granted.lease?.id ?? "",
      workerId: "worker-a",
      reasonCode: "completed",
      occurredAt: "2026-04-03T10:00:30.000Z",
    });
    const nextGranted = service.acquireLease({
      executionId: "exec-lease",
      workerId: "worker-b",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T10:00:40.000Z",
    });
    const audits = store.listLeaseAudits("exec-lease");
    db.close();

    assert.equal(granted.outcome, "granted");
    assert.equal(granted.lease?.fencingToken, 1);
    assert.equal(renewed.outcome, "renewed");
    assert.equal(blocked.outcome, "blocked");
    assert.equal(blocked.reasonCode, "active_lease_exists");
    assert.equal(released.outcome, "released");
    assert.equal(nextGranted.outcome, "granted");
    assert.equal(nextGranted.lease?.fencingToken, 2);
    assert.ok(audits.some((audit) => audit.eventType === "lease_granted"));
    assert.ok(audits.some((audit) => audit.eventType === "lease_renewed"));
    assert.ok(audits.some((audit) => audit.eventType === "lease_released"));
  } finally {
    cleanupPath(workspace);
  }
});

test("execution lease service rejects stale writes after reclaim and records the audit event", () => {
  const workspace = createTempWorkspace("aa-execution-lease-");
  const dbPath = join(workspace, "execution-lease-fencing.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const workers = new WorkerRegistryService(store);
    seedTaskAndExecution(db, store, {
      taskId: "task-fencing",
      executionId: "exec-fencing",
      traceId: "trace-fencing",
    });
    workers.recordHeartbeat({
      workerId: "worker-a",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-fencing"],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-03T10:00:00.000Z",
    });

    const first = service.acquireLease({
      executionId: "exec-fencing",
      workerId: "worker-a",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T10:00:00.000Z",
    });
    const reclaimed = service.reclaimExpiredLeases("2026-04-03T10:01:00.000Z");
    const second = service.acquireLease({
      executionId: "exec-fencing",
      workerId: "worker-b",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T10:01:00.000Z",
    });
    const staleWrite = service.validateWriteAccess({
      executionId: "exec-fencing",
      workerId: "worker-a",
      fencingToken: first.lease?.fencingToken ?? 0,
      leaseId: first.lease?.id ?? null,
      occurredAt: "2026-04-03T10:01:05.000Z",
    });
    const currentWrite = service.validateWriteAccess({
      executionId: "exec-fencing",
      workerId: "worker-b",
      fencingToken: second.lease?.fencingToken ?? 0,
      leaseId: second.lease?.id ?? null,
      occurredAt: "2026-04-03T10:01:05.000Z",
    });
    const audits = store.listLeaseAudits("exec-fencing");
    const reclaimedWorker = store.getWorkerSnapshot("worker-a");
    db.close();

    assert.equal(first.outcome, "granted");
    assert.equal(reclaimed.length, 1);
    assert.equal(second.outcome, "granted");
    assert.equal(second.lease?.fencingToken, 2);
    assert.equal(staleWrite.allowed, false);
    assert.equal(staleWrite.reasonCode, "stale_fencing_token");
    assert.equal(currentWrite.allowed, true);
    assert.equal(reclaimedWorker?.runningExecutionsJson, "[]");
    assert.equal(reclaimedWorker?.status, "idle");
    assert.ok(audits.some((audit) => audit.eventType === "stale_write_rejected"));
    assert.ok(audits.some((audit) => audit.eventType === "lease_reclaimed"));
  } finally {
    cleanupPath(workspace);
  }
});

test("execution lease service handover transfers ownership, increments fencing, and records lineage", () => {
  const workspace = createTempWorkspace("aa-execution-lease-");
  const dbPath = join(workspace, "execution-lease-handover.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const workers = new WorkerRegistryService(store);
    seedTaskAndExecution(db, store, {
      taskId: "task-handover",
      executionId: "exec-handover",
      traceId: "trace-handover",
    });
    workers.recordHeartbeat({
      workerId: "worker-a",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-handover"],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T10:00:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-b",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T10:00:00.000Z",
    });

    const granted = service.acquireLease({
      executionId: "exec-handover",
      workerId: "worker-a",
      ttlMs: 30_000,
      occurredAt: "2026-04-06T10:00:00.000Z",
    });
    const handedOver = service.handoverLease({
      leaseId: granted.lease?.id ?? "",
      workerId: "worker-a",
      newWorkerId: "worker-b",
      ttlMs: 30_000,
      reasonCode: "worker_draining_handover",
      occurredAt: "2026-04-06T10:00:10.000Z",
    });
    const audits = store.listLeaseAudits("exec-handover");
    const events = store.listEventsForTask("task-handover");
    const execution = store.getExecution("exec-handover");
    const previousWorker = store.getWorkerSnapshot("worker-a");
    const nextWorker = store.getWorkerSnapshot("worker-b");
    db.close();

    assert.equal(granted.outcome, "granted");
    assert.equal(handedOver.outcome, "handed_over");
    assert.equal(handedOver.previousLease?.status, "released");
    assert.equal(handedOver.previousLease?.reasonCode, "worker_draining_handover");
    assert.equal(handedOver.lease?.workerId, "worker-b");
    assert.equal(handedOver.lease?.fencingToken, 2);
    assert.equal(execution?.agentId, "worker-b");
    assert.equal(previousWorker?.runningExecutionsJson, "[]");
    assert.ok(nextWorker?.runningExecutionsJson.includes("exec-handover"));
    assert.ok(audits.some((audit) => audit.eventType === "lease_handover"));
    assert.ok(
      audits.some(
        (audit) =>
          audit.eventType === "lease_released"
          && audit.reasonCode === "worker_draining_handover"
          && audit.workerId === "worker-a",
      ),
    );
    assert.ok(
      audits.some(
        (audit) =>
          audit.eventType === "lease_granted"
          && audit.reasonCode === "worker_draining_handover"
          && audit.workerId === "worker-b",
      ),
    );
    assert.ok(
      events.some((event) => {
        if (event.eventType !== "lease:handover_recorded") {
          return false;
        }
        const payload = JSON.parse(event.payloadJson) as {
          previousLeaseId?: string;
          leaseId?: string;
          previousWorkerId?: string;
          workerId?: string;
          lineage?: { transferKind?: string; sourceLeaseId?: string };
        };
        return (
          payload.previousLeaseId === granted.lease?.id
          && payload.leaseId === handedOver.lease?.id
          && payload.previousWorkerId === "worker-a"
          && payload.workerId === "worker-b"
          && payload.lineage?.transferKind === "handover"
          && payload.lineage?.sourceLeaseId === granted.lease?.id
        );
      }),
    );
  } finally {
    cleanupPath(workspace);
  }
});
