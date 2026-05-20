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
import { AppError } from "../../../contracts/errors.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { BillingService } from "../api-external-support.js";

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

const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;

function isTimingSafeHexEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) {
    return false;
  }
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeWebhookSignature(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("sha256=") ? trimmed.slice("sha256=".length) : trimmed;
}

function verifyWebhookSignature(
  ctx: import("./types.js").RouteContext,
  secret: string,
): void {
  const timestampHeader = ctx.request.headers["x-webhook-timestamp"];
  const signatureHeader = ctx.request.headers["x-webhook-signature"];
  if (typeof timestampHeader !== "string" || typeof signatureHeader !== "string") {
    throw new ApiError(401, "api.webhook_signature_invalid", "Webhook signature is invalid.");
  }

  const issuedAtMs = Number(timestampHeader) * 1000;
  if (!Number.isFinite(issuedAtMs) || Math.abs(Date.now() - issuedAtMs) > MAX_WEBHOOK_AGE_MS) {
    throw new ApiError(401, "api.webhook_timestamp_invalid", "Webhook timestamp is invalid.");
  }

  const payload = ctx.request.body ?? "";
  const expected = createHmac("sha256", secret)
    .update(timestampHeader)
    .update(".")
    .update(payload)
    .digest("hex");

  const normalizedSignature = normalizeWebhookSignature(signatureHeader);
  if (!isTimingSafeHexEqual(normalizedSignature.toLowerCase(), expected)) {
    throw new ApiError(401, "api.webhook_signature_invalid", "Webhook signature is invalid.");
  }
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

  const expected = deps.webhookSecret;
  if (typeof expected !== "string" || expected.length === 0) {
    throw new ApiError(401, "api.webhook_signature_invalid", "Webhook signature is invalid.");
  }
  verifyWebhookSignature(ctx, expected);

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
      pathname: "/v1/billing/webhooks/reconcile",
      handler: (ctx) => {
        const payload = parseBillingReconcilePayload(readValidatedJsonBody(ctx.request.body, (body) => body));
        return handleReconcileWebhook(ctx, deps, payload);
      },
    },
  ];
}
