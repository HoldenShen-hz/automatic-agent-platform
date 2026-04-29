import assert from "node:assert/strict";
import test from "node:test";

import {
  CallCircuitBreaker,
  CallRateLimiter,
  CallGovernance,
} from "../../../../src/platform/five-plane-execution/execution-engine/call-governance.js";

test("CallGovernance integration: limiter and breaker together", async () => {
  const governance = new CallGovernance({
    limiter: { maxCalls: 2, windowMs: 5000 },
    breaker: { failureThreshold: 3, successThreshold: 1, resetTimeoutMs: 30000 },
  });

  const r1 = await governance.execute("key1", async () => "ok");
  const r2 = await governance.execute("key1", async () => "ok");
  const r3 = await governance.execute("key1", async () => "blocked");

  assert.equal(r1.success, true);
  assert.equal(r2.success, true);
  assert.equal(r3.success, false);
  assert.equal(r3.error?.code, "governance.limiter_rejected");
});

test("CallGovernance integration: breaker opens after failures", async () => {
  const governance = new CallGovernance({
    breaker: { failureThreshold: 2, successThreshold: 1, resetTimeoutMs: 5000 },
  });

  await governance.execute("fail-key", async () => {
    throw new Error("failure 1");
  });
  await governance.execute("fail-key", async () => {
    throw new Error("failure 2");
  });

  const result = await governance.execute("fail-key", async () => "should not execute");
  assert.equal(result.success, false);
  assert.equal(result.error?.code, "governance.circuit_open");
});

test("CallGovernance integration: breaker recovery after timeout", async () => {
  const governance = new CallGovernance({
    breaker: { failureThreshold: 1, successThreshold: 1, resetTimeoutMs: 100 },
  });

  await governance.execute("recovery-key", async () => {
    throw new Error("trigger failure");
  });

  const blocked = await governance.execute("recovery-key", async () => "blocked");
  assert.equal(blocked.success, false);

  await new Promise((r) => setTimeout(r, 120));

  const recovered = await governance.execute("recovery-key", async () => "recovered");
  assert.equal(recovered.success, true);
  assert.equal(recovered.metadata?.circuitState, "half_open");
});

test("CallGovernance integration: circuit breaker half-open allows test calls", async () => {
  const breaker = new CallCircuitBreaker({
    failureThreshold: 1,
    successThreshold: 1,
    resetTimeoutMs: 50,
  });

  breaker.recordFailure("test-key");
  breaker.check("test-key");

  await new Promise((r) => setTimeout(r, 60));

  const halfOpen = breaker.check("test-key");
  assert.equal(halfOpen.state, "half_open");
  assert.equal(halfOpen.allowed, true);
});

test("CallGovernance integration: limiter with different keys independent", async () => {
  const governance = new CallGovernance({
    limiter: { maxCalls: 1, windowMs: 5000 },
  });

  const r1a = await governance.execute("key-a", async () => "a");
  const r1b = await governance.execute("key-b", async () => "b");
  const r2a = await governance.execute("key-a", async () => "a2");
  const r2b = await governance.execute("key-b", async () => "b2");

  assert.equal(r1a.success, true);
  assert.equal(r1b.success, true);
  assert.equal(r2a.success, false);
  assert.equal(r2b.success, false);
});

test("CallGovernance integration: stats reflect actual calls", async () => {
  const governance = new CallGovernance({});

  await governance.execute("stats-key", async () => "ok");
  await governance.execute("stats-key", async () => {
    throw new Error("fail");
  });
  await governance.execute("stats-key", async () => "ok");

  const stats = governance.getStats("stats-key");
  assert.equal(stats.totalCalls, 3);
  assert.ok(stats.successfulCalls >= 1);
});

test("CallGovernance integration: reset clears limiter and breaker", async () => {
  const governance = new CallGovernance({
    limiter: { maxCalls: 1, windowMs: 5000 },
    breaker: { failureThreshold: 1, successThreshold: 1, resetTimeoutMs: 5000 },
  });

  await governance.execute("reset-key", async () => "first");

  governance.reset("reset-key");

  const result = await governance.execute("reset-key", async () => "after-reset");
  assert.equal(result.success, true);
});

test("CallCircuitBreaker integration: success decrements failure count", () => {
  const breaker = new CallCircuitBreaker({
    failureThreshold: 3,
    successThreshold: 2,
    resetTimeoutMs: 30000,
  });

  breaker.recordFailure("key");
  breaker.recordFailure("key");
  assert.equal(breaker.getSnapshot("key")?.failures, 2);

  breaker.recordSuccess("key");
  assert.ok(breaker.getSnapshot("key")!.failures < 2);
});

test("CallRateLimiter integration: sliding window enforcement", async () => {
  const limiter = new CallRateLimiter({ maxCalls: 2, windowMs: 100 });

  assert.equal(limiter.checkAndConsume("key", 0).allowed, true);
  assert.equal(limiter.checkAndConsume("key", 0).allowed, true);
  assert.equal(limiter.checkAndConsume("key", 0).allowed, false);

  await new Promise((r) => setTimeout(r, 110));

  assert.equal(limiter.checkAndConsume("key", 110).allowed, true);
});