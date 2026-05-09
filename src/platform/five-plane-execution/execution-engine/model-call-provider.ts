/**
 * @fileoverview Model Call Provider - Real LLM call implementation for agent execution
 *
 * This module provides the actual LLM call implementation that integrates
 * with the middleware chain's wrapModelCall hooks. It uses the unified chat
 * provider to make real API calls to Anthropic, OpenAI, or MiniMax.
 *
 * ## Architecture
 *
 * The model call provider is registered as a wrapModelCall hook in the middleware
 * chain. When executeAgentRound is called, the middleware chain invokes the
 * registered model call provider which makes the actual LLM API call.
 */

import { globalMiddlewareChain, type WrapModelCallHook, type MiddlewareContext } from "./agent-middleware-chain.js";
import { createUnifiedChatProvider, type UnifiedProviderConfig, type ChatMessage, type ChatCompletionRequest } from "../../model-gateway/provider-registry/unified-chat-provider.js";
import type { ModelProfileMetadata } from "../../control-plane/config-center/model-metadata-registry.js";
import { ProviderError } from "../../contracts/errors.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { CallGovernance, type DistributedRateLimiterLike } from "./call-governance.js";
import { DistributedRateLimiter } from "../../interface/ingress/distributed-rate-limiter.js";
import { readRedisConnectionConfigFromEnv } from "../../shared/utils/redis-client-options.js";
import { BudgetGuard, type BudgetPolicy } from "../../model-gateway/cost-tracker/budget-guard.js";
import { nowIso } from "../../contracts/types/ids.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

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
}

let modelCallProviderInstance: ModelCallProviderService | null = null;

export interface LlmModelCallRequest {
  model: string;
  messages: ChatMessage[];
  system?: string;
  temperature?: number;
  maxTokens: number;
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

export class ModelCallProviderService {
  private readonly unifiedProvider: ReturnType<typeof createUnifiedChatProvider>;
  private readonly defaultModel: string;
  private readonly callGovernance: CallGovernance | null;
  private readonly budgetGuard: BudgetGuard;
  private disposed = false;

  public constructor(config: ModelCallProviderConfig) {
    const providerConfig: UnifiedProviderConfig = config.providerConfig ?? {};
    const env = process.env;

    const anthropicApiKey = config.anthropicApiKey ?? env.ANTHROPIC_API_KEY;
    if (!providerConfig.anthropic && anthropicApiKey) {
      providerConfig.anthropic = { apiKey: anthropicApiKey };
    }
    const openaiApiKey = config.openaiApiKey ?? env.OPENAI_API_KEY;
    if (!providerConfig.openai && openaiApiKey) {
      providerConfig.openai = { apiKey: openaiApiKey };
    }
    const minimaxApiKey = config.minimaxApiKey ?? env.MINIMAX_API_KEY ?? env.AA_MINIMAX_API_KEY;
    if (!providerConfig.minimax && minimaxApiKey) {
      providerConfig.minimax = {
        apiKey: minimaxApiKey,
        ...(readTrimmedEnvValue(env.MINIMAX_API_BASE) != null
          ? { baseUrl: readTrimmedEnvValue(env.MINIMAX_API_BASE)! }
          : {}),
      };
    }

    this.unifiedProvider = createUnifiedChatProvider(providerConfig);
    this.defaultModel = config.defaultModel ?? "MiniMax-M2.7";
    this.callGovernance = createModelCallGovernance(config, process.env);
    this.budgetGuard = new BudgetGuard();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.unifiedProvider.dispose();
  }

  public getDefaultModel(): string {
    return this.defaultModel;
  }

  public hasAnthropic(): boolean {
    if (this.disposed) {
      return false;
    }
    return this.unifiedProvider.hasProvider("anthropic");
  }

  public hasOpenAI(): boolean {
    if (this.disposed) {
      return false;
    }
    return this.unifiedProvider.hasProvider("openai");
  }

  public hasMinimax(): boolean {
    if (this.disposed) {
      return false;
    }
    return this.unifiedProvider.hasProvider("minimax");
  }

  public hasAnyProvider(): boolean {
    return this.hasAnthropic() || this.hasOpenAI() || this.hasMinimax();
  }

  public async createCompletion(request: LlmModelCallRequest): Promise<LlmModelCallResult> {
    if (!this.hasAnyProvider()) {
      throw new ProviderError("model_call.no_provider_configured", "No model provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or MINIMAX_API_KEY environment variable", {
        retryable: true,
      });
    }

    const policy = this.getDefaultBudgetPolicy();

    // R2-6: Enforce maxModelTokens constraint before LLM call
    if (policy.maxModelTokens != null && policy.maxModelTokens > 0 && request.maxTokens > policy.maxModelTokens) {
      throw new ProviderError("model_call.max_tokens_exceeded", `Maximum model tokens ${policy.maxModelTokens} exceeded for this call (requested ${request.maxTokens})`, {
        retryable: false,
      });
    }

    // R4-25 (INV-BUDGET-001): Reserve budget before LLM call
    const estimatedCostUsd = this.estimateLlmCallCost(request.maxTokens, request.model);
    const budgetEvaluation = this.budgetGuard.evaluateTaskSpend({
      policy,
      currentTaskCostUsd: 0,
      nextEstimatedCostUsd: estimatedCostUsd,
    });
    if (!budgetEvaluation.allowed) {
      throw new ProviderError("model_call.budget_exceeded", `Budget limit exceeded for LLM call: ${budgetEvaluation.reasonCode}`, {
        retryable: false,
      });
    }

    // R2-6: Enforce maxDurationMs constraint using AbortSignal timeout
    const controller = new AbortController();
    const maxDurationMs = policy.maxDurationMs;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (maxDurationMs != null && maxDurationMs > 0) {
      timeoutId = setTimeout(() => {
        controller.abort();
      }, maxDurationMs);
    }

    const req: ChatCompletionRequest = {
      model: request.model,
      messages: request.messages,
      maxTokens: request.maxTokens,
      stream: false,
      traceId: request.traceId ?? "",
      tenantId: request.tenantId ?? null,
      costTag: request.costTag ?? "",
      abortSignal: controller.signal,
      ...(request.tools !== undefined ? { tools: request.tools } : {}),
    };
    if (request.system !== undefined) {
      req.system = request.system;
    }
    if (request.temperature !== undefined) {
      req.temperature = request.temperature;
    }

    try {
      const startTime = Date.now();
      const result = await this.executeGovernedCompletion(buildModelGovernanceKey(request.model), req);
      const elapsedMs = Date.now() - startTime;

      // R2-6: Check duration constraint after call completes
      if (maxDurationMs != null && maxDurationMs > 0 && elapsedMs > maxDurationMs) {
        throw new ProviderError("model_call.duration_exceeded", `Maximum duration ${maxDurationMs}ms exceeded (actual: ${elapsedMs}ms)`, {
          retryable: false,
        });
      }

      return result;
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }
  }

  public async createStreamingCompletion(
    request: LlmModelCallRequest,
    onChunk: (chunk: LlmModelCallResult, isFinal: boolean) => void,
  ): Promise<void> {
    if (!this.hasAnyProvider()) {
      throw new ProviderError("model_call.no_provider_configured", "No model provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or MINIMAX_API_KEY environment variable", {
        retryable: true,
      });
    }

    const policy = this.getDefaultBudgetPolicy();
    const maxDurationMs = policy.maxDurationMs;

    // R2-6: Enforce maxDurationMs constraint using AbortSignal timeout
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (maxDurationMs != null && maxDurationMs > 0) {
      timeoutId = setTimeout(() => {
        controller.abort();
      }, maxDurationMs);
    }

    const req: ChatCompletionRequest = {
      model: request.model,
      messages: request.messages,
      maxTokens: request.maxTokens,
      stream: true,
      traceId: request.traceId ?? "",
      tenantId: request.tenantId ?? null,
      costTag: request.costTag ?? "",
      abortSignal: controller.signal,
      ...(request.tools !== undefined ? { tools: request.tools } : {}),
    };
    if (request.system !== undefined) {
      req.system = request.system;
    }
    if (request.temperature !== undefined) {
      req.temperature = request.temperature;
    }

    const governanceKey = buildModelGovernanceKey(request.model);
    const startTime = Date.now();

    const executeStreaming = async (): Promise<void> => {
      await this.unifiedProvider.createStreamingChatCompletion(
        req,
        (chunk) => {
          // R2-6: Check duration constraint between chunks
          if (maxDurationMs != null && maxDurationMs > 0) {
            const elapsedMs = Date.now() - startTime;
            if (elapsedMs > maxDurationMs) {
              controller.abort();
              throw new ProviderError("model_call.duration_exceeded", `Maximum duration ${maxDurationMs}ms exceeded (elapsed: ${elapsedMs}ms)`, {
                retryable: false,
              });
            }
          }
          onChunk(this.normalizeResult(chunk), false);
        },
      );
    };

    try {
      if (this.callGovernance == null) {
        await executeStreaming();
        return;
      }

      const result = await this.callGovernance.execute(governanceKey, executeStreaming);
      if (!result.success) {
        throw this.toGovernanceError(governanceKey, result.error?.code ?? "governance.unknown_error", result.error?.message ?? "Model call governance rejected request.", result.error?.retryable ?? true, result.error?.retryAfterMs);
      }
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }
  }

  public createMiddlewareHook(): WrapModelCallHook {
    const provider = this;
    return {
      name: "model_call_provider",
      priority: 0,
      run: async <T>(
        _ctx: MiddlewareContext,
        input: { messages: unknown[]; model?: string },
        next: () => Promise<T>,
      ): Promise<T> => {
        // If no model call provider is configured, fall through to the next handler
        if (!provider.hasAnyProvider()) {
          return next();
        }

        try {
          // Transform the middleware input to our request format
          const messages = input.messages as ChatMessage[];
          const model = input.model ?? provider.getDefaultModel();

          const result = await provider.createCompletion({
            model,
            messages,
            maxTokens: 4096,
          });

          // Return the result as a properly typed response
          // The actual typing is handled by the next() function's return type
          return result as unknown as T;
        } catch (error) {
          // If the model call fails, log and re-throw
          logger.log({ level: "error", message: `LLM call failed`, data: { error: error instanceof Error ? error.message : String(error) } });
          throw error;
        }
      },
    };
  }

  private normalizeResult(result: Awaited<ReturnType<ReturnType<typeof createUnifiedChatProvider>["createChatCompletion"]>>): LlmModelCallResult {
    return {
      id: result.id,
      content: result.content,
      refusal: result.refusal,
      reasoningContent: result.reasoningContent,
      finishReason: result.finishReason,
      toolCalls: result.toolCalls,
      usage: result.usage,
      model: result.model,
      provider: result.provider,
    };
  }

  private async executeGovernedCompletion(
    key: string,
    request: ChatCompletionRequest,
  ): Promise<LlmModelCallResult> {
    const call = async () => this.unifiedProvider.createChatCompletion(request);
    if (this.callGovernance == null) {
      return this.normalizeResult(await call());
    }

    const result = await this.callGovernance.execute(key, call);
    if (!result.success || result.data == null) {
      throw this.toGovernanceError(
        key,
        result.error?.code ?? "governance.unknown_error",
        result.error?.message ?? `Model call rejected by governance for ${key}.`,
        result.error?.retryable ?? true,
        result.error?.retryAfterMs,
      );
    }
    return this.normalizeResult(result.data);
  }

  private getDefaultBudgetPolicy(): BudgetPolicy {
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

  private estimateLlmCallCost(maxTokens: number, model: string): number {
    // Estimate cost based on model and token count
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

  private toGovernanceError(
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
}

function buildModelGovernanceKey(model: string): string {
  return `model:${model}`;
}

function createModelCallGovernance(
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

function readTrimmedEnvValue(raw: string | undefined): string | null {
  if (raw == null) {
    return null;
  }
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

function parsePositiveInteger(raw: string | undefined): number | null {
  const value = readTrimmedEnvValue(raw);
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeInteger(raw: string | undefined): number | null {
  const value = readTrimmedEnvValue(raw);
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseBoolean(raw: string | undefined): boolean | null {
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

export function initializeModelCallProvider(config: ModelCallProviderConfig): ModelCallProviderService {
  if (modelCallProviderInstance !== null) {
    return modelCallProviderInstance;
  }

  modelCallProviderInstance = new ModelCallProviderService(config);

  // Register the model call hook in the global middleware chain
  const hook = modelCallProviderInstance.createMiddlewareHook();
  const registeredHooks = globalMiddlewareChain.getRegisteredHooks();

  if (!registeredHooks.wrapModelCall.includes(hook.name)) {
    globalMiddlewareChain.registerWrapModelCall(hook);
  }

  return modelCallProviderInstance;
}

export function getModelCallProvider(): ModelCallProviderService | null {
  return modelCallProviderInstance;
}

export function resetModelCallProvider(): void {
  modelCallProviderInstance?.dispose();
  modelCallProviderInstance = null;
}

export function createModelCallMiddleware(config: ModelCallProviderConfig): WrapModelCallHook {
  const provider = new ModelCallProviderService(config);
  return provider.createMiddlewareHook();
}
