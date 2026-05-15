import assert from "node:assert/strict";
import test from "node:test";

import {
  ApiError,
  inferApiErrorCategory,
  inferApiErrorSource,
  normalizeError,
} from "../../../../../../src/platform/five-plane-interface/api/http-server/api-error.js";
import { AppError } from "../../../../../../src/platform/contracts/errors.js";
import { GatewayRateLimitError } from "../../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-service.js";

test("ApiError constructs with statusCode, code, and message", () => {
  const err = new ApiError(404, "api.task_not_found", "Task not found.");

  assert.equal(err.statusCode, 404);
  assert.equal(err.code, "api.task_not_found");
  assert.equal(err.message, "Task not found.");
  assert.equal(err.name, "ApiError");
  assert.equal(err.retryable, false);
});

test("ApiError marks 5xx and 429 as retryable", () => {
  const serverErr = new ApiError(500, "api.internal_error", "Internal error.");
  assert.equal(serverErr.retryable, true);

  const rateLimitErr = new ApiError(429, "gateway.rate_limited", "Rate limited.");
  assert.equal(rateLimitErr.retryable, true);

  const badReq = new ApiError(400, "validation.failed", "Bad request.");
  assert.equal(badReq.retryable, false);
});

test("inferApiErrorCategory returns tenant for tenant_ codes", () => {
  assert.equal(inferApiErrorCategory(403, "api.tenant_access_denied"), "tenant");
});

test("inferApiErrorCategory returns policy for approval codes", () => {
  assert.equal(inferApiErrorCategory(403, "approval.not_found"), "policy");
});

test("inferApiErrorCategory returns external for gateway 429/5xx", () => {
  assert.equal(inferApiErrorCategory(429, "gateway.rate_limited"), "external");
  assert.equal(inferApiErrorCategory(503, "gateway.unavailable"), "external");
});

test("inferApiErrorCategory returns validation for 400", () => {
  assert.equal(inferApiErrorCategory(400, "validation.failed"), "validation");
});

test("inferApiErrorCategory returns auth for 401/403", () => {
  assert.equal(inferApiErrorCategory(401, "auth.unauthorized"), "auth");
  assert.equal(inferApiErrorCategory(403, "auth.forbidden"), "auth");
});

test("inferApiErrorCategory returns workflow for 404/409", () => {
  assert.equal(inferApiErrorCategory(404, "workflow.not_found"), "workflow");
  assert.equal(inferApiErrorCategory(409, "workflow.conflict"), "workflow");
});

test("inferApiErrorCategory returns internal for 5xx", () => {
  assert.equal(inferApiErrorCategory(500, "api.internal_error"), "internal");
});

test("inferApiErrorSource returns gateway for gateway codes", () => {
  assert.equal(inferApiErrorSource("gateway.target_not_found"), "gateway");
});

test("inferApiErrorSource returns policy for approval codes", () => {
  assert.equal(inferApiErrorSource("approval.not_found"), "policy");
});

test("inferApiErrorSource returns runtime for other codes", () => {
  assert.equal(inferApiErrorSource("api.task_not_found"), "runtime");
});

test("normalizeError passes through AppError with storage codes", () => {
  const appErr = new AppError("storage.task_not_found", "storage.task_not_found", { statusCode: 404 });
  const result = normalizeError(appErr);

  assert.ok(result instanceof ApiError);
  assert.equal(result.code, "api.task_not_found");
});

test("normalizeError maps storage.workflow_not_found to 404", () => {
  const appErr = new AppError("storage.workflow_not_found", "storage.workflow_not_found", { statusCode: 404 });
  const result = normalizeError(appErr);

  assert.ok(result instanceof ApiError);
  assert.equal(result.code, "api.workflow_not_found");
});

test("normalizeError maps workflow.not_found to 404", () => {
  const appErr = new AppError("workflow.not_found", "workflow.not_found", { statusCode: 404 });
  const result = normalizeError(appErr);

  assert.ok(result instanceof ApiError);
  assert.equal(result.code, "api.workflow_not_found");
});

test("normalizeError handles plain Error with workflow.not_found message", () => {
  const plainErr = new Error("workflow.not_found");
  const result = normalizeError(plainErr);

  assert.ok(result instanceof ApiError);
  assert.equal(result.code, "api.workflow_not_found");
});

test("normalizeError handles plain Error with Task not found prefix", () => {
  const plainErr = new Error("Task not found: task-123");
  const result = normalizeError(plainErr);

  assert.ok(result instanceof ApiError);
  assert.equal(result.code, "api.task_not_found");
});

test("normalizeError handles GatewayRateLimitError", () => {
  const rateLimitErr = new GatewayRateLimitError("telegram", 10);
  const result = normalizeError(rateLimitErr);

  assert.ok(result instanceof ApiError);
  assert.equal(result.code, "gateway.rate_limited");
  assert.equal(result.statusCode, 429);
});

test("normalizeError returns ApiError for unknown errors", () => {
  const result = normalizeError(new Error("something went wrong"));

  assert.ok(result instanceof ApiError);
  assert.equal(result.code, "api.internal_error");
  assert.equal(result.statusCode, 500);
});

test("normalizeError returns ApiError for non-AppError non-Error values", () => {
  const result = normalizeError("string error");

  assert.ok(result instanceof ApiError);
  assert.equal(result.code, "api.unknown_error");
});