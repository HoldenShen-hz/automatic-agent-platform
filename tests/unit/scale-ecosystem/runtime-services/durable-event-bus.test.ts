import assert from "node:assert/strict";
import test from "node:test";
import { DurableEventBus } from "../../../../src/scale-ecosystem/runtime-services/durable-event-bus.js";

test("DurableEventBus is exported and is a class [durable-event-bus]", () => {
  assert.equal(typeof DurableEventBus, "function");
});

test("DurableEventBus can be instantiated [durable-event-bus]", () => {
  const bus = new DurableEventBus({} as never, {} as never);
  assert.ok(bus instanceof DurableEventBus);
});
