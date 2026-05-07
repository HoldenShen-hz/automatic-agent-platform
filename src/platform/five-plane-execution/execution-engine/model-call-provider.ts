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
import { BudgetGuard, type BudgetPolicy, BudgetExecutionSessionManager, type BudgetExecutionContext, BudgetExecutionState } from "../../model-gateway/cost-tracker/budget-guard.js";
import { BudgetAllocator, BudgetTier, type BudgetAllocatorContext } from "../../five-plane-execution/budget-allocator.js";
import { createBudgetLedger, type BudgetLedger, type BudgetReservation, reserveBudgetHardCap } from "../../contracts/executable-contracts/index.js";
import { nowIso, newId } from "../../contracts/types/ids.js";

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
  budgetPolicy?: Partial<BudgetPolicy>;
  // R4-25 (INV-BUDGET-001): Accept external budgetLedger and harnessRunId instead of creating isolated ones
  budgetLedger?: BudgetLedger;
  harnessRunId?: string;
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
  private readonly budgetAllocator: BudgetAllocator;
  private readonly budgetLedger: BudgetLedger;
  private readonly budgetPolicyOverrides: Partial<BudgetPolicy>;
  // R8-01 FIX: Use BudgetExecutionSessionManager for atomic reserve→execute→settle
  private readonly budgetSessionManager: BudgetExecutionSessionManager;
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
    this.budgetAllocator = new BudgetAllocator();
    this.budgetPolicyOverrides = config.budgetPolicy ?? {};
    // R8-01: Initialize BudgetExecutionSessionManager
    this.budgetSessionManager = new BudgetExecutionSessionManager({ allocator: this.budgetAllocator });
    // R4-25 (INV-BUDGET-001): Use external budgetLedger if provided, otherwise create isolated one
    // The external budgetLedger flows from validatedPlanGraphBundle through the execution chain
    this.budgetLedger = config.budgetLedger ?? createBudgetLedger({
      tenantId: "tenant:local",
      harnessRunId: config.harnessRunId ?? "harness_run:model_provider",
      currency: "USD",
      hardCap: 10, // matches default maxTaskCostUsd
    });
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

    // R4-25 (INV-BUDGET-001) + R8-01 FIX: Atomic reserve→execute→settle via BudgetExecutionSession
    const estimatedCostUsd = this.estimateLlmCallCost(request.maxTokens, request.model);
    const policy = this.getDefaultBudgetPolicy();
    const traceId = request.traceId ?? newId("trace");
    this.enforceStepConstraints(policy, request);
    const executionWindow = this.createBudgetExecutionWindow(request.abortSignal, policy.maxDurationMs);

    // R8-01: Use BudgetExecutionSessionManager for atomic reserve→execute→settle
    // This prevents concurrent requests from overspending due to race conditions
    const executionContext: BudgetExecutionContext = {
      tenantId: request.tenantId ?? "tenant:local",
      harnessRunId: this.budgetLedger.harnessRunId,
      traceId,
      emittedBy: "ModelCallProviderService",
      ledger: this.budgetLedger,
      policy,
    };

    let session;
    try {
      // R8-01: Step 1 - Reserve budget atomically
      session = this.budgetSessionManager.reserveAndCreateSession(
        executionContext,
        estimatedCostUsd,
        "token",
      );

      // Mark as executing
      this.budgetSessionManager.markExecuting(session.sessionId);

      // Proceed with actual LLM call
      const req: ChatCompletionRequest = {
        model: request.model,
        messages: request.messages,
        maxTokens: request.maxTokens,
        stream: false,
        traceId,
        tenantId: request.tenantId ?? null,
        costTag: request.costTag ?? "default",
        abortSignal: executionWindow.signal,
        ...(request.tools !== undefined ? { tools: request.tools } : {}),
      };
      if (request.system !== undefined) {
        req.system = request.system;
      }
      if (request.temperature !== undefined) {
        req.temperature = request.temperature;
      }

      const result = await this.executeGovernedCompletion(buildModelGovernanceKey(request.model), req);
      this.assertDurationWithinBudget(executionWindow.startedAt, policy.maxDurationMs);

      // R8-01: Step 2 - Settle with actual cost based on token usage
      const actualCost = this.calculateActualCost(result.usage.totalTokens, request.model);
      this.budgetSessionManager.settle(session.sessionId, actualCost);

      return result;
    } catch (error) {
      const surfacedError = executionWindow.didTimeout()
        ? this.createBudgetConstraintError("maxDurationMs", policy.maxDurationMs)
        : error;
      // R8-01: Step 3 - Release reservation on failure
      if (session) {
        this.budgetSessionManager.release(
          session.sessionId,
          surfacedError instanceof Error ? surfacedError.message : "model_call_failed",
        );
      }
      throw surfacedError;
    } finally {
      executionWindow.dispose();
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

    // R4-25 (INV-BUDGET-001) + R8-01 FIX: Atomic reserve→execute→settle via BudgetExecutionSession
    const estimatedCostUsd = this.estimateLlmCallCost(request.maxTokens, request.model);
    const policy = this.getDefaultBudgetPolicy();
    const traceId = request.traceId ?? newId("trace");
    this.enforceStepConstraints(policy, request);
    const executionWindow = this.createBudgetExecutionWindow(request.abortSignal, policy.maxDurationMs);

    // R8-01: Use BudgetExecutionSessionManager for atomic reserve→execute→settle
    // This prevents concurrent requests from overspending due to race conditions
    const executionContext: BudgetExecutionContext = {
      tenantId: request.tenantId ?? "tenant:local",
      harnessRunId: this.budgetLedger.harnessRunId,
      traceId,
      emittedBy: "ModelCallProviderService",
      ledger: this.budgetLedger,
      policy,
    };

    let session;
    try {
      // R8-01: Step 1 - Reserve budget atomically
      session = this.budgetSessionManager.reserveAndCreateSession(
        executionContext,
        estimatedCostUsd,
        "token",
      );

      // Mark as executing
      this.budgetSessionManager.markExecuting(session.sessionId);

      const req: ChatCompletionRequest = {
        model: request.model,
        messages: request.messages,
        maxTokens: request.maxTokens,
        stream: true,
        traceId,
        tenantId: request.tenantId ?? null,
        costTag: request.costTag ?? "default",
        abortSignal: executionWindow.signal,
        ...(request.tools !== undefined ? { tools: request.tools } : {}),
      };
      if (request.system !== undefined) {
        req.system = request.system;
      }
      if (request.temperature !== undefined) {
        req.temperature = request.temperature;
      }

      const governanceKey = buildModelGovernanceKey(request.model);
      const executeStreaming = async (): Promise<void> => {
        await this.unifiedProvider.createStreamingChatCompletion(
          req,
          (chunk) => {
            onChunk(this.normalizeResult(chunk), false);
          },
        );
      };

      if (this.callGovernance == null) {
        await executeStreaming();
      } else {
        const result = await this.callGovernance.execute(governanceKey, executeStreaming);
        if (!result.success) {
          throw this.toGovernanceError(governanceKey, result.error?.code ?? "governance.unknown_error", result.error?.message ?? "Model call governance rejected request.", result.error?.retryable ?? true, result.error?.retryAfterMs);
        }
      }
      this.assertDurationWithinBudget(executionWindow.startedAt, policy.maxDurationMs);

      // R8-01: Step 2 - Settle with estimated cost (streaming can't predict actual tokens upfront)
      this.budgetSessionManager.settle(session.sessionId, estimatedCostUsd);
    } catch (error) {
      const surfacedError = executionWindow.didTimeout()
        ? this.createBudgetConstraintError("maxDurationMs", policy.maxDurationMs)
        : error;
      // R8-01: Step 3 - Release reservation on failure
      if (session) {
        this.budgetSessionManager.release(
          session.sessionId,
          surfacedError instanceof Error ? surfacedError.message : "streaming_model_call_failed",
        );
      }
      throw surfacedError;
    } finally {
      executionWindow.dispose();
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
      maxPackCostUsd: 100,
      maxPlatformCostUsd: 1000,
      maxDailyCostUsd: 100,
      maxMonthlyCostUsd: 1000,
      maxModelTokens: 100000,
      maxSteps: 100,
      maxDurationMs: 600000,
      warnAtRatio: 0.8,
      mode: "auto",
      ...this.budgetPolicyOverrides,
    };
  }

  private enforceStepConstraints(policy: BudgetPolicy, request: LlmModelCallRequest): void {
    const result = this.budgetGuard.evaluateStepConstraints({
      policy,
      executionState: {
        currentSteps: 0,
        elapsedDurationMs: 0,
        currentModelTokens: this.estimatePromptTokens(request),
      },
      nextStepCostTokens: request.maxTokens,
    });
    if (!result.allowed && result.violatedConstraint != null) {
      const limit = policy[result.violatedConstraint];
      throw this.createBudgetConstraintError(result.violatedConstraint, typeof limit === "number" ? limit : null);
    }
  }

  private createBudgetConstraintError(
    constraint: "maxSteps" | "maxDurationMs" | "maxModelTokens",
    limit: number | null,
  ): ProviderError {
    const limitSuffix = limit != null ? ` (limit: ${limit})` : "";
    return new ProviderError(
      `budget.${constraint}_exceeded`,
      `Budget constraint ${constraint} exceeded${limitSuffix}`,
      { retryable: false },
    );
  }

  private createBudgetExecutionWindow(upstreamSignal: AbortSignal | undefined, maxDurationMs: number): {
    readonly signal: AbortSignal;
    readonly startedAt: number;
    readonly didTimeout: () => boolean;
    readonly dispose: () => void;
  } {
    const controller = new AbortController();
    const startedAt = Date.now();
    let timedOut = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const abortFromUpstream = () => {
      controller.abort(upstreamSignal?.reason ?? new Error("model_call.aborted"));
    };

    if (upstreamSignal?.aborted) {
      abortFromUpstream();
    } else if (upstreamSignal != null) {
      upstreamSignal.addEventListener("abort", abortFromUpstream, { once: true });
    }

    if (Number.isFinite(maxDurationMs) && maxDurationMs >= 0) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        controller.abort(new Error("budget.maxDurationMs_exceeded"));
      }, maxDurationMs);
    }

    return {
      signal: controller.signal,
      startedAt,
      didTimeout: () => timedOut,
      dispose: () => {
        if (timeoutHandle != null) {
          clearTimeout(timeoutHandle);
        }
        if (upstreamSignal != null) {
          upstreamSignal.removeEventListener("abort", abortFromUpstream);
        }
      },
    };
  }

  private assertDurationWithinBudget(startedAt: number, maxDurationMs: number): void {
    if (Number.isFinite(maxDurationMs) && maxDurationMs >= 0 && Date.now() - startedAt > maxDurationMs) {
      throw this.createBudgetConstraintError("maxDurationMs", maxDurationMs);
    }
  }

  private estimatePromptTokens(request: LlmModelCallRequest): number {
    const messageChars = request.messages.reduce((total, message) => total + estimateSerializedLength(message.content), 0);
    const systemChars = request.system?.length ?? 0;
    const toolChars = request.tools?.reduce((total, tool) => total + JSON.stringify(tool).length, 0) ?? 0;
    return Math.ceil((messageChars + systemChars + toolChars) / 4);
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

  // R8-01 FIX: Calculate actual cost from token usage after LLM call completes
  private calculateActualCost(totalTokens: number, model: string): number {
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
    return (totalTokens / 1000) * rate;
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

function estimateSerializedLength(value: unknown): number {
  if (typeof value === "string") {
    return value.length;
  }
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + estimateSerializedLength(item), 0);
  }
  if (value != null && typeof value === "object") {
    return JSON.stringify(value).length;
  }
  return 0;
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
