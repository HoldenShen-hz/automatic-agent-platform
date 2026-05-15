export interface LimiterConfig {
  maxCalls: number;
  windowMs: number;
  keyGenerator?: ((context: LimiterContext) => string) | undefined;
}

export interface LimiterContext {
  provider?: string;
  model?: string;
  tenantId?: string;
  taskId?: string;
  endpoint?: string;
}

export type CircuitState = "closed" | "open" | "half_open";

export interface BreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxCalls?: number | undefined;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor?: number | undefined;
  retryableCodes?: string[] | undefined;
  nonRetryableCodes?: string[] | undefined;
  onRetry?: ((input: {
    attempt: number;
    error: { code: string; message: string; retryable: boolean; retryAfterMs?: number | undefined };
  }) => void | Promise<void>) | undefined;
}

export interface CallResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    retryAfterMs?: number | undefined;
  };
  metadata?: {
    attempts: number;
    latencyMs: number;
    circuitState?: CircuitState | undefined;
  };
}

export interface CallPolicy {
  limiter?: LimiterConfig | undefined;
  breaker?: BreakerConfig | undefined;
  retry?: RetryConfig | undefined;
}

export interface PolicyStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rejectedCalls: number;
  currentCircuitState: CircuitState;
  lastFailure?: string;
  lastFailureAt?: string;
}

export interface DistributedRateLimiterLike {
  checkAndConsume(key: string): Promise<{ allowed: boolean; retryAfterMs?: number | undefined }>;
  reset?(key: string): Promise<void> | void;
}

export interface CallGovernanceOptions {
  distributedRateLimiter?: DistributedRateLimiterLike | null;
}

export interface LimiterEntry {
  count: number;
  windowStart: number;
}

export interface BreakerEntry {
  failures: number;
  successes: number;
  state: CircuitState;
  lastFailure: number;
  halfOpenCalls: number;
}

export interface CircuitBreakerSnapshot {
  failures: number;
  state: CircuitState;
  lastFailure: number;
}
