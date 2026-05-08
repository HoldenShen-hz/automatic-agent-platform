import assert from "node:assert/strict";
import test from "node:test";

import { CrossAgentAnalyzerService } from "../../../../../src/ops-maturity/drift-detection/cross-agent-analyzer/index.js";

test("CrossAgentAnalyzerService ranks agents and reports divergence", () => {
  const service = new CrossAgentAnalyzerService();
  const result = service.analyze([
    { agentId: "agent-a", successRate: 0.95, averageCostUsd: 0.2, averageLatencyMs: 900 },
    { agentId: "agent-b", successRate: 0.7, averageCostUsd: 0.8, averageLatencyMs: 4000 },
  ]);

  assert.equal(result.bestAgentId, "agent-a");
  assert.equal(result.worstAgentId, "agent-b");
  assert.equal(result.recommendation, "rebalance_or_rollout_review");
});

test("CrossAgentAnalyzerService flags synthetic and keepalive heavy workloads as anti-gaming", () => {
  const service = new CrossAgentAnalyzerService();
  const result = service.analyze([
    {
      agentId: "agent-a",
      successRate: 0.95,
      averageCostUsd: 0.2,
      averageLatencyMs: 900,
      taskKindDistribution: { real: 2, synthetic: 7, keepalive: 3 },
    },
    {
      agentId: "agent-b",
      successRate: 0.92,
      averageCostUsd: 0.25,
      averageLatencyMs: 1000,
      taskKindDistribution: { real: 8, synthetic: 1, keepalive: 0 },
    },
  ]);

  assert.equal(result.alerts.length, 1);
  assert.equal(result.alerts[0]?.antiGamingDetected, true);
  assert.equal(result.alerts[0]?.recommendation, "anti_gaming_review_required");
});
