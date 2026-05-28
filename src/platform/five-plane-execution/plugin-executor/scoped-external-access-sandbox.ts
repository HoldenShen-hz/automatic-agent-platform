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

import { URL } from "node:url";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 1000 });

// ─────────────────────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

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
  /** Request timeout in milliseconds */
  requestTimeoutMs?: number;
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

// ─────────────────────────────────────────────────────────────────────────────
// Default Configuration
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ScopedExternalAccessConfig = {
  allowedDomains: [],
  maxResponseSizeBytes: 5 * 1024 * 1024, // 5MB
  rateLimitPerMinute: 60,
  sensitiveHeaders: [
    "authorization",
    "x-api-key",
    "x-auth-token",
    "set-cookie",
    "www-authenticate",
  ],
  requestTimeoutMs: 10_000,
};

// ─────────────────────────────────────────────────────────────────────────────
// Scoped External Access Sandbox
// ─────────────────────────────────────────────────────────────────────────────

export class ScopedExternalAccessSandbox {
  private readonly config: ScopedExternalAccessConfig;
  private readonly rateLimits = new Map<string, DomainRateLimit>();

  constructor(config: Partial<ScopedExternalAccessConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Validates whether an outbound request is allowed.
   *
   * @param url - The URL to validate
   * @returns true if the request is allowed
   */
  public validateOutboundRequest(url: string): boolean {
    try {
      const targetUrl = new URL(url);
      const hostname = targetUrl.hostname.toLowerCase();
      const allowed = this.config.allowedDomains.some((domain) => {
        const allowedDomain = domain.toLowerCase();
        if (hostname === allowedDomain) {
          return true;
        }
        if (!allowedDomain.startsWith("*.")) {
          return false;
        }
        const suffix = allowedDomain.slice(2);
        return hostname.length > suffix.length && hostname.endsWith(`.${suffix}`);
      });

      if (!allowed) {
        logger.log({
          level: "warn",
          message: "External request blocked: domain not in whitelist",
          data: {
            hostname,
            allowedDomains: this.config.allowedDomains,
          },
        });
        return false;
      }

      return true;
    } catch (err) {
      logger.log({
        level: "error",
        message: "Invalid URL in external request validation",
        data: { url, error: err instanceof Error ? err.message : String(err) },
      });
      return false;
    }
  }

  /**
   * Checks rate limit for a domain.
   *
   * @param domain - The domain to check
   * @returns true if within rate limit
   */
  public checkRateLimit(domain: string): boolean {
    const now = Date.now();
    const minuteMs = 60 * 1000;

    let limit = this.rateLimits.get(domain);

    if (!limit || now - limit.windowStart > minuteMs) {
      // Reset window
      this.rateLimits.set(domain, { count: 1, windowStart: now });
      return true;
    }

    if (limit.count >= this.config.rateLimitPerMinute) {
      logger.log({
        level: "warn",
        message: "Rate limit exceeded for domain",
        data: { domain, limit: this.config.rateLimitPerMinute },
      });
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * Filters sensitive headers from a response.
   *
   * @param headers - Original response headers
   * @returns Filtered headers
   */
  public filterResponseHeaders(headers: Record<string, string>): Record<string, string> {
    const filtered = { ...headers };
    const sensitiveHeaderSet = new Set(this.config.sensitiveHeaders.map((header) => header.toLowerCase()));

    for (const header of Object.keys(filtered)) {
      if (sensitiveHeaderSet.has(header.toLowerCase())) {
        delete filtered[header];
      }
    }

    return filtered;
  }

  /**
   * Validates response size is within limits.
   *
   * @param body - Response body to check
   * @returns true if within size limit
   */
  public validateResponseSize(body: unknown): boolean {
    if (body == null) return true;

    const serialized = typeof body === "string" ? body : JSON.stringify(body);
    const size = Buffer.byteLength(serialized, "utf8");
    return size <= this.config.maxResponseSizeBytes;
  }

  /**
   * Makes a scoped external request through the egress proxy if configured.
   *
   * @param request - The external access request
   * @returns The filtered response
   */
  public async executeScopedRequest(request: ExternalAccessRequest): Promise<ExternalAccessResponse> {
    const allowed = await this.validateOutboundRequest(request.url);
    if (!allowed) {
      return {
        status: 403,
        headers: {},
        body: { error: "Domain not in whitelist" },
        blocked: true,
        blockedReason: "domain_not_allowed",
      };
    }

    const domain = new URL(request.url).hostname;
    const withinLimit = await this.checkRateLimit(domain);
    if (!withinLimit) {
      return {
        status: 429,
        headers: {},
        body: { error: "Rate limit exceeded" },
        blocked: true,
        blockedReason: "rate_limit_exceeded",
      };
    }

    logger.log({
      level: "info",
      message: "Scoped external request",
      data: {
        url: request.url,
        method: request.method,
        domain,
      },
    });

    // Build request URL (through egress proxy if configured)
    const targetUrl = this.config.egressProxyUrl
      ? `${this.config.egressProxyUrl}?url=${encodeURIComponent(request.url)}`
      : request.url;

    try {
      const response = await this.performHttpRequest(targetUrl, request);

      // Filter sensitive headers
      response.headers = this.filterResponseHeaders(response.headers);

      // Validate response size
      if (!this.validateResponseSize(response.body)) {
        return {
          status: 413,
          headers: {},
          body: { error: "Response too large" },
          blocked: true,
          blockedReason: "response_size_exceeded",
        };
      }

      return response;
    } catch (err) {
      logger.log({
        level: "error",
        message: "Scoped external request failed",
        data: {
          url: request.url,
          error: err instanceof Error ? err.message : String(err),
        },
      });
      return {
        status: 502,
        headers: {},
        body: { error: "External request failed" },
        blocked: true,
        blockedReason: "request_failed",
      };
    }
  }

  private async performHttpRequest(
    targetUrl: string,
    request: ExternalAccessRequest,
  ): Promise<ExternalAccessResponse> {
    const headers: Record<string, string> = {
      "User-Agent": "AutomaticAgentPlatform/1.0",
      ...request.headers,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs ?? DEFAULT_CONFIG.requestTimeoutMs);
    timeout.unref?.();

    const options: RequestInit = {
      method: request.method,
      headers,
      signal: controller.signal,
    };

    if (request.body && ["POST", "PUT", "PATCH"].includes(request.method)) {
      options.body = typeof request.body === "string" ? request.body : JSON.stringify(request.body);
      const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === "content-type");
      if (!hasContentType) {
        headers["Content-Type"] = "application/json";
      }
    }

    let response: Response;
    try {
      response = await fetch(targetUrl, options);
    } finally {
      clearTimeout(timeout);
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    const reader = response.body?.getReader();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        const chunk = Buffer.from(value);
        totalBytes += chunk.byteLength;
        if (totalBytes > this.config.maxResponseSizeBytes) {
          await reader.cancel();
          return {
            status: 413,
            headers: {},
            body: { error: "Response too large" },
            blocked: true,
            blockedReason: "response_size_exceeded",
          };
        }
        chunks.push(chunk);
      }
    } else {
      const bodyBuffer = Buffer.from(await response.arrayBuffer());
      if (bodyBuffer.byteLength > this.config.maxResponseSizeBytes) {
        return {
          status: 413,
          headers: {},
          body: { error: "Response too large" },
          blocked: true,
          blockedReason: "response_size_exceeded",
        };
      }
      chunks.push(bodyBuffer);
    }
    const bodyBuffer = Buffer.concat(chunks);

    let body: unknown;
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const bodyText = bodyBuffer.toString("utf8");

    if (contentType.includes("application/json")) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        return {
          status: 502,
          headers: {},
          body: { error: "Invalid JSON response" },
          blocked: true,
          blockedReason: "invalid_json_response",
        };
      }
    } else {
      body = bodyText;
    }

    const respHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      respHeaders[key] = value;
    });

    return {
      status: response.status,
      headers: respHeaders,
      body,
      blocked: false,
    };
  }

  /**
   * Returns current rate limit status for all tracked domains.
   */
  public getRateLimitStatus(): Record<string, DomainRateLimit> {
    return Object.fromEntries(
      [...this.rateLimits.entries()].map(([domain, status]) => [
        domain,
        { ...status },
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

export function createScopedExternalAccessSandbox(
  allowedDomains: readonly string[],
  options?: Partial<ScopedExternalAccessConfig>,
): ScopedExternalAccessSandbox {
  return new ScopedExternalAccessSandbox({
    ...options,
    allowedDomains,
  });
}
