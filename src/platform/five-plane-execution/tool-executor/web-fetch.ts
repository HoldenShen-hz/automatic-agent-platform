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

import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import {
  isBlockedOutboundHostname,
  isInternalNetworkUrl,
} from "../../control-plane/iam/outbound-url-policy.js";

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

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Checks if a hostname is blocked (internal/private IP or localhost).
 *
 * @param hostname - The hostname to check
 * @returns true if the hostname should be blocked
 */
export function isBlockedIpOrHostname(hostname: string): boolean {
  return isBlockedOutboundHostname(hostname);
}

/**
 * Checks if a domain is allowed based on allowed/blocked lists.
 *
 * @param hostname - The hostname to check
 * @param allowedDomains - List of allowed domains (null means all allowed)
 * @param blockedDomains - List of blocked domains
 * @returns true if the domain is permitted
 */
export function isDomainAllowed(
  hostname: string,
  allowedDomains: readonly string[] | undefined,
  blockedDomains: readonly string[] | undefined,
): boolean {
  const lowerHostname = hostname.toLowerCase();

  // If allowed list is specified, hostname must match
  if (allowedDomains && allowedDomains.length > 0) {
    for (const allowed of allowedDomains) {
      const lowerAllowed = allowed.toLowerCase();
      if (lowerHostname === lowerAllowed || lowerHostname.endsWith(`.${lowerAllowed}`)) {
        return true;
      }
    }
    return false;
  }

  // Check blocked list
  if (blockedDomains && blockedDomains.length > 0) {
    for (const blocked of blockedDomains) {
      const lowerBlocked = blocked.toLowerCase();
      if (lowerHostname === lowerBlocked || lowerHostname.endsWith(`.${lowerBlocked}`)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Checks if a URL points to an internal network resource.
 *
 * @param url - The URL to check
 * @returns true if the URL is internal
 */
export function isInternalUrl(url: URL): boolean {
  return isInternalNetworkUrl(url);
}

const webFetchLogger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Creates a web fetch tool for retrieving remote content.
 */
export function createWebFetchTool() {
  return {
    name: "web_fetch" as const,

    /**
     * Fetches content from a URL with security checks and size limits.
     *
     * @param request - Fetch request with URL and options
     * @returns Fetch result with body and metadata
     */
    async execute(request: WebFetchRequest): Promise<WebFetchResult> {
      const startTime = Date.now();
      const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const maxSizeBytes = request.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
      const method = request.method ?? "GET";

      // Parse and validate URL
      let url: URL;
      try {
        url = new URL(request.url);
      } catch (err) {
        webFetchLogger.debug("web_fetch: failed to parse URL", { error: err instanceof Error ? err.message : String(err), url: request.url });
        return {
          success: false,
          status: "failed",
          error: "Invalid URL format",
          errorCode: "INVALID_URL",
          durationMs: Date.now() - startTime,
        };
      }

      // Check internal network access
      if (isInternalUrl(url)) {
        return {
          success: false,
          status: "blocked",
          error: "Access to internal/network resources is not allowed",
          errorCode: "INTERNAL_NETWORK_BLOCKED",
          durationMs: Date.now() - startTime,
        };
      }

      // Check domain allowlist/blocklist
      if (
        !isDomainAllowed(
          url.hostname,
          request.allowedDomains,
          request.blockedDomains,
        )
      ) {
        return {
          success: false,
          status: "blocked",
          error: `Domain ${url.hostname} is not allowed`,
          errorCode: "DOMAIN_BLOCKED",
          durationMs: Date.now() - startTime,
        };
      }

      // Set up timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        const fetchOptions: RequestInit = {
          method,
          signal: controller.signal as AbortSignal,
        };

        if (request.headers && Object.keys(request.headers).length > 0) {
          fetchOptions.headers = request.headers;
        }

        if (method === "GET") {
          (fetchOptions as { duplex?: string }).duplex = "half";
        }

        response = await fetch(url.toString(), fetchOptions);
      } catch (err) {
        clearTimeout(timeoutId);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";

        if (errorMessage.includes("aborted")) {
          return {
            success: false,
            status: "timed_out",
            error: `Request timed out after ${timeoutMs}ms`,
            errorCode: "TIMEOUT",
            durationMs: Date.now() - startTime,
          };
        }

        return {
          success: false,
          status: "failed",
          error: errorMessage,
          errorCode: "FETCH_ERROR",
          durationMs: Date.now() - startTime,
        };
      } finally {
        clearTimeout(timeoutId);
      }

      // Check Content-Length header if present
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
        return {
          success: false,
          status: "failed",
          error: `Response size ${contentLength} exceeds limit ${maxSizeBytes}`,
          errorCode: "RESPONSE_TOO_LARGE",
          durationMs: Date.now() - startTime,
        };
      }

      // Collect response headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      let body: string | undefined;
      let bodyTruncated = false;

      // Read response body for GET requests
      if (method === "GET") {
        try {
          const reader = response.body?.getReader();
          if (!reader) {
            return {
              success: false,
              status: "failed",
              error: "Response body is not readable",
              errorCode: "BODY_NOT_READABLE",
              durationMs: Date.now() - startTime,
            };
          }

          const chunks: Uint8Array[] = [];
          let totalSize = 0;

          // Stream and accumulate chunks with size limit
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            totalSize += value.length;
            if (totalSize > maxSizeBytes) {
              reader.cancel();
              bodyTruncated = true;
              const excess = totalSize - maxSizeBytes;
              const allowedLength = value.length - excess;
              if (allowedLength > 0) {
                chunks.push(value.slice(0, allowedLength));
              }
              break;
            }

            chunks.push(value);
          }

          const decoder = new TextDecoder();
          body = decoder.decode(
            Buffer.concat(chunks),
            { stream: bodyTruncated },
          );
        } catch (err) {
          webFetchLogger.debug("web_fetch: failed to decode response body", { error: err instanceof Error ? err.message : String(err) });
          return {
            success: false,
            status: "failed",
            error: "Failed to read response body",
            errorCode: "BODY_READ_ERROR",
            durationMs: Date.now() - startTime,
          };
        }
      }

      return {
        success: true,
        status: "succeeded",
        statusCode: response.status,
        headers,
        body: body ?? "",
        bodyTruncated,
        durationMs: Date.now() - startTime,
      };
    },
  };
}

export type WebFetchTool = ReturnType<typeof createWebFetchTool>;
