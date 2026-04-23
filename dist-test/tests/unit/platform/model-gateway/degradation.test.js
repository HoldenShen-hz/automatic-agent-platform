import assert from "node:assert/strict";
import test from "node:test";
import { mock } from "node:test";
import { DegradationController, DegradationLevel, DEFAULT_DEGRADATION_CONFIG, DEFAULT_TEMPLATE_RESPONSES, } from "../../../../src/platform/model-gateway/degradation/index.js";
/**
 * Mock UnifiedChatProvider
 */
class MockUnifiedChatProvider {
    createChatCompletion = mock.fn(async (request) => {
        return {
            id: "mock-completion-id",
            content: `Response from ${request.model}`,
            refusal: null,
            reasoningContent: null,
            finishReason: "stop",
            stopSequence: null,
            toolCalls: [],
            usage: {
                promptTokens: 10,
                completionTokens: 20,
                totalTokens: 30,
            },
            model: request.model,
            provider: "mock",
        };
    });
}
/**
 * Mock ModelGatewayFallbackService
 */
class MockFallbackService {
    selectFallback = mock.fn((input) => {
        return {
            selectedProfileName: null,
            reasonCode: "fallback.no_candidate_available",
            degradedFromProfileName: input.primaryProfileName,
            attemptedProfiles: input.candidates.map((c) => c.profileName),
        };
    });
}
/**
 * Mock ModelGatewayCacheService
 */
class MockCacheService {
    entries = new Map();
    put(input) {
        this.entries.set(input.cacheKey, { value: input.value, model: input.model, tenantId: input.tenantId, routeClass: input.routeClass });
    }
    get(cacheKey) {
        const entry = this.entries.get(cacheKey);
        return entry ? { value: entry.value, model: entry.model } : null;
    }
}
function createController(options) {
    const mockProvider = new MockUnifiedChatProvider();
    const mockFallbackService = new MockFallbackService();
    const mockCacheService = new MockCacheService();
    const ctorOptions = {
        primaryProvider: options?.primaryProvider ?? mockProvider,
        fallbackProvider: options?.fallbackProvider ?? null,
        fallbackService: options?.fallbackService ?? mockFallbackService,
        cacheService: options?.cacheService ?? mockCacheService,
    };
    if (options?.templates !== undefined) {
        ctorOptions.templates = options.templates;
    }
    if (options?.config !== undefined) {
        ctorOptions.config = options.config;
    }
    return new DegradationController(ctorOptions);
}
test("DegradationController constructor initializes with default config", () => {
    const controller = createController();
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
    assert.equal(controller.getLastEscalationReason(), null);
});
test("DegradationController uses custom config when provided", () => {
    const controller = createController({
        config: {
            escalateErrorRateThreshold: 60,
            deescalateErrorRateThreshold: 10,
            escalateLatencyP99Ms: 3000,
            deescalateMinHealthyCount: 5,
            maxAutoDeescalateLevel: DegradationLevel.D1,
        },
    });
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});
test("DegradationController uses custom templates when provided", async () => {
    const controller = createController({
        templates: {
            default: "Custom default response",
            coding: "Custom coding response",
        },
    });
    controller.setLevel(DegradationLevel.D3);
    const request = {
        model: "test-model",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        taskType: "default",
    };
    const response = await controller.route(request);
    assert.equal(response.content, "Custom default response");
});
test("DegradationController getCurrentLevel returns current level", () => {
    const controller = createController();
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
    controller.setLevel(DegradationLevel.D3);
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D3);
});
test("DegradationController getLastEscalationReason returns null initially", () => {
    const controller = createController();
    assert.equal(controller.getLastEscalationReason(), null);
});
test("DegradationController escalates and records reason on D0 failure", async () => {
    const mockProvider = new MockUnifiedChatProvider();
    mockProvider.createChatCompletion = mock.fn(async () => {
        throw new Error("Connection failed");
    });
    const controller = createController({
        primaryProvider: mockProvider,
    });
    const request = {
        model: "test-model",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
    };
    await controller.route(request);
    assert.equal(controller.getLastEscalationReason(), "Connection failed");
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D2);
});
test("DegradationController route at D0 calls primary provider", async () => {
    const controller = createController();
    const request = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
    };
    const response = await controller.route(request);
    assert.equal(response.degradationLevel, DegradationLevel.D0);
    assert.equal(response.content, "Response from gpt-4o");
    assert.equal(response.fromCache, false);
    assert.equal(response.cached, false);
});
test("DegradationController caches response at D0 when semanticKey provided", async () => {
    const mockCacheService = new MockCacheService();
    const controller = createController({
        cacheService: mockCacheService,
    });
    const request = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        semanticKey: "cache-key-123",
        tenantId: "tenant-1",
    };
    await controller.route(request);
    const cached = mockCacheService.get("cache-key-123");
    assert.notEqual(cached, null);
    assert.equal(cached.value, "Response from gpt-4o");
    assert.equal(cached.model, "gpt-4o");
});
test("DegradationController does not cache at D0 when no semanticKey", async () => {
    const mockCacheService = new MockCacheService();
    const controller = createController({
        cacheService: mockCacheService,
    });
    const request = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
    };
    await controller.route(request);
    assert.equal(mockCacheService.get("any-key"), null);
});
test("DegradationController route at D1 escalates when no fallback available", async () => {
    const controller = createController();
    controller.setLevel(DegradationLevel.D1);
    const request = {
        model: "primary-model",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
    };
    await controller.route(request);
    // No fallback candidates -> escalate to D2
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D2);
});
test("DegradationController route at D2 returns cached response", async () => {
    const mockCacheService = new MockCacheService();
    mockCacheService.put({
        cacheKey: "cached-key",
        model: "gpt-4o",
        routeClass: "default",
        value: "Cached content",
    });
    const controller = createController({
        cacheService: mockCacheService,
    });
    controller.setLevel(DegradationLevel.D2);
    const request = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        semanticKey: "cached-key",
    };
    const response = await controller.route(request);
    assert.equal(response.degradationLevel, DegradationLevel.D2);
    assert.equal(response.cached, true);
    assert.equal(response.fromCache, true);
    assert.equal(response.content, "Cached content");
});
test("DegradationController route at D2 falls through to D3 on cache miss", async () => {
    const controller = createController();
    controller.setLevel(DegradationLevel.D2);
    const request = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        semanticKey: "non-existent-key",
    };
    const response = await controller.route(request);
    assert.equal(response.degradationLevel, DegradationLevel.D3);
});
test("DegradationController route at D2 falls through to D3 when no semanticKey", async () => {
    const controller = createController();
    controller.setLevel(DegradationLevel.D2);
    const request = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
    };
    const response = await controller.route(request);
    assert.equal(response.degradationLevel, DegradationLevel.D3);
});
test("DegradationController route at D3 returns default template", async () => {
    const controller = createController();
    controller.setLevel(DegradationLevel.D3);
    const request = {
        model: "test-model",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        taskType: "unknown-task",
    };
    const response = await controller.route(request);
    assert.equal(response.degradationLevel, DegradationLevel.D3);
    assert.equal(response.model, "template");
    assert.equal(response.content, DEFAULT_TEMPLATE_RESPONSES["default"]);
    assert.equal(response.cached, false);
    assert.equal(response.fromCache, false);
});
test("DegradationController route at D3 returns task-specific template", () => {
    const taskTypes = ["coding", "reasoning", "classification", "writing"];
    for (const taskType of taskTypes) {
        const controller = createController();
        controller.setLevel(DegradationLevel.D3);
        const request = {
            model: "test-model",
            routeClass: "default",
            messages: [{ role: "user", content: "Hello" }],
            taskType,
        };
        controller.route(request).then((response) => {
            assert.equal(response.degradationLevel, DegradationLevel.D3);
            assert.equal(response.content, DEFAULT_TEMPLATE_RESPONSES[taskType]);
        });
    }
});
test("DegradationController route at D3 returns default for empty taskType", async () => {
    const controller = createController();
    controller.setLevel(DegradationLevel.D3);
    const request = {
        model: "test-model",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        taskType: "",
    };
    const response = await controller.route(request);
    assert.equal(response.degradationLevel, DegradationLevel.D3);
    assert.equal(response.content, DEFAULT_TEMPLATE_RESPONSES["default"]);
});
test("DegradationController route at D3 returns default for undefined taskType", async () => {
    const controller = createController();
    controller.setLevel(DegradationLevel.D3);
    const request = {
        model: "test-model",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
    };
    const response = await controller.route(request);
    assert.equal(response.degradationLevel, DegradationLevel.D3);
    assert.equal(response.content, DEFAULT_TEMPLATE_RESPONSES["default"]);
});
test("DegradationController route at D4 throws ProviderError", async () => {
    const controller = createController();
    controller.setLevel(DegradationLevel.D4);
    const request = {
        model: "test-model",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
    };
    await assert.rejects(async () => controller.route(request), (error) => {
        if (error instanceof Error && "code" in error) {
            return error.code === "degradation.service_unavailable";
        }
        return false;
    });
});
test("DegradationController D4 error is retryable", async () => {
    const controller = createController();
    controller.setLevel(DegradationLevel.D4);
    const request = {
        model: "test-model",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
    };
    await assert.rejects(async () => controller.route(request), (error) => {
        if (error instanceof Error && "retryable" in error) {
            return error.retryable === true;
        }
        return false;
    });
});
test("DegradationController escalate increases level", () => {
    const controller = createController();
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
    controller.escalate();
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D1);
    controller.escalate();
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D2);
    controller.escalate();
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D3);
    controller.escalate();
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D4);
});
test("DegradationController escalate does not exceed D4", () => {
    const controller = createController();
    controller.setLevel(DegradationLevel.D4);
    controller.escalate();
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D4);
    controller.escalate();
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D4);
});
test("DegradationController escalate resets consecutiveHealthyCount", () => {
    const controller = createController();
    controller.setLevel(DegradationLevel.D2);
    controller.escalate();
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D3);
});
test("DegradationController deescalate decreases level", () => {
    const controller = createController();
    controller.setLevel(DegradationLevel.D4);
    controller.deescalate();
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D3);
    controller.deescalate();
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D2);
    controller.deescalate();
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D1);
    controller.deescalate();
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});
test("DegradationController deescalate does not go below D0", () => {
    const controller = createController();
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
    controller.deescalate();
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});
test("DegradationController deescalate resets consecutiveHealthyCount", () => {
    const controller = createController();
    controller.setLevel(DegradationLevel.D2);
    controller.deescalate();
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D1);
});
test("DegradationController evaluateHealth escalates on high error rate", () => {
    const controller = createController();
    const metrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 60,
        errorRate: 60,
        latencyP99Ms: 1000,
        ttftP99Ms: 1000,
        lastUpdated: new Date().toISOString(),
    };
    const result = controller.evaluateHealth(metrics);
    assert.equal(result.action, "escalate");
    assert.ok(result.newLevel > DegradationLevel.D0);
    assert.ok(result.reason.includes("error_rate"));
});
test("DegradationController evaluateHealth escalates on high latency", () => {
    const controller = createController();
    const metrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 5,
        errorRate: 5,
        latencyP99Ms: 6000,
        ttftP99Ms: 1000,
        lastUpdated: new Date().toISOString(),
    };
    const result = controller.evaluateHealth(metrics);
    assert.equal(result.action, "escalate");
    assert.ok(result.reason.includes("latency_p99"));
});
test("DegradationController evaluateHealth escalates on high TTFT", () => {
    const controller = createController();
    const metrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 5,
        errorRate: 5,
        latencyP99Ms: 1000,
        ttftP99Ms: 11000,
        lastUpdated: new Date().toISOString(),
    };
    const result = controller.evaluateHealth(metrics);
    assert.equal(result.action, "escalate");
    assert.ok(result.reason.includes("ttft_p99"));
});
test("DegradationController evaluateHealth does not escalate above D4", () => {
    const controller = createController();
    controller.setLevel(DegradationLevel.D4);
    const metrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 90,
        errorRate: 90,
        latencyP99Ms: 10000,
        ttftP99Ms: 15000,
        lastUpdated: new Date().toISOString(),
    };
    const result = controller.evaluateHealth(metrics);
    assert.equal(result.action, "maintain");
    assert.equal(result.newLevel, DegradationLevel.D4);
});
test("DegradationController evaluateHealth maintains level when healthy", () => {
    const controller = createController();
    const metrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 2,
        errorRate: 2,
        latencyP99Ms: 500,
        ttftP99Ms: 500,
        lastUpdated: new Date().toISOString(),
    };
    const result = controller.evaluateHealth(metrics);
    assert.equal(result.action, "maintain");
    assert.equal(result.newLevel, DegradationLevel.D0);
    assert.equal(result.reason, "healthy");
});
test("DegradationController evaluateHealth deescalates after consecutive healthy checks", () => {
    const controller = createController();
    controller.setLevel(DegradationLevel.D2);
    const healthyMetrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 1,
        errorRate: 1,
        latencyP99Ms: 500,
        ttftP99Ms: 500,
        lastUpdated: new Date().toISOString(),
    };
    // First check - waiting
    let result = controller.evaluateHealth(healthyMetrics);
    assert.equal(result.action, "maintain");
    assert.ok(result.reason.includes("waiting_recovery"));
    // Second check - still waiting
    result = controller.evaluateHealth(healthyMetrics);
    assert.equal(result.action, "maintain");
    assert.ok(result.reason.includes("waiting_recovery"));
    // Third check - deescalate
    result = controller.evaluateHealth(healthyMetrics);
    assert.equal(result.action, "deescalate");
    assert.equal(result.newLevel, DegradationLevel.D1);
});
test("DegradationController evaluateHealth resets counter on marginal error rate", () => {
    const controller = createController();
    controller.setLevel(DegradationLevel.D2);
    const healthyMetrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 1,
        errorRate: 1,
        latencyP99Ms: 500,
        ttftP99Ms: 500,
        lastUpdated: new Date().toISOString(),
    };
    // One healthy check
    controller.evaluateHealth(healthyMetrics);
    // Marginal error rate (not healthy enough to deescalate)
    const marginalMetrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 10,
        errorRate: 10,
        latencyP99Ms: 1000,
        ttftP99Ms: 1000,
        lastUpdated: new Date().toISOString(),
    };
    const result = controller.evaluateHealth(marginalMetrics);
    assert.equal(result.action, "maintain");
    assert.equal(result.reason, "healthy");
});
test("DegradationController evaluateHealth respects maxAutoDeescalateLevel", () => {
    const controller = createController({
        config: {
            ...DEFAULT_DEGRADATION_CONFIG,
            maxAutoDeescalateLevel: DegradationLevel.D1,
        },
    });
    controller.setLevel(DegradationLevel.D3);
    const healthyMetrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 1,
        errorRate: 1,
        latencyP99Ms: 500,
        ttftP99Ms: 500,
        lastUpdated: new Date().toISOString(),
    };
    // Three healthy checks
    controller.evaluateHealth(healthyMetrics);
    controller.evaluateHealth(healthyMetrics);
    const result = controller.evaluateHealth(healthyMetrics);
    // Should deescalate but only to D1 (maxAutoDeescalateLevel)
    assert.equal(result.action, "deescalate");
    assert.equal(result.newLevel, DegradationLevel.D2);
});
test("DegradationController reset returns to D0", () => {
    const controller = createController();
    controller.setLevel(DegradationLevel.D4);
    controller.reset();
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});
test("DegradationController reset clears escalation reason", () => {
    const controller = createController();
    controller.setLevel(DegradationLevel.D4);
    controller.reset();
    assert.equal(controller.getLastEscalationReason(), null);
});
test("DegradationController reset clears consecutive healthy count", () => {
    const controller = createController();
    controller.setLevel(DegradationLevel.D2);
    controller.reset();
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});
test("DegradationController setLevel accepts valid levels D0-D4", () => {
    const controller = createController();
    for (let level = DegradationLevel.D0; level <= DegradationLevel.D4; level++) {
        controller.setLevel(level);
        assert.equal(controller.getCurrentLevel(), level);
    }
});
test("DegradationController setLevel rejects level below D0", () => {
    const controller = createController();
    assert.throws(() => {
        controller.setLevel(-1);
    }, (error) => {
        if (error instanceof Error && "code" in error) {
            return error.code === "degradation.invalid_level";
        }
        return false;
    });
});
test("DegradationController setLevel rejects level above D4", () => {
    const controller = createController();
    assert.throws(() => {
        controller.setLevel(5);
    }, (error) => {
        if (error instanceof Error && "code" in error) {
            return error.code === "degradation.invalid_level";
        }
        return false;
    });
});
test("DegradationController setLevel resets consecutive healthy count", () => {
    const controller = createController();
    controller.setLevel(DegradationLevel.D2);
    controller.setLevel(DegradationLevel.D0);
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});
test("DegradationLevel enum has correct values", () => {
    assert.equal(DegradationLevel.D0, 0);
    assert.equal(DegradationLevel.D1, 1);
    assert.equal(DegradationLevel.D2, 2);
    assert.equal(DegradationLevel.D3, 3);
    assert.equal(DegradationLevel.D4, 4);
});
test("DEFAULT_DEGRADATION_CONFIG has correct values", () => {
    assert.equal(DEFAULT_DEGRADATION_CONFIG.escalateErrorRateThreshold, 50);
    assert.equal(DEFAULT_DEGRADATION_CONFIG.deescalateErrorRateThreshold, 5);
    assert.equal(DEFAULT_DEGRADATION_CONFIG.escalateLatencyP99Ms, 5000);
    assert.equal(DEFAULT_DEGRADATION_CONFIG.deescalateMinHealthyCount, 3);
    assert.equal(DEFAULT_DEGRADATION_CONFIG.maxAutoDeescalateLevel, DegradationLevel.D0);
});
test("DEFAULT_TEMPLATE_RESPONSES has all required keys", () => {
    assert.ok(DEFAULT_TEMPLATE_RESPONSES["default"]);
    assert.ok(DEFAULT_TEMPLATE_RESPONSES["coding"]);
    assert.ok(DEFAULT_TEMPLATE_RESPONSES["reasoning"]);
    assert.ok(DEFAULT_TEMPLATE_RESPONSES["classification"]);
    assert.ok(DEFAULT_TEMPLATE_RESPONSES["writing"]);
});
test("DEFAULT_TEMPLATE_RESPONSES returns non-empty strings", () => {
    for (const [key, value] of Object.entries(DEFAULT_TEMPLATE_RESPONSES)) {
        assert.equal(typeof value, "string", `${key} should be a string`);
        assert.ok(value.length > 0, `${key} should not be empty`);
    }
});
test("LLMDegradationResponse structure at D0", () => {
    const response = {
        content: "Hello",
        model: "gpt-4o",
        degradationLevel: DegradationLevel.D0,
        cached: false,
        fromCache: false,
    };
    assert.equal(response.content, "Hello");
    assert.equal(response.model, "gpt-4o");
    assert.equal(response.degradationLevel, DegradationLevel.D0);
    assert.equal(response.cached, false);
    assert.equal(response.fromCache, false);
});
test("LLMDegradationResponse structure at D2 with cached data", () => {
    const response = {
        content: "Cached response",
        model: "gpt-4o",
        degradationLevel: DegradationLevel.D2,
        cached: true,
        fromCache: true,
    };
    assert.equal(response.content, "Cached response");
    assert.equal(response.degradationLevel, DegradationLevel.D2);
    assert.equal(response.cached, true);
    assert.equal(response.fromCache, true);
});
test("DegradationController does not call provider at D2 with cache hit", async () => {
    const mockProvider = new MockUnifiedChatProvider();
    const mockCacheService = new MockCacheService();
    mockCacheService.put({
        cacheKey: "cached-key",
        model: "gpt-4o",
        routeClass: "default",
        value: "Cached content",
    });
    const controller = createController({
        primaryProvider: mockProvider,
        cacheService: mockCacheService,
    });
    controller.setLevel(DegradationLevel.D2);
    const request = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        semanticKey: "cached-key",
    };
    await controller.route(request);
    assert.equal(mockProvider.createChatCompletion.mock.callCount(), 0);
});
test("DegradationController does not call provider at D3", async () => {
    const mockProvider = new MockUnifiedChatProvider();
    const controller = createController({
        primaryProvider: mockProvider,
    });
    controller.setLevel(DegradationLevel.D3);
    const request = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
    };
    await controller.route(request);
    assert.equal(mockProvider.createChatCompletion.mock.callCount(), 0);
});
test("DegradationController does not call provider at D4", async () => {
    const mockProvider = new MockUnifiedChatProvider();
    const controller = createController({
        primaryProvider: mockProvider,
    });
    controller.setLevel(DegradationLevel.D4);
    const request = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
    };
    await assert.rejects(async () => controller.route(request));
    assert.equal(mockProvider.createChatCompletion.mock.callCount(), 0);
});
test("DegradationController full cascade through all levels on repeated failures", async () => {
    const mockProvider = new MockUnifiedChatProvider();
    mockProvider.createChatCompletion = mock.fn(async () => {
        throw new Error("Provider failure");
    });
    const mockCacheService = new MockCacheService();
    const controller = createController({
        primaryProvider: mockProvider,
        cacheService: mockCacheService,
    });
    const request = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        semanticKey: "cascade-test",
    };
    // D0 fails -> escalate -> D1 has no fallback -> escalate -> D2 no cache -> D3 template
    await controller.route(request);
    assert.equal(controller.getCurrentLevel(), DegradationLevel.D2);
});
//# sourceMappingURL=degradation.test.js.map