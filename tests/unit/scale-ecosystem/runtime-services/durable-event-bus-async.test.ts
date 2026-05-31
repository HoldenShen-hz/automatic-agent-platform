import assert from "node:assert/strict";
import test from "node:test";

import { DurableEventBusAsync as ScaleDurableEventBusAsync } from "../../../../src/scale-ecosystem/runtime-services/durable-event-bus-async.js";
import { DurableEventBusAsync as PlatformDurableEventBusAsync } from "../../../../src/platform/five-plane-state-evidence/events/durable-event-bus-async.js";

test("scale durable-event-bus async mirrors the platform facade [durable-event-bus-async]", () => {
  assert.equal(ScaleDurableEventBusAsync, PlatformDurableEventBusAsync);
  assert.equal(typeof ScaleDurableEventBusAsync.prototype.publish, "function");
  assert.equal(typeof ScaleDurableEventBusAsync.prototype.deliverPending, "function");
  assert.equal(typeof ScaleDurableEventBusAsync.prototype.getSyncService, "function");
});
