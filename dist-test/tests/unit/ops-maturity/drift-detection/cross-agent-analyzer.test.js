/**
 * Unit tests for CrossAgentAnalyzerService
 *
 * Tests the cross-agent analysis functionality for identifying
 * best/worst performing agents and detecting divergence.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CrossAgentAnalyzerService } from "../../../../src/ops-maturity/drift-detection/cross-agent-analyzer/index.js";
test("CrossAgentAnalyzerService.analyze returns best and worst agents", () => {
    const service = new CrossAgentAnalyzerService();
    const metrics = [
        { agentId: "agent-a", successRate: 0.95, averageCostUsd: 0.2, averageLatencyMs: 900 },
        { agentId: "agent-b", successRate: 0.7, averageCostUsd: 0.8, averageLatencyMs: 4000 },
    ];
    const result = service.analyze(metrics);
    assert.equal(result.bestAgentId, "agent-a");
    assert.equal(result.worstAgentId, "agent-b");
});
test("CrossAgentAnalyzerService.analyze returns divergence score", () => {
    const service = new CrossAgentAnalyzerService();
    const metrics = [
        { agentId: "agent-a", successRate: 0.95, averageCostUsd: 0.2, averageLatencyMs: 900 },
        { agentId: "agent-b", successRate: 0.7, averageCostUsd: 0.8, averageLatencyMs: 4000 },
    ];
    const result = service.analyze(metrics);
    assert.ok(result.divergenceScore >= 0);
});
test("CrossAgentAnalyzerService.analyze recommends rebalance when divergence is high", () => {
    const service = new CrossAgentAnalyzerService();
    const metrics = [
        { agentId: "agent-a", successRate: 0.95, averageCostUsd: 0.2, averageLatencyMs: 900 },
        { agentId: "agent-b", successRate: 0.7, averageCostUsd: 0.8, averageLatencyMs: 4000 },
    ];
    const result = service.analyze(metrics);
    assert.equal(result.recommendation, "rebalance_or_rollout_review");
});
test("CrossAgentAnalyzerService.analyze returns consistent agents when divergence is low", () => {
    const service = new CrossAgentAnalyzerService();
    const metrics = [
        { agentId: "agent-a", successRate: 0.90, averageCostUsd: 0.2, averageLatencyMs: 1000 },
        { agentId: "agent-b", successRate: 0.88, averageCostUsd: 0.25, averageLatencyMs: 1100 },
    ];
    const result = service.analyze(metrics);
    assert.equal(result.recommendation, "agents_are_consistent");
});
test("CrossAgentAnalyzerService.analyze handles empty metrics array", () => {
    const service = new CrossAgentAnalyzerService();
    const result = service.analyze([]);
    assert.equal(result.bestAgentId, null);
    assert.equal(result.worstAgentId, null);
    assert.equal(result.divergenceScore, 0);
    assert.equal(result.recommendation, "insufficient_data");
});
test("CrossAgentAnalyzerService.analyze handles single agent", () => {
    const service = new CrossAgentAnalyzerService();
    const metrics = [
        { agentId: "agent-only", successRate: 0.85, averageCostUsd: 0.3, averageLatencyMs: 1500 },
    ];
    const result = service.analyze(metrics);
    assert.equal(result.bestAgentId, "agent-only");
    assert.equal(result.worstAgentId, "agent-only");
    assert.equal(result.divergenceScore, 0);
});
test("CrossAgentAnalyzerService.analyze ranks by composite score", () => {
    const service = new CrossAgentAnalyzerService();
    const metrics = [
        // agent-a: 0.95 - 0.02 - 0.09 = 0.84
        { agentId: "agent-a", successRate: 0.95, averageCostUsd: 0.2, averageLatencyMs: 900 },
        // agent-b: 0.85 - 0.05 - 0.3 = 0.50
        { agentId: "agent-b", successRate: 0.85, averageCostUsd: 0.5, averageLatencyMs: 3000 },
        // agent-c: 0.90 - 0.04 - 0.2 = 0.66
        { agentId: "agent-c", successRate: 0.90, averageCostUsd: 0.4, averageLatencyMs: 2000 },
    ];
    const result = service.analyze(metrics);
    assert.equal(result.bestAgentId, "agent-a");
    assert.equal(result.worstAgentId, "agent-b");
    assert.ok(result.divergenceScore > 0);
});
test("CrossAgentAnalyzerService.analyze handles zero cost and latency", () => {
    const service = new CrossAgentAnalyzerService();
    const metrics = [
        { agentId: "agent-a", successRate: 0.90, averageCostUsd: 0, averageLatencyMs: 0 },
        { agentId: "agent-b", successRate: 0.80, averageCostUsd: 0, averageLatencyMs: 0 },
    ];
    const result = service.analyze(metrics);
    assert.equal(result.bestAgentId, "agent-a");
    assert.ok(result.divergenceScore >= 0);
});
test("CrossAgentAnalyzerService.analyze cost factor in scoring", () => {
    const service = new CrossAgentAnalyzerService();
    // Same success rate but different costs - lower cost should win
    const metrics = [
        { agentId: "cheap", successRate: 0.90, averageCostUsd: 0.1, averageLatencyMs: 1000 },
        { agentId: "expensive", successRate: 0.90, averageCostUsd: 1.0, averageLatencyMs: 1000 },
    ];
    const result = service.analyze(metrics);
    assert.equal(result.bestAgentId, "cheap");
    assert.equal(result.worstAgentId, "expensive");
});
test("CrossAgentAnalyzerService.analyze latency factor in scoring", () => {
    const service = new CrossAgentAnalyzerService();
    // Same success rate but different latency - lower latency should win
    const metrics = [
        { agentId: "fast", successRate: 0.90, averageCostUsd: 0.3, averageLatencyMs: 500 },
        { agentId: "slow", successRate: 0.90, averageCostUsd: 0.3, averageLatencyMs: 5000 },
    ];
    const result = service.analyze(metrics);
    assert.equal(result.bestAgentId, "fast");
    assert.equal(result.worstAgentId, "slow");
});
test("CrossAgentAnalyzerService.analyze identical agents have zero divergence", () => {
    const service = new CrossAgentAnalyzerService();
    const metrics = [
        { agentId: "agent-a", successRate: 0.90, averageCostUsd: 0.3, averageLatencyMs: 1000 },
        { agentId: "agent-b", successRate: 0.90, averageCostUsd: 0.3, averageLatencyMs: 1000 },
    ];
    const result = service.analyze(metrics);
    assert.equal(result.divergenceScore, 0);
    assert.equal(result.recommendation, "agents_are_consistent");
});
test("CrossAgentAnalyzerService.analyze three agents with clear ranking", () => {
    const service = new CrossAgentAnalyzerService();
    const metrics = [
        { agentId: "winner", successRate: 0.98, averageCostUsd: 0.1, averageLatencyMs: 500 },
        { agentId: "middle", successRate: 0.85, averageCostUsd: 0.4, averageLatencyMs: 2000 },
        { agentId: "loser", successRate: 0.60, averageCostUsd: 0.9, averageLatencyMs: 8000 },
    ];
    const result = service.analyze(metrics);
    assert.equal(result.bestAgentId, "winner");
    assert.equal(result.worstAgentId, "loser");
    assert.ok(result.divergenceScore > 0.2);
    assert.equal(result.recommendation, "rebalance_or_rollout_review");
});
test("CrossAgentAnalyzerService.analyze boundary case at 0.2 divergence threshold", () => {
    const service = new CrossAgentAnalyzerService();
    // Create metrics where divergence is exactly at threshold
    const metrics = [
        { agentId: "top", successRate: 0.95, averageCostUsd: 0.01, averageLatencyMs: 100 },
        { agentId: "bottom", successRate: 0.75, averageCostUsd: 0.8, averageLatencyMs: 5000 },
    ];
    const result = service.analyze(metrics);
    // Divergence >= 0.2 should recommend rebalance
    assert.ok(result.divergenceScore >= 0.2);
    assert.equal(result.recommendation, "rebalance_or_rollout_review");
});
//# sourceMappingURL=cross-agent-analyzer.test.js.map