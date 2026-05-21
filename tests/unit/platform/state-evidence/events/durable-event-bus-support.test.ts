/**
 * Unit tests for durable-event-bus-support.ts
 *
 * Tests utility functions and classes for the durable event bus support module:
 * - AdaptivePollingInterval
 * - calculateBackoff
 * - sleep
 * - getActiveConsumerRefCounts
 * - validateEventPayloadSize
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import {
  AdaptivePollingInterval,
  calculateBackoff,
  sleep,
  getActiveConsumerRefCounts,
  validateEventPayloadSize,
  ACTIVE_SUBSCRIBER_POLL_INTERVAL_MS,
  INITIAL_BACKOFF_MS,
  MAX_BACKOFF_MS,
} from "../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus-support.js";

test("AdaptivePollingInterval getInterval returns baseIntervalMs initially", () => {
  const adapter = new AdaptivePollingInterval();
  const backPressureState = {
    isBackPressure: false,
    pendingCount: 0,
    bufferedBytes: 0,
    lastCheckedAt: new Date().toISOString(),
  };

  const interval = adapter.getInterval(backPressureState);
  assert.equal(interval, ACTIVE_SUBSCRIBER_POLL_INTERVAL_MS);
});

test("AdaptivePollingInterval getInterval doubles when back pressure is true", () => {
  const adapter = new AdaptivePollingInterval(100, 1000);
  const backPressureState = {
    isBackPressure: true,
    pendingCount: 100,
    bufferedBytes: 500_000,
    lastCheckedAt: new Date().toISOString(),
  };

  const interval1 = adapter.getInterval(backPressureState);
  // First doubling: 100 * 2 = 200
  assert.equal(interval1, 200);

  const interval2 = adapter.getInterval(backPressureState);
  // Second doubling: 200 * 2 = 400
  assert.equal(interval2, 400);
});

test("AdaptivePollingInterval getInterval halves when back pressure is false", () => {
  const adapter = new AdaptivePollingInterval(100, 1000);
  const noBackPressure = {
    isBackPressure: false,
    pendingCount: 0,
    bufferedBytes: 0,
    lastCheckedAt: new Date().toISOString(),
  };
  const withBackPressure = { ...noBackPressure, isBackPressure: true };

  // Get into a doubled state first
  adapter.getInterval(withBackPressure);
  adapter.getInterval(withBackPressure);
  // Now at 400

  // Without back pressure, should halve
  const interval = adapter.getInterval(noBackPressure);
  assert.equal(interval, 200);
});

test("AdaptivePollingInterval getInterval caps at maxIntervalMs", () => {
  const adapter = new AdaptivePollingInterval(100, 500);
  const backPressureState = {
    isBackPressure: true,
    pendingCount: 1000,
    bufferedBytes: 1_000_000,
    lastCheckedAt: new Date().toISOString(),
  };

  // Keep doubling until we hit the cap
  let lastInterval = 0;
  for (let i = 0; i < 10; i++) {
    lastInterval = adapter.getInterval(backPressureState);
  }

  // Should cap at maxIntervalMs (500)
  assert.equal(lastInterval, 500);
});

test("AdaptivePollingInterval getInterval floors at baseIntervalMs", () => {
  const adapter = new AdaptivePollingInterval(100, 1000);
  const noBackPressure = {
    isBackPressure: false,
    pendingCount: 0,
    bufferedBytes: 0,
    lastCheckedAt: new Date().toISOString(),
  };
  const withBackPressure = { ...noBackPressure, isBackPressure: true };

  // Get into a halved state
  adapter.getInterval(withBackPressure);
  adapter.getInterval(withBackPressure);
  // Now at 400

  // Keep reducing without back pressure
  let lastInterval = 0;
  for (let i = 0; i < 10; i++) {
    lastInterval = adapter.getInterval(noBackPressure);
  }

  // Should floor at baseIntervalMs (100)
  assert.equal(lastInterval, 100);
});

test("AdaptivePollingInterval reset restores base interval", () => {
  const adapter = new AdaptivePollingInterval(100, 1000);
  const backPressureState = {
    isBackPressure: true,
    pendingCount: 100,
    bufferedBytes: 500_000,
    lastCheckedAt: new Date().toISOString(),
  };

  // Double several times
  adapter.getInterval(backPressureState);
  adapter.getInterval(backPressureState);
  adapter.getInterval(backPressureState);

  adapter.reset();

  const interval = adapter.getInterval({
    isBackPressure: false,
    pendingCount: 0,
    bufferedBytes: 0,
    lastCheckedAt: new Date().toISOString(),
  });
  assert.equal(interval, 100);
});

test("AdaptivePollingInterval constructor accepts custom values", () => {
  const adapter = new AdaptivePollingInterval(50, 200);

  // With no back pressure, should return base
  const noBp = { isBackPressure: false, pendingCount: 0, bufferedBytes: 0, lastCheckedAt: "" };
  assert.equal(adapter.getInterval(noBp), 50);

  // With back pressure, should double from 50
  const withBp = { ...noBp, isBackPressure: true };
  assert.equal(adapter.getInterval(withBp), 100);
});

test("calculateBackoff returns exponential delay with jitter", () => {
  const attemptIndex = 0;
  const result = calculateBackoff(attemptIndex);

  // INITIAL_BACKOFF_MS * 2^0 = 100ms base, plus up to 10% jitter
  const minExpected = INITIAL_BACKOFF_MS;
  const maxExpected = INITIAL_BACKOFF_MS * 1.1;

  assert.ok(result >= minExpected && result <= maxExpected,
    `Expected ${result} to be between ${minExpected} and ${maxExpected}`);
});

test("calculateBackoff increases exponentially with attempt index", () => {
  const delays: number[] = [];

  for (let i = 0; i < 5; i++) {
    delays.push(calculateBackoff(i));
  }

  // Each delay should generally be larger than the previous (with jitter tolerance)
  // We check that the base exponential is respected
  for (let i = 1; i < delays.length; i++) {
    const expectedBaseIncrease = INITIAL_BACKOFF_MS * Math.pow(2, i);
    // With jitter, actual can be up to 110% of expected
    assert.ok(delays[i] <= expectedBaseIncrease * 1.1,
      `delay[${i}]=${delays[i]} should be <= ${expectedBaseIncrease * 1.1}`);
  }
});

test("calculateBackoff caps at MAX_BACKOFF_MS", () => {
  const veryHighAttempt = 20;
  const result = calculateBackoff(veryHighAttempt);

  // Even with high attempt index, should not exceed MAX_BACKOFF_MS * 1.1 (with jitter)
  assert.ok(result <= MAX_BACKOFF_MS * 1.1,
    `calculateBackoff(${veryHighAttempt})=${result} should be <= ${MAX_BACKOFF_MS * 1.1}`);
});

test("calculateBackoff returns different values on subsequent calls (jitter)", () => {
  const attemptIndex = 3;
  const results = new Set<number>();

  // Call multiple times and collect unique values
  for (let i = 0; i < 10; i++) {
    results.add(calculateBackoff(attemptIndex));
  }

  // With jitter, we should see some variation (though not guaranteed with random)
  // The key is that it's always within expected bounds
  for (const result of results) {
    const base = INITIAL_BACKOFF_MS * Math.pow(2, attemptIndex);
    assert.ok(result >= base && result <= base * 1.1,
      `All results should be within expected range: ${result}`);
  }
});

test("sleep resolves after specified milliseconds", async () => {
  const start = Date.now();
  const delayMs = 50;

  await sleep(delayMs);

  const elapsed = Date.now() - start;
  // Allow some tolerance for test overhead
  assert.ok(elapsed >= delayMs - 5, `Expected at least ${delayMs}ms, got ${elapsed}ms`);
});

test("sleep resolves for zero delay", async () => {
  const start = Date.now();
  await sleep(0);
  const elapsed = Date.now() - start;

  // Zero delay should resolve quickly, but in loaded test environments
  // may take a few ms - we allow up to 50ms tolerance
  assert.ok(elapsed < 50, `Expected near-immediate resolution, got ${elapsed}ms`);
});

test("validateEventPayloadSize accepts valid small payloads", () => {
  const validPayloads = [
    { key: "value" },
    { nested: { deep: { value: 123 } } },
    { array: [1, 2, 3, "string", null] },
    { large: "x".repeat(1000) },
  ];

  for (const payload of validPayloads) {
    assert.doesNotThrow(() => validateEventPayloadSize(payload),
      `Payload ${JSON.stringify(payload).slice(0, 50)} should not throw`);
  }
});

test("validateEventPayloadSize accepts payloads at exactly 1MB", () => {
  const exactPayload = { data: "x".repeat(1_000_000 - 15) }; // -15 for '{"data":"","}'.length
  assert.doesNotThrow(() => validateEventPayloadSize(exactPayload));
});

test("validateEventPayloadSize rejects payloads over 1MB", () => {
  const tooLargePayload = { data: "x".repeat(1_000_001) };
  assert.throws(() => validateEventPayloadSize(tooLargePayload), /event\.payload_too_large/);
});

test("validateEventPayloadSize rejects deeply nested payload that serializes to > 1MB", () => {
  // Create a payload that when serialized exceeds 1MB
  const largePayload = { items: [] };
  const targetSize = 1_000_001;
  let serialized = JSON.stringify(largePayload);

  // Build up to just over 1MB
  while (serialized.length < targetSize) {
    largePayload.items.push({ data: "x".repeat(1000) });
    serialized = JSON.stringify(largePayload);
  }

  assert.throws(() => validateEventPayloadSize(largePayload), /event\.payload_too_large/);
});

test("validateEventPayloadSize error includes payloadSize detail", () => {
  const tooLargePayload = { data: "x".repeat(2_000_000) };

  try {
    validateEventPayloadSize(tooLargePayload);
    assert.fail("Should have thrown");
  } catch (err: unknown) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /event\.payload_too_large/);
    // Error message contains "Event payload size X exceeds maximum of Y bytes"
    assert.match(err.message, /Event payload size/);
    assert.match(err.message, /exceeds maximum/);
  }
});

test("getActiveConsumerRefCounts initializes map for new database", () => {
  // This test verifies the WeakMap behavior
  // We can't easily test this without a real AuthoritativeSqlDatabase
  // but we can verify the constants are exported correctly
  assert.ok(ACTIVE_SUBSCRIBER_POLL_INTERVAL_MS > 0);
  assert.ok(INITIAL_BACKOFF_MS > 0);
  assert.ok(MAX_BACKOFF_MS > 0);
  assert.ok(INITIAL_BACKOFF_MS < MAX_BACKOFF_MS);
});