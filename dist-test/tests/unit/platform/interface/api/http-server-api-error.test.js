import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, inferApiErrorCategory, inferApiErrorSource, normalizeError, } from "../../../../../src/platform/interface/api/http-server/api-error.js";
import { AppError } from "../../../../../src/platform/contracts/errors.js";
import { GatewayRateLimitError } from "../../../../../src/platform/interface/channel-gateway/errors.js";
import { GatewayTargetNotFoundError, GatewayTargetAmbiguousError } from "../../../../../src/platform/interface/channel-gateway/gateway-target-directory-service.js";
test("ApiError has correct properties", () => {
    const error = new ApiError(404, "api.not_found", "Resource not found");
    assert.equal(error.statusCode, 404);
    assert.equal(error.code, "api.not_found");
    assert.equal(error.message, "Resource not found");
    assert.equal(error.name, "ApiError");
    assert.equal(error.category, "workflow");
    assert.equal(error.source, "runtime");
    assert.equal(error.retryable, false);
});
test("ApiError is retryable for 429", () => {
    const error = new ApiError(429, "api.rate_limited", "Rate limited");
    assert.equal(error.retryable, true);
});
test("ApiError is retryable for 5xx", () => {
    const error = new ApiError(500, "api.internal_error", "Internal error");
    assert.equal(error.retryable, true);
});
test("ApiError is not retryable for 4xx (except 429)", () => {
    const error1 = new ApiError(400, "api.bad_request", "Bad request");
    assert.equal(error1.retryable, false);
    const error2 = new ApiError(401, "api.unauthorized", "Unauthorized");
    assert.equal(error2.retryable, false);
    const error3 = new ApiError(403, "api.forbidden", "Forbidden");
    assert.equal(error3.retryable, false);
});
test("inferApiErrorCategory returns tenant for tenant_ codes", () => {
    assert.equal(inferApiErrorCategory(403, "api.tenant_not_found"), "tenant");
    assert.equal(inferApiErrorCategory(404, "api.tenant_access_denied"), "tenant");
});
test("inferApiErrorCategory returns policy for approval. codes", () => {
    assert.equal(inferApiErrorCategory(403, "approval.not_found"), "policy");
    assert.equal(inferApiErrorCategory(403, "approval.denied"), "policy");
});
test("inferApiErrorCategory returns external for gateway. 429/5xx", () => {
    assert.equal(inferApiErrorCategory(429, "gateway.rate_limited"), "external");
    assert.equal(inferApiErrorCategory(500, "gateway.error"), "external");
    assert.equal(inferApiErrorCategory(502, "gateway.bad_gateway"), "external");
});
test("inferApiErrorCategory returns validation for gateway. 4xx", () => {
    assert.equal(inferApiErrorCategory(400, "gateway.invalid_payload"), "validation");
    assert.equal(inferApiErrorCategory(404, "gateway.not_found"), "validation");
});
test("inferApiErrorCategory returns auth for 401/403", () => {
    assert.equal(inferApiErrorCategory(401, "api.unauthorized"), "auth");
    assert.equal(inferApiErrorCategory(403, "api.forbidden"), "auth");
});
test("inferApiErrorCategory returns workflow for 404/409", () => {
    assert.equal(inferApiErrorCategory(404, "api.not_found"), "workflow");
    assert.equal(inferApiErrorCategory(409, "api.conflict"), "workflow");
});
test("inferApiErrorCategory returns internal for 5xx", () => {
    assert.equal(inferApiErrorCategory(500, "api.error"), "internal");
    assert.equal(inferApiErrorCategory(503, "api.unavailable"), "internal");
});
test("inferApiErrorCategory returns validation for other 4xx", () => {
    assert.equal(inferApiErrorCategory(400, "api.bad_request"), "validation");
    assert.equal(inferApiErrorCategory(422, "api.unprocessable"), "validation");
});
test("inferApiErrorSource returns gateway for gateway. codes", () => {
    assert.equal(inferApiErrorSource("gateway.rate_limited"), "gateway");
    assert.equal(inferApiErrorSource("gateway.target_not_found"), "gateway");
});
test("inferApiErrorSource returns policy for approval. codes", () => {
    assert.equal(inferApiErrorSource("approval.not_found"), "policy");
    assert.equal(inferApiErrorSource("approval.denied"), "policy");
});
test("inferApiErrorSource returns runtime for other codes", () => {
    assert.equal(inferApiErrorSource("api.not_found"), "runtime");
    assert.equal(inferApiErrorSource("storage.error"), "runtime");
});
test("normalizeError returns AppError as-is", () => {
    const appError = new AppError("api.test", "Test", { statusCode: 400 });
    const result = normalizeError(appError);
    assert.equal(result, appError);
});
test("normalizeError converts storage.task_not_found to 404", () => {
    const error = new AppError("storage.task_not_found", "Task not found", { statusCode: 404 });
    const result = normalizeError(error);
    assert.equal(result.statusCode, 404);
    assert.equal(result.code, "api.task_not_found");
});
test("normalizeError converts storage.workflow_not_found to 404", () => {
    const error = new AppError("storage.workflow_not_found", "Workflow not found", { statusCode: 404 });
    const result = normalizeError(error);
    assert.equal(result.statusCode, 404);
    assert.equal(result.code, "api.workflow_not_found");
});
test("normalizeError converts workflow.not_found to 404", () => {
    const error = new AppError("workflow.not_found", "Workflow not found", { statusCode: 404 });
    const result = normalizeError(error);
    assert.equal(result.statusCode, 404);
    assert.equal(result.code, "api.workflow_not_found");
});
test("normalizeError converts GatewayTargetNotFoundError to 404", () => {
    const error = new GatewayTargetNotFoundError("my-query");
    const result = normalizeError(error);
    assert.equal(result.statusCode, 404);
    assert.equal(result.code, "gateway.target_not_found:my-query");
});
test("normalizeError converts GatewayTargetAmbiguousError to 409", () => {
    const error = new GatewayTargetAmbiguousError("my-query", []);
    const result = normalizeError(error);
    assert.equal(result.statusCode, 409);
    assert.ok(result.code.includes("gateway.target_ambiguous"));
});
test("normalizeError converts GatewayRateLimitError to 429", () => {
    const error = new GatewayRateLimitError("telegram_123", 5000, 100, 50);
    const result = normalizeError(error);
    assert.equal(result.statusCode, 429);
    assert.equal(result.code, "gateway.rate_limited");
});
test("normalizeError converts Error with workflow.not_found message", () => {
    const error = new Error("workflow.not_found");
    const result = normalizeError(error);
    assert.equal(result.statusCode, 404);
    assert.equal(result.code, "api.workflow_not_found");
});
test("normalizeError converts Error with Task not found prefix", () => {
    const error = new Error("Task not found: task_123");
    const result = normalizeError(error);
    assert.equal(result.statusCode, 404);
    assert.equal(result.code, "api.task_not_found");
});
test("normalizeError converts approval.not_found Error", () => {
    const error = new Error("approval.not_found");
    const result = normalizeError(error);
    assert.equal(result.statusCode, 404);
    assert.equal(result.code, "approval.not_found");
});
test("normalizeError returns 500 for unknown Error", () => {
    const error = new Error("Something went wrong");
    const result = normalizeError(error);
    assert.equal(result.statusCode, 500);
    assert.equal(result.code, "api.internal_error");
});
test("normalizeError returns 500 for unknown error type", () => {
    const result = normalizeError("string error");
    assert.equal(result.statusCode, 500);
    assert.equal(result.code, "api.unknown_error");
});
//# sourceMappingURL=http-server-api-error.test.js.map