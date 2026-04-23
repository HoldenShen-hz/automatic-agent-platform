/**
 * @fileoverview HTTP Server Route Utilities - Shared helper functions for routes.
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */
import { parse as parseUrl } from "node:url";
import { randomUUID } from "node:crypto";
import { AppError } from "../../../contracts/errors.js";
import { ApiAuthError } from "../api-auth-service.js";
class ApiError extends AppError {
    constructor(statusCode, code, message) {
        super(code, message, {
            statusCode,
            category: statusCode >= 500 ? "internal" : statusCode >= 400 ? "validation" : "external",
            source: "runtime",
            retryable: statusCode >= 500 || statusCode === 429,
        });
        this.name = "ApiError";
    }
}
export function readRequestId(request) {
    const candidate = request.headers["x-request-id"];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
    }
    return `req_${Date.now().toString(36)}_${randomUUID()}`;
}
export function readLimit(request, fallback) {
    const raw = readQueryParam(request, "limit", { maxLength: 16 });
    if (raw == null) {
        return fallback;
    }
    const numeric = Number(raw);
    if (!Number.isInteger(numeric) || numeric <= 0) {
        throw new ApiError(400, "api.invalid_limit", "limit must be a positive integer.");
    }
    return Math.max(1, Math.min(200, numeric));
}
export function readStatusFilter(request) {
    return readQueryParam(request, "status", { maxLength: 64 });
}
export function readCursor(request) {
    return readQueryParam(request, "cursor", { maxLength: 1024, trim: false });
}
export function readQueryParam(request, name, options = {}) {
    const parsed = parseUrl(request.url ?? "/", true);
    const raw = parsed.query[name];
    if (typeof raw !== "string") {
        if (options.required) {
            throw new ApiError(400, `api.${name}_required`, `${name} is required.`);
        }
        return undefined;
    }
    const value = options.trim === false ? raw : raw.trim();
    if (value.length === 0) {
        if (options.required) {
            throw new ApiError(400, `api.${name}_required`, `${name} is required.`);
        }
        return undefined;
    }
    const maxLength = options.maxLength ?? 256;
    if (value.length > maxLength) {
        throw new ApiError(400, `api.invalid_${name}`, `${name} exceeds maximum length of ${maxLength}.`);
    }
    if (options.pattern && !options.pattern.test(value)) {
        throw new ApiError(400, `api.invalid_${name}`, `${name} contains invalid characters.`);
    }
    return value;
}
export function readJsonBody(body) {
    if (body == null || body.length === 0) {
        return {};
    }
    try {
        return JSON.parse(body);
    }
    catch {
        throw new ApiError(400, "api.invalid_json", "Request body must be valid JSON.");
    }
}
export function requirePrincipal(request, authService, requiredRole) {
    try {
        if (authService == null) {
            throw new ApiError(401, "api.auth_not_configured", "This endpoint requires authentication to be configured.");
        }
        return authService.requireRole(request.headers, requiredRole);
    }
    catch (error) {
        if (error instanceof ApiAuthError) {
            throw new ApiError(error.statusCode, error.code, error.message);
        }
        throw error;
    }
}
export function resolveTenantScope(principal, requestedTenantId) {
    if (principal.tenantId == null) {
        return requestedTenantId;
    }
    if (requestedTenantId != null && requestedTenantId !== principal.tenantId) {
        throw new ApiError(403, "api.tenant_scope_mismatch", "Authenticated principal cannot access another tenant scope.");
    }
    return principal.tenantId;
}
export function assertGlobalTenantScopeSupported(principal, surface) {
    if (principal.tenantId != null) {
        throw new ApiError(403, "api.tenant_scope_unsupported", `Authenticated tenant-scoped principal cannot access ${surface}.`);
    }
}
export function assertTaskTenantAccess(principal, resourceTenantId, notFoundCode, notFoundMessage) {
    if (principal.tenantId == null) {
        return;
    }
    if (resourceTenantId !== principal.tenantId) {
        throw new ApiError(404, notFoundCode, notFoundMessage);
    }
}
const MAX_TASK_ID_LENGTH = 128;
const TASK_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export function validateTaskId(taskId, location) {
    if (!taskId || typeof taskId !== "string") {
        throw new ApiError(404, "api.task_not_found", `${location} requires taskId.`);
    }
    if (taskId.length > MAX_TASK_ID_LENGTH) {
        throw new ApiError(400, "api.invalid_task_id", `taskId exceeds maximum length of ${MAX_TASK_ID_LENGTH}.`);
    }
    if (!TASK_ID_PATTERN.test(taskId)) {
        throw new ApiError(400, "api.invalid_task_id", "taskId contains invalid characters.");
    }
    return taskId;
}
export function buildJsonResponse(requestId, statusCode, payload) {
    return {
        statusCode,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "x-request-id": requestId,
        },
        body: JSON.stringify({ requestId, data: payload }, null, 2),
    };
}
export function buildJsonErrorResponse(requestId, statusCode, error) {
    return {
        statusCode,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "x-request-id": requestId,
        },
        body: JSON.stringify({ requestId, error }, null, 2),
    };
}
export function buildJsonDocumentResponse(payload) {
    return {
        statusCode: 200,
        headers: {
            "content-type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(payload, null, 2),
    };
}
export function buildHtmlResponse(html) {
    return {
        statusCode: 200,
        headers: {
            "content-type": "text/html; charset=utf-8",
        },
        body: html,
    };
}
export function buildTextResponse(text) {
    return {
        statusCode: 200,
        headers: {
            "content-type": "text/plain; charset=utf-8",
        },
        body: text,
    };
}
export function encodeOpaqueCursor(payload) {
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}
export function decodeOpaqueCursor(cursor, code = "api.invalid_cursor") {
    try {
        return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    }
    catch {
        throw new ApiError(400, code, "cursor is invalid.");
    }
}
/**
 * Normalizes route segments by stripping the leading "v1" prefix if present.
 * This allows handlers to match both /resource and /v1/resource with the same logic.
 *
 * @example
 * normalizeSegments(["v1", "divisions"]) => ["divisions"]
 * normalizeSegments(["divisions"]) => ["divisions"]
 * normalizeSegments(["v1", "tasks", "abc123"]) => ["tasks", "abc123"]
 */
export function normalizeSegments(segments) {
    if (segments.length > 0 && segments[0] === "v1") {
        return segments.slice(1);
    }
    return segments;
}
/**
 * Creates a segment-based route matcher that handles both v1 and non-v1 paths.
 * Returns the normalized segments (without v1 prefix) on match, or null on no match.
 *
 * @param segments - The route segments from RouteMatch
 * @param expected - The expected segments without v1 prefix (e.g., ["tasks", ":id"])
 * @param minLength - Minimum number of segments required (default: expected.length)
 * @param maxLength - Maximum number of segments allowed (default: expected.length)
 * @returns The normalized segments (without v1) on match, or null if no match
 */
export function matchNormalizedSegments(segments, expected, minLength, maxLength) {
    const normalized = normalizeSegments(segments);
    const min = minLength ?? expected.length;
    const max = maxLength ?? expected.length;
    if (normalized.length < min || normalized.length > max) {
        return null;
    }
    for (let i = 0; i < expected.length; i++) {
        if (expected[i]?.startsWith(":")) {
            // This is a parameter placeholder, skip validation
            continue;
        }
        if (normalized[i] !== expected[i]) {
            return null;
        }
    }
    return normalized;
}
//# sourceMappingURL=utils.js.map