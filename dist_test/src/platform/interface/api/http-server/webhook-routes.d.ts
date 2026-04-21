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
import type { ApiAuthService } from "../api-auth-service.js";
import type { WebhookIngressService } from "../../webhook/index.js";
export interface WebhookRouteDeps {
    authService: ApiAuthService | null;
    webhookIngressService: WebhookIngressService;
}
export declare function createWebhookRoutes(deps: WebhookRouteDeps): RouteDefinition[];
