import { AppError, PolicyDeniedError } from "../../contracts/errors.js";
import type { ChannelGatewayDeliveryService } from "./channel-gateway-delivery-service.js";
export declare class GatewayRateLimitError extends PolicyDeniedError {
    readonly channel: string;
    readonly retryAfterMs: number;
    readonly limit: number;
    readonly currentCount: number;
    constructor(channel: string, retryAfterMs: number, limit: number, currentCount: number);
}
export declare class GatewayDeliveryError extends AppError {
    readonly responseStatus: number | null;
    constructor(message: string, responseStatus: number | null, retryable: boolean);
}
export declare function normalizeGatewayDeliveryFailure(error: unknown, deliveryService: ChannelGatewayDeliveryService): {
    responseStatus?: number | null;
    errorMessage?: string | null;
    retryable: boolean;
};
