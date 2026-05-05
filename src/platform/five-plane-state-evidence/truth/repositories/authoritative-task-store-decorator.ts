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

interface DecoratorInstance {
  readonly metrics: Map<string, AuthoritativeTaskStoreDecoratorOperationMetrics>;
}

function isRetryableSqliteBusyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof error === "object" && error != null && "code" in error ? String(error.code) : "";
  return message.includes("SQLITE_BUSY") || code.includes("SQLITE_BUSY");
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

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return typeof value === "object" && value !== null && "then" in value && typeof value.then === "function";
}

function recordSuccess(
  logger: StructuredLogger,
  operation: string,
  metrics: AuthoritativeTaskStoreDecoratorOperationMetrics,
  startedAt: number,
  attempt: number,
  totalBackoffMs: number,
): void {
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
}

function recordFailure(
  logger: StructuredLogger,
  operation: string,
  metrics: AuthoritativeTaskStoreDecoratorOperationMetrics,
  startedAt: number,
  attempt: number,
  totalBackoffMs: number,
  error: unknown,
): never {
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

function delay(backoffMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, backoffMs));
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

const LEGACY_STORE_NAMESPACE_ALIASES = new Set([
  "task",
  "workflow",
  "session",
  "event",
  "execution",
  "dispatch",
  "worker",
  "approval",
  "artifact",
  "artifacts",
  "billing",
  "memory",
  "organization",
  "operations",
  "lock",
  "lease",
  "intelligence",
  "marketplace",
  "release",
  "secret",
  "evolution",
  "compliance",
  "sessionCandidates",
]);

export function decorateAuthoritativeTaskStore<T extends AuthoritativeTaskStore>(
  store: T,
  options: DecoratedAuthoritativeTaskStoreOptions = {},
): DecoratedAuthoritativeTaskStore<T> {
  const logger = options.logger ?? authoritativeTaskStoreDecoratorLogger;
  const maxAttempts = Math.max(1, Math.trunc(options.maxRetryAttempts ?? 3));

  const instance: DecoratorInstance = {
    metrics: new Map<string, AuthoritativeTaskStoreDecoratorOperationMetrics>(),
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
        const metrics = getOrCreateOperationMetrics(instance.metrics, operation);
        metrics.calls += 1;
        let attempt = 0;
        let totalBackoffMs = 0;

        const invoke = (): unknown => Reflect.apply(value, target, args);

        const invokeAsync = async (pendingResult: PromiseLike<unknown>): Promise<unknown> => {
          let pending = pendingResult;
          while (true) {
            try {
              const resolved = await pending;
              recordSuccess(logger, operation, metrics, startedAt, attempt, totalBackoffMs);
              return resolved;
            } catch (error) {
              if (isRetryableSqliteBusyError(error) && attempt < maxAttempts) {
                attempt += 1;
                const backoffMs = computeRetryBackoffMs(attempt - 1, options);
                metrics.retries += 1;
                totalBackoffMs += backoffMs;
                logger.warn("authoritative_task_store.retry", {
                  operation,
                  attempt: attempt - 1,
                  maxAttempts,
                  backoffMs,
                  error: error instanceof Error ? error.message : String(error),
                });
                await delay(backoffMs);
                try {
                  const nextResult = invoke();
                  if (isPromiseLike(nextResult)) {
                    pending = nextResult;
                    continue;
                  }
                  recordSuccess(logger, operation, metrics, startedAt, attempt, totalBackoffMs);
                  return nextResult;
                } catch (retryError) {
                  pending = Promise.reject(retryError);
                  continue;
                }
              }
              return recordFailure(logger, operation, metrics, startedAt, attempt, totalBackoffMs, error);
            }
          }
        };

        while (true) {
          attempt += 1;
          try {
            const result = invoke();
            if (isPromiseLike(result)) {
              return invokeAsync(result);
            }
            recordSuccess(logger, operation, metrics, startedAt, attempt, totalBackoffMs);
            return result;
          } catch (error) {
            if (isRetryableSqliteBusyError(error) && attempt < maxAttempts) {
              metrics.retries += 1;
              logger.warn("authoritative_task_store.retry", {
                operation,
                attempt,
                maxAttempts,
                backoffMs: 0,
                backoffApplied: false,
                error: error instanceof Error ? error.message : String(error),
              });
              continue;
            }
            return recordFailure(logger, operation, metrics, startedAt, attempt, totalBackoffMs, error);
          }
        }
      };
    },
  });

  return new Proxy(
    {
      store: proxy as T,
      getMetricsSnapshot,
      resetMetrics,
    } as DecoratedAuthoritativeTaskStore<T>,
    {
      get(target, property, receiver) {
        if (Reflect.has(target, property)) {
          return Reflect.get(target, property, receiver);
        }
        const delegated = Reflect.get(proxy as object, property, proxy);
        if (delegated !== undefined) {
          return delegated;
        }
        if (typeof property === "string" && LEGACY_STORE_NAMESPACE_ALIASES.has(property)) {
          return proxy;
        }
        return delegated;
      },
    },
  );
}
