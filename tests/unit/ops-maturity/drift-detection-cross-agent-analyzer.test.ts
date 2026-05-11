import assert from "node:assert/strict";
import test from "node:test";

import {
  CrossAgentAnalyzerService,
  type CrossAgentMetric,
} from "../../../src/ops-maturity/drift-detection/cross-agent-analyzer/index.js";

test("CrossAgentAnalyzerService returns insufficient data recommendation for empty input", () => {
  const service = new CrossAgentAnalyzerService();
  const result = service.analyze([]);

  assert.equal(result.bestAgentId, null);
  assert.equal(result.worstAgentId, null);
  assert.equal(result.divergenceScore, 0);
  assert.equal(result.recommendation.action, "insufficient_data");
  assert.deepEqual(result.alerts, []);
});

test("CrossAgentAnalyzerService does not fabricate a worst agent when a peer group has only one member", () => {
  const service = new CrossAgentAnalyzerService();
  const result = service.analyze([
    {
      agentId: "agent_solo",
      domainId: "nlp",
      successRate: 0.91,
      averageCostUsd: 1.1,
      averageLatencyMs: 120,
    },
  ]);

  assert.equal(result.bestAgentId, "agent_solo");
  assert.equal(result.worstAgentId, null);
  assert.equal(result.divergenceScore, 0);
  assert.equal(result.recommendation.code, "INSUFFICIENT_PEER_DATA");
  assert.equal(result.recommendation.action, "insufficient_data");
  assert.deepEqual(result.alerts, []);
});

test("CrossAgentAnalyzerService groups agents by domainId and reports the most divergent peer group", () => {
  const service = new CrossAgentAnalyzerService();
  const metrics: CrossAgentMetric[] = [
    { agentId: "agent_best", domainId: "nlp", successRate: 0.95, averageCostUsd: 1.0, averageLatencyMs: 100 },
    { agentId: "agent_worst", domainId: "nlp", successRate: 0.7, averageCostUsd: 1.6, averageLatencyMs: 240 },
    { agentId: "agent_vision", domainId: "vision", successRate: 0.88, averageCostUsd: 1.4, averageLatencyMs: 160 },
  ];

  const result = service.analyze(metrics);

  assert.equal(result.bestAgentId, "agent_best");
  assert.equal(result.worstAgentId, "agent_worst");
  assert.notEqual(result.recommendation.action, "insufficient_data");
  assert.ok(result.peerGroups.some((group) => group.peerGroupId === "nlp"));
  assert.ok(result.peerGroups.some((group) => group.peerGroupId === "vision"));
});

test("CrossAgentAnalyzerService emits anti-gaming alerts for anomalous task mix", () => {
  const service = new CrossAgentAnalyzerService();
  const metrics: CrossAgentMetric[] = [
    {
      agentId: "agent_1",
      domainId: "nlp",
      successRate: 0.93,
      averageCostUsd: 1.0,
      averageLatencyMs: 110,
      taskKindDistribution: { real: 10, synthetic: 60, keepalive: 30 },
    },
    {
      agentId: "agent_2",
      domainId: "nlp",
      successRate: 0.55,
      averageCostUsd: 1.01,
      averageLatencyMs: 112,
      taskKindDistribution: { real: 90, synthetic: 5, keepalive: 5 },
    },
  ];

  const result = service.analyze(metrics);

  assert.ok(result.alerts.length > 0);
  assert.equal(result.recommendation.action, "anti_gaming_review");
  assert.equal(result.alerts[0]?.recommendation.action, "anti_gaming_review");
});
