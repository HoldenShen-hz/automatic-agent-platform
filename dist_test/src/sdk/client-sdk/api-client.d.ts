/**
 * @fileoverview Client SDK - Extended API Client
 *
 * Implements §22.1 Client SDK: API client with retry, pagination, and error handling.
 */
export interface ApiClientConfig {
    baseUrl: string;
    apiVersion: string;
    tenantId?: string;
    bearerToken?: string;
    timeoutMs?: number;
    maxRetries?: number;
}
export interface ApiRequestSpec {
    path: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    query?: Record<string, string | number | boolean | null | undefined>;
    body?: unknown;
}
export interface ApiResponse<T> {
    data: T;
    status: number;
    headers: Record<string, string>;
}
export interface PaginationSpec {
    cursor?: string;
    limit?: number;
}
export interface PaginatedResponse<T> {
    data: T[];
    status: number;
    headers: Record<string, string>;
    nextCursor: string | null;
    totalCount?: number;
}
export interface RetryConfig {
    maxRetries: number;
    backoffMs: number;
    backoffMultiplier: number;
    maxBackoffMs: number;
}
/**
 * Build a versioned API URL with query parameters and tenant context.
 */
export declare function buildApiUrl(config: ApiClientConfig, request: ApiRequestSpec): string;
/**
 * Build authorization headers for API requests.
 */
export declare function buildAuthHeaders(config: ApiClientConfig): Record<string, string>;
/**
 * Retry client with exponential backoff for resilient API calls.
 */
export declare class RetryableApiClient {
    private readonly config;
    private readonly retryConfig;
    constructor(config: ApiClientConfig, retryConfig?: RetryConfig);
    /**
     * Make a GET request with automatic retry.
     */
    get<T>(path: string, query?: Record<string, string | number | boolean | null | undefined>): Promise<ApiResponse<T>>;
    /**
     * Make a POST request with automatic retry.
     */
    post<T>(path: string, body: unknown): Promise<ApiResponse<T>>;
    /**
     * Make a PUT request with automatic retry.
     */
    put<T>(path: string, body: unknown): Promise<ApiResponse<T>>;
    /**
     * Make a DELETE request with automatic retry.
     */
    delete<T>(path: string): Promise<ApiResponse<T>>;
    /**
     * Make a paginated request.
     */
    getPaginated<T>(path: string, pagination?: PaginationSpec): Promise<PaginatedResponse<T>>;
    private request;
}
/**
 * Create a retryable API client with configuration.
 */
export declare function createApiClient(config: ApiClientConfig): RetryableApiClient;
/**
 * Parse cursor pagination parameters.
 */
export declare function parseCursor(cursor: string | null | undefined): PaginationSpec | undefined;
/**
 * Encode cursor pagination parameters.
 */
export declare function encodeCursor(pagination: PaginationSpec): string;
