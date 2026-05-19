import assert from "node:assert/strict";
import test from "node:test";
import { resolveRegionFailover, } from "../../../../../src/scale-ecosystem/multi-region/failover-controller/index.js";
// ---------------------------------------------------------------------------
// Helper - build minimal RegionFailoverInput
// ---------------------------------------------------------------------------
function makeInput(overrides = {}) {
    return {
        primaryHealthy: true,
        candidateRegionIds: ["us-east-1", "us-west-2"],
        ...overrides,
    };
}
function assertDecision(actual, expectedShouldFailover, expectedTargetRegionId, expectedRationalePrefix) {
    assert.equal(actual.shouldFailover, expectedShouldFailover, `shouldFailover mismatch: ${actual.rationale}`);
    assert.equal(actual.targetRegionId, expectedTargetRegionId, `targetRegionId mismatch`);
    assert.ok(actual.rationale.startsWith(expectedRationalePrefix), `rationale should start with ${expectedRationalePrefix}, got: ${actual.rationale}`);
}
// ---------------------------------------------------------------------------
// Primary healthy, no degradation
// ---------------------------------------------------------------------------
test("resolveRegionFailover - primary healthy with no degradation returns no failover", () => {
    const input = makeInput({ primaryHealthy: true });
    const result = resolveRegionFailover(input);
    assertDecision(result, false, null, "multi_region.primary_within_threshold");
});
test("resolveRegionFailover - primary healthy with latency below threshold returns no failover", () => {
    const input = makeInput({
        primaryHealthy: true,
        primaryLatencyMs: 50,
        maxAcceptableLatencyMs: 100,
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, false, null, "multi_region.primary_within_threshold");
});
test("resolveRegionFailover - primary healthy with error rate below threshold returns no failover", () => {
    const input = makeInput({
        primaryHealthy: true,
        primaryErrorRate: 0.01,
        maxAcceptableErrorRate: 0.05,
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, false, null, "multi_region.primary_within_threshold");
});
// ---------------------------------------------------------------------------
// Primary unhealthy triggers failover
// ---------------------------------------------------------------------------
test("resolveRegionFailover - primary unhealthy triggers failover to first candidate", () => {
    const input = makeInput({ primaryHealthy: false });
    const result = resolveRegionFailover(input);
    assertDecision(result, true, "us-east-1", "multi_region.primary_unhealthy");
});
test("resolveRegionFailover - primary unhealthy with preferred region uses preferred region", () => {
    const input = makeInput({
        primaryHealthy: false,
        preferredRegionId: "us-west-2",
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, true, "us-west-2", "multi_region.primary_unhealthy");
});
test("resolveRegionFailover - primary unhealthy with non-candidate preferred region falls back to first candidate", () => {
    const input = makeInput({
        primaryHealthy: false,
        preferredRegionId: "eu-west-1",
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, true, "us-east-1", "multi_region.primary_unhealthy");
});
// ---------------------------------------------------------------------------
// Latency breach triggers failover
// ---------------------------------------------------------------------------
test("resolveRegionFailover - latency breach triggers failover", () => {
    const input = makeInput({
        primaryHealthy: true,
        primaryLatencyMs: 150,
        maxAcceptableLatencyMs: 100,
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, true, "us-east-1", "multi_region.primary_latency_breached");
});
test("resolveRegionFailover - latency breach with preferred region uses preferred region", () => {
    const input = makeInput({
        primaryHealthy: true,
        primaryLatencyMs: 150,
        maxAcceptableLatencyMs: 100,
        preferredRegionId: "us-west-2",
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, true, "us-west-2", "multi_region.primary_latency_breached");
});
test("resolveRegionFailover - latency at exact threshold does not breach", () => {
    const input = makeInput({
        primaryHealthy: true,
        primaryLatencyMs: 100,
        maxAcceptableLatencyMs: 100,
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, false, null, "multi_region.primary_within_threshold");
});
test("resolveRegionFailover - latency just above threshold breaches", () => {
    const input = makeInput({
        primaryHealthy: true,
        primaryLatencyMs: 101,
        maxAcceptableLatencyMs: 100,
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, true, "us-east-1", "multi_region.primary_latency_breached");
});
// ---------------------------------------------------------------------------
// Error rate breach triggers failover
// ---------------------------------------------------------------------------
test("resolveRegionFailover - error rate breach triggers failover", () => {
    const input = makeInput({
        primaryHealthy: true,
        primaryErrorRate: 0.1,
        maxAcceptableErrorRate: 0.05,
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, true, "us-east-1", "multi_region.primary_error_rate_breached");
});
test("resolveRegionFailover - error rate breach with preferred region uses preferred region", () => {
    const input = makeInput({
        primaryHealthy: true,
        primaryErrorRate: 0.1,
        maxAcceptableErrorRate: 0.05,
        preferredRegionId: "us-west-2",
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, true, "us-west-2", "multi_region.primary_error_rate_breached");
});
test("resolveRegionFailover - error rate at exact threshold does not breach", () => {
    const input = makeInput({
        primaryHealthy: true,
        primaryErrorRate: 0.05,
        maxAcceptableErrorRate: 0.05,
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, false, null, "multi_region.primary_within_threshold");
});
test("resolveRegionFailover - error rate just above threshold breaches", () => {
    const input = makeInput({
        primaryHealthy: true,
        primaryErrorRate: 0.051,
        maxAcceptableErrorRate: 0.05,
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, true, "us-east-1", "multi_region.primary_error_rate_breached");
});
// ---------------------------------------------------------------------------
// Multiple degradation conditions
// ---------------------------------------------------------------------------
test("resolveRegionFailover - both latency and error rate breached uses primary_unhealthy rationale", () => {
    const input = makeInput({
        primaryHealthy: false,
        primaryLatencyMs: 150,
        maxAcceptableLatencyMs: 100,
        primaryErrorRate: 0.1,
        maxAcceptableErrorRate: 0.05,
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, true, "us-east-1", "multi_region.primary_unhealthy");
});
test("resolveRegionFailover - latency breached but primary unhealthy uses primary_unhealthy rationale", () => {
    const input = makeInput({
        primaryHealthy: false,
        primaryLatencyMs: 150,
        maxAcceptableLatencyMs: 100,
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, true, "us-east-1", "multi_region.primary_unhealthy");
});
// ---------------------------------------------------------------------------
// Empty candidate regions
// ---------------------------------------------------------------------------
test("resolveRegionFailover - empty candidate regions returns no failover when degraded", () => {
    const input = makeInput({
        primaryHealthy: false,
        candidateRegionIds: [],
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, false, null, "multi_region.no_candidate_available");
});
test("resolveRegionFailover - empty candidate regions returns no failover when healthy", () => {
    const input = makeInput({
        primaryHealthy: true,
        candidateRegionIds: [],
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, false, null, "multi_region.primary_within_threshold");
});
// ---------------------------------------------------------------------------
// Single candidate region
// ---------------------------------------------------------------------------
test("resolveRegionFailover - single candidate region is selected", () => {
    const input = makeInput({
        primaryHealthy: false,
        candidateRegionIds: ["eu-west-1"],
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, true, "eu-west-1", "multi_region.primary_unhealthy");
});
// ---------------------------------------------------------------------------
// Null/undefined latency and error rate (no threshold check)
// ---------------------------------------------------------------------------
test("resolveRegionFailover - null latency and error rate with unhealthy primary triggers failover", () => {
    const input = makeInput({
        primaryHealthy: false,
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, true, "us-east-1", "multi_region.primary_unhealthy");
});
test("resolveRegionFailover - null latency and error rate with healthy primary does not failover", () => {
    const input = makeInput({
        primaryHealthy: true,
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, false, null, "multi_region.primary_within_threshold");
});
test("resolveRegionFailover - only latency provided with healthy primary at threshold", () => {
    const input = makeInput({
        primaryHealthy: true,
        primaryLatencyMs: 50,
        maxAcceptableLatencyMs: 100,
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, false, null, "multi_region.primary_within_threshold");
});
test("resolveRegionFailover - only error rate provided with healthy primary at threshold", () => {
    const input = makeInput({
        primaryHealthy: true,
        primaryErrorRate: 0.01,
        maxAcceptableErrorRate: 0.05,
    });
    const result = resolveRegionFailover(input);
    assertDecision(result, false, null, "multi_region.primary_within_threshold");
});
//# sourceMappingURL=index.test.js.map