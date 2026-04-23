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
export class GracefulShutdown {
    timeoutMs;
    forceKillAfterTimeout;
    logger;
    handlers = [];
    signalBus;
    exitHandler;
    signalListeners = new Map();
    isShuttingDown = false;
    shutdownPromise = null;
    shutdownResult = null;
    constructor(options = {}) {
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
    addHandler(handler) {
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
    registerSignalHandlers() {
        if (this.signalListeners.size > 0) {
            return;
        }
        for (const signal of ["SIGTERM", "SIGINT"]) {
            const listener = () => {
                void this.handleSignal(signal);
            };
            this.signalBus.on(signal, listener);
            this.signalListeners.set(signal, listener);
        }
    }
    unregisterSignalHandlers() {
        for (const [signal, listener] of this.signalListeners.entries()) {
            this.signalBus.removeListener(signal, listener);
        }
        this.signalListeners.clear();
    }
    async handleSignal(signal) {
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
        }
        catch (error) {
            this.logger.log({
                level: "error",
                message: "Graceful shutdown failed",
                data: { error: error instanceof Error ? error.message : String(error) },
            });
            this.exitHandler(1);
        }
        finally {
            if (forcedExitTimer != null) {
                clearTimeout(forcedExitTimer);
            }
        }
    }
    /**
     * Execute all shutdown handlers
     */
    async shutdown() {
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
    initiateShutdown(_reason = "manual") {
        // Signal-based handleSignal calls shutdown() directly; this is the
        // programmatic equivalent for use in exception handlers.
        return this.shutdown();
    }
    /**
     * Check if shutdown is in progress
     */
    isShuttingDownState() {
        return this.isShuttingDown;
    }
    /**
     * Get the last shutdown result
     */
    getLastShutdownResult() {
        return this.shutdownResult;
    }
    reset() {
        this.unregisterSignalHandlers();
        this.isShuttingDown = false;
        this.shutdownPromise = null;
        this.shutdownResult = null;
    }
    async executeShutdown() {
        const startTime = Date.now();
        const errors = [];
        let handlersRun = 0;
        let handlersFailed = 0;
        this.logger.log({
            level: "info",
            message: "Starting graceful shutdown",
            data: { handlers: this.handlers.length },
        });
        for (const { name, handler, timeoutMs, critical } of [...this.handlers].reverse()) {
            const handlerTimeout = timeoutMs ?? this.timeoutMs;
            try {
                let timer = null;
                const timeoutPromise = new Promise((_, reject) => {
                    timer = setTimeout(() => {
                        reject(new Error(`Handler ${name} timed out after ${handlerTimeout}ms`));
                    }, handlerTimeout);
                    timer.unref?.();
                });
                await Promise.race([handler(), timeoutPromise]);
                if (timer != null) {
                    clearTimeout(timer);
                }
                handlersRun++;
                this.logger.log({
                    level: "debug",
                    message: "Shutdown handler completed",
                    data: { handlerName: name },
                });
            }
            catch (error) {
                handlersFailed++;
                const errorMsg = error instanceof Error ? error.message : String(error);
                errors.push(`${name}: ${errorMsg}`);
                this.logger.log({
                    level: "error",
                    message: "Shutdown handler failed",
                    data: { handlerName: name, error: errorMsg, critical },
                });
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
let globalShutdownInstance = null;
export function getGlobalGracefulShutdown() {
    if (!globalShutdownInstance) {
        globalShutdownInstance = new GracefulShutdown({
            registerSignalHandlers: true,
        });
    }
    return globalShutdownInstance;
}
export function createGracefulShutdown(options) {
    return new GracefulShutdown(options);
}
//# sourceMappingURL=graceful-shutdown.js.map