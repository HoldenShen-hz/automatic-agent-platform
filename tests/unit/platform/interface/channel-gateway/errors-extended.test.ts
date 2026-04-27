/**
 * Unit tests for Channel Gateway Errors - Additional edge cases
 * Tests for errors.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { GatewayRateLimitError, GatewayDeliveryError, normalizeGatewayDeliveryFailure } from "../../../../../src/platform/interface/channel-gateway/errors.js";

test("GatewayRateLimitError has correct error code", () => {
  const err = new GatewayRateLimitError("telegram", 5000, 100, 50);
  assert.equal(err.code, "gateway.rate_limited");
});

test("GatewayRateLimitError has correct status code", () => {
  const err = new GatewayRateLimitError("slack", 3000, 50, 25);
  assert.equal(err.statusCode, 429);
});

test("GatewayRateLimitError is retryable", () => {
  const err = new GatewayRateLimitError("webhook", 1000, 10, 5);
  assert.equal(err.retryable, true);
});

test("GatewayDeliveryError has correct name", () => {
  const err = new GatewayDeliveryError("Connection refused", 503, true);
  assert.equal(err.name, "GatewayDeliveryError");
});

test("GatewayDeliveryError has correct category", () => {
  const err = new GatewayDeliveryError("Server error", 500, true);
  assert.equal(err.category, "external");
});

test("GatewayDeliveryError has correct source", () => {
  const err = new GatewayDeliveryError("Server error", 500, true);
  assert.equal(err.source, "gateway");
});

test("normalizeGatewayDeliveryFailure handles unknown error type", () => {
  const unknownError = { unknown: "error" };
  const mockService = { isRetryableStatus: () => false } as any;
  const result = normalizeGatewayDeliveryFailure(unknownError, mockService);
  assert.equal(result.errorMessage, String(unknownError));
  assert.equal(result.retryable, true);
});

test("normalizeGatewayDeliveryFailure handles null error", () => {
  const mockService = { isRetryableStatus: () => false } as any;
  const result = normalizeGatewayDeliveryFailure(null, mockService);
  assert.equal(result.errorMessage, "null");
  assert.equal(result.retryable, true);
});

test("normalizeGatewayDeliveryFailure handles undefined error", () => {
  const mockService = { isRetryableStatus: () => false } as any;
  const result = normalizeGatewayDeliveryFailure(undefined, mockService);
  assert.equal(result.errorMessage, "undefined");
  assert.equal(result.retryable, true);
});

test("normalizeGatewayDeliveryFailure extracts status from Error with multiple colons", () => {
  const error = new Error("Connection failed:503:extra");
  const mockService = { isRetryableStatus: (s: number) => s >= 500 } as any;
  const result = normalizeGatewayDeliveryFailure(error, mockService);
  assert.equal(result.responseStatus, 503);
});

test("normalizeGatewayDeliveryFailure uses deliveryService for retryable check", () => {
  const error = new Error("Timeout:504");
  const mockService = {
    isRetryableStatus: (s: number) => s === 504,
  } as any;
  const result = normalizeGatewayDeliveryFailure(error, mockService);
  assert.equal(result.responseStatus, 504);
  assert.equal(result.retryable, true);
});

test("normalizeGatewayDeliveryFailure returns non-retryable for non-retryable status", () => {
  const error = new Error("Bad request:400");
  const mockService = {
    isRetryableStatus: (s: number) => s >= 500,
  } as any;
  const result = normalizeGatewayDeliveryFailure(error, mockService);
  assert.equal(result.responseStatus, 400);
  assert.equal(result.retryable, false);
});
