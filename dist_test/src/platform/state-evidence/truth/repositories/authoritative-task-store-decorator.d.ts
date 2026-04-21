import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
import type { AuthoritativeTaskStore } from "../authoritative-task-store.js";
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
export declare function getAuthoritativeTaskStoreDecoratorMetricsSnapshot(): Record<string, AuthoritativeTaskStoreDecoratorOperationMetrics>;
export declare function resetAuthoritativeTaskStoreDecoratorMetrics(): void;
export interface DecoratedAuthoritativeTaskStoreOptions {
    logger?: StructuredLogger;
    maxRetryAttempts?: number;
    baseRetryDelayMs?: number;
    maxRetryDelayMs?: number;
    retryJitterRatio?: number;
}
export declare function decorateAuthoritativeTaskStore<T extends AuthoritativeTaskStore>(store: T, options?: DecoratedAuthoritativeTaskStoreOptions): T;
