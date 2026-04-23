import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GatewayRateLimitError, GatewayDeliveryError, normalizeGatewayDeliveryFailure } from "../../../../../src/platform/interface/channel-gateway/errors.js";
import { PolicyDeniedError } from "../../../../../src/platform/contracts/errors.js";

describe("channel-gateway/errors", () => {
  describe("GatewayRateLimitError", () => {
    it("should create error with correct properties", () => {
      const err = new GatewayRateLimitError("telegram", 5000, 100, 50);
      assert.equal(err.channel, "telegram");
      assert.equal(err.retryAfterMs, 5000);
      assert.equal(err.limit, 100);
      assert.equal(err.currentCount, 50);
      assert.equal(err.name, "GatewayRateLimitError");
    });

    it("should be retryable", () => {
      const err = new GatewayRateLimitError("slack", 3000, 50, 25);
      assert.ok(err.retryable === true);
    });

    it("should extend PolicyDeniedError", () => {
      const err = new GatewayRateLimitError("webhook", 1000, 10, 5);
      assert.ok(err instanceof PolicyDeniedError);
    });
  });

  describe("GatewayDeliveryError", () => {
    it("should create error with correct properties", () => {
      const err = new GatewayDeliveryError("Connection timeout", 504, true);
      assert.equal(err.message, "Connection timeout");
      assert.equal(err.responseStatus, 504);
      assert.ok(err.retryable === true);
      assert.equal(err.name, "GatewayDeliveryError");
    });

    it("should be retryable for 5xx errors", () => {
      const err = new GatewayDeliveryError("Internal error", 502, true);
      assert.ok(err.retryable === true);
    });

    it("should be non-retryable for 4xx errors", () => {
      const err = new GatewayDeliveryError("Bad request", 400, false);
      assert.ok(err.retryable === false);
    });

    it("should default to 502 status code", () => {
      const err = new GatewayDeliveryError("Unknown error", null, true);
      assert.equal(err.responseStatus, null);
      assert.equal(err.statusCode, 502);
    });
  });

  describe("normalizeGatewayDeliveryFailure", () => {
    it("should handle GatewayDeliveryError", () => {
      const deliveryErr = new GatewayDeliveryError("Server error", 503, true);
      const mockService = { isRetryableStatus: (s: number) => s >= 500 } as any;
      const result = normalizeGatewayDeliveryFailure(deliveryErr, mockService);
      assert.equal(result.responseStatus, 503);
      assert.equal(result.errorMessage, "Server error");
      assert.ok(result.retryable === true);
    });

    it("should handle GatewayRateLimitError", () => {
      const rateLimitErr = new GatewayRateLimitError("telegram", 5000, 100, 150);
      const mockService = { isRetryableStatus: () => false } as any;
      const result = normalizeGatewayDeliveryFailure(rateLimitErr, mockService);
      assert.equal(result.errorMessage, rateLimitErr.message);
      assert.ok(result.retryable === true);
    });

    it("should extract status from error message ending with :NNN", () => {
      const error = new Error("Failed to connect:502");
      const mockService = { isRetryableStatus: (s: number) => s >= 500 } as any;
      const result = normalizeGatewayDeliveryFailure(error, mockService);
      assert.equal(result.responseStatus, 502);
    });

    it("should handle plain Error with no status code", () => {
      const error = new Error("Something went wrong");
      const mockService = { isRetryableStatus: () => false } as any;
      const result = normalizeGatewayDeliveryFailure(error, mockService);
      assert.equal(result.responseStatus, null);
      assert.equal(result.errorMessage, "Something went wrong");
      assert.ok(result.retryable === true);
    });

    it("should handle non-Error values", () => {
      const mockService = { isRetryableStatus: () => false } as any;
      const result = normalizeGatewayDeliveryFailure("string error", mockService);
      assert.equal(result.errorMessage, "string error");
      assert.ok(result.retryable === true);
    });
  });
});
