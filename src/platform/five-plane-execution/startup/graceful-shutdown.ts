/**
 * @fileoverview Graceful Shutdown - Ensures clean shutdown of services and resources.
 *
 * Provides:
 * - Signal handling (SIGTERM, SIGINT)
 * - Resource cleanup with timeout
 * - Health check for shutdown completion
 * - Draining of in-flight requests
 *
 * @see docs_zh/contracts/shutdown_contract.md
 */

import { StructuredLogger } from "../../shared/observability/structured-logger.js";

interface SignalCapable {
  on(event: "SIGTERM" | "SIGINT", listener: () => void): unknown;
  removeListener(event: "SIGTERM" | "SIGINT", listener: () => void): unknown;
}

export interface GracefulShutdownOptions {
  /** Timeout in ms for graceful shutdown (default: 30000) */
  timeoutMs?: number;
  /** Whether to force kill after timeout (default: true) */
  forceKillAfterTimeout?: boolean;
  /** Logger instance */
  logger?: StructuredLogger;
  /** List of shutdown handlers */
  handlers?: ShutdownHandler[];
  /** Optional signal bus for tests or custom runtimes */
  signalBus?: SignalCapable;
  /** Whether to register signal handlers immediately */
  registerSignalHandlers?: boolean;
  /** Optional exit hook for signal timeout/failure paths */
  exitHandler?: (code: number) => void;
}

export interface ShutdownHandler {
  name: string;
  handler: (signal?: AbortSignal) => Promise<void>;
  timeoutMs?: number;
  critical?: boolean;
}

export interface ShutdownResult {
  success: boolean;
  handlersRun: number;
  handlersFailed: number;
  durationMs: number;
  errors: string[];
}

export class GracefulShutdown {
  private readonly timeoutMs: number;
  private readonly forceKillAfterTimeout: boolean;
  private readonly logger: StructuredLogger;
  private readonly handlers: ShutdownHandler[] = [];
  private readonly signalBus: SignalCapable;
  private readonly exitHandler: (code: number) => void;
  private readonly signalListeners = new Map<"SIGTERM" | "SIGINT", () => void>();
  private isShuttingDown = false;
  private shutdownPromise: Promise<ShutdownResult> | null = null;
  private shutdownResult: ShutdownResult | null = null;

  constructor(options: GracefulShutdownOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.forceKillAfterTimeout = options.forceKillAfterTimeout ?? true;
    this.logger = options.logger ?? new StructuredLogger({ retentionLimit: 100 });
    this.signalBus = options.signalBus ?? process;
    this.exitHandler = options.exitHandler ?? ((code) => {
      process.exitCode = code;
    });

    // Register default handlers if provided
    if (options.handlers) {
      for (const h of options.handlers) {
        this.addHandler(h);
      }
    }

    if (options.registerSignalHandlers === true) {
      this.registerSignalHandlers();
    }
  }

  /**
   * Add a shutdown handler
   */
  public addHandler(handler: ShutdownHandler): void {
    if (this.isShuttingDown) {
      this.logger.log({
        level: "warn",
        message: "Cannot add shutdown handler while shutting down",
        data: { handlerName: handler.name },
      });
      return;
    }
    this.handlers.push(handler);
  }

  /**
   * Register SIGTERM and SIGINT signal handlers
   */
  public registerSignalHandlers(): void {
    if (this.signalListeners.size > 0) {
      return;
    }

    for (const signal of ["SIGTERM", "SIGINT"] as const) {
      const listener = () => {
        void this.handleSignal(signal);
      };
      this.signalBus.on(signal, listener);
      this.signalListeners.set(signal, listener);
    }
  }

  public unregisterSignalHandlers(): void {
    for (const [signal, listener] of this.signalListeners.entries()) {
      this.signalBus.removeListener(signal, listener);
    }
    this.signalListeners.clear();
  }

  private async handleSignal(signal: "SIGTERM" | "SIGINT"): Promise<void> {
    this.unregisterSignalHandlers();

    this.logger.log({
      level: "info",
      message: `Received ${signal}, initiating graceful shutdown`,
      data: { handlerCount: this.handlers.length },
    });

    const forcedExitTimer = this.forceKillAfterTimeout
      ? setTimeout(() => {
        this.logger.log({
          level: "warn",
          message: "Graceful shutdown timed out, forcing exit",
          data: { timeoutMs: this.timeoutMs, signal },
        });
        this.exitHandler(1);
      }, this.timeoutMs)
      : null;
    forcedExitTimer?.unref?.();

    try {
      this.shutdownResult = await this.shutdown();
      this.logger.log({
        level: "info",
        message: "Graceful shutdown completed",
        data: {
          success: this.shutdownResult.success,
          durationMs: this.shutdownResult.durationMs,
        },
      });
      this.exitHandler(this.shutdownResult.success ? 0 : 1);
    } catch (error) {
      this.logger.log({
        level: "error",
        message: "Graceful shutdown failed",
        data: { error: error instanceof Error ? error.message : String(error) },
      });
      this.exitHandler(1);
    } finally {
      if (forcedExitTimer != null) {
        clearTimeout(forcedExitTimer);
      }
    }
  }

  /**
   * Execute all shutdown handlers
   */
  public shutdown(): Promise<ShutdownResult> {
    if (this.shutdownPromise != null) {
      return this.shutdownPromise;
    }

    this.isShuttingDown = true;
    this.shutdownPromise = this.executeShutdown();
    return this.shutdownPromise;
  }

  /**
   * Initiate shutdown from a non-signal context (e.g., uncaughtException).
   * Triggers the shutdown sequence without requiring a signal.
   * Idempotent — calling while already shutting down returns the existing promise.
   */
  public initiateShutdown(_reason: string = "manual"): Promise<ShutdownResult> {
    // Signal-based handleSignal calls shutdown() directly; this is the
    // programmatic equivalent for use in exception handlers.
    return this.shutdown();
  }

  /**
   * Check if shutdown is in progress
   */
  public isShuttingDownState(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Get the last shutdown result
   */
  public getLastShutdownResult(): ShutdownResult | null {
    return this.shutdownResult;
  }

  public reset(): void {
    this.unregisterSignalHandlers();
    this.isShuttingDown = false;
    this.shutdownPromise = null;
    this.shutdownResult = null;
    this.handlers.length = 0;
  }

  private async executeShutdown(): Promise<ShutdownResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let handlersRun = 0;
    let handlersFailed = 0;

    this.logger.log({
      level: "info",
      message: "Starting graceful shutdown",
      data: { handlers: this.handlers.length },
    });

    for (const { name, handler, timeoutMs, critical } of [...this.handlers].reverse()) {
      const handlerTimeout = timeoutMs ?? this.timeoutMs;
      const abortController = new AbortController();
      let timer: NodeJS.Timeout | null = null;
      handlersRun++;
      try {
        const timeoutPromise = new Promise<void>((_, reject) => {
          timer = setTimeout(() => {
            abortController.abort();
            reject(new Error(`Handler ${name} timed out after ${handlerTimeout}ms`));
          }, handlerTimeout);
          timer.unref?.();
        });

        await Promise.race([handler(abortController.signal), timeoutPromise]);
        this.logger.log({
          level: "debug",
          message: "Shutdown handler completed",
          data: { handlerName: name },
        });
      } catch (error) {
        handlersFailed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${name}: ${errorMsg}`);
        this.logger.log({
          level: "error",
          message: "Shutdown handler failed",
          data: { handlerName: name, error: errorMsg, critical },
        });
      } finally {
        if (timer != null) {
          clearTimeout(timer);
        }
        abortController.abort();
      }
    }

    const durationMs = Date.now() - startTime;
    this.shutdownResult = {
      success: handlersFailed === 0,
      handlersRun,
      handlersFailed,
      durationMs,
      errors,
    };

    return this.shutdownResult;
  }
}

// Singleton instance for process-level shutdown
let globalShutdownInstance: GracefulShutdown | null = null;

export function getGlobalGracefulShutdown(): GracefulShutdown {
  if (!globalShutdownInstance) {
    globalShutdownInstance = new GracefulShutdown({
      registerSignalHandlers: true,
    });
  }
  return globalShutdownInstance;
}

export function createGracefulShutdown(options?: GracefulShutdownOptions): GracefulShutdown {
  return new GracefulShutdown(options);
}
