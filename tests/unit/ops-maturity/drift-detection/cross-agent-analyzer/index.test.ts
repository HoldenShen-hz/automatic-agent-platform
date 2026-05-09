import assert from "node:assert/strict";
import test from "node:test";

import { CrossAgentAnalyzerService } from "../../../../../src/ops-maturity/drift-detection/cross-agent-analyzer/index.js";

test("CrossAgentAnalyzerService ranks agents and reports divergence", () => {
  const service = new CrossAgentAnalyzerService();
  const result = service.analyze([
    { agentId: "agent-a", domainId: "finance", successRate: 0.95, averageCostUsd: 0.2, averageLatencyMs: 900 },
    { agentId: "agent-b", domainId: "finance", successRate: 0.7, averageCostUsd: 0.8, averageLatencyMs: 4000 },
  ]);

  assert.equal(result.bestAgentId, "agent-a");
  assert.equal(result.worstAgentId, "agent-b");
  assert.equal(result.recommendation.action, "immediate_rollback");
  assert.equal(result.peerGroups[0]?.peerGroupId, "finance");
});

test("CrossAgentAnalyzerService flags synthetic and keepalive heavy workloads as anti-gaming", () => {
  const service = new CrossAgentAnalyzerService();
  const result = service.analyze([
    {
      agentId: "agent-a",
      domainId: "support",
      successRate: 0.95,
      averageCostUsd: 0.2,
      averageLatencyMs: 900,
      taskKindDistribution: { real: 2, synthetic: 7, keepalive: 3 },
    },
    {
      agentId: "agent-b",
      domainId: "support",
      successRate: 0.92,
      averageCostUsd: 0.25,
      averageLatencyMs: 1000,
      taskKindDistribution: { real: 8, synthetic: 1, keepalive: 0 },
    },
  ]);

  assert.equal(result.alerts.length, 1);
  assert.equal(result.alerts[0]?.antiGamingDetected, true);
  assert.equal(result.alerts[0]?.recommendation.action, "anti_gaming_review");
  assert.equal(result.alerts[0]?.peerGroupId, "support");
});

test("CrossAgentAnalyzerService separates peer groups by domain", () => {
  const service = new CrossAgentAnalyzerService();
  const result = service.analyze([
    { agentId: "agent-a", domainId: "finance", successRate: 0.95, averageCostUsd: 0.2, averageLatencyMs: 900 },
    { agentId: "agent-b", domainId: "finance", successRate: 0.91, averageCostUsd: 0.3, averageLatencyMs: 1000 },
    { agentId: "agent-c", domainId: "support", successRate: 0.99, averageCostUsd: 0.1, averageLatencyMs: 800 },
    { agentId: "agent-d", domainId: "support", successRate: 0.6, averageCostUsd: 1.2, averageLatencyMs: 9000 },
  ]);

  assert.equal(result.peerGroups.length, 2);
  assert.ok(result.peerGroups.some((group) => group.peerGroupId === "support" && group.divergenceScore > 0.2));
});
