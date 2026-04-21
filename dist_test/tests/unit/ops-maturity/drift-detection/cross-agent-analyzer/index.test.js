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
//# sourceMappingURL=index.test.js.map