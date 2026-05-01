import assert from "node:assert/strict";
import test from "node:test";
import { mock } from "node:test";
import { CircuitBreakerEventBus } from "../../../../../src/platform/model-gateway/provider-registry/circuit-breaker-event-bus.js";
import type { CircuitBreakerStateChangePayload } from "../../../../../src/platform/model-gateway/provider-registry/circuit-breaker.js";

test("emitStateChange does nothing when no emitter is set", () => {
  const bus = new CircuitBreakerEventBus();
  const payload: CircuitBreakerStateChangePayload = {
    circuitName: "test-circuit",
    oldState: "closed",
    newState: "open",
    nextAttemptAt: 1234567890,
    occurredAt: "2024-01-01T00:00:00Z",
  };

  assert.doesNotThrow(() => {
    bus.emitStateChange(payload);
  });
});

test("emitStateChange calls emitter when set", () => {
  const bus = new CircuitBreakerEventBus();
  const mockEmitter = mock.fn();
  const payload: CircuitBreakerStateChangePayload = {
    circuitName: "test-circuit",
    oldState: "closed",
    newState: "open",
    nextAttemptAt: 1234567890,
    occurredAt: "2024-01-01T00:00:00Z",
  };

  bus.setEmitter(mockEmitter);
  bus.emitStateChange(payload);

  assert.equal(mockEmitter.mock.callCount(), 1);
  const call = mockEmitter.mock.calls[0];
  assert.equal(call.arguments[0], "circuit_breaker:state_changed");
  assert.deepEqual(call.arguments[1], payload);
});

test("setEmitter replaces existing emitter", () => {
  const bus = new CircuitBreakerEventBus();
  const mockEmitter1 = mock.fn();
  const mockEmitter2 = mock.fn();

  bus.setEmitter(mockEmitter1);
  bus.setEmitter(mockEmitter2);

  const payload: CircuitBreakerStateChangePayload = {
    circuitName: "test-circuit",
    oldState: "closed",
    newState: "open",
    nextAttemptAt: null,
    occurredAt: "2024-01-01T00:00:00Z",
  };

  bus.emitStateChange(payload);

  assert.equal(mockEmitter1.mock.callCount(), 0);
  assert.equal(mockEmitter2.mock.callCount(), 1);
});

test("createStateChangeHandler returns a handler function", () => {
  const bus = new CircuitBreakerEventBus();
  const mockEmitter = mock.fn();
  bus.setEmitter(mockEmitter);

  const handler = bus.createStateChangeHandler();
  assert.equal(typeof handler, "function");

  const payload: CircuitBreakerStateChangePayload = {
    circuitName: "test-circuit",
    oldState: "open",
    newState: "half_open",
    nextAttemptAt: 1234567890,
    occurredAt: "2024-01-01T00:00:00Z",
  };

  handler(payload);

  assert.equal(mockEmitter.mock.callCount(), 1);
  const call = mockEmitter.mock.calls[0];
  assert.equal(call.arguments[0], "circuit_breaker:state_changed");
  assert.deepEqual(call.arguments[1], payload);
});

test("createStateChangeHandler returns handler that does nothing when no emitter set", () => {
  const bus = new CircuitBreakerEventBus();

  const handler = bus.createStateChangeHandler();

  assert.doesNotThrow(() => {
    handler({
      circuitName: "test-circuit",
      oldState: "closed",
      newState: "open",
      nextAttemptAt: 1234567890,
      occurredAt: "2024-01-01T00:00:00Z",
    });
  });
});

test("globalCircuitBreakerEventBus exists and is instance of CircuitBreakerEventBus", async () => {
  const { globalCircuitBreakerEventBus } = await import("../../../../../src/platform/model-gateway/provider-registry/circuit-breaker-event-bus.js");

  assert.ok(globalCircuitBreakerEventBus instanceof CircuitBreakerEventBus);
});