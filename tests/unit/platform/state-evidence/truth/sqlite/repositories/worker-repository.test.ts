import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { WorkerRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/worker-repository.js";
import { SqliteDatabase } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../../helpers/fs.js";

test("WorkerRepository can be instantiated with mock connection", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  assert.ok(repo);
});

test("WorkerRepository has all required worker snapshot methods", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  // Worker snapshot methods
  assert.equal(typeof repo.insertHeartbeatSnapshot, "function");
  assert.equal(typeof repo.upsertWorkerSnapshot, "function");
  assert.equal(typeof repo.upsertCoordinatorInstanceSnapshot, "function");
  assert.equal(typeof repo.getWorkerSnapshot, "function");
  assert.equal(typeof repo.listWorkerSnapshots, "function");
  assert.equal(typeof repo.listStaleWorkerSnapshots, "function");
  assert.equal(typeof repo.getCoordinatorInstanceSnapshot, "function");
  assert.equal(typeof repo.listCoordinatorInstanceSnapshots, "function");
  assert.equal(typeof repo.listHeartbeatSnapshotsByExecution, "function");
});

test("WorkerRepository has all required execution methods", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  // Remote log methods
  assert.equal(typeof repo.insertRemoteLog, "function");
  assert.equal(typeof repo.listRemoteLogsByTask, "function");
  assert.equal(typeof repo.listRemoteLogsByExecution, "function");

  // Agent execution methods
  assert.equal(typeof repo.upsertAgentExecutionRecord, "function");
  assert.equal(typeof repo.getAgentExecutionRecord, "function");
  assert.equal(typeof repo.listAgentExecutionRecordsByTask, "function");
});

test("WorkerRepository has all required ticket and lease methods", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  // Registration challenge methods
  assert.equal(typeof repo.insertWorkerRegistrationChallenge, "function");
  assert.equal(typeof repo.getWorkerRegistrationChallenge, "function");
  assert.equal(typeof repo.consumeWorkerRegistrationChallenge, "function");

  // Execution ticket methods
  assert.equal(typeof repo.insertExecutionTicket, "function");
  assert.equal(typeof repo.claimExecutionTicket, "function");
  assert.equal(typeof repo.consumeExecutionTicket, "function");
  assert.equal(typeof repo.invalidateExecutionTicket, "function");
  assert.equal(typeof repo.listPendingExecutionTickets, "function");
  assert.equal(typeof repo.getExecutionTicket, "function");
  assert.equal(typeof repo.getActiveExecutionTicket, "function");
  assert.equal(typeof repo.listExecutionTicketsByExecution, "function");
  assert.equal(typeof repo.listExecutionTicketsByStatuses, "function");
  assert.equal(typeof repo.listDispatchableExecutionTickets, "function");

  // Lease methods
  assert.equal(typeof repo.insertExecutionLease, "function");
  assert.equal(typeof repo.renewExecutionLease, "function");
  assert.equal(typeof repo.closeExecutionLease, "function");
  assert.equal(typeof repo.insertLeaseAudit, "function");
  assert.equal(typeof repo.getExecutionLease, "function");
  assert.equal(typeof repo.getActiveExecutionLease, "function");
  assert.equal(typeof repo.getLatestExecutionLease, "function");
  assert.equal(typeof repo.listExecutionLeases, "function");
  assert.equal(typeof repo.listLeasesByExecution, "function");
  assert.equal(typeof repo.listLeasesByWorker, "function");
  assert.equal(typeof repo.listExecutionLeasesByStatuses, "function");
  assert.equal(typeof repo.listExpiredExecutionLeases, "function");
  assert.equal(typeof repo.getLatestFencingToken, "function");
});

test("WorkerRepository insertHeartbeatSnapshot does not throw", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  assert.doesNotThrow(() => {
    repo.insertHeartbeatSnapshot({
      snapshotId: "hb-001",
      executionId: "exec-001",
      workerId: "worker-001",
      tenantId: null,
      sampledAt: "2026-04-27T10:00:00.000Z",
      sampleIntervalMs: 5000,
      cpuUsagePercent: 45.5,
      memoryUsageMb: 1024,
      diskUsageMb: 2048,
      networkRxBytesPerSec: 102400,
      networkTxBytesPerSec: 51200,
    });
  });
});

test("WorkerRepository upsertWorkerSnapshot does not throw", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  assert.doesNotThrow(() => {
    repo.upsertWorkerSnapshot({
      workerId: "worker-001",
      registeredAt: "2026-04-27T10:00:00.000Z",
      lastHeartbeatAt: "2026-04-27T10:00:00.000Z",
      status: "active",
      pool: "default",
      priority: 0,
      labelsJson: null,
      currentTaskId: null,
      currentExecutionId: null,
      version: 1,
    });
  });
});

test("WorkerRepository getWorkerSnapshot returns undefined for non-existent worker", () => {
  const mockConn = {
    prepare: () => ({
      get: () => undefined,
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.getWorkerSnapshot("non-existent-worker");
  assert.equal(result, undefined);
});

test("WorkerRepository listWorkerSnapshots returns empty array", () => {
  const mockConn = {
    prepare: () => ({
      all: () => [],
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.listWorkerSnapshots();
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

test("WorkerRepository listStaleWorkerSnapshots returns empty array", () => {
  const mockConn = {
    prepare: () => ({
      all: () => [],
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.listStaleWorkerSnapshots("2026-04-01T00:00:00.000Z");
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

test("WorkerRepository insertRemoteLog does not throw", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  assert.doesNotThrow(() => {
    repo.insertRemoteLog({
      logId: "log-001",
      executionId: "exec-001",
      taskId: "task-001",
      tenantId: null,
      agentId: null,
      level: "info",
      message: "Test log message",
      timestamp: "2026-04-27T10:00:00.000Z",
      metadataJson: null,
    });
  });
});

test("WorkerRepository upsertAgentExecutionRecord does not throw", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  assert.doesNotThrow(() => {
    repo.upsertAgentExecutionRecord({
      executionId: "exec-001",
      taskId: "task-001",
      tenantId: null,
      agentId: "agent-001",
      status: "executing",
      createdAt: "2026-04-27T10:00:00.000Z",
      updatedAt: "2026-04-27T10:00:00.000Z",
    });
  });
});

test("WorkerRepository getAgentExecutionRecord returns undefined for non-existent execution", () => {
  const mockConn = {
    prepare: () => ({
      get: () => undefined,
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.getAgentExecutionRecord("non-existent-exec", null);
  assert.equal(result, undefined);
});

test("WorkerRepository listAgentExecutionRecordsByTask returns empty array", () => {
  const mockConn = {
    prepare: () => ({
      all: () => [],
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.listAgentExecutionRecordsByTask("task-001", null);
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

test("WorkerRepository insertWorkerRegistrationChallenge does not throw", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  assert.doesNotThrow(() => {
    repo.insertWorkerRegistrationChallenge({
      challengeId: "challenge-001",
      workerId: "worker-001",
      challenge: "test-challenge",
      expiresAt: "2026-04-28T10:00:00.000Z",
      createdAt: "2026-04-27T10:00:00.000Z",
      consumedAt: null,
    });
  });
});

test("WorkerRepository getWorkerRegistrationChallenge returns undefined for non-existent challenge", () => {
  const mockConn = {
    prepare: () => ({
      get: () => undefined,
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.getWorkerRegistrationChallenge("non-existent-challenge");
  assert.equal(result, undefined);
});

test("WorkerRepository consumeWorkerRegistrationChallenge does not throw", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  assert.doesNotThrow(() => {
    repo.consumeWorkerRegistrationChallenge("challenge-001", "2026-04-27T12:00:00.000Z");
  });
});

test("WorkerRepository insertExecutionTicket does not throw", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  assert.doesNotThrow(() => {
    repo.insertExecutionTicket({
      ticketId: "ticket-001",
      executionId: "exec-001",
      taskId: "task-001",
      queueName: "default",
      priority: 0,
      status: "pending",
      createdAt: "2026-04-27T10:00:00.000Z",
      assignedWorkerId: null,
      claimedAt: null,
      consumedAt: null,
      invalidatedAt: null,
    });
  });
});

test("WorkerRepository claimExecutionTicket accepts string arguments", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  assert.doesNotThrow(() => {
    repo.claimExecutionTicket("ticket-001", "worker-001", "2026-04-27T10:00:00.000Z");
  });
});

test("WorkerRepository claimExecutionTicket accepts object argument", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  assert.doesNotThrow(() => {
    repo.claimExecutionTicket({
      ticketId: "ticket-001",
      assignedWorkerId: "worker-001",
      leaseId: "lease-001",
      claimedAt: "2026-04-27T10:00:00.000Z",
    });
  });
});

test("WorkerRepository consumeExecutionTicket does not throw", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  assert.doesNotThrow(() => {
    repo.consumeExecutionTicket("ticket-001", "2026-04-27T12:00:00.000Z");
  });
});

test("WorkerRepository invalidateExecutionTicket accepts string arguments", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  assert.doesNotThrow(() => {
    repo.invalidateExecutionTicket("ticket-001", "2026-04-27T12:00:00.000Z");
  });
});

test("WorkerRepository invalidateExecutionTicket accepts object argument", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  assert.doesNotThrow(() => {
    repo.invalidateExecutionTicket({
      ticketId: "ticket-001",
      status: "cancelled",
      invalidatedAt: "2026-04-27T12:00:00.000Z",
    });
  });
});

test("WorkerRepository listPendingExecutionTickets returns empty array", () => {
  const mockConn = {
    prepare: () => ({
      all: () => [],
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.listPendingExecutionTickets();
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

test("WorkerRepository getExecutionTicket returns undefined for non-existent ticket", () => {
  const mockConn = {
    prepare: () => ({
      get: () => undefined,
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.getExecutionTicket("non-existent-ticket");
  assert.equal(result, undefined);
});

test("WorkerRepository getActiveExecutionTicket returns undefined for non-existent execution", () => {
  const mockConn = {
    prepare: () => ({
      get: () => undefined,
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.getActiveExecutionTicket("non-existent-exec", 1);
  assert.equal(result, undefined);
});

test("WorkerRepository listExecutionTicketsByExecution returns empty array", () => {
  const mockConn = {
    prepare: () => ({
      all: () => [],
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.listExecutionTicketsByExecution("exec-001");
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

test("WorkerRepository listExecutionTicketsByStatuses returns empty array", () => {
  const mockConn = {
    prepare: () => ({
      all: () => [],
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.listExecutionTicketsByStatuses(["pending", "claimed"]);
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

test("WorkerRepository listDispatchableExecutionTickets returns empty array", () => {
  const mockConn = {
    prepare: () => ({
      all: () => [],
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.listDispatchableExecutionTickets("2026-04-27T10:00:00.000Z", "default");
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

test("WorkerRepository insertExecutionLease does not throw", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  assert.doesNotThrow(() => {
    repo.insertExecutionLease({
      leaseId: "lease-001",
      ticketId: "ticket-001",
      executionId: "exec-001",
      workerId: "worker-001",
      status: "active",
      grantedAt: "2026-04-27T10:00:00.000Z",
      expiresAt: "2026-04-27T11:00:00.000Z",
      lastHeartbeatAt: null,
      releasedAt: null,
      releaseReasonCode: null,
      fencingToken: 1,
    });
  });
});

test("WorkerRepository renewExecutionLease accepts string arguments", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  assert.doesNotThrow(() => {
    repo.renewExecutionLease("lease-001", "2026-04-27T12:00:00.000Z");
  });
});

test("WorkerRepository renewExecutionLease accepts three arguments with lastHeartbeatAt", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  assert.doesNotThrow(() => {
    repo.renewExecutionLease("lease-001", "2026-04-27T12:00:00.000Z", "2026-04-27T11:30:00.000Z");
  });
});

test("WorkerRepository closeExecutionLease accepts string argument", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  assert.doesNotThrow(() => {
    repo.closeExecutionLease("lease-001", "2026-04-27T12:00:00.000Z");
  });
});

test("WorkerRepository closeExecutionLease accepts object argument", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  assert.doesNotThrow(() => {
    repo.closeExecutionLease({
      leaseId: "lease-001",
      status: "released",
      releasedAt: "2026-04-27T12:00:00.000Z",
      reasonCode: "task_completed",
    });
  });
});

test("WorkerRepository insertLeaseAudit does not throw", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);

  assert.doesNotThrow(() => {
    repo.insertLeaseAudit({
      auditId: "audit-001",
      leaseId: "lease-001",
      eventType: "renewed",
      occurredAt: "2026-04-27T11:00:00.000Z",
      workerId: "worker-001",
      detailsJson: null,
    });
  });
});

test("WorkerRepository getExecutionLease returns undefined for non-existent lease", () => {
  const mockConn = {
    prepare: () => ({
      get: () => undefined,
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.getExecutionLease("non-existent-lease");
  assert.equal(result, undefined);
});

test("WorkerRepository getActiveExecutionLease returns undefined for non-existent execution", () => {
  const mockConn = {
    prepare: () => ({
      get: () => undefined,
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.getActiveExecutionLease("non-existent-exec");
  assert.equal(result, undefined);
});

test("WorkerRepository getLatestExecutionLease returns undefined for non-existent execution", () => {
  const mockConn = {
    prepare: () => ({
      get: () => undefined,
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.getLatestExecutionLease("non-existent-exec");
  assert.equal(result, undefined);
});

test("WorkerRepository listExecutionLeases returns empty array", () => {
  const mockConn = {
    prepare: () => ({
      all: () => [],
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.listExecutionLeases("exec-001");
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

test("WorkerRepository listLeasesByWorker returns empty array", () => {
  const mockConn = {
    prepare: () => ({
      all: () => [],
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.listLeasesByWorker("worker-001");
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

test("WorkerRepository listExecutionLeasesByStatuses returns empty array", () => {
  const mockConn = {
    prepare: () => ({
      all: () => [],
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.listExecutionLeasesByStatuses(["active"]);
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

test("WorkerRepository listExpiredExecutionLeases returns empty array", () => {
  const mockConn = {
    prepare: () => ({
      all: () => [],
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.listExpiredExecutionLeases("2026-04-27T10:00:00.000Z");
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

test("WorkerRepository getLatestFencingToken returns 0 for non-existent execution", () => {
  const mockConn = {
    prepare: () => ({
      get: () => undefined,
    }),
  } as any;

  const repo = new WorkerRepository(mockConn);
  const result = repo.getLatestFencingToken("non-existent-exec");
  assert.equal(result, 0);
});

test("WorkerRepository integration - full worker lifecycle", () => {
  const workspace = createTempWorkspace("worker-repo-integration-");
  const dbPath = join(workspace, "worker-integration.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";

    // Insert worker snapshot
    repo.upsertWorkerSnapshot({
      workerId: "integration-worker-001",
      registeredAt: now,
      lastHeartbeatAt: now,
      status: "active",
      pool: "default",
      priority: 0,
      labelsJson: null,
      currentTaskId: null,
      currentExecutionId: null,
      version: 1,
    });

    // Verify worker snapshot was inserted
    const workerSnapshot = repo.getWorkerSnapshot("integration-worker-001");
    assert.ok(workerSnapshot);
    assert.equal(workerSnapshot.workerId, "integration-worker-001");
    assert.equal(workerSnapshot.status, "active");

    // Insert execution ticket
    repo.insertExecutionTicket({
      ticketId: "integration-ticket-001",
      executionId: "integration-exec-001",
      taskId: "integration-task-001",
      queueName: "default",
      priority: 0,
      status: "pending",
      createdAt: now,
      assignedWorkerId: null,
      claimedAt: null,
      consumedAt: null,
      invalidatedAt: null,
    });

    // Claim the ticket
    repo.claimExecutionTicket({
      ticketId: "integration-ticket-001",
      assignedWorkerId: "integration-worker-001",
      leaseId: "integration-lease-001",
      claimedAt: now,
    });

    // Verify ticket was claimed
    const claimedTicket = repo.getExecutionTicket("integration-ticket-001");
    assert.ok(claimedTicket);
    assert.equal(claimedTicket.status, "claimed");
    assert.equal(claimedTicket.assignedWorkerId, "integration-worker-001");

    // Insert lease
    repo.insertExecutionLease({
      leaseId: "integration-lease-001",
      ticketId: "integration-ticket-001",
      executionId: "integration-exec-001",
      workerId: "integration-worker-001",
      status: "active",
      grantedAt: now,
      expiresAt: "2026-04-27T11:00:00.000Z",
      lastHeartbeatAt: null,
      releasedAt: null,
      releaseReasonCode: null,
      fencingToken: 1,
    });

    // Verify lease is active
    const activeLease = repo.getActiveExecutionLease("integration-exec-001");
    assert.ok(activeLease);
    assert.equal(activeLease.leaseId, "integration-lease-001");
    assert.equal(activeLease.status, "active");

    // Close the lease
    repo.closeExecutionLease({
      leaseId: "integration-lease-001",
      status: "released",
      releasedAt: now,
      reasonCode: "task_completed",
    });

    // Verify lease is closed
    const closedLease = repo.getExecutionLease("integration-lease-001");
    assert.ok(closedLease);
    assert.equal(closedLease.status, "released");

  } finally {
    cleanupPath(workspace);
  }
});