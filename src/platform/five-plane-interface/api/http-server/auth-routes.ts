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
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import { parseAuthTokenPayload } from "./schemas.js";
import { buildJsonResponse } from "./utils.js";
import type { ApiAuthService } from "../api-auth-service.js";
import { AppError } from "../../../contracts/errors.js";

class ApiError extends AppError {
  public constructor(statusCode: number, code: string, message: string) {
    super(code, message, {
      statusCode,
      category: statusCode >= 500 ? "internal" : statusCode >= 400 ? "validation" : "external",
      source: "runtime",
      retryable: statusCode >= 500 || statusCode === 429,
    });
    this.name = "ApiError";
  }
}

export interface AuthRouteDeps {
  authService: ApiAuthService | null;
}

export function createAuthRoutes(deps: AuthRouteDeps): RouteDefinition[] {
  return [
    {
      method: "POST",
      pathname: "/auth/token",
      handler: (ctx) => {
        const authService = deps.authService;
        if (authService == null) {
          throw new ApiError(503, "api.auth_unavailable", "API auth service is not configured.");
        }
        const payload = parseAuthTokenPayload(
          readValidatedJsonBody(ctx.request.body, (body) => body),
          typeof ctx.request.headers["x-api-key"] === "string" ? ctx.request.headers["x-api-key"] : undefined,
        );
        return buildJsonResponse(ctx.requestId, 200, authService.exchangeApiKey(payload.apiKey));
      },
    },
    {
      method: "POST",
      pathname: "/v1/auth/token",
      handler: (ctx) => {
        const authService = deps.authService;
        if (authService == null) {
          throw new ApiError(503, "api.auth_unavailable", "API auth service is not configured.");
        }
        const payload = parseAuthTokenPayload(
          readValidatedJsonBody(ctx.request.body, (body) => body),
          typeof ctx.request.headers["x-api-key"] === "string" ? ctx.request.headers["x-api-key"] : undefined,
        );
        return buildJsonResponse(ctx.requestId, 200, authService.exchangeApiKey(payload.apiKey));
      },
    },
  ];
}
