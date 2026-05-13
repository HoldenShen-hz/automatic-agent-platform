/**
 * @fileoverview Billing Routes - Billing webhook and reconciliation endpoints.
 *
 * Routes:
 * - POST /v1/billing/webhooks/reconcile
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */

import { timingSafeEqual } from "node:crypto";
import type { RouteDefinition } from "./types.js";
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import { parseBillingReconcilePayload } from "./schemas.js";
import { buildJsonResponse } from "./utils.js";
import type { BillingService } from "../../../../scale-ecosystem/billing/billing-service.js";
import { AppError } from "../../../contracts/errors.js";
import type { ApiAuthService } from "../api-auth-service.js";
import { authenticateOptionalPrincipal } from "./request-helpers.js";

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

export interface BillingRouteDeps {
  billingService: BillingService | null;
  webhookSecret: string | null;
  authService?: ApiAuthService | null;
}

function handleReconcileWebhook(
  ctx: import("./types.js").RouteContext,
  deps: BillingRouteDeps,
  payload: ReturnType<typeof parseBillingReconcilePayload>,
) {
  const billingService = deps.billingService;
  if (billingService == null) {
    throw new ApiError(503, "api.billing_unavailable", "Billing service is not configured.");
  }

  const authenticatedPrincipal = authenticateOptionalPrincipal(ctx.request, deps.authService ?? null);
  const signature = ctx.request.headers["x-webhook-signature"] as string | undefined;
  const expected = deps.webhookSecret;
  if (typeof expected !== "string" || expected.length === 0) {
    throw new ApiError(401, "api.webhook_signature_invalid", "Webhook signature is invalid.");
  }
  if (authenticatedPrincipal == null) {
    if (typeof signature !== "string" || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new ApiError(401, "api.webhook_signature_invalid", "Webhook signature is invalid.");
    }
  }

  const result = billingService.reconcilePaymentSession({
    gatewayKind: payload.gatewayKind,
    gatewaySessionRef: payload.gatewaySessionRef,
    status: payload.status,
    ...(payload.occurredAt ? { occurredAt: payload.occurredAt } : {}),
    ...(payload.failureCode ? { failureCode: payload.failureCode } : {}),
  });
  return buildJsonResponse(ctx.requestId, 200, result);
}

export function createBillingRoutes(deps: BillingRouteDeps): RouteDefinition[] {
  return [
    {
      method: "POST",
      pathname: "/billing/webhooks/reconcile",
      handler: (ctx) => {
        const payload = parseBillingReconcilePayload(readValidatedJsonBody(ctx.request.body, (body) => body));
        const response = handleReconcileWebhook(ctx, deps, payload);
        // R14-20: Mark legacy route as deprecated
        response.headers["Deprecation"] = "true";
        response.headers["Sunset"] = "Sat, 31 Dec 2026 23:59:59 GMT";
        response.headers["X-API-Version"] = "v1";
        return response;
      },
    },
    {
      method: "POST",
      pathname: "/v1/billing/webhooks/reconcile",
      handler: (ctx) => {
        const payload = parseBillingReconcilePayload(readValidatedJsonBody(ctx.request.body, (body) => body));
        return handleReconcileWebhook(ctx, deps, payload);
      },
    },
  ];
}
