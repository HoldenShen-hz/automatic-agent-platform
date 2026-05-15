import assert from "node:assert/strict";
import test from "node:test";

import {
  ApiError,
  inferApiErrorCategory,
  inferApiErrorSource,
  normalizeError,
} from "../../../../../src/platform/five-plane-interface/api/http-server/api-error.js";
import { AppError } from "../../../../../src/platform/contracts/errors.js";

test("ApiError extends AppError", () => {
  const error = new ApiError(400, "api.bad_request", "Bad request");
  assert.ok(error instanceof AppError);
  assert.ok(error instanceof Error);
  assert.equal(error.name, "ApiError");
  assert.equal(error.code, "api.bad_request");
  assert.equal(error.message, "Bad request");
});

test("ApiError statusCode is stored", () => {
  const error = new ApiError(404, "api.not_found", "Not found");
  assert.equal(error.statusCode, 404);
});

test("ApiError 5xx is retryable", () => {
  const error = new ApiError(500, "api.internal_error", "Internal error");
  assert.equal(error.retryable, true);
});

test("ApiError 429 is retryable", () => {
  const error = new ApiError(429, "api.rate_limited", "Rate limited");
  assert.equal(error.retryable, true);
});

test("ApiError 400 is not retryable", () => {
  const error = new ApiError(400, "api.bad_request", "Bad request");
  assert.equal(error.retryable, false);
});

test("ApiError 404 is not retryable", () => {
  const error = new ApiError(404, "api.not_found", "Not found");
  assert.equal(error.retryable, false);
});

// inferApiErrorCategory tests

test("inferApiErrorCategory returns tenant for api.tenant_ prefix", () => {
  assert.equal(inferApiErrorCategory(400, "api.tenant_not_found"), "tenant");
  assert.equal(inferApiErrorCategory(403, "api.tenant_access_denied"), "tenant");
});

test("inferApiErrorCategory returns policy for approval. prefix", () => {
  assert.equal(inferApiErrorCategory(403, "approval.not_found"), "policy");
  assert.equal(inferApiErrorCategory(400, "approval.timeout"), "policy");
});

test("inferApiErrorCategory returns external for gateway. 429", () => {
  assert.equal(inferApiErrorCategory(429, "gateway.rate_limited"), "external");
});

test("inferApiErrorCategory returns external for gateway. 5xx", () => {
  assert.equal(inferApiErrorCategory(500, "gateway.internal_error"), "external");
  assert.equal(inferApiErrorCategory(503, "gateway.unavailable"), "external");
});

test("inferApiErrorCategory returns validation for gateway. 4xx", () => {
  assert.equal(inferApiErrorCategory(400, "gateway.invalid_input"), "validation");
  assert.equal(inferApiErrorCategory(404, "gateway.not_found"), "validation");
});

test("inferApiErrorCategory returns validation for 400", () => {
  assert.equal(inferApiErrorCategory(400, "api.bad_request"), "validation");
});

test("inferApiErrorCategory returns auth for 401", () => {
  assert.equal(inferApiErrorCategory(401, "api.unauthorized"), "auth");
});

test("inferApiErrorCategory returns auth for 403", () => {
  assert.equal(inferApiErrorCategory(403, "api.forbidden"), "auth");
});

test("inferApiErrorCategory returns workflow for 404", () => {
  assert.equal(inferApiErrorCategory(404, "api.not_found"), "workflow");
});

test("inferApiErrorCategory returns workflow for 409", () => {
  assert.equal(inferApiErrorCategory(409, "api.conflict"), "workflow");
});

test("inferApiErrorCategory returns internal for 5xx", () => {
  assert.equal(inferApiErrorCategory(500, "api.internal_error"), "internal");
  assert.equal(inferApiErrorCategory(503, "api.service_unavailable"), "internal");
});

test("inferApiErrorCategory returns validation for 4xx non-special", () => {
  assert.equal(inferApiErrorCategory(422, "api.unprocessable"), "validation");
});

// inferApiErrorSource tests

test("inferApiErrorSource returns gateway for gateway. prefix", () => {
  assert.equal(inferApiErrorSource("gateway.target_not_found"), "gateway");
  assert.equal(inferApiErrorSource("gateway.rate_limited"), "gateway");
});

test("inferApiErrorSource returns policy for approval. prefix", () => {
  assert.equal(inferApiErrorSource("approval.not_found"), "policy");
  assert.equal(inferApiErrorSource("approval.timeout"), "policy");
});

test("inferApiErrorSource returns runtime for other codes", () => {
  assert.equal(inferApiErrorSource("api.bad_request"), "runtime");
  assert.equal(inferApiErrorSource("api.task_not_found"), "runtime");
  assert.equal(inferApiErrorSource("storage.task_not_found"), "runtime");
});

// normalizeError tests

test("normalizeError maps storage.task_not_found to 404 ApiError", () => {
  const appError = new AppError("storage.task_not_found", "Task not found", { statusCode: 404 });
  const result = normalizeError(appError);
  assert.ok(result instanceof ApiError);
  assert.equal(result.statusCode, 404);
  assert.equal(result.code, "api.task_not_found");
});

test("normalizeError maps storage.workflow_not_found to 404 ApiError", () => {
  const appError = new AppError("storage.workflow_not_found", "Workflow not found", { statusCode: 404 });
  const result = normalizeError(appError);
  assert.ok(result instanceof ApiError);
  assert.equal(result.statusCode, 404);
  assert.equal(result.code, "api.workflow_not_found");
});

test("normalizeError maps workflow.not_found AppError to 404 ApiError", () => {
  const appError = new AppError("workflow.not_found", "Workflow not found", { statusCode: 404 });
  const result = normalizeError(appError);
  assert.ok(result instanceof ApiError);
  assert.equal(result.statusCode, 404);
  assert.equal(result.code, "api.workflow_not_found");
});

test("normalizeError passes through other AppError unchanged", () => {
  const appError = new AppError("task.invalid_transition", "Invalid transition", { statusCode: 409 });
  const result = normalizeError(appError);
  assert.ok(result instanceof AppError);
  assert.equal(result.code, "task.invalid_transition");
});

test("normalizeError maps Error with workflow.not_found message to 404 ApiError", () => {
  const error = new Error("workflow.not_found");
  const result = normalizeError(error);
  assert.ok(result instanceof ApiError);
  assert.equal(result.statusCode, 404);
  assert.equal(result.code, "api.workflow_not_found");
});

test("normalizeError maps Error with Task not found: prefix to 404 ApiError", () => {
  const error = new Error("Task not found: task_123");
  const result = normalizeError(error);
  assert.ok(result instanceof ApiError);
  assert.equal(result.statusCode, 404);
  assert.equal(result.code, "api.task_not_found");
});

test("normalizeError maps Error with approval.not_found message to 404 ApiError", () => {
  const error = new Error("approval.not_found");
  const result = normalizeError(error);
  assert.ok(result instanceof ApiError);
  assert.equal(result.statusCode, 404);
  assert.equal(result.code, "approval.not_found");
});

test("normalizeError maps unknown Error to 500 ApiError", () => {
  const error = new Error("Some unexpected error");
  const result = normalizeError(error);
  assert.ok(result instanceof ApiError);
  assert.equal(result.statusCode, 500);
  assert.equal(result.code, "api.internal_error");
});

test("normalizeError maps non-Error to 500 unknown ApiError", () => {
  const result = normalizeError("some string error");
  assert.ok(result instanceof ApiError);
  assert.equal(result.statusCode, 500);
  assert.equal(result.code, "api.unknown_error");
});

test("normalizeError maps null to 500 unknown ApiError", () => {
  const result = normalizeError(null);
  assert.ok(result instanceof ApiError);
  assert.equal(result.statusCode, 500);
  assert.equal(result.code, "api.unknown_error");
});
