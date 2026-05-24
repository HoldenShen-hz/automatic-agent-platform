import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  calculateBackoffForAttempt,
  DEFAULT_DELIVERY_CONFIG,
  toDeliveryMessageRecord,
} from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-delivery-support.js";

test("calculateBackoffForAttempt computes exponential backoff", () => {
  const config = { ...DEFAULT_DELIVERY_CONFIG, initialBackoffMs: 1000, backoffMultiplier: 2, maxBackoffMs: 10000 };

  assert.equal(calculateBackoffForAttempt(config, 1), 1000);  // 1000 * 2^0
  assert.equal(calculateBackoffForAttempt(config, 2), 2000);  // 1000 * 2^1
  assert.equal(calculateBackoffForAttempt(config, 3), 4000);  // 1000 * 2^2
  assert.equal(calculateBackoffForAttempt(config, 4), 8000);  // 1000 * 2^3
});

test("calculateBackoffForAttempt caps at maxBackoffMs", () => {
  const config = { ...DEFAULT_DELIVERY_CONFIG, initialBackoffMs: 1000, backoffMultiplier: 2, maxBackoffMs: 5000 };

  assert.equal(calculateBackoffForAttempt(config, 1), 1000);
  assert.equal(calculateBackoffForAttempt(config, 2), 2000);
  assert.equal(calculateBackoffForAttempt(config, 3), 4000);
  assert.equal(calculateBackoffForAttempt(config, 4), 5000);  // capped at max
  assert.equal(calculateBackoffForAttempt(config, 5), 5000);  // still capped
});

test("calculateBackoffForAttempt handles attempt number of 0", () => {
  const config = { ...DEFAULT_DELIVERY_CONFIG, initialBackoffMs: 1000, backoffMultiplier: 2, maxBackoffMs: 10000 };
  // attempt 0 means no backoff yet
  assert.equal(calculateBackoffForAttempt(config, 0), 1000); // 1000 * 2^-1 = 500, but floored
});

test("calculateBackoffForAttempt uses DEFAULT_DELIVERY_CONFIG values", () => {
  // Default: initialBackoffMs=1000, backoffMultiplier=2, maxBackoffMs=60000
  assert.equal(calculateBackoffForAttempt(DEFAULT_DELIVERY_CONFIG, 1), 1000);
  assert.equal(calculateBackoffForAttempt(DEFAULT_DELIVERY_CONFIG, 2), 2000);
  assert.equal(calculateBackoffForAttempt(DEFAULT_DELIVERY_CONFIG, 3), 4000);
  assert.equal(calculateBackoffForAttempt(DEFAULT_DELIVERY_CONFIG, 4), 8000);
  assert.equal(calculateBackoffForAttempt(DEFAULT_DELIVERY_CONFIG, 5), 16000);
  assert.equal(calculateBackoffForAttempt(DEFAULT_DELIVERY_CONFIG, 6), 32000);
  assert.equal(calculateBackoffForAttempt(DEFAULT_DELIVERY_CONFIG, 7), 60000);  // capped
});

test("toDeliveryMessageRecord returns null for undefined row", () => {
  const result = toDeliveryMessageRecord(undefined);
  assert.equal(result, null);
});

test("toDeliveryMessageRecord parses row correctly", () => {
  const row = { attempts: 3, max_retries: 5 };
  const result = toDeliveryMessageRecord(row);
  assert.deepEqual(result, { attempts: 3, maxRetries: 5 });
});

test("toDeliveryMessageRecord converts string numbers to numbers", () => {
  const row = { attempts: "4", max_retries: "7" } as unknown as { attempts: number; max_retries: number };
  const result = toDeliveryMessageRecord(row);
  assert.deepEqual(result, { attempts: 4, maxRetries: 7 });
});
