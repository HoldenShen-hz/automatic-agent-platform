import { createHash } from "node:crypto";
export class BehaviorFingerprintBuilder {
    build(input) {
        const normalizedFeatures = [
            `agent:${input.agentId}`,
            `tools:${[...input.tools].sort().join(",")}`,
            `failures:${[...input.failureCategories].sort().join(",")}`,
            `latency_bucket:${bucketLatency(input.averageLatencyMs)}`,
            `cost_bucket:${bucketCost(input.averageCostUsd)}`,
        ];
        const hash = createHash("sha256").update(normalizedFeatures.join("|")).digest("hex");
        return {
            fingerprintId: `fingerprint:${input.agentId}`,
            normalizedFeatures,
            hash,
        };
    }
}
function bucketLatency(latencyMs) {
    if (latencyMs < 1_000) {
        return "fast";
    }
    if (latencyMs < 5_000) {
        return "medium";
    }
    return "slow";
}
function bucketCost(costUsd) {
    if (costUsd < 0.1) {
        return "low";
    }
    if (costUsd < 1) {
        return "medium";
    }
    return "high";
}
//# sourceMappingURL=index.js.map