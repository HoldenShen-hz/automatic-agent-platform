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
import { createOperationalDirective, type OperationalDirective } from "../../contracts/control-directive/index.js";
import type { ModelGatewayCacheEntry, ModelGatewayCacheService } from "../cache/index.js";
import type { ModelFallbackCandidate, ModelGatewayFallbackService } from "../fallback/index.js";
import type { PromptTemplateRecord } from "../../prompt-engine/registry/index.js";
import type { UnifiedChatProvider } from "../provider-registry/unified-chat-provider.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Degradation levels in order of severity.
 * D0 = fully healthy, D4 = completely degraded.
 */
export enum DegradationLevel {
  /** D0: Normal operation with primary model */
  D0 = 0,
  /** D1: Fallback to alternative model */
  D1 = 1,
  /** D2: Serve cached responses when available */
  D2 = 2,
  /** D3: Return template-based responses */
  D3 = 3,
  /** D4: Reject service (service unavailable) */
  D4 = 4,
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
  messages: readonly { role: string; content: string }[];
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
export const DEFAULT_DEGRADATION_CONFIG: DegradationConfig = {
  escalateErrorRateThreshold: 50,
  deescalateErrorRateThreshold: 5,
  escalateLatencyP99Ms: 5000,
  deescalateMinHealthyCount: 3,
  maxAutoDeescalateLevel: DegradationLevel.D0,
};

/**
 * Default template responses for D3 by task type.
 */
export const DEFAULT_TEMPLATE_RESPONSES: Record<string, string> = {
  default: "I apologize, but I'm currently experiencing high demand. Please try again in a few moments.",
  coding: "I apologize, but I'm currently experiencing high demand for coding assistance. Please try again shortly.",
  reasoning: "I apologize, but I'm currently experiencing high demand for reasoning tasks. Please try again shortly.",
  classification: "I apologize, but I'm currently unable to process classification requests. Please try again.",
  writing: "I apologize, but I'm currently experiencing high demand for writing assistance. Please try again shortly.",
};

/**
 * Maps a task type to a template response key.
 */
function getTemplateKey(taskType?: string): string {
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
  private currentLevel: DegradationLevel = DegradationLevel.D0;
  private consecutiveHealthyCount: number = 0;
  private lastEscalationReason: string | null = null;

  private readonly config: DegradationConfig;
  private readonly primaryProvider: UnifiedChatProvider;
  private readonly fallbackProvider: UnifiedChatProvider | null;
  private readonly fallbackService: ModelGatewayFallbackService;
  private readonly cacheService: ModelGatewayCacheService<string>;
  private readonly templates: Record<string, string>;
  /** §9.5: Event bus emitter for OperationalDirective on degradation state changes */
  private readonly eventBusEmitter: ((eventType: string, payload: unknown) => void) | null;

  constructor(options: {
    primaryProvider: UnifiedChatProvider;
    fallbackProvider?: UnifiedChatProvider | null;
    fallbackService: ModelGatewayFallbackService;
    cacheService: ModelGatewayCacheService<string>;
    templates?: Record<string, string>;
    config?: Partial<DegradationConfig>;
    eventBusEmitter?: (eventType: string, payload: unknown) => void;
  }) {
    this.primaryProvider = options.primaryProvider;
    this.fallbackProvider = options.fallbackProvider ?? null;
    this.fallbackService = options.fallbackService;
    this.cacheService = options.cacheService;
    this.templates = { ...DEFAULT_TEMPLATE_RESPONSES, ...(options.templates ?? {}) };
    this.config = { ...DEFAULT_DEGRADATION_CONFIG, ...options.config };
    this.eventBusEmitter = options.eventBusEmitter ?? null;
  }

  /**
   * Gets the current degradation level.
   */
  public getCurrentLevel(): DegradationLevel {
    return this.currentLevel;
  }

  /**
   * Gets the last escalation reason.
   */
  public getLastEscalationReason(): string | null {
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
  public async route(request: LLMDegradationRequest): Promise<LLMDegradationResponse> {
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
  private async routeD0(request: LLMDegradationRequest): Promise<LLMDegradationResponse> {
    try {
      const response = await this.primaryProvider.createChatCompletion({
        model: request.model,
        messages: request.messages.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
        maxTokens: 4096,
        traceId: `degradation:${request.routeClass}:primary`,
        tenantId: request.tenantId ?? null,
        costTag: `degradation.${request.routeClass}.primary`,
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
    } catch (error) {
      this.lastEscalationReason = error instanceof Error ? error.message : "unknown";
      this.escalate();
      // Retry with new level
      return this.route(request);
    }
  }

  /**
   * D1: Fallback to alternative model.
   */
  private async routeD1(request: LLMDegradationRequest): Promise<LLMDegradationResponse> {
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
        messages: request.messages.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
        maxTokens: 4096,
        traceId: `degradation:${request.routeClass}:fallback`,
        tenantId: request.tenantId ?? null,
        costTag: `degradation.${request.routeClass}.fallback`,
      });

      return {
        content: response.content,
        model: response.model,
        degradationLevel: DegradationLevel.D1,
        cached: false,
        fromCache: false,
      };
    } catch (error) {
      this.lastEscalationReason = error instanceof Error ? error.message : "unknown";
      this.escalate();
      // Retry with new level
      return this.route(request);
    }
  }

  /**
   * D2: Serve cached responses when available.
   */
  private async routeD2(request: LLMDegradationRequest): Promise<LLMDegradationResponse> {
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
  private async routeD3(request: LLMDegradationRequest): Promise<LLMDegradationResponse> {
    const templateKey = getTemplateKey(request.taskType);
    const content = this.templates[templateKey] ?? DEFAULT_TEMPLATE_RESPONSES["default"]!;

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
  private async routeD4(_request: LLMDegradationRequest): Promise<LLMDegradationResponse> {
    throw new ProviderError(
      "degradation.service_unavailable",
      "LLM service is currently unavailable due to sustained high error rates. Please retry later.",
      { retryable: true, details: { degradationLevel: DegradationLevel.D4 } },
    );
  }

  /**
   * Selects a fallback profile for D1 using the fallback service.
   */
  private selectFallbackProfile(
    primaryProfileName: string,
  ): ModelFallbackCandidate | null {
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
   * Returns providers that are not the primary and are currently healthy.
   */
  private getFallbackCandidates(): ModelFallbackCandidate[] {
    // In a full implementation, this would query the provider registry
    // for available healthy providers that can serve as fallbacks.
    // For now, return candidates from the fallback provider if configured.
    const candidates: ModelFallbackCandidate[] = [];

    // If a fallback provider is configured, add it as a candidate
    if (this.fallbackProvider != null) {
      // Note: In a real implementation, we would query the provider's
      // model profiles and health status here. This is a simplified version.
      candidates.push({
        profileName: "fallback-default",
        provider: "fallback",
        tier: "balanced",
        healthy: true,
        inputCostPer1kUsd: 0.5,
      });
    }

    return candidates;
  }

  /**
   * Escalates to the next degradation level.
   * Emits OperationalDirective per §9.5 for mode synthesis chain interaction.
   */
  public escalate(): void {
    if (this.currentLevel < DegradationLevel.D4) {
      const oldLevel = this.currentLevel;
      this.currentLevel++;
      this.consecutiveHealthyCount = 0;

      // Emit OperationalDirective per §9.5
      const directive = createOperationalDirective({
        directiveId: `degradation_escalate_${Date.now()}`,
        issuedBy: "degradation_controller",
        directiveType: "mode_escalation",
        targetLevel: this.currentLevel,
        reason: this.lastEscalationReason ?? "health_threshold_exceeded",
        previousLevel: oldLevel,
      });

      logger.log({
        level: "warn",
        message: "degradation:escalate",
        crosscuttingFabric: "reliability",
        data: {
          oldLevel,
          newLevel: this.currentLevel,
          directive,
          reason: this.lastEscalationReason,
        },
      });
    }
  }

  /**
   * De-escalates to the previous degradation level if health criteria are met.
   * Emits OperationalDirective per §9.5 for mode synthesis chain interaction.
   */
  public deescalate(): void {
    if (this.currentLevel > DegradationLevel.D0) {
      const oldLevel = this.currentLevel;
      this.currentLevel--;
      this.consecutiveHealthyCount = 0;

      // Emit OperationalDirective per §9.5
      const directive = createOperationalDirective({
        directiveId: `degradation_deescalate_${Date.now()}`,
        issuedBy: "degradation_controller",
        directiveType: "mode_deescalation",
        targetLevel: this.currentLevel,
        reason: "health_recovered",
        previousLevel: oldLevel,
      });

      logger.log({
        level: "info",
        message: "degradation:deescalate",
        crosscuttingFabric: "reliability",
        data: {
          oldLevel,
          newLevel: this.currentLevel,
          directive,
          reason: "health_recovered",
        },
      });
    }
  }

  /**
   * Evaluates provider health and automatically adjusts degradation level.
   *
   * Escalation occurs when error rate > threshold OR latency P99 > threshold.
   * De-escalation occurs when error rate < threshold for minHealthyCount consecutive evaluations.
   */
  public evaluateHealth(metrics: ProviderMetrics): {
    action: "escalate" | "deescalate" | "maintain";
    newLevel: DegradationLevel;
    reason: string;
  } {
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

    const shouldEscalate =
      errorRate > this.config.escalateErrorRateThreshold ||
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
    const shouldDeescalate =
      errorRate < this.config.deescalateErrorRateThreshold &&
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
  public reset(): void {
    this.currentLevel = DegradationLevel.D0;
    this.consecutiveHealthyCount = 0;
    this.lastEscalationReason = null;
  }

  /**
   * Forces a specific degradation level (for manual override).
   */
  public setLevel(level: DegradationLevel): void {
    if (level < DegradationLevel.D0 || level > DegradationLevel.D4) {
      throw new AppError(
        "degradation.invalid_level",
        `Invalid degradation level: ${level}. Must be between D0 (0) and D4 (4).`,
        { category: "validation", source: "provider" },
      );
    }
    this.currentLevel = level;
    this.consecutiveHealthyCount = 0;
  }
}
