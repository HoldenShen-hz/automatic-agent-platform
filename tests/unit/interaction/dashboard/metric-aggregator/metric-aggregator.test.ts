/**
 * Unit tests for metric-aggregator advanced functions
 *
 * Tests aggregateWindowedMetrics, calculateMetricTrend, compareSloValue,
 * groupMetricsByDomain, and MetricAggregator class methods.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateWindowedMetrics,
  calculateMetricTrend,
  compareSloValue,
  groupMetricsByDomain,
  MetricAggregator,
  type MetricTimeSeriesEntry,
} from "../../../../../src/interaction/dashboard/metric-aggregator/index.js";

// --- aggregateWindowedMetrics tests ---

test("aggregateWindowedMetrics returns zero values for empty time series", () => {
  const result = aggregateWindowedMetrics([], 300000);

  assert.equal(result.totalTasks, 0);
  assert.equal(result.completedTasks, 0);
  assert.equal(result.failedTasks, 0);
  assert.equal(result.successRate, 1.0);
  assert.equal(result.p50LatencyMs, 0);
  assert.equal(result.p95LatencyMs, 0);
  assert.equal(result.p99LatencyMs, 0);
  assert.equal(result.throughput, 0);
});

test("aggregateWindowedMetrics computes correct totals for single entry", () => {
  const timeSeries: MetricTimeSeriesEntry[] = [
    { timestamp: "2026-04-19T01:00:00.000Z", total: 100, done: 90, inProgress: 5, failed: 5, successRate: 0.9, latencyMs: 150 },
  ];

  const result = aggregateWindowedMetrics(timeSeries, 300000);

  assert.equal(result.totalTasks, 100);
  assert.equal(result.completedTasks, 90);
  assert.equal(result.failedTasks, 5);
  assert.equal(result.successRate, 0.9);
});

test("aggregateWindowedMetrics aggregates multiple entries", () => {
  const timeSeries: MetricTimeSeriesEntry[] = [
    { timestamp: "2026-04-19T01:00:00.000Z", total: 50, done: 45, inProgress: 3, failed: 2, successRate: 0.9 },
    { timestamp: "2026-04-19T01:05:00.000Z", total: 60, done: 55, inProgress: 3, failed: 2, successRate: 0.917 },
    { timestamp: "2026-04-19T01:10:00.000Z", total: 70, done: 65, inProgress: 3, failed: 2, successRate: 0.929 },
  ];

  const result = aggregateWindowedMetrics(timeSeries, 300000);

  assert.equal(result.totalTasks, 180);
  assert.equal(result.completedTasks, 165);
  assert.equal(result.failedTasks, 6);
});

test("aggregateWindowedMetrics calculates throughput correctly", () => {
  const timeSeries: MetricTimeSeriesEntry[] = [
    { timestamp: "2026-04-19T01:00:00.000Z", total: 100, done: 100, inProgress: 0, failed: 0, successRate: 1.0 },
    { timestamp: "2026-04-19T01:10:00.000Z", total: 100, done: 100, inProgress: 0, failed: 0, successRate: 1.0 },
  ];

  const result = aggregateWindowedMetrics(timeSeries, 600000);

  // 10 minutes = 10,000ms, 200 completed / 10 minutes = 20 per minute
  assert.equal(result.throughput, 20);
});

test("aggregateWindowedMetrics computes percentiles correctly", () => {
  const timeSeries: MetricTimeSeriesEntry[] = [
    { timestamp: "2026-04-19T01:00:00.000Z", total: 10, done: 10, inProgress: 0, failed: 0, successRate: 1.0, latencyMs: 100 },
    { timestamp: "2026-04-19T01:01:00.000Z", total: 10, done: 10, inProgress: 0, failed: 0, successRate: 1.0, latencyMs: 200 },
    { timestamp: "2026-04-19T01:02:00.000Z", total: 10, done: 10, inProgress: 0, failed: 0, successRate: 1.0, latencyMs: 300 },
    { timestamp: "2026-04-19T01:03:00.000Z", total: 10, done: 10, inProgress: 0, failed: 0, successRate: 1.0, latencyMs: 400 },
    { timestamp: "2026-04-19T01:04:00.000Z", total: 10, done: 10, inProgress: 0, failed: 0, successRate: 1.0, latencyMs: 500 },
  ];

  const result = aggregateWindowedMetrics(timeSeries, 300000);

  assert.equal(result.p50LatencyMs, 300);
  assert.equal(result.p95LatencyMs, 500);
  assert.equal(result.p99LatencyMs, 500);
});

// --- calculateMetricTrend tests ---

test("calculateMetricTrend returns stable when previous is 0", () => {
  const result = calculateMetricTrend(0.95, 0);
  assert.equal(result.direction, "stable");
  assert.equal(result.deltaPercent, 0);
  assert.equal(result.confidence, "low");
});

test("calculateMetricTrend returns up when current is 5% higher", () => {
  const result = calculateMetricTrend(0.105, 0.1);
  assert.equal(result.direction, "up");
  assert.ok(result.deltaPercent > 0);
});

test("calculateMetricTrend returns down when current is 5% lower", () => {
  const result = calculateMetricTrend(0.095, 0.1);
  assert.equal(result.direction, "down");
  assert.ok(result.deltaPercent < 0);
});

test("calculateMetricTrend returns stable when difference is within 5%", () => {
  const result = calculateMetricTrend(0.102, 0.1);
  assert.equal(result.direction, "stable");
});

test("calculateMetricTrend calculates correct delta percent", () => {
  const result = calculateMetricTrend(0.12, 0.1);
  // (0.12 - 0.10) / 0.10 * 100 = 20%
  assert.equal(result.deltaPercent, 20);
});

test("calculateMetricTrend assigns high confidence when previous > 10", () => {
  const result = calculateMetricTrend(0.12, 0.10);
  assert.equal(result.confidence, "high");
});

test("calculateMetricTrend assigns medium confidence when previous > 5", () => {
  const result = calculateMetricTrend(0.07, 0.05);
  assert.equal(result.confidence, "medium");
});

test("calculateMetricTrend assigns low confidence when previous <= 5", () => {
  const result = calculateMetricTrend(0.03, 0.02);
  assert.equal(result.confidence, "low");
});

// --- compareSloValue tests ---

test("compareSloValue returns healthy when success rate is at target", () => {
  const result = compareSloValue(0.96, 0.95, "success_rate");
  assert.equal(result.status, "healthy");
});

test("compareSloValue returns at_risk when gap is between 1-5%", () => {
  const result = compareSloValue(0.94, 0.95, "success_rate");
  assert.equal(result.status, "at_risk");
  assert.equal(result.gap, 0.01);
});

test("compareSloValue returns breached when gap is > 5%", () => {
  const result = compareSloValue(0.90, 0.95, "success_rate");
  assert.equal(result.status, "breached");
});

test("compareSloValue for latency returns healthy when below target", () => {
  const result = compareSloValue(1500, 2000, "latency");
  assert.equal(result.status, "healthy");
});

test("compareSloValue for latency returns at_risk when gap is 10-50% of target", () => {
  const result = compareSloValue(2250, 2000, "latency");
  assert.equal(result.status, "at_risk");
});

test("compareSloValue for latency returns breached when gap is > 50% of target", () => {
  const result = compareSloValue(3500, 2000, "latency");
  assert.equal(result.status, "breached");
});

// --- groupMetricsByDomain tests ---

test("groupMetricsByDomain returns empty array for empty input", () => {
  const result = groupMetricsByDomain([]);
  assert.deepEqual(result, []);
});

test("groupMetricsByDomain computes success rate correctly", () => {
  const domainMetrics = [
    { domainId: "d1", total: 100, done: 90, failed: 10 },
  ];

  const result = groupMetricsByDomain(domainMetrics);

  assert.equal(result[0]!.successRate, 0.9);
  assert.equal(result[0]!.errorRate, 0.1);
});

test("groupMetricsByDomain handles multiple domains", () => {
  const domainMetrics = [
    { domainId: "d1", total: 100, done: 90, failed: 10 },
    { domainId: "d2", total: 50, done: 40, failed: 10 },
  ];

  const result = groupMetricsByDomain(domainMetrics);

  assert.equal(result.length, 2);
  assert.equal(result[0]!.domainId, "d1");
  assert.equal(result[1]!.domainId, "d2");
});

test("groupMetricsByDomain uses latency if provided", () => {
  const domainMetrics = [
    { domainId: "d1", total: 100, done: 90, failed: 10, latencyMs: 150 },
  ];

  const result = groupMetricsByDomain(domainMetrics);

  assert.equal(result[0]!.avgLatencyMs, 150);
});

test("groupMetricsByDomain defaults latency to 0 if not provided", () => {
  const domainMetrics = [
    { domainId: "d1", total: 100, done: 90, failed: 10 },
  ];

  const result = groupMetricsByDomain(domainMetrics);

  assert.equal(result[0]!.avgLatencyMs, 0);
});

test("groupMetricsByDomain handles zero total tasks", () => {
  const domainMetrics = [
    { domainId: "d1", total: 0, done: 0, failed: 0 },
  ];

  const result = groupMetricsByDomain(domainMetrics);

  assert.equal(result[0]!.successRate, 1.0);
  assert.equal(result[0]!.errorRate, 0);
});

// --- MetricAggregator class tests ---

test("MetricAggregator constructor uses default values", () => {
  const aggregator = new MetricAggregator();
  const result = aggregator.getSloComparison(0.95);
  assert.equal(result.sloTarget, 0.95);
});

test("MetricAggregator constructor accepts custom options", () => {
  const aggregator = new MetricAggregator({ defaultSloTarget: 0.99 });
  const result = aggregator.getSloComparison(0.98);
  assert.equal(result.sloTarget, 0.99);
});

test("MetricAggregator.addTimeSeriesEntry adds entry to history", () => {
  const aggregator = new MetricAggregator();
  aggregator.addTimeSeriesEntry({
    timestamp: "2026-04-19T01:00:00.000Z",
    total: 100,
    done: 90,
    inProgress: 5,
    failed: 5,
    successRate: 0.9,
  });

  const history = aggregator.getTimeSeriesHistory();
  assert.equal(history.length, 1);
});

test("MetricAggregator.getWindowedAggregation filters by time window", () => {
  const aggregator = new MetricAggregator({ defaultWindowSizeMs: 60000 });
  const now = Date.now();
  aggregator.addTimeSeriesEntry({
    timestamp: new Date(now - 120000).toISOString(), // 2 minutes ago
    total: 100,
    done: 90,
    inProgress: 5,
    failed: 5,
    successRate: 0.9,
  });
  aggregator.addTimeSeriesEntry({
    timestamp: new Date(now).toISOString(), // now
    total: 50,
    done: 45,
    inProgress: 3,
    failed: 2,
    successRate: 0.9,
  });

  const result = aggregator.getWindowedAggregation(60000);
  // Should only include the recent entry
  assert.equal(result.totalTasks, 50);
});

test("MetricAggregator.getSloComparison returns correct status", () => {
  const aggregator = new MetricAggregator({ defaultSloTarget: 0.95 });
  const result = aggregator.getSloComparison(0.94);
  assert.equal(result.status, "at_risk");
});

test("MetricAggregator.getLatencySloComparison returns correct status", () => {
  const aggregator = new MetricAggregator();
  const result = aggregator.getLatencySloComparison(2500);
  assert.equal(result.status, "at_risk");
});

test("MetricAggregator.getSuccessRateTrend returns null with insufficient data", () => {
  const aggregator = new MetricAggregator();
  const result = aggregator.getSuccessRateTrend();
  assert.equal(result, null);
});

test("MetricAggregator.getSuccessRateTrend returns trend with enough data", () => {
  const aggregator = new MetricAggregator();
  const now = Date.now();
  aggregator.addTimeSeriesEntry({
    timestamp: new Date(now - 60000).toISOString(),
    total: 100,
    done: 80,
    inProgress: 10,
    failed: 10,
    successRate: 0.8,
  });
  aggregator.addTimeSeriesEntry({
    timestamp: new Date(now).toISOString(),
    total: 100,
    done: 90,
    inProgress: 5,
    failed: 5,
    successRate: 0.9,
  });

  const result = aggregator.getSuccessRateTrend();
  assert.notEqual(result, null);
  assert.equal(result!.direction, "up");
});

test("MetricAggregator limits history to max entries", () => {
  const aggregator = new MetricAggregator({} as never);
  // Access private property for testing purposes
  for (let i = 0; i < 1500; i++) {
    aggregator.addTimeSeriesEntry({
      timestamp: new Date().toISOString(),
      total: 10,
      done: 9,
      inProgress: 0,
      failed: 1,
      successRate: 0.9,
    });
  }

  const history = aggregator.getTimeSeriesHistory();
  assert.ok(history.length <= 1000);
});
