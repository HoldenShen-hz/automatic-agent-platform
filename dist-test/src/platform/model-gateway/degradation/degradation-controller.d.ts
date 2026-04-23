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
import type { ModelGatewayCacheService } from "../cache/index.js";
import type { ModelGatewayFallbackService } from "../fallback/index.js";
import type { UnifiedChatProvider } from "../provider-registry/unified-chat-provider.js";
/**
 * Degradation levels in order of severity.
 * D0 = fully healthy, D4 = completely degraded.
 */
export declare enum DegradationLevel {
    /** D0: Normal operation with primary model */
    D0 = 0,
    /** D1: Fallback to alternative model */
    D1 = 1,
    /** D2: Serve cached responses when available */
    D2 = 2,
    /** D3: Return template-based responses */
    D3 = 3,
    /** D4: Reject service (service unavailable) */
    D4 = 4
}
/**
 * Health metrics for a single provider.
 */
export interface ProviderMetrics {
    provider: string;
    profileName: string;
    totalRequests: number;
    failedRequests: number;
    errorRate: number;
    latencyP99Ms: number;
    /** Time To First Token P99 in milliseconds (TTFT >10s triggers escalation per §15) */
    ttftP99Ms: number;
    lastUpdated: string;
}
/**
 * Degradation configuration thresholds.
 */
export interface DegradationConfig {
    /** Error rate threshold to trigger escalation (%) */
    escalateErrorRateThreshold: number;
    /** Error rate threshold to trigger de-escalation (%) */
    deescalateErrorRateThreshold: number;
    /** Latency P99 threshold to trigger escalation (ms) */
    escalateLatencyP99Ms: number;
    /** Minimum consecutive healthy evaluations before de-escalation */
    deescalateMinHealthyCount: number;
    /** Maximum degradation level for automatic de-escalation */
    maxAutoDeescalateLevel: DegradationLevel;
}
/**
 * LLM request for routing through degradation levels.
 */
export interface LLMDegradationRequest {
    model: string;
    routeClass: string;
    messages: readonly {
        role: string;
        content: string;
    }[];
    tenantId?: string | null;
    taskType?: string;
    semanticKey?: string;
}
/**
 * LLM response from any degradation level.
 */
export interface LLMDegradationResponse {
    content: string;
    model: string;
    degradationLevel: DegradationLevel;
    cached: boolean;
    fromCache: boolean;
}
/**
 * Default degradation configuration.
 */
export declare const DEFAULT_DEGRADATION_CONFIG: DegradationConfig;
/**
 * Default template responses for D3 by task type.
 */
export declare const DEFAULT_TEMPLATE_RESPONSES: Record<string, string>;
/**
 * DegradationController
 *
 * Routes LLM requests through D0-D4 degradation levels based on provider health.
 * Automatically escalates on degradation and de-escalates when health recovers.
 */
export declare class DegradationController {
    private currentLevel;
    private consecutiveHealthyCount;
    private lastEscalationReason;
    private readonly config;
    private readonly primaryProvider;
    private readonly fallbackProvider;
    private readonly fallbackService;
    private readonly cacheService;
    private readonly templates;
    constructor(options: {
        primaryProvider: UnifiedChatProvider;
        fallbackProvider?: UnifiedChatProvider | null;
        fallbackService: ModelGatewayFallbackService;
        cacheService: ModelGatewayCacheService<string>;
        templates?: Record<string, string>;
        config?: Partial<DegradationConfig>;
    });
    /**
     * Gets the current degradation level.
     */
    getCurrentLevel(): DegradationLevel;
    /**
     * Gets the last escalation reason.
     */
    getLastEscalationReason(): string | null;
    /**
     * Routes an LLM request through the appropriate degradation level.
     *
     * D0: Primary provider
     * D1: Fallback provider (if available)
     * D2: Cache lookup (if semantic key provided)
     * D3: Template response
     * D4: Service unavailable error
     */
    route(request: LLMDegradationRequest): Promise<LLMDegradationResponse>;
    /**
     * D0: Normal operation with primary model.
     */
    private routeD0;
    /**
     * D1: Fallback to alternative model.
     */
    private routeD1;
    /**
     * D2: Serve cached responses when available.
     */
    private routeD2;
    /**
     * D3: Return template-based responses.
     */
    private routeD3;
    /**
     * D4: Reject service (service unavailable).
     */
    private routeD4;
    /**
     * Selects a fallback profile for D1 using the fallback service.
     */
    private selectFallbackProfile;
    /**
     * Gets available fallback candidates from all providers.
     * This would typically be enhanced to read from a provider registry.
     */
    private getFallbackCandidates;
    /**
     * Escalates to the next degradation level.
     */
    escalate(): void;
    /**
     * De-escalates to the previous degradation level if health criteria are met.
     */
    deescalate(): void;
    /**
     * Evaluates provider health and automatically adjusts degradation level.
     *
     * Escalation occurs when error rate > threshold OR latency P99 > threshold.
     * De-escalation occurs when error rate < threshold for minHealthyCount consecutive evaluations.
     */
    evaluateHealth(metrics: ProviderMetrics): {
        action: "escalate" | "deescalate" | "maintain";
        newLevel: DegradationLevel;
        reason: string;
    };
    /**
     * Resets the controller to D0 (normal operation).
     */
    reset(): void;
    /**
     * Forces a specific degradation level (for manual override).
     */
    setLevel(level: DegradationLevel): void;
}
