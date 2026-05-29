import type { OfflineQueue } from "@aa/shared-sync";
export interface RestClientRequest {
    readonly path: string;
    readonly method: string;
    readonly headers: Headers;
    readonly body?: unknown;
}
export interface RestClientResponse<T> {
    readonly status: number;
    readonly data: T;
}
export interface RestClientInterceptor {
    onRequest?(request: RestClientRequest): Promise<RestClientRequest> | RestClientRequest;
    onResponse?<T>(response: RestClientResponse<T>): Promise<RestClientResponse<T>> | RestClientResponse<T>;
    intercept?<T>(request: RestClientRequest, next: (request: RestClientRequest) => Promise<RestClientResponse<T>>): Promise<RestClientResponse<T>>;
}
export interface TokenResolver {
    getAccessToken?(): string | null;
    getAccessTokenWithRefresh?(): Promise<unknown>;
    getToken?(): string | null;
    shouldRefresh?(now?: number): boolean;
    handleUnauthorized?(): Promise<void> | void;
}
export declare class OfflineQueueRequestQueuedError extends Error {
    constructor();
}
export declare class DynamicTokenRequiredError extends Error {
    constructor();
}
export declare const DEFAULT_ACCEPT_VERSIONS: readonly ["2026-04-01", "2026-01-01"];
export declare function createTraceInterceptor(): RestClientInterceptor;
export declare function createContractVersionInterceptor(versions?: readonly string[]): RestClientInterceptor;
export declare function createAuthInterceptor(token: string | null | TokenResolver): RestClientInterceptor;
export declare function createTenantInterceptor(tenantId: string | null): RestClientInterceptor;
export declare function createCsrfInterceptor(explicitToken?: string | null): RestClientInterceptor;
export interface OfflineQueueRequest extends RestClientRequest {
    readonly queuedAt: string;
    readonly queueId: string;
}
export declare function createOfflineQueueInterceptor(queue: OfflineQueue): RestClientInterceptor;
export declare function createIdempotencyKeyInterceptor(): RestClientInterceptor;
export interface RetryInterceptorOptions {
    readonly maxRetries?: number;
    readonly baseDelayMs?: number;
}
export declare function createRetryInterceptor(options?: RetryInterceptorOptions): RestClientInterceptor;
export interface DedupeInterceptorOptions {
    readonly methods?: readonly RestClientRequest["method"][];
}
export declare function createDedupeInterceptor(options?: DedupeInterceptorOptions): RestClientInterceptor;
