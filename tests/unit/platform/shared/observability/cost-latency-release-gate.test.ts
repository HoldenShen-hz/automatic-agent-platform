import assert from "node:assert/strict";
import test from "node:test";

import { buildCostLatencyReleaseGateReport } from "../../../../../src/platform/shared/observability/cost-latency-release-gate.js";

test("cost latency release gate approves healthy observations", () => {
  const report = buildCostLatencyReleaseGateReport([
    { label: "run-1", costUsd: 0.04, latencyMs: 900 },
    { label: "run-2", costUsd: 0.05, latencyMs: 1100 },
    { label: "run-3", costUsd: 0.03, latencyMs: 800 },
  ], {
    maxAverageCostUsd: 0.06,
    maxP95LatencyMs: 1500,
  });

  assert.equal(report.verdict, "approved");
  assert.equal(report.blockers.length, 0);
});

test("cost latency release gate blocks when thresholds are exceeded", () => {
  const report = buildCostLatencyReleaseGateReport([
    { label: "run-1", costUsd: 0.11, latencyMs: 2900 },
    { label: "run-2", costUsd: 0.10, latencyMs: 3100 },
    { label: "run-3", costUsd: 0.09, latencyMs: 2700 },
  ], {
    maxAverageCostUsd: 0.06,
    maxP95LatencyMs: 2500,
  });

  assert.equal(report.verdict, "blocked");
  assert.ok(report.blockers.some((item) => item.startsWith("average_cost_exceeded:")));
  assert.ok(report.blockers.some((item) => item.startsWith("p95_latency_exceeded:")));
});
