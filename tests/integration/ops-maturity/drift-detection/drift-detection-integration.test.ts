/**
 * Unit Tests: Drift Detection Integration
 *
 * Tests the drift detection pipeline combining fingerprinting,
 * changepoint detection, and cross-agent analysis.
 *
 * Uses node:test + assert/strict with ESM and .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { BehaviorFingerprintBuilder } from "../../../../src/ops-maturity/drift-detection/fingerprint-builder/index.js";
import { ChangepointDetectorService, type DriftSample } from "../../../../src/ops-maturity/drift-detection/changepoint-detector/index.js";
import { CrossAgentAnalyzerService, type CrossAgentMetric } from "../../../../src/ops-maturity/drift-detection/cross-agent-analyzer/index.js";

// ============================================================================
// Pipeline Integration Tests
// ============================================================================

test("drift pipeline: fingerprint, changepoint, and cross-agent analysis compose correctly", () => {
  const fingerprintBuilder = new BehaviorFingerprintBuilder();
  const changepointDetector = new ChangepointDetectorService();
  const analyzer = new CrossAgentAnalyzerService();

  const fingerprint = fingerprintBuilder.build({
    agentId: "agent-a",
    tools: ["read", "edit", "test"],
    failureCategories: ["type_error"],
    averageLatencyMs: 2200,
    averageCostUsd: 0.4,
  });

  const changepoint = changepointDetector.detect([
    { observedAt: "2026-04-20T00:00:00.000Z", score: 0.92 },
    { observedAt: "2026-04-20T00:01:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:02:00.000Z", score: 0.91 },
    { observedAt: "2026-04-20T00:03:00.000Z", score: 0.68 },
    { observedAt: "2026-04-20T00:04:00.000Z", score: 0.62 },
    { observedAt: "2026-04-20T00:05:00.000Z", score: 0.6 },
  ]);

  const analysis = analyzer.analyze([
    { agentId: "agent-a", successRate: 0.93, averageCostUsd: 0.4, averageLatencyMs: 2200 },
    { agentId: "agent-b", successRate: 0.72, averageCostUsd: 0.7, averageLatencyMs: 4800 },
  ]);

  assert.equal(fingerprint.hash.length, 64);
  assert.equal(changepoint.detected, true);
  assert.equal(analysis.bestAgentId, "agent-a");
});

test("drift pipeline: detects agent degradation via changepoint and ranks via cross-agent", () => {
  const fingerprintBuilder = new BehaviorFingerprintBuilder();
  const changepointDetector = new ChangepointDetectorService();
  const analyzer = new CrossAgentAnalyzerService();

  // Agent A starts healthy then degrades
  const agentADrift = changepointDetector.detect([
    { observedAt: "2026-04-20T00:00:00.000Z", score: 0.95 },
    { observedAt: "2026-04-20T00:01:00.000Z", score: 0.94 },
    { observedAt: "2026-04-20T00:02:00.000Z", score: 0.93 },
    { observedAt: "2026-04-20T00:03:00.000Z", score: 0.92 },
    { observedAt: "2026-04-20T00:04:00.000Z", score: 0.91 },
    { observedAt: "2026-04-20T00:05:00.000Z", score: 0.90 },
    { observedAt: "2026-04-20T00:06:00.000Z", score: 0.89 },
    { observedAt: "2026-04-20T00:07:00.000Z", score: 0.88 },
    { observedAt: "2026-04-20T00:08:00.000Z", score: 0.87 },
    { observedAt: "2026-04-20T00:09:00.000Z", score: 0.86 },
    { observedAt: "2026-04-20T00:10:00.000Z", score: 0.85 },
    { observedAt: "2026-04-20T00:11:00.000Z", score: 0.84 },
    { observedAt: "2026-04-20T00:12:00.000Z", score: 0.83 },
    { observedAt: "2026-04-20T00:13:00.000Z", score: 0.82 },
    { observedAt: "2026-04-20T00:14:00.000Z", score: 0.81 },
    { observedAt: "2026-04-20T00:15:00.000Z", score: 0.80 },
    { observedAt: "2026-04-20T00:16:00.000Z", score: 0.79 },
    { observedAt: "2026-04-20T00:17:00.000Z", score: 0.78 },
    { observedAt: "2026-04-20T00:18:00.000Z", score: 0.77 },
    { observedAt: "2026-04-20T00:19:00.000Z", score: 0.76 },
    { observedAt: "2026-04-20T00:20:00.000Z", score: 0.75 },
    { observedAt: "2026-04-20T00:21:00.000Z", score: 0.74 },
    { observedAt: "2026-04-20T00:22:00.000Z", score: 0.73 },
    { observedAt: "2026-04-20T00:23:00.000Z", score: 0.72 },
    // Recent degraded samples
    { observedAt: "2026-04-20T01:00:00.000Z", score: 0.62 },
    { observedAt: "2026-04-20T01:01:00.000Z", score: 0.60 },
    { observedAt: "2026-04-20T01:02:00.000Z", score: 0.58 },
  ]);

  const crossAgentAnalysis = analyzer.analyze([
    { agentId: "agent-a", successRate: 0.70, averageCostUsd: 0.4, averageLatencyMs: 2200 },
    { agentId: "agent-b", successRate: 0.95, averageCostUsd: 0.35, averageLatencyMs: 1800 },
  ]);

  assert.equal(agentADrift.detected, true);
  assert.equal(crossAgentAnalysis.worstAgentId, "agent-a");
});

test("drift pipeline: cross-agent ranking combined with fingerprint stability", () => {
  const fingerprintBuilder = new BehaviorFingerprintBuilder();
  const analyzer = new CrossAgentAnalyzerService();

  const fingerprint1 = fingerprintBuilder.build({
    agentId: "stable-agent",
    tools: ["read", "edit"],
    failureCategories: [],
    averageLatencyMs: 1000,
    averageCostUsd: 0.2,
  });

  const fingerprint2 = fingerprintBuilder.build({
    agentId: "stable-agent",
    tools: ["read", "edit"],
    failureCategories: [],
    averageLatencyMs: 1000,
    averageCostUsd: 0.2,
  });

  const analysis = analyzer.analyze([
    { agentId: "stable-agent", successRate: 0.92, averageCostUsd: 0.2, averageLatencyMs: 1000 },
    { agentId: "volatile-agent", successRate: 0.85, averageCostUsd: 0.25, averageLatencyMs: 1200 },
  ]);

  assert.equal(fingerprint1.hash, fingerprint2.hash);
  assert.equal(analysis.bestAgentId, "stable-agent");
});

test("drift pipeline: multiple agents with different drift states", () => {
  const changepointDetector = new ChangepointDetectorService();
  const analyzer = new CrossAgentAnalyzerService();

  const agentADrift = changepointDetector.detect([
    { observedAt: "2026-04-20T00:00:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:01:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:02:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:03:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:04:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:05:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:06:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:07:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:08:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:09:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:10:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:11:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:12:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:13:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:14:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:15:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:16:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:17:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:18:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:19:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:20:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:21:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:22:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:23:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T01:00:00.000Z", score: 0.88 },
    { observedAt: "2026-04-20T01:01:00.000Z", score: 0.86 },
    { observedAt: "2026-04-20T01:02:00.000Z", score: 0.84 },
  ]);

  const agentBDrift = changepointDetector.detect([
    { observedAt: "2026-04-20T00:00:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:01:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:02:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:03:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:04:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:05:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:06:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:07:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:08:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:09:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:10:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:11:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:12:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:13:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:14:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:15:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:16:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:17:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:18:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:19:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:20:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:21:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:22:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T00:23:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T01:00:00.000Z", score: 0.68 },
    { observedAt: "2026-04-20T01:01:00.000Z", score: 0.65 },
    { observedAt: "2026-04-20T01:02:00.000Z", score: 0.62 },
  ]);

  const crossAgentAnalysis = analyzer.analyze([
    { agentId: "agent-a", successRate: 0.70, averageCostUsd: 0.4, averageLatencyMs: 2200 },
    { agentId: "agent-b", successRate: 0.80, averageCostUsd: 0.35, averageLatencyMs: 2000 },
  ]);

  assert.equal(agentADrift.detected, false);
  assert.equal(agentBDrift.detected, true);
  assert.equal(crossAgentAnalysis.bestAgentId, "agent-b");
});

test("drift pipeline: high severity event emission for detected drift", () => {
  const changepointDetector = new ChangepointDetectorService();

  const drift = changepointDetector.detect([
    { observedAt: "2026-04-20T00:00:00.000Z", score: 0.95 },
    { observedAt: "2026-04-20T00:01:00.000Z", score: 0.94 },
    { observedAt: "2026-04-20T00:02:00.000Z", score: 0.93 },
    { observedAt: "2026-04-20T00:03:00.000Z", score: 0.92 },
    { observedAt: "2026-04-20T00:04:00.000Z", score: 0.91 },
    { observedAt: "2026-04-20T00:05:00.000Z", score: 0.90 },
    { observedAt: "2026-04-20T00:06:00.000Z", score: 0.89 },
    { observedAt: "2026-04-20T00:07:00.000Z", score: 0.88 },
    { observedAt: "2026-04-20T00:08:00.000Z", score: 0.87 },
    { observedAt: "2026-04-20T00:09:00.000Z", score: 0.86 },
    { observedAt: "2026-04-20T00:10:00.000Z", score: 0.85 },
    { observedAt: "2026-04-20T00:11:00.000Z", score: 0.84 },
    { observedAt: "2026-04-20T00:12:00.000Z", score: 0.83 },
    { observedAt: "2026-04-20T00:13:00.000Z", score: 0.82 },
    { observedAt: "2026-04-20T00:14:00.000Z", score: 0.81 },
    { observedAt: "2026-04-20T00:15:00.000Z", score: 0.80 },
    { observedAt: "2026-04-20T00:16:00.000Z", score: 0.79 },
    { observedAt: "2026-04-20T00:17:00.000Z", score: 0.78 },
    { observedAt: "2026-04-20T00:18:00.000Z", score: 0.77 },
    { observedAt: "2026-04-20T00:19:00.000Z", score: 0.76 },
    { observedAt: "2026-04-20T00:20:00.000Z", score: 0.75 },
    { observedAt: "2026-04-20T00:21:00.000Z", score: 0.74 },
    { observedAt: "2026-04-20T00:22:00.000Z", score: 0.73 },
    { observedAt: "2026-04-20T00:23:00.000Z", score: 0.72 },
    { observedAt: "2026-04-20T01:00:00.000Z", score: 0.62 },
    { observedAt: "2026-04-20T01:01:00.000Z", score: 0.60 },
    { observedAt: "2026-04-20T01:02:00.000Z", score: 0.58 },
  ]);

  assert.equal(drift.severity, "high");
  assert.equal(drift.reasonCode, "drift.changepoint_detected");
});

test("drift pipeline: stable agents do not trigger alerts", () => {
  const changepointDetector = new ChangepointDetectorService();
  const analyzer = new CrossAgentAnalyzerService();

  const stableDrift = changepointDetector.detect(
    Array.from({ length: 30 }, (_, i) => ({
      observedAt: new Date(Date.now() - i * 3600_000).toISOString(),
      score: 0.92 + (Math.random() * 0.02 - 0.01),
    }))
  );

  const analysis = analyzer.analyze([
    { agentId: "stable-a", successRate: 0.92, averageCostUsd: 0.2, averageLatencyMs: 1000 },
    { agentId: "stable-b", successRate: 0.91, averageCostUsd: 0.21, averageLatencyMs: 1050 },
  ]);

  assert.equal(stableDrift.detected, false);
  assert.equal(stableDrift.reasonCode, "drift.stable");
  assert.equal(analysis.recommendation.action, "agents_consistent");
});
