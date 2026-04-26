import assert from "node:assert/strict";
import test from "node:test";

import { CacheMetrics, type CacheMetricEntry } from "../../../../../src/platform/shared/cache/cache-metrics.js";

test("CacheMetrics", () => {
  const metrics = new CacheMetrics();

  test("record increments hits when hit is true", () => {
    metrics.record({ hit: true, namespace: "test" });
    const snap = metrics.snapshot();
    assert.equal(snap.totalHits, 1);
    assert.equal(snap.totalMisses, 0);
    assert.equal(snap.byNamespace["test"].hits, 1);
  });

  test("record increments misses when hit is false", () => {
    metrics.record({ hit: false, namespace: "test", reason: "disabled" });
    const snap = metrics.snapshot();
    assert.equal(snap.totalHits, 0);
    assert.equal(snap.totalMisses, 1);
    assert.equal(snap.byNamespace["test"].misses, 1);
  });

  test("hitRate is calculated correctly", () => {
    metrics.record({ hit: true, namespace: "a" });
    metrics.record({ hit: true, namespace: "a" });
    metrics.record({ hit: false, namespace: "a" });
    metrics.record({ hit: false, namespace: "a" });
    const snap = metrics.snapshot();
    assert.equal(snap.hitRate, 0.5);
    assert.equal(snap.byNamespace["a"].hitRate, 0.5);
  });

  test("record tracks layer distribution", () => {
    metrics.record({ hit: true, namespace: "layer-test", layer: "L1" });
    metrics.record({ hit: true, namespace: "layer-test", layer: "L2" });
    metrics.record({ hit: true, namespace: "layer-test", layer: "L1" });
    const snap = metrics.snapshot();
    assert.equal(snap.byNamespace["layer-test"].byLayer["L1"], 2);
    assert.equal(snap.byNamespace["layer-test"].byLayer["L2"], 1);
  });

  test("record tracks miss reason distribution", () => {
    metrics.record({ hit: false, namespace: "reason-test", reason: "disabled" });
    metrics.record({ hit: false, namespace: "reason-test", reason: "disabled" });
    metrics.record({ hit: false, namespace: "reason-test", reason: "expired" });
    const snap = metrics.snapshot();
    assert.equal(snap.byNamespace["reason-test"].byReason["disabled"], 2);
    assert.equal(snap.byNamespace["reason-test"].byReason["expired"], 1);
  });

  test("reset clears all counters", () => {
    metrics.record({ hit: true, namespace: "reset-test" });
    metrics.reset();
    const snap = metrics.snapshot();
    assert.equal(snap.totalHits, 0);
    assert.equal(snap.totalMisses, 0);
    assert.deepEqual(snap.byNamespace, {});
  });

  test("snapshot returns correct total across namespaces", () => {
    metrics.reset();
    metrics.record({ hit: true, namespace: "ns1" });
    metrics.record({ hit: false, namespace: "ns2" });
    metrics.record({ hit: true, namespace: "ns2" });
    const snap = metrics.snapshot();
    assert.equal(snap.totalHits, 2);
    assert.equal(snap.totalMisses, 1);
  });

  test("hitRate is 0 when no entries", () => {
    const snap = metrics.snapshot();
    assert.equal(snap.hitRate, 0);
  });

  test("namespace defaults to unknown when not provided", () => {
    metrics.record({ hit: true });
    const snap = metrics.snapshot();
    assert.equal(snap.byNamespace["unknown"].hits, 1);
  });
});
