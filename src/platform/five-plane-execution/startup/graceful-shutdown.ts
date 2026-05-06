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
import { ServiceRegistry } from "../../shared/lifecycle/service-registry.js";

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
  /** Whether to automatically register the platform-wide ServiceRegistry teardown handler */
  includeServiceRegistryTeardown?: boolean;
}

export interface ShutdownHandler {
  name: string;
  handler: () => Promise<void>;
  timeoutMs?: number;
  critical?: boolean;
  /** R20-42 FIX: List of handler names that must run AFTER this handler completes.
   *  Used for dependency-aware ordering instead of fragile reverse-insertion-order.
   *  Handlers with no dependsOn run first in the dependency order. */
  dependsOn?: readonly string[];
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

    if (options.includeServiceRegistryTeardown === true) {
      // R20-38 FIX: Register ServiceRegistry cleanup only for the global process shutdown instance.
      // Per-instance test and helper shutdowns must not gain an implicit extra handler because that
      // changes handler counts and execution order in ways callers did not request.
      this.addHandler({
        name: "service_registry_teardown",
        handler: async () => {
          // Import here to avoid circular dependency at module load time
          const { ServiceRegistry } = await import("../../shared/lifecycle/service-registry.js");
          const registry = ServiceRegistry.getInstance();
          if (registry.isInitialized("platform.global-shutdown")) {
            await registry.reset();
          }
        },
        timeoutMs: 10000,
        critical: true,
      });
    }

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
  public async shutdown(): Promise<ShutdownResult> {
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
  }

  /**
   * R20-42 FIX: Topologically sort handlers based on dependsOn relationships.
   * Uses Kahn's algorithm for topological sorting.
   * Handlers with no dependencies come first; handlers with dependencies come after.
   *
   * For example, if we have:
   *   A dependsOn [B, C]
   *   B dependsOn []
   *   C dependsOn []
   *
   * Sort order will be: B, C, A (B and C first since they have no deps, then A)
   *
   * During shutdown (which iterates reversed), order becomes: A, C, B
   * This ensures B and C run BEFORE A, satisfying the dependency requirement.
   */
  private topologicalSortHandlers(): ShutdownHandler[] {
    const handlerMap = new Map<string, ShutdownHandler>();
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const h of this.handlers) {
      handlerMap.set(h.name, h);
      inDegree.set(h.name, 0);
      adjacency.set(h.name, []);
    }

    // Build graph: handler -> handlers that depend on it
    for (const h of this.handlers) {
      for (const dep of h.dependsOn ?? []) {
        if (handlerMap.has(dep)) {
          // dep must run BEFORE h, so edge dep -> h
          adjacency.get(dep)!.push(h.name);
          inDegree.set(h.name, (inDegree.get(h.name) ?? 0) + 1);
        }
      }
    }

    // Kahn's algorithm
    const queue: string[] = [];
    const result: string[] = [];

    for (const [name, degree] of inDegree) {
      if (degree === 0) {
        queue.push(name);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      for (const neighbor of adjacency.get(current) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Check for cycles - if cycle exists, fall back to insertion order for cyclic handlers
    if (result.length !== this.handlers.length) {
      const cyclicHandlers = this.handlers.filter((h) => !result.includes(h.name));
      this.logger.log({
        level: "warn",
        message: "Circular dependency detected in shutdown handlers, using insertion order for cyclic handlers",
        data: { cyclicHandlers: cyclicHandlers.map((h) => h.name) },
      });
      for (const h of cyclicHandlers) {
        result.push(h.name);
      }
    }

    return result.map((name) => handlerMap.get(name)!);
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

    // R20-42 FIX: Use dependency-aware topological sort instead of fragile reverse insertion order.
    // Handlers with no dependsOn form the "leaves" (run first), those with dependencies run after
    // their dependencies. This ensures proper drain→flush→close ordering per §9.
    const sortedHandlers = this.topologicalSortHandlers();
    const handlersToRun = [...sortedHandlers].reverse(); // Dependencies first, dependents after

    for (const { name, handler, timeoutMs, critical } of handlersToRun) {
      const handlerTimeout = timeoutMs ?? this.timeoutMs;
      try {
        let timer: NodeJS.Timeout | null = null;
        const timeoutPromise = new Promise<void>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`Handler ${name} timed out after ${handlerTimeout}ms`));
          }, handlerTimeout);
          // Keep timeout enforcement while shutdown is active, but don't let a leaked
          // timer pin the process if the handler resolves/rejects before the timeout.
          timer.unref?.();
        });
        try {
          await Promise.race([handler(), timeoutPromise]);
        } finally {
          if (timer != null) {
            clearTimeout(timer);
          }
        }
        handlersRun++;
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

export function getGlobalGracefulShutdown(registry: ServiceRegistry = ServiceRegistry.getInstance()): GracefulShutdown {
  if (registry.isInitialized("platform.global-shutdown")) {
    globalShutdownInstance = registry.get<GracefulShutdown>("platform.global-shutdown");
    return globalShutdownInstance;
  }
  if (!globalShutdownInstance) {
    globalShutdownInstance = new GracefulShutdown({
      includeServiceRegistryTeardown: true,
      registerSignalHandlers: true,
    });
  }
  // Register in ServiceRegistry to avoid dual-singleton leak
  registry.register<GracefulShutdown>("platform.global-shutdown", {
    init: () => globalShutdownInstance!,
  });
  return globalShutdownInstance;
}

export function createGracefulShutdown(options?: GracefulShutdownOptions): GracefulShutdown {
  return new GracefulShutdown(options);
}
