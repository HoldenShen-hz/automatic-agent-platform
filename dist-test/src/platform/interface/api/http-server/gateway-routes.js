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
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import { parseGatewaySendPayload, parseGatewayWebhookPayload } from "./schemas.js";
import { buildJsonResponse, requirePrincipal, readLimit, readQueryParam } from "./utils.js";
import { AppError } from "../../../contracts/errors.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
class ApiError extends AppError {
    constructor(statusCode, code, message) {
        super(code, message, {
            statusCode,
            category: statusCode >= 500 ? "internal" : statusCode >= 400 ? "validation" : "external",
            source: "gateway",
            retryable: statusCode >= 500 || statusCode === 429,
        });
        this.name = "ApiError";
    }
}
export function createGatewayRoutes(deps) {
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
                return buildJsonResponse(ctx.requestId, 200, svc.resolveTarget({
                    query: query,
                    ...(channel ? { channel } : {}),
                }));
            },
        },
        {
            method: "POST",
            pathname: "/v1/gateway/messages/send",
            handler: async (ctx) => {
                requirePrincipal(ctx.request, deps.authService, "operator");
                const channelGatewayService = deps.channelGatewayService;
                if (channelGatewayService == null) {
                    throw new ApiError(503, "api.gateway_delivery_unavailable", "Channel gateway service is not configured.");
                }
                const payload = parseGatewaySendPayload(readValidatedJsonBody(ctx.request.body, (body) => body));
                const receipt = await channelGatewayService.sendMessage(payload);
                return buildJsonResponse(ctx.requestId, 200, {
                    deliveredAt: receipt.deliveredAt,
                    channel: receipt.channel,
                    targetId: receipt.targetId,
                    externalTargetId: receipt.externalTargetId,
                    requestUrl: receipt.requestUrl,
                    providerMessageId: receipt.providerMessageId,
                });
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
                const signature = ctx.request.headers["x-webhook-signature"] ?? null;
                const timestamp = ctx.request.headers["x-webhook-timestamp"] ?? null;
                const nonce = ctx.request.headers["x-webhook-nonce"] ?? null;
                const webhookSecret = deps.webhookSecret ?? null;
                if (webhookSecret != null) {
                    if (!signature) {
                        throw new ApiError(401, "gateway.signature_required", "Webhook request must include x-webhook-signature header.");
                    }
                    const signatureResult = deliveryService.verifySignature(payloadText, signature, timestamp, { secret: webhookSecret, toleranceSeconds: 300 });
                    if (!signatureResult.valid) {
                        throw new ApiError(401, "gateway.signature_invalid", signatureResult.error ?? "Invalid signature");
                    }
                }
                if (nonce) {
                    const nonceResult = deliveryService.verifyNonce(nonce, 300);
                    if (!nonceResult.valid) {
                        throw new ApiError(401, "gateway.nonce_reused", nonceResult.error ?? "Nonce already used");
                    }
                }
                let webhookPayload;
                try {
                    webhookPayload = readValidatedJsonBody(payloadText, parseGatewayWebhookPayload);
                }
                catch (err) {
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
//# sourceMappingURL=gateway-routes.js.map