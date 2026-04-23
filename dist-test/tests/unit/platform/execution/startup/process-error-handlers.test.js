import assert from "node:assert/strict";
import test from "node:test";
import { createUncaughtExceptionHandler, createUnhandledRejectionHandler, } from "../../../../../src/platform/execution/startup/process-error-handlers.js";
function createMockGracefulShutdown() {
    const mock = {
        initiateShutdownCalls: [],
    };
    return {
        initiateShutdownCalls: mock.initiateShutdownCalls,
        async initiateShutdown(reason) {
            mock.initiateShutdownCalls.push(reason ?? "unknown");
            return {
                success: true,
                handlersRun: 0,
                handlersFailed: 0,
                durationMs: 0,
                errors: [],
            };
        },
        async shutdown() {
            return {
                success: true,
                handlersRun: 0,
                handlersFailed: 0,
                durationMs: 0,
                errors: [],
            };
        },
        addHandler() { },
        registerSignalHandlers() { },
        unregisterSignalHandlers() { },
        isShuttingDownState() {
            return false;
        },
        getLastShutdownResult() {
            return null;
        },
        reset() { },
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// Tests - createUncaughtExceptionHandler
// ─────────────────────────────────────────────────────────────────────────────
test("createUncaughtExceptionHandler - returns a function", () => {
    const shutdown = createMockGracefulShutdown();
    const handler = createUncaughtExceptionHandler(shutdown);
    assert.equal(typeof handler, "function");
});
test("createUncaughtExceptionHandler - calls initiateShutdown with reason", () => {
    const shutdown = createMockGracefulShutdown();
    const handler = createUncaughtExceptionHandler(shutdown);
    const error = new Error("test error");
    handler(error);
    assert.deepStrictEqual(shutdown.initiateShutdownCalls, ["uncaught_exception"]);
});
test("createUncaughtExceptionHandler - handles initiateShutdown error gracefully", () => {
    const shutdown = createMockGracefulShutdown();
    shutdown.initiateShutdownError = new Error("shutdown failed");
    const handler = createUncaughtExceptionHandler(shutdown);
    // Should not throw
    handler(new Error("test error"));
    assert.deepStrictEqual(shutdown.initiateShutdownCalls, ["uncaught_exception"]);
});
test("createUncaughtExceptionHandler - multiple calls cancel previous timer", () => {
    const shutdown = createMockGracefulShutdown();
    const handler = createUncaughtExceptionHandler(shutdown);
    const error = new Error("first error");
    handler(error);
    handler(new Error("second error"));
    // Should still call shutdown
    assert.equal(shutdown.initiateShutdownCalls.length, 2);
});
test("createUncaughtExceptionHandler - logs error with stack trace", () => {
    const shutdown = createMockGracefulShutdown();
    const handler = createUncaughtExceptionHandler(shutdown);
    const error = new Error("test error");
    error.stack = "Error: test error\n    at test.js:1:1";
    // Should not throw
    handler(error);
    assert.equal(shutdown.initiateShutdownCalls.length, 1);
});
// ─────────────────────────────────────────────────────────────────────────────
// Tests - createUnhandledRejectionHandler
// ─────────────────────────────────────────────────────────────────────────────
test("createUnhandledRejectionHandler - returns a function", () => {
    const shutdown = createMockGracefulShutdown();
    const handler = createUnhandledRejectionHandler(shutdown);
    assert.equal(typeof handler, "function");
});
test("createUnhandledRejectionHandler - calls initiateShutdown for non-recoverable errors", () => {
    const shutdown = createMockGracefulShutdown();
    const handler = createUnhandledRejectionHandler(shutdown);
    handler(new Error("normal error"), Promise.resolve());
    assert.deepStrictEqual(shutdown.initiateShutdownCalls, ["unhandled_rejection"]);
});
test("createUnhandledRejectionHandler - does NOT exit for StorageError", () => {
    const shutdown = createMockGracefulShutdown();
    const handler = createUnhandledRejectionHandler(shutdown);
    const storageError = new Error("storage unavailable");
    storageError.name = "StorageError";
    handler(storageError, Promise.resolve());
    // Should NOT call initiateShutdown for recoverable errors
    assert.deepStrictEqual(shutdown.initiateShutdownCalls, []);
});
test("createUnhandledRejectionHandler - does NOT exit for NetworkError", () => {
    const shutdown = createMockGracefulShutdown();
    const handler = createUnhandledRejectionHandler(shutdown);
    const networkError = new Error("network unavailable");
    networkError.name = "NetworkError";
    handler(networkError, Promise.resolve());
    assert.deepStrictEqual(shutdown.initiateShutdownCalls, []);
});
test("createUnhandledRejectionHandler - does NOT exit for ECONNREFUSED", () => {
    const shutdown = createMockGracefulShutdown();
    const handler = createUnhandledRejectionHandler(shutdown);
    const error = new Error("Connection refused: ECONNREFUSED");
    handler(error, Promise.resolve());
    assert.deepStrictEqual(shutdown.initiateShutdownCalls, []);
});
test("createUnhandledRejectionHandler - does NOT exit for ETIMEDOUT", () => {
    const shutdown = createMockGracefulShutdown();
    const handler = createUnhandledRejectionHandler(shutdown);
    const error = new Error("Connection timed out: ETIMEDOUT");
    handler(error, Promise.resolve());
    assert.deepStrictEqual(shutdown.initiateShutdownCalls, []);
});
test("createUnhandledRejectionHandler - handles string reason", () => {
    const shutdown = createMockGracefulShutdown();
    const handler = createUnhandledRejectionHandler(shutdown);
    handler("string reason", Promise.resolve());
    // String reason is not recoverable, should trigger shutdown
    assert.deepStrictEqual(shutdown.initiateShutdownCalls, ["unhandled_rejection"]);
});
test("createUnhandledRejectionHandler - handles null reason", () => {
    const shutdown = createMockGracefulShutdown();
    const handler = createUnhandledRejectionHandler(shutdown);
    handler(null, Promise.resolve());
    // null is not recoverable, should trigger shutdown
    assert.deepStrictEqual(shutdown.initiateShutdownCalls, ["unhandled_rejection"]);
});
test("createUnhandledRejectionHandler - handles undefined reason", () => {
    const shutdown = createMockGracefulShutdown();
    const handler = createUnhandledRejectionHandler(shutdown);
    handler(undefined, Promise.resolve());
    // undefined is not recoverable, should trigger shutdown
    assert.deepStrictEqual(shutdown.initiateShutdownCalls, ["unhandled_rejection"]);
});
test("createUnhandledRejectionHandler - handles initiateShutdown error gracefully", () => {
    const shutdown = createMockGracefulShutdown();
    shutdown.initiateShutdownError = new Error("shutdown failed");
    const handler = createUnhandledRejectionHandler(shutdown);
    // Should not throw
    handler(new Error("normal error"), Promise.resolve());
    assert.deepStrictEqual(shutdown.initiateShutdownCalls, ["unhandled_rejection"]);
});
test("createUnhandledRejectionHandler - multiple recoverable calls don't accumulate timers", () => {
    const shutdown = createMockGracefulShutdown();
    const handler = createUnhandledRejectionHandler(shutdown);
    const storageError = new Error("storage error");
    storageError.name = "StorageError";
    handler(storageError, Promise.resolve());
    handler(storageError, Promise.resolve());
    // Should only have one call since they're recoverable
    assert.deepStrictEqual(shutdown.initiateShutdownCalls, []);
});
test("createUnhandledRejectionHandler - handles error with custom name that is not recoverable", () => {
    const shutdown = createMockGracefulShutdown();
    const handler = createUnhandledRejectionHandler(shutdown);
    const customError = new Error("custom error");
    customError.name = "CustomError";
    handler(customError, Promise.resolve());
    assert.deepStrictEqual(shutdown.initiateShutdownCalls, ["unhandled_rejection"]);
});
test("createUnhandledRejectionHandler - Error instance with no name is non-recoverable", () => {
    const shutdown = createMockGracefulShutdown();
    const handler = createUnhandledRejectionHandler(shutdown);
    const error = new Error("error with no special name");
    // Don't set a special name
    handler(error, Promise.resolve());
    assert.deepStrictEqual(shutdown.initiateShutdownCalls, ["unhandled_rejection"]);
});
test("createUnhandledRejectionHandler - Promise rejection with object reason", () => {
    const shutdown = createMockGracefulShutdown();
    const handler = createUnhandledRejectionHandler(shutdown);
    handler({ reason: "object reason" }, Promise.resolve());
    // Object reason is not recoverable, should trigger shutdown
    assert.deepStrictEqual(shutdown.initiateShutdownCalls, ["unhandled_rejection"]);
});
//# sourceMappingURL=process-error-handlers.test.js.map