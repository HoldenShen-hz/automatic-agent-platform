/**
 * Stability Module Facade
 *
 * R7-52 FIX: This module provides a unified export point for stability features.
 * The authoritative implementation lives at platform/stability/ which contains:
 * - circuit-breaker.ts: Circuit breaker pattern implementation
 * - retry.ts: Retry with exponential backoff
 * - timeout.ts: Timeout wrapper utilities
 * - bulkhead-isolation.ts: Bulkhead isolation for fault isolation
 *
 * This facade re-exports from the authoritative module to maintain API stability
 * for consumers that reference platform/shared/stability/.
 *
 * NOTE: Direct imports from platform/stability/ are preferred over this facade
 * as this module may be deprecated in future versions.
 */

// Re-export all stability features from the authoritative location
export {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerOpenError,
  CircuitBreakerResetError,
  type CircuitBreakerOptions,
  type CircuitBreakerStats,
} from "../../stability/circuit-breaker.js";

export {
  Retry,
  RetryResult,
  RetryAbortError,
  RetryTimeoutError,
  type RetryOptions,
  type RetryExecutionOptions,
  type RetryAttempt,
  type RetryStats,
} from "../../stability/retry.js";

export {
  Timeout,
  TimeoutState,
  TimeoutError,
  withTimeout,
  withDeadline,
  type TimeoutOptions,
  type TimeoutStats,
} from "../../stability/timeout.js";

export {
  BulkheadIsolator,
  BulkheadRegistry,
  BulkheadRejectionError,
  BulkheadTimeoutError,
  globalBulkheadRegistry,
  DEFAULT_BULKHEAD_CONFIG,
  type BulkheadConfig,
  type BulkheadMetrics,
} from "../../stability/bulkhead-isolation.js";

export * from "./release-gate.js";
export * from "./leadership-claim-config-registry.js";
export * from "./leadership-claims-governance-service.js";
export * from "./patch-gate.js";
export * from "./p0-pilot-evidence-runner.js";
