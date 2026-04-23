/**
 * @fileoverview Base Chat Provider - Shared infrastructure for LLM chat providers.
 *
 * Extracts common patterns from anthropic/openai/minimax-chat-service.ts:
 * - parseRetryAfterMs() - Rate-limit header parsing
 * - parseResetAt() - Reset-time header parsing
 * - shouldRetryWithinPool() - Retry eligibility determination
 * - BaseAPIError class - Shared error structure
 * - postWithCredentialFailover() - Credential failover logic
 *
 * Each provider extends this base class and implements:
 * - buildRequest(): Transform provider-agnostic request to provider-specific format
 * - extractContent(): Extract text content from provider response
 * - getRatelimitResetHeaders(): Provider-specific rate-limit header names
 * - getStatusCodesToRetry(): Provider-specific retry-eligible status codes
 */
import { ProviderCredentialPool, type ProviderCredentialSelection } from "./provider-credential-pool.js";
/**
 * Base API Error shared by all providers.
 */
export interface BaseAPIErrorOptions {
    statusCode: number;
    statusText: string;
    message: string;
    type?: string | undefined;
    code?: string | null;
    credentialId?: string | null;
    retryAfterMs?: number | null;
    resetAt?: string | null;
}
export declare class BaseAPIError extends Error {
    readonly statusCode: number;
    readonly statusText: string;
    readonly type: string | null;
    readonly code: string | null;
    readonly credentialId: string | null;
    readonly retryAfterMs: number | null;
    readonly resetAt: string | null;
    constructor(options: BaseAPIErrorOptions);
}
/**
 * Parses retry-after information from response headers.
 * Supports retry-after-ms (milliseconds), retry-after (seconds), and absolute Date values.
 */
export declare function parseRetryAfterMs(headers: Headers): number | null;
/**
 * Parses rate-limit reset time from response headers.
 * Supports ISO date strings and Unix timestamps (seconds or milliseconds).
 */
export declare function parseResetAt(headers: Headers, headerNames: string[]): string | null;
/**
 * Determines whether a HTTP status code is eligible for retry within the credential pool.
 * Covers rate-limit (429), server errors (5xx), and payment-required (402) codes.
 */
export declare function shouldRetryWithinPool(statusCode: number, retryableCodes: number[]): boolean;
/**
 * Shared request options for all chat providers.
 */
export interface BaseChatProviderConfig {
    apiKey?: string;
    baseUrl?: string;
    credentialPool?: ProviderCredentialPool;
    fetchImpl?: typeof fetch;
    providerName: string;
    defaultRetryableCodes?: number[];
    ratelimitResetHeaderNames?: string[];
}
/**
 * Base class for chat completion providers.
 * Handles credential management, retry logic, and failover.
 */
export declare abstract class BaseChatProvider {
    protected readonly baseUrl: string;
    protected readonly credentialPool: ProviderCredentialPool;
    protected readonly fetchImpl: typeof fetch;
    protected readonly providerName: string;
    protected readonly defaultRetryableCodes: number[];
    protected readonly ratelimitResetHeaderNames: string[];
    constructor(config: BaseChatProviderConfig);
    /**
     * Returns the default base URL for this provider.
     */
    protected abstract getDefaultBaseUrl(): string;
    /**
     * Returns the API endpoint path for chat completions.
     */
    protected abstract getChatCompletionPath(): string;
    /**
     * Returns the list of HTTP status codes that should trigger a retry.
     */
    protected getRetryableStatusCodes(): number[];
    /**
     * Returns the header names to check for rate-limit reset time.
     */
    protected getRatelimitResetHeaderNames(): string[];
    /**
     * Builds provider-specific headers for the request.
     * @param apiKey - The API key selected from the credential pool
     */
    protected abstract buildHeaders(apiKey: string): Record<string, string>;
    /**
     * Transforms the provider-agnostic request to provider-specific format.
     */
    protected abstract transformRequest(request: Record<string, unknown>, stream: boolean): Record<string, unknown>;
    /**
     * Creates a provider-specific API error.
     */
    protected abstract createApiError(options: {
        statusCode: number;
        statusText: string;
        message: string;
        errorType?: string;
        errorCode?: string | null;
        credentialId: string | null;
        retryAfterMs: number | null;
        resetAt: string | null;
        errorText: string;
    }): BaseAPIError;
    /**
     * Shared POST logic with credential failover.
     */
    protected postWithCredentialFailover(request: Record<string, unknown>, stream: boolean): Promise<{
        response: Response;
        selection: ProviderCredentialSelection;
    }>;
}
