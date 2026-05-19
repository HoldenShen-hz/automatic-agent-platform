import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
import type { AuthoritativeTaskStore } from "../authoritative-task-store.js";

const authoritativeTaskStoreDecoratorLogger = new StructuredLogger({ retentionLimit: 100 });
const decoratorMetricsRegistry = new Set<Map<string, AuthoritativeTaskStoreDecoratorOperationMetrics>>();

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

// R14-22: decoratorMetrics is now per-decorator-instance, not a global singleton
function createOperationMetrics(): AuthoritativeTaskStoreDecoratorOperationMetrics {
  return {
    calls: 0,
    successes: 0,
    failures: 0,
    retries: 0,
    totalDurationMs: 0,
    totalBackoffMs: 0,
    lastDurationMs: 0,
    lastAttemptCount: 0,
  };
}

function getOrCreateOperationMetrics(
  metrics: Map<string, AuthoritativeTaskStoreDecoratorOperationMetrics>,
  operation: string,
): AuthoritativeTaskStoreDecoratorOperationMetrics {
  const existing = metrics.get(operation);
  if (existing != null) {
    return existing;
  }
  const created = createOperationMetrics();
  metrics.set(operation, created);
  return created;
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

export function getAuthoritativeTaskStoreDecoratorMetricsSnapshot():
Record<string, AuthoritativeTaskStoreDecoratorOperationMetrics> {
  const aggregated = new Map<string, AuthoritativeTaskStoreDecoratorOperationMetrics>();
  for (const metricsMap of decoratorMetricsRegistry) {
    for (const [operation, metrics] of metricsMap.entries()) {
      const target = getOrCreateOperationMetrics(aggregated, operation);
      target.calls += metrics.calls;
      target.successes += metrics.successes;
      target.failures += metrics.failures;
      target.retries += metrics.retries;
      target.totalDurationMs += metrics.totalDurationMs;
      target.totalBackoffMs += metrics.totalBackoffMs;
      target.lastDurationMs = metrics.lastDurationMs;
      target.lastAttemptCount = metrics.lastAttemptCount;
    }
  }
  return Object.fromEntries(
    [...aggregated.entries()].map(([operation, metrics]) => [operation, { ...metrics }]),
  );
}

export function resetAuthoritativeTaskStoreDecoratorMetrics(): void {
  decoratorMetricsRegistry.clear();
}

export interface DecoratedAuthoritativeTaskStoreOptions {
  logger?: StructuredLogger;
  maxRetryAttempts?: number;
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  retryJitterRatio?: number;
}

export function decorateAuthoritativeTaskStore<T extends AuthoritativeTaskStore>(
  store: T,
  options: DecoratedAuthoritativeTaskStoreOptions = {},
): T {
  const logger = options.logger ?? authoritativeTaskStoreDecoratorLogger;
  const maxAttempts = Math.max(1, Math.trunc(options.maxRetryAttempts ?? 3));
  const instanceMetrics = new Map<string, AuthoritativeTaskStoreDecoratorOperationMetrics>();
  decoratorMetricsRegistry.add(instanceMetrics);

  return new Proxy(store, {
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
        const metrics = getOrCreateOperationMetrics(instanceMetrics, operation);
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
}
