import assert from "node:assert/strict";
import test from "node:test";

import { CircuitBreakerEventBus, globalCircuitBreakerEventBus } from "../../../../src/platform/model-gateway/provider-registry/circuit-breaker-event-bus.js";

test("CircuitBreakerEventBus setEmitter and emitStateChange", () => {
  const bus = new CircuitBreakerEventBus();
  let emitted = false;
  let payload: unknown = null;

  bus.setEmitter((eventType, p) => {
    emitted = true;
    payload = p;
  });

  bus.emitStateChange({
    circuitName: "test",
    oldState: "closed",
    newState: "open",
    nextAttemptAt: 1234567890,
    occurredAt: new Date().toISOString(),
  });

  assert.equal(emitted, true);
  assert.equal((payload as { circuitName: string }).circuitName, "test");
});

test("CircuitBreakerEventBus createStateChangeHandler", () => {
  const bus = new CircuitBreakerEventBus();
  let called = false;

  bus.setEmitter(() => {
    called = true;
  });

  const handler = bus.createStateChangeHandler();
  handler({
    circuitName: "test2",
    oldState: "open",
    newState: "half_open",
    nextAttemptAt: null,
    occurredAt: new Date().toISOString(),
  });

  assert.equal(called, true);
});

test("CircuitBreakerEventBus does not emit when no emitter set", () => {
  assert.doesNotThrow(() => {
    const bus = new CircuitBreakerEventBus();

    // Should not throw
    bus.emitStateChange({
      circuitName: "test",
      oldState: "closed",
      newState: "open",
      nextAttemptAt: null,
      occurredAt: new Date().toISOString(),
    });
  });
});

test("globalCircuitBreakerEventBus exists and is instance of CircuitBreakerEventBus", () => {
  assert.ok(globalCircuitBreakerEventBus instanceof CircuitBreakerEventBus);
});

test("globalCircuitBreakerEventBus setEmitter changes emitter", () => {
  let callCount = 0;

  globalCircuitBreakerEventBus.setEmitter(() => {
    callCount++;
  });

  globalCircuitBreakerEventBus.emitStateChange({
    circuitName: "test",
    oldState: "closed",
    newState: "open",
    nextAttemptAt: null,
    occurredAt: new Date().toISOString(),
  });

  assert.equal(callCount, 1);

  // Reset emitter
  globalCircuitBreakerEventBus.setEmitter(() => {});
});
