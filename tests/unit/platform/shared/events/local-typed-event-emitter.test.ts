import assert from "node:assert/strict";
import test from "node:test";

import {
  LocalTypedEventEmitter,
  LocalEventListener,
} from "../../../../../src/platform/shared/events/local-typed-event-emitter.js";

interface TestEvents extends Record<string, unknown> {
  ready: { id: string };
  update: { value: number };
  complete: void;
  error: { message: string };
}

test("LocalTypedEventEmitter - on() registers listener and returns emitter for chaining", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  const listener = () => undefined;

  const result = emitter.on("ready", listener);

  assert.equal(emitter.listenerCount("ready"), 1);
  assert.equal(result, emitter);
});

test("LocalTypedEventEmitter - on() throws when max listeners exceeded", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>().setMaxListeners(1);
  const first = () => undefined;
  const second = () => undefined;

  emitter.on("ready", first);

  assert.throws(
    () => emitter.on("ready", second),
    /local_typed_event_emitter\.max_listeners_exceeded:ready/,
  );
});

test("LocalTypedEventEmitter - on() allows duplicate listener without exceeding limit", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>().setMaxListeners(1);
  const listener = () => undefined;

  emitter.on("ready", listener);
  emitter.on("ready", listener);

  assert.equal(emitter.listenerCount("ready"), 1);
});

test("LocalTypedEventEmitter - setMaxListeners() validates integer input", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();

  assert.throws(
    () => emitter.setMaxListeners(0),
    /local_typed_event_emitter\.invalid_max_listeners/,
  );

  assert.throws(
    () => emitter.setMaxListeners(-1),
    /local_typed_event_emitter\.invalid_max_listeners/,
  );

  assert.throws(
    () => emitter.setMaxListeners(1.5),
    /local_typed_event_emitter\.invalid_max_listeners/,
  );

  assert.throws(
    () => emitter.setMaxListeners(NaN),
    /local_typed_event_emitter\.invalid_max_listeners/,
  );
});

test("LocalTypedEventEmitter - setMaxListeners() accepts valid values", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();

  assert.equal(emitter.setMaxListeners(10).getMaxListeners(), 10);
  assert.equal(emitter.setMaxListeners(1).getMaxListeners(), 1);
  assert.equal(emitter.setMaxListeners(1000).getMaxListeners(), 1000);
});

test("LocalTypedEventEmitter - getMaxListeners() returns current limit", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();

  assert.equal(emitter.getMaxListeners(), 100);
  emitter.setMaxListeners(50);
  assert.equal(emitter.getMaxListeners(), 50);
});

test("LocalTypedEventEmitter - once() registers one-time listener and removes it after emission", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  let callCount = 0;
  const listener = () => callCount++;

  emitter.once("ready", listener);

  assert.equal(emitter.listenerCount("ready"), 1);

  emitter.emit("ready", { id: "test" });
  assert.equal(callCount, 1);
  assert.equal(emitter.listenerCount("ready"), 0);

  emitter.emit("ready", { id: "test2" });
  assert.equal(callCount, 1);
});

test("LocalTypedEventEmitter - once() passes correct payload to listener", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  let receivedPayload: { id: string } | undefined;

  emitter.once("ready", (payload) => {
    receivedPayload = payload;
  });

  emitter.emit("ready", { id: "abc123" });

  assert.deepEqual(receivedPayload, { id: "abc123" });
});

test("LocalTypedEventEmitter - off() removes listener and returns emitter for chaining", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  const listener = () => undefined;

  emitter.on("ready", listener);
  assert.equal(emitter.listenerCount("ready"), 1);

  const result = emitter.off("ready", listener);
  assert.equal(emitter.listenerCount("ready"), 0);
  assert.equal(result, emitter);
});

test("LocalTypedEventEmitter - off() returns emitter even if listener was not registered", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  const listener = () => undefined;

  const result = emitter.off("ready", listener);
  assert.equal(result, emitter);
});

test("LocalTypedEventEmitter - removeListener() is alias for off()", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  const listener = () => undefined;

  emitter.on("ready", listener);
  assert.equal(emitter.listenerCount("ready"), 1);

  emitter.removeListener("ready", listener);
  assert.equal(emitter.listenerCount("ready"), 0);
});

test("LocalTypedEventEmitter - listeners() returns array of registered listeners", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  const listener1 = () => undefined;
  const listener2 = () => undefined;

  emitter.on("ready", listener1);
  emitter.on("ready", listener2);

  const listeners = emitter.listeners("ready");
  assert.equal(listeners.length, 2);
  assert.ok(listeners.includes(listener1));
  assert.ok(listeners.includes(listener2));
});

test("LocalTypedEventEmitter - listeners() returns empty array for unregistered event", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();

  const listeners = emitter.listeners("nonexistent");
  assert.deepEqual(listeners, []);
});

test("LocalTypedEventEmitter - listenerCount() returns correct count", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  const listener1 = () => undefined;
  const listener2 = () => undefined;

  assert.equal(emitter.listenerCount("ready"), 0);

  emitter.on("ready", listener1);
  assert.equal(emitter.listenerCount("ready"), 1);

  emitter.on("ready", listener2);
  assert.equal(emitter.listenerCount("ready"), 2);

  emitter.off("ready", listener1);
  assert.equal(emitter.listenerCount("ready"), 1);
});

test("LocalTypedEventEmitter - listenerCount() returns 0 for unregistered event", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();

  assert.equal(emitter.listenerCount("nonexistent"), 0);
});

test("LocalTypedEventEmitter - emit() returns true when listeners are registered", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  const listener = () => undefined;

  emitter.on("ready", listener);

  assert.equal(emitter.emit("ready"), true);
});

test("LocalTypedEventEmitter - emit() returns false when no listeners are registered", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();

  assert.equal(emitter.emit("ready"), false);
});

test("LocalTypedEventEmitter - emit() calls all registered listeners with payload", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  let callCount = 0;
  const listener1 = () => callCount++;
  const listener2 = () => callCount++;

  emitter.on("ready", listener1);
  emitter.on("ready", listener2);

  emitter.emit("ready", { id: "test" });

  assert.equal(callCount, 2);
});

test("LocalTypedEventEmitter - emit() passes correct payload type to listeners", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  let receivedPayload: { value: number } | undefined;

  emitter.on("update", (payload) => {
    receivedPayload = payload;
  });

  emitter.emit("update", { value: 42 });

  assert.deepEqual(receivedPayload, { value: 42 });
});

test("LocalTypedEventEmitter - emit() handles void payload type", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  let called = false;

  emitter.on("complete", () => {
    called = true;
  });

  emitter.emit("complete");

  assert.equal(called, true);
});

test("LocalTypedEventEmitter - emit() does not call listeners removed during iteration", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  let callCount = 0;
  const listener1 = () => {
    callCount++;
    emitter.off("ready", listener2);
  };
  const listener2 = () => {
    callCount++;
  };

  emitter.on("ready", listener1);
  emitter.on("ready", listener2);

  emitter.emit("ready");

  assert.equal(callCount, 2);
});

test("LocalTypedEventEmitter - removeAllListeners() without argument clears all listeners", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  const listener1 = () => undefined;
  const listener2 = () => undefined;

  emitter.on("ready", listener1);
  emitter.on("update", listener2);

  emitter.removeAllListeners();

  assert.equal(emitter.listenerCount("ready"), 0);
  assert.equal(emitter.listenerCount("update"), 0);
});

test("LocalTypedEventEmitter - removeAllListeners() with event argument clears only that event's listeners", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  const listener1 = () => undefined;
  const listener2 = () => undefined;

  emitter.on("ready", listener1);
  emitter.on("update", listener2);

  emitter.removeAllListeners("ready");

  assert.equal(emitter.listenerCount("ready"), 0);
  assert.equal(emitter.listenerCount("update"), 1);
});

test("LocalTypedEventEmitter - removeAllListeners() returns emitter for chaining", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  const listener = () => undefined;

  emitter.on("ready", listener);

  const result = emitter.removeAllListeners();
  assert.equal(result, emitter);
});

test("LocalTypedEventEmitter - supports multiple different event types", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  let readyCalled = false;
  let updateCalled = false;
  let completeCalled = false;

  emitter.on("ready", () => { readyCalled = true; });
  emitter.on("update", () => { updateCalled = true; });
  emitter.on("complete", () => { completeCalled = true; });

  emitter.emit("update", { value: 1 });
  assert.equal(readyCalled, false);
  assert.equal(updateCalled, true);
  assert.equal(completeCalled, false);

  emitter.emit("ready", { id: "test" });
  assert.equal(readyCalled, true);
  assert.equal(completeCalled, false);

  emitter.emit("complete");
  assert.equal(completeCalled, true);
});

test("LocalTypedEventEmitter - type safety with event key lookup", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  const readyListener = (payload: TestEvents["ready"]) => {
    assert.equal(payload.id, "type-safe");
  };

  emitter.on("ready", readyListener);
  emitter.emit("ready", { id: "type-safe" });
});

test("LocalTypedEventEmitter - chaining multiple operations", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  const listener = () => undefined;

  emitter
    .setMaxListeners(10)
    .on("ready", listener)
    .on("update", listener)
    .setMaxListeners(5);

  assert.equal(emitter.getMaxListeners(), 5);
  assert.equal(emitter.listenerCount("ready"), 1);
  assert.equal(emitter.listenerCount("update"), 1);
});

test("LocalTypedEventEmitter - error event with string message payload", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();
  let receivedMessage = "";

  emitter.on("error", (payload) => {
    receivedMessage = payload.message;
  });

  emitter.emit("error", { message: "Something went wrong" });

  assert.equal(receivedMessage, "Something went wrong");
});
