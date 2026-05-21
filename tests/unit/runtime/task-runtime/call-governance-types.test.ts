import test from "node:test";
import assert from "node:assert/strict";
import type {
  LimiterConfig,
  LimiterContext,
  CircuitState,
  BreakerConfig,
  RetryConfig,
  CallResult,
  CallPolicy,
  PolicyStats,
  DistributedRateLimiterLike,
  CallGovernanceOptions,
  LimiterEntry,
  BreakerEntry,
  CircuitBreakerSnapshot,
} from "../../../../src/platform/five-plane-execution/execution-engine/call-governance-types.js";

test("LimiterConfig structure", () => {
  const config: LimiterConfig = {
    maxCalls: 100,
    windowMs: 1000,
    keyGenerator: (ctx) => ctx.taskId ?? "default",
  };

  assert.equal(config.maxCalls, 100);
  assert.equal(config.windowMs, 1000);
  assert.equal(typeof config.keyGenerator, "function");
});

test("LimiterConfig without optional keyGenerator", () => {
  const config: LimiterConfig = {
    maxCalls: 50,
    windowMs: 500,
  };

  assert.equal(config.maxCalls, 50);
  assert.equal(config.windowMs, 500);
  assert.equal(config.keyGenerator, undefined);
});

test("LimiterContext structure", () => {
  const ctx: LimiterContext = {
    provider: "anthropic",
    model: "claude-sonnet-4",
    tenantId: "tenant_123",
    taskId: "task_456",
    endpoint: "/v1/messages",
  };

  assert.equal(ctx.provider, "anthropic");
  assert.equal(ctx.model, "claude-sonnet-4");
  assert.equal(ctx.tenantId, "tenant_123");
  assert.equal(ctx.taskId, "task_456");
  assert.equal(ctx.endpoint, "/v1/messages");
});

test("LimiterContext with only required fields", () => {
  const ctx: LimiterContext = {};
  assert.equal(ctx.provider, undefined);
  assert.equal(ctx.model, undefined);
});

test("CircuitState type accepts all valid states", () => {
  const closed: CircuitState = "closed";
  const open: CircuitState = "open";
  const half_open: CircuitState = "half_open";

  assert.equal(closed, "closed");
  assert.equal(open, "open");
  assert.equal(half_open, "half_open");
});

test("BreakerConfig structure", () => {
  const config: BreakerConfig = {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 30000,
    halfOpenMaxCalls: 3,
  };

  assert.equal(config.failureThreshold, 5);
  assert.equal(config.successThreshold, 2);
  assert.equal(config.resetTimeoutMs, 30000);
  assert.equal(config.halfOpenMaxCalls, 3);
});

test("BreakerConfig without optional halfOpenMaxCalls", () => {
  const config: BreakerConfig = {
    failureThreshold: 10,
    successThreshold: 3,
    resetTimeoutMs: 60000,
  };

  assert.equal(config.halfOpenMaxCalls, undefined);
});

test("RetryConfig structure with all fields", () => {
  const config: RetryConfig = {
    maxAttempts: 5,
    baseDelayMs: 100,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    retryableCodes: ["rate_limit", "timeout"],
    nonRetryableCodes: ["auth_failed"],
    onRetry: async (input) => {
      console.log(`Retrying attempt ${input.attempt}`);
    },
  };

  assert.equal(config.maxAttempts, 5);
  assert.equal(config.baseDelayMs, 100);
  assert.equal(config.maxDelayMs, 5000);
  assert.equal(config.backoffMultiplier, 2);
  assert.equal(config.jitterFactor, 0.1);
  assert.deepEqual(config.retryableCodes, ["rate_limit", "timeout"]);
  assert.deepEqual(config.nonRetryableCodes, ["auth_failed"]);
  assert.equal(typeof config.onRetry, "function");
});

test("RetryConfig with minimal fields", () => {
  const config: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 200,
    maxDelayMs: 1000,
    backoffMultiplier: 1.5,
  };

  assert.equal(config.maxAttempts, 3);
  assert.equal(config.jitterFactor, undefined);
  assert.equal(config.retryableCodes, undefined);
});

test("CallResult success structure", () => {
  const result: CallResult<string> = {
    success: true,
    data: "response_data",
    metadata: {
      attempts: 1,
      latencyMs: 150,
      circuitState: "closed",
    },
  };

  assert.equal(result.success, true);
  assert.equal(result.data, "response_data");
  assert.equal(result.metadata?.attempts, 1);
  assert.equal(result.metadata?.circuitState, "closed");
});

test("CallResult error structure", () => {
  const result: CallResult<null> = {
    success: false,
    error: {
      code: "ERR_RATE_LIMITED",
      message: "Rate limit exceeded",
      retryable: true,
      retryAfterMs: 5000,
    },
    metadata: {
      attempts: 3,
      latencyMs: 300,
      circuitState: "open",
    },
  };

  assert.equal(result.success, false);
  assert.equal(result.error?.code, "ERR_RATE_LIMITED");
  assert.equal(result.error?.retryable, true);
  assert.equal(result.error?.retryAfterMs, 5000);
});

test("CallPolicy structure", () => {
  const policy: CallPolicy = {
    limiter: { maxCalls: 100, windowMs: 1000 },
    breaker: { failureThreshold: 5, successThreshold: 2, resetTimeoutMs: 30000 },
    retry: { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000, backoffMultiplier: 2 },
  };

  assert.ok(policy.limiter != null);
  assert.ok(policy.breaker != null);
  assert.ok(policy.retry != null);
});

test("PolicyStats structure", () => {
  const stats: PolicyStats = {
    totalCalls: 1000,
    successfulCalls: 950,
    failedCalls: 40,
    rejectedCalls: 10,
    currentCircuitState: "closed",
    lastFailure: "ERR_TIMEOUT",
    lastFailureAt: "2024-01-01T12:00:00.000Z",
  };

  assert.equal(stats.totalCalls, 1000);
  assert.equal(stats.successfulCalls, 950);
  assert.equal(stats.failedCalls, 40);
  assert.equal(stats.rejectedCalls, 10);
  assert.equal(stats.currentCircuitState, "closed");
  assert.equal(stats.lastFailure, "ERR_TIMEOUT");
});

test("DistributedRateLimiterLike interface", () => {
  const limiter: DistributedRateLimiterLike = {
    checkAndConsume: async (key: string) => {
      return { allowed: true };
    },
    reset: async (key: string) => {
      // reset implementation
    },
  };

  assert.equal(typeof limiter.checkAndConsume, "function");
  assert.equal(typeof limiter.reset, "function");
});

test("DistributedRateLimiterLike without optional reset", () => {
  const limiter: DistributedRateLimiterLike = {
    checkAndConsume: async (key: string) => {
      return { allowed: false, retryAfterMs: 1000 };
    },
  };

  assert.equal(typeof limiter.checkAndConsume, "function");
  assert.equal(limiter.reset, undefined);
});

test("CallGovernanceOptions structure", () => {
  const options: CallGovernanceOptions = {
    distributedRateLimiter: null,
  };

  assert.equal(options.distributedRateLimiter, null);
});

test("LimiterEntry structure", () => {
  const entry: LimiterEntry = {
    count: 50,
    windowStart: Date.now(),
  };

  assert.equal(entry.count, 50);
  assert.ok(entry.windowStart > 0);
});

test("BreakerEntry structure", () => {
  const entry: BreakerEntry = {
    failures: 3,
    successes: 10,
    state: "half_open",
    lastFailure: Date.now(),
    halfOpenCalls: 2,
  };

  assert.equal(entry.failures, 3);
  assert.equal(entry.successes, 10);
  assert.equal(entry.state, "half_open");
  assert.equal(entry.halfOpenCalls, 2);
});

test("CircuitBreakerSnapshot structure", () => {
  const snapshot: CircuitBreakerSnapshot = {
    failures: 5,
    state: "open",
    lastFailure: Date.now(),
  };

  assert.equal(snapshot.failures, 5);
  assert.equal(snapshot.state, "open");
});