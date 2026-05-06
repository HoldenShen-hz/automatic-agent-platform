import assert from "node:assert/strict";
import test from "node:test";

import { CircuitBreaker } from "../../../../../src/platform/model-gateway/provider-registry/circuit-breaker.js";

test("circuit breaker bounds failure and success timestamp windows", () => {
  const breaker = new CircuitBreaker({
    name: "memory-bound-breaker",
    monitorWindowMs: 60_000,
    maxWindowEntries: 128,
    failureThreshold: 10_000,
  });

  for (let index = 0; index < 1_000; index++) {
    breaker.onFailure();
    breaker.onSuccess();
  }

  assert.equal((breaker as { failureTimestamps: number[] }).failureTimestamps.length, 128);
  assert.equal((breaker as { successTimestamps: number[] }).successTimestamps.length, 128);
});
