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
import { AnthropicChatService } from "./anthropic/anthropic-chat-service.js";
import { OpenAIChatService } from "./openai/openai-chat-service.js";
import { MiniMaxChatService } from "./minimax/minimax-chat-service.js";
import { AppError } from "../../contracts/errors.js";
import { CircuitBreaker } from "./circuit-breaker.js";
import { runtimeMetricsRegistry } from "../../shared/observability/runtime-metrics-registry.js";
import { HashEmbeddingProvider, MiniMaxEmbeddingProvider, OpenAIEmbeddingProvider } from "../../state-evidence/knowledge/indexing/embedding-provider.js";
const PROVIDER_FROM_MODEL = {
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
function detectProviderFromModel(modelId) {
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
    config;
    anthropic;
    openai;
    minimax;
    breakers = new Map();
    disposed = false;
    constructor(config) {
        this.config = config;
        if (config.anthropic?.apiKey) {
            const anthropicConfig = { apiKey: config.anthropic.apiKey };
            if (config.anthropic.baseUrl !== undefined) {
                anthropicConfig.baseUrl = config.anthropic.baseUrl;
            }
            this.anthropic = new AnthropicChatService(anthropicConfig);
        }
        else {
            this.anthropic = null;
        }
        if (config.openai?.apiKey) {
            const openaiConfig = { apiKey: config.openai.apiKey };
            if (config.openai.baseUrl !== undefined) {
                openaiConfig.baseUrl = config.openai.baseUrl;
            }
            if (config.openai.organization !== undefined) {
                openaiConfig.organization = config.openai.organization;
            }
            this.openai = new OpenAIChatService(openaiConfig);
        }
        else {
            this.openai = null;
        }
        if (config.minimax?.apiKey) {
            const minimaxConfig = { apiKey: config.minimax.apiKey };
            if (config.minimax.baseUrl !== undefined) {
                minimaxConfig.baseUrl = config.minimax.baseUrl;
            }
            if (config.minimax.region !== undefined) {
                minimaxConfig.region = config.minimax.region;
            }
            this.minimax = new MiniMaxChatService(minimaxConfig);
        }
        else {
            this.minimax = null;
        }
        // Initialize circuit breakers for each provider
        this.breakers.set("anthropic", new CircuitBreaker({ name: "anthropic" }));
        this.breakers.set("openai", new CircuitBreaker({ name: "openai" }));
        this.breakers.set("minimax", new CircuitBreaker({ name: "minimax" }));
    }
    static fromProfile(_profile, config) {
        return new UnifiedChatProvider(config);
    }
    hasProvider(provider) {
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
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.anthropic?.dispose();
        this.openai?.dispose();
        this.minimax?.dispose();
        this.breakers.clear();
    }
    getProviderForModel(modelId) {
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
    async createChatCompletion(request) {
        this.assertNotDisposed();
        const { provider, service } = this.getProviderForModel(request.model);
        const breaker = this.breakers.get(provider);
        const startedAt = Date.now();
        let result;
        switch (provider) {
            case "anthropic": {
                const anthropicService = service;
                const chatResult = breaker
                    ? await breaker.execute(() => anthropicService.createChatCompletion(this.toAnthropicRequest(request)))
                    : await anthropicService.createChatCompletion(this.toAnthropicRequest(request));
                result = this.normalizeAnthropicResult(chatResult, provider);
                break;
            }
            case "openai": {
                const openaiService = service;
                const chatResult = breaker
                    ? await breaker.execute(() => openaiService.createChatCompletion(this.toOpenAIRequest(request)))
                    : await openaiService.createChatCompletion(this.toOpenAIRequest(request));
                result = this.normalizeOpenAIResult(chatResult, provider);
                break;
            }
            case "minimax": {
                const minimaxService = service;
                const chatResult = breaker
                    ? await breaker.execute(() => minimaxService.createChatCompletion(this.toMiniMaxRequest(request)))
                    : await minimaxService.createChatCompletion(this.toMiniMaxRequest(request));
                result = this.normalizeMiniMaxResult(chatResult, provider);
                break;
            }
        }
        const totalSeconds = (Date.now() - startedAt) / 1000;
        runtimeMetricsRegistry.recordLlmLatency(totalSeconds, totalSeconds, result.model, result.provider);
        return result;
    }
    async createStreamingChatCompletion(request, onChunk) {
        this.assertNotDisposed();
        const { provider, service } = this.getProviderForModel(request.model);
        switch (provider) {
            case "anthropic": {
                const anthropicService = service;
                await anthropicService.createStreamingChatCompletion(this.toAnthropicRequest(request), (chunk, isFinal) => {
                    onChunk(this.normalizeAnthropicResult(chunk, provider), isFinal);
                });
                return;
            }
            case "openai": {
                const openaiService = service;
                await openaiService.createStreamingChatCompletion(this.toOpenAIRequest(request), (chunk, isFinal) => {
                    onChunk(this.normalizeOpenAIResult(chunk, provider), isFinal);
                });
                return;
            }
            case "minimax": {
                const minimaxService = service;
                await minimaxService.createStreamingChatCompletion(this.toMiniMaxRequest(request), (chunk) => {
                    onChunk(this.normalizeMiniMaxResult(chunk, provider), false);
                });
                return;
            }
        }
    }
    async complete(prompt, options = {}) {
        const result = await this.createChatCompletion({
            model: options.model ?? "gpt-5.2",
            messages: [{ role: "user", content: prompt }],
            ...(options.system !== undefined ? { system: options.system } : {}),
            ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
            ...(options.topP !== undefined ? { topP: options.topP } : {}),
            maxTokens: options.maxTokens ?? 512,
        });
        return result.content;
    }
    async embed(input, model = "text-embedding-3-small") {
        this.assertNotDisposed();
        const texts = Array.isArray(input) ? [...input] : [input];
        const provider = this.createEmbeddingProvider(model);
        const results = await provider.embedBatch(texts);
        return results.map((result) => [...result.vector]);
    }
    toAnthropicRequest(request) {
        const result = {
            model: request.model,
            messages: request.messages,
            max_tokens: request.maxTokens,
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
            result.tools = request.tools.map((tool) => ({
                type: "function",
                name: tool.name,
                description: (tool.description ?? ""),
                input_schema: tool.parameters,
            }));
        }
        if (request.toolChoice !== undefined) {
            result.tool_choice = request.toolChoice;
        }
        return result;
    }
    toOpenAIRequest(request) {
        const result = {
            model: request.model,
            messages: request.messages,
            max_tokens: request.maxTokens,
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
                type: "function",
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
    toMiniMaxRequest(request) {
        const result = {
            model: request.model,
            messages: request.messages,
            max_tokens: request.maxTokens,
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
                type: "function",
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
    normalizeAnthropicResult(result, provider) {
        return {
            id: result.id,
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
            model: result.model,
            provider,
        };
    }
    normalizeOpenAIResult(result, provider) {
        return {
            id: result.id,
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
            model: result.model,
            provider,
        };
    }
    normalizeMiniMaxResult(result, provider) {
        return {
            id: result.id,
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
            model: result.model ?? "minimax",
            provider,
        };
    }
    createEmbeddingProvider(model) {
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
    assertNotDisposed() {
        if (this.disposed) {
            throw new AppError("provider.disposed", "Unified chat provider has been disposed.", {
                category: "provider",
                source: "provider",
                retryable: false,
            });
        }
    }
}
export function createUnifiedChatProvider(config) {
    return new UnifiedChatProvider(config ?? {});
}
//# sourceMappingURL=unified-chat-provider.js.map