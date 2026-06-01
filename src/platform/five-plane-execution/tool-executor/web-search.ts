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

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;
const MAX_WEB_SEARCH_RESPONSE_BYTES = 512 * 1024;

// DuckDuckGo HTML search endpoint
const DUCKDUCKGO_HTML_URL = "https://duckduckgo.com/html/";

/**
 * IP address patterns that are considered internal/blocked.
 * Includes IPv4 private ranges, IPv6 addresses, and localhost variants.
 */
const BLOCKED_IP_RANGES = [
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
  /^fd00:/i,
  /^localhost$/i,
  /\.(local|localhost|internal|private)$/i,
];

/**
 * Checks if a hostname is blocked from search results.
 * Blocks internal IP ranges and localhost variants.
 *
 * @param hostname - The hostname to check
 * @returns true if the hostname should be blocked
 */
export function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  for (const pattern of BLOCKED_IP_RANGES) {
    if (pattern.test(lower)) return true;
  }
  return false;
}

/**
 * Extracts search results from DuckDuckGo HTML.
 * Parses the HTML for result links and snippets.
 *
 * @param html - Raw HTML from DuckDuckGo search results
 * @param limit - Maximum number of results to extract
 * @returns Array of parsed search results
 */
export function extractSearchResults(html: string, limit: number): WebSearchResult[] {
  const results: WebSearchResult[] = [];

  // DuckDuckGo HTML result pattern:
  // <a class="result__a" href="URL">Title</a>
  // <a class="result__snippet" href="...">Snippet text</a>
  const resultLinkPattern = /<a class="result__a" href="([^"]+)">([^<]+)<\/a>/gi;
  const snippetPattern = /<a class="result__snippet"[^>]*>([^<]+)<\/a>/gi;

  const links: Array<{ url: string; title: string }> = [];
  let linkMatch: RegExpExecArray | null;

  // Reset lastIndex before iterating
  resultLinkPattern.lastIndex = 0;
  while ((linkMatch = resultLinkPattern.exec(html)) !== null && links.length < limit * 2) {
    const encodedUrl = linkMatch[1];
    const rawTitle = linkMatch[2];
    if (encodedUrl == null || rawTitle == null) {
      continue;
    }
    let url: string;
    try {
      url = decodeURIComponent(encodedUrl);
    } catch {
      continue;
    }
    const title = decodeHTMLEntities(rawTitle.trim());
    if (!url.startsWith("http")) continue;
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      continue;
    }
    if (isBlockedHostname(hostname)) continue;
    links.push({ url, title });
  }

  // Extract snippets - align with corresponding links
  const snippets: string[] = [];
  let snippetMatch: RegExpExecArray | null;
  snippetPattern.lastIndex = 0;
  while ((snippetMatch = snippetPattern.exec(html)) !== null) {
    const rawSnippet = snippetMatch[1];
    if (rawSnippet == null) {
      continue;
    }
    const snippet = decodeHTMLEntities(rawSnippet.trim().replace(/<[^>]+>/g, ""));
    snippets.push(snippet);
  }

  // Combine links with snippets (may not align perfectly, so be defensive)
  for (let i = 0; i < Math.min(links.length, limit); i++) {
    const link = links[i];
    if (link == null) {
      continue;
    }
    results.push({
      title: link.title,
      url: link.url,
      snippet: snippets[i] ?? "",
    });
  }

  return results;
}

/**
 * Decodes HTML entities in text.
 * Handles common HTML entity references.
 *
 * @param text - Text with HTML entities
 * @returns Decoded text
 */
export function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export interface WebSearchOptions {
  /** Custom user agent for requests */
  userAgent?: string;
  /** Optional fetch implementation override for testing */
  fetchImpl?: typeof fetch;
}

import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { createPolicyAwareFetch } from "../../five-plane-control-plane/iam/index.js";

const webSearchLogger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Creates a web search tool instance.
 * The tool queries DuckDuckGo HTML and returns structured search results.
 */
export function createWebSearchTool(options?: WebSearchOptions) {
  const userAgent = options?.userAgent ?? "Mozilla/5.0 (compatible; AutomaticAgent/1.0; +https://github.com/anthropics/claude-code)";
  const fetchImpl = options?.fetchImpl ?? fetch;

  return {
    name: "web_search" as const,

    /**
     * Executes a web search.
     *
     * @param request - Search request with query and options
     * @returns Search results or error information
     */
    async execute(request: WebSearchRequest): Promise<WebSearchToolResult> {
      const startTime = Date.now();
      const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const limit = Math.min(request.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

      // Validate query
      if (!request.query || request.query.trim().length === 0) {
        return {
          success: false,
          results: [],
          count: 0,
          query: request.query,
          error: "Query cannot be empty",
          errorCode: "EMPTY_QUERY",
          durationMs: Date.now() - startTime,
        };
      }

      // Build DuckDuckGo URL
      const params = new URLSearchParams({
        q: request.query.trim(),
        kl: request.language ?? "en-us",
      });
      const searchUrl = `${DUCKDUCKGO_HTML_URL}?${params.toString()}`;

      // Create policy-aware fetch that enforces egress policy
      const policyAwareFetch = createPolicyAwareFetch(fetchImpl, { action: "web search" });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await policyAwareFetch(searchUrl, {
          method: "GET",
          headers: {
            "User-Agent": userAgent,
            "Accept": "text/html",
            "Accept-Language": request.language ?? "en-US,en;q=0.9",
          },
          signal: controller.signal as AbortSignal,
        });
      } catch (err) {
        clearTimeout(timeoutId);
        const msg = err instanceof Error ? err.message : "Unknown error";

        if (msg.includes("aborted") || msg.includes("timeout")) {
          return {
            success: false,
            results: [],
            count: 0,
            query: request.query,
            error: `Search timed out after ${timeoutMs}ms`,
            errorCode: "TIMEOUT",
            durationMs: Date.now() - startTime,
          };
        }

        return {
          success: false,
          results: [],
          count: 0,
          query: request.query,
          error: msg,
          errorCode: "FETCH_ERROR",
          durationMs: Date.now() - startTime,
        };
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        return {
          success: false,
          results: [],
          count: 0,
          query: request.query,
          error: `Search failed with status ${response.status}`,
          errorCode: `HTTP_${response.status}`,
          durationMs: Date.now() - startTime,
        };
      }

      let html: string;
      try {
        const chunks: Buffer[] = [];
        let totalBytes = 0;
        const reader = response.body?.getReader();
        if (reader != null) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            const buffer = Buffer.from(value);
            totalBytes += buffer.length;
            if (totalBytes > MAX_WEB_SEARCH_RESPONSE_BYTES) {
              await reader.cancel();
              return {
                success: false,
                results: [],
                count: 0,
                query: request.query,
                error: "Response body exceeded maximum allowed size",
                errorCode: "BODY_TOO_LARGE",
                durationMs: Date.now() - startTime,
              };
            }
            chunks.push(buffer);
          }
        } else {
          const buffer = Buffer.from(await response.arrayBuffer());
          totalBytes = buffer.length;
          if (totalBytes > MAX_WEB_SEARCH_RESPONSE_BYTES) {
            return {
              success: false,
              results: [],
              count: 0,
              query: request.query,
              error: "Response body exceeded maximum allowed size",
              errorCode: "BODY_TOO_LARGE",
              durationMs: Date.now() - startTime,
            };
          }
          chunks.push(buffer);
        }
        html = Buffer.concat(chunks).toString("utf8");
      } catch (err) {
        webSearchLogger.debug("web_search: failed to read response body", { error: err instanceof Error ? err.message : String(err) });
        return {
          success: false,
          results: [],
          count: 0,
          query: request.query,
          error: "Failed to read response body",
          errorCode: "BODY_READ_ERROR",
          durationMs: Date.now() - startTime,
        };
      }

      // If response is too short, likely blocked or rate-limited
      if (html.length < 500) {
        return {
          success: false,
          results: [],
          count: 0,
          query: request.query,
          error: "Received empty or very short response (possible rate limiting)",
          errorCode: "RATE_LIMITED",
          durationMs: Date.now() - startTime,
        };
      }

      const results = extractSearchResults(html, limit);

      return {
        success: true,
        results,
        count: results.length,
        query: request.query,
        durationMs: Date.now() - startTime,
      };
    },
  };
}

export type WebSearchTool = ReturnType<typeof createWebSearchTool>;
