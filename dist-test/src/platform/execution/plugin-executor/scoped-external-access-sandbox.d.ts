/**
 * Scoped External Access Sandbox
 *
 * Provides controlled external API access within a container sandbox.
 * Allows outbound HTTP requests only to pre-approved domains with
 * audit logging, response filtering, and per-API rate limiting.
 *
 * Architecture: §11 Security - Fourth Sandbox Layer
 * @see docs_zh/architecture/00-platform-architecture.md §11
 */
export interface ScopedExternalAccessConfig {
    /** List of allowed external domains */
    allowedDomains: readonly string[];
    /** Maximum response body size in bytes */
    maxResponseSizeBytes: number;
    /** Rate limit for each domain (requests per minute) */
    rateLimitPerMinute: number;
    /** Custom headers to strip from responses */
    sensitiveHeaders: readonly string[];
    /** Egress proxy URL (optional) */
    egressProxyUrl?: string;
}
export interface ExternalAccessRequest {
    url: string;
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    headers?: Record<string, string>;
    body?: unknown;
}
export interface ExternalAccessResponse {
    status: number;
    headers: Record<string, string>;
    body: unknown;
    blocked: boolean;
    blockedReason?: string;
}
export interface DomainRateLimit {
    count: number;
    windowStart: number;
}
export declare class ScopedExternalAccessSandbox {
    private readonly config;
    private readonly rateLimits;
    constructor(config?: Partial<ScopedExternalAccessConfig>);
    /**
     * Validates whether an outbound request is allowed.
     *
     * @param url - The URL to validate
     * @returns true if the request is allowed
     */
    validateOutboundRequest(url: string): Promise<boolean>;
    /**
     * Checks rate limit for a domain.
     *
     * @param domain - The domain to check
     * @returns true if within rate limit
     */
    checkRateLimit(domain: string): Promise<boolean>;
    /**
     * Filters sensitive headers from a response.
     *
     * @param headers - Original response headers
     * @returns Filtered headers
     */
    filterResponseHeaders(headers: Record<string, string>): Record<string, string>;
    /**
     * Validates response size is within limits.
     *
     * @param body - Response body to check
     * @returns true if within size limit
     */
    validateResponseSize(body: unknown): boolean;
    /**
     * Makes a scoped external request through the egress proxy if configured.
     *
     * @param request - The external access request
     * @returns The filtered response
     */
    executeScopedRequest(request: ExternalAccessRequest): Promise<ExternalAccessResponse>;
    private performHttpRequest;
    /**
     * Returns current rate limit status for all tracked domains.
     */
    getRateLimitStatus(): Record<string, DomainRateLimit>;
}
export declare function createScopedExternalAccessSandbox(allowedDomains: readonly string[], options?: Partial<ScopedExternalAccessConfig>): ScopedExternalAccessSandbox;
