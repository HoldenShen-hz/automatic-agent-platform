/**
 * @fileoverview Billing Routes - Billing webhook and reconciliation endpoints.
 *
 * Routes:
 * - POST /v1/billing/webhooks/reconcile
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
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

function verifyWebhookSignature(
  payloadText: string,
  signature: string | null,
  timestamp: string | null,
  secret: string | null,
): boolean {
  if (!signature || !secret) {
    return false;
  }
  const signedPayload = timestamp ? `${timestamp}.${payloadText}` : payloadText;
  const expectedSignature = createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");
  try {
    const signatureBuffer = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

function buildReconcileResponse(
  ctx: { requestId: string; request: { headers: Record<string, string | undefined> } },
  deps: BillingRouteDeps,
  payloadText: string,
  payload: ReturnType<typeof parseBillingReconcilePayload>,
) {
  const billingService = deps.billingService;
  if (billingService == null) {
    throw new ApiError(503, "api.billing_unavailable", "Billing service is not configured.");
  }

  const signature = ctx.request.headers["x-webhook-signature"] ?? null;
  const timestamp = ctx.request.headers["x-webhook-timestamp"] ?? null;
  if (typeof signature !== "string" || signature.length === 0) {
    throw new ApiError(401, "api.webhook_signature_required", "Webhook signature is required.");
  }
  if (!verifyWebhookSignature(payloadText, signature, timestamp, deps.webhookSecret)) {
    throw new ApiError(401, "api.webhook_signature_invalid", "Webhook signature is invalid.");
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
        const payloadText = typeof ctx.request.body === "string" ? ctx.request.body : JSON.stringify(ctx.request.body ?? {});
        const payload = parseBillingReconcilePayload(readValidatedJsonBody(payloadText, (body) => body));
        const result = buildReconcileResponse(ctx, deps, payloadText, payload);
        return buildJsonResponse(ctx.requestId, 200, result);
      },
    },
  ];
}
