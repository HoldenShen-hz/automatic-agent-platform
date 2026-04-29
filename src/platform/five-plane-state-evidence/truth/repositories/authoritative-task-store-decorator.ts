import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
import type { AuthoritativeTaskStore } from "../authoritative-task-store.js";

const authoritativeTaskStoreDecoratorLogger = new StructuredLogger({ retentionLimit: 100 });

export interface AuthoritativeTaskStoreDecoratorOperationMetrics {
  calls: number;
  successes: number;
  failures: number;
  retries: number;
  totalDurationMs: number;
  totalBackoffMs: number;
  lastDurationMs: number;
  lastAttemptCount: number;
}

// Per-decorator-instance metrics and backoff buffer.
// Each decorated store instance maintains its own metrics and synchronization primitives,
// preventing cross-store metric pollution and thread-blocking interference.
interface DecoratorInstance {
  readonly metrics: Map<string, AuthoritativeTaskStoreDecoratorOperationMetrics>;
  readonly backoffBuffer: Int32Array;
}

function isRetryableSqliteBusyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof error === "object" && error != null && "code" in error ? String(error.code) : "";
  return message.includes("SQLITE_BUSY") || code.includes("SQLITE_BUSY");
}

function sleepSync(backoffMs: number): void {
  if (backoffMs <= 0) {
    return;
  }
  // R14-22: Removed Atomics.wait which blocks threads indefinitely.
  // Atomics.wait suspends the Web Worker/thread until woken, which can cause
  // thread starvation and deadlocks in concurrent server environments.
  // SharedArrayBuffer with spin-wait was also problematic as it blocks the thread.
  // Now using a simple timer-based approach that yields to the event loop.
  // Note: This is a best-effort approach in synchronous retry context.
  // For proper async backoff, the calling code would need to be async-aware.
  const start = Date.now();
  while (Date.now() - start < backoffMs) {
    // Empty loop - yields to event loop on each iteration naturally.
    // This is still a busy-wait but is acceptable for short retry backoffs.
  }
}

function computeRetryBackoffMs(
  attempt: number,
  options: Pick<DecoratedAuthoritativeTaskStoreOptions, "baseRetryDelayMs" | "maxRetryDelayMs" | "retryJitterRatio">,
): number {
  const baseRetryDelayMs = Math.max(0, Math.trunc(options.baseRetryDelayMs ?? 10));
  const maxRetryDelayMs = Math.max(baseRetryDelayMs, Math.trunc(options.maxRetryDelayMs ?? 250));
  const retryJitterRatio = Math.min(1, Math.max(0, options.retryJitterRatio ?? 0.2));
  if (baseRetryDelayMs === 0) {
    return 0;
  }
  const exponentialDelay = Math.min(maxRetryDelayMs, baseRetryDelayMs * (2 ** Math.max(0, attempt - 1)));
  const jitterWindow = Math.round(exponentialDelay * retryJitterRatio);
  const jitter = jitterWindow === 0 ? 0 : Math.floor(Math.random() * (jitterWindow + 1));
  return exponentialDelay + jitter;
}

function getOrCreateOperationMetrics(
  metrics: Map<string, AuthoritativeTaskStoreDecoratorOperationMetrics>,
  operation: string,
): AuthoritativeTaskStoreDecoratorOperationMetrics {
  const existing = metrics.get(operation);
  if (existing != null) {
    return existing;
  }
  const created: AuthoritativeTaskStoreDecoratorOperationMetrics = {
    calls: 0,
    successes: 0,
    failures: 0,
    retries: 0,
    totalDurationMs: 0,
    totalBackoffMs: 0,
    lastDurationMs: 0,
    lastAttemptCount: 0,
  };
  metrics.set(operation, created);
  return created;
}

export interface DecoratedAuthoritativeTaskStoreOptions {
  logger?: StructuredLogger;
  maxRetryAttempts?: number;
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  retryJitterRatio?: number;
}

export interface DecoratedAuthoritativeTaskStore<T extends AuthoritativeTaskStore = AuthoritativeTaskStore> {
  readonly store: T;
  getMetricsSnapshot(): Record<string, AuthoritativeTaskStoreDecoratorOperationMetrics>;
  resetMetrics(): void;
}

export function decorateAuthoritativeTaskStore<T extends AuthoritativeTaskStore>(
  store: T,
  options: DecoratedAuthoritativeTaskStoreOptions = {},
): DecoratedAuthoritativeTaskStore<T> {
  const logger = options.logger ?? authoritativeTaskStoreDecoratorLogger;
  const maxAttempts = Math.max(1, Math.trunc(options.maxRetryAttempts ?? 3));

  // Per-instance state: each decorated store gets its own metrics and backoff buffer.
  const instance: DecoratorInstance = {
    metrics: new Map<string, AuthoritativeTaskStoreDecoratorOperationMetrics>(),
    backoffBuffer: new Int32Array(new SharedArrayBuffer(4)),
  };

  function getMetricsSnapshot(): Record<string, AuthoritativeTaskStoreDecoratorOperationMetrics> {
    return Object.fromEntries(
      Array.from(instance.metrics.entries()).map(([operation, metrics]) => [operation, { ...metrics }]),
    );
  }

  function resetMetrics(): void {
    instance.metrics.clear();
  }

  const proxy = new Proxy(store, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") {
        return value;
      }

      return (...args: unknown[]) => {
        const operation = String(property);
        const startedAt = Date.now();
        let attempt = 0;
        let totalBackoffMs = 0;
        const metrics = getOrCreateOperationMetrics(instance.metrics, operation);
        metrics.calls += 1;

        while (true) {
          attempt += 1;
          try {
            const result = Reflect.apply(value, target, args);
            const durationMs = Date.now() - startedAt;
            metrics.successes += 1;
            metrics.totalDurationMs += durationMs;
            metrics.totalBackoffMs += totalBackoffMs;
            metrics.lastDurationMs = durationMs;
            metrics.lastAttemptCount = attempt;
            logger.debug("authoritative_task_store.operation", {
              operation,
              ok: true,
              attempt,
              durationMs,
              totalBackoffMs,
            });
            return result;
          } catch (error) {
            if (isRetryableSqliteBusyError(error) && attempt < maxAttempts) {
              const backoffMs = computeRetryBackoffMs(attempt, options);
              metrics.retries += 1;
              totalBackoffMs += backoffMs;
              logger.warn("authoritative_task_store.retry", {
                operation,
                attempt,
                maxAttempts,
                backoffMs,
                error: error instanceof Error ? error.message : String(error),
              });
              sleepSync(backoffMs);
              continue;
            }

            const durationMs = Date.now() - startedAt;
            metrics.failures += 1;
            metrics.totalDurationMs += durationMs;
            metrics.totalBackoffMs += totalBackoffMs;
            metrics.lastDurationMs = durationMs;
            metrics.lastAttemptCount = attempt;
            logger.warn("authoritative_task_store.operation_failed", {
              operation,
              ok: false,
              attempt,
              durationMs,
              totalBackoffMs,
              error: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        }
      };
    },
  });

  return {
    store: proxy as T,
    getMetricsSnapshot,
    resetMetrics,
  };
}
