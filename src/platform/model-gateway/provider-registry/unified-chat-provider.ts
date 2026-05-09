/**
 * @fileoverview Unified Chat Provider - Single interface for all LLM providers
 *
 * Provides a unified interface that abstracts over Anthropic, OpenAI, and MiniMax
 * chat services, selecting the appropriate provider based on the model profile.
 *
 * ## Supported Providers
 *
 * - `anthropic`: Claude models (opus, sonnet, haiku)
 * - `openai`: GPT models (gpt-4o, gpt-4, gpt-3.5-turbo)
 * - `minimax`: MiniMax models (M2.7, M2.7-highspeed, M2, M1, Text-01)
 */

import { AnthropicChatService, type AnthropicTool, type AnthropicChatCompletionResult, type AnthropicChatCompletionRequest } from "./anthropic/anthropic-chat-service.js";
import { OpenAIChatService, type OpenAIFunction, type OpenAIChatCompletionResult, type OpenAIChatCompletionRequest } from "./openai/openai-chat-service.js";
import { MiniMaxChatService, type MiniMaxTool, type MiniMaxChatCompletionResult, type MiniMaxChatCompletionRequest } from "./minimax/minimax-chat-service.js";
import { AppError } from "../../contracts/errors.js";
import { CircuitBreaker } from "./circuit-breaker.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { runtimeMetricsRegistry } from "../../shared/observability/runtime-metrics-registry.js";
import { HashEmbeddingProvider, MiniMaxEmbeddingProvider, OpenAIEmbeddingProvider, type EmbeddingProvider } from "../../state-evidence/knowledge/indexing/embedding-provider.js";
import { DEFAULT_MODEL_METADATA_REGISTRY } from "../../control-plane/config-center/model-metadata-registry.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatTool {
  type: "function";
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export interface ChatCompletionUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatCompletionResult {
  id: string;
  requestId: string;
  content: string;
  refusal: string | null;
  reasoningContent: string | null;
  finishReason: string;
  stopSequence: string | null;
  toolCalls: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  usage: ChatCompletionUsage;
  estimatedCostUsd: number | null;
  latencyMs: number;
  model: string;
  provider: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  system?: string;
  temperature?: number;
  topP?: number;
  maxTokens: number;
  stream?: boolean;
  tools?: ChatTool[];
  toolChoice?: "auto" | "none";
  /** @required - caller must provide traceId for request correlation */
  traceId: string;
  /** @required - caller must provide tenantId for multi-tenant isolation */
  tenantId: string | null;
  /** @required - caller must provide costTag for chargeback attribution */
  costTag: string;
  spanId?: string;
  principalId?: string | null;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  validatePartialChunk?: (chunk: ChatCompletionResult, isFinal: boolean) => void;
  /** Policy outcome for audit logging per §11.1-11.2 */
  policyOutcome?: "approved" | "denied" | "flagged" | null;
}

export interface CompletionOptions {
  model?: string;
  system?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  traceId?: string;
  tenantId?: string | null;
  principalId?: string | null;
  costTag?: string;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  policyOutcome?: "approved" | "denied" | "flagged" | null;
}

export type ChatProviderType = "anthropic" | "openai" | "minimax";

export interface UnifiedProviderConfig {
  anthropic?: {
    apiKey?: string;
    baseUrl?: string;
  };
  openai?: {
    apiKey?: string;
    baseUrl?: string;
    organization?: string;
  };
  minimax?: {
    apiKey?: string;
    baseUrl?: string;
    region?: "china" | "global";
  };
}

const PROVIDER_FROM_MODEL: Record<string, ChatProviderType> = {
  // Anthropic models
  "claude-opus-4-5": "anthropic",
  "claude-opus-3": "anthropic",
  "claude-sonnet-4": "anthropic",
  "claude-sonnet-3-5": "anthropic",
  "claude-sonnet-4-20250514": "anthropic",
  "claude-haiku-3-5": "anthropic",
  "claude-haiku-3": "anthropic",
  "claude-haiku-3-5-20241022": "anthropic",
  // OpenAI models
  "gpt-4o": "openai",
  "gpt-4o-2024-05-13": "openai",
  "gpt-4o-mini": "openai",
  "gpt-4o-mini-2024-07-18": "openai",
  "gpt-4-turbo": "openai",
  "gpt-4-turbo-2024-04-09": "openai",
  "gpt-4": "openai",
  "gpt-4-32k": "openai",
  "gpt-3.5-turbo": "openai",
  "gpt-3.5-turbo-16k": "openai",
  "gpt-5.2": "openai",
  "gpt-5.3-codex": "openai",
  // MiniMax models
  "MiniMax-M2.7": "minimax",
  "MiniMax-M2.7-highspeed": "minimax",
  "MiniMax-M2": "minimax",
  "MiniMax-M1": "minimax",
  "MiniMax-Text-01": "minimax",
};

function detectProviderFromModel(modelId: string): ChatProviderType {
  const modelLower = modelId.toLowerCase();

  if (modelLower.includes("claude")) {
    return "anthropic";
  }
  if (modelLower.includes("gpt") || modelLower.includes("openai")) {
    return "openai";
  }
  if (modelLower.startsWith("minimax")) {
    return "minimax";
  }

  // Default based on known prefixes
  for (const [prefix, provider] of Object.entries(PROVIDER_FROM_MODEL)) {
    if (modelLower.includes(prefix)) {
      return provider;
    }
  }

  // Default to openai for unknown models (most common)
  return "openai";
}

export class UnifiedChatProvider {
  private readonly config: UnifiedProviderConfig;
  private readonly anthropic: AnthropicChatService | null;
  private readonly openai: OpenAIChatService | null;
  private readonly minimax: MiniMaxChatService | null;
  private readonly breakers = new Map<string, CircuitBreaker>();
  private disposed = false;

  public constructor(config: UnifiedProviderConfig) {
    this.config = config;
    if (config.anthropic?.apiKey) {
      const anthropicConfig: { apiKey: string; baseUrl?: string } = { apiKey: config.anthropic.apiKey };
      if (config.anthropic.baseUrl !== undefined) {
        anthropicConfig.baseUrl = config.anthropic.baseUrl;
      }
      this.anthropic = new AnthropicChatService(anthropicConfig);
    } else {
      this.anthropic = null;
    }

    if (config.openai?.apiKey) {
      const openaiConfig: { apiKey: string; baseUrl?: string; organization?: string } = { apiKey: config.openai.apiKey };
      if (config.openai.baseUrl !== undefined) {
        openaiConfig.baseUrl = config.openai.baseUrl;
      }
      if (config.openai.organization !== undefined) {
        openaiConfig.organization = config.openai.organization;
      }
      this.openai = new OpenAIChatService(openaiConfig);
    } else {
      this.openai = null;
    }

    if (config.minimax?.apiKey) {
      const minimaxConfig: { apiKey: string; baseUrl?: string; region?: "china" | "global" } = { apiKey: config.minimax.apiKey };
      if (config.minimax.baseUrl !== undefined) {
        minimaxConfig.baseUrl = config.minimax.baseUrl;
      }
      if (config.minimax.region !== undefined) {
        minimaxConfig.region = config.minimax.region;
      }
      this.minimax = new MiniMaxChatService(minimaxConfig);
    } else {
      this.minimax = null;
    }

    // Initialize circuit breakers for each provider
    this.breakers.set("anthropic", new CircuitBreaker({ name: "anthropic" }));
    this.breakers.set("openai", new CircuitBreaker({ name: "openai" }));
    this.breakers.set("minimax", new CircuitBreaker({ name: "minimax" }));
  }

  public static fromProfile(_profile: unknown, config: UnifiedProviderConfig): UnifiedChatProvider {
    return new UnifiedChatProvider(config);
  }

  public hasProvider(provider: ChatProviderType): boolean {
    if (this.disposed) {
      return false;
    }
    switch (provider) {
      case "anthropic":
        return this.anthropic !== null;
      case "openai":
        return this.openai !== null;
      case "minimax":
        return this.minimax !== null;
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.anthropic?.dispose();
    this.openai?.dispose();
    this.minimax?.dispose();
    this.breakers.clear();
  }

  private getProviderForModel(modelId: string): { provider: ChatProviderType; service: AnthropicChatService | OpenAIChatService | MiniMaxChatService } {
    const detectedProvider = detectProviderFromModel(modelId);

    switch (detectedProvider) {
      case "anthropic":
        if (!this.anthropic) {
          throw new AppError("provider.not_configured", "Anthropic provider is not configured. Ensure the required API credentials are set.", { category: "provider", source: "provider", retryable: false });
        }
        return { provider: "anthropic", service: this.anthropic };
      case "openai":
        if (!this.openai) {
          throw new AppError("provider.not_configured", "OpenAI provider is not configured. Ensure the required API credentials are set.", { category: "provider", source: "provider", retryable: false });
        }
        return { provider: "openai", service: this.openai };
      case "minimax":
        if (!this.minimax) {
          throw new AppError("provider.not_configured", "MiniMax provider is not configured. Ensure the required API credentials are set.", { category: "provider", source: "provider", retryable: false });
        }
        return { provider: "minimax", service: this.minimax };
    }
  }

  public async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    this.assertNotDisposed();
    this.assertNotAborted(request.abortSignal);
    const { provider, service } = this.getProviderForModel(request.model);
    const breaker = this.breakers.get(provider);
    const startedAt = Date.now();
    const runtimeSignal = this.buildRuntimeSignal(request.abortSignal, request.timeoutMs);
    const runtimeRequest = runtimeSignal === request.abortSignal || runtimeSignal === undefined
      ? request
      : { ...request, abortSignal: runtimeSignal };

    // Audit logging per §11.1-11.2: log principal/tenantId/policyOutcome for all LLM calls
    const logger_1 = new StructuredLogger({ retentionLimit: 100 });
    logger_1.info("llm:request_started", {
      model: request.model,
      provider,
      tenantId: request.tenantId,
      principalId: request.principalId,
      policyOutcome: request.policyOutcome,
      traceId: request.traceId,
      spanId: request.spanId,
    });

    let result: ChatCompletionResult;
    switch (provider) {
      case "anthropic": {
        const anthropicService = service as AnthropicChatService;
        const chatResult = breaker
          ? await breaker.execute(() => anthropicService.createChatCompletion(this.toAnthropicRequest(runtimeRequest)))
          : await anthropicService.createChatCompletion(this.toAnthropicRequest(runtimeRequest));
        result = this.normalizeAnthropicResult(chatResult, provider, request.model, Date.now() - startedAt);
        break;
      }
      case "openai": {
        const openaiService = service as OpenAIChatService;
        const chatResult = breaker
          ? await breaker.execute(() => openaiService.createChatCompletion(this.toOpenAIRequest(runtimeRequest)))
          : await openaiService.createChatCompletion(this.toOpenAIRequest(runtimeRequest));
        result = this.normalizeOpenAIResult(chatResult, provider, request.model, Date.now() - startedAt);
        break;
      }
      case "minimax": {
        const minimaxService = service as MiniMaxChatService;
        const chatResult = breaker
          ? await breaker.execute(() => minimaxService.createChatCompletion(this.toMiniMaxRequest(runtimeRequest)))
          : await minimaxService.createChatCompletion(this.toMiniMaxRequest(runtimeRequest));
        result = this.normalizeMiniMaxResult(chatResult, provider, request.model, Date.now() - startedAt);
        break;
      }
    }

    const totalSeconds = (Date.now() - startedAt) / 1000;
    runtimeMetricsRegistry.recordLlmLatency(totalSeconds, totalSeconds, result.model, result.provider);
    return result;
  }

  public async chat(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    return this.createChatCompletion(request);
  }

  public async createStreamingChatCompletion(
    request: ChatCompletionRequest,
    onChunk: (chunk: ChatCompletionResult, isFinal: boolean) => void,
    options?: {
      /** Enable incremental budget deduction tracking during streaming */
      enableIncrementalBudgetDeduction?: boolean;
      /** Called to validate and record partial response chunks */
      onPartialChunk?: (chunk: ChatCompletionResult) => { allowed: boolean; deductAmount?: number };
    },
  ): Promise<void> {
    this.assertNotDisposed();
    this.assertNotAborted(request.abortSignal);
    const { provider, service } = this.getProviderForModel(request.model);
    const breaker = this.breakers.get(provider);
    const startedAt = Date.now();
    let firstChunkLatencyMs: number | null = null;
    let metricsRecorded = false;
    let totalTokensSeen = 0;
    const runtimeSignal = this.buildRuntimeSignal(request.abortSignal, request.timeoutMs);
    const runtimeRequest = runtimeSignal === request.abortSignal || runtimeSignal === undefined
      ? request
      : { ...request, abortSignal: runtimeSignal };

    // R2-2: Validate abort signal at stream start to fail fast
    this.assertNotAborted(runtimeSignal);

    const recordStreamingLatency = (model: string): void => {
      if (metricsRecorded) {
        return;
      }
      metricsRecorded = true;
      runtimeMetricsRegistry.recordLlmLatency(
        // @ts-ignore null handling
        firstChunkLatencyMs != null ? firstChunkLatencyMs / 1000 : null,
        (Date.now() - startedAt) / 1000,
        model,
        provider,
      );
    };

    switch (provider) {
      case "anthropic": {
        const anthropicService = service as AnthropicChatService;
        const runStreaming = () => anthropicService.createStreamingChatCompletion(
          this.toAnthropicRequest(runtimeRequest),
          (chunk, isFinal) => {
            firstChunkLatencyMs ??= Date.now() - startedAt;
            const normalized = this.normalizeAnthropicResult(chunk, provider, request.model, 0);

            // R2-2: Validate partial response if callback provided
            if (options?.onPartialChunk) {
              const validation = options.onPartialChunk(normalized);
              if (!validation.allowed) {
                throw new Error("streaming.partial_response_validation_failed");
              }
              // R2-2: Incremental budget deduction for streaming
              if (options?.enableIncrementalBudgetDeduction && validation.deductAmount != null) {
                totalTokensSeen += normalized.usage.completionTokens ?? 0;
              }
            }

            request.validatePartialChunk?.(normalized, isFinal);
            onChunk(normalized, isFinal);
            if (isFinal) {
              recordStreamingLatency(normalized.model);
            }
          },
        );
        if (breaker != null) {
          await breaker.execute(runStreaming);
        } else {
          await runStreaming();
        }
        recordStreamingLatency(request.model);
        return;
      }
      case "openai": {
        const openaiService = service as OpenAIChatService;
        const runStreaming = () => openaiService.createStreamingChatCompletion(
          this.toOpenAIRequest(runtimeRequest),
          (chunk, isFinal) => {
            firstChunkLatencyMs ??= Date.now() - startedAt;
            const normalized = this.normalizeOpenAIResult(chunk, provider, request.model, 0);

            // R2-2: Validate partial response if callback provided
            if (options?.onPartialChunk) {
              const validation = options.onPartialChunk(normalized);
              if (!validation.allowed) {
                throw new Error("streaming.partial_response_validation_failed");
              }
              if (options?.enableIncrementalBudgetDeduction && validation.deductAmount != null) {
                totalTokensSeen += normalized.usage.completionTokens ?? 0;
              }
            }

            request.validatePartialChunk?.(normalized, isFinal);
            onChunk(normalized, isFinal);
            if (isFinal) {
              recordStreamingLatency(normalized.model);
            }
          },
        );
        if (breaker != null) {
          await breaker.execute(runStreaming);
        } else {
          await runStreaming();
        }
        recordStreamingLatency(request.model);
        return;
      }
      case "minimax": {
        const minimaxService = service as MiniMaxChatService;
        const runStreaming = () => minimaxService.createStreamingChatCompletion(
          this.toMiniMaxRequest(runtimeRequest),
          (chunk) => {
            firstChunkLatencyMs ??= Date.now() - startedAt;
            const normalized = this.normalizeMiniMaxResult(chunk, provider, request.model, 0);

            // R2-2: Validate partial response if callback provided
            if (options?.onPartialChunk) {
              const validation = options.onPartialChunk(normalized);
              if (!validation.allowed) {
                throw new Error("streaming.partial_response_validation_failed");
              }
              if (options?.enableIncrementalBudgetDeduction && validation.deductAmount != null) {
                totalTokensSeen += normalized.usage.completionTokens ?? 0;
              }
            }

            request.validatePartialChunk?.(normalized, false);
            onChunk(normalized, false);
            recordStreamingLatency(normalized.model);
          },
        );
        if (breaker != null) {
          await breaker.execute(runStreaming);
        } else {
          await runStreaming();
        }
        recordStreamingLatency(request.model);
        return;
      }
    }
  }

  public async streamChat(
    request: ChatCompletionRequest,
    onChunk: (chunk: ChatCompletionResult, isFinal: boolean) => void,
    options?: Parameters<UnifiedChatProvider["createStreamingChatCompletion"]>[2],
  ): Promise<void> {
    await this.createStreamingChatCompletion(request, onChunk, options);
  }

  public async complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
    const result = await this.createChatCompletion({
      model: options.model ?? "MiniMax-M2.7",
      messages: [{ role: "user", content: prompt }],
      ...(options.system !== undefined ? { system: options.system } : {}),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.topP !== undefined ? { topP: options.topP } : {}),
      ...(options.traceId !== undefined ? { traceId: options.traceId } : {}),
      ...(options.tenantId !== undefined ? { tenantId: options.tenantId } : {}),
      ...(options.principalId !== undefined ? { principalId: options.principalId } : {}),
      ...(options.costTag !== undefined ? { costTag: options.costTag } : {}),
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.abortSignal !== undefined ? { abortSignal: options.abortSignal } : {}),
      ...(options.policyOutcome !== undefined ? { policyOutcome: options.policyOutcome } : {}),
      maxTokens: options.maxTokens ?? 512,
    });
    return result.content;
  }

  public async embed(input: string | readonly string[], model = "text-embedding-3-small"): Promise<number[][]> {
    this.assertNotDisposed();
    const texts = Array.isArray(input) ? [...input] : [input];
    const provider = this.createEmbeddingProvider(model);
    const results = await provider.embedBatch(texts);
    return results.map((result) => [...result.vector]);
  }

  private toAnthropicRequest(request: ChatCompletionRequest): AnthropicChatCompletionRequest {
    const result: AnthropicChatCompletionRequest = {
      model: request.model,
      messages: request.messages as AnthropicChatCompletionRequest["messages"],
      max_tokens: request.maxTokens,
      ...(request.abortSignal !== undefined ? { signal: request.abortSignal } : {}),
    };
    if (request.system !== undefined) {
      result.system = request.system;
    }
    if (request.temperature !== undefined) {
      result.temperature = request.temperature;
    }
    if (request.topP !== undefined) {
      result.top_p = request.topP;
    }
    if (request.stream !== undefined) {
      result.stream = request.stream;
    }
    if (request.tools !== undefined) {
      result.tools = request.tools.map((tool): AnthropicTool => ({
        type: "function",
        name: tool.name,
        description: (tool.description ?? "") as string,
        input_schema: tool.parameters,
      }));
    }
    if (request.toolChoice !== undefined) {
      result.tool_choice = request.toolChoice;
    }
    return result;
  }

  private toOpenAIRequest(request: ChatCompletionRequest): OpenAIChatCompletionRequest {
    const result: OpenAIChatCompletionRequest = {
      model: request.model,
      messages: request.messages as OpenAIChatCompletionRequest["messages"],
      max_tokens: request.maxTokens,
      ...(request.abortSignal !== undefined ? { signal: request.abortSignal } : {}),
    };
    if (request.temperature !== undefined) {
      result.temperature = request.temperature;
    }
    if (request.topP !== undefined) {
      result.top_p = request.topP;
    }
    if (request.stream !== undefined) {
      result.stream = request.stream;
    }
    if (request.tools !== undefined) {
      result.tools = request.tools.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description ?? "",
          parameters: tool.parameters,
        },
      }));
    }
    if (request.toolChoice !== undefined) {
      result.tool_choice = request.toolChoice;
    }
    return result;
  }

  private toMiniMaxRequest(request: ChatCompletionRequest): MiniMaxChatCompletionRequest {
    const result: MiniMaxChatCompletionRequest = {
      model: request.model,
      messages: request.messages as MiniMaxChatCompletionRequest["messages"],
      max_tokens: request.maxTokens,
      ...(request.abortSignal !== undefined ? { signal: request.abortSignal } : {}),
    };
    if (request.temperature !== undefined) {
      result.temperature = request.temperature;
    }
    if (request.topP !== undefined) {
      result.top_p = request.topP;
    }
    if (request.stream !== undefined) {
      result.stream = request.stream;
    }
    if (request.tools !== undefined) {
      result.tools = request.tools.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description ?? "",
          parameters: tool.parameters,
        },
      }));
    }
    if (request.toolChoice !== undefined) {
      result.tool_choice = request.toolChoice;
    }
    return result;
  }

  public getAvailableProfiles() {
    return Object.entries(DEFAULT_MODEL_METADATA_REGISTRY.profiles)
      .filter(([, profile]) => this.hasProvider(profile.provider as ChatProviderType))
      .map(([profileName, profile]) => ({
        profileName,
        provider: profile.provider,
        tier: profile.tier,
        healthy: true,
        inputCostPer1kUsd: profile.pricing.inputPer1kUsd,
      }));
  }

  private normalizeAnthropicResult(
    result: AnthropicChatCompletionResult,
    provider: ChatProviderType,
    requestedModel: string,
    latencyMs: number,
  ): ChatCompletionResult {
    return {
      id: result.id,
      requestId: result.id,
      content: result.content,
      refusal: result.refusal,
      reasoningContent: null,
      finishReason: result.stopReason,
      stopSequence: result.stopSequence,
      toolCalls: [],
      usage: {
        promptTokens: result.usage.input_tokens,
        completionTokens: result.usage.output_tokens,
        totalTokens: result.usage.input_tokens + result.usage.output_tokens,
      },
      estimatedCostUsd: this.estimateCostUsd(result.model || requestedModel, {
        promptTokens: result.usage.input_tokens,
        completionTokens: result.usage.output_tokens,
        totalTokens: result.usage.input_tokens + result.usage.output_tokens,
      }),
      latencyMs,
      model: result.model,
      provider,
    };
  }

  private normalizeOpenAIResult(
    result: OpenAIChatCompletionResult,
    provider: ChatProviderType,
    requestedModel: string,
    latencyMs: number,
  ): ChatCompletionResult {
    return {
      id: result.id,
      requestId: result.id,
      content: result.content ?? "",
      refusal: result.refusal,
      reasoningContent: null,
      finishReason: result.finishReason,
      stopSequence: null,
      toolCalls: result.toolCalls.map((tc) => ({
        id: tc.id,
        type: tc.type,
        function: tc.function,
      })),
      usage: {
        promptTokens: result.usage.prompt_tokens,
        completionTokens: result.usage.completion_tokens,
        totalTokens: result.usage.total_tokens,
      },
      estimatedCostUsd: this.estimateCostUsd(result.model || requestedModel, {
        promptTokens: result.usage.prompt_tokens,
        completionTokens: result.usage.completion_tokens,
        totalTokens: result.usage.total_tokens,
      }),
      latencyMs,
      model: result.model,
      provider,
    };
  }

  private normalizeMiniMaxResult(
    result: MiniMaxChatCompletionResult,
    provider: ChatProviderType,
    requestedModel: string,
    latencyMs: number,
  ): ChatCompletionResult {
    return {
      id: result.id,
      requestId: result.id,
      content: result.content,
      refusal: null,
      reasoningContent: result.reasoningContent,
      finishReason: result.finishReason,
      stopSequence: null,
      toolCalls: [],
      usage: {
        promptTokens: result.usage.prompt_tokens ?? 0,
        completionTokens: result.usage.completion_tokens ?? 0,
        totalTokens: result.usage.total_tokens ?? 0,
      },
      estimatedCostUsd: this.estimateCostUsd(result.model ?? requestedModel, {
        promptTokens: result.usage.prompt_tokens ?? 0,
        completionTokens: result.usage.completion_tokens ?? 0,
        totalTokens: result.usage.total_tokens ?? 0,
      }),
      latencyMs,
      model: result.model ?? requestedModel,
      provider,
    };
  }

  private estimateCostUsd(modelId: string, usage: ChatCompletionUsage): number | null {
    const profile = Object.values(DEFAULT_MODEL_METADATA_REGISTRY.profiles).find((candidate) =>
      candidate.modelId === modelId || candidate.modelId.toLowerCase() === modelId.toLowerCase(),
    );
    if (profile == null) {
      return null;
    }
    return Number((
      (usage.promptTokens / 1000) * profile.pricing.inputPer1kUsd +
      (usage.completionTokens / 1000) * profile.pricing.outputPer1kUsd
    ).toFixed(6));
  }

  private buildRuntimeSignal(signal: AbortSignal | undefined, timeoutMs: number | undefined): AbortSignal | undefined {
    if (timeoutMs == null) {
      return signal;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("provider.request_timeout"));
    }, timeoutMs);
    signal?.addEventListener("abort", () => {
      controller.abort(signal.reason);
    }, { once: true });
    controller.signal.addEventListener("abort", () => {
      clearTimeout(timeout);
    }, { once: true });
    return controller.signal;
  }

  private createEmbeddingProvider(model: string): EmbeddingProvider {
    const normalizedModel = model.toLowerCase();
    if ((normalizedModel.includes("minimax") || normalizedModel.includes("embo")) && this.config.minimax?.apiKey) {
      return new MiniMaxEmbeddingProvider({
        apiKey: this.config.minimax.apiKey,
        ...(this.config.minimax.baseUrl !== undefined ? { baseUrl: this.config.minimax.baseUrl } : {}),
      });
    }
    if ((normalizedModel.includes("text-embedding") || normalizedModel.includes("openai") || normalizedModel.includes("embedding")) && this.config.openai?.apiKey) {
      return new OpenAIEmbeddingProvider({
        apiKey: this.config.openai.apiKey,
        ...(this.config.openai.baseUrl !== undefined ? { baseUrl: this.config.openai.baseUrl } : {}),
        model,
      });
    }
    return new HashEmbeddingProvider();
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new AppError("provider.disposed", "Unified chat provider has been disposed.", {
        category: "provider",
        source: "provider",
        retryable: false,
      });
    }
  }

  private assertNotAborted(signal: AbortSignal | undefined): void {
    if (signal?.aborted) {
      throw new AppError("provider.request_aborted", "Chat completion request was aborted before execution.", {
        category: "provider",
        source: "provider",
        retryable: false,
      });
    }
  }
}

export function createUnifiedChatProvider(config?: UnifiedProviderConfig): UnifiedChatProvider {
  return new UnifiedChatProvider(config ?? {});
}
