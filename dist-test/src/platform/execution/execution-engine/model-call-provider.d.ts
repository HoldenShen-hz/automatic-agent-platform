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
import { type WrapModelCallHook } from "./agent-middleware-chain.js";
import { type UnifiedProviderConfig, type ChatMessage } from "../../model-gateway/provider-registry/unified-chat-provider.js";
import { type DistributedRateLimiterLike } from "./call-governance.js";
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
export interface LlmModelCallRequest {
    model: string;
    messages: ChatMessage[];
    system?: string;
    temperature?: number;
    maxTokens: number;
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
        function: {
            name: string;
            arguments: string;
        };
    }>;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model: string;
    provider: string;
}
export declare class ModelCallProviderService {
    private readonly unifiedProvider;
    private readonly defaultModel;
    private readonly callGovernance;
    private disposed;
    constructor(config: ModelCallProviderConfig);
    dispose(): void;
    getDefaultModel(): string;
    hasAnthropic(): boolean;
    hasOpenAI(): boolean;
    hasMinimax(): boolean;
    hasAnyProvider(): boolean;
    createCompletion(request: LlmModelCallRequest): Promise<LlmModelCallResult>;
    createStreamingCompletion(request: LlmModelCallRequest, onChunk: (chunk: LlmModelCallResult, isFinal: boolean) => void): Promise<void>;
    createMiddlewareHook(): WrapModelCallHook;
    private normalizeResult;
    private executeGovernedCompletion;
    private toGovernanceError;
}
export declare function initializeModelCallProvider(config: ModelCallProviderConfig): ModelCallProviderService;
export declare function getModelCallProvider(): ModelCallProviderService | null;
export declare function resetModelCallProvider(): void;
export declare function createModelCallMiddleware(config: ModelCallProviderConfig): WrapModelCallHook;
