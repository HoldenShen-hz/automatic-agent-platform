/**
 * @fileoverview Client SDK - Extended API Client
 *
 * Implements §22.1 Client SDK: API client with retry, pagination, and error handling.
 */
import { ValidationError } from "../../platform/contracts/errors.js";
const DEFAULT_RETRY_CONFIG = {
    maxRetries: 3,
    backoffMs: 1000,
    backoffMultiplier: 2,
    maxBackoffMs: 30000,
};
/**
 * Build a versioned API URL with query parameters and tenant context.
 */
export function buildApiUrl(config, request) {
    const baseUrl = config.baseUrl.replace(/\/+$/, "");
    const apiVersion = config.apiVersion.replace(/^\/+|\/+$/g, "");
    const path = request.path.replace(/^\/+/, "");
    const url = new URL(`${baseUrl}/${apiVersion}/${path}`);
    for (const [key, value] of Object.entries(request.query ?? {})) {
        if (value == null)
            continue;
        url.searchParams.set(key, String(value));
    }
    if (config.tenantId?.trim()) {
        url.searchParams.set("tenantId", config.tenantId.trim());
    }
    return url.toString();
}
/**
 * Build authorization headers for API requests.
 */
export function buildAuthHeaders(config) {
    if (!config.bearerToken?.trim()) {
        throw new ValidationError("client_sdk.missing_bearer_token", "Client SDK requests require a bearer token.");
    }
    return {
        authorization: `Bearer ${config.bearerToken.trim()}`,
    };
}
/**
 * Retry client with exponential backoff for resilient API calls.
 */
export class RetryableApiClient {
    config;
    retryConfig;
    constructor(config, retryConfig = DEFAULT_RETRY_CONFIG) {
        this.config = config;
        this.retryConfig = retryConfig;
    }
    /**
     * Make a GET request with automatic retry.
     */
    async get(path, query) {
        return this.request({ path, method: "GET", ...(query !== undefined ? { query } : {}) });
    }
    /**
     * Make a POST request with automatic retry.
     */
    async post(path, body) {
        return this.request({ path, method: "POST", body });
    }
    /**
     * Make a PUT request with automatic retry.
     */
    async put(path, body) {
        return this.request({ path, method: "PUT", body });
    }
    /**
     * Make a DELETE request with automatic retry.
     */
    async delete(path) {
        return this.request({ path, method: "DELETE" });
    }
    /**
     * Make a paginated request.
     */
    async getPaginated(path, pagination) {
        const query = {
            ...pagination?.cursor ? { cursor: pagination.cursor } : {},
            ...pagination?.limit ? { limit: pagination.limit } : {},
        };
        const response = await this.get(path, query);
        const nextCursor = response.headers["x-next-cursor"] ?? null;
        const totalCountHeader = response.headers["x-total-count"];
        const totalCount = totalCountHeader !== undefined ? parseInt(totalCountHeader, 10) : undefined;
        const result = {
            data: response.data,
            status: response.status,
            headers: response.headers,
            nextCursor: nextCursor,
        };
        if (totalCount !== undefined) {
            result.totalCount = totalCount;
        }
        return result;
    }
    async request(request, attempt = 0) {
        const url = buildApiUrl(this.config, request);
        const headers = buildAuthHeaders(this.config);
        if (request.body) {
            headers["content-type"] = "application/json";
        }
        try {
            const fetchOptions = {
                method: request.method ?? "GET",
                headers,
            };
            if (request.body !== undefined) {
                fetchOptions.body = JSON.stringify(request.body);
            }
            if (this.config.timeoutMs !== undefined) {
                fetchOptions.signal = AbortSignal.timeout(this.config.timeoutMs);
            }
            const response = await fetch(url, fetchOptions);
            if (!response.ok && attempt < this.retryConfig.maxRetries) {
                const retryAfter = Math.min(this.retryConfig.backoffMs * Math.pow(this.retryConfig.backoffMultiplier, attempt), this.retryConfig.maxBackoffMs);
                await delay(retryAfter);
                return this.request(request, attempt + 1);
            }
            const data = await response.json();
            const responseHeaders = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });
            return {
                data,
                status: response.status,
                headers: responseHeaders,
            };
        }
        catch (error) {
            if (attempt < this.retryConfig.maxRetries) {
                const retryAfter = Math.min(this.retryConfig.backoffMs * Math.pow(this.retryConfig.backoffMultiplier, attempt), this.retryConfig.maxBackoffMs);
                await delay(retryAfter);
                return this.request(request, attempt + 1);
            }
            throw error;
        }
    }
}
/**
 * Create a retryable API client with configuration.
 */
export function createApiClient(config) {
    if (!config.baseUrl?.trim()) {
        throw new ValidationError("client_sdk.missing_base_url", "API client requires baseUrl.");
    }
    if (!config.apiVersion?.trim()) {
        throw new ValidationError("client_sdk.missing_api_version", "API client requires apiVersion.");
    }
    return new RetryableApiClient(config);
}
/**
 * Parse cursor pagination parameters.
 */
export function parseCursor(cursor) {
    if (!cursor)
        return undefined;
    try {
        const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
        return decoded;
    }
    catch {
        return undefined;
    }
}
/**
 * Encode cursor pagination parameters.
 */
export function encodeCursor(pagination) {
    return Buffer.from(JSON.stringify(pagination)).toString("base64");
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=api-client.js.map