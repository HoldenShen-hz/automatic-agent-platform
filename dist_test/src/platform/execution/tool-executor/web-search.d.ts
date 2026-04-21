/**
 * WebSearch Tool
 *
 * Provides web search capabilities via DuckDuckGo HTML scraping:
 * - Queries DuckDuckGo's HTML search interface
 * - Extracts title, URL, and snippet from search results
 * - Respects size limits to prevent large downloads
 * - Internal network blocking (no private IPs, localhost, etc.)
 *
 * Note: This uses DuckDuckGo HTML which does NOT require an API key.
 * Results are suitable for informational queries but not guaranteed
 * to be as comprehensive as paid search APIs.
 */
export interface WebSearchRequest {
    /** Search query string */
    query: string;
    /** Maximum number of results to return (default: 10, max: 30) */
    limit?: number;
    /** Timeout in milliseconds (default: 15000) */
    timeoutMs?: number;
    /** Language code for results (e.g., "en-US", "zh-CN"); empty = no preference */
    language?: string;
}
export interface WebSearchResult {
    /** Title of the search result */
    title: string;
    /** URL of the search result */
    url: string;
    /** Snippet/description of the result */
    snippet: string;
}
export interface WebSearchToolResult {
    /** Whether the search succeeded */
    success: boolean;
    /** Search results array */
    results: readonly WebSearchResult[];
    /** Number of results returned */
    count: number;
    /** Original query */
    query: string;
    /** Error message if failed */
    error?: string;
    /** Error code if failed */
    errorCode?: string;
    /** Time taken in milliseconds */
    durationMs: number;
}
/**
 * Checks if a hostname is blocked from search results.
 * Blocks internal IP ranges and localhost variants.
 *
 * @param hostname - The hostname to check
 * @returns true if the hostname should be blocked
 */
export declare function isBlockedHostname(hostname: string): boolean;
/**
 * Extracts search results from DuckDuckGo HTML.
 * Parses the HTML for result links and snippets.
 *
 * @param html - Raw HTML from DuckDuckGo search results
 * @param limit - Maximum number of results to extract
 * @returns Array of parsed search results
 */
export declare function extractSearchResults(html: string, limit: number): WebSearchResult[];
/**
 * Decodes HTML entities in text.
 * Handles common HTML entity references.
 *
 * @param text - Text with HTML entities
 * @returns Decoded text
 */
export declare function decodeHTMLEntities(text: string): string;
export interface WebSearchOptions {
    /** Custom user agent for requests */
    userAgent?: string;
    /** Optional fetch implementation override for testing */
    fetchImpl?: typeof fetch;
}
/**
 * Creates a web search tool instance.
 * The tool queries DuckDuckGo HTML and returns structured search results.
 */
export declare function createWebSearchTool(options?: WebSearchOptions): {
    name: "web_search";
    /**
     * Executes a web search.
     *
     * @param request - Search request with query and options
     * @returns Search results or error information
     */
    execute(request: WebSearchRequest): Promise<WebSearchToolResult>;
};
export type WebSearchTool = ReturnType<typeof createWebSearchTool>;
