import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LOCK_TTL_MS,
  SECONDS_PER_DAY,
  MS_PER_DAY,
} from "../../../../../src/platform/contracts/constants/time.js";

test("DEFAULT_LOCK_TTL_MS is 30 seconds in milliseconds", () => {
  assert.equal(DEFAULT_LOCK_TTL_MS, 30_000);
  assert.equal(DEFAULT_LOCK_TTL_MS, 30 * 1000);
});

test("SECONDS_PER_DAY is correct", () => {
  assert.equal(SECONDS_PER_DAY, 86_400);
  // 24 hours * 60 minutes * 60 seconds
  assert.equal(SECONDS_PER_DAY, 24 * 60 * 60);
});

test("MS_PER_DAY is correct", () => {
  assert.equal(MS_PER_DAY, 86_400_000);
  // 86_400 seconds * 1000 milliseconds
  assert.equal(MS_PER_DAY, SECONDS_PER_DAY * 1000);
  // 24 hours * 60 minutes * 60 seconds * 1000 milliseconds
  assert.equal(MS_PER_DAY, 24 * 60 * 60 * 1000);
});

test("MS_PER_DAY equals SECONDS_PER_DAY times 1000", () => {
  assert.equal(MS_PER_DAY, SECONDS_PER_DAY * 1000);
});

test("Constants are positive numbers", () => {
  assert.ok(DEFAULT_LOCK_TTL_MS > 0, "DEFAULT_LOCK_TTL_MS should be positive");
  assert.ok(SECONDS_PER_DAY > 0, "SECONDS_PER_DAY should be positive");
  assert.ok(MS_PER_DAY > 0, "MS_PER_DAY should be positive");
});

test("DEFAULT_LOCK_TTL_MS is less than a day", () => {
  assert.ok(DEFAULT_LOCK_TTL_MS < MS_PER_DAY, "Lock TTL should be less than a day");
});

test("DEFAULT_LOCK_TTL_MS is used for lock timeout", () => {
  const lockTimeout = DEFAULT_LOCK_TTL_MS;
  assert.ok(lockTimeout > 0);
  assert.ok(lockTimeout < 60000);
});

test("SECONDS_PER_DAY multiplied by 1000 equals MS_PER_DAY", () => {
  assert.equal(SECONDS_PER_DAY * 1000, MS_PER_DAY);
});