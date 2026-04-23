/**
 * @fileoverview HTTP Server Route Utilities - Shared helper functions for routes.
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */
import type { ApiRequestLike, ApiResponsePayload } from "./types.js";
import type { ApiAuthService, ApiPrincipal, ApiRole } from "../api-auth-service.js";
export declare function readRequestId(request: ApiRequestLike): string;
export declare function readLimit(request: ApiRequestLike, fallback: number): number;
export declare function readStatusFilter(request: ApiRequestLike): string | undefined;
export declare function readCursor(request: ApiRequestLike): string | undefined;
export interface ReadQueryParamOptions {
    required?: boolean;
    maxLength?: number;
    pattern?: RegExp;
    trim?: boolean;
}
export declare function readQueryParam(request: ApiRequestLike, name: string, options?: ReadQueryParamOptions): string | undefined;
export declare function readJsonBody(body: string | null | undefined): unknown;
export declare function requirePrincipal(request: ApiRequestLike, authService: ApiAuthService | null, requiredRole: ApiRole): ApiPrincipal;
export declare function resolveTenantScope(principal: ApiPrincipal, requestedTenantId: string | undefined): string | undefined;
export declare function assertGlobalTenantScopeSupported(principal: ApiPrincipal, surface: string): void;
export declare function assertTaskTenantAccess(principal: ApiPrincipal, resourceTenantId: string | null, notFoundCode: string, notFoundMessage: string): void;
export declare function validateTaskId(taskId: string | undefined, location: string): string;
export declare function buildJsonResponse(requestId: string, statusCode: number, payload: unknown): ApiResponsePayload;
export declare function buildJsonErrorResponse(requestId: string, statusCode: number, error: {
    code: string;
    message: string;
}): ApiResponsePayload;
export declare function buildJsonDocumentResponse(payload: unknown): ApiResponsePayload;
export declare function buildHtmlResponse(html: string): ApiResponsePayload;
export declare function buildTextResponse(text: string): ApiResponsePayload;
export declare function encodeOpaqueCursor(payload: Record<string, unknown>): string;
export declare function decodeOpaqueCursor<T>(cursor: string, code?: string): T;
/**
 * Normalizes route segments by stripping the leading "v1" prefix if present.
 * This allows handlers to match both /resource and /v1/resource with the same logic.
 *
 * @example
 * normalizeSegments(["v1", "divisions"]) => ["divisions"]
 * normalizeSegments(["divisions"]) => ["divisions"]
 * normalizeSegments(["v1", "tasks", "abc123"]) => ["tasks", "abc123"]
 */
export declare function normalizeSegments(segments: string[]): string[];
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
export declare function matchNormalizedSegments(segments: string[], expected: string[], minLength?: number, maxLength?: number): string[] | null;
