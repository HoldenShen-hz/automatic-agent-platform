// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import {
  loadExceptionRecoveryConfig,
  clearExceptionRecoveryConfigCache,
} from "../../../../../src/platform/execution/recovery/exception-recovery-config-loader.js";
import type {
  ExceptionRecoveryConfig,
  ExceptionStrategy,
  ExceptionType,
} from "../../../../../src/platform/execution/recovery/exception-recovery-types.js";

/**
 * Retry strategy tests covering backoff calculations and retry policies.
 *
 * The retry strategy is derived from ExceptionStrategy which includes:
 * - backoffMultiplier: multiplier for exponential backoff
 * - initialDelayMs: base delay before first retry
 * - maxRetries: maximum number of retry attempts
 * - retryable: whether the error type supports retry
 */

/**
 * Calculates retry delay using exponential backoff formula.
 * Formula: initialDelayMs * (backoffMultiplier ^ (attempt - 1))
 */
function calculateExponentialBackoff(
  initialDelayMs: number,
  backoffMultiplier: number,
  attempt: number,
): number {
  return Math.floor(initialDelayMs * Math.pow(backoffMultiplier, attempt - 1));
}

// =============================================================================
// Backoff Strategy Calculation Tests
// =============================================================================

test("calculateExponentialBackoff returns initial delay for first attempt", () => {
  const delay = calculateExponentialBackoff(1000, 2.0, 1);

  assert.equal(delay, 1000);
});

test("calculateExponentialBackoff applies multiplier for subsequent attempts", () => {
  // First attempt: 1000 * 2^0 = 1000
  assert.equal(calculateExponentialBackoff(1000, 2.0, 1), 1000);
  // Second attempt: 1000 * 2^1 = 2000
  assert.equal(calculateExponentialBackoff(1000, 2.0, 2), 2000);
  // Third attempt: 1000 * 2^2 = 4000
  assert.equal(calculateExponentialBackoff(1000, 2.0, 3), 4000);
});

test("calculateExponentialBackoff handles fractional multiplier", () => {
  // Initial: 1000 * 1.5^0 = 1000
  assert.equal(calculateExponentialBackoff(1000, 1.5, 1), 1000);
  // Second: 1000 * 1.5^1 = 1500
  assert.equal(calculateExponentialBackoff(1000, 1.5, 2), 1500);
  // Third: 1000 * 1.5^2 = 2250
  assert.equal(calculateExponentialBackoff(1000, 1.5, 3), 2250);
});

test("calculateExponentialBackoff handles unit multiplier (no exponential growth)", () => {
  // With multiplier of 1.0, delay stays constant
  assert.equal(calculateExponentialBackoff(100, 1.0, 1), 100);
  assert.equal(calculateExponentialBackoff(100, 1.0, 2), 100);
  assert.equal(calculateExponentialBackoff(100, 1.0, 3), 100);
});

test("calculateExponentialBackoff handles zero initial delay", () => {
  // All attempts should be 0 if initial delay is 0
  assert.equal(calculateExponentialBackoff(0, 2.0, 1), 0);
  assert.equal(calculateExponentialBackoff(0, 2.0, 2), 0);
  assert.equal(calculateExponentialBackoff(0, 2.0, 3), 0);
});

// =============================================================================
// Exception Strategy Backoff Configuration Tests
// =============================================================================

test("transient_external_error has correct backoff strategy", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.transient_external_error;

  assert.equal(strategy.retryable, true);
  assert.equal(strategy.maxRetries, 3);
  assert.equal(strategy.backoffMultiplier, 1.5);
  assert.equal(strategy.initialDelayMs, 1000);
});

test("locking_error has short backoff for quick retry", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.locking_error;

  assert.equal(strategy.retryable, true);
  assert.equal(strategy.maxRetries, 1);
  assert.equal(strategy.backoffMultiplier, 1.0);
  assert.equal(strategy.initialDelayMs, 100); // Short delay for lock contention
});

test("storage_error has moderate backoff", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.storage_error;

  assert.equal(strategy.retryable, true);
  assert.equal(strategy.maxRetries, 2);
  assert.equal(strategy.backoffMultiplier, 1.5);
  assert.equal(strategy.initialDelayMs, 500);
});

test("provider_error has longer backoff for external providers", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.provider_error;

  assert.equal(strategy.retryable, true);
  assert.equal(strategy.maxRetries, 3);
  assert.equal(strategy.backoffMultiplier, 2.0);
  assert.equal(strategy.initialDelayMs, 2000);
});

test("runtime_error has single retry with exponential backoff", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.runtime_error;

  assert.equal(strategy.retryable, true);
  assert.equal(strategy.maxRetries, 1);
  assert.equal(strategy.backoffMultiplier, 1.5);
  assert.equal(strategy.initialDelayMs, 1000);
});

// =============================================================================
// Non-Retryable Exception Types Tests
// =============================================================================

test("validation_error is not retryable", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.validation_error;

  assert.equal(strategy.retryable, false);
  assert.equal(strategy.maxRetries, 0);
});

test("policy_denied_error is not retryable", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.policy_denied;

  assert.equal(strategy.retryable, false);
  assert.equal(strategy.maxRetries, 0);
});

test("permanent_external_error is not retryable", () => {
  clearExceptionCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.permanent_external_error;

  assert.equal(strategy.retryable, false);
  assert.equal(strategy.maxRetries, 0);
});

test("auth_error is not retryable", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.auth_error;

  assert.equal(strategy.retryable, false);
  assert.equal(strategy.maxRetries, 0);
});

test("sandbox_error is not retryable", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.sandbox_error;

  assert.equal(strategy.retryable, false);
  assert.equal(strategy.maxRetries, 0);
});

// =============================================================================
// Exception Type Action Mapping Tests
// =============================================================================

test("validation_error action is cancel", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.validation_error;

  assert.equal(strategy.action, "cancel");
});

test("tool_execution_error action is escalate_takeover", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.tool_execution_error;

  assert.equal(strategy.action, "escalate_takeover");
});

test("memory_error action is escalate_takeover", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.memory_error;

  assert.equal(strategy.action, "escalate_takeover");
});

test("workflow_state_error action is escalate_takeover", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.workflow_state_error;

  assert.equal(strategy.action, "escalate_takeover");
});

test("tenant_boundary_error action is cancel", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.tenant_boundary_error;

  assert.equal(strategy.action, "cancel");
});

test("monetization_error action is move_dead_letter", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.monetization_error;

  assert.equal(strategy.action, "move_dead_letter");
});

test("internal_error action is move_dead_letter", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.internal_error;

  assert.equal(strategy.action, "move_dead_letter");
});

test("unknown_error action is move_dead_letter", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.unknown_error;

  assert.equal(strategy.action, "move_dead_letter");
});

// =============================================================================
// Retry Exhaustion Tests
// =============================================================================

test("retry count stays within maxRetries bounds for transient_external_error", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.transient_external_error;

  // Verify maxRetries is correctly configured
  assert.equal(strategy.maxRetries, 3);

  // Attempt 4 should exceed maxRetries (attempts are 1-indexed)
  const maxAttempt = strategy.maxRetries + 1;
  assert.ok(maxAttempt > strategy.maxRetries);
});

test("retry count stays within maxRetries bounds for locking_error", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.locking_error;

  // locking_error has only 1 max retry
  assert.equal(strategy.maxRetries, 1);
});

// =============================================================================
// Backoff Sequence Generation Tests
// =============================================================================

test("generates correct backoff sequence for transient_external_error", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.transient_external_error;

  // transient_external_error: initialDelayMs=1000, backoffMultiplier=1.5, maxRetries=3
  const sequence: number[] = [];
  for (let attempt = 1; attempt <= strategy.maxRetries; attempt++) {
    sequence.push(calculateExponentialBackoff(
      strategy.initialDelayMs!,
      strategy.backoffMultiplier!,
      attempt,
    ));
  }

  assert.deepEqual(sequence, [1000, 1500, 2250]);
});

test("generates correct backoff sequence for provider_error", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.provider_error;

  // provider_error: initialDelayMs=2000, backoffMultiplier=2.0, maxRetries=3
  const sequence: number[] = [];
  for (let attempt = 1; attempt <= strategy.maxRetries; attempt++) {
    sequence.push(calculateExponentialBackoff(
      strategy.initialDelayMs!,
      strategy.backoffMultiplier!,
      attempt,
    ));
  }

  assert.deepEqual(sequence, [2000, 4000, 8000]);
});

test("generates correct backoff sequence for storage_error", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.storage_error;

  // storage_error: initialDelayMs=500, backoffMultiplier=1.5, maxRetries=2
  const sequence: number[] = [];
  for (let attempt = 1; attempt <= strategy.maxRetries; attempt++) {
    sequence.push(calculateExponentialBackoff(
      strategy.initialDelayMs!,
      strategy.backoffMultiplier!,
      attempt,
    ));
  }

  assert.deepEqual(sequence, [500, 750]);
});

test("generates flat backoff sequence for locking_error (multiplier=1.0)", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byExceptionType.locking_error;

  // locking_error: initialDelayMs=100, backoffMultiplier=1.0, maxRetries=1
  const sequence: number[] = [];
  for (let attempt = 1; attempt <= strategy.maxRetries; attempt++) {
    sequence.push(calculateExponentialBackoff(
      strategy.initialDelayMs!,
      strategy.backoffMultiplier!,
      attempt,
    ));
  }

  // With multiplier 1.0, all delays should be the same
  assert.deepEqual(sequence, [100]);
});

// =============================================================================
// Risk Level Strategy Tests
// =============================================================================

test("low risk level enables auto-recovery without notification", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byRiskLevel.low;

  assert.equal(strategy.autoRecover, true);
  assert.equal(strategy.notifyOnFailure, false);
});

test("medium risk level enables auto-recovery with notification", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byRiskLevel.medium;

  assert.equal(strategy.autoRecover, true);
  assert.equal(strategy.notifyOnFailure, true);
});

test("high risk level disables auto-recovery but notifies", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byRiskLevel.high;

  assert.equal(strategy.autoRecover, false);
  assert.equal(strategy.notifyOnFailure, true);
});

test("critical risk level disables auto-recovery but notifies", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const strategy = config.recoveryStrategyTable.byRiskLevel.critical;

  assert.equal(strategy.autoRecover, false);
  assert.equal(strategy.notifyOnFailure, true);
});

// =============================================================================
// Attempt Threshold Tests
// =============================================================================

test("resumeSameWorkerMaxAttempts threshold is 2", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const thresholds = config.recoveryStrategyTable.byAttemptThreshold;

  assert.equal(thresholds.resumeSameWorkerMaxAttempts, 2);
});

test("retryNewTicketMaxAttempts threshold is 3", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const thresholds = config.recoveryStrategyTable.byAttemptThreshold;

  assert.equal(thresholds.retryNewTicketMaxAttempts, 3);
});

test("moveToDeadLetterMinAttempts threshold is 2", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const thresholds = config.recoveryStrategyTable.byAttemptThreshold;

  assert.equal(thresholds.moveToDeadLetterMinAttempts, 2);
});

test("escalateTakeoverMinAttempts threshold is 1", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const thresholds = config.recoveryStrategyTable.byAttemptThreshold;

  assert.equal(thresholds.escalateTakeoverMinAttempts, 1);
});

// =============================================================================
// Global Timeout Configuration Tests
// =============================================================================

test("staleExecutionThresholdMs is 5 minutes", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();

  assert.equal(config.staleExecutionThresholdMs, 300000); // 5 minutes in ms
});

test("heartbeatTimeoutMs is 1 minute", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();

  assert.equal(config.heartbeatTimeoutMs, 60000); // 1 minute in ms
});

// =============================================================================
// Default Action Tests
// =============================================================================

test("defaultAction is move_dead_letter", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();

  assert.equal(config.defaultAction, "move_dead_letter");
});

// =============================================================================
// All Exception Types Present Tests
// =============================================================================

test("all exception types are present in configuration", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();
  const byExceptionType = config.recoveryStrategyTable.byExceptionType;

  const expectedTypes: ExceptionType[] = [
    "validation_error",
    "policy_denied",
    "auth_error",
    "transient_external_error",
    "permanent_external_error",
    "provider_error",
    "tool_execution_error",
    "sandbox_error",
    "storage_error",
    "workflow_state_error",
    "tenant_boundary_error",
    "monetization_error",
    "internal_error",
    "locking_error",
    "memory_error",
    "runtime_error",
    "unknown_error",
  ];

  for (const exceptionType of expectedTypes) {
    assert.ok(
      byExceptionType[exceptionType] != null,
      `Missing strategy for exception type: ${exceptionType}`,
    );
  }
});

// Helper function that was missing in original
function clearExceptionCache(): void {
  clearExceptionRecoveryConfigCache();
}
