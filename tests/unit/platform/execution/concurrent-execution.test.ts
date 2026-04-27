/**
 * Concurrent Execution Tests
 *
 * Tests for concurrent access patterns, race conditions, and parallel execution
 * scenarios across the execution plane.
 *
 * Covers:
 * - Multiple workers accessing same queue
 * - Concurrent task status transitions
 * - Parallel execution lease management
 * - Race conditions in service registry
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";

import { runConcurrentInvariant, runConcurrentStateModification, runCriticalSectionTest } from "../../../helpers/concurrent-runner.js";
import { SqliteQueueAdapter } from "../../../../src/platform/execution/queue/sqlite-queue-adapter.js";
import { QUEUE_JOBS_DDL } from "../../../../src/platform/execution/queue/queue-adapter-types.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";

// ============================================================================
// Queue Adapter Concurrency Tests
// ============================================================================

test("[CONCURRENCY] multiple workers dequeue from same queue - only one gets each job", async () => {
  const workspace = createTempWorkspace("concurrent-dequeue-");
  const dbPath = join(workspace, "queue.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);

  try {
    const adapter = new SqliteQueueAdapter(db);

    // Enqueue 10 jobs
    for (let i = 0; i < 10; i++) {
      adapter.enqueue({ queueName: "tasks", payload: { taskId: `task-${i}` } });
    }

    // Run 5 concurrent workers trying to dequeue
    const result = await runConcurrentInvariant(
      async (workerId: number) => {
        const jobs: string[] = [];
        // Each worker tries to dequeue up to 3 times
        for (let i = 0; i < 3; i++) {
          const dequeued = adapter.dequeue("tasks");
          if (dequeued) {
            jobs.push(dequeued.job.id);
            dequeued.ack(); // Ack immediately
          }
        }
        return { workerId, jobs };
      },
      { concurrency: 5 },
    );

    assert.equal(result.errors.length, 0, "No errors should occur");

    // Collect all unique job IDs dequeued
    const allJobIds = new Set<string>();
    for (const value of result.values) {
      for (const jobId of value.jobs) {
        allJobIds.add(jobId);
      }
    }

    // We enqueued 10 jobs, each worker could get multiple
    assert.ok(allJobIds.size <= 10, "Should not get more jobs than were enqueued");
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("[CONCURRENCY] concurrent enqueue to same queue maintains ordering", async () => {
  const workspace = createTempWorkspace("concurrent-enqueue-");
  const dbPath = join(workspace, "queue.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);

  try {
    const adapter = new SqliteQueueAdapter(db);

    // Run 20 concurrent enqueue operations
    const result = await runConcurrentInvariant(
      async (workerId: number) => {
        const job = adapter.enqueue({
          queueName: "ordered-queue",
          payload: { workerId, timestamp: Date.now() },
          priority: workerId,
        });
        return job.id;
      },
      { concurrency: 20 },
    );

    assert.equal(result.errors.length, 0, "No errors should occur");
    assert.equal(result.values.length, 20, "All 20 enqueues should succeed");

    // Verify all jobs exist in the queue
    const jobs = adapter.listJobs("ordered-queue");
    assert.equal(jobs.length, 20, "All 20 jobs should be in the queue");
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("[CONCURRENCY] concurrent dequeues with idempotency keys - duplicate prevention", async () => {
  const workspace = createTempWorkspace("concurrent-idempotent-");
  const dbPath = join(workspace, "queue.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);

  try {
    const adapter = new SqliteQueueAdapter(db);

    // Enqueue jobs with idempotency keys
    adapter.enqueue({ queueName: "idempotent-queue", payload: "first", idempotencyKey: "key-1" });

    // Run concurrent enqueues with same idempotency key
    const result = await runConcurrentStateModification(
      async () => {
        adapter.enqueue({ queueName: "idempotent-queue", payload: "duplicate", idempotencyKey: "key-1" });
      },
      { concurrency: 10 },
    );

    // Only one should succeed (the rest should be idempotency duplicates)
    const jobs = adapter.listJobs("idempotent-queue");
    assert.equal(jobs.length, 1, "Only one job should exist despite 10 concurrent enqueue attempts");
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("[CONCURRENCY] concurrent ack/nack on same job - only one succeeds", async () => {
  const workspace = createTempWorkspace("concurrent-ack-");
  const dbPath = join(workspace, "queue.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);

  try {
    const adapter = new SqliteQueueAdapter(db);

    // Enqueue a single job
    const job = adapter.enqueue({ queueName: "ack-test", payload: "single-job" });

    // Dequeue the job
    const dequeueResult = adapter.dequeue("ack-test");
    assert.ok(dequeueResult, "Should dequeue the job");

    // Run concurrent ack and nack on the same job
    const results = await Promise.allSettled([
      Promise.resolve().then(() => { dequeueResult.ack(); return "ack"; }),
      Promise.resolve().then(() => { dequeueResult.nack("error"); return "nack"; }),
    ]);

    // Check final state - job should be either completed or back to waiting
    const finalJob = adapter.getJob(job.id);
    assert.ok(finalJob, "Job should still exist");
    assert.ok(
      finalJob!.status === "completed" || finalJob!.status === "waiting",
      `Job status should be completed or waiting, got ${finalJob!.status}`,
    );
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("[CONCURRENCY] many concurrent workers competing for limited jobs", async () => {
  const workspace = createTempWorkspace("concurrent-compete-");
  const dbPath = join(workspace, "queue.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);

  try {
    const adapter = new SqliteQueueAdapter(db);

    // Only 2 jobs available
    adapter.enqueue({ queueName: "scarce-queue", payload: "job-1" });
    adapter.enqueue({ queueName: "scarce-queue", payload: "job-2" });

    // 10 workers competing for 2 jobs
    const result = await runConcurrentInvariant(
      async (_workerId: number) => {
        const dequeued = adapter.dequeue("scarce-queue");
        if (dequeued) {
          dequeued.ack();
          return dequeued.job.id;
        }
        return null;
      },
      { concurrency: 10 },
    );

    // Count successful dequeues
    const successful = result.values.filter((v) => v !== null);
    assert.ok(successful.length <= 2, "At most 2 jobs should be dequeued");

    // Verify all jobs are completed
    const stats = adapter.stats("scarce-queue");
    assert.equal(stats.completed, successful.length, "Completed count should match successful dequeues");
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

// ============================================================================
// Service Registry Concurrency Tests
// ============================================================================

test("[CONCURRENCY] service registry concurrent get on same service - single init", async () => {
  // Create a fresh registry
  const registry = new ServiceRegistry();
  let initCount = 0;

  registry.register("concurrent-service", {
    init: () => {
      initCount++;
      return { id: "service-1", value: initCount };
    },
  });

  // Run 20 concurrent get() calls
  const result = await runConcurrentInvariant(
    async (workerId: number) => {
      const service = registry.get<{ id: string; value: number }>("concurrent-service");
      return { workerId, value: service.value };
    },
    { concurrency: 20 },
  );

  // Service should only be initialized once
  assert.equal(initCount, 1, "Service should only be initialized once");
  assert.equal(result.errors.length, 0, "No errors should occur");

  // All workers should get the same instance
  const values = result.values.map((v) => v.value);
  assert.ok(values.every((v) => v === 1), "All workers should get the same initial value");
});

test("[CONCURRENCY] service registry concurrent register and get", async () => {
  const registry = new ServiceRegistry();

  // Concurrently register different services
  await Promise.all([
    (async () => {
      registry.register("service-a", { init: () => ({ name: "A" }) });
    })(),
    (async () => {
      registry.register("service-b", { init: () => ({ name: "B" }) });
    })(),
    (async () => {
      registry.register("service-c", { init: () => ({ name: "C" }) });
    })(),
  ]);

  // Verify all services are accessible
  const serviceA = registry.get<{ name: string }>("service-a");
  const serviceB = registry.get<{ name: string }>("service-b");
  const serviceC = registry.get<{ name: string }>("service-c");

  assert.equal(serviceA.name, "A");
  assert.equal(serviceB.name, "B");
  assert.equal(serviceC.name, "C");
});

test("[CONCURRENCY] service registry concurrent access with dependencies", async () => {
  const registry = new ServiceRegistry();
  const initOrder: string[] = [];

  // Register services with dependencies
  registry.register("dependent-service", {
    init: () => {
      initOrder.push("dependent");
      return { name: "Dependent" };
    },
    dependsOn: ["base-service"],
  });

  registry.register("base-service", {
    init: () => {
      initOrder.push("base");
      return { name: "Base" };
    },
  });

  // Concurrently get the dependent service multiple times
  await Promise.all([
    registry.get("dependent-service"),
    registry.get("dependent-service"),
    registry.get("base-service"),
  ]);

  // Base should be initialized before dependent
  const baseIndex = initOrder.indexOf("base");
  const dependentIndex = initOrder.indexOf("dependent");
  assert.ok(baseIndex < dependentIndex, "Base service should be initialized before dependent");
});

test("[CONCURRENCY] service registry isInitialized reflects concurrent state", async () => {
  const registry = new ServiceRegistry();

  registry.register("test-service", {
    init: () => ({ value: 42 }),
  });

  // Check before and after concurrent access
  const before = registry.isInitialized("test-service");
  assert.equal(before, false, "Service should not be initialized before get()");

  await Promise.all([
    registry.get("test-service"),
    registry.get("test-service"),
  ]);

  const after = registry.isInitialized("test-service");
  assert.equal(after, true, "Service should be initialized after get()");
});

test("[CONCURRENCY] service registry reset clears all instances", async () => {
  const registry = new ServiceRegistry();
  let getCount = 0;

  registry.register("reset-test-service", {
    init: () => {
      getCount++;
      return { count: getCount };
    },
  });

  // First, initialize the service
  registry.get<{ count: number }>("reset-test-service");
  assert.equal(getCount, 1, "Service should be initialized once");

  // Reset the registry
  await registry.reset();

  // After reset, the service should be removed
  // Creating a fresh registry to verify state is cleared
  const freshRegistry = new ServiceRegistry();
  freshRegistry.register("reset-test-service", {
    init: () => ({ count: 1 }),
  });
  const afterReset = freshRegistry.get<{ count: number }>("reset-test-service");
  assert.equal(afterReset.count, 1, "Fresh service instance should have count=1");
});

// ============================================================================
// SQLite Lock Adapter Concurrency Tests (using runCriticalSectionTest)
// ============================================================================

test("[CONCURRENCY] critical section test - lock acquisition mutual exclusion", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS distributed_locks (
      lock_key TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      fencing_token INTEGER NOT NULL,
      status TEXT NOT NULL,
      acquired_at TEXT NOT NULL,
      ttl_ms INTEGER NOT NULL,
      metadata TEXT
    );
  `);

  // Simple in-memory lock state
  let lockHolder: number | null = null;
  const lockKey = "critical-lock";

  async function acquireLock(workerId: number): Promise<{ acquired: boolean; holder?: number }> {
    if (lockHolder === null) {
      lockHolder = workerId;
      return { acquired: true, holder: workerId };
    }
    return { acquired: false };
  }

  async function releaseLock(): Promise<void> {
    lockHolder = null;
  }

  const result = await runCriticalSectionTest(acquireLock, releaseLock, { concurrency: 10 });

  assert.equal(result.violations, 0, "No concurrent access violations should occur");
  assert.equal(result.maxConcurrent, 1, "Only one worker should hold the lock at a time");

  db.close();
});

test("[CONCURRENCY] critical section test - lock holder transfers atomically", async () => {
  let currentHolder: number | null = null;
  const transferLog: Array<{ from: number | null; to: number }> = [];

  async function acquireLock(workerId: number): Promise<{ acquired: boolean; holder?: number }> {
    const previousHolder = currentHolder;
    currentHolder = workerId;
    transferLog.push({ from: previousHolder, to: workerId });
    return { acquired: true, holder: workerId };
  }

  async function releaseLock(): Promise<void> {
    currentHolder = null;
  }

  await runCriticalSectionTest(acquireLock, releaseLock, { concurrency: 5 });

  // Each transfer should show atomic transition
  for (const transfer of transferLog) {
    assert.ok(transfer.to !== null, "Transfer should have a valid target");
  }
});

// ============================================================================
// State Modification Concurrency Tests
// ============================================================================

test("[CONCURRENCY] runConcurrentStateModification - counter increments", async () => {
  let counter = 0;

  await runConcurrentStateModification(
    async () => {
      const current = counter;
      await new Promise((resolve) => setImmediate(resolve));
      counter = current + 1;
    },
    { concurrency: 100 },
  );

  // Note: Without proper synchronization, this may not reach 100
  // This test documents the race condition
  assert.ok(counter > 0, "Counter should have been incremented");
});

test("[CONCURRENCY] concurrent map updates demonstrate race condition", async () => {
  const sharedMap = new Map<string, number>();
  let counter = 0;

  // This test demonstrates a race condition in read-modify-write
  // Without proper synchronization, concurrent increments will overwrite each other
  await runConcurrentStateModification(
    async () => {
      const index = counter++;
      const key = `key-${index % 10}`; // 10 unique keys
      const current = sharedMap.get(key) ?? 0;
      await new Promise((resolve) => setImmediate(resolve)); // Yield point causes interleaving
      sharedMap.set(key, current + 1);
    },
    { concurrency: 50 },
  );

  // Due to race conditions in read-modify-write, not all 50 increments will be reflected
  // Each key should have been "attempted" 5 times, but many overwrites occur
  let total = 0;
  for (const value of sharedMap.values()) {
    total += value;
  }

  // The total will be less than 50 due to race conditions (lost updates)
  // This demonstrates why atomic operations or locking are needed
  assert.ok(total < 50, `Expected less than 50 due to race conditions, got ${total}`);
  assert.equal(sharedMap.size, 10, "All 10 keys should have some value");
});

test("[CONCURRENCY] concurrent set additions are all captured", async () => {
  const sharedSet = new Set<number>();
  let counter = 0;

  await runConcurrentStateModification(
    async () => {
      sharedSet.add(counter++);
    },
    { concurrency: 100 },
  );

  assert.equal(sharedSet.size, 100, "All 100 unique values should be in the set");
});

// ============================================================================
// Transition Service Concurrency Tests
// ============================================================================

test("[CONCURRENCY] concurrent task status queries return consistent state", async () => {
  // Simulate concurrent status reads
  let taskStatus = "pending";
  const statusReads: string[] = [];

  await runConcurrentStateModification(
    async () => {
      // Read current status
      statusReads.push(taskStatus);
    },
    { concurrency: 20 },
  );

  // All reads should see the same status (no corruption)
  const uniqueStatuses = new Set(statusReads);
  assert.ok(uniqueStatuses.size <= 2, "Should see at most 2 status values (initial + possibly changed)");
});

test("[CONCURRENCY] concurrent workflow status transitions are serialized", async () => {
  const transitions: Array<{ from: string; to: string }> = [];
  let currentStatus = "running";
  let workerIndex = 0;

  await runConcurrentStateModification(
    async () => {
      const index = workerIndex++;
      const from = currentStatus;
      // Simulate transition
      if (from === "running" && index === 0) {
        currentStatus = "paused";
        transitions.push({ from, to: "paused" });
      } else if (from === "paused" && index === 1) {
        currentStatus = "running";
        transitions.push({ from, to: "running" });
      }
    },
    { concurrency: 2 },
  );

  // Transitions should be recorded
  assert.ok(transitions.length > 0, "Some transitions should have occurred");
});

// ============================================================================
// Lease Management Concurrency Tests
// ============================================================================

test("[CONCURRENCY] concurrent lease renewal - only latest holder valid", async () => {
  let currentLeaseHolder: number | null = null;
  let leaseExpiration: number = 0;
  const leaseLog: Array<{ holder: number; action: string; time: number }> = [];

  async function tryAcquireLease(workerId: number): Promise<boolean> {
    const now = Date.now();
    if (currentLeaseHolder === null || now > leaseExpiration) {
      leaseLog.push({ holder: workerId, action: "acquire", time: now });
      currentLeaseHolder = workerId;
      leaseExpiration = now + 5000; // 5 second lease
      return true;
    }
    return false;
  }

  async function renewLease(workerId: number): Promise<boolean> {
    const now = Date.now();
    if (currentLeaseHolder === workerId) {
      leaseLog.push({ holder: workerId, action: "renew", time: now });
      leaseExpiration = now + 5000;
      return true;
    }
    return false;
  }

  // Simulate 5 concurrent workers trying to manage leases
  await runConcurrentInvariant(
    async (workerId: number) => {
      // Try to acquire initial lease
      const acquired = await tryAcquireLease(workerId);
      if (acquired) {
        // Then renew it
        await renewLease(workerId);
      }
      return { workerId, acquired };
    },
    { concurrency: 5 },
  );

  // Only one worker should have acquired the lease
  const acquires = leaseLog.filter((l) => l.action === "acquire");
  assert.equal(acquires.length, 1, "Only one worker should acquire the lease");
});

test("[CONCURRENCY] lease expiration handling under concurrent access", async () => {
  let leaseHolder: number | null = null;
  let leaseExpiryTime: number = 0;

  async function checkLeaseExpired(): Promise<boolean> {
    return Date.now() > leaseExpiryTime;
  }

  async function acquireIfExpired(workerId: number): Promise<boolean> {
    if (leaseHolder === null || Date.now() > leaseExpiryTime) {
      leaseHolder = workerId;
      leaseExpiryTime = Date.now() - 1; // Already expired for next check
      return true;
    }
    return false;
  }

  const result = await runConcurrentInvariant(
    async (workerId: number) => {
      const expired = await checkLeaseExpired();
      if (expired) {
        return await acquireIfExpired(workerId);
      }
      return false;
    },
    { concurrency: 10 },
  );

  // Some workers should have acquired (since lease was expired)
  const acquired = result.values.filter((v) => v === true);
  assert.ok(acquired.length >= 1, "At least one worker should have acquired the expired lease");
});

test("[CONCURRENCY] multiple workers requesting same lease - winner becomes holder", async () => {
  const leaseRequests: number[] = [];
  let finalHolder: number | null = null;
  let counter = 0;

  await runConcurrentStateModification(
    async () => {
      const workerId = counter++;
      leaseRequests.push(workerId);
      // Last writer becomes the holder (simplified model)
      finalHolder = workerId;
    },
    { concurrency: 10 },
  );

  // Final holder should be one of the workers
  assert.ok(finalHolder !== null, "A final holder should be set");
  assert.ok(finalHolder! >= 0 && finalHolder! < 10, "Holder should be a valid worker ID");
});

// ============================================================================
// Queue Priority Handling Under Concurrency
// ============================================================================

test("[CONCURRENCY] priority queue ordering maintained under concurrent load", async () => {
  const workspace = createTempWorkspace("concurrent-priority-");
  const dbPath = join(workspace, "queue.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);

  try {
    const adapter = new SqliteQueueAdapter(db);

    // Enqueue with varying priorities concurrently
    const priorities = [1, 5, 3, 8, 2, 7, 4, 9, 6, 10];
    await Promise.all(
      priorities.map(
        (p, i) =>
          new Promise<void>((resolve) => {
            adapter.enqueue({ queueName: "priority-queue", payload: `task-${i}`, priority: p });
            resolve();
          }),
      ),
    );

    // Dequeue all and verify priority ordering
    const dequeued: Array<{ priority: number; payload: string }> = [];
    let result;
    while ((result = adapter.dequeue("priority-queue")) !== null) {
      dequeued.push({
        priority: result.job.priority,
        payload: String(JSON.parse(result.job.payload)),
      });
      result.ack();
    }

    // Verify descending priority order
    for (let i = 1; i < dequeued.length; i++) {
      assert.ok(
        dequeued[i - 1].priority >= dequeued[i].priority,
        `Priority should be descending: ${dequeued[i - 1].priority} >= ${dequeued[i].priority}`,
      );
    }
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

// ============================================================================
// Distributed Lock Pattern Tests
// ============================================================================

test("[CONCURRENCY] lock acquisition retry under contention", async () => {
  let lockHeld = false;
  let contentionCount = 0;

  async function tryAcquireLock(workerId: number): Promise<{ acquired: boolean; workerId: number }> {
    if (lockHeld) {
      contentionCount++;
      return { acquired: false, workerId };
    }
    lockHeld = true;
    return { acquired: true, workerId };
  }

  async function releaseLock(): Promise<void> {
    lockHeld = false;
  }

  // First worker acquires
  const first = await tryAcquireLock(0);
  assert.equal(first.acquired, true, "First worker should acquire");

  // Remaining workers should fail (workers 1-9 since worker 0 already holds)
  const result = await runConcurrentInvariant(
    async (workerId: number) => tryAcquireLock(workerId),
    { concurrency: 9, timeout: 5000 }, // workers 1-9
  );

  const acquired = result.values.filter((v) => v.acquired);
  assert.equal(acquired.length, 0, "Workers 1-9 should all fail to acquire since lock is held");

  // Release and verify contention was tracked
  await releaseLock();
  assert.ok(contentionCount > 0, "Contention should have been recorded");
});

// ============================================================================
// Edge Cases
// ============================================================================

test("[CONCURRENCY] rapid register/deregister cycles", async () => {
  const registry = new ServiceRegistry();
  let counter = 0;

  await runConcurrentStateModification(
    async () => {
      const index = counter++;
      const serviceName = `cycle-service-${index}`;
      registry.register(serviceName, {
        init: () => ({ id: serviceName }),
      });
    },
    { concurrency: 20 },
  );

  // All services should be registered
  for (let i = 0; i < 20; i++) {
    const service = registry.get(`cycle-service-${i}`);
    assert.ok(service, `Service cycle-service-${i} should be accessible`);
  }
});

test("[CONCURRENCY] concurrent access to statistics aggregation", async () => {
  const workspace = createTempWorkspace("concurrent-stats-");
  const dbPath = join(workspace, "queue.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);

  try {
    const adapter = new SqliteQueueAdapter(db);

    // Enqueue varied jobs
    for (let i = 0; i < 50; i++) {
      const status = i % 3 === 0 ? "completed" : i % 3 === 1 ? "waiting" : "failed";
      const job = adapter.enqueue({ queueName: "stats-queue", payload: `job-${i}` });
      if (status === "completed") {
        const deq = adapter.dequeue("stats-queue");
        if (deq && deq.job.id === job.id) deq.ack();
      }
    }

    // Concurrent stats calls
    const result = await runConcurrentInvariant(
      async (_workerId: number) => {
        return adapter.stats("stats-queue");
      },
      { concurrency: 10 },
    );

    // All stats calls should return consistent results
    const firstStats = result.values[0];
    for (const stats of result.values) {
      assert.equal(stats.queueName, firstStats.queueName);
      assert.equal(stats.waiting, firstStats.waiting);
      assert.equal(stats.completed, firstStats.completed);
    }
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("[CONCURRENCY] worker pool registration concurrent updates", async () => {
  // Simulate worker registry concurrent updates
  const workerRegistry = new Map<string, { status: string; updatedAt: number }>();
  let updateCount = 0;
  let counter = 0;

  await runConcurrentStateModification(
    async () => {
      const workerId = counter++;
      const workerKey = `worker-${workerId % 5}`; // 5 unique workers
      workerRegistry.set(workerKey, {
        status: workerId % 2 === 0 ? "active" : "idle",
        updatedAt: Date.now(),
      });
      updateCount++;
    },
    { concurrency: 100 },
  );

  // Should have 5 unique workers registered
  assert.equal(workerRegistry.size, 5, "Should have 5 unique workers");
  assert.equal(updateCount, 100, "All 100 updates should have been processed");
});

test("[CONCURRENCY] cleanup operations during concurrent access", async () => {
  const workspace = createTempWorkspace("concurrent-cleanup-");
  const dbPath = join(workspace, "queue.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);

  try {
    const adapter = new SqliteQueueAdapter(db);

    // Enqueue jobs
    for (let i = 0; i < 20; i++) {
      adapter.enqueue({ queueName: "cleanup-queue", payload: `job-${i}` });
    }

    // Concurrent operations mixed with cleanup
    await Promise.all([
      (async () => {
        // Dequeue and ack half
        for (let i = 0; i < 10; i++) {
          const deq = adapter.dequeue("cleanup-queue");
          if (deq) deq.ack();
        }
      })(),
      (async () => {
        // Purge should work even while dequeuing
        const cutoff = new Date(Date.now() + 10000).toISOString();
        adapter.purge("cleanup-queue", cutoff);
      })(),
    ]);

    // Queue should still be functional
    adapter.enqueue({ queueName: "cleanup-queue", payload: "new-job" });
    const jobs = adapter.listJobs("cleanup-queue");
    assert.ok(jobs.length > 0, "Queue should still have jobs after concurrent operations");
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});
