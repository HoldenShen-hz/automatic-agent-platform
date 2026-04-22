/**
 * SYS-REL-2.4 Redis Queue Adapter Enqueue Pipeline Failure Tests
 *
 * Tests that Redis write failures propagate from enqueue pipeline to caller.
 *
 * Bug: redis-queue-adapter enqueue pipeline uses `.catch(() => {})` which means
 * write failures don't propagate to the caller. The enqueue() method returns
 * immediately after calling p.exec() with a detached error handler that swallows
 * exceptions.
 *
 * Note: These tests use pipeline exec() that returns error responses rather than
 * throwing, because the source code's p.exec().catch() only triggers when exec()
 * rejects. When exec() resolves with error responses, the catch is not invoked,
 * but the caller still receives a "success" job record despite the pipeline failures.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { StorageError } from "../../../../../src/platform/contracts/errors.js";
import { RedisQueueAdapter } from "../../../../../src/platform/execution/queue/redis-queue-adapter.js";
import { runtimeMetricsRegistry } from "../../../../../src/platform/shared/observability/runtime-metrics-registry.js";

// Helper type for mock pipeline
type MockPipeline = {
  hmset: () => MockPipeline;
  expire: () => MockPipeline;
  sadd: () => MockPipeline;
  zadd: () => MockPipeline;
  exec: () => Promise<Array<[Error | null, unknown]>>;
};

function getMockClient(adapter: RedisQueueAdapter) {
  return adapter as unknown as { client: { pipeline: () => MockPipeline; hmset: () => Promise<void>; expire: () => Promise<number>; sadd: () => Promise<number>; zadd: () => Promise<number> } };
}

function createMockPipeline(execResult: Array<[Error | null, unknown]>): MockPipeline {
  return {
    hmset: () => createMockPipeline(execResult),
    expire: () => createMockPipeline(execResult),
    sadd: () => createMockPipeline(execResult),
    zadd: () => createMockPipeline(execResult),
    exec: () => Promise.resolve(execResult),
  };
}

function isWrappedEnqueueFailure(err: unknown, expectedCauseFragment: string): boolean {
  if (!(err instanceof StorageError)) {
    return false;
  }
  const causeMessage = err.cause instanceof Error ? err.cause.message : "";
  return err.message === "queue.enqueue_failed"
    && err.code.includes("queue.enqueue_failed")
    && causeMessage.includes(expectedCauseFragment);
}

test("[SYS-REL-2.4] enqueue pipeline failure - job returned despite pipeline failure", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = getMockClient(adapter);

  // Mock pipeline to return error responses (not throw)
  let execCalled = false;
  mockClient.client.pipeline = () => {
    const pipeline = createMockPipeline([
      [new Error("READONLY You can't write against a read only replica"), null],
      [null, 1], // expire success
      [null, 1], // sadd success
      [new Error("WRONGTYPE Not a sorted set"), null], // zadd failure
    ]);
    // Override exec to track call
    return {
      ...pipeline,
      exec: async () => {
        execCalled = true;
        return [
          [new Error("READONLY You can't write against a read only replica"), null],
          [null, 1], // expire success
          [null, 1], // sadd success
          [new Error("WRONGTYPE Not a sorted set"), null], // zadd failure
        ];
      },
    };
  };

  // The sync enqueue() method returns immediately
  // The bug: pipeline errors don't prevent the job from being returned
  const result = adapter.enqueue({
    queueName: "test-queue",
    payload: { data: "test" },
  });

  // Result is returned despite pipeline failures (this is the bug)
  assert.ok(result, "enqueue returns a job record even when pipeline failed");
  assert.equal(result.queueName, "test-queue");
  assert.equal(result.status, "waiting");
  assert.equal(execCalled, true, "Pipeline exec was called");

  // The caller has no way to know the pipeline had errors
});

test("[SYS-REL-2.4] enqueue pipeline all commands fail - still returns job", async () => {
  runtimeMetricsRegistry.reset();
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = getMockClient(adapter).client;

  mockClient.pipeline = () => createMockPipeline([
        [new Error("ERR operation failed"), null],
        [new Error("ERR operation failed"), null],
        [new Error("ERR operation failed"), null],
        [new Error("ERR operation failed"), null],
      ]);

  // BUG: Job is returned even though ALL pipeline commands failed
  const result = adapter.enqueue({
    queueName: "all-fail-queue",
    payload: { test: "data" },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.ok(result, "Job record returned despite all pipeline failures");
  assert.equal(result.queueName, "all-fail-queue");
  assert.deepEqual(
    runtimeMetricsRegistry.getCounters("queue_enqueue_failures_total").map((series) => ({
      labels: series.labels,
      value: series.value,
    })),
    [{ labels: { backend: "redis", mode: "sync" }, value: 1 }],
  );
});

test("[SYS-REL-2.4] enqueueAsync properly propagates errors - contrast with enqueue", async () => {
  // This test shows the contrast: enqueueAsync properly awaits and throws
  // while enqueue swallows errors via detached promise
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = getMockClient(adapter).client;

  // Make hmset throw - enqueueAsync should catch this
  mockClient.hmset = async () => {
    throw new Error("HMSET failed - READONLY error");
  };

  // enqueueAsync properly propagates the error
  await assert.rejects(
    async () => {
      await adapter.enqueueAsync({
        queueName: "async-test-queue",
        payload: { data: "test" },
      });
    },
    (err: unknown) => isWrappedEnqueueFailure(err, "HMSET"),
  );
});

test("[SYS-REL-2.4] enqueueAsync expire error propagates", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = getMockClient(adapter).client;

  mockClient.hmset = async () => { return; };
  mockClient.expire = async () => {
    throw new Error("EXPIRE failed - key does not exist");
  };

  await assert.rejects(
    async () => {
      await adapter.enqueueAsync({
        queueName: "expire-async-queue",
        payload: { data: "test" },
      });
    },
    (err: unknown) => isWrappedEnqueueFailure(err, "EXPIRE"),
  );
});

test("[SYS-REL-2.4] enqueueAsync sadd error propagates", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = getMockClient(adapter).client;

  mockClient.hmset = async () => { return; };
  mockClient.expire = async () => { return 1; };
  mockClient.sadd = async () => {
    throw new Error("SADD failed - not a set");
  };

  await assert.rejects(
    async () => {
      await adapter.enqueueAsync({
        queueName: "sadd-async-queue",
        payload: { data: "test" },
      });
    },
    (err: unknown) => isWrappedEnqueueFailure(err, "SADD"),
  );
});

test("[SYS-REL-2.4] enqueueAsync zadd error propagates", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = getMockClient(adapter).client;

  mockClient.hmset = async () => { return; };
  mockClient.expire = async () => { return 1; };
  mockClient.sadd = async () => { return 1; };
  mockClient.zadd = async () => {
    throw new Error("ZADD failed - not a sorted set");
  };

  await assert.rejects(
    async () => {
      await adapter.enqueueAsync({
        queueName: "zadd-async-queue",
        payload: { data: "test" },
      });
    },
    (err: unknown) => isWrappedEnqueueFailure(err, "ZADD"),
  );
});

test("[SYS-REL-2.4] enqueue success path - verify happy case still works", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = getMockClient(adapter).client;

  let pipelineExecCalled = false;
  mockClient.pipeline = () => {
    const pipeline = createMockPipeline([
      [null, "OK"],
      [null, 1],
      [null, 1],
      [null, 1],
    ]);
    return {
      ...pipeline,
      exec: async () => {
        pipelineExecCalled = true;
        return [
          [null, "OK"],   // hmset success
          [null, 1],      // expire success
          [null, 1],      // sadd success
          [null, 1],      // zadd success
        ];
      },
    };
  };

  const result = adapter.enqueue({
    queueName: "success-queue",
    payload: { data: "test" },
  });

  // Verify success path still returns proper result
  assert.ok(result, "Job record should be returned on success");
  assert.equal(result.queueName, "success-queue");
  assert.equal(result.status, "waiting");
  assert.ok(result.id.startsWith("qjob"), "Job ID should be generated");
  assert.equal(pipelineExecCalled, true, "Pipeline exec should be called");
});

test("[SYS-REL-2.4] enqueue with delay - delayed job still gets pipeline error swallowed", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = getMockClient(adapter).client;

  mockClient.pipeline = () => createMockPipeline([
    [new Error("READONLY replica error"), null],
    [null, 1],
    [null, 1],
    [new Error("READONLY"), null],
  ]);

  const futureTime = new Date(Date.now() + 60000).toISOString();
  const result = adapter.enqueue({
    queueName: "delayed-queue",
    payload: { data: "delayed" },
    delayUntil: futureTime,
  });

  // BUG: Error swallowed even for delayed jobs
  assert.ok(result, "Job record returned despite pipeline failure");
  assert.equal(result.status, "delayed", "Delayed job should have delayed status");
  assert.ok(result.delayUntil, "delayUntil should be set");
});

test("[SYS-REL-2.4] enqueue with priority - pipeline error swallowed", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = getMockClient(adapter).client;

  mockClient.pipeline = () => createMockPipeline([
    [new Error("READONLY You can't write against a read only replica"), null],
    [null, 1],
    [null, 1],
    [new Error("READONLY"), null],
  ]);

  const result = adapter.enqueue({
    queueName: "priority-queue",
    payload: { data: "test" },
    priority: 10,
  });

  // BUG: Error swallowed, priority is ignored in sync enqueue anyway
  assert.ok(result, "Job record returned despite pipeline failure");
  assert.equal(result.priority, 10);
});

test("[SYS-REL-2.4] enqueue with idempotency key - pipeline error swallowed", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = getMockClient(adapter).client;

  mockClient.pipeline = () => createMockPipeline([
    [new Error("WRONGTYPE"), null],
    [null, 1],
    [null, 1],
    [new Error("WRONGTYPE"), null],
  ]);

  const result = adapter.enqueue({
    queueName: "idempotent-queue",
    payload: { data: "test" },
    idempotencyKey: "unique-key-123",
  });

  // BUG: Error swallowed even with idempotency key
  assert.ok(result, "Job record returned despite pipeline failure");
  assert.equal(result.idempotencyKey, "unique-key-123");
});

test("[SYS-REL-2.4] enqueue with maxAttempts - pipeline error swallowed", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = getMockClient(adapter).client;

  mockClient.pipeline = () => createMockPipeline([
    [new Error("ERR"), null],
    [null, 1],
    [null, 1],
    [new Error("ERR"), null],
  ]);

  const result = adapter.enqueue({
    queueName: "retry-queue",
    payload: { data: "test" },
    maxAttempts: 5,
  });

  // BUG: Error swallowed
  assert.ok(result, "Job record returned despite pipeline failure");
  assert.equal(result.maxAttempts, 5);
});

test("[SYS-REL-2.4] contrast - enqueueAsync shows proper error handling", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = getMockClient(adapter).client;

  // All enqueueAsync methods fail
  mockClient.hmset = async () => { return; };
  mockClient.expire = async () => { return 1; };
  mockClient.sadd = async () => { return 1; };
  mockClient.zadd = async () => {
    throw new Error("ZADD failed - not a sorted set");
  };

  // enqueueAsync properly propagates the error to caller
  await assert.rejects(
    async () => {
      await adapter.enqueueAsync({
        queueName: "proper-error-queue",
        payload: { data: "test" },
      });
    },
    (err: unknown) => isWrappedEnqueueFailure(err, "ZADD"),
  );
});
