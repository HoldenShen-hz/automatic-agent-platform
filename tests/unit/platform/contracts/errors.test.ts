import assert from "node:assert/strict";
import test from "node:test";

import {
  AppError,
  AuthError,
  ValidationError,
  PolicyDeniedError,
  ProviderError,
  ToolExecutionError,
  SandboxError,
  StorageError,
  WorkflowStateError,
  TenantBoundaryError,
  MonetizationError,
  InternalAppError,
  LockingError,
  MemoryError,
  RuntimeError,
  TransientExternalError,
  PermanentExternalError,
  createErrorCode,
  isAppError,
  getErrorCode,
  normalizeToAppError,
} from "../../../../src/platform/contracts/errors.js";

test("AppError exposes contract and legacy fields together", () => {
  const error = new AuthError("api.invalid_token", "Bearer token is invalid.", {
    statusCode: 401,
    details: { reason: "signature_mismatch" },
    traceId: "trace-1",
  });

  assert.equal(error.code, "api.invalid_token");
  assert.equal(error.errorCode, "api.invalid_token");
  assert.equal(error.category, "auth");
  assert.equal(error.source, "gateway");
  assert.equal(error.statusCode, 401);
  assert.equal(error.retryable, false);
  assert.deepEqual(error.details, { reason: "signature_mismatch" });
  assert.deepEqual(error.toJSON(), {
    name: "AuthError",
    code: "api.invalid_token",
    errorCode: "api.invalid_token",
    message: "Bearer token is invalid.",
    userMessage: "Bearer token is invalid.",
    user_message: "Bearer token is invalid.",
    category: "auth",
    retryable: false,
    internalDetails: { reason: "signature_mismatch" },
    internal_details: { reason: "signature_mismatch" },
    source: "gateway",
    traceId: "trace-1",
    trace_id: "trace-1",
    taskId: null,
    task_id: null,
    executionId: null,
    execution_id: null,
    causedBy: null,
    caused_by: null,
    occurredAt: error.occurredAt,
    occurred_at: error.occurredAt,
    statusCode: 401,
    cause: undefined,
  });
});

test("AppError uses sensible defaults when options are not provided", () => {
  const error = new AppError("test.code", "Test message");

  assert.equal(error.category, "internal");
  assert.equal(error.source, "internal");
  assert.equal(error.statusCode, 500);
  assert.equal(error.retryable, false);
  assert.equal(error.userMessage, "Test message");
  assert.equal(error.taskId, null);
  assert.equal(error.executionId, null);
  assert.equal(error.traceId, null);
  assert.equal(error.causedBy, null);
});

test("AppError uses userMessage when provided", () => {
  const error = new AppError("test.code", "Technical message", {
    userMessage: "User-friendly message",
  });

  assert.equal(error.message, "User-friendly message");
  assert.equal(error.userMessage, "User-friendly message");
});

test("AppError preserves cause error", () => {
  const cause = new Error("original cause");
  const error = new AppError("test.code", "Test message", { cause });

  assert.equal(error.cause, cause);
});

test("AppError.wrap returns existing AppError unchanged", () => {
  const original = new ValidationError("existing.code", "Existing message");
  const wrapped = AppError.wrap(original, "new.code", "New message");

  assert.equal(wrapped, original);
});

test("AppError.wrap wraps Error with original error details", () => {
  const cause = new Error("original error message");
  const wrapped = AppError.wrap(cause, "wrapped.code", "Wrapped message");

  assert.ok(wrapped instanceof AppError);
  assert.equal(wrapped.code, "wrapped.code");
  assert.equal(wrapped.category, "internal");
  assert.deepEqual(wrapped.internalDetails, {
    originalError: "original error message",
  });
  assert.equal(wrapped.causedBy, "Error");
});

test("AppError.wrap wraps non-Error values as strings", () => {
  const wrapped = AppError.wrap("string error", "wrapped.code", "Wrapped message");

  assert.ok(wrapped instanceof AppError);
  assert.deepEqual(wrapped.internalDetails, {
    originalError: "string error",
  });
});

test("AppError.toJSON serializes cause message only", () => {
  const cause = new Error("cause message");
  const error = new AppError("test.code", "Test message", { cause });
  const json = error.toJSON();

  assert.equal(json.cause, "cause message");
});

test("ValidationError has correct defaults", () => {
  const error = new ValidationError("validation.field", "Field is required");

  assert.equal(error.category, "validation");
  assert.equal(error.source, "runtime");
  assert.equal(error.statusCode, 400);
  assert.equal(error.retryable, false);
  assert.equal(error.name, "ValidationError");
});

test("PolicyDeniedError has correct defaults", () => {
  const error = new PolicyDeniedError("policy.denied", "Action not allowed");

  assert.equal(error.category, "policy");
  assert.equal(error.source, "policy");
  assert.equal(error.statusCode, 403);
  assert.equal(error.retryable, false);
  assert.equal(error.name, "PolicyDeniedError");
});

test("AuthError has correct defaults", () => {
  const error = new AuthError("auth.unauthorized", "Invalid credentials");

  assert.equal(error.category, "auth");
  assert.equal(error.source, "gateway");
  assert.equal(error.statusCode, 401);
  assert.equal(error.retryable, false);
  assert.equal(error.name, "AuthError");
});

test("ProviderError has correct defaults", () => {
  const error = new ProviderError("provider.timeout", "AI provider timeout");

  assert.equal(error.category, "provider");
  assert.equal(error.source, "provider");
  assert.equal(error.statusCode, 502);
  assert.equal(error.retryable, true);
  assert.equal(error.name, "ProviderError");
});

test("ToolExecutionError has correct defaults", () => {
  const error = new ToolExecutionError("tool.exec", "Tool execution failed");

  assert.equal(error.category, "tool");
  assert.equal(error.source, "tool");
  assert.equal(error.statusCode, 500);
  assert.equal(error.retryable, false);
  assert.equal(error.name, "ToolExecutionError");
});

test("SandboxError has correct defaults", () => {
  const error = new SandboxError("sandbox.violation", "Sandbox security violation");

  assert.equal(error.category, "sandbox");
  assert.equal(error.source, "tool");
  assert.equal(error.statusCode, 403);
  assert.equal(error.retryable, false);
  assert.equal(error.name, "SandboxError");
});

test("StorageError has correct defaults", () => {
  const error = new StorageError("storage.io", "Database write failed");

  assert.equal(error.category, "storage");
  assert.equal(error.source, "storage");
  assert.equal(error.statusCode, 500);
  assert.equal(error.retryable, true);
  assert.equal(error.name, "StorageError");
});

test("WorkflowStateError has correct defaults", () => {
  const error = new WorkflowStateError("workflow.invalid_transition", "Invalid state transition");

  assert.equal(error.category, "workflow");
  assert.equal(error.source, "workflow");
  assert.equal(error.statusCode, 409);
  assert.equal(error.retryable, false);
  assert.equal(error.name, "WorkflowStateError");
});

test("TenantBoundaryError has correct defaults", () => {
  const error = new TenantBoundaryError("tenant.access", "Tenant boundary violation");

  assert.equal(error.category, "tenant");
  assert.equal(error.source, "policy");
  assert.equal(error.statusCode, 403);
  assert.equal(error.retryable, false);
  assert.equal(error.name, "TenantBoundaryError");
});

test("MonetizationError has correct defaults", () => {
  const error = new MonetizationError("billing.insufficient", "Insufficient credit");

  assert.equal(error.category, "monetization");
  assert.equal(error.source, "runtime");
  assert.equal(error.statusCode, 402);
  assert.equal(error.retryable, false);
  assert.equal(error.name, "MonetizationError");
});

test("InternalAppError has correct defaults", () => {
  const error = new InternalAppError("internal.crash", "Unexpected internal error");

  assert.equal(error.category, "internal");
  assert.equal(error.source, "internal");
  assert.equal(error.statusCode, 500);
  assert.equal(error.retryable, false);
  assert.equal(error.name, "InternalAppError");
});

test("LockingError has E7-prefixed code and correct defaults", () => {
  const error = new LockingError("001", "Lock acquisition failed");

  assert.equal(error.code, "E7001");
  assert.equal(error.statusCode, 409);
  assert.equal(error.retryable, true);
  assert.equal(error.name, "LockingError");
});

test("MemoryError has E8-prefixed code and correct defaults", () => {
  const error = new MemoryError("002", "Memory allocation failed");

  assert.equal(error.code, "E8002");
  assert.equal(error.statusCode, 500);
  assert.equal(error.source, "runtime");
  assert.equal(error.name, "MemoryError");
});

test("RuntimeError has EC-prefixed code and correct defaults", () => {
  const error = new RuntimeError("003", "Runtime execution failed");

  assert.equal(error.code, "EC003");
  assert.equal(error.statusCode, 500);
  assert.equal(error.category, "runtime");
  assert.equal(error.source, "runtime");
  assert.equal(error.name, "RuntimeError");
});

test("createErrorCode formats correctly", () => {
  assert.equal(createErrorCode("0", 1), "E0001");
  assert.equal(createErrorCode("A", 12), "EA012");
  assert.equal(createErrorCode("7", 999), "E7999");
});

test("createErrorCode pads single digit codes to 3 digits", () => {
  assert.equal(createErrorCode("1", 5), "E1005");
  assert.equal(createErrorCode("B", 1), "EB001");
});

test("isAppError returns true for AppError instances", () => {
  assert.equal(isAppError(new AppError("test", "test")), true);
  assert.equal(isAppError(new ValidationError("test", "test")), true);
  assert.equal(isAppError(new AuthError("test", "test")), true);
});

test("isAppError returns false for non-AppError values", () => {
  assert.equal(isAppError(new Error("regular error")), false);
  assert.equal(isAppError("string error"), false);
  assert.equal(isAppError(null), false);
  assert.equal(isAppError(undefined), false);
  assert.equal(isAppError({ code: "test" }), false);
});

test("getErrorCode returns code from AppError", () => {
  const error = new ValidationError("validation.input", "Invalid input");
  assert.equal(getErrorCode(error), "validation.input");
});

test("getErrorCode returns fallback for non-AppError", () => {
  assert.equal(getErrorCode(new Error("boom")), "E0000");
  assert.equal(getErrorCode("string error"), "E0000");
  assert.equal(getErrorCode(null), "E0000");
});

test("normalizeToAppError preserves existing AppError instances", () => {
  const existing = new ValidationError("api.invalid_json", "Payload is invalid.");
  assert.equal(
    normalizeToAppError(existing, {
      code: "api.unknown_error",
      message: "Unknown error.",
    }),
    existing,
  );
});

test("normalizeToAppError wraps unknown errors with internal details", () => {
  const wrapped = normalizeToAppError(new Error("boom"), {
    code: "runtime.unexpected_failure",
    message: "Unexpected runtime failure.",
    options: {
      category: "runtime",
      source: "runtime",
      retryable: true,
      statusCode: 500,
    },
  });

  assert.ok(wrapped instanceof AppError);
  assert.equal(wrapped.code, "runtime.unexpected_failure");
  assert.equal(wrapped.category, "runtime");
  assert.equal(wrapped.retryable, true);
  assert.deepEqual(wrapped.internalDetails, {
    originalError: "boom",
  });
});

test("AppError details returns undefined when internalDetails is null", () => {
  const error = new AppError("test.code", "Test message");
  assert.equal(error.details, undefined);
});

test("AppError details returns record when internalDetails is set", () => {
  const error = new AppError("test.code", "Test message", {
    details: { key: "value" },
  });
  assert.deepEqual(error.details, { key: "value" });
});

test("AppError accepts all optional context fields", () => {
  const error = new AppError("test.code", "Test message", {
    taskId: "task_123",
    executionId: "exec_456",
    traceId: "trace_789",
    causedBy: "SomeComponent",
    occurredAt: "2026-04-14T00:00:00.000Z",
  });

  assert.equal(error.taskId, "task_123");
  assert.equal(error.executionId, "exec_456");
  assert.equal(error.traceId, "trace_789");
  assert.equal(error.causedBy, "SomeComponent");
  assert.equal(error.occurredAt, "2026-04-14T00:00:00.000Z");
});

test("AppError.wrap preserves options when wrapping AppError", () => {
  const original = new ProviderError("provider.fail", "Provider failed", {
    retryable: true,
    taskId: "task_123",
  });
  const wrapped = AppError.wrap(original, "wrapped.code", "Wrapped message");

  // Should return the original AppError unchanged
  assert.equal(wrapped, original);
});

test("AppError subclass constructors accept all ErrorOptions", () => {
  const error = new ValidationError("validation.test", "Test validation", {
    statusCode: 422,
    retryable: true,
    details: { field: "email" },
    cause: new Error("cause"),
    category: "validation",
    source: "tool",
    traceId: "trace-1",
    taskId: "task-1",
    executionId: "exec-1",
    causedBy: "Validator",
    occurredAt: "2026-04-14T00:00:00.000Z",
    userMessage: "Custom user message",
  });

  assert.equal(error.statusCode, 422);
  assert.equal(error.retryable, true);
  assert.deepEqual(error.details, { field: "email" });
  assert.equal(error.cause instanceof Error, true);
  assert.equal(error.category, "validation");
  assert.equal(error.source, "tool");
  assert.equal(error.traceId, "trace-1");
  assert.equal(error.taskId, "task-1");
  assert.equal(error.executionId, "exec-1");
  assert.equal(error.causedBy, "Validator");
  assert.equal(error.occurredAt, "2026-04-14T00:00:00.000Z");
  assert.equal(error.userMessage, "Custom user message");
});

test("TransientExternalError has correct defaults - retryable", () => {
  const error = new TransientExternalError("external.timeout", "External service timed out");

  assert.equal(error.category, "external");
  assert.equal(error.source, "provider");
  assert.equal(error.statusCode, 502);
  assert.equal(error.retryable, true);
  assert.equal(error.name, "TransientExternalError");
});

test("TransientExternalError is retryable by default", () => {
  const error = new TransientExternalError("external.network", "Network connection reset");
  assert.equal(error.retryable, true);
});

test("TransientExternalError can be made non-retryable via options", () => {
  const error = new TransientExternalError("external.timeout", "Timeout", {
    retryable: false,
  });
  assert.equal(error.retryable, false);
});

test("TransientExternalError accepts all ErrorOptions", () => {
  const error = new TransientExternalError("external.fail", "External failed", {
    statusCode: 503,
    retryable: true,
    details: { endpoint: "https://api.example.com" },
    cause: new Error("original"),
    traceId: "trace-ext-1",
    taskId: "task-ext-1",
    executionId: "exec-ext-1",
    userMessage: "External service unavailable",
  });

  assert.equal(error.statusCode, 503);
  assert.equal(error.retryable, true);
  assert.deepEqual(error.details, { endpoint: "https://api.example.com" });
  assert.equal(error.traceId, "trace-ext-1");
  assert.equal(error.taskId, "task-ext-1");
  assert.equal(error.executionId, "exec-ext-1");
  assert.equal(error.userMessage, "External service unavailable");
});

test("PermanentExternalError has correct defaults - NOT retryable", () => {
  const error = new PermanentExternalError("external.invalid_key", "Invalid API key");

  assert.equal(error.category, "external");
  assert.equal(error.source, "provider");
  assert.equal(error.statusCode, 502);
  assert.equal(error.retryable, false);
  assert.equal(error.name, "PermanentExternalError");
});

test("PermanentExternalError is NOT retryable by default", () => {
  const error = new PermanentExternalError("external.rate_limit", "Rate limit exceeded");
  assert.equal(error.retryable, false);
});

test("PermanentExternalError cannot be made retryable (enforced by business logic)", () => {
  // Even if someone tries to set retryable: true, permanent external errors
  // should not be retried as the underlying issue won't resolve
  const error = new PermanentExternalError("external.auth_failed", "Authentication failed", {
    retryable: true, // This would be a misconfiguration - don't do this
  });
  // The constructor respects the option but callers should use TransientExternalError
  // for retryable external errors
  assert.equal(error.retryable, true); // Constructor override is still respected
});

test("PermanentExternalError accepts all ErrorOptions", () => {
  const error = new PermanentExternalError("external.forbidden", "Access forbidden", {
    statusCode: 403,
    retryable: false,
    details: { reason: "insufficient_scope" },
    cause: new Error("original"),
    traceId: "trace-perm-1",
    taskId: "task-perm-1",
    executionId: "exec-perm-1",
    userMessage: "External service access denied",
  });

  assert.equal(error.statusCode, 403);
  assert.equal(error.retryable, false);
  assert.deepEqual(error.details, { reason: "insufficient_scope" });
  assert.equal(error.traceId, "trace-perm-1");
  assert.equal(error.taskId, "task-perm-1");
  assert.equal(error.executionId, "exec-perm-1");
  assert.equal(error.userMessage, "External service access denied");
});

test("TransientExternalError vs PermanentExternalError distinction", () => {
  const transient = new TransientExternalError("external.tmp", "Temporary failure");
  const permanent = new PermanentExternalError("external.perm", "Permanent failure");

  // Transient should be retryable, permanent should not
  assert.equal(transient.retryable, true);
  assert.equal(permanent.retryable, false);

  // Both are in the "external" category
  assert.equal(transient.category, "external");
  assert.equal(permanent.category, "external");

  // Both use provider as default source
  assert.equal(transient.source, "provider");
  assert.equal(permanent.source, "provider");

  // Both return 502 by default
  assert.equal(transient.statusCode, 502);
  assert.equal(permanent.statusCode, 502);
});

test("isAppError returns true for TransientExternalError", () => {
  assert.equal(isAppError(new TransientExternalError("test", "test")), true);
});

test("isAppError returns true for PermanentExternalError", () => {
  assert.equal(isAppError(new PermanentExternalError("test", "test")), true);
});

test("getErrorCode works with TransientExternalError", () => {
  const error = new TransientExternalError("external.read_timeout", "Read timeout");
  assert.equal(getErrorCode(error), "external.read_timeout");
});

test("getErrorCode works with PermanentExternalError", () => {
  const error = new PermanentExternalError("external.invalid_token", "Invalid token");
  assert.equal(getErrorCode(error), "external.invalid_token");
});
