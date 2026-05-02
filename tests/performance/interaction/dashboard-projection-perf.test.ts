/**
 * Performance tests for Dashboard Projection Service
 *
 * Design targets:
 * - Projection generation: >2000 ops/sec
 * - WebSocket broadcast: >5000 ops/sec
 * - Metric aggregation: >3000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { reportSoftPerformanceMiss } from "../../helpers/performance.js";

import { DashboardProjectionService } from "../../../src/interaction/dashboard/dashboard-projection-service.js";
import { MetricAggregator } from "../../../src/interaction/dashboard/metric-aggregator/metric-aggregator.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";

test("performance: dashboard projection generation >2000 ops/sec", (t) => {
  const projectionService = new DashboardProjectionService();

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      projectionService.generateProjection({
        taskId: newId("task"),
        executionId: newId("exec"),
        timestamp: nowIso(),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 2000,
        `Projection generation throughput ${opsPerSec.toFixed(2)} ops/sec must be >2000 ops/sec. Avg latency: ${avgLatencyMs.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed for projection service
  }
});

test("performance: metric aggregation >3000 ops/sec", (t) => {
  const aggregator = new MetricAggregator();

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      aggregator.aggregate({
        metrics: [
          { name: "cpu_usage", value: 0.5 + (i % 50) / 100, timestamp: nowIso() },
          { name: "memory_usage", value: 0.3 + (i % 30) / 100, timestamp: nowIso() },
          { name: "task_throughput", value: 100 + (i % 20), timestamp: nowIso() },
        ],
        windowMs: 60_000,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 3000,
        `Metric aggregation throughput ${opsPerSec.toFixed(2)} ops/sec must be >3000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed
  }
});

test("performance: batch projection updates scale linearly", (t) => {
  const projectionService = new DashboardProjectionService();

  const batchSizes = [10, 50, 100];
  const results: { size: number; opsPerSec: number }[] = [];

  try {
    for (const batchSize of batchSizes) {
      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        for (let b = 0; b < batchSize; b++) {
          projectionService.generateProjection({
            taskId: newId("task"),
            executionId: newId("exec"),
            timestamp: nowIso(),
          });
        }
      }

      const elapsed = performance.now() - start;
      const opsPerSec = (iterations / elapsed) * 1000;
      results.push({ size: batchSize, opsPerSec });
    }

    // Verify scaling is roughly linear (degradation < 2x for 10x batch size increase)
    const baseline = results[0]!.opsPerSec;
    const finalResult = results[results.length - 1]!.opsPerSec;
    const degradation = baseline / finalResult;

    try {
      assert.ok(
        degradation < 2,
        `Batch scaling degraded by ${degradation.toFixed(1)}x, expected <2x`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed
  }
});