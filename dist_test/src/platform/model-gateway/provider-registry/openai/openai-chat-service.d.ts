/**
 * @fileoverview OpenAI Chat Service - Chat completion for GPT models
 *
 * ## Overview
 *
 * Provides chat completion functionality using OpenAI's GPT models.
 * Supports GPT-4o, GPT-4, GPT-3.5 Turbo series.
 *
 * ## API Documentation
 *
 * @see {@link https://platform.openai.com/docs/api-reference/chat | OpenAI API Documentation}
 *
 * ## Supported Models
 *
 * - GPT-4o: Latest flagship model with vision and function calling
 * - GPT-4 Turbo: High intelligence, faster than GPT-4
 * - GPT-3.5 Turbo: Fast and cost-effective
 */
import { ProviderCredentialPool, type ProviderCredentialEnvLoadOptions } from "../provider-credential-pool.js";
export interface OpenAIMessage {
    role: "system" | "user" | "assistant";
    content: string;
    name?: string;
}
export interface OpenAIFunction {
    type: "function";
    function: {
        name: string;
        description?: string;
        parameters: Record<string, unknown>;
    };
}
export interface OpenAIChatCompletionRequest {
    model: string;
    messages: OpenAIMessage[];
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    stream?: boolean;
    tools?: OpenAIFunction[];
    tool_choice?: "auto" | "none" | {
        type: "function";
        function: {
            name: string;
        };
    };
    response_format?: {
        type: "text" | "json_object";
    };
}
export interface OpenAIUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}
export interface OpenAIChatCompletionChoice {
    message?: {
        role: "assistant";
        content: string | null;
        tool_calls?: Array<{
            id: string;
            type: "function";
            function: {
                name: string;
                arguments: string;
            };
        }>;
        refusal?: string | null;
    };
    delta?: {
        role?: "assistant";
        content: string | null;
        tool_calls?: Array<{
            id: string;
            type: "function";
            function: {
                name: string;
                arguments: string;
            };
        }>;
        refusal?: string | null;
    };
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "refusal" | null;
    index: number;
}
export interface OpenAIChatCompletionResponse {
    id: string;
    object: "chat.completion" | "chat.completion.chunk";
    created: number;
    model: string;
    system_fingerprint?: string;
    choices: OpenAIChatCompletionChoice[];
    usage: OpenAIUsage;
}
export interface OpenAIFunctionCallResult {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}
export interface OpenAIChatCompletionResult {
    id: string;
    content: string | null;
    refusal: string | null;
    finishReason: string;
    toolCalls: OpenAIFunctionCallResult[];
    usage: OpenAIUsage;
    model: string;
    rawResponse: OpenAIChatCompletionResponse;
}
export interface OpenAIProviderConfig {
    apiKey?: string;
    baseUrl?: string;
    organization?: string;
    credentialPool?: ProviderCredentialPool;
    fetchImpl?: typeof fetch;
}
export interface OpenAIEnvironmentConfig {
    providerEnv?: NodeJS.ProcessEnv;
    secretResolver?: ProviderCredentialEnvLoadOptions["secretResolver"];
    secretLeaseIssuer?: ProviderCredentialEnvLoadOptions["secretLeaseIssuer"];
    secretLeaseRevoker?: ProviderCredentialEnvLoadOptions["secretLeaseRevoker"];
    baseUrl?: string;
    organization?: string;
    fetchImpl?: typeof fetch;
    defaultCooldownMs?: number;
}
export interface OpenAIAPIErrorOptions {
    statusCode: number;
    statusText: string;
    message: string;
    type?: string | undefined;
    code?: string | null;
    credentialId?: string | null;
    retryAfterMs?: number | null;
    resetAt?: string | null;
}
export declare class OpenAIAPIError extends Error {
    readonly statusCode: number;
    readonly statusText: string;
    readonly type: string | null;
    readonly code: string | null;
    readonly credentialId: string | null;
    readonly retryAfterMs: number | null;
    readonly resetAt: string | null;
    constructor(options: OpenAIAPIErrorOptions);
}
export declare class OpenAIChatService {
    private readonly baseUrl;
    private readonly organization;
    private readonly credentialPool;
    private readonly ownsCredentialPool;
    private readonly fetchImpl;
    private disposed;
    constructor(config: OpenAIProviderConfig);
    dispose(): void;
    private postWithCredentialFailover;
    private extractContent;
    private extractRefusal;
    private extractToolCalls;
    createChatCompletion(request: OpenAIChatCompletionRequest): Promise<OpenAIChatCompletionResult>;
    createStreamingChatCompletion(request: OpenAIChatCompletionRequest, onChunk: (chunk: OpenAIChatCompletionResult, isFinal: boolean) => void): Promise<void>;
    private assertNotDisposed;
}
export declare function createOpenAIChatService(apiKey: string, options?: {
    baseUrl?: string;
    organization?: string;
}): OpenAIChatService;
export declare function createOpenAIChatServiceFromEnvironment(config?: OpenAIEnvironmentConfig): OpenAIChatService;
