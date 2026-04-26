import assert from "node:assert/strict";
import test from "node:test";

import {
  AppError,
  ValidationError,
  PolicyDeniedError,
  AuthError,
  ProviderError,
  ToolExecutionError,
  SandboxError,
  StorageError,
  WorkflowStateError,
  TenantBoundaryError,
  TransientExternalError,
  PermanentExternalError,
  MonetizationError,
  InternalAppError,
  LockingError,
  MemoryError,
  RuntimeError,
  createErrorCode,
  isAppError,
  getErrorCode,
  normalizeToAppError,
} from "../../../../src/platform/contracts/errors.js";

test("AppError basic construction", () => {
  const err = new AppError("TEST_CODE", "Test message");
  assert.equal(err.code, "TEST_CODE");
  assert.equal(err.message, "Test message");
  assert.equal(err.category, "internal");
  assert.equal(err.retryable, false);
  assert.equal(err.statusCode, 500);
});

test("AppError with all options", () => {
  const cause = new Error("original cause");
  const err = new AppError("FULL_CODE", "Full message", {
    statusCode: 400,
    retryable: true,
    details: { key: "value" },
    cause,
    category: "validation",
    source: "runtime",
    traceId: "trace-123",
    taskId: "task-456",
    executionId: "exec-789",
    causedBy: "OriginalError",
    occurredAt: "2026-04-01T00:00:00.000Z",
    userMessage: "User facing message",
  });

  assert.equal(err.code, "FULL_CODE");
  assert.equal(err.statusCode, 400);
  assert.equal(err.retryable, true);
  assert.deepEqual(err.internalDetails, { key: "value" });
  assert.equal(err.cause, cause);
  assert.equal(err.category, "validation");
  assert.equal(err.source, "runtime");
  assert.equal(err.traceId, "trace-123");
  assert.equal(err.taskId, "task-456");
  assert.equal(err.executionId, "exec-789");
  assert.equal(err.causedBy, "OriginalError");
  assert.equal(err.userMessage, "User facing message");
});

test("AppError.toJSON produces both camelCase and snake_case", () => {
  const err = new AppError("JSON_CODE", "JSON message", {
    statusCode: 400,
    category: "validation",
  });

  const json = err.toJSON();

  assert.equal(json.code, "JSON_CODE");
  assert.equal(json.userMessage, "JSON message");
  assert.equal(json.user_message, "JSON message");
  assert.equal(json.category, "validation");
  assert.equal(json.traceId, null);
  assert.equal(json.trace_id, null);
});

test("AppError.wrap returns same instance for AppError", () => {
  const original = new AppError("ORIGINAL", "Original error");
  const wrapped = AppError.wrap(original, "WRAP_CODE", "Wrapped message");

  assert.equal(wrapped, original);
});

test("AppError.wrap creates new instance for non-AppError", () => {
  const original = new Error("Original error");
  const wrapped = AppError.wrap(original, "WRAP_CODE", "Wrapped message");

  assert.ok(wrapped instanceof AppError);
  assert.equal(wrapped.code, "WRAP_CODE");
  // AppError.wrap preserves original error info in details
  assert.ok(wrapped.internalDetails !== null);
});

test("ValidationError defaults", () => {
  const err = new ValidationError("VAL_CODE", "Validation failed");
  assert.equal(err.category, "validation");
  assert.equal(err.source, "runtime");
  assert.equal(err.statusCode, 400);
  assert.equal(err.retryable, false);
});

test("PolicyDeniedError defaults", () => {
  const err = new PolicyDeniedError("POL_CODE", "Policy denied");
  assert.equal(err.category, "policy");
  assert.equal(err.source, "policy");
  assert.equal(err.statusCode, 403);
});

test("AuthError defaults", () => {
  const err = new AuthError("AUTH_CODE", "Auth failed");
  assert.equal(err.category, "auth");
  assert.equal(err.source, "gateway");
  assert.equal(err.statusCode, 401);
});

test("ProviderError defaults to retryable", () => {
  const err = new ProviderError("PROV_CODE", "Provider error");
  assert.equal(err.category, "provider");
  assert.equal(err.source, "provider");
  assert.equal(err.statusCode, 502);
  assert.equal(err.retryable, true);
});

test("ToolExecutionError defaults", () => {
  const err = new ToolExecutionError("TOOL_CODE", "Tool failed");
  assert.equal(err.category, "tool");
  assert.equal(err.source, "tool");
  assert.equal(err.statusCode, 500);
  assert.equal(err.retryable, false);
});

test("SandboxError defaults", () => {
  const err = new SandboxError("SANDBOX_CODE", "Sandbox violated");
  assert.equal(err.category, "sandbox");
  assert.equal(err.statusCode, 403);
});

test("StorageError defaults to retryable", () => {
  const err = new StorageError("STORAGE_CODE", "Storage failed");
  assert.equal(err.category, "storage");
  assert.equal(err.source, "storage");
  assert.equal(err.statusCode, 500);
  assert.equal(err.retryable, true);
});

test("WorkflowStateError defaults", () => {
  const err = new WorkflowStateError("WF_CODE", "Workflow state error");
  assert.equal(err.category, "workflow");
  assert.equal(err.source, "workflow");
  assert.equal(err.statusCode, 409);
});

test("TenantBoundaryError defaults", () => {
  const err = new TenantBoundaryError("TENANT_CODE", "Tenant boundary violated");
  assert.equal(err.category, "tenant");
  assert.equal(err.statusCode, 403);
});

test("TransientExternalError defaults to retryable", () => {
  const err = new TransientExternalError("TRANS_CODE", "Transient error");
  assert.equal(err.category, "external");
  assert.equal(err.statusCode, 502);
  assert.equal(err.retryable, true);
});

test("PermanentExternalError defaults to not retryable", () => {
  const err = new PermanentExternalError("PERM_CODE", "Permanent error");
  assert.equal(err.category, "external");
  assert.equal(err.statusCode, 502);
  assert.equal(err.retryable, false);
});

test("MonetizationError defaults", () => {
  const err = new MonetizationError("MON_CODE", "Payment failed");
  assert.equal(err.category, "monetization");
  assert.equal(err.statusCode, 402);
});

test("InternalAppError defaults", () => {
  const err = new InternalAppError("INT_CODE", "Internal error");
  assert.equal(err.category, "internal");
  assert.equal(err.statusCode, 500);
});

test("LockingError extends StorageError", () => {
  const err = new LockingError("LOCK_CODE", "Lock failed", { lockId: "abc" });
  assert.ok(err instanceof StorageError);
  assert.equal(err.statusCode, 409);
  assert.equal(err.retryable, true);
});

test("MemoryError extends InternalAppError", () => {
  const err = new MemoryError("MEM_CODE", "Memory failed", { memId: "xyz" });
  assert.ok(err instanceof InternalAppError);
  assert.equal(err.source, "runtime");
});

test("RuntimeError extends InternalAppError", () => {
  const err = new RuntimeError("RT_CODE", "Runtime failed", { rtId: "rt-1" });
  assert.ok(err instanceof InternalAppError);
  assert.equal(err.category, "runtime");
  assert.equal(err.source, "runtime");
});

test("createErrorCode formats correctly", () => {
  assert.equal(createErrorCode("A", 1), "EA001");
  assert.equal(createErrorCode("B", 999), "EB999");
  assert.equal(createErrorCode("7", 42), "E7042");
});

test("isAppError returns true for AppError", () => {
  const err = new AppError("TEST", "test");
  assert.equal(isAppError(err), true);
});

test("isAppError returns false for non-AppError", () => {
  assert.equal(isAppError(new Error("regular")), false);
  assert.equal(isAppError("string"), false);
  assert.equal(isAppError(null), false);
});

test("getErrorCode extracts code from AppError", () => {
  const err = new AppError("EXTRACT_CODE", "message");
  assert.equal(getErrorCode(err), "EXTRACT_CODE");
});

test("getErrorCode returns fallback for non-AppError", () => {
  assert.equal(getErrorCode(new Error("err")), "E0000");
  assert.equal(getErrorCode("string"), "E0000");
});

test("normalizeToAppError returns same AppError", () => {
  const err = new AppError("SAME", "same");
  const result = normalizeToAppError(err, { code: "FALLBACK", message: "fallback" });
  assert.equal(result, err);
});

test("normalizeToAppError wraps non-AppError", () => {
  const original = new Error("original");
  const result = normalizeToAppError(original, { code: "NORM", message: "normalized" });
  assert.ok(result instanceof AppError);
  assert.equal(result.code, "NORM");
});
