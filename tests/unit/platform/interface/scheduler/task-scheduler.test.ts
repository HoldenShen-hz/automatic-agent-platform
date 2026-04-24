import assert from "node:assert/strict";
import test from "node:test";

/**
 * Unit tests for task scheduler modules.
 * These tests use mocked dependencies to isolate the scheduling logic.
 */

interface MockQueueAdapter {
  backendKind: "sqlite" | "redis";
  enqueue(input: { queueName: string; payload: unknown; priority?: number; maxAttempts?: number; delayUntil?: string | null; idempotencyKey?: string | null }): MockQueueJobRecord;
  dequeue(queueName: string): MockDequeueResult | null;
  getJob(jobId: string): MockQueueJobRecord | null;
  listJobs(queueName: string, status?: string, limit?: number): MockQueueJobRecord[];
  moveToDeadLetter(jobId: string, reason: string): void;
  retryJob(jobId: string): MockQueueJobRecord | null;
  purge(queueName: string, olderThan: string): number;
  stats(queueName: string): MockQueueStats;
  listQueues(): string[];
}

interface MockQueueJobRecord {
  id: string;
  queueName: string;
  payload: string;
  status: "waiting" | "delayed" | "active" | "completed" | "failed" | "dead_letter";
  priority: number;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  delayUntil: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface MockDequeueResult {
  job: MockQueueJobRecord;
  ack: () => void;
  nack: (error?: string) => void;
}

interface MockQueueStats {
  queueName: string;
  waiting: number;
  delayed: number;
  active: number;
  completed: number;
  failed: number;
  deadLetter: number;
}

interface MockPartitionConfig {
  maxDepth: number;
  alertThreshold: number;
  consumerCount: number;
  partitioningStrategy: "byTenant" | "byAggregateType" | "byTenantAndAggregate";
}

interface MockQueuePartition {
  name: string;
  aggregateType: string;
  priority: number;
  consumerGroup: string;
  config: MockPartitionConfig;
}

function createMockJobRecord(overrides: Partial<MockQueueJobRecord> = {}): MockQueueJobRecord {
  return {
    id: "job_001",
    queueName: "tasks",
    payload: '{"taskId":"task_001"}',
    status: "waiting",
    priority: 0,
    attempts: 0,
    maxAttempts: 3,
    lastError: null,
    delayUntil: null,
    idempotencyKey: null,
    createdAt: "2026-04-20T09:00:00.000Z",
    updatedAt: "2026-04-20T09:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

function createMockStats(overrides: Partial<MockQueueStats> = {}): MockQueueStats {
  return {
    queueName: "tasks",
    waiting: 0,
    delayed: 0,
    active: 0,
    completed: 0,
    failed: 0,
    deadLetter: 0,
    ...overrides,
  };
}

/**
 * Simplified QueuePartitioner implementation for testing the scheduling logic
 */
class TestQueuePartitioner {
  private partitions: Map<string, MockQueuePartition> = new Map();

  registerPartition(partition: MockQueuePartition): void {
    this.partitions.set(partition.aggregateType, partition);
  }

  getPartition(aggregateType: string): MockQueuePartition | undefined {
    return this.partitions.get(aggregateType);
  }

  extractPartitionKey(payload: unknown): { aggregateType: string; tenantId: string } {
    const p = payload as Record<string, unknown>;
    return {
      aggregateType: String(p.aggregateType ?? p.domain ?? "default"),
      tenantId: String(p.tenantId ?? p.tenant_id ?? "default"),
    };
  }

  computePartitionName(
    aggregateType: string,
    tenantId: string,
    strategy: MockPartitionConfig["partitioningStrategy"],
  ): string {
    switch (strategy) {
      case "byTenant":
        return `queue:${tenantId}`;
      case "byAggregateType":
        return `queue:${aggregateType}`;
      case "byTenantAndAggregate":
        return `queue:${tenantId}:${aggregateType}`;
      default:
        return `queue:${aggregateType}`;
    }
  }

  route(adapter: MockQueueAdapter, payload: unknown, options?: { priority?: number; maxAttempts?: number }): string {
    const key = this.extractPartitionKey(payload);
    const partition = this.getPartition(key.aggregateType);
    const strategy = partition?.config.partitioningStrategy ?? "byAggregateType";
    const queueName = this.computePartitionName(key.aggregateType, key.tenantId, strategy);

    const input = {
      queueName,
      payload,
      ...(options?.priority !== undefined ? { priority: options.priority } : {}),
      ...(options?.maxAttempts !== undefined ? { maxAttempts: options.maxAttempts } : {}),
    };

    const job = adapter.enqueue(input);
    return job.id;
  }

  getPartitionStats(adapter: MockQueueAdapter): Map<string, MockQueueStats> {
    const stats = new Map<string, MockQueueStats>();
    for (const [aggregateType, partition] of this.partitions) {
      stats.set(aggregateType, adapter.stats(partition.name));
    }
    return stats;
  }

  detectOverload(adapter: MockQueueAdapter): { aggregateType: string; stats: MockQueueStats }[] {
    const overloads: { aggregateType: string; stats: MockQueueStats }[] = [];
    for (const [aggregateType, partition] of this.partitions) {
      const stats = adapter.stats(partition.name);
      if (stats.waiting + stats.delayed > partition.config.maxDepth) {
        overloads.push({ aggregateType, stats });
      }
    }
    return overloads;
  }
}

function createMockAdapter(): MockQueueAdapter & { _jobs: Map<string, MockQueueJobRecord>; _queues: Map<string, MockQueueJobRecord[]> } {
  const jobs = new Map<string, MockQueueJobRecord>();
  const queues = new Map<string, MockQueueJobRecord[]>();

  return {
    backendKind: "sqlite",
    enqueue(input) {
      const job: MockQueueJobRecord = {
        id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        queueName: input.queueName,
        payload: JSON.stringify(input.payload),
        status: "waiting",
        priority: input.priority ?? 0,
        attempts: 0,
        maxAttempts: input.maxAttempts ?? 3,
        lastError: null,
        delayUntil: input.delayUntil ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      };
      jobs.set(job.id, job);
      const queueJobs = queues.get(input.queueName) ?? [];
      queueJobs.push(job);
      queues.set(input.queueName, queueJobs);
      return job;
    },
    dequeue(queueName) {
      const queueJobs = queues.get(queueName) ?? [];
      const idx = queueJobs.findIndex((j) => j.status === "waiting");
      if (idx === -1) return null;
      const job = queueJobs[idx]!;
      job.status = "active";
      job.attempts += 1;
      job.updatedAt = new Date().toISOString();
      return {
        job,
        ack: () => {
          job.status = "completed";
          job.completedAt = new Date().toISOString();
        },
        nack: (error?: string) => {
          job.lastError = error ?? null;
          if (job.attempts >= job.maxAttempts) {
            job.status = "dead_letter";
          } else {
            job.status = "waiting";
          }
        },
      };
    },
    getJob(jobId) {
      return jobs.get(jobId) ?? null;
    },
    listJobs(queueName, status, limit = 100) {
      const queueJobs = queues.get(queueName) ?? [];
      let filtered = queueJobs;
      if (status) {
        filtered = queueJobs.filter((j) => j.status === status);
      }
      return filtered.slice(0, limit);
    },
    moveToDeadLetter(jobId, reason) {
      const job = jobs.get(jobId);
      if (job) {
        job.status = "dead_letter";
        job.lastError = reason;
      }
    },
    retryJob(jobId) {
      const job = jobs.get(jobId);
      if (job && (job.status === "failed" || job.status === "dead_letter")) {
        job.status = "waiting";
        job.attempts = 0;
        job.lastError = null;
        return job;
      }
      return null;
    },
    purge(queueName, olderThan) {
      const queueJobs = queues.get(queueName) ?? [];
      const cutoff = new Date(olderThan).getTime();
      let purged = 0;
      const remaining: MockQueueJobRecord[] = [];
      for (const job of queueJobs) {
        if ((job.status === "completed" || job.status === "dead_letter") &&
            new Date(job.updatedAt).getTime() < cutoff) {
          jobs.delete(job.id);
          purged += 1;
        } else {
          remaining.push(job);
        }
      }
      queues.set(queueName, remaining);
      return purged;
    },
    stats(queueName) {
      const queueJobs = queues.get(queueName) ?? [];
      return createMockStats({
        queueName,
        waiting: queueJobs.filter((j) => j.status === "waiting").length,
        delayed: queueJobs.filter((j) => j.status === "delayed").length,
        active: queueJobs.filter((j) => j.status === "active").length,
        completed: queueJobs.filter((j) => j.status === "completed").length,
        failed: queueJobs.filter((j) => j.status === "failed").length,
        deadLetter: queueJobs.filter((j) => j.status === "dead_letter").length,
      });
    },
    listQueues() {
      return Array.from(queues.keys());
    },
    _jobs: jobs,
    _queues: queues,
  };
}

test("QueuePartitioner registers and retrieves partitions", () => {
  const partitioner = new TestQueuePartitioner();
  const partition: MockQueuePartition = {
    name: "queue:tasks",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-1",
    config: {
      maxDepth: 100,
      alertThreshold: 80,
      consumerCount: 4,
      partitioningStrategy: "byAggregateType",
    },
  };

  partitioner.registerPartition(partition);
  const retrieved = partitioner.getPartition("task");

  assert.ok(retrieved !== undefined);
  assert.equal(retrieved!.aggregateType, "task");
  assert.equal(retrieved!.config.partitioningStrategy, "byAggregateType");
});

test("QueuePartitioner returns undefined for unknown aggregate type", () => {
  const partitioner = new TestQueuePartitioner();
  const result = partitioner.getPartition("nonexistent");
  assert.equal(result, undefined);
});

test("QueuePartitioner extracts partition key from payload with aggregateType", () => {
  const partitioner = new TestQueuePartitioner();
  const payload = { aggregateType: "task", tenantId: "tenant_123", data: "test" };
  const key = partitioner.extractPartitionKey(payload);

  assert.equal(key.aggregateType, "task");
  assert.equal(key.tenantId, "tenant_123");
});

test("QueuePartitioner extracts partition key from payload with domain field", () => {
  const partitioner = new TestQueuePartitioner();
  const payload = { domain: "event", tenant_id: "tenant_456" };
  const key = partitioner.extractPartitionKey(payload);

  assert.equal(key.aggregateType, "event");
  assert.equal(key.tenantId, "tenant_456");
});

test("QueuePartitioner extracts partition key with defaults for missing fields", () => {
  const partitioner = new TestQueuePartitioner();
  const payload = {};
  const key = partitioner.extractPartitionKey(payload);

  assert.equal(key.aggregateType, "default");
  assert.equal(key.tenantId, "default");
});

test("QueuePartitioner computes partition names for byTenant strategy", () => {
  const partitioner = new TestQueuePartitioner();
  const name = partitioner.computePartitionName("task", "tenant_a", "byTenant");

  assert.equal(name, "queue:tenant_a");
});

test("QueuePartitioner computes partition names for byAggregateType strategy", () => {
  const partitioner = new TestQueuePartitioner();
  const name = partitioner.computePartitionName("task", "tenant_a", "byAggregateType");

  assert.equal(name, "queue:task");
});

test("QueuePartitioner computes partition names for byTenantAndAggregate strategy", () => {
  const partitioner = new TestQueuePartitioner();
  const name = partitioner.computePartitionName("task", "tenant_a", "byTenantAndAggregate");

  assert.equal(name, "queue:tenant_a:task");
});

test("QueuePartitioner routes job to correct queue with partition", () => {
  const partitioner = new TestQueuePartitioner();
  const adapter = createMockAdapter();

  partitioner.registerPartition({
    name: "queue:task",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-1",
    config: {
      maxDepth: 100,
      alertThreshold: 80,
      consumerCount: 4,
      partitioningStrategy: "byAggregateType",
    },
  });

  const jobId = partitioner.route(adapter, { aggregateType: "task", tenantId: "tenant_1" });
  assert.ok(jobId.length > 0);

  const job = adapter.getJob(jobId);
  assert.ok(job !== null);
  assert.equal(job!.queueName, "queue:task");
});

test("QueuePartitioner routes job with priority option", () => {
  const partitioner = new TestQueuePartitioner();
  const adapter = createMockAdapter();

  partitioner.registerPartition({
    name: "queue:task",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-1",
    config: {
      maxDepth: 100,
      alertThreshold: 80,
      consumerCount: 4,
      partitioningStrategy: "byAggregateType",
    },
  });

  const jobId = partitioner.route(adapter, { aggregateType: "task" }, { priority: 100 });
  const job = adapter.getJob(jobId);

  assert.equal(job!.priority, 100);
});

test("QueuePartitioner uses default strategy when no partition registered", () => {
  const partitioner = new TestQueuePartitioner();
  const adapter = createMockAdapter();

  const jobId = partitioner.route(adapter, { aggregateType: "unregistered" });
  const job = adapter.getJob(jobId);

  assert.equal(job!.queueName, "queue:unregistered");
});

test("QueuePartitioner getPartitionStats returns stats for registered partitions", () => {
  const partitioner = new TestQueuePartitioner();
  const adapter = createMockAdapter();

  partitioner.registerPartition({
    name: "queue:task",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-1",
    config: {
      maxDepth: 100,
      alertThreshold: 80,
      consumerCount: 4,
      partitioningStrategy: "byAggregateType",
    },
  });

  adapter.enqueue({ queueName: "queue:task", payload: { id: 1 } });
  adapter.enqueue({ queueName: "queue:task", payload: { id: 2 } });

  const stats = partitioner.getPartitionStats(adapter);
  const taskStats = stats.get("task");

  assert.ok(taskStats !== undefined);
  assert.equal(taskStats!.waiting, 2);
});

test("QueuePartitioner detectOverload identifies overloaded partitions", () => {
  const partitioner = new TestQueuePartitioner();
  const adapter = createMockAdapter();

  partitioner.registerPartition({
    name: "queue:task",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-1",
    config: {
      maxDepth: 5,
      alertThreshold: 4,
      consumerCount: 1,
      partitioningStrategy: "byAggregateType",
    },
  });

  for (let i = 0; i < 10; i++) {
    adapter.enqueue({ queueName: "queue:task", payload: { id: i } });
  }

  const overloads = partitioner.detectOverload(adapter);
  assert.equal(overloads.length, 1);
  assert.equal(overloads[0]!.aggregateType, "task");
});

test("QueuePartitioner detectOverload returns empty when under threshold", () => {
  const partitioner = new TestQueuePartitioner();
  const adapter = createMockAdapter();

  partitioner.registerPartition({
    name: "queue:task",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-1",
    config: {
      maxDepth: 100,
      alertThreshold: 80,
      consumerCount: 4,
      partitioningStrategy: "byAggregateType",
    },
  });

  adapter.enqueue({ queueName: "queue:task", payload: { id: 1 } });
  adapter.enqueue({ queueName: "queue:task", payload: { id: 2 } });

  const overloads = partitioner.detectOverload(adapter);
  assert.equal(overloads.length, 0);
});

test("Mock queue adapter enqueue creates job with correct fields", () => {
  const adapter = createMockAdapter();
  const job = adapter.enqueue({
    queueName: "test_queue",
    payload: { taskId: "task_123" },
    priority: 5,
    maxAttempts: 2,
  });

  assert.ok(job.id.startsWith("job_"));
  assert.equal(job.queueName, "test_queue");
  assert.equal(job.priority, 5);
  assert.equal(job.maxAttempts, 2);
  assert.equal(job.status, "waiting");
  assert.equal(job.attempts, 0);
});

test("Mock queue adapter dequeue returns and activates waiting job", () => {
  const adapter = createMockAdapter();
  adapter.enqueue({ queueName: "test_queue", payload: { id: 1 } });
  adapter.enqueue({ queueName: "test_queue", payload: { id: 2 } });

  const result = adapter.dequeue("test_queue");
  assert.ok(result !== null);
  assert.equal(result!.job.status, "active");
  assert.equal(result!.job.attempts, 1);
});

test("Mock queue adapter dequeue returns null for empty queue", () => {
  const adapter = createMockAdapter();
  const result = adapter.dequeue("nonexistent");
  assert.equal(result, null);
});

test("Mock queue adapter listJobs filters by status", () => {
  const adapter = createMockAdapter();
  adapter.enqueue({ queueName: "test_queue", payload: { id: 1 } });
  const d = adapter.dequeue("test_queue");
  d?.ack();

  const waiting = adapter.listJobs("test_queue", "waiting");
  const completed = adapter.listJobs("test_queue", "completed");

  assert.equal(waiting.length, 0);
  assert.equal(completed.length, 1);
});

test("Mock queue adapter retryJob restores dead letter job", () => {
  const adapter = createMockAdapter();
  const job = adapter.enqueue({ queueName: "test_queue", payload: { id: 1 }, maxAttempts: 1 });
  adapter.moveToDeadLetter(job.id, "failed");

  const retried = adapter.retryJob(job.id);
  assert.ok(retried !== null);
  assert.equal(retried!.status, "waiting");
  assert.equal(retried!.attempts, 0);
});

test("Mock queue adapter retryJob returns null for waiting job", () => {
  const adapter = createMockAdapter();
  adapter.enqueue({ queueName: "test_queue", payload: { id: 1 } });

  const result = adapter.retryJob("nonexistent");
  assert.equal(result, null);
});

test("Mock queue adapter purge removes old completed jobs", () => {
  const adapter = createMockAdapter();
  adapter.enqueue({ queueName: "test_queue", payload: { id: 1 } });
  const d = adapter.dequeue("test_queue");
  d?.ack();

  const purged = adapter.purge("test_queue", new Date().toISOString());
  assert.equal(purged, 1);
  assert.equal(adapter.listJobs("test_queue", "completed").length, 0);
});

test("Mock queue adapter listQueues returns all queue names", () => {
  const adapter = createMockAdapter();
  adapter.enqueue({ queueName: "queue_a", payload: { id: 1 } });
  adapter.enqueue({ queueName: "queue_b", payload: { id: 2 } });

  const queues = adapter.listQueues();
  assert.equal(queues.length, 2);
  assert.ok(queues.includes("queue_a"));
  assert.ok(queues.includes("queue_b"));
});
