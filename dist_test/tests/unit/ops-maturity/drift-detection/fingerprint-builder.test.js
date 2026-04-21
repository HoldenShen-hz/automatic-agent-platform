import assert from "node:assert/strict";
import test from "node:test";
import { BehaviorFingerprintBuilder } from "../../../../src/ops-maturity/drift-detection/fingerprint-builder/index.js";
import { ChangepointDetectorService } from "../../../../src/ops-maturity/drift-detection/changepoint-detector/index.js";
test.describe("BehaviorFingerprintBuilder", () => {
    test("builds fingerprint with correct fingerprintId", () => {
        const builder = new BehaviorFingerprintBuilder();
        const fingerprint = builder.build({
            agentId: "agent-123",
            tools: ["read", "edit"],
            failureCategories: ["timeout"],
            averageLatencyMs: 500,
            averageCostUsd: 0.05,
        });
        assert.equal(fingerprint.fingerprintId, "fingerprint:agent-123");
    });
    test("generates consistent hash for same input", () => {
        const builder = new BehaviorFingerprintBuilder();
        const input = {
            agentId: "agent-x",
            tools: ["read", "edit"],
            failureCategories: ["error"],
            averageLatencyMs: 2000,
            averageCostUsd: 0.5,
        };
        const fingerprint1 = builder.build(input);
        const fingerprint2 = builder.build(input);
        assert.equal(fingerprint1.hash, fingerprint2.hash);
    });
    test("generates different hash for different input", () => {
        const builder = new BehaviorFingerprintBuilder();
        const fingerprint1 = builder.build({
            agentId: "agent-a",
            tools: ["read"],
            failureCategories: [],
            averageLatencyMs: 100,
            averageCostUsd: 0.01,
        });
        const fingerprint2 = builder.build({
            agentId: "agent-b",
            tools: ["read"],
            failureCategories: [],
            averageLatencyMs: 100,
            averageCostUsd: 0.01,
        });
        assert.notEqual(fingerprint1.hash, fingerprint2.hash);
    });
    test("sorts tools and failure categories for deterministic output", () => {
        const builder = new BehaviorFingerprintBuilder();
        const fingerprint1 = builder.build({
            agentId: "agent-z",
            tools: ["zap", "alpha", "beta"],
            failureCategories: ["z_error", "a_error"],
            averageLatencyMs: 3000,
            averageCostUsd: 0.2,
        });
        const fingerprint2 = builder.build({
            agentId: "agent-z",
            tools: ["alpha", "beta", "zap"],
            failureCategories: ["a_error", "z_error"],
            averageLatencyMs: 3000,
            averageCostUsd: 0.2,
        });
        assert.equal(fingerprint1.hash, fingerprint2.hash);
    });
    test("buckets latency as fast when below 1000ms", () => {
        const builder = new BehaviorFingerprintBuilder();
        const fingerprint = builder.build({
            agentId: "fast-agent",
            tools: [],
            failureCategories: [],
            averageLatencyMs: 500,
            averageCostUsd: 0.01,
        });
        assert.ok(fingerprint.normalizedFeatures.includes("latency_bucket:fast"));
    });
    test("buckets latency as medium when between 1000ms and 5000ms", () => {
        const builder = new BehaviorFingerprintBuilder();
        const fingerprint = builder.build({
            agentId: "medium-agent",
            tools: [],
            failureCategories: [],
            averageLatencyMs: 3000,
            averageCostUsd: 0.01,
        });
        assert.ok(fingerprint.normalizedFeatures.includes("latency_bucket:medium"));
    });
    test("buckets latency as slow when 5000ms or above", () => {
        const builder = new BehaviorFingerprintBuilder();
        const fingerprint = builder.build({
            agentId: "slow-agent",
            tools: [],
            failureCategories: [],
            averageLatencyMs: 7000,
            averageCostUsd: 0.01,
        });
        assert.ok(fingerprint.normalizedFeatures.includes("latency_bucket:slow"));
    });
    test("buckets cost as low when below 0.1", () => {
        const builder = new BehaviorFingerprintBuilder();
        const fingerprint = builder.build({
            agentId: "cheap-agent",
            tools: [],
            failureCategories: [],
            averageLatencyMs: 100,
            averageCostUsd: 0.05,
        });
        assert.ok(fingerprint.normalizedFeatures.includes("cost_bucket:low"));
    });
    test("buckets cost as medium when between 0.1 and 1", () => {
        const builder = new BehaviorFingerprintBuilder();
        const fingerprint = builder.build({
            agentId: "moderate-agent",
            tools: [],
            failureCategories: [],
            averageLatencyMs: 100,
            averageCostUsd: 0.5,
        });
        assert.ok(fingerprint.normalizedFeatures.includes("cost_bucket:medium"));
    });
    test("buckets cost as high when 1 or above", () => {
        const builder = new BehaviorFingerprintBuilder();
        const fingerprint = builder.build({
            agentId: "expensive-agent",
            tools: [],
            failureCategories: [],
            averageLatencyMs: 100,
            averageCostUsd: 2.0,
        });
        assert.ok(fingerprint.normalizedFeatures.includes("cost_bucket:high"));
    });
    test("handles empty tools and failure categories", () => {
        const builder = new BehaviorFingerprintBuilder();
        const fingerprint = builder.build({
            agentId: "minimal-agent",
            tools: [],
            failureCategories: [],
            averageLatencyMs: 100,
            averageCostUsd: 0.01,
        });
        assert.equal(fingerprint.fingerprintId, "fingerprint:minimal-agent");
        assert.ok(fingerprint.normalizedFeatures.includes("tools:"));
        assert.ok(fingerprint.normalizedFeatures.includes("failures:"));
    });
    test("produces SHA-256 hash of 64 hex characters", () => {
        const builder = new BehaviorFingerprintBuilder();
        const fingerprint = builder.build({
            agentId: "hash-test-agent",
            tools: ["test"],
            failureCategories: [],
            averageLatencyMs: 100,
            averageCostUsd: 0.01,
        });
        assert.equal(fingerprint.hash.length, 64);
        assert.match(fingerprint.hash, /^[a-f0-9]+$/);
    });
});
test.describe("ChangepointDetectorService", () => {
    test("detects drift when recent mean shifts significantly from baseline", () => {
        const service = new ChangepointDetectorService();
        const result = service.detect([
            { observedAt: "2026-04-20T00:00:00.000Z", score: 0.9 },
            { observedAt: "2026-04-20T00:01:00.000Z", score: 0.88 },
            { observedAt: "2026-04-20T00:02:00.000Z", score: 0.87 },
            { observedAt: "2026-04-20T00:03:00.000Z", score: 0.4 },
            { observedAt: "2026-04-20T00:04:00.000Z", score: 0.42 },
            { observedAt: "2026-04-20T00:05:00.000Z", score: 0.38 },
        ]);
        assert.equal(result.detected, true);
        assert.equal(result.reasonCode, "drift.changepoint_detected");
        assert.ok(result.absoluteShift >= 0.15);
    });
    test("does not detect drift when scores are stable", () => {
        const service = new ChangepointDetectorService();
        const result = service.detect([
            { observedAt: "2026-04-20T00:00:00.000Z", score: 0.8 },
            { observedAt: "2026-04-20T00:01:00.000Z", score: 0.81 },
            { observedAt: "2026-04-20T00:02:00.000Z", score: 0.79 },
            { observedAt: "2026-04-20T00:03:00.000Z", score: 0.8 },
            { observedAt: "2026-04-20T00:04:00.000Z", score: 0.81 },
            { observedAt: "2026-04-20T00:05:00.000Z", score: 0.8 },
        ]);
        assert.equal(result.detected, false);
        assert.equal(result.reasonCode, "drift.stable");
        assert.ok(result.absoluteShift < 0.15);
    });
    test("calculates correct baseline and recent means", () => {
        const service = new ChangepointDetectorService();
        const result = service.detect([
            { observedAt: "2026-04-20T00:00:00.000Z", score: 0.6 },
            { observedAt: "2026-04-20T00:01:00.000Z", score: 0.7 },
            { observedAt: "2026-04-20T00:02:00.000Z", score: 0.65 },
            { observedAt: "2026-04-20T00:03:00.000Z", score: 0.2 },
            { observedAt: "2026-04-20T00:04:00.000Z", score: 0.25 },
        ], 3, 2);
        assert.ok(result.baselineMean > result.recentMean);
        assert.ok(result.absoluteShift >= 0.15);
    });
    test("handles empty samples gracefully", () => {
        const service = new ChangepointDetectorService();
        const result = service.detect([]);
        assert.equal(result.detected, false);
        assert.equal(result.baselineMean, 0);
        assert.equal(result.recentMean, 0);
        assert.equal(result.absoluteShift, 0);
    });
    test("uses custom window sizes when specified", () => {
        const service = new ChangepointDetectorService();
        const samples = [
            { observedAt: "2026-04-20T00:00:00.000Z", score: 0.5 },
            { observedAt: "2026-04-20T00:01:00.000Z", score: 0.55 },
            { observedAt: "2026-04-20T00:02:00.000Z", score: 0.6 },
            { observedAt: "2026-04-20T00:03:00.000Z", score: 0.2 },
            { observedAt: "2026-04-20T00:04:00.000Z", score: 0.25 },
        ];
        const resultWindow123 = service.detect(samples, 1, 2);
        const resultWindow321 = service.detect(samples, 3, 2);
        assert.notEqual(resultWindow123.baselineMean, resultWindow321.baselineMean);
    });
    test("detects upward drift", () => {
        const service = new ChangepointDetectorService();
        const result = service.detect([
            { observedAt: "2026-04-20T00:00:00.000Z", score: 0.1 },
            { observedAt: "2026-04-20T00:01:00.000Z", score: 0.12 },
            { observedAt: "2026-04-20T00:02:00.000Z", score: 0.11 },
            { observedAt: "2026-04-20T00:03:00.000Z", score: 0.8 },
            { observedAt: "2026-04-20T00:04:00.000Z", score: 0.85 },
            { observedAt: "2026-04-20T00:05:00.000Z", score: 0.82 },
        ]);
        assert.equal(result.detected, true);
        assert.ok(result.recentMean > result.baselineMean);
    });
    test("threshold of 0.15 is exclusive for stable detection", () => {
        const service = new ChangepointDetectorService();
        const result = service.detect([
            { observedAt: "2026-04-20T00:00:00.000Z", score: 0.5 },
            { observedAt: "2026-04-20T00:01:00.000Z", score: 0.5 },
            { observedAt: "2026-04-20T00:02:00.000Z", score: 0.5 },
            { observedAt: "2026-04-20T00:03:00.000Z", score: 0.64 },
            { observedAt: "2026-04-20T00:04:00.000Z", score: 0.65 },
        ]);
        assert.equal(result.detected, false);
        assert.ok(result.absoluteShift < 0.15);
    });
    test("threshold of 0.15 is inclusive for drift detection", () => {
        const service = new ChangepointDetectorService();
        // 7 samples with window=3: baseline=[0.5,0.5,0.5], recent=[0.7,0.7,0.7], shift=0.2
        const result = service.detect([
            { observedAt: "2026-04-20T00:00:00.000Z", score: 0.5 },
            { observedAt: "2026-04-20T00:01:00.000Z", score: 0.5 },
            { observedAt: "2026-04-20T00:02:00.000Z", score: 0.5 },
            { observedAt: "2026-04-20T00:03:00.000Z", score: 0.5 },
            { observedAt: "2026-04-20T00:04:00.000Z", score: 0.7 },
            { observedAt: "2026-04-20T00:05:00.000Z", score: 0.7 },
            { observedAt: "2026-04-20T00:06:00.000Z", score: 0.7 },
        ]);
        assert.equal(result.detected, true);
        assert.ok(result.absoluteShift >= 0.15);
    });
});
test.describe("Fingerprint-based drift detection integration", () => {
    test("detects behavioral drift by comparing fingerprint hashes", () => {
        const builder = new BehaviorFingerprintBuilder();
        const service = new ChangepointDetectorService();
        const baselineFingerprint = builder.build({
            agentId: "drift-test-agent",
            tools: ["read", "edit", "bash"],
            failureCategories: ["lint_error"],
            averageLatencyMs: 2000,
            averageCostUsd: 0.5,
        });
        const driftedFingerprint = builder.build({
            agentId: "drift-test-agent",
            tools: ["read", "edit", "bash", "new_tool"],
            failureCategories: ["lint_error", "runtime_error"],
            averageLatencyMs: 6000,
            averageCostUsd: 2.0,
        });
        assert.notEqual(baselineFingerprint.hash, driftedFingerprint.hash);
        assert.notEqual(baselineFingerprint.normalizedFeatures.join("|"), driftedFingerprint.normalizedFeatures.join("|"));
        const fingerprintScores = [
            { observedAt: "2026-04-20T00:00:00.000Z", score: 1.0 },
            { observedAt: "2026-04-20T00:01:00.000Z", score: 1.0 },
            { observedAt: "2026-04-20T00:02:00.000Z", score: 1.0 },
            { observedAt: "2026-04-20T00:03:00.000Z", score: 0.0 },
            { observedAt: "2026-04-20T00:04:00.000Z", score: 0.0 },
        ];
        const changeResult = service.detect(fingerprintScores);
        assert.equal(changeResult.detected, true);
    });
    test("fingerprint stability is preserved with identical inputs", () => {
        const builder = new BehaviorFingerprintBuilder();
        const service = new ChangepointDetectorService();
        const input = {
            agentId: "stable-agent",
            tools: ["read", "edit"],
            failureCategories: ["timeout"],
            averageLatencyMs: 3000,
            averageCostUsd: 0.8,
        };
        const fingerprints = Array.from({ length: 5 }, () => builder.build(input));
        const allHashesEqual = fingerprints.every((f) => f.hash === fingerprints[0].hash);
        assert.equal(allHashesEqual, true);
        const stableScores = fingerprints.map((f, i) => ({
            observedAt: `2026-04-20T00:0${i}:00.000Z`,
            score: 1.0,
        }));
        const result = service.detect(stableScores);
        assert.equal(result.detected, false);
    });
});
//# sourceMappingURL=fingerprint-builder.test.js.map