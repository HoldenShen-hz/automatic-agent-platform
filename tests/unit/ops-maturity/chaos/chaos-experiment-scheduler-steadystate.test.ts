import assert from "node:assert/strict";
import test from "node:test";

import {
  ChaosExperimentScheduler,
  type SteadyStateHypothesis,
} from "../../../../src/ops-maturity/chaos/chaos-experiment-scheduler.js";

test("ChaosExperimentScheduler.validateSteadyState: lt operator", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypothesis: SteadyStateHypothesis = {
    name: "error_rate_low",
    metricName: "error_rate",
    tolerance: 0.01,
    operator: "lt",
  };

  assert.equal(scheduler.validateSteadyState("error_rate", 0.005, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("error_rate", 0.01, hypothesis), false);
  assert.equal(scheduler.validateSteadyState("error_rate", 0.02, hypothesis), false);
});

test("ChaosExperimentScheduler.validateSteadyState: gt operator", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypothesis: SteadyStateHypothesis = {
    name: "throughput_high",
    metricName: "requests_per_sec",
    tolerance: 100,
    operator: "gt",
  };

  assert.equal(scheduler.validateSteadyState("requests_per_sec", 150, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("requests_per_sec", 100, hypothesis), false);
  assert.equal(scheduler.validateSteadyState("requests_per_sec", 50, hypothesis), false);
});

test("ChaosExperimentScheduler.validateSteadyState: eq operator", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypothesis: SteadyStateHypothesis = {
    name: "status_ok",
    metricName: "http_status",
    tolerance: 200,
    operator: "eq",
  };

  assert.equal(scheduler.validateSteadyState("http_status", 200, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("http_status", 201, hypothesis), false);
  assert.equal(scheduler.validateSteadyState("http_status", 404, hypothesis), false);
});

test("ChaosExperimentScheduler.validateSteadyState: ne operator", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypothesis: SteadyStateHypothesis = {
    name: "not_zero_errors",
    metricName: "error_count",
    tolerance: 0,
    operator: "ne",
  };

  assert.equal(scheduler.validateSteadyState("error_count", 5, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("error_count", 1, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("error_count", 0, hypothesis), false);
});

test("ChaosExperimentScheduler.validateSteadyState: lte operator", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypothesis: SteadyStateHypothesis = {
    name: "latency_acceptable",
    metricName: "p99_latency_ms",
    tolerance: 500,
    operator: "lte",
  };

  assert.equal(scheduler.validateSteadyState("p99_latency_ms", 100, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("p99_latency_ms", 500, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("p99_latency_ms", 501, hypothesis), false);
});

test("ChaosExperimentScheduler.validateSteadyState: gte operator", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypothesis: SteadyStateHypothesis = {
    name: "availability_min",
    metricName: "uptime_percent",
    tolerance: 99.9,
    operator: "gte",
  };

  assert.equal(scheduler.validateSteadyState("uptime_percent", 99.95, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("uptime_percent", 99.9, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("uptime_percent", 99.8, hypothesis), false);
});

test("ChaosExperimentScheduler.validateSteadyState: boundary conditions", () => {
  const scheduler = new ChaosExperimentScheduler();

  // Test lt: just below and above tolerance
  const ltHyp: SteadyStateHypothesis = { name: "test", metricName: "m", tolerance: 1.0, operator: "lt" };
  assert.equal(scheduler.validateSteadyState("m", 0.999, ltHyp), true);
  assert.equal(scheduler.validateSteadyState("m", 1.0, ltHyp), false);

  // Test gt: just below and above tolerance
  const gtHyp: SteadyStateHypothesis = { name: "test", metricName: "m", tolerance: 1.0, operator: "gt" };
  assert.equal(scheduler.validateSteadyState("m", 1.001, gtHyp), true);
  assert.equal(scheduler.validateSteadyState("m", 1.0, gtHyp), false);

  // Test lte: at and above tolerance
  const lteHyp: SteadyStateHypothesis = { name: "test", metricName: "m", tolerance: 1.0, operator: "lte" };
  assert.equal(scheduler.validateSteadyState("m", 1.0, lteHyp), true);
  assert.equal(scheduler.validateSteadyState("m", 1.001, lteHyp), false);

  // Test gte: at and below tolerance
  const gteHyp: SteadyStateHypothesis = { name: "test", metricName: "m", tolerance: 1.0, operator: "gte" };
  assert.equal(scheduler.validateSteadyState("m", 1.0, gteHyp), true);
  assert.equal(scheduler.validateSteadyState("m", 0.999, gteHyp), false);
});

test("ChaosExperimentScheduler.validateSteadyState: negative values", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypothesis: SteadyStateHypothesis = {
    name: "error_rate",
    metricName: "error_rate",
    tolerance: 0,
    operator: "gte",
  };

  assert.equal(scheduler.validateSteadyState("error_rate", 0, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("error_rate", -1, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("error_rate", 1, hypothesis), false);
});

test("ChaosExperimentScheduler.validateSteadyState: zero tolerance", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypothesis: SteadyStateHypothesis = {
    name: "exact_zero",
    metricName: "memory_leaks",
    tolerance: 0,
    operator: "eq",
  };

  assert.equal(scheduler.validateSteadyState("memory_leaks", 0, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("memory_leaks", 0.001, hypothesis), false);
});

test("ChaosExperimentScheduler.validateSteadyState: large tolerance values", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypothesis: SteadyStateHypothesis = {
    name: "large_numbers",
    metricName: "bytes_transferred",
    tolerance: 1000000,
    operator: "gt",
  };

  assert.equal(scheduler.validateSteadyState("bytes_transferred", 2000000, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("bytes_transferred", 1000000, hypothesis), false);
});

test("ChaosExperimentScheduler.validateSteadyState: fractional tolerance", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypothesis: SteadyStateHypothesis = {
    name: "precise",
    metricName: "ratio",
    tolerance: 0.001,
    operator: "lt",
  };

  assert.equal(scheduler.validateSteadyState("ratio", 0.0005, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("ratio", 0.001, hypothesis), false);
  assert.equal(scheduler.validateSteadyState("ratio", 0.002, hypothesis), false);
});
