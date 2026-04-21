import { AppError, PolicyDeniedError } from "../../contracts/errors.js";
export class GatewayRateLimitError extends PolicyDeniedError {
    channel;
    retryAfterMs;
    limit;
    currentCount;
    constructor(channel, retryAfterMs, limit, currentCount) {
        super("gateway.rate_limited", "gateway.rate_limited", {
            statusCode: 429,
            retryable: true,
            details: { channel, retryAfterMs, limit, currentCount },
        });
        this.channel = channel;
        this.retryAfterMs = retryAfterMs;
        this.limit = limit;
        this.currentCount = currentCount;
        this.name = "GatewayRateLimitError";
    }
}
export class GatewayDeliveryError extends AppError {
    responseStatus;
    constructor(message, responseStatus, retryable) {
        super(message, message, {
            statusCode: responseStatus ?? 502,
            retryable,
            category: "external",
            source: "gateway",
            details: { responseStatus },
        });
        this.responseStatus = responseStatus;
        this.name = "GatewayDeliveryError";
    }
}
export function normalizeGatewayDeliveryFailure(error, deliveryService) {
    if (error instanceof GatewayDeliveryError) {
        return {
            responseStatus: error.responseStatus,
            errorMessage: error.message,
            retryable: error.retryable,
        };
    }
    if (error instanceof GatewayRateLimitError) {
        return {
            errorMessage: error.message,
            retryable: true,
        };
    }
    if (error instanceof Error) {
        const statusMatch = error.message.match(/:(\d{3})$/);
        const responseStatus = statusMatch ? Number(statusMatch[1]) : null;
        if (responseStatus != null) {
            return {
                responseStatus,
                errorMessage: error.message,
                retryable: deliveryService.isRetryableStatus(responseStatus),
            };
        }
        return {
            responseStatus: null,
            errorMessage: error.message,
            retryable: true,
        };
    }
    return {
        errorMessage: String(error),
        retryable: true,
    };
}
//# sourceMappingURL=errors.js.map