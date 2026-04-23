import assert from "node:assert/strict";
import test from "node:test";
import { BehaviorFingerprintBuilder } from "../../../../../src/ops-maturity/drift-detection/fingerprint-builder/index.js";
test("BehaviorFingerprintBuilder produces a stable normalized fingerprint", () => {
    const builder = new BehaviorFingerprintBuilder();
    const fingerprint = builder.build({
        agentId: "agent-a",
        tools: ["edit", "read"],
        failureCategories: ["lint_error", "type_error"],
        averageLatencyMs: 1500,
        averageCostUsd: 0.3,
    });
    assert.equal(fingerprint.fingerprintId, "fingerprint:agent-a");
    assert.ok(fingerprint.normalizedFeatures.includes("latency_bucket:medium"));
    assert.equal(fingerprint.hash.length, 64);
});
//# sourceMappingURL=index.test.js.map