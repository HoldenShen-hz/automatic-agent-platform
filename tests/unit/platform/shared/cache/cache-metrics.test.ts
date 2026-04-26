/**
 * Additional unit tests for CacheMetrics - edge cases and boundary conditions
 */

import assert from "node:assert/strict";
import test from "node:test";
import { CacheMetrics } from "../../../../../src/platform/shared/cache/cache-metrics.js";

test("CacheMetrics snapshot with empty byNamespace returns empty object", () => {
  const metrics = new CacheMetrics();
  const snapshot = metrics.snapshot();

  assert.deepEqual(snapshot.byNamespace, {});
});

test("CacheMetrics record with undefined namespace uses unknown", () => {
  const metrics = new CacheMetrics();
  metrics.record({ hit: true });

  const snapshot = metrics.snapshot();
  assert.ok(snapshot.byNamespace["unknown"]);
  assert.equal(snapshot.byNamespace["unknown"]!.hits, 1);
});

test("CacheMetrics record increments byNamespace counters correctly", () => {
  const metrics = new CacheMetrics();

  metrics.record({ namespace: "test", hit: true });
  metrics.record({ namespace: "test", hit: true });
  metrics.record({ namespace: "test", hit: false });

  const snapshot = metrics.snapshot();
  assert.equal(snapshot.byNamespace["test"]!.hits, 2);
  assert.equal(snapshot.byNamespace["test"]!.misses, 1);
});

test("CacheMetrics record tracks byLayer for hits", () => {
  const metrics = new CacheMetrics();

  metrics.record({ namespace: "ns", hit: true, layer: "L1" });
  metrics.record({ namespace: "ns", hit: true, layer: "L1" });
  metrics.record({ namespace: "ns", hit: true, layer: "L2" });

  const snapshot = metrics.snapshot();
  assert.equal(snapshot.byNamespace["ns"]!.byLayer?.["L1"], 2);
  assert.equal(snapshot.byNamespace["ns"]!.byLayer?.["L2"], 1);
});

test("CacheMetrics record tracks byReason for misses", () => {
  const metrics = new CacheMetrics();

  metrics.record({ namespace: "ns", hit: false, reason: "not_found" });
  metrics.record({ namespace: "ns", hit: false, reason: "not_found" });
  metrics.record({ namespace: "ns", hit: false, reason: "expired" });

  const snapshot = metrics.snapshot();
  assert.equal(snapshot.byNamespace["ns"]!.byReason?.["not_found"], 2);
  assert.equal(snapshot.byNamespace["ns"]!.byReason?.["expired"], 1);
});

test("CacheMetrics snapshot hitRate is 0 when no records", () => {
  const metrics = new CacheMetrics();
  const snapshot = metrics.snapshot();

  assert.equal(snapshot.hitRate, 0);
});

test("CacheMetrics snapshot hitRate is 1 when all hits", () => {
  const metrics = new CacheMetrics();
  metrics.record({ namespace: "ns", hit: true });
  metrics.record({ namespace: "ns", hit: true });

  const snapshot = metrics.snapshot();
  assert.equal(snapshot.hitRate, 1);
});

test("CacheMetrics snapshot hitRate is 0.5 with mixed records", () => {
  const metrics = new CacheMetrics();
  metrics.record({ namespace: "ns", hit: true });
  metrics.record({ namespace: "ns", hit: false });

  const snapshot = metrics.snapshot();
  assert.equal(snapshot.hitRate, 0.5);
});

test("CacheMetrics namespace hitRate calculated correctly", () => {
  const metrics = new CacheMetrics();

  // ns1: 3 hits, 1 miss = 0.75
  metrics.record({ namespace: "ns1", hit: true });
  metrics.record({ namespace: "ns1", hit: true });
  metrics.record({ namespace: "ns1", hit: true });
  metrics.record({ namespace: "ns1", hit: false });

  // ns2: 1 hit, 3 misses = 0.25
  metrics.record({ namespace: "ns2", hit: true });
  metrics.record({ namespace: "ns2", hit: false });
  metrics.record({ namespace: "ns2", hit: false });
  metrics.record({ namespace: "ns2", hit: false });

  const snapshot = metrics.snapshot();

  assert.equal(snapshot.byNamespace["ns1"]!.hitRate, 0.75);
  assert.equal(snapshot.byNamespace["ns2"]!.hitRate, 0.25);
});

test("CacheMetrics reset clears all counters", () => {
  const metrics = new CacheMetrics();

  metrics.record({ namespace: "ns1", hit: true });
  metrics.record({ namespace: "ns2", hit: false });

  metrics.reset();

  const snapshot = metrics.snapshot();
  assert.equal(snapshot.totalHits, 0);
  assert.equal(snapshot.totalMisses, 0);
  assert.deepEqual(snapshot.byNamespace, {});
});

test("CacheMetrics reset can be called multiple times safely", () => {
  const metrics = new CacheMetrics();

  metrics.record({ namespace: "test", hit: true });

  metrics.reset();
  metrics.reset();
  metrics.reset();

  const snapshot = metrics.snapshot();
  assert.equal(snapshot.totalHits, 0);
});

test("CacheMetrics multiple namespaces are independent", () => {
  const metrics = new CacheMetrics();

  metrics.record({ namespace: "a", hit: true });
  metrics.record({ namespace: "b", hit: true });
  metrics.record({ namespace: "c", hit: true });

  const snapshot = metrics.snapshot();

  assert.equal(Object.keys(snapshot.byNamespace).length, 3);
  assert.equal(snapshot.byNamespace["a"]!.hits, 1);
  assert.equal(snapshot.byNamespace["b"]!.hits, 1);
  assert.equal(snapshot.byNamespace["c"]!.hits, 1);
});

test("CacheMetrics byLayer is undefined when no layers recorded", () => {
  const metrics = new CacheMetrics();
  metrics.record({ namespace: "test", hit: true });

  const snapshot = metrics.snapshot();
  assert.strictEqual(snapshot.byNamespace["test"]!.byLayer, undefined);
});

test("CacheMetrics byReason is undefined when no reasons recorded", () => {
  const metrics = new CacheMetrics();
  metrics.record({ namespace: "test", hit: false });

  const snapshot = metrics.snapshot();
  assert.ok(snapshot.byNamespace["test"]!.byReason !== undefined);
});

test("CacheMetrics record new namespace creates empty byLayer and byReason objects", () => {
  const metrics = new CacheMetrics();
  metrics.record({ namespace: "new-ns", hit: true });

  const snapshot = metrics.snapshot();
  assert.ok(snapshot.byNamespace["new-ns"]);
  // byLayer is undefined for hit-only records
  assert.strictEqual(snapshot.byNamespace["new-ns"]!.byLayer, undefined);
});

test("CacheMetrics snapshot returns correct structure", () => {
  const metrics = new CacheMetrics();
  metrics.record({ namespace: "test", hit: true });

  const snapshot = metrics.snapshot();

  assert.ok("totalHits" in snapshot);
  assert.ok("totalMisses" in snapshot);
  assert.ok("hitRate" in snapshot);
  assert.ok("byNamespace" in snapshot);
});

test("CacheMetrics record increments total correctly", () => {
  const metrics = new CacheMetrics();

  metrics.record({ hit: true });
  metrics.record({ hit: true });
  metrics.record({ hit: false });

  const snapshot = metrics.snapshot();
  assert.equal(snapshot.totalHits, 2);
  assert.equal(snapshot.totalMisses, 1);
});

test("CacheMetrics byNamespace entries have correct structure", () => {
  const metrics = new CacheMetrics();
  metrics.record({ namespace: "test", hit: true });

  const snapshot = metrics.snapshot();
  const ns = snapshot.byNamespace["test"];

  assert.ok("hits" in ns!);
  assert.ok("misses" in ns!);
  assert.ok("hitRate" in ns!);
  assert.ok("byLayer" in ns!);
  assert.ok("byReason" in ns!);
});