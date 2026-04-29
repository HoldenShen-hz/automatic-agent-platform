import assert from "node:assert/strict";
import test from "node:test";
import { describe } from "node:test";

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

test("BulkheadIsolator exports are available", () => {
  assert.equal(typeof BulkheadIsolator, "function");
  assert.equal(typeof BulkheadRejectionError, "function");
  assert.equal(typeof BulkheadTimeoutError, "function");
  assert.equal(typeof BulkheadRegistry, "function");
  assert.equal(typeof globalBulkheadRegistry, "object");
});

test("DEFAULT_BULKHEAD_CONFIG has correct structure", () => {
  assert.equal(DEFAULT_BULKHEAD_CONFIG.maxConcurrentCalls, 100);
  assert.equal(DEFAULT_BULKHEAD_CONFIG.timeoutMs, 30_000);
  assert.equal(DEFAULT_BULKHEAD_CONFIG.queueSize, 50);
});

test("BulkheadIsolator executes function successfully", async () => {
  const isolator = new BulkheadIsolator("test-plane");
  const result = await isolator.execute(async () => "success");
  assert.equal(result, "success");
});

test("BulkheadIsolator tracks active calls", async () => {
  const isolator = new BulkheadIsolator("test-plane", { maxConcurrentCalls: 2 });

  const p1 = isolator.execute(async () => {
    await new Promise((r) => setTimeout(r, 50));
    return "p1";
  });
  const p2 = isolator.execute(async () => {
    await new Promise((r) => setTimeout(r, 50));
    return "p2";
  });

  const metrics = isolator.getMetrics();
  assert.ok(metrics.activeCalls >= 0);

  await Promise.all([p1, p2]);
});

test("BulkheadIsolator rejects when at capacity", async () => {
  const isolator = new BulkheadIsolator("test-plane", { maxConcurrentCalls: 1, queueSize: 0 });

  let release: () => void;
  const blocked = new Promise<void>((r) => { release = r; });

  const p1 = isolator.execute(async () => {
    await blocked;
    return "blocked";
  });

  // Ensure first call is running
  await new Promise((r) => setTimeout(r, 10));

  // Second call should be rejected because queueSize is 0
  await assert.rejects(
    async () => isolator.execute(async () => "should fail"),
    BulkheadRejectionError,
  );

  release!();
  await p1.catch(() => {});
});

test("BulkheadIsolator queues calls when at capacity but queue has space", async () => {
  const isolator = new BulkheadIsolator("test-plane", { maxConcurrentCalls: 1, queueSize: 1 });

  let resolving = false;
  const p1 = isolator.execute(async () => {
    while (!resolving) await new Promise((r) => setTimeout(r, 10));
    return "p1";
  });

  resolving = true;
  const result = await p1;
  assert.equal(result, "p1");
});

test("BulkheadIsolator reject count increases on rejection", async () => {
  const isolator = new BulkheadIsolator("test-plane", { maxConcurrentCalls: 1, queueSize: 0 });

  let release: () => void;
  const blocked = new Promise<void>((r) => { release = r; });

  const p1 = isolator.execute(async () => {
    await blocked;
    return "blocked";
  });

  await new Promise((r) => setTimeout(r, 10));

  try {
    await isolator.execute(async () => "should fail");
  } catch {
    // expected
  }

  release!();
  await p1.catch(() => {});

  const metrics = isolator.getMetrics();
  assert.ok(metrics.totalRejections >= 1);
});

test("BulkheadMetrics has correct structure", () => {
  const isolator = new BulkheadIsolator("test-plane");
  const metrics: BulkheadMetrics = isolator.getMetrics();

  assert.equal(typeof metrics.planeName, "string");
  assert.equal(typeof metrics.activeCalls, "number");
  assert.equal(typeof metrics.queuedCalls, "number");
  assert.equal(typeof metrics.totalRejections, "number");
  assert.equal(typeof metrics.averageWaitTimeMs, "number");
});

test("BulkheadIsolator resetMetrics clears rejections", async () => {
  const isolator = new BulkheadIsolator("test-plane", { maxConcurrentCalls: 1, queueSize: 0 });

  let release: () => void;
  const blocked = new Promise<void>((r) => { release = r; });

  const p1 = isolator.execute(async () => {
    await blocked;
    return "blocked";
  });

  await new Promise((r) => setTimeout(r, 10));

  try {
    await isolator.execute(async () => "should fail");
  } catch {
    // expected rejection
  }

  release!();
  await p1.catch(() => {});

  const metrics = isolator.getMetrics();
  assert.ok(metrics.totalRejections >= 1);

  isolator.resetMetrics();
  const afterReset = isolator.getMetrics();
  assert.equal(afterReset.totalRejections, 0);
});

test("BulkheadRegistry getOrCreate returns same instance", () => {
  const registry = new BulkheadRegistry();
  const isolator1 = registry.getOrCreate("plane-a");
  const isolator2 = registry.getOrCreate("plane-a");
  assert.strictEqual(isolator1, isolator2);
});

test("BulkheadRegistry getOrCreate returns different instances for different planes", () => {
  const registry = new BulkheadRegistry();
  const isolator1 = registry.getOrCreate("plane-a");
  const isolator2 = registry.getOrCreate("plane-b");
  assert.notStrictEqual(isolator1, isolator2);
});

test("BulkheadRegistry getAllMetrics returns metrics for all isolators", () => {
  const registry = new BulkheadRegistry();
  registry.getOrCreate("plane-a");
  registry.getOrCreate("plane-b");

  const allMetrics = registry.getAllMetrics();
  assert.equal(allMetrics.length, 2);
  assert.ok(allMetrics.some((m) => m.planeName === "plane-a"));
  assert.ok(allMetrics.some((m) => m.planeName === "plane-b"));
});

test("BulkheadIsolator uses custom config", () => {
  const customConfig: BulkheadConfig = {
    maxConcurrentCalls: 5,
    timeoutMs: 5000,
    queueSize: 10,
  };
  const isolator = new BulkheadIsolator("test-plane", customConfig);
  const metrics = isolator.getMetrics();
  assert.equal(metrics.planeName, "test-plane");
});

test("BulkheadRejectionError has correct properties", () => {
  const error = new BulkheadRejectionError("code", "message", "plane");
  assert.equal(error.code, "code");
  assert.equal(error.message, "message");
  assert.equal(error.planeName, "plane");
  assert.equal(error.name, "BulkheadRejectionError");
});

test("BulkheadTimeoutError has correct properties", () => {
  const error = new BulkheadTimeoutError("code", "message", "plane", 1000);
  assert.equal(error.code, "code");
  assert.equal(error.message, "message");
  assert.equal(error.planeName, "plane");
  assert.equal(error.timeoutMs, 1000);
  assert.equal(error.name, "BulkheadTimeoutError");
});

test("globalBulkheadRegistry is available", () => {
  assert.ok(globalBulkheadRegistry instanceof BulkheadRegistry);
});