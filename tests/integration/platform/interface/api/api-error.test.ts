/**
 * Integration tests for API error handling
 *
 * Tests error classes, error normalization, and error response formatting:
 * - ApiError construction with proper status codes and categories
 * - normalizeError function for different error types
 * - Error response envelope formatting
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ApiError,
  normalizeError,
  inferApiErrorCategory,
  inferApiErrorSource,
} from "../../../../../src/platform/interface/api/http-server/api-error.js";
import { AppError } from "../../../../../src/platform/contracts/errors.js";

// ══════════════════════════════════════════════════════════════════════════
// ApiError Tests
// ══════════════════════════════════════════════════════════════════════════

test("ApiError constructs with 400 status code", () => {
  const error = new ApiError(400, "api.validation_error", "Invalid input");
  assert.equal(error.statusCode, 400);
  assert.equal(error.code, "api.validation_error");
  assert.equal(error.message, "Invalid input");
  assert.equal(error.category, "validation");
  assert.equal(error.source, "runtime");
  assert.equal(error.retryable, false);
});

test("ApiError constructs with 401 status code", () => {
  const error = new ApiError(401, "api.unauthorized", "Unauthorized");
  assert.equal(error.statusCode, 401);
  assert.equal(error.category, "auth");
  assert.equal(error.retryable, false);
});

test("ApiError constructs with 403 status code", () => {
  const error = new ApiError(403, "api.forbidden", "Forbidden");
  assert.equal(error.statusCode, 403);
  assert.equal(error.category, "auth");
  assert.equal(error.retryable, false);
});

test("ApiError constructs with 404 status code", () => {
  const error = new ApiError(404, "api.task_not_found", "Task not found");
  assert.equal(error.statusCode, 404);
  assert.equal(error.category, "workflow");
  assert.equal(error.retryable, false);
});

test("ApiError constructs with 409 status code", () => {
  const error = new ApiError(409, "api.conflict", "Conflict");
  assert.equal(error.statusCode, 409);
  assert.equal(error.category, "workflow");
  assert.equal(error.retryable, false);
});

test("ApiError constructs with 429 status code (retryable)", () => {
  const error = new ApiError(429, "api.rate_limited", "Rate limited");
  assert.equal(error.statusCode, 429);
  assert.equal(error.category, "external");
  assert.equal(error.retryable, true);
});

test("ApiError constructs with 500 status code (retryable)", () => {
  const error = new ApiError(500, "api.internal_error", "Internal error");
  assert.equal(error.statusCode, 500);
  assert.equal(error.category, "internal");
  assert.equal(error.retryable, true);
});

test("ApiError constructs with 503 status code (retryable)", () => {
  const error = new ApiError(503, "api.service_unavailable", "Service unavailable");
  assert.equal(error.statusCode, 503);
  assert.equal(error.category, "external");
  assert.equal(error.retryable, true);
});

test("ApiError name is ApiError", () => {
  const error = new ApiError(400, "api.test", "Test");
  assert.equal(error.name, "ApiError");
});

// ══════════════════════════════════════════════════════════════════════════
// inferApiErrorCategory Tests
// ══════════════════════════════════════════════════════════════════════════

test("inferApiErrorCategory returns tenant for tenant_ codes", () => {
  assert.equal(inferApiErrorCategory(400, "api.tenant_not_found"), "tenant");
  assert.equal(inferApiErrorCategory(403, "api.tenant_access_denied"), "tenant");
});

test("inferApiErrorCategory returns policy for approval. codes", () => {
  assert.equal(inferApiErrorCategory(400, "approval.invalid_decision"), "policy");
  assert.equal(inferApiErrorCategory(403, "approval.forbidden"), "policy");
});

test("inferApiErrorCategory returns external for gateway. codes with 429/5xx", () => {
  assert.equal(inferApiErrorCategory(429, "gateway.rate_limited"), "external");
  assert.equal(inferApiErrorCategory(500, "gateway.upstream_error"), "external");
  assert.equal(inferApiErrorCategory(503, "gateway.unavailable"), "external");
});

test("inferApiErrorCategory returns validation for gateway. codes with 4xx", () => {
  assert.equal(inferApiErrorCategory(400, "gateway.invalid_request"), "validation");
  assert.equal(inferApiErrorCategory(404, "gateway.not_found"), "validation");
});

test("inferApiErrorCategory returns validation for 400 status code", () => {
  assert.equal(inferApiErrorCategory(400, "api.some_error"), "validation");
});

test("inferApiErrorCategory returns auth for 401 or 403", () => {
  assert.equal(inferApiErrorCategory(401, "api.unauthorized"), "auth");
  assert.equal(inferApiErrorCategory(403, "api.forbidden"), "auth");
});

test("inferApiErrorCategory returns workflow for 404 or 409", () => {
  assert.equal(inferApiErrorCategory(404, "api.not_found"), "workflow");
  assert.equal(inferApiErrorCategory(409, "api.conflict"), "workflow");
});

test("inferApiErrorCategory returns internal for 5xx status codes", () => {
  assert.equal(inferApiErrorCategory(500, "api.internal_error"), "internal");
  assert.equal(inferApiErrorCategory(502, "api.bad_gateway"), "internal");
  assert.equal(inferApiErrorCategory(503, "api.service_unavailable"), "internal");
});

// ══════════════════════════════════════════════════════════════════════════
// inferApiErrorSource Tests
// ══════════════════════════════════════════════════════════════════════════

test("inferApiErrorSource returns gateway for gateway. codes", () => {
  assert.equal(inferApiErrorSource("gateway.invalid_request"), "gateway");
  assert.equal(inferApiErrorSource("gateway.rate_limited"), "gateway");
});

test("inferApiErrorSource returns policy for approval. codes", () => {
  assert.equal(inferApiErrorSource("approval.invalid_decision"), "policy");
});

test("inferApiErrorSource returns runtime for other codes", () => {
  assert.equal(inferApiErrorSource("api.validation_error"), "runtime");
  assert.equal(inferApiErrorSource("api.internal_error"), "runtime");
});

// ══════════════════════════════════════════════════════════════════════════
// normalizeError Tests
// ══════════════════════════════════════════════════════════════════════════

test("normalizeError passes through GatewayRateLimitError", async () => {
  const { GatewayRateLimitError } = await import("../../../../../src/platform/interface/channel-gateway/channel-gateway-service.js");
  const original = new GatewayRateLimitError("telegram", 100);
  const normalized = normalizeError(original);
  assert.equal(normalized.statusCode, 429);
  assert.equal(normalized.code, "gateway.rate_limited");
  assert.ok(normalized.message.includes("telegram"));
});

test("normalizeError converts AppError with task_not_found code to 404", () => {
  const original = new AppError("storage.task_not_found", "Task not found", {
    statusCode: 404,
    category: "workflow",
    source: "runtime",
    retryable: false,
  });
  const normalized = normalizeError(original);
  assert.equal(normalized.statusCode, 404);
  assert.equal(normalized.code, "api.task_not_found");
  assert.equal(normalized.message, "Task not found.");
});

test("normalizeError converts AppError with workflow_not_found code to 404", () => {
  const original = new AppError("storage.workflow_not_found", "Workflow not found", {
    statusCode: 404,
    category: "workflow",
    source: "runtime",
    retryable: false,
  });
  const normalized = normalizeError(original);
  assert.equal(normalized.statusCode, 404);
  assert.equal(normalized.code, "api.workflow_not_found");
  assert.equal(normalized.message, "Workflow not found.");
});

test("normalizeError passes through AppError with workflow.not_found code", () => {
  const original = new AppError("workflow.not_found", "Workflow not found", {
    statusCode: 404,
    category: "workflow",
    source: "runtime",
    retryable: false,
  });
  const normalized = normalizeError(original);
  assert.equal(normalized.statusCode, 404);
  assert.equal(normalized.code, "api.workflow_not_found");
});

test("normalizeError converts generic Error with workflow.not_found message", () => {
  const original = new Error("workflow.not_found");
  const normalized = normalizeError(original);
  assert.equal(normalized.statusCode, 404);
  assert.equal(normalized.code, "api.workflow_not_found");
});

test("normalizeError converts generic Error with Task not found: prefix", () => {
  const original = new Error("Task not found: task-123");
  const normalized = normalizeError(original);
  assert.equal(normalized.statusCode, 404);
  assert.equal(normalized.code, "api.task_not_found");
});

test("normalizeError converts generic Error with approval.not_found message", () => {
  const original = new Error("approval.not_found");
  const normalized = normalizeError(original);
  assert.equal(normalized.statusCode, 404);
  assert.equal(normalized.code, "approval.not_found");
});

test("normalizeError converts generic Error to 500 internal error", () => {
  const original = new Error("Something went wrong");
  const normalized = normalizeError(original);
  assert.equal(normalized.statusCode, 500);
  assert.equal(normalized.code, "api.internal_error");
  assert.equal(normalized.message, "Internal server error.");
});

test("normalizeError converts unknown error to 500 unknown error", () => {
  const original = "not an error object";
  const normalized = normalizeError(original);
  assert.equal(normalized.statusCode, 500);
  assert.equal(normalized.code, "api.unknown_error");
});

// ══════════════════════════════════════════════════════════════════════════
// Error Response Formatting Tests
// ══════════════════════════════════════════════════════════════════════════

test("ApiError response has correct structure", () => {
  const error = new ApiError(400, "api.validation_error", "Invalid field");
  const response = {
    statusCode: error.statusCode,
    code: error.code,
    message: error.message,
    category: error.category,
  };
  assert.equal(response.statusCode, 400);
  assert.equal(response.code, "api.validation_error");
  assert.equal(response.message, "Invalid field");
  assert.equal(response.category, "validation");
});

test("normalizeError preserves original error properties when passing through", () => {
  const original = new AppError("api.already_processed", "Already processed", {
    statusCode: 409,
    category: "workflow",
    source: "runtime",
    retryable: false,
  });
  const normalized = normalizeError(original);
  // When an AppError is passed through, the original is returned as-is
  assert.equal(normalized.code, "api.already_processed");
  assert.equal(normalized.statusCode, 409);
});