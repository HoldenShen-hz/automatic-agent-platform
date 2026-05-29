import { type MockApiShape } from "./mock-data.js";
import type { RestClientInterceptor, RestClientRequest } from "./interceptors.js";
export interface TransportResponse<T> {
    readonly status: number;
    readonly data: T;
}
export interface RestRequestOptions {
    readonly headers?: Headers;
}
export type RestTransport = <T>(request: RestClientRequest) => Promise<TransportResponse<T>>;
export interface RESTClient {
    get<T>(path: string, options?: RestRequestOptions): Promise<T>;
    post<T>(path: string, body: unknown, options?: RestRequestOptions): Promise<T>;
    put<T>(path: string, body: unknown, options?: RestRequestOptions): Promise<T>;
    patch<T>(path: string, body: unknown, options?: RestRequestOptions): Promise<T>;
    delete<T>(path: string, options?: RestRequestOptions): Promise<T>;
}
export interface HttpTransportOptions {
    readonly baseUrl: string;
    readonly acceptVersion?: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly fetchImplementation?: typeof fetch;
    readonly fallbackToMock?: boolean;
    readonly credentials?: RequestCredentials;
    readonly mode?: RequestMode;
    readonly timeoutMs?: number;
}
export declare const DEFAULT_ACCEPT_VERSION_HEADER = "2026-04-01,2026-01-01";
export type RestHttpUiAction = "redirect_to_login" | "access_denied" | "backoff_and_retry" | "version_not_supported" | "none";
export type RestHttpErrorCategory = "network" | "auth" | "validation" | "business" | "contract";
export declare class RestHttpError extends Error {
    readonly status: number;
    readonly uiAction: RestHttpUiAction;
    readonly retryAfterMs: number | null;
    readonly category: RestHttpErrorCategory;
    readonly statusCode: number;
    readonly isRetryable: boolean;
    readonly code: string | null;
    constructor(status: number, retryAfterMs?: number | null, details?: {
        message?: string;
        code?: string | null;
    });
}
export declare class MockTransport {
    private readonly data;
    constructor(data?: MockApiShape);
    send<T>(request: RestClientRequest): Promise<TransportResponse<T>>;
    private resolveStatus;
    private resolve;
}
export declare class HttpTransport {
    private readonly options;
    private readonly fetchImplementation;
    private readonly fallbackTransport;
    private readonly retryConfig;
    private readonly circuitBreaker;
    constructor(options: HttpTransportOptions);
    private shouldRetry;
    private sleep;
    private calculateBackoff;
    private recordFailure;
    private recordSuccess;
    private canAttempt;
    private parseResponse;
    private isRetryAllowed;
    private resolveRequestUrl;
    send<T>(request: RestClientRequest): Promise<TransportResponse<T>>;
    private readErrorDetails;
    private wrapRequestBody;
}
export declare class DefaultRESTClient implements RESTClient {
    private readonly transport;
    private readonly interceptors;
    constructor(transport?: RestTransport, interceptors?: readonly RestClientInterceptor[]);
    get<T>(path: string, options?: RestRequestOptions): Promise<T>;
    post<T>(path: string, body: unknown, options?: RestRequestOptions): Promise<T>;
    put<T>(path: string, body: unknown, options?: RestRequestOptions): Promise<T>;
    patch<T>(path: string, body: unknown, options?: RestRequestOptions): Promise<T>;
    delete<T>(path: string, options?: RestRequestOptions): Promise<T>;
    private request;
}
export declare function createRuntimeRESTClient(options?: Partial<HttpTransportOptions>): RESTClient;
export declare function createRESTClient(options?: Partial<HttpTransportOptions>): RESTClient;
