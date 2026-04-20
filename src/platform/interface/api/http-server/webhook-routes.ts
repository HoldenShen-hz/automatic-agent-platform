/**
 * @fileoverview Webhook Routes - Webhook endpoint management endpoints.
 *
 * Routes:
 * - GET /webhooks
 * - POST /webhooks
 * - DELETE /webhooks/:id
 * - GET /v1/webhooks
 * - POST /v1/webhooks
 * - DELETE /v1/webhooks/:id
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */

import type { RouteDefinition } from "./types.js";
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import { parseCreateWebhookEndpointPayload } from "./schemas.js";
import { buildJsonResponse, requirePrincipal, validateTaskId } from "./utils.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { WebhookIngressService } from "../../webhook/index.js";
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

export interface WebhookRouteDeps {
  authService: ApiAuthService | null;
  webhookIngressService: WebhookIngressService;
}

export function createWebhookRoutes(deps: WebhookRouteDeps): RouteDefinition[] {
  return [
    // ── Non-v1 (backward-compatible) ──────────────────────────────────────────
    {
      method: "GET",
      pathname: "/webhooks",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const endpoints = deps.webhookIngressService.listEndpoints();
        return buildJsonResponse(ctx.requestId, 200, { webhooks: endpoints });
      },
    },
    {
      method: "POST",
      pathname: "/webhooks",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "operator");
        const payload = parseCreateWebhookEndpointPayload(
          readValidatedJsonBody(ctx.request.body, (b) => b),
        );
        const registration = deps.webhookIngressService.registerEndpoint({
          endpointId: payload.endpointId,
          source: payload.source,
          tenantId: null,
          workspaceId: null,
          enabled: payload.enabled ?? true,
          allowedEventTypes: payload.allowedEventTypes ?? [],
          algorithm: payload.algorithm ?? "none",
          ...(payload.signingSecret != null ? { signingSecret: payload.signingSecret } : {}),
          ...(payload.signatureHeader != null ? { signatureHeader: payload.signatureHeader } : {}),
          ...(payload.idempotencyHeader != null ? { idempotencyHeader: payload.idempotencyHeader } : {}),
          ...(payload.dispatchTargetRef != null ? { dispatchTargetRef: payload.dispatchTargetRef } : {}),
        });
        return buildJsonResponse(ctx.requestId, 201, { webhook: registration });
      },
    },
    {
      method: "DELETE",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (segments[0] !== "webhooks" || segments.length !== 2) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "admin");
        const endpointId = segments[1];
        if (!endpointId) {
          throw new ApiError(400, "webhook.invalid_endpoint_id", "Webhook endpoint ID is required.");
        }
        const deleted = deps.webhookIngressService.deleteEndpoint(endpointId);
        if (!deleted) {
          throw new ApiError(404, "webhook.endpoint_not_found", "Webhook endpoint not found.");
        }
        return buildJsonResponse(ctx.requestId, 200, { endpointId, deleted: true });
      },
    },
    // ── v1 ───────────────────────────────────────────────────────────────────
    {
      method: "GET",
      pathname: "/v1/webhooks",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const endpoints = deps.webhookIngressService.listEndpoints();
        return buildJsonResponse(ctx.requestId, 200, { webhooks: endpoints });
      },
    },
    {
      method: "POST",
      pathname: "/v1/webhooks",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "operator");
        const payload = parseCreateWebhookEndpointPayload(
          readValidatedJsonBody(ctx.request.body, (b) => b),
        );
        const registration = deps.webhookIngressService.registerEndpoint({
          endpointId: payload.endpointId,
          source: payload.source,
          tenantId: null,
          workspaceId: null,
          enabled: payload.enabled ?? true,
          allowedEventTypes: payload.allowedEventTypes ?? [],
          algorithm: payload.algorithm ?? "none",
          ...(payload.signingSecret != null ? { signingSecret: payload.signingSecret } : {}),
          ...(payload.signatureHeader != null ? { signatureHeader: payload.signatureHeader } : {}),
          ...(payload.idempotencyHeader != null ? { idempotencyHeader: payload.idempotencyHeader } : {}),
          ...(payload.dispatchTargetRef != null ? { dispatchTargetRef: payload.dispatchTargetRef } : {}),
        });
        return buildJsonResponse(ctx.requestId, 201, { webhook: registration });
      },
    },
    {
      method: "DELETE",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (segments[0] !== "v1" || segments[1] !== "webhooks" || segments.length !== 3) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "admin");
        const endpointId = segments[2];
        if (!endpointId) {
          throw new ApiError(400, "webhook.invalid_endpoint_id", "Webhook endpoint ID is required.");
        }
        const deleted = deps.webhookIngressService.deleteEndpoint(endpointId);
        if (!deleted) {
          throw new ApiError(404, "webhook.endpoint_not_found", "Webhook endpoint not found.");
        }
        return buildJsonResponse(ctx.requestId, 200, { endpointId, deleted: true });
      },
    },
  ];
}
