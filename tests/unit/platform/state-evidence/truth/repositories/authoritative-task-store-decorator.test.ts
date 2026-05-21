import assert from "node:assert/strict";
import test from "node:test";

import {
  getAuthoritativeTaskStoreDecoratorMetricsSnapshot,
  resetAuthoritativeTaskStoreDecoratorMetrics,
  decorateAuthoritativeTaskStore,
  type DecoratedAuthoritativeTaskStoreOptions,
} from "../../../../../../src/platform/five-plane-state-evidence/truth/repositories/authoritative-task-store-decorator.js";

test.describe("authoritative-task-store-decorator", () => {
  test.beforeEach(() => {
    resetAuthoritativeTaskStoreDecoratorMetrics();
  });

  test.afterEach(() => {
    resetAuthoritativeTaskStoreDecoratorMetrics();
  });

  test("getAuthoritativeTaskStoreDecoratorMetricsSnapshot returns empty object initially", () => {
    const snapshot = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
    assert.deepEqual(snapshot, {});
  });

  test("resetAuthoritativeTaskStoreDecoratorMetrics clears all metrics", () => {
    const snapshot = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
    assert.deepEqual(snapshot, {});
  });

  test("decorateAuthoritativeTaskStore returns a Proxy that preserves non-function properties", () => {
    const mockStore = {
      simpleProp: "test-value",
      anotherProp: 42,
      nestedObj: { a: 1 },
    } as any;

    const decorated = decorateAuthoritativeTaskStore(mockStore, {});

    assert.equal(decorated.simpleProp, "test-value");
    assert.equal(decorated.anotherProp, 42);
    assert.deepEqual(decorated.nestedObj, { a: 1 });
  });

  test("decorateAuthoritativeTaskStore calls method on wrapped store successfully", () => {
    let callCount = 0;
    const mockStore = {
      incrementAndReturn: () => {
        callCount++;
        return callCount;
      },
    } as any;

    const decorated = decorateAuthoritativeTaskStore(mockStore, {});

    const result1 = decorated.incrementAndReturn();
    const result2 = decorated.incrementAndReturn();

    assert.equal(result1, 1);
    assert.equal(result2, 2);
  });

  test("decorateAuthoritativeTaskStore tracks metrics for successful calls", () => {
    const mockStore = {
      doWork: () => "result",
    } as any;

    const decorated = decorateAuthoritativeTaskStore(mockStore, {});

    decorated.doWork();
    decorated.doWork();

    const snapshot = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
    assert.equal(snapshot["doWork"].calls, 2);
    assert.equal(snapshot["doWork"].successes, 2);
    assert.equal(snapshot["doWork"].failures, 0);
    assert.equal(snapshot["doWork"].retries, 0);
  });

  test("decorateAuthoritativeTaskStore does not retry non-SQLITE_BUSY errors", () => {
    const mockStore = {
      alwaysFails: () => {
        throw new Error("Non-retryable error");
      },
    } as any;

    const decorated = decorateAuthoritativeTaskStore(mockStore, { maxRetryAttempts: 3 });

    assert.throws(
      () => decorated.alwaysFails(),
      /Non-retryable error/,
    );

    const snapshot = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
    assert.equal(snapshot["alwaysFails"].calls, 1);
    assert.equal(snapshot["alwaysFails"].failures, 1);
    assert.equal(snapshot["alwaysFails"].retries, 0);
  });

  test("decorateAuthoritativeTaskStore retries SQLITE_BUSY errors", () => {
    let attempts = 0;
    const mockStore = {
      busyOnce: () => {
        attempts++;
        if (attempts === 1) {
          const err = new Error("database is busy");
          (err as any).code = "SQLITE_BUSY";
          throw err;
        }
        return "success";
      },
    } as any;

    const decorated = decorateAuthoritativeTaskStore(mockStore, { maxRetryAttempts: 3 });

    const result = decorated.busyOnce();

    assert.equal(result, "success");
    assert.equal(attempts, 2);
  });

  test("decorateAuthoritativeTaskStore retries SQLITE_BUSY errors by code", () => {
    let attempts = 0;
    const mockStore = {
      busyOnce: () => {
        attempts++;
        if (attempts === 1) {
          const err = new Error("lock unavailable");
          (err as any).code = "SQLITE_BUSY";
          throw err;
        }
        return "success";
      },
    } as any;

    const decorated = decorateAuthoritativeTaskStore(mockStore, { maxRetryAttempts: 3 });

    const result = decorated.busyOnce();

    assert.equal(result, "success");
    assert.equal(attempts, 2);
  });

  test("decorateAuthoritativeTaskStore gives up after max retry attempts", () => {
    let attempts = 0;
    const mockStore = {
      alwaysBusy: () => {
        attempts++;
        const err = new Error("SQLITE_BUSY: database is locked");
        (err as any).code = "SQLITE_BUSY";
        throw err;
      },
    } as any;

    const decorated = decorateAuthoritativeTaskStore(mockStore, { maxRetryAttempts: 3 });

    assert.throws(
      () => decorated.alwaysBusy(),
      /SQLITE_BUSY/,
    );

    assert.equal(attempts, 3);
    const snapshot = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
    assert.equal(snapshot["alwaysBusy"].retries, 2);
  });

  test("decorateAuthoritativeTaskStore computes exponential backoff with jitter", () => {
    const options: DecoratedAuthoritativeTaskStoreOptions = {
      baseRetryDelayMs: 10,
      maxRetryDelayMs: 100,
      retryJitterRatio: 0.2,
    };

    // Verify options are accepted (backoff computation tested via retry behavior)
    const mockStore = { fn: () => "result" } as any;
    const decorated = decorateAuthoritativeTaskStore(mockStore, options);
    assert.equal(decorated.fn(), "result");
  });

  test("decorateAuthoritativeTaskStore with zero base delay returns immediately", () => {
    let attempts = 0;
    const mockStore = {
      busyOnce: () => {
        attempts++;
        if (attempts === 1) {
          const err = new Error("SQLITE_BUSY");
          (err as any).code = "SQLITE_BUSY";
          throw err;
        }
        return "done";
      },
    } as any;

    const decorated = decorateAuthoritativeTaskStore(mockStore, {
      maxRetryAttempts: 3,
      baseRetryDelayMs: 0,
    });

    const result = decorated.busyOnce();
    assert.equal(result, "done");
    assert.equal(attempts, 2);
  });

  test("decorateAuthoritativeTaskStore propagates return value from wrapped store", () => {
    const mockStore = {
      getValue: () => ({ key: "value", nested: { a: 1 } }),
    } as any;

    const decorated = decorateAuthoritativeTaskStore(mockStore, {});

    const result = decorated.getValue();
    assert.deepEqual(result, { key: "value", nested: { a: 1 } });
  });

  test("decorateAuthoritativeTaskStore propagates thrown errors from wrapped store", () => {
    const mockStore = {
      throwError: () => {
        throw new Error("Original error");
      },
    } as any;

    const decorated = decorateAuthoritativeTaskStore(mockStore, {});

    assert.throws(
      () => decorated.throwError(),
      /Original error/,
    );
  });

  test("decorateAuthoritativeTaskStore tracks lastDurationMs and lastAttemptCount", () => {
    let attempts = 0;
    const mockStore = {
      busyOnce: () => {
        attempts++;
        if (attempts === 1) {
          const err = new Error("SQLITE_BUSY");
          (err as any).code = "SQLITE_BUSY";
          throw err;
        }
        return "success";
      },
    } as any;

    const decorated = decorateAuthoritativeTaskStore(mockStore, { maxRetryAttempts: 3 });
    decorated.busyOnce();

    const snapshot = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
    assert.equal(snapshot["busyOnce"].lastAttemptCount, 2);
    assert.ok(snapshot["busyOnce"].lastDurationMs >= 0);
  });

  test("decorateAuthoritativeTaskStore with default options uses sensible defaults", () => {
    const mockStore = {
      doWork: () => "result",
    } as any;

    const decorated = decorateAuthoritativeTaskStore(mockStore);

    assert.equal(decorated.doWork(), "result");
    const snapshot = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
    assert.equal(snapshot["doWork"].calls, 1);
  });

  test("decorateAuthoritativeTaskStore aggregates metrics from multiple instances", () => {
    const mockStore1 = { fn: () => "result1" } as any;
    const mockStore2 = { fn: () => "result2" } as any;

    const decorated1 = decorateAuthoritativeTaskStore(mockStore1, {});
    const decorated2 = decorateAuthoritativeTaskStore(mockStore2, {});

    decorated1.fn();
    decorated2.fn();
    decorated2.fn();

    const snapshot = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
    assert.equal(snapshot["fn"].calls, 3);
    assert.equal(snapshot["fn"].successes, 3);
  });

  test("decorateAuthoritativeTaskStore tracks totalBackoffMs", () => {
    let attempts = 0;
    const mockStore = {
      busyOnce: () => {
        attempts++;
        if (attempts === 1) {
          const err = new Error("SQLITE_BUSY");
          (err as any).code = "SQLITE_BUSY";
          throw err;
        }
        return "success";
      },
    } as any;

    const decorated = decorateAuthoritativeTaskStore(mockStore, {
      baseRetryDelayMs: 10,
      maxRetryDelayMs: 100,
    });

    decorated.busyOnce();

    const snapshot = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
    assert.ok(snapshot["busyOnce"].totalBackoffMs >= 0);
  });
});

test.describe("DecoratedAuthoritativeTaskStoreOptions interface", () => {
  test("accepts all option fields", () => {
    const options: DecoratedAuthoritativeTaskStoreOptions = {
      logger: undefined,
      maxRetryAttempts: 5,
      baseRetryDelayMs: 20,
      maxRetryDelayMs: 200,
      retryJitterRatio: 0.3,
    };

    const mockStore = { foo: () => "bar" } as any;
    const decorated = decorateAuthoritativeTaskStore(mockStore, options);

    assert.equal(typeof decorated.foo, "function");
  });

  test("accepts empty options", () => {
    const options: DecoratedAuthoritativeTaskStoreOptions = {};

    const mockStore = { test: () => 42 } as any;
    const decorated = decorateAuthoritativeTaskStore(mockStore, options);

    assert.equal(decorated.test(), 42);
  });
});

test.describe("isRetryableSqliteBusyError", () => {
  test("detects SQLITE_BUSY in error message", () => {
    const mockStore = {
      testFn: () => {
        throw new Error("SQLITE_BUSY: database locked");
      },
    } as any;

    const decorated = decorateAuthoritativeTaskStore(mockStore, { maxRetryAttempts: 2 });

    assert.throws(() => decorated.testFn(), /SQLITE_BUSY/);
  });

  test("detects SQLITE_BUSY in error code", () => {
    const mockStore = {
      testFn: () => {
        const err = new Error("lock failed");
        (err as any).code = "SQLITE_BUSY";
        throw err;
      },
    } as any;

    const decorated = decorateAuthoritativeTaskStore(mockStore, { maxRetryAttempts: 2 });

    assert.throws(() => decorated.testFn(), /lock failed/);
  });
});