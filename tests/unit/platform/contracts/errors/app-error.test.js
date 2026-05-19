import assert from "node:assert/strict";
import test from "node:test";
import { AppError, ValidationError, PolicyDeniedError, AuthError, ProviderError, ToolExecutionError, SandboxError, StorageError, WorkflowStateError, TenantBoundaryError, TransientExternalError, PermanentExternalError, MonetizationError, InternalAppError, LockingError, MemoryError, RuntimeError, createErrorCode, isAppError, getErrorCode, normalizeToAppError, } from "../../../../../src/platform/contracts/errors.js";
test("AppError basic construction", () => {
    const err = new AppError("TEST_ERROR", "Test message");
    assert.equal(err.code, "TEST_ERROR");
    assert.equal(err.message, "Test message");
    assert.equal(err.category, "internal");
    assert.equal(err.source, "internal");
    assert.equal(err.statusCode, 500);
    assert.equal(err.retryable, false);
});
test("AppError with all options", () => {
    const cause = new Error("original cause");
    const err = new AppError("FULL_ERROR", "Full test", {
        statusCode: 422,
        retryable: true,
        details: { key: "value" },
        cause,
        category: "validation",
        source: "runtime",
        traceId: "trace-123",
        taskId: "task-456",
        executionId: "exec-789",
        causedBy: "OriginalComponent",
        userMessage: "User facing message",
    });
    assert.equal(err.code, "FULL_ERROR");
    assert.equal(err.statusCode, 422);
    assert.equal(err.retryable, true);
    assert.equal(err.category, "validation");
    assert.equal(err.source, "runtime");
    assert.equal(err.traceId, "trace-123");
    assert.equal(err.taskId, "task-456");
    assert.equal(err.executionId, "exec-789");
    assert.equal(err.causedBy, "OriginalComponent");
    assert.equal(err.userMessage, "User facing message");
    assert.equal(err.cause, cause);
});
test("AppError.toJSON serializes all fields", () => {
    const err = new AppError("JSON_ERROR", "JSON test", {
        statusCode: 400,
        category: "validation",
        source: "gateway",
        traceId: "trace-abc",
        taskId: "task-xyz",
    });
    const json = err.toJSON();
    assert.equal(json.code, "JSON_ERROR");
    assert.equal(json.errorCode, "JSON_ERROR");
    assert.equal(json.message, "JSON test");
    assert.equal(json.category, "validation");
    assert.equal(json.source, "gateway");
    assert.equal(json.traceId, "trace-abc");
    assert.equal(json.task_id, "task-xyz");
    assert.equal(json.taskId, "task-xyz");
    assert.equal(json.statusCode, 400);
    assert.equal(json.retryable, false);
});
test("AppError.wrap preserves existing AppError", () => {
    const existing = new AppError("EXISTING", "Already an AppError", { statusCode: 400 });
    const wrapped = AppError.wrap(existing, "SHOULD_IGNORE", "Should not appear");
    assert.equal(wrapped.code, "EXISTING");
    assert.equal(wrapped.statusCode, 400);
});
test("AppError.wrap converts unknown error", () => {
    const err = AppError.wrap(new Error("original"), "WRAPPED", "Wrapped error");
    assert.equal(err.code, "WRAPPED");
    assert.equal(err.userMessage, "Wrapped error");
    assert.ok(err.internalDetails !== null);
    assert.equal(err.internalDetails?.originalError, "original");
});
test("AppError.wrap converts raw string error", () => {
    const err = AppError.wrap("raw string error", "RAW_ERR", "String wrapped");
    assert.equal(err.code, "RAW_ERR");
    assert.ok(err.internalDetails !== null);
});
test("errorCode getter returns code", () => {
    const err = new AppError("CODE_GET", "message");
    assert.equal(err.errorCode, "CODE_GET");
});
test("details getter returns undefined when null", () => {
    const err = new AppError("DETAILS_NULL", "message");
    assert.equal(err.details, undefined);
});
test("details getter returns object when set", () => {
    const err = new AppError("DETAILS_SET", "message", { details: { foo: "bar" } });
    assert.deepEqual(err.details, { foo: "bar" });
});
test("ValidationError default status is 400", () => {
    const err = new ValidationError("VAL_ERR", "Validation failed");
    assert.equal(err.statusCode, 400);
    assert.equal(err.category, "validation");
    assert.equal(err.name, "ValidationError");
});
test("PolicyDeniedError default status is 403", () => {
    const err = new PolicyDeniedError("POLICY_DENY", "Policy violation");
    assert.equal(err.statusCode, 403);
    assert.equal(err.category, "policy");
    assert.equal(err.name, "PolicyDeniedError");
});
test("AuthError default status is 401", () => {
    const err = new AuthError("AUTH_FAIL", "Authentication failed");
    assert.equal(err.statusCode, 401);
    assert.equal(err.category, "auth");
    assert.equal(err.name, "AuthError");
});
test("ProviderError default status is 502 and retryable", () => {
    const err = new ProviderError("PROVIDER_FAIL", "Provider error");
    assert.equal(err.statusCode, 502);
    assert.equal(err.category, "provider");
    assert.equal(err.retryable, true);
    assert.equal(err.name, "ProviderError");
});
test("ToolExecutionError default status is 500", () => {
    const err = new ToolExecutionError("TOOL_FAIL", "Tool failed");
    assert.equal(err.statusCode, 500);
    assert.equal(err.category, "tool");
    assert.equal(err.name, "ToolExecutionError");
});
test("SandboxError default status is 403", () => {
    const err = new SandboxError("SANDBOX_VIOLATION", "Sandbox violated");
    assert.equal(err.statusCode, 403);
    assert.equal(err.category, "sandbox");
    assert.equal(err.name, "SandboxError");
});
test("StorageError default status is 500 and retryable", () => {
    const err = new StorageError("STORAGE_FAIL", "Storage failed");
    assert.equal(err.statusCode, 500);
    assert.equal(err.category, "storage");
    assert.equal(err.retryable, true);
    assert.equal(err.name, "StorageError");
});
test("WorkflowStateError default status is 409", () => {
    const err = new WorkflowStateError("WF_STATE", "Workflow state error");
    assert.equal(err.statusCode, 409);
    assert.equal(err.category, "workflow");
    assert.equal(err.name, "WorkflowStateError");
});
test("TenantBoundaryError default status is 403", () => {
    const err = new TenantBoundaryError("TENANT_BOUNDARY", "Tenant boundary violation");
    assert.equal(err.statusCode, 403);
    assert.equal(err.category, "tenant");
    assert.equal(err.name, "TenantBoundaryError");
});
test("TransientExternalError is retryable", () => {
    const err = new TransientExternalError("TRANS_ERR", "Transient error");
    assert.equal(err.statusCode, 502);
    assert.equal(err.retryable, true);
    assert.equal(err.name, "TransientExternalError");
});
test("PermanentExternalError is not retryable", () => {
    const err = new PermanentExternalError("PERM_ERR", "Permanent error");
    assert.equal(err.statusCode, 502);
    assert.equal(err.retryable, false);
    assert.equal(err.name, "PermanentExternalError");
});
test("MonetizationError default status is 402", () => {
    const err = new MonetizationError("BILLING_ERR", "Billing error");
    assert.equal(err.statusCode, 402);
    assert.equal(err.category, "monetization");
    assert.equal(err.name, "MonetizationError");
});
test("InternalAppError default status is 500", () => {
    const err = new InternalAppError("INTERNAL_ERR", "Internal error");
    assert.equal(err.statusCode, 500);
    assert.equal(err.category, "internal");
    assert.equal(err.name, "InternalAppError");
});
test("LockingError extends StorageError with E7 prefix", () => {
    const err = new LockingError("001", "Lock conflict", { lockKey: "abc" });
    assert.equal(err.code, "E7001");
    assert.equal(err.statusCode, 409);
    assert.equal(err.retryable, true);
    assert.equal(err.name, "LockingError");
    assert.equal(err.category, "storage");
});
test("MemoryError extends InternalAppError with E8 prefix", () => {
    const err = new MemoryError("023", "Memory failure");
    assert.equal(err.code, "E8023");
    assert.equal(err.statusCode, 500);
    assert.equal(err.name, "MemoryError");
    assert.equal(err.source, "runtime");
});
test("RuntimeError extends InternalAppError with EC prefix", () => {
    const err = new RuntimeError("101", "Runtime failure");
    assert.equal(err.code, "EC101");
    assert.equal(err.statusCode, 500);
    assert.equal(err.name, "RuntimeError");
    assert.equal(err.category, "runtime");
});
test("createErrorCode formats correctly", () => {
    assert.equal(createErrorCode("A", 1), "EA001");
    assert.equal(createErrorCode("B", 23), "EB023");
    assert.equal(createErrorCode("X", 999), "EX999");
});
test("isAppError returns true for AppError instances", () => {
    const err = new AppError("IS_APP", "test");
    assert.equal(isAppError(err), true);
});
test("isAppError returns false for non-AppError", () => {
    assert.equal(isAppError(new Error("regular")), false);
    assert.equal(isAppError("string error"), false);
    assert.equal(isAppError(null), false);
    assert.equal(isAppError(undefined), false);
});
test("getErrorCode returns code from AppError", () => {
    const err = new AppError("GET_CODE", "test");
    assert.equal(getErrorCode(err), "GET_CODE");
});
test("getErrorCode returns fallback for non-AppError", () => {
    assert.equal(getErrorCode(new Error("plain")), "E0000");
    assert.equal(getErrorCode("string"), "E0000");
});
test("normalizeToAppError returns AppError unchanged", () => {
    const original = new AppError("ORIG", "original");
    const normalized = normalizeToAppError(original, { code: "FALLBACK", message: "fallback" });
    assert.equal(normalized.code, "ORIG");
});
test("normalizeToAppError wraps unknown error", () => {
    const normalized = normalizeToAppError(new Error("unknown"), {
        code: "FALLBACK",
        message: "fallback message",
        options: { statusCode: 400 },
    });
    assert.equal(normalized.code, "FALLBACK");
    assert.equal(normalized.statusCode, 400);
});
//# sourceMappingURL=app-error.test.js.map