/**
 * Unit tests for TTFT >10s trigger in DegradationController
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach, mock } from "node:test";
import { DegradationController, DegradationLevel, } from "../../../../src/platform/model-gateway/degradation/degradation-controller.js";
/**
 * Mock UnifiedChatProvider for testing
 */
class MockUnifiedChatProvider {
    createChatCompletion = mock.fn(async () => {
        return {
            id: "mock-completion-id",
            content: "Response content",
            refusal: null,
            reasoningContent: null,
            finishReason: "stop",
            stopSequence: null,
            toolCalls: [],
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            model: "gpt-4o",
            provider: "mock",
        };
    });
}
/**
 * Mock ModelGatewayFallbackService
 */
class MockFallbackService {
    selectFallback = mock.fn(() => {
        return {
            selectedProfileName: null,
            reasonCode: "fallback.no_candidate_available",
            degradedFromProfileName: "gpt-4o",
            attemptedProfiles: [],
        };
    });
}
/**
 * Mock ModelGatewayCacheService
 */
class MockCacheService {
    put() { }
    get() {
        return null;
    }
}
describe("TTFT >10s trigger in DegradationController", () => {
    let controller;
    let mockProvider;
    let mockFallbackService;
    let mockCacheService;
    beforeEach(() => {
        mockProvider = new MockUnifiedChatProvider();
        mockFallbackService = new MockFallbackService();
        mockCacheService = new MockCacheService();
        controller = new DegradationController({
            primaryProvider: mockProvider,
            fallbackService: mockFallbackService,
            cacheService: mockCacheService,
        });
    });
    afterEach(() => {
        mockProvider.createChatCompletion.mock.resetCalls();
        mockFallbackService.selectFallback.mock.resetCalls();
    });
    describe("shouldEscalate with TTFT >10s", () => {
        it("should escalate when TTFT P99 > 10000ms", () => {
            const metrics = {
                provider: "openai",
                profileName: "gpt-4o",
                totalRequests: 100,
                failedRequests: 5,
                errorRate: 5,
                latencyP99Ms: 500,
                ttftP99Ms: 11000, // > 10 seconds
                lastUpdated: new Date().toISOString(),
            };
            const result = controller.evaluateHealth(metrics);
            assert.strictEqual(result.action, "escalate");
            assert.ok(result.reason.includes("ttft_p99"));
            assert.ok(result.reason.includes("11000ms"));
        });
        it("should escalate when TTFT P99 is exactly 10001ms", () => {
            const metrics = {
                provider: "openai",
                profileName: "gpt-4o",
                totalRequests: 100,
                failedRequests: 1,
                errorRate: 1,
                latencyP99Ms: 100,
                ttftP99Ms: 10001, // Just over 10 seconds
                lastUpdated: new Date().toISOString(),
            };
            const result = controller.evaluateHealth(metrics);
            assert.strictEqual(result.action, "escalate");
            assert.ok(result.reason.includes("ttft_p99"));
        });
        it("should NOT escalate when TTFT P99 is exactly 10000ms (boundary)", () => {
            const metrics = {
                provider: "openai",
                profileName: "gpt-4o",
                totalRequests: 100,
                failedRequests: 1,
                errorRate: 1,
                latencyP99Ms: 100,
                ttftP99Ms: 10000, // Exactly 10 seconds - should NOT escalate
                lastUpdated: new Date().toISOString(),
            };
            const result = controller.evaluateHealth(metrics);
            assert.strictEqual(result.action, "maintain");
            assert.strictEqual(result.reason, "healthy");
        });
        it("should NOT escalate when TTFT P99 is below 10000ms", () => {
            const metrics = {
                provider: "openai",
                profileName: "gpt-4o",
                totalRequests: 100,
                failedRequests: 1,
                errorRate: 1,
                latencyP99Ms: 100,
                ttftP99Ms: 5000, // 5 seconds - well below threshold
                lastUpdated: new Date().toISOString(),
            };
            const result = controller.evaluateHealth(metrics);
            assert.strictEqual(result.action, "maintain");
            assert.strictEqual(result.reason, "healthy");
        });
        it("should escalate to D4 (max) when TTFT > 10s and already at D3", () => {
            controller.setLevel(DegradationLevel.D3);
            const metrics = {
                provider: "openai",
                profileName: "gpt-4o",
                totalRequests: 100,
                failedRequests: 1,
                errorRate: 1,
                latencyP99Ms: 100,
                ttftP99Ms: 15000, // 15 seconds
                lastUpdated: new Date().toISOString(),
            };
            const result = controller.evaluateHealth(metrics);
            // Should escalate from D3 to D4
            assert.strictEqual(result.action, "escalate");
            assert.strictEqual(result.newLevel, DegradationLevel.D4);
        });
        it("should not escalate beyond D4 even with very high TTFT", () => {
            controller.setLevel(DegradationLevel.D4);
            const metrics = {
                provider: "openai",
                profileName: "gpt-4o",
                totalRequests: 100,
                failedRequests: 1,
                errorRate: 1,
                latencyP99Ms: 100,
                ttftP99Ms: 60000, // 60 seconds - very high
                lastUpdated: new Date().toISOString(),
            };
            const result = controller.evaluateHealth(metrics);
            assert.strictEqual(result.action, "maintain");
            assert.strictEqual(result.newLevel, DegradationLevel.D4);
        });
        it("TTFT escalation reason should include the actual TTFT value", () => {
            const metrics = {
                provider: "openai",
                profileName: "gpt-4o",
                totalRequests: 100,
                failedRequests: 1,
                errorRate: 1,
                latencyP99Ms: 100,
                ttftP99Ms: 12345,
                lastUpdated: new Date().toISOString(),
            };
            const result = controller.evaluateHealth(metrics);
            assert.ok(result.reason.includes("ttft_p99"));
            assert.ok(result.reason.includes("12345ms"));
        });
    });
    describe("TTFT check in evaluateHealth", () => {
        it("TTFT >10s should take precedence over other metrics for escalation", () => {
            // Even with low error rate and low latency, TTFT >10s should trigger escalation
            const metrics = {
                provider: "openai",
                profileName: "gpt-4o",
                totalRequests: 1000,
                failedRequests: 1,
                errorRate: 0.1, // Very low
                latencyP99Ms: 100, // Very low
                ttftP99Ms: 25000, // 25 seconds - extremely high
                lastUpdated: new Date().toISOString(),
            };
            const result = controller.evaluateHealth(metrics);
            assert.strictEqual(result.action, "escalate");
            assert.ok(result.reason.includes("ttft_p99"));
        });
        it("TTFT >10s should escalate even when already degraded", () => {
            controller.setLevel(DegradationLevel.D2);
            const metrics = {
                provider: "openai",
                profileName: "gpt-4o",
                totalRequests: 100,
                failedRequests: 1,
                errorRate: 0.5,
                latencyP99Ms: 200,
                ttftP99Ms: 11000,
                lastUpdated: new Date().toISOString(),
            };
            const result = controller.evaluateHealth(metrics);
            assert.strictEqual(result.action, "escalate");
            assert.ok(result.newLevel > DegradationLevel.D2);
        });
    });
});
//# sourceMappingURL=ttft-trigger.test.js.map