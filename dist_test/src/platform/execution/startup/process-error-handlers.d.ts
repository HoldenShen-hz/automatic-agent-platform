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
import type { GracefulShutdown } from "./graceful-shutdown.js";
/**
 * Creates the uncaughtException handler.
 *
 * Behavior:
 * - Logs FATAL with full stack trace
 * - Marks health as unhealthy (if HealthService is available)
 * - Initiates graceful shutdown
 * - Sets 60s hard-exit timer as ultimate fallback
 */
export declare function createUncaughtExceptionHandler(shutdown: GracefulShutdown): (err: Error) => void;
/**
 * Creates the unhandledRejection handler.
 *
 * Behavior:
 * - Logs ERROR with the rejection reason
 * - Distinguishes recoverable vs non-recoverable:
 *   - StorageError / NetworkError → degrade but don't exit
 *   - All others → same as uncaughtException
 */
export declare function createUnhandledRejectionHandler(shutdown: GracefulShutdown): (reason: unknown, promise: Promise<unknown>) => void;
/**
 * Registers all process-level error handlers.
 *
 * Call this at the very top of main() / entry-point files,
 * before any async work begins.
 *
 * @param shutdown - The GracefulShutdown instance to use for orderly shutdown
 */
export declare function registerProcessErrorHandlers(shutdown: GracefulShutdown): void;
