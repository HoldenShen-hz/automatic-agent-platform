/**
 * @fileoverview HTTP Server Route Types - Shared types for route handlers.
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */
import type { ApiPrincipal } from "../api-auth-service.js";
export interface RouteMatch {
    pathname: string;
    segments: string[];
}
export interface ApiRequestLike {
    method: string | undefined;
    url: string | undefined;
    headers: Record<string, string | undefined>;
    body: string | null | undefined;
}
export interface ApiResponsePayload {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
}
export interface RouteContext {
    request: ApiRequestLike;
    route: RouteMatch;
    requestId: string;
    principal: ApiPrincipal | null;
}
export type RouteHandler = (ctx: RouteContext) => Promise<ApiResponsePayload> | ApiResponsePayload | null;
export interface RouteDefinition {
    method: string;
    pathname: string | null;
    segments?: boolean;
    handler: RouteHandler;
}
