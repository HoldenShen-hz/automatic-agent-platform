import assert from "node:assert/strict";
import test from "node:test";

import {
  BulkheadIsolator,
  BulkheadRegistry,
  globalBulkheadRegistry,
} from "../../../../src/platform/stability/bulkhead-isolation.js";

test("BulkheadIsolator integration: global registry shared across calls", () => {
  const isolator1 = globalBulkheadRegistry.getOrCreate("shared-plane");
  const isolator2 = globalBulkheadRegistry.getOrCreate("shared-plane");

  assert.strictEqual(isolator1, isolator2);
});

test("BulkheadIsolator integration: multiple planes isolated from each other", () => {
  const isolatorA = globalBulkheadRegistry.getOrCreate("plane-a", { maxConcurrentCalls: 1, queueSize: 0 });
  const isolatorB = globalBulkheadRegistry.getOrCreate("plane-b", { maxConcurrentCalls: 1, queueSize: 0 });

  assert.notStrictEqual(isolatorA, isolatorB);

  const metricsA = isolatorA.getMetrics();
  const metricsB = isolatorB.getMetrics();

  assert.equal(metricsA.planeName, "plane-a");
  assert.equal(metricsB.planeName, "plane-b");
});

test("BulkheadIsolator integration: registry tracks all planes", () => {
  const registry = new BulkheadRegistry();

  registry.getOrCreate("plane-1");
  registry.getOrCreate("plane-2");
  registry.getOrCreate("plane-3");

  const allMetrics = registry.getAllMetrics();
  assert.equal(allMetrics.length, 3);
});

test("BulkheadIsolator integration: timeout propagates correctly", async () => {
  const isolator = new BulkheadIsolator("timeout-plane", {
    maxConcurrentCalls: 1,
    timeoutMs: 20,
    queueSize: 0,
  });

  await assert.rejects(
    async () =>
      isolator.execute(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return "slow";
      }),
    Error,
  );
});

test("BulkheadIsolator integration: metrics reflect actual state", async () => {
  const isolator = new BulkheadIsolator("metrics-plane", {
    maxConcurrentCalls: 10,
    timeoutMs: 1000,
    queueSize: 5,
  });

  const initialMetrics = isolator.getMetrics();
  assert.equal(initialMetrics.activeCalls, 0);
  assert.equal(initialMetrics.queuedCalls, 0);

  const p1 = isolator.execute(async () => {
    await new Promise((r) => setTimeout(r, 50));
    return "done";
  });

  await new Promise((r) => setTimeout(r, 10));

  const duringMetrics = isolator.getMetrics();
  assert.ok(duringMetrics.activeCalls >= 1);

  await p1;

  const finalMetrics = isolator.getMetrics();
  assert.equal(finalMetrics.activeCalls, 0);
});

test("BulkheadIsolator integration: execute completes successfully", async () => {
  const isolator = new BulkheadIsolator("success-plane", {
    maxConcurrentCalls: 10,
    timeoutMs: 1000,
    queueSize: 5,
  });

  const result = await isolator.execute(async () => "success");
  assert.equal(result, "success");
});