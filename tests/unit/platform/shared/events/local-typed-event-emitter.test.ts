import assert from "node:assert/strict";
import test from "node:test";

import { LocalTypedEventEmitter } from "../../../../../src/platform/shared/events/local-typed-event-emitter.js";

interface TestEvents extends Record<string, unknown> {
  ready: { id: string };
}

test("LocalTypedEventEmitter enforces max listener limit", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>().setMaxListeners(1);
  const first = () => undefined;
  const second = () => undefined;

  emitter.on("ready", first);

  assert.throws(
    () => emitter.on("ready", second),
    /local_typed_event_emitter\.max_listeners_exceeded:ready/,
  );
});

test("LocalTypedEventEmitter allows duplicate listener registration without exceeding limit", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>().setMaxListeners(1);
  const listener = () => undefined;

  emitter.on("ready", listener);
  emitter.on("ready", listener);

  assert.equal(emitter.listenerCount("ready"), 1);
});

test("LocalTypedEventEmitter validates max listener configuration", () => {
  const emitter = new LocalTypedEventEmitter<TestEvents>();

  assert.throws(
    () => emitter.setMaxListeners(0),
    /local_typed_event_emitter\.invalid_max_listeners/,
  );
});
