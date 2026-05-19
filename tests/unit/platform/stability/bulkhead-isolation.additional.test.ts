import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  BulkheadIsolator,
  BulkheadRejectionError,
  BulkheadTimeoutError,
  BulkheadRegistry,
  globalBulkheadRegistry,
  DEFAULT_BULKHEAD_CONFIG,
  type BulkheadConfig,
  type BulkheadMetrics,
} from "../../../../src/platform/stability/bulkhead-isolation.js";

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("bulkhead-isolation additional tests", () => {
  describe("BulkheadIsolator concurrency limits", () => {
    test("respects maxConcurrentCalls limit", async () => {
      const isolator = new BulkheadIsolator("test-plane", { maxConcurrentCalls: 2, queueSize: 3 });

      let activeCount = 0;
      let maxActive = 0;
      let started = 0;
      const reachedLimit = createDeferred<void>();
      const releaseCalls = createDeferred<void>();

      const tasks = Array.from({ length: 5 }, async (_, i) => {
        return isolator.execute(async () => {
          activeCount++;
          maxActive = Math.max(maxActive, activeCount);
          started++;
          if (started === 2) {
            reachedLimit.resolve();
          }
          await releaseCalls.promise;
          activeCount--;
          return i;
        });
      });

      await reachedLimit.promise;
      assert.ok(maxActive <= 2, `Expected max 2 concurrent, got ${maxActive}`);
      releaseCalls.resolve();
      await Promise.all(tasks);
    });

    test("queues calls when at capacity and queue has space", async () => {
      const isolator = new BulkheadIsolator("test-plane", { maxConcurrentCalls: 1, queueSize: 2 });

      const firstCallStarted = createDeferred<void>();
      const releaseFirstCall = createDeferred<void>();

      const p1 = isolator.execute(async () => {
        firstCallStarted.resolve();
        await releaseFirstCall.promise;
        return "p1";
      });

      await firstCallStarted.promise;

      const metrics1 = isolator.getMetrics();
      assert.equal(metrics1.activeCalls, 1);

      // These should queue, not reject
      const p2 = isolator.execute(async () => "p2");
      const p3 = isolator.execute(async () => "p3");

      const metrics2 = isolator.getMetrics();
      assert.ok(metrics2.queuedCalls >= 1, "Expected calls to be queued");

      releaseFirstCall.resolve();
      const results = await Promise.all([p1, p2, p3]);
      assert.deepEqual(results, ["p1", "p2", "p3"]);
    });

    test("rejects when queue is full", async () => {
      const isolator = new BulkheadIsolator("test-plane", { maxConcurrentCalls: 1, queueSize: 1 });

      const firstCallStarted = createDeferred<void>();
      const releaseFirstCall = createDeferred<void>();

      const p1 = isolator.execute(async () => {
        firstCallStarted.resolve();
        await releaseFirstCall.promise;
        return "p1";
      });

      await firstCallStarted.promise;

      // This queues
      const p2 = isolator.execute(async () => "p2");

      // This should reject because queue is full
      await assert.rejects(
        async () => isolator.execute(async () => "p3"),
        BulkheadRejectionError,
      );

      releaseFirstCall.resolve();
      await Promise.all([p1, p2]).catch(() => {});
    });

    test("handles rapid execution and completion", async () => {
      const isolator = new BulkheadIsolator("test-plane", { maxConcurrentCalls: 10 });

      const results = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          isolator.execute(async () => {
            return i * 2;
          }),
        ),
      );

      assert.equal(results.length, 20);
      assert.ok(results.every((r) => r % 2 === 0));
    });

    test("timeout applies to active calls", async () => {
      const isolator = new BulkheadIsolator("test-plane", {
        maxConcurrentCalls: 1,
        queueSize: 1,
        timeoutMs: 50,
      });
      const neverResolves = createDeferred<void>();

      await assert.rejects(
        isolator.execute(async () => {
          await neverResolves.promise;
          return "slow";
        }),
        BulkheadTimeoutError,
      );
    });

    test("queued calls use the configured timeout as an end-to-end deadline", async () => {
      const isolator = new BulkheadIsolator("test-plane", {
        maxConcurrentCalls: 1,
        queueSize: 1,
        timeoutMs: 40,
      });
      const releaseFirstCall = createDeferred<void>();
      const firstCallStarted = createDeferred<void>();

      const firstCall = isolator.execute(async () => {
        firstCallStarted.resolve();
        await releaseFirstCall.promise;
        return "first";
      }).catch((error) => error);
      await firstCallStarted.promise;

      const queuedCall = isolator.execute(async () => "queued");

      await assert.rejects(queuedCall, (error: unknown) => {
        assert.ok(error instanceof BulkheadTimeoutError);
        assert.equal(error.timeoutMs, 40);
        return true;
      });

      releaseFirstCall.resolve();
      await firstCall;
    });

    test("timed out active calls keep capacity occupied until the underlying work settles", async () => {
      const isolator = new BulkheadIsolator("test-plane", {
        maxConcurrentCalls: 1,
        queueSize: 0,
        timeoutMs: 20,
      });
      const releaseSlowCall = createDeferred<void>();

      const slowCall = isolator.execute(async () => {
        await releaseSlowCall.promise;
        return "slow";
      });

      await assert.rejects(slowCall, BulkheadTimeoutError);
      assert.equal(isolator.getMetrics().activeCalls, 1);

      await assert.rejects(
        isolator.execute(async () => "second"),
        BulkheadRejectionError,
      );

      releaseSlowCall.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.equal(isolator.getMetrics().activeCalls, 0);
      assert.equal(await isolator.execute(async () => "recovered"), "recovered");
    });
  });

  describe("BulkheadMetrics accuracy", () => {
    test("tracks average wait time for queued calls", async () => {
      const isolator = new BulkheadIsolator("test-plane", { maxConcurrentCalls: 1, queueSize: 5 });

      const firstCallStarted = createDeferred<void>();
      const releaseFirstCall = createDeferred<void>();

      const p1 = isolator.execute(async () => {
        firstCallStarted.resolve();
        await releaseFirstCall.promise;
        return "p1";
      });

      await firstCallStarted.promise;

      // Queue several calls
      const queuedTasks = Array.from({ length: 3 }, async (_, i) => {
        return isolator.execute(async () => `task-${i}`);
      });

      releaseFirstCall.resolve();
      await Promise.all([p1, ...queuedTasks].map((t) => t.catch(() => {})));

      const metrics = isolator.getMetrics();
      // Wait time should be tracked (either 0 if already processed or > 0)
      assert.equal(typeof metrics.averageWaitTimeMs, "number");
    });

    test("metrics reflect zero state initially", () => {
      const isolator = new BulkheadIsolator("test-plane");
      const metrics = isolator.getMetrics();

      assert.equal(metrics.activeCalls, 0);
      assert.equal(metrics.queuedCalls, 0);
      assert.equal(metrics.totalRejections, 0);
    });
  });

  describe("BulkheadRegistry", () => {
    test("getOrCreate uses default config when no config provided", () => {
      const registry = new BulkheadRegistry();
      const isolator = registry.getOrCreate("test-plane");

      const metrics = isolator.getMetrics();
      assert.equal(metrics.planeName, "test-plane");
    });

    test("multiple registries are independent", () => {
      const registry1 = new BulkheadRegistry();
      const registry2 = new BulkheadRegistry();

      const isolator1 = registry1.getOrCreate("shared-name");
      const isolator2 = registry2.getOrCreate("shared-name");

      assert.notStrictEqual(isolator1, isolator2);
    });

    test("getAllMetrics returns empty array for new registry", () => {
      const registry = new BulkheadRegistry();
      const metrics = registry.getAllMetrics();
      assert.equal(Array.isArray(metrics), true);
      assert.equal(metrics.length, 0);
    });

    test("getOrCreate applies later config updates to an existing isolator", async () => {
      const registry = new BulkheadRegistry();
      const isolator = registry.getOrCreate("configurable-plane", { maxConcurrentCalls: 1, queueSize: 0, timeoutMs: 50 });
      const releaseFirstCall = createDeferred<void>();
      const firstCallStarted = createDeferred<void>();

      const firstCall = isolator.execute(async () => {
        firstCallStarted.resolve();
        await releaseFirstCall.promise;
        return "first";
      });
      await firstCallStarted.promise;

      registry.getOrCreate("configurable-plane", { queueSize: 1 });
      const queuedCall = isolator.execute(async () => "queued");

      releaseFirstCall.resolve();
      assert.equal(await queuedCall, "queued");
      await firstCall;
    });
  });

  describe("Error types", () => {
    test("BulkheadRejectionError is instance of Error", () => {
      const error = new BulkheadRejectionError("test-code", "test message", "test-plane");
      assert.ok(error instanceof Error);
      assert.equal(error.name, "BulkheadRejectionError");
    });

    test("BulkheadTimeoutError is instance of Error", () => {
      const error = new BulkheadTimeoutError("test-code", "test message", "test-plane", 5000);
      assert.ok(error instanceof Error);
      assert.equal(error.name, "BulkheadTimeoutError");
    });

    test("Both errors have correct code format", () => {
      const rejection = new BulkheadRejectionError("bulkhead:rejected:plane-a", "message", "plane-a");
      const timeout = new BulkheadTimeoutError("bulkhead:timeout:plane-a", "message", "plane-a", 30000);

      assert.ok(rejection.code.startsWith("bulkhead:rejected:"));
      assert.ok(timeout.code.startsWith("bulkhead:timeout:"));
    });
  });

  describe("globalBulkheadRegistry", () => {
    test("is singleton instance", () => {
      const instance1 = globalBulkheadRegistry;
      const instance2 = globalBulkheadRegistry;
      assert.strictEqual(instance1, instance2);
    });

    test("can register and retrieve isolators", () => {
      const isolator = globalBulkheadRegistry.getOrCreate("test-global-plane");
      assert.ok(isolator instanceof BulkheadIsolator);
    });
  });
});
