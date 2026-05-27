import assert from "node:assert/strict";
import test from "node:test";

import { CacheMetrics } from "../../../../../src/platform/shared/cache/cache-metrics.js";

test("CacheMetrics records hits, misses, layers, and reasons by namespace", () => {
  const metrics = new CacheMetrics();

  metrics.record({ hit: true, namespace: "tasks", layer: "memory" });
  metrics.record({ hit: false, namespace: "tasks", reason: "expired" });
  metrics.record({ hit: true, namespace: "workers", layer: "redis" });

  const snapshot = metrics.snapshot();
  assert.equal(snapshot.totalHits, 2);
  assert.equal(snapshot.totalMisses, 1);
  assert.equal(snapshot.byNamespace.tasks?.hits, 1);
  assert.equal(snapshot.byNamespace.tasks?.misses, 1);
  assert.equal(snapshot.byNamespace.tasks?.byLayer.memory, 1);
  assert.equal(snapshot.byNamespace.tasks?.byReason.expired, 1);
  assert.equal(snapshot.byNamespace.workers?.byLayer.redis, 1);
});

test("CacheMetrics uses an unknown namespace fallback and zero hit rate when empty", () => {
  const metrics = new CacheMetrics();
  assert.equal(metrics.snapshot().hitRate, 0);

  metrics.record({ hit: false });
  const snapshot = metrics.snapshot();
  assert.equal(snapshot.byNamespace.unknown?.misses, 1);
  assert.equal(snapshot.byNamespace.unknown?.hitRate, 0);
});

test("CacheMetrics reset clears accumulated counters", () => {
  const metrics = new CacheMetrics();
  metrics.record({ hit: true, namespace: "tasks", layer: "memory" });
  metrics.reset();

  const snapshot = metrics.snapshot();
  assert.equal(snapshot.totalHits, 0);
  assert.equal(snapshot.totalMisses, 0);
  assert.deepEqual(snapshot.byNamespace, {});
});
