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
// Default Configuration
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
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
};
// ─────────────────────────────────────────────────────────────────────────────
// Scoped External Access Sandbox
// ─────────────────────────────────────────────────────────────────────────────
export class ScopedExternalAccessSandbox {
    config;
    rateLimits = new Map();
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Validates whether an outbound request is allowed.
     *
     * @param url - The URL to validate
     * @returns true if the request is allowed
     */
    async validateOutboundRequest(url) {
        try {
            const targetUrl = new URL(url);
            const hostname = targetUrl.hostname;
            if (!this.config.allowedDomains.includes(hostname)) {
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
        }
        catch (err) {
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
    async checkRateLimit(domain) {
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
    filterResponseHeaders(headers) {
        const filtered = { ...headers };
        for (const sensitiveHeader of this.config.sensitiveHeaders) {
            delete filtered[sensitiveHeader.toLowerCase()];
            delete filtered[sensitiveHeader];
        }
        return filtered;
    }
    /**
     * Validates response size is within limits.
     *
     * @param body - Response body to check
     * @returns true if within size limit
     */
    validateResponseSize(body) {
        if (body == null)
            return true;
        const size = typeof body === "string" ? body.length : JSON.stringify(body).length;
        return size <= this.config.maxResponseSizeBytes;
    }
    /**
     * Makes a scoped external request through the egress proxy if configured.
     *
     * @param request - The external access request
     * @returns The filtered response
     */
    async executeScopedRequest(request) {
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
        }
        catch (err) {
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
    async performHttpRequest(targetUrl, request) {
        const headers = {
            "User-Agent": "AutomaticAgentPlatform/1.0",
            ...request.headers,
        };
        const options = {
            method: request.method,
            headers,
        };
        if (request.body && ["POST", "PUT", "PATCH"].includes(request.method)) {
            options.body = typeof request.body === "string" ? request.body : JSON.stringify(request.body);
            headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
        }
        const response = await fetch(targetUrl, options);
        let body;
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
            body = await response.json();
        }
        else {
            body = await response.text();
        }
        const respHeaders = {};
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
    getRateLimitStatus() {
        return Object.fromEntries(this.rateLimits);
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────
export function createScopedExternalAccessSandbox(allowedDomains, options) {
    return new ScopedExternalAccessSandbox({
        ...options,
        allowedDomains,
    });
}
//# sourceMappingURL=scoped-external-access-sandbox.js.map