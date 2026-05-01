import assert from "node:assert/strict";
import test from "node:test";

import {
  HighPrecisionTimer,
  type HighPrecisionTimerRequest,
} from "../../../../../src/platform/shared/async/high-precision-timer.js";

test("HighPrecisionTimer.buildReceipt calculates drift correctly", () => {
  const timer = new HighPrecisionTimer();
  const request: HighPrecisionTimerRequest = {
    timerId: "test-timer-1",
    scheduledAtNs: BigInt(1000000000), // 1 second
    deadlineAtNs: BigInt(2000000000), // 2 seconds
    firedAtNs: BigInt(1500000000), // 1.5 seconds
  };

  const receipt = timer.buildReceipt(request);

  assert.equal(receipt.timerId, "test-timer-1");
  assert.equal(receipt.precision, "nanosecond");
  assert.equal(receipt.driftNs, BigInt(500000000)); // 0.5 second drift
  assert.equal(receipt.withinDeadline, true);
});

test("HighPrecisionTimer.buildReceipt detects missed deadline", () => {
  const timer = new HighPrecisionTimer();
  const request: HighPrecisionTimerRequest = {
    timerId: "test-timer-2",
    scheduledAtNs: BigInt(1000000000),
    deadlineAtNs: BigInt(1500000000),
    firedAtNs: BigInt(2000000000), // fired after deadline
  };

  const receipt = timer.buildReceipt(request);

  assert.equal(receipt.driftNs, BigInt(1000000000));
  assert.equal(receipt.withinDeadline, false);
});

test("HighPrecisionTimer.buildReceipt handles exact deadline", () => {
  const timer = new HighPrecisionTimer();
  const request: HighPrecisionTimerRequest = {
    timerId: "test-timer-3",
    scheduledAtNs: BigInt(1000000000),
    deadlineAtNs: BigInt(2000000000),
    firedAtNs: BigInt(2000000000), // exactly at deadline
  };

  const receipt = timer.buildReceipt(request);

  assert.equal(receipt.driftNs, BigInt(1000000000));
  assert.equal(receipt.withinDeadline, true);
});

test("HighPrecisionTimer.buildReceipt handles zero drift", () => {
  const timer = new HighPrecisionTimer();
  const request: HighPrecisionTimerRequest = {
    timerId: "test-timer-4",
    scheduledAtNs: BigInt(1000000000),
    deadlineAtNs: BigInt(2000000000),
    firedAtNs: BigInt(1000000000), // fired exactly on schedule
  };

  const receipt = timer.buildReceipt(request);

  assert.equal(receipt.driftNs, BigInt(0));
  assert.equal(receipt.withinDeadline, true);
});

test("HighPrecisionTimer.buildReceipt handles early firing", () => {
  const timer = new HighPrecisionTimer();
  const request: HighPrecisionTimerRequest = {
    timerId: "test-timer-5",
    scheduledAtNs: BigInt(2000000000),
    deadlineAtNs: BigInt(3000000000),
    firedAtNs: BigInt(1500000000), // fired before scheduled time
  };

  const receipt = timer.buildReceipt(request);

  // Negative drift indicates early firing
  assert.equal(receipt.driftNs, BigInt(-500000000));
  assert.equal(receipt.withinDeadline, true);
});

test("HighPrecisionTimer.buildReceipt preserves timerId", () => {
  const timer = new HighPrecisionTimer();
  const request: HighPrecisionTimerRequest = {
    timerId: "special-id-12345",
    scheduledAtNs: BigInt(0),
    deadlineAtNs: BigInt(1000000000),
    firedAtNs: BigInt(500000000),
  };

  const receipt = timer.buildReceipt(request);
  assert.equal(receipt.timerId, "special-id-12345");
});

test("HighPrecisionTimer.buildReceipt with large numbers", () => {
  const timer = new HighPrecisionTimer();
  const request: HighPrecisionTimerRequest = {
    timerId: "large-timer",
    scheduledAtNs: BigInt("1000000000000000000"),
    deadlineAtNs: BigInt("2000000000000000000"),
    firedAtNs: BigInt("1500000000000000000"),
  };

  const receipt = timer.buildReceipt(request);

  assert.equal(receipt.driftNs, BigInt("500000000000000000"));
  assert.equal(receipt.withinDeadline, true);
});