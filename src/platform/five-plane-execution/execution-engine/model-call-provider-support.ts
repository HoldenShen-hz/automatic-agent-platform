import { DistributedRateLimiter } from "../../five-plane-interface/ingress/distributed-rate-limiter.js";
import type { ChatMessage, UnifiedProviderConfig } from "../../model-gateway/provider-registry/unified-chat-provider.js";
import type { BudgetPolicy, BudgetReservationRequest } from "../../model-gateway/cost-tracker/budget-guard.js";
import { ProviderError } from "../../contracts/errors.js";
import { nowIso } from "../../contracts/types/ids.js";
import { CallGovernance, type DistributedRateLimiterLike } from "./call-governance.js";
import { readRedisConnectionConfigFromEnv } from "../../shared/utils/redis-client-options.js";

export interface ModelCallProviderConfig {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  minimaxApiKey?: string;
  defaultModel?: string;
  providerConfig?: UnifiedProviderConfig;
  callRateLimit?: {
    maxCalls: number;
    windowMs: number;
  } | null;
  distributedRateLimiter?: DistributedRateLimiterLike | null;
  fallbackModels?: readonly string[];
  retry?: {
    maxAttempts?: number;
    baseDelayMs?: number;
  };
}

export interface LlmModelCallRequest {
  model: string;
  messages: ChatMessage[];
  system?: string;
  temperature?: number;
  maxTokens: number;
  harnessRunId?: string;
  traceId?: string;
  tenantId?: string | null;
  costTag?: string;
  abortSignal?: AbortSignal;
  tools?: Array<{
    type: "function";
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  }>;
}

export interface LlmModelCallResult {
  id: string;
  content: string;
  refusal: string | null;
  reasoningContent: string | null;
  finishReason: string;
  toolCalls: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
}

export function getDefaultBudgetPolicy(): BudgetPolicy {
  return {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    maxPlatformCostUsd: 0,
    maxSteps: 100,
    maxModelTokens: 8192,
    maxDurationMs: 60000,
    warnAtRatio: 0.8,
    mode: "auto",
  };
}

export function buildBudgetReservationRequest(
  request: LlmModelCallRequest,
  policy: BudgetPolicy,
  estimatedCostUsd: number,
): BudgetReservationRequest {
  return {
    policy,
    spend: {
      currentTaskCostUsd: 0,
      nextEstimatedCostUsd: estimatedCostUsd,
      currentDailyCostUsd: 0,
      currentMonthlyCostUsd: 0,
    },
    tenantId: request.tenantId ?? "system",
    harnessRunId: request.harnessRunId?.trim() || request.traceId?.trim() || `harness_run:llm:${Date.now()}`,
    traceId: request.traceId?.trim() || `trace:${nowIso()}`,
    emittedBy: "model_call_provider",
  };
}

export function estimateLlmCallCost(maxTokens: number, model: string): number {
  const costPerThousandTokens: Record<string, number> = {
    "MiniMax-M2.7": 0.001,
    "MiniMax-M2.7-highspeed": 0.002,
    "MiniMax-M2": 0.0008,
    "MiniMax-M1": 0.0005,
    "claude-opus-4-5": 0.015,
    "claude-sonnet-4": 0.008,
    "claude-haiku-3-5": 0.002,
    "gpt-4o": 0.005,
    "gpt-4o-mini": 0.0015,
  };
  const rate = costPerThousandTokens[model] ?? 0.001;
  return (maxTokens / 1000) * rate;
}

export function estimateActualLlmCallCost(result: LlmModelCallResult | null, model: string): number | null {
  if (result == null) {
    return null;
  }
  return estimateCostFromUsage(result.usage.promptTokens, result.usage.completionTokens, model);
}

export function estimateCostFromUsage(promptTokens: number, completionTokens: number, model: string): number {
  return estimateLlmCallCost(Math.max(0, promptTokens) + Math.max(0, completionTokens), model);
}

export function toGovernanceError(
  key: string,
  code: string,
  message: string,
  retryable: boolean,
  retryAfterMs?: number,
): ProviderError {
  return new ProviderError(code, message, {
    retryable,
    ...(retryAfterMs != null ? { details: { governanceKey: key, retryAfterMs } } : { details: { governanceKey: key } }),
  });
}

export function buildModelGovernanceKey(model: string): string {
  return `model:${model}`;
}

export function createModelCallGovernance(
  config: ModelCallProviderConfig,
  env: NodeJS.ProcessEnv,
): CallGovernance | null {
  const callRateLimit = resolveCallRateLimit(config, env);
  const distributedRateLimiter = resolveDistributedRateLimiter(config, env);
  if (callRateLimit == null) {
    return null;
  }

  return new CallGovernance(
    {
      limiter: {
        maxCalls: callRateLimit.maxCalls,
        windowMs: callRateLimit.windowMs,
      },
    },
    {
      distributedRateLimiter,
    },
  );
}

export function resolveFallbackModels(config: ModelCallProviderConfig, env: NodeJS.ProcessEnv): readonly string[] {
  if (config.fallbackModels !== undefined) {
    return config.fallbackModels.map((model) => model.trim()).filter((model) => model.length > 0);
  }
  return (env.AA_MODEL_PROVIDER_FALLBACK_MODELS ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter((model) => model.length > 0);
}

export function isRetryableProviderError(error: unknown): boolean {
  if (error instanceof ProviderError) {
    return error.retryable;
  }
  if (typeof error === "object" && error !== null && "retryable" in error) {
    return (error as { retryable?: unknown }).retryable !== false;
  }
  return true;
}

export async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function readTrimmedEnvValue(raw: string | undefined): string | null {
  if (raw == null) {
    return null;
  }
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

export function parsePositiveInteger(raw: string | undefined): number | null {
  const value = readTrimmedEnvValue(raw);
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseNonNegativeInteger(raw: string | undefined): number | null {
  const value = readTrimmedEnvValue(raw);
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function parseBoolean(raw: string | undefined): boolean | null {
  const value = readTrimmedEnvValue(raw);
  if (value == null) {
    return null;
  }
  const normalized = value.toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return null;
}

function resolveCallRateLimit(
  config: ModelCallProviderConfig,
  env: NodeJS.ProcessEnv,
): { maxCalls: number; windowMs: number } | null {
  if (config.callRateLimit != null) {
    return config.callRateLimit;
  }
  const maxCalls = parsePositiveInteger(env.AA_MODEL_CALL_RATE_LIMIT_MAX_CALLS);
  const windowMs = parsePositiveInteger(env.AA_MODEL_CALL_RATE_LIMIT_WINDOW_MS);
  if (maxCalls == null && windowMs == null) {
    return null;
  }
  return {
    maxCalls: maxCalls ?? 100,
    windowMs: windowMs ?? 1000,
  };
}

function resolveDistributedRateLimiter(
  config: ModelCallProviderConfig,
  env: NodeJS.ProcessEnv,
): DistributedRateLimiterLike | null {
  if (config.distributedRateLimiter != null) {
    return config.distributedRateLimiter;
  }
  const redisConfig = readRedisConnectionConfigFromEnv("AA_MODEL_CALL_RATE_LIMIT_REDIS", env);
  if (redisConfig == null) {
    return null;
  }
  return new DistributedRateLimiter({
    redis: {
      ...redisConfig,
      ...(readTrimmedEnvValue(env.AA_MODEL_CALL_RATE_LIMIT_REDIS_KEY_PREFIX) != null
        ? { keyPrefix: readTrimmedEnvValue(env.AA_MODEL_CALL_RATE_LIMIT_REDIS_KEY_PREFIX)! }
        : {}),
    },
  });
}
