/**
 * Infrastructure: Cache Metrics Tests
 *
 * Tests for the CacheMetrics class that tracks cache performance
 * metrics including hits, misses, invalidations, and per-namespace statistics.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

// Cache Metrics
import { CacheMetrics } from "../../../src/platform/shared/cache/cache-metrics.js";
import type { CacheLayer, CacheMissReason } from "../../../src/platform/shared/cache/cache-types.js";

describe("CacheMetrics", () => {
  let metrics: CacheMetrics;

  beforeEach(() => {
    metrics = new CacheMetrics();
  });

  describe("record", () => {
    it("records a cache hit", () => {
      metrics.record({ hit: true, namespace: "tool.read", layer: "L1" });

      const snapshot = metrics.snapshot();
      assert.equal(snapshot.totalHits, 1);
      assert.equal(snapshot.totalMisses, 0);
    });

    it("records a cache miss", () => {
      metrics.record({ hit: false, namespace: "tool.read", reason: "not_found" });

      const snapshot = metrics.snapshot();
      assert.equal(snapshot.totalHits, 0);
      assert.equal(snapshot.totalMisses, 1);
    });

    it("tracks multiple hits and misses", () => {
      metrics.record({ hit: true, namespace: "tool.read" });
      metrics.record({ hit: true, namespace: "tool.read" });
      metrics.record({ hit: false, namespace: "tool.glob" });
      metrics.record({ hit: false, namespace: "tool.glob" });
      metrics.record({ hit: false, namespace: "tool.glob" });

      const snapshot = metrics.snapshot();
      assert.equal(snapshot.totalHits, 2);
      assert.equal(snapshot.totalMisses, 3);
    });

    it("tracks by namespace", () => {
      metrics.record({ hit: true, namespace: "tool.read" });
      metrics.record({ hit: true, namespace: "tool.read" });
      metrics.record({ hit: false, namespace: "tool.glob" });

      const snapshot = metrics.snapshot();
      assert.equal(snapshot.byNamespace["tool.read"].hits, 2);
      assert.equal(snapshot.byNamespace["tool.read"].misses, 0);
      assert.equal(snapshot.byNamespace["tool.glob"].hits, 0);
      assert.equal(snapshot.byNamespace["tool.glob"].misses, 1);
    });

    it("tracks by layer", () => {
      metrics.record({ hit: true, namespace: "tool.read", layer: "L1" });
      metrics.record({ hit: true, namespace: "tool.read", layer: "L2" });
      metrics.record({ hit: true, namespace: "tool.read", layer: "L1" });

      const snapshot = metrics.snapshot();
      assert.equal(snapshot.byNamespace["tool.read"].byLayer["L1"], 2);
      assert.equal(snapshot.byNamespace["tool.read"].byLayer["L2"], 1);
    });

    it("tracks miss reasons", () => {
      metrics.record({ hit: false, namespace: "tool.read", reason: "not_found" });
      metrics.record({ hit: false, namespace: "tool.read", reason: "expired" });
      metrics.record({ hit: false, namespace: "tool.read", reason: "not_found" });

      const snapshot = metrics.snapshot();
      assert.equal(snapshot.byNamespace["tool.read"].byReason["not_found"], 2);
      assert.equal(snapshot.byNamespace["tool.read"].byReason["expired"], 1);
    });

    it("uses 'unknown' namespace when not provided", () => {
      metrics.record({ hit: true });
      metrics.record({ hit: false });

      const snapshot = metrics.snapshot();
      assert.equal(snapshot.byNamespace["unknown"].hits, 1);
      assert.equal(snapshot.byNamespace["unknown"].misses, 1);
    });
  });

  describe("snapshot", () => {
    it("returns correct hit rate with no entries", () => {
      const snapshot = metrics.snapshot();
      assert.equal(snapshot.hitRate, 0);
    });

    it("returns correct hit rate with all hits", () => {
      metrics.record({ hit: true });
      metrics.record({ hit: true });
      metrics.record({ hit: true });

      const snapshot = metrics.snapshot();
      assert.equal(snapshot.hitRate, 1);
    });

    it("returns correct hit rate with all misses", () => {
      metrics.record({ hit: false });
      metrics.record({ hit: false });

      const snapshot = metrics.snapshot();
      assert.equal(snapshot.hitRate, 0);
    });

    it("returns correct hit rate with mixed entries", () => {
      metrics.record({ hit: true });
      metrics.record({ hit: true });
      metrics.record({ hit: false });
      metrics.record({ hit: false });

      const snapshot = metrics.snapshot();
      assert.equal(snapshot.hitRate, 0.5);
    });

    it("calculates per-namespace hit rate", () => {
      metrics.record({ hit: true, namespace: "tool.read" });
      metrics.record({ hit: true, namespace: "tool.read" });
      metrics.record({ hit: false, namespace: "tool.read" });
      metrics.record({ hit: false, namespace: "tool.read" });

      const snapshot = metrics.snapshot();
      assert.equal(snapshot.byNamespace["tool.read"].hitRate, 0.5);
    });

    it("returns empty byNamespace when no records", () => {
      const snapshot = metrics.snapshot();
      assert.deepStrictEqual(snapshot.byNamespace, {});
    });

    it("returns totalHits and totalMisses", () => {
      metrics.record({ hit: true });
      metrics.record({ hit: false });
      metrics.record({ hit: true });

      const snapshot = metrics.snapshot();
      assert.equal(snapshot.totalHits, 2);
      assert.equal(snapshot.totalMisses, 1);
    });
  });

  describe("reset", () => {
    it("clears all metrics", () => {
      metrics.record({ hit: true, namespace: "tool.read" });
      metrics.record({ hit: false, namespace: "tool.glob" });

      metrics.reset();

      const snapshot = metrics.snapshot();
      assert.equal(snapshot.totalHits, 0);
      assert.equal(snapshot.totalMisses, 0);
      assert.deepStrictEqual(snapshot.byNamespace, {});
    });

    it("allows fresh tracking after reset", () => {
      metrics.record({ hit: true });
      metrics.reset();
      metrics.record({ hit: true });
      metrics.record({ hit: true });
      metrics.record({ hit: true });

      const snapshot = metrics.snapshot();
      assert.equal(snapshot.totalHits, 3);
    });
  });

  describe("edge cases", () => {
    it("handles many different namespaces", () => {
      const namespaces = [
        "tool.read",
        "tool.write",
        "tool.glob",
        "tool.grep",
        "prompt.prefix",
        "memory.summary",
      ];

      for (const ns of namespaces) {
        metrics.record({ hit: true, namespace: ns });
      }

      const snapshot = metrics.snapshot();
      assert.equal(Object.keys(snapshot.byNamespace).length, 6);
    });

    it("handles all cache layers", () => {
      const layers: CacheLayer[] = ["L1", "L2", "L3"];

      for (const layer of layers) {
        metrics.record({ hit: true, namespace: "tool.read", layer });
      }

      const snapshot = metrics.snapshot();
      assert.ok(snapshot.byNamespace["tool.read"].byLayer["L1"]);
      assert.ok(snapshot.byNamespace["tool.read"].byLayer["L2"]);
      assert.ok(snapshot.byNamespace["tool.read"].byLayer["L3"]);
    });

    it("handles all miss reasons", () => {
      const reasons: CacheMissReason[] = [
        "not_found",
        "expired",
        "invalidated",
        "version_mismatch",
        "payload_too_large",
        "disabled",
        "not_cacheable",
      ];

      for (const reason of reasons) {
        metrics.record({ hit: false, namespace: "tool.read", reason });
      }

      const snapshot = metrics.snapshot();
      const byReason = snapshot.byNamespace["tool.read"].byReason;

      for (const reason of reasons) {
        assert.equal(byReason[reason], 1);
      }
    });
  });
});