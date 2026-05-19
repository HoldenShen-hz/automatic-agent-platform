/**
 * AppError Contract Integration Tests
 *
 * Tests the unified AppError model including error wrapping,
 * serialization, and error code generation across error types.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { AppError, ValidationError, PolicyDeniedError, AuthError, ProviderError, StorageError, WorkflowStateError, TransientExternalError, PermanentExternalError, LockingError, MemoryError, RuntimeError, createErrorCode, isAppError, getErrorCode, normalizeToAppError, } from "../../../../src/platform/contracts/errors.js";
test("app-error: AppError constructor sets all properties correctly", () => {
    const error = new AppError("TEST_ERROR", "Test error message", {
        statusCode: 400,
        retryable: true,
        details: { extra: "info" },
        category: "validation",
        source: "runtime",
        traceId: "trace-123",
        taskId: "task-456",
        executionId: "exec-789",
        causedBy: "OriginalError",
        userMessage: "User-friendly message",
    });
    assert.equal(error.code, "TEST_ERROR");
    assert.equal(error.message, "User-friendly message");
    assert.equal(error.statusCode, 400);
    assert.equal(error.retryable, true);
    assert.equal(error.category, "validation");
    assert.equal(error.source, "runtime");
    assert.equal(error.traceId, "trace-123");
    assert.equal(error.taskId, "task-456");
    assert.equal(error.executionId, "exec-789");
    assert.equal(error.causedBy, "OriginalError");
    assert.equal(error.userMessage, "User-friendly message");
    assert.deepEqual(error.internalDetails, { extra: "info" });
});
test("app-error: AppError.wrap preserves original AppError", () => {
    const original = new AppError("ORIGINAL", "Original error", { category: "auth" });
    const wrapped = AppError.wrap(original, "WRAPPED", "Wrapped message");
    // Should return the original, not a new wrapper
    assert.equal(wrapped.code, "ORIGINAL");
    assert.equal(wrapped.category, "auth");
});
test("app-error: AppError.wrap converts unknown error to AppError", () => {
    const error = new Error("原始错误消息");
    const wrapped = AppError.wrap(error, "CONVERTED", "Converted error");
    assert.equal(wrapped.code, "CONVERTED");
    assert.equal(wrapped.message, "Converted error");
    assert.equal(wrapped.causedBy, "Error");
    assert.deepEqual(wrapped.internalDetails, { originalError: "原始错误消息" });
});
test("app-error: AppError.wrap preserves details from options", () => {
    const error = new Error("test");
    const wrapped = AppError.wrap(error, "CODE", "Message", {
        details: { custom: "detail" },
        taskId: "task-123",
    });
    assert.equal(wrapped.taskId, "task-123");
    assert.deepEqual(wrapped.internalDetails, { originalError: "test", custom: "detail" });
});
test("app-error: AppError.toJSON produces correct structure with camelCase and snake_case", () => {
    const error = new AppError("JSON_TEST", "Test message", {
        category: "validation",
        source: "runtime",
        traceId: "trace-abc",
        taskId: "task-xyz",
        statusCode: 400,
    });
    const json = error.toJSON();
    // camelCase fields
    assert.equal(json.code, "JSON_TEST");
    assert.equal(json.category, "validation");
    assert.equal(json.source, "runtime");
    assert.equal(json.traceId, "trace-abc");
    assert.equal(json.taskId, "task-xyz");
    assert.equal(json.statusCode, 400);
    // snake_case fields (for compatibility)
    assert.equal(json.trace_id, "trace-abc");
    assert.equal(json.task_id, "task-xyz");
    assert.equal(json.user_message, "Test message");
    // Both message and userMessage should be present
    assert.equal(json.message, "Test message");
    assert.equal(json.userMessage, "Test message");
});
test("app-error: ValidationError has correct defaults", () => {
    const error = new ValidationError("VAL_ERR", "Invalid input");
    assert.equal(error.category, "validation");
    assert.equal(error.source, "runtime");
    assert.equal(error.statusCode, 400);
    assert.equal(error.retryable, false);
});
test("app-error: PolicyDeniedError has correct defaults", () => {
    const error = new PolicyDeniedError("POLICY_DENIED", "Access denied");
    assert.equal(error.category, "policy");
    assert.equal(error.source, "policy");
    assert.equal(error.statusCode, 403);
});
test("app-error: AuthError has correct defaults", () => {
    const error = new AuthError("AUTH_FAILED", "Not authenticated");
    assert.equal(error.category, "auth");
    assert.equal(error.source, "gateway");
    assert.equal(error.statusCode, 401);
});
test("app-error: ProviderError is retryable by default", () => {
    const error = new ProviderError("PROVIDER_ERR", "Provider unavailable");
    assert.equal(error.category, "provider");
    assert.equal(error.source, "provider");
    assert.equal(error.statusCode, 502);
    assert.equal(error.retryable, true);
});
test("app-error: StorageError is retryable by default", () => {
    const error = new StorageError("STORAGE_ERR", "Database unavailable");
    assert.equal(error.category, "storage");
    assert.equal(error.source, "storage");
    assert.equal(error.statusCode, 500);
    assert.equal(error.retryable, true);
});
test("app-error: WorkflowStateError has correct defaults", () => {
    const error = new WorkflowStateError("WF_STATE", "Invalid state transition");
    assert.equal(error.category, "workflow");
    assert.equal(error.source, "workflow");
    assert.equal(error.statusCode, 409);
    assert.equal(error.retryable, false);
});
test("app-error: TransientExternalError is retryable", () => {
    const error = new TransientExternalError("TRANS_ERR", "Temporary failure");
    assert.equal(error.category, "external");
    assert.equal(error.statusCode, 502);
    assert.equal(error.retryable, true);
});
test("app-error: PermanentExternalError is not retryable", () => {
    const error = new PermanentExternalError("PERM_ERR", "Permanent failure");
    assert.equal(error.category, "external");
    assert.equal(error.statusCode, 502);
    assert.equal(error.retryable, false);
});
test("app-error: LockingError uses E7 prefix", () => {
    const error = new LockingError("001", "Lock conflict");
    assert.ok(error.code.startsWith("E7"));
    assert.equal(error.statusCode, 409);
    assert.equal(error.retryable, true);
});
test("app-error: MemoryError uses E8 prefix", () => {
    const error = new MemoryError("002", "Memory allocation failed");
    assert.ok(error.code.startsWith("E8"));
    assert.equal(error.statusCode, 500);
});
test("app-error: RuntimeError uses EC prefix", () => {
    const error = new RuntimeError("003", "Runtime failure");
    assert.ok(error.code.startsWith("EC"));
    assert.equal(error.statusCode, 500);
    assert.equal(error.category, "runtime");
    assert.equal(error.source, "runtime");
});
test("app-error: createErrorCode generates correct format", () => {
    assert.equal(createErrorCode("A", 1), "EA001");
    assert.equal(createErrorCode("A", 42), "EA042");
    assert.equal(createErrorCode("B", 999), "EB999");
    assert.equal(createErrorCode("X", 0), "EX000");
});
test("app-error: isAppError correctly identifies AppError instances", () => {
    const appError = new AppError("TEST", "test");
    const regularError = new Error("regular");
    assert.equal(isAppError(appError), true);
    assert.equal(isAppError(regularError), false);
    assert.equal(isAppError(null), false);
    assert.equal(isAppError(undefined), false);
});
test("app-error: getErrorCode extracts code from AppError", () => {
    const error = new AppError("EXTRACTED_CODE", "message");
    assert.equal(getErrorCode(error), "EXTRACTED_CODE");
    const regularError = new Error("regular");
    assert.equal(getErrorCode(regularError), "E0000");
    assert.equal(getErrorCode(null), "E0000");
    assert.equal(getErrorCode(undefined), "E0000");
});
test("app-error: normalizeToAppError preserves AppError instances", () => {
    const original = new AppError("ORIGINAL", "Original message");
    const normalized = normalizeToAppError(original, {
        code: "FALLBACK",
        message: "Fallback message",
    });
    assert.equal(normalized.code, "ORIGINAL");
    assert.equal(normalized.message, "Original message");
});
test("app-error: normalizeToAppError converts unknown errors", () => {
    const error = new Error("convert me");
    const normalized = normalizeToAppError(error, {
        code: "FALLBACK",
        message: "Fallback",
        options: { category: "validation" },
    });
    assert.equal(normalized.code, "FALLBACK");
    assert.equal(normalized.category, "validation");
});
test("app-error: error codes are accessible via errorCode getter", () => {
    const error = new AppError("CODE_GETTER_TEST", "message");
    assert.equal(error.errorCode, "CODE_GETTER_TEST");
});
test("app-error: details getter returns undefined when internalDetails is null", () => {
    const error = new AppError("NO_DETAILS", "message");
    assert.equal(error.details, undefined);
});
test("app-error: details getter returns value when internalDetails is set", () => {
    const error = new AppError("WITH_DETAILS", "message", {
        details: { key: "value" },
    });
    assert.deepEqual(error.details, { key: "value" });
});
test("app-error: cause is properly passed through", () => {
    const cause = new Error("cause error");
    const error = new AppError("WITH_CAUSE", "error message", { cause });
    assert.equal(error.cause, cause);
});
//# sourceMappingURL=app-error.test.js.map