import assert from "node:assert/strict";
import test from "node:test";
import { GatewayRateLimitError, GatewayDeliveryError, normalizeGatewayDeliveryFailure, } from "../../../../../../src/platform/interface/channel-gateway/errors.js";
test("GatewayRateLimitError has correct properties", () => {
    const error = new GatewayRateLimitError("telegram_123", 5000, 100, 50);
    assert.equal(error.channel, "telegram_123");
    assert.equal(error.retryAfterMs, 5000);
    assert.equal(error.limit, 100);
    assert.equal(error.currentCount, 50);
    assert.equal(error.code, "gateway.rate_limited");
    assert.equal(error.name, "GatewayRateLimitError");
    assert.equal(error.statusCode, 429);
    assert.equal(error.retryable, true);
});
test("GatewayRateLimitError details contain all fields", () => {
    const error = new GatewayRateLimitError("slack_456", 3000, 200, 150);
    assert.equal(error.internalDetails?.channel, "slack_456");
    assert.equal(error.internalDetails?.retryAfterMs, 3000);
    assert.equal(error.internalDetails?.limit, 200);
    assert.equal(error.internalDetails?.currentCount, 150);
});
test("GatewayDeliveryError has correct properties", () => {
    const error = new GatewayDeliveryError("Connection timeout", 504, true);
    assert.equal(error.message, "Connection timeout");
    assert.equal(error.responseStatus, 504);
    assert.equal(error.retryable, true);
    assert.equal(error.statusCode, 504); // Uses responseStatus when provided
    assert.equal(error.category, "external");
    assert.equal(error.source, "gateway");
    assert.equal(error.name, "GatewayDeliveryError");
});
test("GatewayDeliveryError handles null response status", () => {
    const error = new GatewayDeliveryError("Unknown error", null, false);
    assert.equal(error.responseStatus, null);
    assert.equal(error.statusCode, 502);
    assert.equal(error.retryable, false);
});
test("normalizeGatewayDeliveryFailure handles GatewayDeliveryError", () => {
    const mockDeliveryService = {
        isRetryableStatus: (status) => status >= 500,
    };
    const error = new GatewayDeliveryError("Server error", 503, true);
    const result = normalizeGatewayDeliveryFailure(error, mockDeliveryService);
    assert.equal(result.responseStatus, 503);
    assert.equal(result.errorMessage, "Server error");
    assert.equal(result.retryable, true);
});
test("normalizeGatewayDeliveryFailure handles GatewayRateLimitError", () => {
    const mockDeliveryService = {
        isRetryableStatus: (_status) => true,
    };
    const error = new GatewayRateLimitError("telegram_123", 5000, 100, 50);
    const result = normalizeGatewayDeliveryFailure(error, mockDeliveryService);
    assert.equal(result.errorMessage, "gateway.rate_limited");
    assert.equal(result.retryable, true);
});
test("normalizeGatewayDeliveryFailure parses status from error message", () => {
    const mockDeliveryService = {
        isRetryableStatus: (status) => status >= 500,
    };
    const error = new Error("Failed to connect:503");
    const result = normalizeGatewayDeliveryFailure(error, mockDeliveryService);
    assert.equal(result.responseStatus, 503);
    assert.equal(result.errorMessage, "Failed to connect:503");
    assert.equal(result.retryable, true);
});
test("normalizeGatewayDeliveryFailure uses deliveryService for retryable check", () => {
    const mockDeliveryService = {
        isRetryableStatus: (status) => status !== 404, // 404 is not retryable
    };
    const error = new Error("Not found:404");
    const result = normalizeGatewayDeliveryFailure(error, mockDeliveryService);
    assert.equal(result.responseStatus, 404);
    assert.equal(result.retryable, false); // 404 is not retryable per mock
});
test("normalizeGatewayDeliveryFailure defaults to retryable for unknown errors", () => {
    const mockDeliveryService = {
        isRetryableStatus: (_status) => false,
    };
    const error = new Error("Something went wrong");
    const result = normalizeGatewayDeliveryFailure(error, mockDeliveryService);
    assert.equal(result.responseStatus, null);
    assert.equal(result.errorMessage, "Something went wrong");
    assert.equal(result.retryable, true); // defaults to true
});
test("normalizeGatewayDeliveryFailure handles non-Error objects", () => {
    const mockDeliveryService = {
        isRetryableStatus: (_status) => false,
    };
    const result = normalizeGatewayDeliveryFailure("string error", mockDeliveryService);
    assert.equal(result.errorMessage, "string error");
    assert.equal(result.retryable, true);
});
test("normalizeGatewayDeliveryFailure handles null and undefined", () => {
    const mockDeliveryService = {
        isRetryableStatus: (_status) => false,
    };
    const resultNull = normalizeGatewayDeliveryFailure(null, mockDeliveryService);
    assert.equal(resultNull.errorMessage, "null");
    assert.equal(resultNull.retryable, true);
    const resultUndefined = normalizeGatewayDeliveryFailure(undefined, mockDeliveryService);
    assert.equal(resultUndefined.errorMessage, "undefined");
    assert.equal(resultUndefined.retryable, true);
});
//# sourceMappingURL=errors.test.js.map