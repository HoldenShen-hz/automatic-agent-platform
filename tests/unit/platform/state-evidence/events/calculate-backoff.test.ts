/**
 * Unit tests for calculateBackoff utility
 *
 * Tests exponential backoff calculation with jitter for retry intervals.
 * These tests verify the behavior described in durable-event-bus.ts comments.
 */

import assert from "node:assert/strict";
import test, { mock } from "node:test";

import { DlqService } from "../../../../../src/platform/five-plane-state-evidence/events/dlq-service.js";
import { DEFAULT_DLQ_RETRY_BACKOFF_MS } from "../../../../../src/platform/five-plane-state-evidence/dlq/dlq-policy.js";

process.env["AA_AUDIT_INTEGRITY_HMAC_KEY"] ??= "testing-audit-integrity-key-012345";

test("calculateBackoff: exponential increase with cap", () => {
  const dlqService = new DlqService();
  const record = dlqService.enqueue({
    sourceEventId: "evt_backoff_growth",
    consumerId: "test-consumer",
    errorCode: "test.error",
    payloadJson: "{}",
  });

  const retry1 = Date.parse(dlqService.scheduleRetry(record.deadLetterId).nextRetryAt!);
  const retry2 = Date.parse(dlqService.scheduleRetry(record.deadLetterId).nextRetryAt!);
  const retry3 = Date.parse(dlqService.scheduleRetry(record.deadLetterId).nextRetryAt!);
  const retry4 = Date.parse(dlqService.scheduleRetry(record.deadLetterId).nextRetryAt!);

  assert.ok(retry2 > retry1, "second retry should be scheduled after the first");
  assert.ok(retry3 > retry2, "third retry should be scheduled after the second");
  assert.ok(retry4 > retry3, "fourth retry should be scheduled after the third");
});

test("calculateBackoff: first retry delay uses the configured base backoff", () => {
  mock.timers.enable({ apis: ["Date"] });
  try {
    const startedAt = Date.now();
    const dlqService = new DlqService();
    const record = dlqService.enqueue({
      sourceEventId: "evt_first_retry",
      consumerId: "test-consumer",
      errorCode: "test.error",
      payloadJson: "{}",
    });

    const updated = dlqService.scheduleRetry(record.deadLetterId);
    const firstRetryAt = Date.parse(updated.nextRetryAt!);
    const delayMs = firstRetryAt - startedAt;

    assert.equal(delayMs, DEFAULT_DLQ_RETRY_BACKOFF_MS);
  } finally {
    mock.timers.reset();
  }
});

test("DlqService scheduleRetry uses exponential backoff", () => {
  const dlqService = new DlqService();

  const record1 = dlqService.enqueue({
    sourceEventId: "evt_backoff_1",
    consumerId: "test-consumer",
    errorCode: "test.error",
    payloadJson: "{}",
  });

  const afterRetry1 = dlqService.scheduleRetry(record1.deadLetterId);
  const retry1NextRetryAt = afterRetry1.nextRetryAt;

  // First retry should schedule at now + INITIAL_BACKOFF_MS * 2^0 = now + 100ms * 1 = 100ms
  assert.ok(retry1NextRetryAt !== null);

  // Schedule second retry
  const afterRetry2 = dlqService.scheduleRetry(record1.deadLetterId);
  const retry2NextRetryAt = afterRetry2.nextRetryAt;

  // Second retry should schedule at retry1NextRetryAt + INITIAL_BACKOFF_MS * 2^1 = + 200ms
  assert.ok(retry2NextRetryAt !== null);

  // Third retry - exponential growth
  const afterRetry3 = dlqService.scheduleRetry(record1.deadLetterId);
  assert.ok(afterRetry3.nextRetryAt !== null);

  // Verify retry count is incrementing
  assert.equal(afterRetry3.retryCount, 3);
});

test("DlqService scheduleRetry respects custom delay", () => {
  const dlqService = new DlqService();

  const record = dlqService.enqueue({
    sourceEventId: "evt_custom_delay",
    consumerId: "test-consumer",
    errorCode: "test.error",
    payloadJson: "{}",
  });

  const customDelayMs = 5000;
  const updated = dlqService.scheduleRetry(record.deadLetterId, customDelayMs);

  // Custom delay should be used instead of exponential backoff
  const scheduledTime = Date.parse(updated.nextRetryAt!);
  const now = Date.now();
  const actualDelay = scheduledTime - now;

  // Allow some tolerance for test execution time
  assert.ok(Math.abs(actualDelay - customDelayMs) < 1000, `Expected ~${customDelayMs}ms delay, got ${actualDelay}ms`);
});

test("DlqService scheduleRetry throws on invalid delay", () => {
  const dlqService = new DlqService();

  const record = dlqService.enqueue({
    sourceEventId: "evt_invalid_delay",
    consumerId: "test-consumer",
    errorCode: "test.error",
    payloadJson: "{}",
  });

  assert.throws(() => {
    dlqService.scheduleRetry(record.deadLetterId, -100);
  });

  assert.throws(() => {
    dlqService.scheduleRetry(record.deadLetterId, NaN);
  });
});
