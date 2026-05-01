/**
 * @fileoverview Gateway Routes - Gateway target and message endpoints.
 *
 * Routes:
 * - GET /v1/gateway/targets
 * - GET /v1/gateway/targets/resolve
 * - POST /v1/gateway/messages/send
 * - POST /v1/gateway/webhooks/receive
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */

import type { RouteDefinition } from "./types.js";
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import { parseGatewaySendPayload, parseGatewayWebhookPayload } from "./schemas.js";
import { buildJsonResponse, requirePrincipal, readLimit, readQueryParam } from "./utils.js";
import { globalIdempotencyMiddleware } from "../middleware/sanitize.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { GatewayTargetDirectoryService } from "../../channel-gateway/gateway-target-directory-service.js";
import type { ChannelGatewayService } from "../../channel-gateway/channel-gateway-service.js";
import type { ChannelGatewayDeliveryService } from "../../channel-gateway/channel-gateway-delivery-service.js";
import { AppError } from "../../../contracts/errors.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

class ApiError extends AppError {
  public constructor(statusCode: number, code: string, message: string) {
    super(code, message, {
      statusCode,
      category: statusCode >= 500 ? "internal" : statusCode >= 400 ? "validation" : "external",
      source: "gateway",
      retryable: statusCode >= 500 || statusCode === 429,
    });
    this.name = "ApiError";
  }
}

export interface GatewayRouteDeps {
  authService: ApiAuthService | null;
  gatewayTargetDirectoryService: GatewayTargetDirectoryService | null;
  channelGatewayService: ChannelGatewayService | null;
  channelGatewayDeliveryService: ChannelGatewayDeliveryService | null;
  webhookSecret: string | null;
}

export function createGatewayRoutes(deps: GatewayRouteDeps): RouteDefinition[] {
  return [
    {
      method: "GET",
      pathname: "/v1/gateway/targets",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const limit = readLimit(ctx.request, 50);
        const channel = readQueryParam(ctx.request, "channel", { maxLength: 64, pattern: /^[a-zA-Z0-9._:-]+$/ });
        const query = readQueryParam(ctx.request, "query", { maxLength: 256 });
        const svc = deps.gatewayTargetDirectoryService;
        if (svc == null) {
          throw new ApiError(503, "api.gateway_targets_unavailable", "Gateway target directory is not configured.");
        }
        return buildJsonResponse(ctx.requestId, 200, {
          targets: svc.listTargets({
            ...(channel ? { channel } : {}),
            ...(query ? { query } : {}),
            limit,
          }),
        });
      },
    },
    {
      method: "GET",
      pathname: "/v1/gateway/targets/resolve",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const query = readQueryParam(ctx.request, "query", { required: true, maxLength: 256 });
        const channel = readQueryParam(ctx.request, "channel", { maxLength: 64, pattern: /^[a-zA-Z0-9._:-]+$/ });
        const svc = deps.gatewayTargetDirectoryService;
        if (svc == null) {
          throw new ApiError(503, "api.gateway_targets_unavailable", "Gateway target directory is not configured.");
        }
        return buildJsonResponse(
          ctx.requestId,
          200,
          svc.resolveTarget({
            query: query!,
            ...(channel ? { channel } : {}),
          }),
        );
      },
    },
    {
      method: "POST",
      pathname: "/v1/gateway/messages/send",
      handler: async (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "operator");

        // #2360: Check idempotency key to prevent duplicate sends
        const idempotencyKey = ctx.request.headers["x-idempotency-key"] as string | undefined;
        if (idempotencyKey) {
          const idempotencyCheck = globalIdempotencyMiddleware.check(idempotencyKey);
          if (idempotencyCheck.isDuplicate && idempotencyCheck.result !== undefined) {
            return buildJsonResponse(ctx.requestId, 200, idempotencyCheck.result);
          }
        }

        const channelGatewayService = deps.channelGatewayService;
        if (channelGatewayService == null) {
          throw new ApiError(503, "api.gateway_delivery_unavailable", "Channel gateway service is not configured.");
        }
        const payload = parseGatewaySendPayload(readValidatedJsonBody(ctx.request.body, (body) => body));
        const receipt = await channelGatewayService.sendMessage(payload);

        // #2359: POST that creates a resource should return 201 Created
        const responseData = {
          deliveredAt: receipt.deliveredAt,
          channel: receipt.channel,
          targetId: receipt.targetId,
          externalTargetId: receipt.externalTargetId,
          requestUrl: receipt.requestUrl,
          providerMessageId: receipt.providerMessageId,
        };

        // Record idempotency key result if key was provided
        if (idempotencyKey) {
          globalIdempotencyMiddleware.complete(idempotencyKey, responseData);
        }

        return buildJsonResponse(ctx.requestId, 201, responseData);
      },
    },
    {
      method: "POST",
      pathname: "/v1/gateway/webhooks/receive",
      handler: async (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "operator");
        const deliveryService = deps.channelGatewayDeliveryService;
        if (deliveryService == null) {
          throw new ApiError(503, "api.gateway_delivery_unavailable", "Channel gateway delivery service is not configured.");
        }

        const body = ctx.request.body ?? "";
        const payloadText = typeof body === "string" ? body : JSON.stringify(body);

        const signature = ctx.request.headers["x-webhook-signature"] as string | undefined ?? null;
        const timestamp = ctx.request.headers["x-webhook-timestamp"] as string | undefined ?? null;
        const nonce = ctx.request.headers["x-webhook-nonce"] as string | undefined ?? null;

        const webhookSecret = deps.webhookSecret ?? null;
        if (webhookSecret != null) {
          if (!signature) {
            throw new ApiError(401, "gateway.signature_required", "Webhook request must include x-webhook-signature header.");
          }
          const signatureResult = deliveryService.verifySignature(
            payloadText,
            signature,
            timestamp,
            { secret: webhookSecret, toleranceSeconds: 300 },
          );
          if (!signatureResult.valid) {
            throw new ApiError(401, "gateway.signature_invalid", signatureResult.error ?? "Invalid signature");
          }
        } else if (signature) {
          // §213-2357: CRITICAL SECURITY - webhookSecret is null but signature was provided.
          // This indicates a misconfiguration where signature verification is skipped.
          // REJECT the request instead of silently continuing.
          logger.error("WEBHOOK SECURITY MISCONFIGURATION: signature provided but webhookSecret is not configured. Rejecting request.", {
            hasSignature: true,
            hasTimestamp: !!timestamp,
          });
          throw new ApiError(500, "gateway.signature_config_invalid", "Webhook signature verification cannot be performed because webhookSecret is not configured. Contact system administrator.");
        }

        if (nonce) {
          const nonceResult = deliveryService.verifyNonce(nonce, 300);
          if (!nonceResult.valid) {
            throw new ApiError(401, "gateway.nonce_reused", nonceResult.error ?? "Nonce already used");
          }
        }

        let webhookPayload: Record<string, unknown>;
        try {
          webhookPayload = readValidatedJsonBody(payloadText, parseGatewayWebhookPayload);
        } catch (err) {
          logger.warn("parseWebhookPayload failed", { error: err });
          if (err instanceof AppError && err.code === "api.invalid_json") {
            throw new ApiError(400, "gateway.invalid_payload", "Webhook payload must be valid JSON");
          }
          throw err;
        }

        const targetId = typeof webhookPayload.targetId === "string" ? webhookPayload.targetId : "unknown";
        const channel = typeof webhookPayload.channel === "string" ? webhookPayload.channel : "webhook";
        const receipt = deliveryService.createDeliveryMessage(channel, targetId, webhookPayload);
        deliveryService.recordAttempt(receipt.messageId, 1, "success", 200, undefined, receipt.providerMessageId);

        return buildJsonResponse(ctx.requestId, 200, {
          received: true,
          messageId: receipt.messageId,
          channel,
          targetId,
          status: receipt.status,
        });
      },
    },
  ];
}
