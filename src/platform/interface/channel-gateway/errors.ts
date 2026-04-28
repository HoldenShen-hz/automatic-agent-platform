import { AppError, PolicyDeniedError } from "../../contracts/errors.js";
import type { ChannelGatewayDeliveryService } from "./channel-gateway-delivery-service.js";

export class GatewayRateLimitError extends PolicyDeniedError {
  public constructor(
    public readonly channel: string,
    public readonly retryAfterMs: number,
    public readonly limit: number,
    public readonly currentCount: number,
  ) {
    super("gateway.rate_limited", "gateway.rate_limited", {
      statusCode: 429,
      retryable: true,
      details: { channel, retryAfterMs, limit, currentCount },
    });
    this.name = "GatewayRateLimitError";
  }
}

export class GatewayDeliveryError extends AppError {
  public constructor(
    message: string,
    public readonly responseStatus: number | null,
    retryable: boolean,
  ) {
    super(message, message, {
      statusCode: responseStatus ?? 502,
      retryable,
      category: "external",
      source: "gateway",
      details: { responseStatus },
    });
    this.name = "GatewayDeliveryError";
  }
}

export function normalizeGatewayDeliveryFailure(
  error: unknown,
  deliveryService: ChannelGatewayDeliveryService,
): {
  responseStatus?: number | null;
  errorMessage?: string | null;
  retryable: boolean;
} {
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
    const statusMatch = error.message.match(/(?::|^)(\d{3})(?::|$)/);
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
