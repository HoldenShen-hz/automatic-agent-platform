import { test } from "node:test";
import assert from "node:assert/strict";
import { HighPrecisionTimer, HighPrecisionTimerRequest, HighPrecisionTimerReceipt } from "../../../../src/platform/shared/async/high-precision-timer.js";

test("HighPrecisionTimer - buildReceipt calculates correct drift", () => {
  const timer = new HighPrecisionTimer();
  const request: HighPrecisionTimerRequest = {
    timerId: "timer-1",
    scheduledAtNs: BigInt("1000000000"),   // 1 second
    deadlineAtNs: BigInt("2000000000"),    // 2 seconds
    firedAtNs: BigInt("1500000000"),       // 1.5 seconds
  };

  const receipt = timer.buildReceipt(request);

  assert.equal(receipt.timerId, "timer-1");
  assert.equal(receipt.precision, "nanosecond");
  assert.equal(receipt.driftNs, BigInt("500000000")); // 0.5 second drift
  assert.equal(receipt.withinDeadline, true);
});

test("HighPrecisionTimer - buildReceipt detects missed deadline", () => {
  const timer = new HighPrecisionTimer();
  const request: HighPrecisionTimerRequest = {
    timerId: "timer-2",
    scheduledAtNs: BigInt("1000000000"),
    deadlineAtNs: BigInt("1500000000"),
    firedAtNs: BigInt("2000000000"), // Fired after deadline
  };

  const receipt = timer.buildReceipt(request);

  assert.equal(receipt.driftNs, BigInt("1000000000"));
  assert.equal(receipt.withinDeadline, false);
});

test("HighPrecisionTimer - buildReceipt on-time firing", () => {
  const timer = new HighPrecisionTimer();
  const request: HighPrecisionTimerRequest = {
    timerId: "timer-3",
    scheduledAtNs: BigInt("1000000000"),
    deadlineAtNs: BigInt("2000000000"),
    firedAtNs: BigInt("1000000000"), // Exactly on time
  };

  const receipt = timer.buildReceipt(request);

  assert.equal(receipt.driftNs, BigInt(0));
  assert.equal(receipt.withinDeadline, true);
});

test("HighPrecisionTimer - negative drift (early firing)", () => {
  const timer = new HighPrecisionTimer();
  const request: HighPrecisionTimerRequest = {
    timerId: "timer-4",
    scheduledAtNs: BigInt("2000000000"),
    deadlineAtNs: BigInt("3000000000"),
    firedAtNs: BigInt("1500000000"), // Early by 0.5 seconds
  };

  const receipt = timer.buildReceipt(request);

  assert.equal(receipt.driftNs, BigInt("-500000000"));
  assert.equal(receipt.withinDeadline, true);
});

test("HighPrecisionTimer - zero deadline (immediate deadline)", () => {
  const timer = new HighPrecisionTimer();
  const request: HighPrecisionTimerRequest = {
    timerId: "timer-5",
    scheduledAtNs: BigInt("1000000000"),
    deadlineAtNs: BigInt("1000000000"),
    firedAtNs: BigInt("1000000000"),
  };

  const receipt = timer.buildReceipt(request);

  assert.equal(receipt.driftNs, BigInt(0));
  assert.equal(receipt.withinDeadline, true);
});