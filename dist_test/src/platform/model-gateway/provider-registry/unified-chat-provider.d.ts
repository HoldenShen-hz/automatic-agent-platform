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
    content: string;
    refusal: string | null;
    reasoningContent: string | null;
    finishReason: string;
    stopSequence: string | null;
    toolCalls: Array<{
        id: string;
        type: "function";
        function: {
            name: string;
            arguments: string;
        };
    }>;
    usage: ChatCompletionUsage;
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
export declare class UnifiedChatProvider {
    private readonly anthropic;
    private readonly openai;
    private readonly minimax;
    private readonly breakers;
    private disposed;
    constructor(config: UnifiedProviderConfig);
    static fromProfile(_profile: unknown, config: UnifiedProviderConfig): UnifiedChatProvider;
    hasProvider(provider: ChatProviderType): boolean;
    dispose(): void;
    private getProviderForModel;
    createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResult>;
    createStreamingChatCompletion(request: ChatCompletionRequest, onChunk: (chunk: ChatCompletionResult, isFinal: boolean) => void): Promise<void>;
    private toAnthropicRequest;
    private toOpenAIRequest;
    private toMiniMaxRequest;
    private normalizeAnthropicResult;
    private normalizeOpenAIResult;
    private normalizeMiniMaxResult;
    private assertNotDisposed;
}
export declare function createUnifiedChatProvider(config?: UnifiedProviderConfig): UnifiedChatProvider;
