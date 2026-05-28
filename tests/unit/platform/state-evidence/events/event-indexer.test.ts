/**
 * Unit tests for event-indexer.ts
 *
 * Tests the legacy compatibility shim that re-exports from index.ts.
 */

import assert from "node:assert/strict";
import test from "node:test";

// Re-import the same module to verify re-export works
import * as indexExports from "../../../../../src/platform/five-plane-state-evidence/events/index.js";

test("event-indexer.ts re-exports from index.js", () => {
  assert.ok("EventOpsService" in indexExports);
  assert.ok("DurableEventBus" in indexExports);
});

test("event-indexer barrel exports are available", () => {
  // Verify the index module has expected structure
  // The event-indexer is a compatibility shim, so we verify the barrel works
  const moduleKeys = Object.keys(indexExports);
  assert.ok(moduleKeys.length > 0, "Index module should export something");
});

test("event-indexer module can be imported without error", async () => {
  // This test verifies the module itself loads correctly
  const module = await import("../../../../../src/platform/five-plane-state-evidence/events/event-indexer.js");
  assert.ok(module !== undefined);
});

test("event-indexer re-exports EventRecord types if available", async () => {
  const module = await import("../../../../../src/platform/five-plane-state-evidence/events/event-indexer.js");
  assert.deepEqual(Object.keys(module).sort(), Object.keys(indexExports).sort());
});
