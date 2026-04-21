/**
 * WebFetch Tool
 *
 * Provides secure HTTP/HTTPS fetching capabilities with:
 * - Size limit to prevent large response downloads
 * - Timeout to prevent hanging connections
 * - Internal network blocking (private IPs, localhost, etc.)
 * - Domain blacklist/whitelist support
 *
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/contracts/sandbox_contract.md}
 */
export interface WebFetchRequest {
    /** URL to fetch */
    url: string;
    /** HTTP method (default: GET) */
    method?: "GET" | "HEAD";
    /** Request timeout in milliseconds (default: 30000) */
    timeoutMs?: number;
    /** Maximum response size in bytes (default: 5MB) */
    maxSizeBytes?: number;
    /** Allowed domains (if specified, only these are allowed) */
    allowedDomains?: readonly string[];
    /** Blocked domains (takes precedence over allowed) */
    blockedDomains?: readonly string[];
    /** Custom headers for the request */
    headers?: Record<string, string>;
}
export interface WebFetchResult {
    /** Whether the fetch succeeded */
    success: boolean;
    /** Status of the fetch */
    status: "succeeded" | "failed" | "blocked" | "timed_out";
    /** HTTP status code if available */
    statusCode?: number;
    /** Response headers */
    headers?: Record<string, string>;
    /** Response body (may be truncated) */
    body?: string;
    /** Whether body was truncated due to size limit */
    bodyTruncated?: boolean;
    /** Error message if failed */
    error?: string;
    /** Error code if failed */
    errorCode?: string;
    /** Time taken in milliseconds */
    durationMs: number;
}
/**
 * Checks if a hostname is blocked (internal/private IP or localhost).
 *
 * @param hostname - The hostname to check
 * @returns true if the hostname should be blocked
 */
export declare function isBlockedIpOrHostname(hostname: string): boolean;
/**
 * Checks if a domain is allowed based on allowed/blocked lists.
 *
 * @param hostname - The hostname to check
 * @param allowedDomains - List of allowed domains (null means all allowed)
 * @param blockedDomains - List of blocked domains
 * @returns true if the domain is permitted
 */
export declare function isDomainAllowed(hostname: string, allowedDomains: readonly string[] | undefined, blockedDomains: readonly string[] | undefined): boolean;
/**
 * Checks if a URL points to an internal network resource.
 *
 * @param url - The URL to check
 * @returns true if the URL is internal
 */
export declare function isInternalUrl(url: URL): boolean;
/**
 * Creates a web fetch tool for retrieving remote content.
 */
export declare function createWebFetchTool(): {
    name: "web_fetch";
    /**
     * Fetches content from a URL with security checks and size limits.
     *
     * @param request - Fetch request with URL and options
     * @returns Fetch result with body and metadata
     */
    execute(request: WebFetchRequest): Promise<WebFetchResult>;
};
export type WebFetchTool = ReturnType<typeof createWebFetchTool>;
