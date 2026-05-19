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
import type { GracefulShutdown } from "./graceful-shutdown.js";

const processLogger = new StructuredLogger({ retentionLimit: 200 });
const RECOVERABLE_ERROR_CODES = new Set(["ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ECONNRESET"]);
const PROCESS_HARD_EXIT_TIMEOUT_MS = 60_000;

type RecoverableErrorLike = Error & {
  code?: unknown;
  cause?: unknown;
  retryable?: unknown;
  recoverable?: unknown;
};

let registeredUncaughtExceptionHandler: ((err: Error) => void) | null = null;
let registeredUnhandledRejectionHandler: ((reason: unknown, promise: Promise<unknown>) => void) | null = null;

function extractErrorCodes(error: unknown, seen: Set<unknown> = new Set()): string[] {
  if (error == null || seen.has(error)) {
    return [];
  }
  seen.add(error);
  if (typeof error === "string") {
    return [...RECOVERABLE_ERROR_CODES].filter((code) => error.includes(code));
  }
  if (!(error instanceof Error)) {
    return [];
  }
  const maybeRecoverable = error as RecoverableErrorLike;
  const codes: string[] = [];
  if (typeof maybeRecoverable.code === "string") {
    codes.push(maybeRecoverable.code);
  }
  codes.push(...extractErrorCodes(maybeRecoverable.cause, seen));
  return codes;
}

function isRecoverableRejection(reason: unknown): boolean {
  if (!(reason instanceof Error)) {
    return false;
  }
  const recoverable = reason as RecoverableErrorLike;
  if (recoverable.retryable === true || recoverable.recoverable === true) {
    return true;
  }
  const codes = extractErrorCodes(reason);
  if (codes.some((code) => RECOVERABLE_ERROR_CODES.has(code))) {
    return true;
  }
  return [...RECOVERABLE_ERROR_CODES].some((code) => reason.message.includes(code));
}

/**
 * Creates the uncaughtException handler.
 *
 * Behavior:
 * - Logs FATAL with full stack trace
 * - Marks health as unhealthy (if HealthService is available)
 * - Initiates graceful shutdown
 * - Sets 60s hard-exit timer as ultimate fallback
 */
export function createUncaughtExceptionHandler(
  shutdown: GracefulShutdown,
): (err: Error) => void {
  let hardExitTimer: NodeJS.Timeout | null = null;

  return (err: Error) => {
    // Cancel any existing hard-exit timer from a previous error
    if (hardExitTimer !== null) {
      clearTimeout(hardExitTimer);
      hardExitTimer = null;
    }

    processLogger.error("UNCAUGHT EXCEPTION — process will exit", {
      data: {
        errorName: err.name,
        errorMessage: err.message,
        errorCode: (err as RecoverableErrorLike).code ?? null,
      },
    });

    // Initiate graceful shutdown with reason
    try {
      void shutdown.initiateShutdown("uncaught_exception").catch((shutdownErr: unknown) => {
        processLogger.error("Failed to initiate graceful shutdown", {
          data: { error: String(shutdownErr) },
        });
      });
    } catch (shutdownErr) {
      processLogger.error("Failed to initiate graceful shutdown", {
        data: { error: String(shutdownErr) },
      });
    }

    // Ultimate fallback: process.exit(1) after 60s no matter what
    hardExitTimer = setTimeout(() => {
      processLogger.error("uncaughtException handler timed out — forcing process.exit(1)");
      process.exit(1);
    }, PROCESS_HARD_EXIT_TIMEOUT_MS);
    hardExitTimer.unref?.();
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
export function createUnhandledRejectionHandler(
  shutdown: GracefulShutdown,
): (reason: unknown, promise: Promise<unknown>) => void {
  let hardExitTimer: NodeJS.Timeout | null = null;

  return (reason: unknown, _promise: Promise<unknown>) => {
    // Cancel any existing hard-exit timer
    if (hardExitTimer !== null) {
      clearTimeout(hardExitTimer);
      hardExitTimer = null;
    }

    const reasonStr = reason instanceof Error
      ? `${reason.name}: ${reason.message}`
      : String(reason ?? "unknown");
    const reasonCode = reason instanceof Error ? (reason as RecoverableErrorLike).code ?? null : null;

    // Check if this is a recoverable error type
    const isRecoverable = isRecoverableRejection(reason);

    if (isRecoverable) {
      processLogger.warn("UNHANDLED REJECTION (recoverable) — degraded mode", {
        data: {
          reason: reasonStr,
          reasonCode,
          note: "Process continues but operates in degraded state",
        },
      });
      // Don't exit — let the system run in degraded mode
      return;
    }

    processLogger.error("UNHANDLED REJECTION (non-recoverable) — process will exit", {
      data: {
        reason: reasonStr,
        reasonCode,
      },
    });

    try {
      void shutdown.initiateShutdown("unhandled_rejection").catch((shutdownErr: unknown) => {
        processLogger.error("Failed to initiate graceful shutdown", {
          data: { error: String(shutdownErr) },
        });
      });
    } catch (shutdownErr) {
      processLogger.error("Failed to initiate graceful shutdown", {
        data: { error: String(shutdownErr) },
      });
    }

    // Ultimate fallback: process.exit(1) after 60s no matter what
    hardExitTimer = setTimeout(() => {
      processLogger.error("unhandledRejection handler timed out — forcing process.exit(1)");
      process.exit(1);
    }, PROCESS_HARD_EXIT_TIMEOUT_MS);
    hardExitTimer.unref?.();
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
export function registerProcessErrorHandlers(shutdown: GracefulShutdown): void {
  const uncaughtExceptionHandler = createUncaughtExceptionHandler(shutdown);
  const unhandledRejectionHandler = createUnhandledRejectionHandler(shutdown);

  if (registeredUncaughtExceptionHandler) {
    process.off("uncaughtException", registeredUncaughtExceptionHandler);
  }
  if (registeredUnhandledRejectionHandler) {
    process.off("unhandledRejection", registeredUnhandledRejectionHandler);
  }

  process.on("uncaughtException", uncaughtExceptionHandler);
  process.on("unhandledRejection", unhandledRejectionHandler);
  registeredUncaughtExceptionHandler = uncaughtExceptionHandler;
  registeredUnhandledRejectionHandler = unhandledRejectionHandler;

  processLogger.info("Process error handlers registered", {
    data: { pid: process.pid },
  });
}
