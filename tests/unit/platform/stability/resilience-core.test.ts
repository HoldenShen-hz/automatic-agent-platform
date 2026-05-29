import assert from "node:assert/strict";
import test from "node:test";

import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  CircuitBreakerResetError,
  CircuitBreakerTimeoutError,
  CircuitState,
} from "../../../../src/platform/stability/circuit-breaker.js";
import { Retry, RetryAbortError } from "../../../../src/platform/stability/retry.js";
import {
  CircuitBreaker as ReliabilityCircuitBreaker,
  CircuitState as ReliabilityCircuitState,
} from "../../../../src/platform/stability/reliability/circuit-breaker.js";

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("Retry.getStats reflects the most recent execution", async () => {
  const retry = new Retry({ maxAttempts: 3, initialDelayMs: 1, jitterFactor: 0 });
  let attempts = 0;

  const result = await retry.execute(async () => {
    attempts += 1;
    if (attempts < 3) {
      throw new Error(`fail-${attempts}`);
    }
    return "ok";
  });

  assert.equal(result, "ok");
  assert.deepEqual(retry.getStats().successfulAttempts, 1);
  assert.deepEqual(retry.getStats().failedAttempts, 2);
  assert.deepEqual(retry.getStats().totalAttempts, 3);
});

test("Retry.execute aborts while sleeping between attempts", async () => {
  const retry = new Retry({ maxAttempts: 3, initialDelayMs: 50, jitterFactor: 0 });
  const controller = new AbortController();
  let attempts = 0;

  const promise = retry.execute(
    async () => {
      attempts += 1;
      if (attempts === 1) {
        setTimeout(() => controller.abort(new RetryAbortError("cancelled")), 5);
      }
      throw new Error("retryable");
    },
    undefined,
    { signal: controller.signal },
  );

  await assert.rejects(promise, /cancelled/);
  assert.equal(attempts, 1);
});

test("Retry jitter never sleeps below the configured initial delay", async () => {
  const retry = new Retry({ maxAttempts: 2, initialDelayMs: 40, jitterFactor: 1 });
  const originalRandom = Math.random;
  Math.random = () => 0;
  const startedAt = Date.now();

  try {
    await assert.rejects(
      retry.execute(async () => {
        throw new Error("fail");
      }),
      /fail/,
    );
  } finally {
    Math.random = originalRandom;
  }

  assert.ok(Date.now() - startedAt >= 35);
});

test("CircuitBreaker aborts timed out work via AbortSignal", async () => {
  const breaker = new CircuitBreaker({ timeout: 20 });
  const aborted = createDeferred<void>();

  await assert.rejects(
    breaker.execute(
      (signal) => new Promise<string>((_, reject) => {
        signal?.addEventListener("abort", () => {
          aborted.resolve();
          reject(signal.reason);
        }, { once: true });
      }),
    ),
    CircuitBreakerTimeoutError,
  );

  await aborted.promise;
});

test("CircuitBreaker state change callback reports correct previous state", async () => {
  const transitions: Array<[CircuitState, CircuitState]> = [];
  const breaker = new CircuitBreaker({
    failureThreshold: 1,
    onStateChange: (previousState, newState) => {
      transitions.push([previousState, newState]);
    },
  });

  await assert.rejects(
    breaker.execute(async () => {
      throw new Error("boom");
    }),
    /boom/,
  );

  assert.deepEqual(transitions, [[CircuitState.CLOSED, CircuitState.OPEN]]);
});

test("CircuitBreaker allows only one half-open probe at a time", async () => {
  const breaker = new CircuitBreaker({
    failureThreshold: 1,
    successThreshold: 1,
    resetTimeout: 10,
    timeout: 100,
  });
  const releaseProbe = createDeferred<void>();

  await assert.rejects(
    breaker.execute(async () => {
      throw new Error("open");
    }),
    /open/,
  );

  await new Promise((resolve) => setTimeout(resolve, 15));

  const firstProbe = breaker.execute(async () => {
    await releaseProbe.promise;
    return "probe-ok";
  });

  await assert.rejects(
    breaker.execute(async () => "second-probe"),
    CircuitBreakerOpenError,
  );

  releaseProbe.resolve();
  assert.equal(await firstProbe, "probe-ok");
  assert.equal(breaker.getState(), CircuitState.CLOSED);
});

test("CircuitBreaker.reset aborts in-flight work and keeps the circuit closed", async () => {
  const breaker = new CircuitBreaker({ timeout: 100 });
  const started = createDeferred<void>();

  const pending = breaker.execute(
    (signal) => new Promise<string>((_, reject) => {
      started.resolve();
      signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
    }),
  );

  await started.promise;
  breaker.reset();

  await assert.rejects(pending, CircuitBreakerResetError);
  assert.equal(breaker.getState(), CircuitState.CLOSED);
});

test("Reliability CircuitBreaker emits the real previous and next states", async () => {
  const transitions: Array<[ReliabilityCircuitState, ReliabilityCircuitState]> = [];
  const breaker = new ReliabilityCircuitBreaker({
    failureThreshold: 1,
    onStateChange: (previousState, newState) => {
      transitions.push([previousState, newState]);
    },
  });

  await assert.rejects(
    breaker.execute(async () => {
      throw new Error("boom");
    }),
    /boom/,
  );

  assert.deepEqual(transitions, [[ReliabilityCircuitState.CLOSED, ReliabilityCircuitState.OPEN]]);
});

test("Reliability CircuitBreaker reset clears stale stats", async () => {
  const breaker = new ReliabilityCircuitBreaker({ failureThreshold: 1 });

  await assert.rejects(
    breaker.execute(async () => {
      throw new Error("boom");
    }),
    /boom/,
  );

  breaker.reset();

  assert.deepEqual(breaker.getStats(), {
    state: ReliabilityCircuitState.CLOSED,
    failures: 0,
    successes: 0,
    lastFailure: null,
    lastSuccess: null,
  });
});
