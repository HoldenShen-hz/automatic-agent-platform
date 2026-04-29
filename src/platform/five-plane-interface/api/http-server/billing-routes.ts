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

const DEPRECATION_HEADERS = Object.freeze({
  Deprecation: "true",
  Sunset: "Sat, 01 Jan 2028 00:00:00 GMT",
  "Content-Type": "application/json",
});

function buildReconcileResponse(ctx: { requestId: string }, deps: BillingRouteDeps, payload: ReturnType<typeof parseBillingReconcilePayload>) {
  const billingService = deps.billingService;
  if (billingService == null) {
    throw new ApiError(503, "api.billing_unavailable", "Billing service is not configured.");
  }

  const hasAuthCredential =
    (typeof ctx.request.headers.authorization === "string" && ctx.request.headers.authorization.trim().length > 0)
    || (typeof ctx.request.headers["x-api-key"] === "string" && ctx.request.headers["x-api-key"]!.trim().length > 0);

  if (!hasAuthCredential) {
    const signature = ctx.request.headers["x-webhook-signature"] as string | undefined;
    const expected = deps.webhookSecret;
    if (typeof expected !== "string" || expected.length === 0) {
      throw new ApiError(401, "api.webhook_signature_invalid", "Webhook signature is invalid.");
    }
    if (typeof signature !== "string" || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new ApiError(401, "api.webhook_signature_invalid", "Webhook signature is invalid.");
    }
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
    // Legacy unversioned route - deprecated with sunset headers
    {
      method: "POST",
      pathname: "/billing/webhooks/reconcile",
      handler: (ctx) => {
        const payload = parseBillingReconcilePayload(readValidatedJsonBody(ctx.request.body, (body) => body));
        const result = buildReconcileResponse(ctx, deps, payload);
        const response = buildJsonResponse(ctx.requestId, 200, result);
        return {
          ...response,
          headers: {
            ...response.headers,
            ...DEPRECATION_HEADERS,
          },
        };
      },
    },
    // Versioned current route
    {
      method: "POST",
      pathname: "/v1/billing/webhooks/reconcile",
      handler: (ctx) => {
        const payload = parseBillingReconcilePayload(readValidatedJsonBody(ctx.request.body, (body) => body));
        return buildReconcileResponse(ctx, deps, payload);
      },
    },
  ];
}
