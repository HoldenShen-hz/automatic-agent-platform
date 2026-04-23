/**
 * Process Error Handlers — GAP-INFRA-01
 *
 * Registers global process-level exception/rejection handlers to ensure
 * that uncaught errors are logged, trigger graceful shutdown, and leave
 * a clear audit trail before the process exits.
 *
 * §6 Execute Layer L6 fault tolerance: process crash should be the last resort
 * after all other L1-L5 fault tolerance mechanisms have been exhausted.
 * Even then, the crash must be orderly, not silent.
 *
 * @see docs_zh/contracts/shutdown_contract.md
 * @see GAP-INFRA-01: src/core/runtime/process-error-handlers.ts
 */
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
const processLogger = new StructuredLogger({ retentionLimit: 200 });
/**
 * Creates the uncaughtException handler.
 *
 * Behavior:
 * - Logs FATAL with full stack trace
 * - Marks health as unhealthy (if HealthService is available)
 * - Initiates graceful shutdown
 * - Sets 60s hard-exit timer as ultimate fallback
 */
export function createUncaughtExceptionHandler(shutdown) {
    let hardExitTimer = null;
    return (err) => {
        // Cancel any existing hard-exit timer from a previous error
        if (hardExitTimer !== null) {
            clearTimeout(hardExitTimer);
            hardExitTimer = null;
        }
        processLogger.error("UNCAUGHT EXCEPTION — process will exit", {
            data: {
                errorName: err.name,
                errorMessage: err.message,
                stack: err.stack,
            },
        });
        // Initiate graceful shutdown with reason
        try {
            shutdown.initiateShutdown("uncaught_exception");
        }
        catch (shutdownErr) {
            processLogger.error("Failed to initiate graceful shutdown", {
                data: { error: String(shutdownErr) },
            });
        }
        // Ultimate fallback: process.exit(1) after 60s no matter what
        hardExitTimer = setTimeout(() => {
            processLogger.error("uncaughtException handler timed out — forcing process.exit(1)");
            process.exit(1);
        }, 60_000).unref();
    };
}
/**
 * Creates the unhandledRejection handler.
 *
 * Behavior:
 * - Logs ERROR with the rejection reason
 * - Distinguishes recoverable vs non-recoverable:
 *   - StorageError / NetworkError → degrade but don't exit
 *   - All others → same as uncaughtException
 */
export function createUnhandledRejectionHandler(shutdown) {
    let hardExitTimer = null;
    return (reason, _promise) => {
        // Cancel any existing hard-exit timer
        if (hardExitTimer !== null) {
            clearTimeout(hardExitTimer);
            hardExitTimer = null;
        }
        const reasonStr = reason instanceof Error
            ? `${reason.name}: ${reason.message}`
            : String(reason ?? "unknown");
        const reasonStack = reason instanceof Error ? reason.stack : undefined;
        // Check if this is a recoverable error type
        const isRecoverable = reason instanceof Error && (reason.name === "StorageError" ||
            reason.name === "NetworkError" ||
            reason.message?.includes("ECONNREFUSED") ||
            reason.message?.includes("ETIMEDOUT"));
        if (isRecoverable) {
            processLogger.warn("UNHANDLED REJECTION (recoverable) — degraded mode", {
                data: {
                    reason: reasonStr,
                    stack: reasonStack,
                    note: "Process continues but operates in degraded state",
                },
            });
            // Don't exit — let the system run in degraded mode
            return;
        }
        processLogger.error("UNHANDLED REJECTION (non-recoverable) — process will exit", {
            data: {
                reason: reasonStr,
                stack: reasonStack,
            },
        });
        try {
            shutdown.initiateShutdown("unhandled_rejection");
        }
        catch (shutdownErr) {
            processLogger.error("Failed to initiate graceful shutdown", {
                data: { error: String(shutdownErr) },
            });
        }
        // Ultimate fallback: process.exit(1) after 60s no matter what
        hardExitTimer = setTimeout(() => {
            processLogger.error("unhandledRejection handler timed out — forcing process.exit(1)");
            process.exit(1);
        }, 60_000).unref();
    };
}
/**
 * Registers all process-level error handlers.
 *
 * Call this at the very top of main() / entry-point files,
 * before any async work begins.
 *
 * @param shutdown - The GracefulShutdown instance to use for orderly shutdown
 */
export function registerProcessErrorHandlers(shutdown) {
    const uncaughtExceptionHandler = createUncaughtExceptionHandler(shutdown);
    const unhandledRejectionHandler = createUnhandledRejectionHandler(shutdown);
    process.on("uncaughtException", uncaughtExceptionHandler);
    process.on("unhandledRejection", unhandledRejectionHandler);
    processLogger.info("Process error handlers registered", {
        data: { pid: process.pid },
    });
}
//# sourceMappingURL=process-error-handlers.js.map