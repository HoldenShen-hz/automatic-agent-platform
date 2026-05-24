import assert from "node:assert/strict";
import test from "node:test";
import { DurableEventBus } from "../../../../src/scale-ecosystem/runtime-services/durable-event-bus.js";

test("DurableEventBus is exported and is a class", () => {
  assert.equal(typeof DurableEventBus, "function");
});

test("DurableEventBus can be instantiated", () => {
  const bus = new DurableEventBus({} as never, {} as never);
  assert.ok(bus instanceof DurableEventBus);
});
