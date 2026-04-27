import assert from "node:assert/strict";
import test from "node:test";

import {
  getAuthoritativeTaskStoreDecoratorMetricsSnapshot,
  resetAuthoritativeTaskStoreDecoratorMetrics,
  decorateAuthoritativeTaskStore,
  type DecoratedAuthoritativeTaskStoreOptions,
} from "../../../../../../src/platform/state-evidence/truth/repositories/authoritative-task-store-decorator.js";

test("getAuthoritativeTaskStoreDecoratorMetricsSnapshot returns empty object initially", () => {
  resetAuthoritativeTaskStoreDecoratorMetrics();
  const snapshot = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
  assert.deepEqual(snapshot, {});
});

test("resetAuthoritativeTaskStoreDecoratorMetrics clears all metrics", () => {
  resetAuthoritativeTaskStoreDecoratorMetrics();
  const snapshot = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
  assert.deepEqual(snapshot, {});
});

test("decorateAuthoritativeTaskStore returns a Proxy", () => {
  // Create a minimal mock store
  const mockStore = {
    testMethod: () => "result",
    property: "value",
  };

  const options: DecoratedAuthoritativeTaskStoreOptions = {
    maxRetryAttempts: 3,
    baseRetryDelayMs: 10,
    maxRetryDelayMs: 100,
  };

  const decorated = decorateAuthoritativeTaskStore(mockStore as any, options);

  // Should return a Proxy
  assert.equal(typeof decorated, "object");
  assert.equal(typeof decorated.testMethod, "function");
  assert.equal(decorated.property, "value");
});

test("decorateAuthoritativeTaskStore preserves non-function properties", () => {
  const mockStore = {
    simpleProp: "test-value",
    anotherProp: 42,
  } as any;

  const decorated = decorateAuthoritativeTaskStore(mockStore, {});

  assert.equal(decorated.simpleProp, "test-value");
  assert.equal(decorated.anotherProp, 42);
});

test("decorateAuthoritativeTaskStore calls method on wrapped store", () => {
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

test("DecoratedAuthoritativeTaskStoreOptions interface is usable", () => {
  // Verify the interface structure
  const options: DecoratedAuthoritativeTaskStoreOptions = {
    maxRetryAttempts: 5,
    baseRetryDelayMs: 20,
    maxRetryDelayMs: 200,
    retryJitterRatio: 0.3,
  };

  const mockStore = { foo: () => "bar" } as any;
  const decorated = decorateAuthoritativeTaskStore(mockStore, options);

  assert.equal(typeof decorated.foo, "function");
});