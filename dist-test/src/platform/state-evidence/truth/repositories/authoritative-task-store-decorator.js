import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
const authoritativeTaskStoreDecoratorLogger = new StructuredLogger({ retentionLimit: 100 });
const synchronousBackoffBuffer = new Int32Array(new SharedArrayBuffer(4));
const decoratorMetrics = new Map();
function isRetryableSqliteBusyError(error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = typeof error === "object" && error != null && "code" in error ? String(error.code) : "";
    return message.includes("SQLITE_BUSY") || code.includes("SQLITE_BUSY");
}
function sleepSync(ms) {
    if (ms <= 0) {
        return;
    }
    Atomics.wait(synchronousBackoffBuffer, 0, 0, ms);
}
function computeRetryBackoffMs(attempt, options) {
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
function getOrCreateOperationMetrics(operation) {
    const existing = decoratorMetrics.get(operation);
    if (existing != null) {
        return existing;
    }
    const created = {
        calls: 0,
        successes: 0,
        failures: 0,
        retries: 0,
        totalDurationMs: 0,
        totalBackoffMs: 0,
        lastDurationMs: 0,
        lastAttemptCount: 0,
    };
    decoratorMetrics.set(operation, created);
    return created;
}
export function getAuthoritativeTaskStoreDecoratorMetricsSnapshot() {
    return Object.fromEntries(Array.from(decoratorMetrics.entries()).map(([operation, metrics]) => [operation, { ...metrics }]));
}
export function resetAuthoritativeTaskStoreDecoratorMetrics() {
    decoratorMetrics.clear();
}
export function decorateAuthoritativeTaskStore(store, options = {}) {
    const logger = options.logger ?? authoritativeTaskStoreDecoratorLogger;
    const maxAttempts = Math.max(1, Math.trunc(options.maxRetryAttempts ?? 3));
    return new Proxy(store, {
        get(target, property, receiver) {
            const value = Reflect.get(target, property, receiver);
            if (typeof value !== "function") {
                return value;
            }
            return (...args) => {
                const operation = String(property);
                const startedAt = Date.now();
                let attempt = 0;
                let totalBackoffMs = 0;
                const metrics = getOrCreateOperationMetrics(operation);
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
                    }
                    catch (error) {
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
}
//# sourceMappingURL=authoritative-task-store-decorator.js.map