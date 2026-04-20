import assert from "node:assert/strict";
import test from "node:test";

import {
  DistributedRateLimiter,
  RedisRateLimiter,
} from "../../../../../src/platform/interface/ingress/index.js";

test("ingress barrel exports rate limiter implementations", () => {
  assert.equal(typeof DistributedRateLimiter, "function");
  assert.equal(typeof RedisRateLimiter, "function");
});
