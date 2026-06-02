import assert from "node:assert/strict";
import test from "node:test";

import { StorageError } from "../../../../../src/platform/contracts/errors.js";
import { RedisQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/redis-queue-adapter.js";
import { runtimeMetricsRegistry } from "../../../../../src/platform/shared/observability/runtime-metrics-registry.js";

function getMockClient(adapter: RedisQueueAdapter) {
  return adapter as unknown as {
    client: {
      hmset: () => Promise<void>;
      expire: () => Promise<number>;
      sadd: () => Promise<number>;
      zadd: () => Promise<number>;
    };
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

test("[SYS-REL-2.4] sync enqueue is fail-closed for Redis [enqueue-write-failure]", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  assert.throws(
    () => adapter.enqueue({
      queueName: "test-queue",
      payload: { data: "test" },
    }),
    /sync_enqueue_not_supported/,
  );
});

test("[SYS-REL-2.4] enqueueAsync hmset error propagates [enqueue-write-failure]", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = getMockClient(adapter).client;
  mockClient.hmset = async () => {
    throw new Error("HMSET failed - READONLY error");
  };

  await assert.rejects(
    () => adapter.enqueueAsync({
      queueName: "async-test-queue",
      payload: { data: "test" },
    }),
    (err: unknown) => isWrappedEnqueueFailure(err, "HMSET"),
  );
});

test("[SYS-REL-2.4] enqueueAsync expire error propagates [enqueue-write-failure]", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = getMockClient(adapter).client;

  mockClient.hmset = async () => { return; };
  mockClient.expire = async () => {
    throw new Error("EXPIRE failed - key does not exist");
  };

  await assert.rejects(
    () => adapter.enqueueAsync({
      queueName: "expire-async-queue",
      payload: { data: "test" },
    }),
    (err: unknown) => isWrappedEnqueueFailure(err, "EXPIRE"),
  );
});

test("[SYS-REL-2.4] enqueueAsync sadd error propagates [enqueue-write-failure]", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = getMockClient(adapter).client;

  mockClient.hmset = async () => { return; };
  mockClient.expire = async () => { return 1; };
  mockClient.sadd = async () => {
    throw new Error("SADD failed - not a set");
  };

  await assert.rejects(
    () => adapter.enqueueAsync({
      queueName: "sadd-async-queue",
      payload: { data: "test" },
    }),
    (err: unknown) => isWrappedEnqueueFailure(err, "SADD"),
  );
});

test("[SYS-REL-2.4] enqueueAsync zadd error propagates [enqueue-write-failure]", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = getMockClient(adapter).client;

  mockClient.hmset = async () => { return; };
  mockClient.expire = async () => { return 1; };
  mockClient.sadd = async () => { return 1; };
  mockClient.zadd = async () => {
    throw new Error("ZADD failed - not a sorted set");
  };

  await assert.rejects(
    () => adapter.enqueueAsync({
      queueName: "zadd-async-queue",
      payload: { data: "test" },
    }),
    (err: unknown) => isWrappedEnqueueFailure(err, "ZADD"),
  );
});

test("[SYS-REL-2.4] enqueueAsync records async failure metrics [enqueue-write-failure]", async () => {
  runtimeMetricsRegistry.reset();
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = getMockClient(adapter).client;

  mockClient.hmset = async () => {
    throw new Error("HMSET failed - metrics");
  };

  await assert.rejects(
    () => adapter.enqueueAsync({
      queueName: "metric-queue",
      payload: { data: "test" },
    }),
    /queue\.enqueue_failed/,
  );
  assert.deepEqual(
    runtimeMetricsRegistry.getCounters("queue_enqueue_failures_total").map((series) => ({
      labels: series.labels,
      value: series.value,
    })),
    [{ labels: { backend: "redis", mode: "async" }, value: 1 }],
  );
});

test("[SYS-REL-2.4] enqueueAsync success path still works [enqueue-write-failure]", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379, driver: "memory" });
  const result = await adapter.enqueueAsync({
    queueName: "success-queue",
    payload: { data: "test" },
    priority: 10,
  });

  assert.equal(result.queueName, "success-queue");
  assert.equal(result.status, "waiting");
  assert.equal(result.priority, 10);
  assert.ok(result.id.startsWith("qjob"));
  await adapter.close();
});

test("[SYS-REL-2.4] enqueueAsync rejects unsafe priority values [enqueue-write-failure]", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379, driver: "memory" });
  await assert.rejects(
    () => adapter.enqueueAsync({
      queueName: "priority-queue",
      payload: { data: "test" },
      priority: Number.MAX_SAFE_INTEGER,
    }),
    /queue\.priority_out_of_range/,
  );
  await adapter.close();
});
