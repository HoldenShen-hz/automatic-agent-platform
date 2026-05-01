import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  GatewayRateLimitError,
  GatewayDeliveryError,
  normalizeGatewayDeliveryFailure,
} from "../../../../../src/platform/five-plane-interface/channel-gateway/errors.js";

// Mock delivery service for normalizeGatewayDeliveryFailure
const mockDeliveryService = {
  isRetryableStatus: (status: number) => [500, 502, 503, 504].includes(status),
};

test("GatewayRateLimitError has correct properties", () => {
  const error = new GatewayRateLimitError("telegram", 5000, 30, 31);

  assert.equal(error.channel, "telegram");
  assert.equal(error.retryAfterMs, 5000);
  assert.equal(error.limit, 30);
  assert.equal(error.currentCount, 31);
  assert.equal(error.name, "GatewayRateLimitError");
});

test("GatewayDeliveryError has correct properties", () => {
  const error = new GatewayDeliveryError("test error", 502, true);

  assert.equal(error.message, "test error");
  assert.equal(error.responseStatus, 502);
  assert.equal(error.retryable, true);
  assert.equal(error.name, "GatewayDeliveryError");
});

test("GatewayDeliveryError marks non-retryable errors correctly", () => {
  const error = new GatewayDeliveryError("validation error", 400, false);

  assert.equal(error.retryable, false);
});

test("normalizeGatewayDeliveryFailure handles GatewayDeliveryError", () => {
  const error = new GatewayDeliveryError("gateway error", 503, true);
  const result = normalizeGatewayDeliveryFailure(error, mockDeliveryService as any);

  assert.equal(result.responseStatus, 503);
  assert.equal(result.errorMessage, "gateway error");
  assert.equal(result.retryable, true);
});

test("normalizeGatewayDeliveryFailure handles GatewayRateLimitError", () => {
  const error = new GatewayRateLimitError("telegram", 5000, 30, 31);
  const result = normalizeGatewayDeliveryFailure(error, mockDeliveryService as any);

  assert.equal(result.errorMessage, error.message);
  assert.equal(result.retryable, true);
});

test("normalizeGatewayDeliveryFailure extracts status from error message", () => {
  const error = new Error("gateway.slack_delivery_failed:429");
  const result = normalizeGatewayDeliveryFailure(error, mockDeliveryService as any);

  assert.equal(result.responseStatus, 429);
  assert.equal(result.retryable, false); // 429 is rate limit, not retryable per isRetryableStatus
});

test("normalizeGatewayDeliveryFailure defaults to retryable for unknown errors", () => {
  const error = new Error("some unknown error");
  const result = normalizeGatewayDeliveryFailure(error, mockDeliveryService as any);

  assert.equal(result.responseStatus, null);
  assert.equal(result.retryable, true);
});

test("normalizeGatewayDeliveryFailure handles non-Error values", () => {
  const result = normalizeGatewayDeliveryFailure("string error", mockDeliveryService as any);

  assert.equal(result.errorMessage, "string error");
  assert.equal(result.retryable, true);
});