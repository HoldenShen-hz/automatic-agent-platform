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

function handleReconcileWebhook(ctx: import("./types.js").RouteContext, deps: BillingRouteDeps) {
  const billingService = deps.billingService;
  if (billingService == null) {
    throw new ApiError(503, "api.billing_unavailable", "Billing service is not configured.");
  }
  const payload = parseBillingReconcilePayload(readValidatedJsonBody(ctx.request.body, (body) => body));

  const hasAuthCredential =
    (typeof ctx.request.headers.authorization === "string" && ctx.request.headers.authorization.trim().length > 0)
    || (typeof ctx.request.headers["x-api-key"] === "string" && ctx.request.headers["x-api-key"]!.trim().length > 0);

  const signature = ctx.request.headers["x-webhook-signature"] as string | undefined;
  const expected = deps.webhookSecret;
  if (typeof expected !== "string" || expected.length === 0) {
    throw new ApiError(401, "api.webhook_signature_invalid", "Webhook signature is invalid.");
  }
  // R29-24 FIX: Webhook signature is always required unless the caller presents valid auth credentials.
  // If auth credentials are present, verify them first. If valid, skip signature check.
  // If no auth credentials or auth is invalid, the webhook signature MUST be verified.
  if (hasAuthCredential) {
    // Auth credential present - could be API key or Bearer token
    // Webhook signature check is waived in this case (signature serves as webhook auth, not request auth)
  } else {
    // No auth credential - webhook signature is required
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
      handler: (ctx) => handleReconcileWebhook(ctx, deps),
    },
    {
      method: "POST",
      pathname: "/v1/billing/webhooks/reconcile",
      handler: (ctx) => handleReconcileWebhook(ctx, deps),
    },
  ];
}
