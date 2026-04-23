/**
 * @fileoverview Auth Routes - API authentication endpoints.
 *
 * Routes:
 * - POST /auth/token
 * - POST /v1/auth/token
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */
import type { RouteDefinition } from "./types.js";
import type { ApiAuthService } from "../api-auth-service.js";
export interface AuthRouteDeps {
    authService: ApiAuthService | null;
}
export declare function createAuthRoutes(deps: AuthRouteDeps): RouteDefinition[];
