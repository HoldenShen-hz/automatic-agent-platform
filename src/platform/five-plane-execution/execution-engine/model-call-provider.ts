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
import { createUnifiedChatProvider, type ChatCompletionRequest, type ChatMessage, type UnifiedProviderConfig } from "../../model-gateway/provider-registry/unified-chat-provider.js";
import type { ModelProfileMetadata } from "../../five-plane-control-plane/config-center/model-metadata-registry.js";
import { ProviderError } from "../../contracts/errors.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { CallGovernance } from "./call-governance.js";
import { BudgetGuard } from "../../model-gateway/cost-tracker/budget-guard.js";
import {
  buildBudgetReservationRequest,
  buildModelGovernanceKey,
  createModelCallGovernance,
  estimateActualLlmCallCost,
  estimateLlmCallCost,
  getDefaultBudgetPolicy,
  isRetryableProviderError,
  parseNonNegativeInteger,
  parsePositiveInteger,
  readTrimmedEnvValue,
  resolveFallbackModels,
  sleep,
  toGovernanceError,
  type LlmModelCallRequest,
  type LlmModelCallResult,
  type ModelCallProviderConfig,
} from "./model-call-provider-support.js";
export type {
  LlmModelCallRequest,
  LlmModelCallResult,
  ModelCallProviderConfig,
} from "./model-call-provider-support.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

let modelCallProviderInstance: ModelCallProviderService | null = null;

export class ModelCallProviderService {
  private readonly unifiedProvider: ReturnType<typeof createUnifiedChatProvider>;
  private readonly defaultModel: string;
  private readonly fallbackModels: readonly string[];
  private readonly retryMaxAttempts: number;
  private readonly retryBaseDelayMs: number;
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
    this.fallbackModels = resolveFallbackModels(config, env);
    this.retryMaxAttempts = Math.max(1, config.retry?.maxAttempts ?? parsePositiveInteger(env.AA_MODEL_CALL_RETRY_MAX_ATTEMPTS) ?? 2);
    this.retryBaseDelayMs = Math.max(0, config.retry?.baseDelayMs ?? parseNonNegativeInteger(env.AA_MODEL_CALL_RETRY_BASE_DELAY_MS) ?? 100);
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

    const policy = getDefaultBudgetPolicy();

    // R2-6: Enforce maxModelTokens constraint before LLM call
    if (policy.maxModelTokens != null && policy.maxModelTokens > 0 && request.maxTokens > policy.maxModelTokens) {
      throw new ProviderError("model_call.max_tokens_exceeded", `Maximum model tokens ${policy.maxModelTokens} exceeded for this call (requested ${request.maxTokens})`, {
        retryable: false,
      });
    }

    // R4-25 (INV-BUDGET-001): Reserve budget before LLM call
    const estimatedCostUsd = estimateLlmCallCost(request.maxTokens, request.model);
    const reserveResult = this.budgetGuard.atomicReserve(buildBudgetReservationRequest(request, policy, estimatedCostUsd));
    if (!reserveResult.success) {
      throw new ProviderError("model_call.budget_exceeded", `Budget limit exceeded for LLM call: ${reserveResult.reasonCode}`, {
        retryable: false,
      });
    }
    const budgetSessionId = reserveResult.session.sessionId;
    const executeBudgetResult = this.budgetGuard.atomicExecute(budgetSessionId);
    if (!executeBudgetResult.success) {
      await this.budgetGuard.atomicRelease(budgetSessionId);
      throw new ProviderError("model_call.budget_execute_failed", `Budget execution failed for LLM call: ${executeBudgetResult.reasonCode}`, {
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

    let budgetSettled = false;
    try {
      const startTime = Date.now();
      const result = await this.executeGovernedCompletionWithFallback(request.model, req);
      const elapsedMs = Date.now() - startTime;

      // R2-6: Check duration constraint after call completes
      if (maxDurationMs != null && maxDurationMs > 0 && elapsedMs > maxDurationMs) {
        throw new ProviderError("model_call.duration_exceeded", `Maximum duration ${maxDurationMs}ms exceeded (actual: ${elapsedMs}ms)`, {
          retryable: false,
        });
      }

      const settleResult = await this.budgetGuard.atomicSettle(
        budgetSessionId,
        estimateActualLlmCallCost(result, result.model) ?? estimatedCostUsd,
      );
      if (!settleResult.success) {
        throw new ProviderError("model_call.budget_settle_failed", `Budget settlement failed for LLM call: ${settleResult.reasonCode}`, {
          retryable: false,
        });
      }
      budgetSettled = true;
      return result;
    } catch (error) {
      if (!budgetSettled) {
        await this.budgetGuard.atomicRelease(budgetSessionId);
      }
      throw error;
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

    const policy = getDefaultBudgetPolicy();
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
    const estimatedCostUsd = estimateLlmCallCost(request.maxTokens, request.model);
    const reserveResult = this.budgetGuard.atomicReserve(buildBudgetReservationRequest(request, policy, estimatedCostUsd));
    if (!reserveResult.success) {
      throw new ProviderError("model_call.budget_exceeded", `Budget limit exceeded for LLM call: ${reserveResult.reasonCode}`, {
        retryable: false,
      });
    }
    const budgetSessionId = reserveResult.session.sessionId;
    const executeBudgetResult = this.budgetGuard.atomicExecute(budgetSessionId);
    if (!executeBudgetResult.success) {
      await this.budgetGuard.atomicRelease(budgetSessionId);
      throw new ProviderError("model_call.budget_execute_failed", `Budget execution failed for LLM call: ${executeBudgetResult.reasonCode}`, {
        retryable: false,
      });
    }
    let latestChunk: LlmModelCallResult | null = null;

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
          latestChunk = this.normalizeResult(chunk);
          onChunk(latestChunk, false);
        },
      );
    };

    let budgetSettled = false;
    try {
      if (this.callGovernance == null) {
        await executeStreaming();
      } else {
        const result = await this.callGovernance.execute(governanceKey, executeStreaming);
        if (!result.success) {
          throw toGovernanceError(governanceKey, result.error?.code ?? "governance.unknown_error", result.error?.message ?? "Model call governance rejected request.", result.error?.retryable ?? true, result.error?.retryAfterMs);
        }
      }

      const settleResult = await this.budgetGuard.atomicSettle(
        budgetSessionId,
        estimateActualLlmCallCost(latestChunk, request.model) ?? estimatedCostUsd,
      );
      if (!settleResult.success) {
        throw new ProviderError("model_call.budget_settle_failed", `Budget settlement failed for LLM call: ${settleResult.reasonCode}`, {
          retryable: false,
        });
      }
      budgetSettled = true;
    } catch (error) {
      if (!budgetSettled) {
        await this.budgetGuard.atomicRelease(budgetSessionId);
      }
      throw error;
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
      throw toGovernanceError(
        key,
        result.error?.code ?? "governance.unknown_error",
        result.error?.message ?? `Model call rejected by governance for ${key}.`,
        result.error?.retryable ?? true,
        result.error?.retryAfterMs,
      );
    }
    return this.normalizeResult(result.data);
  }

  private async executeGovernedCompletionWithFallback(
    requestedModel: string,
    request: ChatCompletionRequest,
  ): Promise<LlmModelCallResult> {
    const candidateModels = [...new Set([requestedModel, ...this.fallbackModels].filter((model) => model.trim().length > 0))];
    let lastError: unknown = null;
    for (const model of candidateModels) {
      const attemptRequest = model === request.model ? request : { ...request, model };
      try {
        return await this.executeWithRetry(model, () => this.executeGovernedCompletion(buildModelGovernanceKey(model), attemptRequest));
      } catch (error) {
        lastError = error;
        if (!isRetryableProviderError(error)) {
          break;
        }
        logger.log({
          level: "warn",
          message: "LLM model candidate failed; trying fallback when available",
          data: { model, error: error instanceof Error ? error.message : String(error) },
        });
      }
    }
    throw lastError;
  }

  private async executeWithRetry<T>(model: string, operation: () => Promise<T>): Promise<T> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= this.retryMaxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt >= this.retryMaxAttempts || !isRetryableProviderError(error)) {
          throw error;
        }
        const delayMs = this.retryBaseDelayMs * (2 ** (attempt - 1));
        logger.log({
          level: "warn",
          message: "Retrying LLM model call after retryable failure",
          data: { model, attempt, nextAttempt: attempt + 1, delayMs, error: error instanceof Error ? error.message : String(error) },
        });
        if (delayMs > 0) {
          await sleep(delayMs);
        }
      }
    }
    throw lastError;
  }

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
