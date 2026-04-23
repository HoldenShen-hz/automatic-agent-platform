/**
 * @fileoverview MiniMax Chat Service - Chat completion for MiniMax AI models
 *
 * ## Overview
 *
 * Provides chat completion functionality using MiniMax's AI models.
 * Supports MiniMax-M2 (reasoning), MiniMax-M1 (reasoning), and MiniMax-Text-01 (standard).
 *
 * ## API Documentation
 *
 * @see {@link https://platform.minimax.io/docs | MiniMax Platform Documentation}
 *
 * ## Supported Models
 *
 * - `MiniMax-M2`: Reasoning model (best quality)
 * - `MiniMax-M1`: Reasoning model (balanced)
 * - `MiniMax-Text-01`: Standard model (fastest)
 *
 * ## Region Support
 *
 * - China: `https://api.minimax.io/v1/text/chatcompletion_v2`
 * - Global: `https://api.minimaxi.com/v1/text/chatcompletion_v2`
 */
import { ProviderCredentialPool, type ProviderCredentialEnvLoadOptions } from "../provider-credential-pool.js";
export interface MiniMaxMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
export interface MiniMaxChatCompletionRequest {
    model: string;
    messages: MiniMaxMessage[];
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    stream?: boolean;
    tools?: MiniMaxTool[];
    tool_choice?: "auto" | "none";
}
export interface MiniMaxTool {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}
export interface MiniMaxUsage {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
}
export interface MiniMaxChatCompletionResponse {
    id: string;
    choices: Array<{
        message: {
            role: "assistant";
            content: string;
            reasoning_content?: string;
        };
        finish_reason: string;
    }>;
    usage: MiniMaxUsage;
    model?: string;
    created?: number;
    base_resp?: {
        status_code?: number;
        status_msg?: string;
    };
}
export interface MiniMaxChatCompletionResult {
    id: string;
    content: string;
    reasoningContent: string | null;
    finishReason: string;
    usage: MiniMaxUsage;
    model: string;
}
export interface MiniMaxProviderConfig {
    apiKey?: string;
    region?: "china" | "global" | undefined;
    baseUrl?: string | undefined;
    credentialPool?: ProviderCredentialPool;
    fetchImpl?: typeof fetch;
}
export interface MiniMaxEnvironmentConfig {
    providerEnv?: NodeJS.ProcessEnv;
    secretResolver?: ProviderCredentialEnvLoadOptions["secretResolver"];
    secretLeaseIssuer?: ProviderCredentialEnvLoadOptions["secretLeaseIssuer"];
    secretLeaseRevoker?: ProviderCredentialEnvLoadOptions["secretLeaseRevoker"];
    region?: "china" | "global";
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    defaultCooldownMs?: number;
}
export interface MiniMaxAPIErrorOptions {
    statusCode: number;
    statusText: string;
    message: string;
    credentialId?: string | null;
    retryAfterMs?: number | null;
    resetAt?: string | null;
}
export declare class MiniMaxAPIError extends Error {
    readonly statusCode: number;
    readonly statusText: string;
    readonly credentialId: string | null;
    readonly retryAfterMs: number | null;
    readonly resetAt: string | null;
    constructor(options: MiniMaxAPIErrorOptions);
}
export declare class MiniMaxChatService {
    private readonly baseUrl;
    private readonly credentialPool;
    private readonly ownsCredentialPool;
    private readonly fetchImpl;
    private disposed;
    constructor(config: MiniMaxProviderConfig);
    dispose(): void;
    private postWithCredentialFailover;
    createChatCompletion(request: MiniMaxChatCompletionRequest): Promise<MiniMaxChatCompletionResult>;
    createStreamingChatCompletion(request: MiniMaxChatCompletionRequest, onChunk: (chunk: MiniMaxChatCompletionResult) => void): Promise<void>;
    private assertNotDisposed;
}
export declare function createMiniMaxChatService(apiKey: string, region?: "china" | "global"): MiniMaxChatService;
export declare function createMiniMaxChatServiceFromEnvironment(config?: MiniMaxEnvironmentConfig): MiniMaxChatService;
