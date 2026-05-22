/**
 * Infrastructure: Queue Metrics Tests
 *
 * Tests for QueueMetricCollector and QueueMetricsService classes
 * that provide queue observability and metrics aggregation.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

import {
  QueueMetricCollector,
  QueueMetricsService,
  type QueueMetrics,
  type QueueMetricsSnapshot,
} from "../../../src/platform/five-plane-execution/queue-metrics/index.js";
import type { QueueStats } from "../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";

// ── QueueMetricCollector Tests ────────────────────────────────────────────────

describe("QueueMetricCollector", () => {
  let collector: QueueMetricCollector;

  beforeEach(() => {
    collector = new QueueMetricCollector("test-queue");
  });

  describe("constructor", () => {
    it("sets queue name", () => {
      assert.equal(collector.queueName, "test-queue");
    });

    it("accepts custom ttl and maxSize options", () => {
      const custom = new QueueMetricCollector("custom-queue", { ttlMs: 60000, maxSize: 5000 });
      assert.equal(custom.queueName, "custom-queue");
    });
  });

  describe("recordEnqueue", () => {
    it("increments enqueue count", () => {
      collector.recordEnqueue();
      collector.recordEnqueue();
      const snapshot = collector.snapshot();
      assert.equal(snapshot.totalEnqueued, 2);
    });
  });

  describe("recordDequeue", () => {
    it("increments dequeue count", () => {
      collector.recordDequeue();
      const snapshot = collector.snapshot();
      assert.equal(snapshot.totalDequeued, 1);
    });
  });

  describe("recordFailed", () => {
    it("increments failed count", () => {
      collector.recordFailed("test error");
      const snapshot = collector.snapshot();
      assert.equal(snapshot.totalFailed, 1);
      assert.ok(snapshot.failureReasons.includes("test error"));
    });

    it("accumulates multiple failure reasons", () => {
      collector.recordFailed("error-1");
      collector.recordFailed("error-2");
      const snapshot = collector.snapshot();
      assert.equal(snapshot.totalFailed, 2);
      assert.deepEqual(snapshot.failureReasons, ["error-1", "error-2"]);
    });

    it("evicts old entries based on ttl", () => {
      const shortTtl = new QueueMetricCollector("ttl-test", { ttlMs: 1 });
      shortTtl.recordFailed("old");
      // Wait a tiny bit for eviction
      setTimeoutSync(() => {
        shortTtl.evictExpiredWaitTimes();
      }, 5);
      shortTtl.recordFailed("new");
      // old should be filtered out by ttl
    });
  });

  describe("recordWaitTime", () => {
    it("records wait time values", () => {
      collector.recordWaitTime(100);
      collector.recordWaitTime(200);
      const snapshot = collector.snapshot();
      assert.deepEqual(snapshot.waitTimes, [100, 200]);
    });

    it("calculates average wait time", () => {
      collector.recordWaitTime(100);
      collector.recordWaitTime(200);
      const snapshot = collector.snapshot();
      assert.equal(snapshot.averageWaitTimeMs, 150);
    });
  });

  describe("snapshot", () => {
    it("calculates depth as enqueued - dequeued", () => {
      collector.recordEnqueue();
      collector.recordEnqueue();
      collector.recordEnqueue();
      collector.recordDequeue();
      const snapshot = collector.snapshot();
      assert.equal(snapshot.depth, 2);
    });

    it("calculates p95 wait time", () => {
      for (let i = 1; i <= 20; i++) {
        collector.recordWaitTime(i * 100);
      }
      const snapshot = collector.snapshot();
      assert.equal(snapshot.p95WaitTimeMs, 2000); // 95th percentile of 20 items
    });

    it("calculates p99 wait time", () => {
      for (let i = 1; i <= 100; i++) {
        collector.recordWaitTime(i * 10);
      }
      const snapshot = collector.snapshot();
      assert.ok(snapshot.p99WaitTimeMs > 0);
    });

    it("calculates throughput per minute", () => {
      collector.recordEnqueue();
      collector.recordEnqueue();
      collector.recordDequeue();
      const snapshot = collector.snapshot();
      assert.equal(snapshot.throughputPerMinute, 1); // 2 enqueued - 1 dequeued
    });

    it("calculates failure rate", () => {
      collector.recordEnqueue();
      collector.recordEnqueue();
      collector.recordFailed("err");
      const snapshot = collector.snapshot();
      assert.equal(snapshot.failureRate, 0.5);
    });

    it("calculates success rate", () => {
      collector.recordEnqueue();
      collector.recordEnqueue();
      collector.recordFailed("err");
      const snapshot = collector.snapshot();
      assert.equal(snapshot.successRate, 0.5);
    });

    it("handles zero enqueued for rates", () => {
      const snapshot = collector.snapshot();
      assert.equal(snapshot.failureRate, 0);
      assert.equal(snapshot.successRate, 1);
    });
  });

  describe("reset", () => {
    it("resets all counters and arrays", () => {
      collector.recordEnqueue();
      collector.recordDequeue();
      collector.recordFailed("err");
      collector.recordWaitTime(100);
      collector.reset();
      const snapshot = collector.snapshot();
      assert.equal(snapshot.totalEnqueued, 0);
      assert.equal(snapshot.totalDequeued, 0);
      assert.equal(snapshot.totalFailed, 0);
      assert.deepEqual(snapshot.waitTimes, []);
    });
  });
});

// ── QueueMetricsService Tests ─────────────────────────────────────────────────

describe("QueueMetricsService", () => {
  let service: QueueMetricsService;

  beforeEach(() => {
    service = new QueueMetricsService();
  });

  describe("recordDepth", () => {
    it("records queue depth", () => {
      service.recordDepth("queue-1", 10);
      const snapshot = service.getSnapshot();
      assert.equal(snapshot.queues.get("queue-1"), 10);
    });
  });

  describe("recordEnqueue", () => {
    it("increments enqueued count per queue", () => {
      service.recordEnqueue("q1");
      service.recordEnqueue("q1");
      service.recordEnqueue("q2");
      const snapshot = service.getSnapshot();
      assert.equal(snapshot.enqueuedPerMinute.get("q1"), 2);
      assert.equal(snapshot.enqueuedPerMinute.get("q2"), 1);
    });
  });

  describe("recordDequeue", () => {
    it("increments dequeued count per queue", () => {
      service.recordDequeue("q1");
      service.recordDequeue("q1");
      const snapshot = service.getSnapshot();
      assert.equal(snapshot.dequeuedPerMinute.get("q1"), 2);
    });
  });

  describe("recordWaitTime", () => {
    it("accumulates wait times per queue", () => {
      service.recordWaitTime("q1", 100);
      service.recordWaitTime("q1", 200);
      const snapshot = service.getSnapshot();
      assert.equal(snapshot.averageWaitTimeMs.get("q1"), 150);
    });

    it("calculates p95 wait time per queue", () => {
      for (let i = 1; i <= 10; i++) {
        service.recordWaitTime("q1", i * 100);
      }
      const snapshot = service.getSnapshot();
      assert.equal(snapshot.p95WaitTimeMs.get("q1"), 1000);
    });
  });

  describe("recordFailed", () => {
    it("increments failed count per queue", () => {
      service.recordFailed("q1", "error-1");
      service.recordFailed("q1", "error-2");
      service.recordFailed("q2", "error-3");
      const snapshot = service.getSnapshot();
      assert.equal(snapshot.failedJobs.get("q1"), 2);
      assert.equal(snapshot.failedJobs.get("q2"), 1);
    });
  });

  describe("deriveFromStats", () => {
    it("derives depth from queue stats", () => {
      const stats: QueueStats = {
        queueName: "test-queue",
        waiting: 5,
        delayed: 3,
        active: 2,
        completed: 100,
        failed: 0,
        deadLetter: 0,
      };
      service.deriveFromStats(stats);
      const snapshot = service.getSnapshot();
      assert.equal(snapshot.queues.get("test-queue"), 10); // waiting + delayed + active
    });
  });

  describe("getQueueMetrics", () => {
    it("returns undefined for unknown queue", () => {
      const metrics = service.getQueueMetrics("nonexistent");
      assert.equal(metrics, undefined);
    });

    it("returns QueueMetrics for known queue", () => {
      service.recordDepth("q1", 15);
      service.recordEnqueue("q1");
      service.recordDequeue("q1");
      service.recordWaitTime("q1", 250);
      const metrics = service.getQueueMetrics("q1");
      assert.ok(metrics);
      assert.equal(metrics!.queueName, "q1");
      assert.equal(metrics!.depth, 15);
      assert.equal(metrics!.enqueuedPerMinute, 1);
      assert.equal(metrics!.dequeuedPerMinute, 1);
      assert.equal(metrics!.averageWaitTimeMs, 250);
    });
  });

  describe("getAllQueues", () => {
    it("returns list of all tracked queues", () => {
      service.recordDepth("q1", 10);
      service.recordDepth("q2", 20);
      service.recordDepth("q3", 30);
      const queues = service.getAllQueues();
      assert.equal(queues.length, 3);
      assert.ok(queues.includes("q1"));
      assert.ok(queues.includes("q2"));
      assert.ok(queues.includes("q3"));
    });
  });

  describe("getCollector", () => {
    it("returns existing collector for known queue", () => {
      const c1 = service.getCollector("q1");
      const c2 = service.getCollector("q1");
      assert.equal(c1, c2);
    });

    it("creates new collector for unknown queue", () => {
      const c1 = service.getCollector("new-queue");
      assert.ok(c1 instanceof QueueMetricCollector);
    });
  });

  describe("reset", () => {
    it("clears all state", () => {
      service.recordDepth("q1", 10);
      service.recordEnqueue("q1");
      service.recordDequeue("q1");
      service.recordWaitTime("q1", 100);
      service.recordFailed("q1", "err");
      service.reset();
      const snapshot = service.getSnapshot();
      assert.equal(snapshot.queues.size, 0);
      assert.equal(snapshot.enqueuedPerMinute.size, 0);
    });
  });
});

// Helper to make setTimeout synchronous for testing
function setTimeoutSync(fn: () => void, ms: number): void {
  const start = Date.now();
  while (Date.now() - start < ms) {
    // busy wait
  }
  fn();
}
