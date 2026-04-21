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
