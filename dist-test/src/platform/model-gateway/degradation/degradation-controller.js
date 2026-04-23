/**
 * LLM Provider Degradation Controller
 *
 * Implements D0-D4 five-level degradation strategy for LLM service resilience:
 * - D0: Normal operation with primary model
 * - D1: Fallback to alternative model
 * - D2: Serve cached responses when available
 * - D3: Return template-based responses
 * - D4: Reject service (return service unavailable)
 *
 * Health evaluation automatically escalates/de-escalates between levels based on:
 * - Error rate threshold (escalate if > 50%, de-escalate if < 5%)
 * - Latency P99 threshold
 * - Availability of fallback candidates
 */
import { AppError, ProviderError } from "../../contracts/errors.js";
/**
 * Degradation levels in order of severity.
 * D0 = fully healthy, D4 = completely degraded.
 */
export var DegradationLevel;
(function (DegradationLevel) {
    /** D0: Normal operation with primary model */
    DegradationLevel[DegradationLevel["D0"] = 0] = "D0";
    /** D1: Fallback to alternative model */
    DegradationLevel[DegradationLevel["D1"] = 1] = "D1";
    /** D2: Serve cached responses when available */
    DegradationLevel[DegradationLevel["D2"] = 2] = "D2";
    /** D3: Return template-based responses */
    DegradationLevel[DegradationLevel["D3"] = 3] = "D3";
    /** D4: Reject service (service unavailable) */
    DegradationLevel[DegradationLevel["D4"] = 4] = "D4";
})(DegradationLevel || (DegradationLevel = {}));
/**
 * Default degradation configuration.
 */
export const DEFAULT_DEGRADATION_CONFIG = {
    escalateErrorRateThreshold: 50,
    deescalateErrorRateThreshold: 5,
    escalateLatencyP99Ms: 5000,
    deescalateMinHealthyCount: 3,
    maxAutoDeescalateLevel: DegradationLevel.D0,
};
/**
 * Default template responses for D3 by task type.
 */
export const DEFAULT_TEMPLATE_RESPONSES = {
    default: "I apologize, but I'm currently experiencing high demand. Please try again in a few moments.",
    coding: "I apologize, but I'm currently experiencing high demand for coding assistance. Please try again shortly.",
    reasoning: "I apologize, but I'm currently experiencing high demand for reasoning tasks. Please try again shortly.",
    classification: "I apologize, but I'm currently unable to process classification requests. Please try again.",
    writing: "I apologize, but I'm currently experiencing high demand for writing assistance. Please try again shortly.",
};
/**
 * Maps a task type to a template response key.
 */
function getTemplateKey(taskType) {
    if (taskType == null || taskType.length === 0) {
        return "default";
    }
    const normalized = taskType.toLowerCase().trim();
    if (normalized in DEFAULT_TEMPLATE_RESPONSES) {
        return normalized;
    }
    return "default";
}
/**
 * DegradationController
 *
 * Routes LLM requests through D0-D4 degradation levels based on provider health.
 * Automatically escalates on degradation and de-escalates when health recovers.
 */
export class DegradationController {
    currentLevel = DegradationLevel.D0;
    consecutiveHealthyCount = 0;
    lastEscalationReason = null;
    config;
    primaryProvider;
    fallbackProvider;
    fallbackService;
    cacheService;
    templates;
    constructor(options) {
        this.primaryProvider = options.primaryProvider;
        this.fallbackProvider = options.fallbackProvider ?? null;
        this.fallbackService = options.fallbackService;
        this.cacheService = options.cacheService;
        this.templates = { ...DEFAULT_TEMPLATE_RESPONSES, ...(options.templates ?? {}) };
        this.config = { ...DEFAULT_DEGRADATION_CONFIG, ...options.config };
    }
    /**
     * Gets the current degradation level.
     */
    getCurrentLevel() {
        return this.currentLevel;
    }
    /**
     * Gets the last escalation reason.
     */
    getLastEscalationReason() {
        return this.lastEscalationReason;
    }
    /**
     * Routes an LLM request through the appropriate degradation level.
     *
     * D0: Primary provider
     * D1: Fallback provider (if available)
     * D2: Cache lookup (if semantic key provided)
     * D3: Template response
     * D4: Service unavailable error
     */
    async route(request) {
        switch (this.currentLevel) {
            case DegradationLevel.D0:
                return this.routeD0(request);
            case DegradationLevel.D1:
                return this.routeD1(request);
            case DegradationLevel.D2:
                return this.routeD2(request);
            case DegradationLevel.D3:
                return this.routeD3(request);
            case DegradationLevel.D4:
                return this.routeD4(request);
        }
    }
    /**
     * D0: Normal operation with primary model.
     */
    async routeD0(request) {
        try {
            const response = await this.primaryProvider.createChatCompletion({
                model: request.model,
                messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
                maxTokens: 4096,
            });
            // Cache successful response for D2 fallback
            if (request.semanticKey) {
                this.cacheService.put({
                    cacheKey: request.semanticKey,
                    tenantId: request.tenantId ?? null,
                    model: request.model,
                    routeClass: request.routeClass,
                    value: response.content,
                    ttlMs: 5 * 60 * 1000, // 5 minutes
                });
            }
            return {
                content: response.content,
                model: response.model,
                degradationLevel: DegradationLevel.D0,
                cached: false,
                fromCache: false,
            };
        }
        catch (error) {
            this.lastEscalationReason = error instanceof Error ? error.message : "unknown";
            this.escalate();
            // Retry with new level
            return this.route(request);
        }
    }
    /**
     * D1: Fallback to alternative model.
     */
    async routeD1(request) {
        const fallbackProfile = this.selectFallbackProfile(request.model);
        if (fallbackProfile == null) {
            // No fallback available, escalate to D2
            this.escalate();
            return this.route(request);
        }
        try {
            const provider = this.fallbackProvider ?? this.primaryProvider;
            const response = await provider.createChatCompletion({
                model: fallbackProfile.profileName,
                messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
                maxTokens: 4096,
            });
            return {
                content: response.content,
                model: response.model,
                degradationLevel: DegradationLevel.D1,
                cached: false,
                fromCache: false,
            };
        }
        catch (error) {
            this.lastEscalationReason = error instanceof Error ? error.message : "unknown";
            this.escalate();
            // Retry with new level
            return this.route(request);
        }
    }
    /**
     * D2: Serve cached responses when available.
     */
    async routeD2(request) {
        if (!request.semanticKey) {
            // No cache key, fall through to D3
            return this.routeD3(request);
        }
        const cached = this.cacheService.get(request.semanticKey);
        if (cached != null) {
            return {
                content: cached.value,
                model: cached.model,
                degradationLevel: DegradationLevel.D2,
                cached: true,
                fromCache: true,
            };
        }
        // No cache hit, fall through to D3
        return this.routeD3(request);
    }
    /**
     * D3: Return template-based responses.
     */
    async routeD3(request) {
        const templateKey = getTemplateKey(request.taskType);
        const content = this.templates[templateKey] ?? DEFAULT_TEMPLATE_RESPONSES["default"];
        return {
            content,
            model: "template",
            degradationLevel: DegradationLevel.D3,
            cached: false,
            fromCache: false,
        };
    }
    /**
     * D4: Reject service (service unavailable).
     */
    async routeD4(_request) {
        throw new ProviderError("degradation.service_unavailable", "LLM service is currently unavailable due to sustained high error rates. Please retry later.", { retryable: true, details: { degradationLevel: DegradationLevel.D4 } });
    }
    /**
     * Selects a fallback profile for D1 using the fallback service.
     */
    selectFallbackProfile(primaryProfileName) {
        // Consult the fallback service for available candidates
        const candidates = this.getFallbackCandidates();
        if (candidates.length === 0) {
            return null;
        }
        const decision = this.fallbackService.selectFallback({
            primaryProfileName,
            candidates,
        });
        if (decision.selectedProfileName == null) {
            return null;
        }
        return candidates.find((c) => c.profileName === decision.selectedProfileName) ?? null;
    }
    /**
     * Gets available fallback candidates from all providers.
     * This would typically be enhanced to read from a provider registry.
     */
    getFallbackCandidates() {
        return [];
    }
    /**
     * Escalates to the next degradation level.
     */
    escalate() {
        if (this.currentLevel < DegradationLevel.D4) {
            this.currentLevel++;
            this.consecutiveHealthyCount = 0;
        }
    }
    /**
     * De-escalates to the previous degradation level if health criteria are met.
     */
    deescalate() {
        if (this.currentLevel > DegradationLevel.D0) {
            this.currentLevel--;
            this.consecutiveHealthyCount = 0;
        }
    }
    /**
     * Evaluates provider health and automatically adjusts degradation level.
     *
     * Escalation occurs when error rate > threshold OR latency P99 > threshold.
     * De-escalation occurs when error rate < threshold for minHealthyCount consecutive evaluations.
     */
    evaluateHealth(metrics) {
        const { errorRate, latencyP99Ms, ttftP99Ms } = metrics;
        // Check for escalation conditions
        // §15: TTFT >10s triggers escalation
        if (ttftP99Ms > 10000) {
            if (this.currentLevel < DegradationLevel.D4) {
                this.escalate();
                return {
                    action: "escalate",
                    newLevel: this.currentLevel,
                    reason: `ttft_p99:${ttftP99Ms}ms`,
                };
            }
        }
        const shouldEscalate = errorRate > this.config.escalateErrorRateThreshold ||
            latencyP99Ms > this.config.escalateLatencyP99Ms;
        if (shouldEscalate && this.currentLevel < DegradationLevel.D4) {
            this.escalate();
            return {
                action: "escalate",
                newLevel: this.currentLevel,
                reason: errorRate > this.config.escalateErrorRateThreshold
                    ? `error_rate:${errorRate.toFixed(1)}%`
                    : `latency_p99:${latencyP99Ms}ms`,
            };
        }
        // Check for de-escalation conditions
        const shouldDeescalate = errorRate < this.config.deescalateErrorRateThreshold &&
            this.currentLevel > this.config.maxAutoDeescalateLevel;
        if (shouldDeescalate) {
            this.consecutiveHealthyCount++;
            if (this.consecutiveHealthyCount >= this.config.deescalateMinHealthyCount) {
                this.deescalate();
                return {
                    action: "deescalate",
                    newLevel: this.currentLevel,
                    reason: `recovered_after_${this.consecutiveHealthyCount}_checks`,
                };
            }
            return {
                action: "maintain",
                newLevel: this.currentLevel,
                reason: `waiting_recovery:${this.consecutiveHealthyCount}/${this.config.deescalateMinHealthyCount}`,
            };
        }
        // Reset healthy counter if not fully healthy
        if (errorRate >= this.config.deescalateErrorRateThreshold) {
            this.consecutiveHealthyCount = 0;
        }
        return {
            action: "maintain",
            newLevel: this.currentLevel,
            reason: "healthy",
        };
    }
    /**
     * Resets the controller to D0 (normal operation).
     */
    reset() {
        this.currentLevel = DegradationLevel.D0;
        this.consecutiveHealthyCount = 0;
        this.lastEscalationReason = null;
    }
    /**
     * Forces a specific degradation level (for manual override).
     */
    setLevel(level) {
        if (level < DegradationLevel.D0 || level > DegradationLevel.D4) {
            throw new AppError("degradation.invalid_level", `Invalid degradation level: ${level}. Must be between D0 (0) and D4 (4).`, { category: "validation", source: "provider" });
        }
        this.currentLevel = level;
        this.consecutiveHealthyCount = 0;
    }
}
//# sourceMappingURL=degradation-controller.js.map