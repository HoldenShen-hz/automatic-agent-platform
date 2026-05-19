// @ts-nocheck
/**
 * Tests for marketplace durable-event-bus re-export
 *
 * Verifies the re-export from runtime-services works correctly.
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as DurableEventBus from "../../../../src/scale-ecosystem/marketplace/durable-event-bus.js";
test("durable-event-bus exports DurableEventBus", () => {
    assert.ok(DurableEventBus.DurableEventBus !== undefined);
});
//# sourceMappingURL=durable-event-bus.test.js.map