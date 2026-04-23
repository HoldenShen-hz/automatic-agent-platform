import assert from "node:assert/strict";
import test from "node:test";

import {
  GatewayRateLimitError,
  GatewayDeliveryError,
  normalizeGatewayDeliveryFailure,
} from "../../../../../src/platform/interface/channel-gateway/errors.js";

class MockDeliveryService {
  constructor(private retryableStatuses: number[] = [408, 429, 500, 502, 503, 504]) {}
  isRetryableStatus(status: number): boolean {
    return this.retryableStatuses.includes(status);
  }
}

test("GatewayRateLimitError has correct error properties", () => {
  const error = new GatewayRateLimitError("telegram", 5000, 30, 31);
  assert.equal(error.name, "GatewayRateLimitError");
  assert.equal(error.channel, "telegram");
  assert.equal(error.retryAfterMs, 5000);
  assert.equal(error.limit, 30);
  assert.equal(error.currentCount, 31);
  assert.equal(error.code, "gateway.rate_limited");
  assert.equal(error.statusCode, 429);
  assert.equal(error.retryable, true);
});

test("GatewayDeliveryError has correct error properties", () => {
  const error = new GatewayDeliveryError("telegram delivery failed", 502, true);
  assert.equal(error.name, "GatewayDeliveryError");
  assert.equal(error.message, "telegram delivery failed");
  assert.equal(error.responseStatus, 502);
  assert.equal(error.statusCode, 502);
  assert.equal(error.retryable, true);
  assert.equal(error.category, "external");
  assert.equal(error.source, "gateway");
});

test("GatewayDeliveryError with null status defaults to 502", () => {
  const error = new GatewayDeliveryError("connection failed", null, true);
  assert.equal(error.statusCode, 502);
});

test("GatewayDeliveryError non-retryable errors have correct flag", () => {
  const error = new GatewayDeliveryError("bad request", 400, false);
  assert.equal(error.retryable, false);
});

test("normalizeGatewayDeliveryFailure with GatewayDeliveryError", () => {
  const deliveryService = new MockDeliveryService();
  const error = new GatewayDeliveryError("telegram failed:500", 500, true);
  const result = normalizeGatewayDeliveryFailure(error, deliveryService);

  assert.equal(result.responseStatus, 500);
  assert.equal(result.errorMessage, "telegram failed:500");
  assert.equal(result.retryable, true);
});

test("normalizeGatewayDeliveryFailure with GatewayRateLimitError", () => {
  const deliveryService = new MockDeliveryService();
  const error = new GatewayRateLimitError("slack", 3000, 20, 21);
  const result = normalizeGatewayDeliveryFailure(error, deliveryService);

  assert.equal(result.errorMessage, "gateway.rate_limited");
  assert.equal(result.retryable, true);
  assert.equal(result.responseStatus, undefined);
});

test("normalizeGatewayDeliveryFailure with generic Error containing status code", () => {
  const deliveryService = new MockDeliveryService();
  const error = new Error("something went wrong:429");
  const result = normalizeGatewayDeliveryFailure(error, deliveryService);

  assert.equal(result.responseStatus, 429);
  assert.equal(result.errorMessage, "something went wrong:429");
  assert.equal(result.retryable, true); // 429 is retryable
});

test("normalizeGatewayDeliveryFailure with generic Error not matching status pattern", () => {
  const deliveryService = new MockDeliveryService();
  const error = new Error("generic error message");
  const result = normalizeGatewayDeliveryFailure(error, deliveryService);

  assert.equal(result.responseStatus, null);
  assert.equal(result.errorMessage, "generic error message");
  assert.equal(result.retryable, true);
});

test("normalizeGatewayDeliveryFailure with non-Error value", () => {
  const deliveryService = new MockDeliveryService();
  const result = normalizeGatewayDeliveryFailure(42, deliveryService);

  assert.equal(result.errorMessage, "42");
  assert.equal(result.retryable, true);
});

test("normalizeGatewayDeliveryFailure uses deliveryService for retryable status check", () => {
  const deliveryService = new MockDeliveryService([500, 502]); // only 500, 502 are retryable
  const error = new Error("error:503");
  const result = normalizeGatewayDeliveryFailure(error, deliveryService);

  assert.equal(result.responseStatus, 503);
  assert.equal(result.retryable, false); // 503 not in retryableStatuses
});
