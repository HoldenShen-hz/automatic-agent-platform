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
    handler: () => Promise<void>;
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
export declare class GracefulShutdown {
    private readonly timeoutMs;
    private readonly forceKillAfterTimeout;
    private readonly logger;
    private readonly handlers;
    private readonly signalBus;
    private readonly exitHandler;
    private readonly signalListeners;
    private isShuttingDown;
    private shutdownPromise;
    private shutdownResult;
    constructor(options?: GracefulShutdownOptions);
    /**
     * Add a shutdown handler
     */
    addHandler(handler: ShutdownHandler): void;
    /**
     * Register SIGTERM and SIGINT signal handlers
     */
    registerSignalHandlers(): void;
    unregisterSignalHandlers(): void;
    private handleSignal;
    /**
     * Execute all shutdown handlers
     */
    shutdown(): Promise<ShutdownResult>;
    /**
     * Initiate shutdown from a non-signal context (e.g., uncaughtException).
     * Triggers the shutdown sequence without requiring a signal.
     * Idempotent — calling while already shutting down returns the existing promise.
     */
    initiateShutdown(_reason?: string): Promise<ShutdownResult>;
    /**
     * Check if shutdown is in progress
     */
    isShuttingDownState(): boolean;
    /**
     * Get the last shutdown result
     */
    getLastShutdownResult(): ShutdownResult | null;
    reset(): void;
    private executeShutdown;
}
export declare function getGlobalGracefulShutdown(): GracefulShutdown;
export declare function createGracefulShutdown(options?: GracefulShutdownOptions): GracefulShutdown;
export {};
