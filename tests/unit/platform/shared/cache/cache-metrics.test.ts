/**
 * Additional unit tests for CacheMetrics - covering more edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CacheMetrics } from "../../../../../src/platform/shared/cache/cache-metrics.js";

test("CacheMetrics snapshot with no records returns zero values", () => {
  const metrics = new CacheMetrics();
  const snapshot = metrics.snapshot();

  assert.equal(snapshot.totalHits, 0);
  assert.equal(snapshot.totalMisses, 0);
  assert.equal(snapshot.hitRate, 0);
});

test("CacheMetrics records with layer information", () => {
  const metrics = new CacheMetrics();

  metrics.record({ namespace: "test", hit: true, layer: "L1" });
  metrics.record({ namespace: "test", hit: true, layer: "L2" });
  metrics.record({ namespace: "test", hit: true, layer: "L3" });

  const snapshot = metrics.snapshot();

  assert.equal(snapshot.totalHits, 3);
  assert.equal(snapshot.byNamespace["test"]!.byLayer?.["L1"], 1);
  assert.equal(snapshot.byNamespace["test"]!.byLayer?.["L2"], 1);
  assert.equal(snapshot.byNamespace["test"]!.byLayer?.["L3"], 1);
});

test("CacheMetrics records with different reasons for same namespace", () => {
  const metrics = new CacheMetrics();

  metrics.record({ namespace: "test", hit: false, reason: "not_found" });
  metrics.record({ namespace: "test", hit: false, reason: "not_found" });
  metrics.record({ namespace: "test", hit: false, reason: "expired" });
  metrics.record({ namespace: "test", hit: false, reason: "disabled" });

  const snapshot = metrics.snapshot();

  assert.equal(snapshot.totalMisses, 4);
  assert.equal(snapshot.byNamespace["test"]!.byReason?.["not_found"], 2);
  assert.equal(snapshot.byNamespace["test"]!.byReason?.["expired"], 1);
  assert.equal(snapshot.byNamespace["test"]!.byReason?.["disabled"], 1);
});

test("CacheMetrics hit rate calculation edge case - all misses", () => {
  const metrics = new CacheMetrics();

  metrics.record({ namespace: "test", hit: false });
  metrics.record({ namespace: "test", hit: false });
  metrics.record({ namespace: "test", hit: false });

  const snapshot = metrics.snapshot();

  assert.equal(snapshot.hitRate, 0);
  assert.equal(snapshot.totalHits, 0);
  assert.equal(snapshot.totalMisses, 3);
});

test("CacheMetrics hit rate calculation edge case - all hits", () => {
  const metrics = new CacheMetrics();

  metrics.record({ namespace: "test", hit: true });
  metrics.record({ namespace: "test", hit: true });

  const snapshot = metrics.snapshot();

  assert.equal(snapshot.hitRate, 1);
  assert.equal(snapshot.totalHits, 2);
  assert.equal(snapshot.totalMisses, 0);
});

test("CacheMetrics tracks multiple namespaces independently", () => {
  const metrics = new CacheMetrics();

  metrics.record({ namespace: "ns1", hit: true });
  metrics.record({ namespace: "ns1", hit: false });
  metrics.record({ namespace: "ns2", hit: true });
  metrics.record({ namespace: "ns2", hit: true });

  const snapshot = metrics.snapshot();

  assert.equal(snapshot.totalHits, 3);
  assert.equal(snapshot.totalMisses, 1);
  assert.equal(snapshot.byNamespace["ns1"]!.hits, 1);
  assert.equal(snapshot.byNamespace["ns1"]!.misses, 1);
  assert.equal(snapshot.byNamespace["ns2"]!.hits, 2);
  assert.equal(snapshot.byNamespace["ns2"]!.misses, 0);
});

test("CacheMetrics namespace hit rate calculated independently", () => {
  const metrics = new CacheMetrics();

  metrics.record({ namespace: "ns1", hit: true });
  metrics.record({ namespace: "ns2", hit: true });
  metrics.record({ namespace: "ns2", hit: false });

  const snapshot = metrics.snapshot();

  // Overall hit rate: 2 hits / 3 total = 0.667
  assert.equal(snapshot.hitRate, 2/3);
  // ns1: 1 hit / 1 total = 1.0
  assert.equal(snapshot.byNamespace["ns1"]!.hitRate, 1);
  // ns2: 1 hit / 2 total = 0.5
  assert.equal(snapshot.byNamespace["ns2"]!.hitRate, 0.5);
});

test("CacheMetrics records without layer still track hit", () => {
  const metrics = new CacheMetrics();

  metrics.record({ namespace: "test", hit: true });
  metrics.record({ namespace: "test", hit: true, layer: "L1" as const });

  const snapshot = metrics.snapshot();

  assert.equal(snapshot.totalHits, 2);
  assert.ok(snapshot.byNamespace["test"]!.byLayer === undefined);
});

test("CacheMetrics records without reason still track miss", () => {
  const metrics = new CacheMetrics();

  metrics.record({ namespace: "test", hit: false });
  metrics.record({ namespace: "test", hit: false, reason: "not_found" as const });

  const snapshot = metrics.snapshot();

  assert.equal(snapshot.totalMisses, 2);
  assert.ok(snapshot.byNamespace["test"]!.byReason !== undefined);
});

test("CacheMetrics reset affects subsequent snapshot", () => {
  const metrics = new CacheMetrics();

  metrics.record({ namespace: "test", hit: true });
  metrics.record({ namespace: "test", hit: true });

  metrics.reset();

  metrics.record({ namespace: "test", hit: false });

  const snapshot = metrics.snapshot();

  assert.equal(snapshot.totalHits, 0);
  assert.equal(snapshot.totalMisses, 1);
});

test("CacheMetrics multiple reset calls are idempotent", () => {
  const metrics = new CacheMetrics();

  metrics.record({ namespace: "test", hit: true });

  metrics.reset();
  metrics.reset();
  metrics.reset();

  const snapshot = metrics.snapshot();

  assert.equal(snapshot.totalHits, 0);
  assert.deepEqual(Object.keys(snapshot.byNamespace), []);
});