import assert from "node:assert/strict";
import test from "node:test";

import {
  ApiError,
  inferApiErrorCategory,
  inferApiErrorSource,
  normalizeError,
} from "../../../../../../src/platform/interface/api/http-server/api-error.js";
import { AppError } from "../../../../../../src/platform/contracts/errors.js";

test("ApiError constructor sets correct properties", () => {
  const error = new ApiError(400, "api.test_error", "Test error message");
  assert.equal(error.name, "ApiError");
  assert.equal(error.statusCode, 400);
  assert.equal(error.code, "api.test_error");
  assert.equal(error.message, "Test error message");
});

test("ApiError is retryable for 5xx errors", () => {
  const error = new ApiError(500, "api.server_error", "Server error");
  assert.equal(error.retryable, true);
});

test("ApiError is retryable for 429 rate limit", () => {
  const error = new ApiError(429, "api.rate_limited", "Rate limited");
  assert.equal(error.retryable, true);
});

test("ApiError is not retryable for 4xx client errors", () => {
  const error = new ApiError(400, "api.bad_request", "Bad request");
  assert.equal(error.retryable, false);
});

test("inferApiErrorCategory returns tenant for tenant_ codes", () => {
  assert.equal(inferApiErrorCategory(400, "api.tenant_not_found"), "tenant");
  assert.equal(inferApiErrorCategory(404, "api.tenant_unauthorized"), "tenant");
});

test("inferApiErrorCategory returns policy for approval codes", () => {
  assert.equal(inferApiErrorCategory(403, "approval.not_authorized"), "policy");
  assert.equal(inferApiErrorCategory(400, "approval.invalid_request"), "policy");
});

test("inferApiErrorCategory returns external for gateway 429", () => {
  assert.equal(inferApiErrorCategory(429, "gateway.rate_limited"), "external");
});

test("inferApiErrorCategory returns external for gateway 5xx", () => {
  assert.equal(inferApiErrorCategory(502, "gateway.bad_gateway"), "external");
});

test("inferApiErrorCategory returns validation for 400", () => {
  assert.equal(inferApiErrorCategory(400, "api.validation_error"), "validation");
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
  assert.equal(inferApiErrorCategory(500, "api.error"), "internal");
});

test("inferApiErrorCategory returns validation for unknown code with 4xx", () => {
  assert.equal(inferApiErrorCategory(418, "api.teapot"), "validation");
});

test("inferApiErrorSource returns gateway for gateway codes", () => {
  assert.equal(inferApiErrorSource("gateway.target_not_found"), "gateway");
  assert.equal(inferApiErrorSource("gateway.rate_limited"), "gateway");
});

test("inferApiErrorSource returns policy for approval codes", () => {
  assert.equal(inferApiErrorSource("approval.not_authorized"), "policy");
});

test("inferApiErrorSource returns runtime for other codes", () => {
  assert.equal(inferApiErrorSource("api.test"), "runtime");
  assert.equal(inferApiErrorSource("storage.error"), "runtime");
});

test("normalizeError returns original AppError unchanged", () => {
  const original = new AppError("storage.task_not_found", "Task not found", {});
  const result = normalizeError(original);
  assert.equal(result, original);
});

test("normalizeError maps storage.task_not_found to ApiError 404", () => {
  const original = new AppError("storage.task_not_found", "Task not found", {});
  const result = normalizeError(original) as ApiError;
  assert.equal(result.statusCode, 404);
  assert.equal(result.code, "api.task_not_found");
});

test("normalizeError maps storage.workflow_not_found to ApiError 404", () => {
  const original = new AppError("storage.workflow_not_found", "Workflow not found", {});
  const result = normalizeError(original) as ApiError;
  assert.equal(result.statusCode, 404);
  assert.equal(result.code, "api.workflow_not_found");
});

test("normalizeError maps workflow.not_found to ApiError 404", () => {
  const original = new AppError("workflow.not_found", "Workflow not found", {});
  const result = normalizeError(original) as ApiError;
  assert.equal(result.statusCode, 404);
  assert.equal(result.code, "api.workflow_not_found");
});

test("normalizeError maps Error with workflow.not_found message", () => {
  const error = new Error("workflow.not_found");
  const result = normalizeError(error) as ApiError;
  assert.equal(result.statusCode, 404);
  assert.equal(result.code, "api.workflow_not_found");
});

test("normalizeError maps Error starting with Task not found:", () => {
  const error = new Error("Task not found: task-123");
  const result = normalizeError(error) as ApiError;
  assert.equal(result.statusCode, 404);
  assert.equal(result.code, "api.task_not_found");
});

test("normalizeError maps approval.not_found Error", () => {
  const error = new Error("approval.not_found");
  const result = normalizeError(error) as ApiError;
  assert.equal(result.statusCode, 404);
  assert.equal(result.code, "approval.not_found");
});

test("normalizeError maps generic Error to 500", () => {
  const error = new Error("Something went wrong");
  const result = normalizeError(error) as ApiError;
  assert.equal(result.statusCode, 500);
  assert.equal(result.code, "api.internal_error");
});

test("normalizeError maps non-Error to 500", () => {
  const result = normalizeError("string error") as ApiError;
  assert.equal(result.statusCode, 500);
  assert.equal(result.code, "api.unknown_error");
});

test("normalizeError maps null to 500", () => {
  const result = normalizeError(null) as ApiError;
  assert.equal(result.statusCode, 500);
  assert.equal(result.code, "api.unknown_error");
});

test("normalizeError maps undefined to 500", () => {
  const result = normalizeError(undefined) as ApiError;
  assert.equal(result.statusCode, 500);
  assert.equal(result.code, "api.unknown_error");
});