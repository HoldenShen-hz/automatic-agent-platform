/**
 * @fileoverview HTTP request parsing / authentication helpers.
 *
 * Extracted from http-api-server.ts as part of GAP24A-02 deep split.
 */
import type { IncomingMessage } from "node:http";
import { type ApiAuthService, type ApiPrincipal } from "../api-auth-service.js";
import type { ApiRequestLike, RouteMatch } from "./types.js";
/** Maximum HTTP request body size to prevent DoS attacks (1 MB) */
export declare const MAX_BODY_BYTES = 1048576;
export declare function matchRoute(request: ApiRequestLike): RouteMatch | null;
export declare function readIncomingBody(request: IncomingMessage): Promise<string | null>;
export declare function normalizeHeaders(headers: Record<string, string | string[] | undefined> | undefined): Record<string, string | undefined>;
export declare function authenticateOptionalPrincipal(request: ApiRequestLike, authService: ApiAuthService | null): ApiPrincipal | null;
