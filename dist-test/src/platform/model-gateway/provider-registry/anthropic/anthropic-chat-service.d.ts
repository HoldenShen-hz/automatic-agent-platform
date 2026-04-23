/**
 * @fileoverview Anthropic Chat Service - Chat completion for Claude models
 *
 * ## Overview
 *
 * Provides chat completion functionality using Anthropic's Claude models.
 * Supports Claude 4 (opus, sonnet, haiku) series.
 *
 * ## API Documentation
 *
 * @see {@link https://docs.anthropic.com/claude/reference | Anthropic API Documentation}
 *
 * ## Supported Models
 *
 * - Claude Opus 4: Best quality for complex tasks
 * - Claude Sonnet 4: Balanced performance
 * - Claude Haiku 3.5: Fast, efficient for classification/summarization
 */
import { ProviderCredentialPool, type ProviderCredentialEnvLoadOptions } from "../provider-credential-pool.js";
export interface AnthropicMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
export interface AnthropicTool {
    type: "function";
    name: string;
    description?: string;
    input_schema: Record<string, unknown>;
}
export interface AnthropicChatCompletionRequest {
    model: string;
    messages: AnthropicMessage[];
    system?: string;
    temperature?: number;
    top_p?: number;
    max_tokens: number;
    stream?: boolean;
    tools?: AnthropicTool[];
    tool_choice?: "auto" | "none";
}
export interface AnthropicUsage {
    input_tokens: number;
    output_tokens: number;
}
export interface AnthropicChatCompletionChoice {
    message: {
        role: "assistant";
        content: string;
        refusal?: string | null;
    };
    stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use";
    stop_sequence?: string | null;
}
export interface AnthropicChatCompletionResponse {
    id: string;
    type: "message";
    role: "assistant";
    content: Array<{
        type: "text" | "tool_use" | "tool_result" | "refusal";
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
        tool_use_id?: string;
    }>;
    model: string;
    stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use";
    stop_sequence?: string | null;
    usage: AnthropicUsage;
}
export interface AnthropicChatCompletionResult {
    id: string;
    content: string;
    refusal: string | null;
    stopReason: string;
    stopSequence: string | null;
    usage: AnthropicUsage;
    model: string;
    rawResponse: AnthropicChatCompletionResponse;
}
export interface AnthropicProviderConfig {
    apiKey?: string;
    baseUrl?: string;
    credentialPool?: ProviderCredentialPool;
    fetchImpl?: typeof fetch;
}
export interface AnthropicEnvironmentConfig {
    providerEnv?: NodeJS.ProcessEnv;
    secretResolver?: ProviderCredentialEnvLoadOptions["secretResolver"];
    secretLeaseIssuer?: ProviderCredentialEnvLoadOptions["secretLeaseIssuer"];
    secretLeaseRevoker?: ProviderCredentialEnvLoadOptions["secretLeaseRevoker"];
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    defaultCooldownMs?: number;
}
export interface AnthropicAPIErrorOptions {
    statusCode: number;
    statusText: string;
    message: string;
    type?: string | undefined;
    credentialId?: string | null;
    retryAfterMs?: number | null;
    resetAt?: string | null;
}
export declare class AnthropicAPIError extends Error {
    readonly statusCode: number;
    readonly statusText: string;
    readonly type: string | null;
    readonly credentialId: string | null;
    readonly retryAfterMs: number | null;
    readonly resetAt: string | null;
    constructor(options: AnthropicAPIErrorOptions);
}
export declare class AnthropicChatService {
    private readonly baseUrl;
    private readonly credentialPool;
    private readonly ownsCredentialPool;
    private readonly fetchImpl;
    private disposed;
    constructor(config: AnthropicProviderConfig);
    dispose(): void;
    private postWithCredentialFailover;
    private transformToAnthropicRequest;
    private extractContent;
    private extractRefusal;
    createChatCompletion(request: AnthropicChatCompletionRequest): Promise<AnthropicChatCompletionResult>;
    createStreamingChatCompletion(request: AnthropicChatCompletionRequest, onChunk: (chunk: AnthropicChatCompletionResult, isFinal: boolean) => void): Promise<void>;
    private assertNotDisposed;
}
export declare function createAnthropicChatService(apiKey: string, baseUrl?: string): AnthropicChatService;
export declare function createAnthropicChatServiceFromEnvironment(config?: AnthropicEnvironmentConfig): AnthropicChatService;
