import assert from "node:assert/strict";
import test from "node:test";
import { BehaviorFingerprintBuilder } from "../../../../src/ops-maturity/drift-detection/fingerprint-builder/index.js";
import { ChangepointDetectorService } from "../../../../src/ops-maturity/drift-detection/changepoint-detector/index.js";
import { CrossAgentAnalyzerService } from "../../../../src/ops-maturity/drift-detection/cross-agent-analyzer/index.js";
test("integration: drift analysis pipeline combines fingerprinting, changepoint detection, and cross-agent ranking", () => {
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
//# sourceMappingURL=analysis-pipeline-integration.test.js.map