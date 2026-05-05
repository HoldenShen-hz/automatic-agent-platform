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
}

function buildReconcileResponse(ctx: { requestId: string; request: { headers: Record<string, string | undefined> } }, deps: BillingRouteDeps, payload: ReturnType<typeof parseBillingReconcilePayload>) {
  const billingService = deps.billingService;
  if (billingService == null) {
    throw new ApiError(503, "api.billing_unavailable", "Billing service is not configured.");
  }

  // R20-18 fix: Proper HMAC validation - require valid signature for webhook endpoints
  const hasAuthCredential =
    (typeof ctx.request.headers.authorization === "string" && ctx.request.headers.authorization.trim().length > 0)
    || (typeof ctx.request.headers["x-api-key"] === "string" && ctx.request.headers["x-api-key"]!.trim().length > 0);

  const signature = ctx.request.headers["x-webhook-signature"] as string | undefined;
  const expected = deps.webhookSecret;

  // Billing webhooks MUST have a valid HMAC signature - auth credentials alone don't suffice
  if (typeof signature === "string" && signature.length > 0) {
    if (typeof expected !== "string" || expected.length === 0) {
      throw new ApiError(401, "api.webhook_signature_invalid", "Webhook signature is invalid.");
    }
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new ApiError(401, "api.webhook_signature_invalid", "Webhook signature is invalid.");
    }
  } else {
    // No signature provided - reject regardless of auth credentials
    // Webhook endpoints require HMAC signature, not just auth headers
    throw new ApiError(401, "api.webhook_signature_required", "Webhook signature is required.");
  }

  return billingService.reconcilePaymentSession({
    gatewayKind: payload.gatewayKind,
    gatewaySessionRef: payload.gatewaySessionRef,
    status: payload.status,
    ...(payload.occurredAt ? { occurredAt: payload.occurredAt } : {}),
    ...(payload.failureCode ? { failureCode: payload.failureCode } : {}),
  });
}

export function createBillingRoutes(deps: BillingRouteDeps): RouteDefinition[] {
  return [
    // Versioned current route
    {
      method: "POST",
      pathname: "/v1/billing/webhooks/reconcile",
      handler: (ctx) => {
        const payload = parseBillingReconcilePayload(readValidatedJsonBody(ctx.request.body, (body) => body));
        const result = buildReconcileResponse(ctx, deps, payload);
        return buildJsonResponse(ctx.requestId, 200, result);
      },
    },
  ];
}
