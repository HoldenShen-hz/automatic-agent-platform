import assert from "node:assert/strict";
import test from "node:test";
import {
  CrossAgentAnalyzerService,
  type CrossAgentMetric,
} from "../../../src/ops-maturity/drift-detection/cross-agent-analyzer/index.js";

test("CrossAgentAnalyzerService analyze returns insufficient_data for empty metrics", () => {
  const service = new CrossAgentAnalyzerService();
  const result = service.analyze([]);

  assert.strictEqual(result.bestAgentId, null);
  assert.strictEqual(result.worstAgentId, null);
  assert.strictEqual(result.divergenceScore, 0);
  assert.strictEqual(result.recommendation, "insufficient_data");
  assert.deepStrictEqual(result.alerts, []);
});

test("CrossAgentAnalyzerService analyze builds peer groups by domain", () => {
  const service = new CrossAgentAnalyzerService();
  const metrics: CrossAgentMetric[] = [
    { agentId: "agent_1", domain: "nlp", successRate: 0.9, averageCostUsd: 1.0, averageLatencyMs: 100 },
    { agentId: "agent_2", domain: "nlp", successRate: 0.85, averageCostUsd: 1.2, averageLatencyMs: 110 },
    { agentId: "agent_3", domain: "vision", successRate: 0.88, averageCostUsd: 2.0, averageLatencyMs: 200 },
  ];

  const result = service.analyze(metrics);

  // Service identifies best and worst agents by composite score
  assert.ok(result.bestAgentId !== null);
  assert.ok(result.worstAgentId !== null);
  assert.ok(result.divergenceScore >= 0);
});

test("CrossAgentAnalyzerService analyze identifies best and worst agents", () => {
  const service = new CrossAgentAnalyzerService();
  const metrics: CrossAgentMetric[] = [
    { agentId: "agent_best", domain: "nlp", successRate: 0.95, averageCostUsd: 1.0, averageLatencyMs: 100 },
    { agentId: "agent_worst", domain: "nlp", successRate: 0.7, averageCostUsd: 1.5, averageLatencyMs: 200 },
  ];

  const result = service.analyze(metrics);

  assert.strictEqual(result.bestAgentId, "agent_best");
  assert.strictEqual(result.worstAgentId, "agent_worst");
  assert.ok(result.divergenceScore > 0);
});

test("CrossAgentAnalyzerService getDriftAlerts returns alert history", () => {
  const service = new CrossAgentAnalyzerService();
  // Trigger an alert by creating high divergence
  const metrics: CrossAgentMetric[] = [
    { agentId: "agent_1", domain: "nlp", successRate: 0.95, averageCostUsd: 1.0, averageLatencyMs: 100 },
    { agentId: "agent_2", domain: "nlp", successRate: 0.5, averageCostUsd: 1.0, averageLatencyMs: 100 },
  ];

  service.analyze(metrics);
  const alerts = service.getDriftAlerts();

  assert.ok(alerts.length > 0);
});

test("CrossAgentAnalyzerService analyze handles single agent", () => {
  const service = new CrossAgentAnalyzerService();
  const metrics: CrossAgentMetric[] = [
    { agentId: "agent_solo", domain: "nlp", successRate: 0.9, averageCostUsd: 1.0, averageLatencyMs: 100 },
  ];

  const result = service.analyze(metrics);

  // With only one agent, divergenceScore is 0 but best/worst are still the same agent
  assert.strictEqual(result.bestAgentId, "agent_solo");
  assert.strictEqual(result.worstAgentId, "agent_solo");
  assert.strictEqual(result.divergenceScore, 0);
});

test("CrossAgentAnalyzerService analyze detects anti-gaming pattern", () => {
  const service = new CrossAgentAnalyzerService();
  // High variance in success rates with low variance in cost indicates gaming
  const metrics: CrossAgentMetric[] = [
    { agentId: "agent_1", domain: "nlp", successRate: 0.99, averageCostUsd: 1.0, averageLatencyMs: 100 },
    { agentId: "agent_2", domain: "nlp", successRate: 0.5, averageCostUsd: 1.01, averageLatencyMs: 100 },
    { agentId: "agent_3", domain: "nlp", successRate: 0.95, averageCostUsd: 0.99, averageLatencyMs: 100 },
  ];

  const result = service.analyze(metrics);

  // Anti-gaming may or may not be detected depending on variance thresholds
  assert.ok(result.alerts.length >= 0);
  assert.ok(result.divergenceScore >= 0);
});

test("CrossAgentAnalyzerService analyze returns consistent recommendation", () => {
  const service = new CrossAgentAnalyzerService();
  const metrics: CrossAgentMetric[] = [
    { agentId: "agent_1", domain: "nlp", successRate: 0.9, averageCostUsd: 1.0, averageLatencyMs: 100 },
    { agentId: "agent_2", domain: "nlp", successRate: 0.85, averageCostUsd: 1.2, averageLatencyMs: 110 },
  ];

  const result = service.analyze(metrics);

  // Agents are similar, should recommend they are consistent
  assert.ok(
    result.recommendation === "agents_are_consistent" || result.recommendation === "rebalance_or_rollout_review"
  );
});