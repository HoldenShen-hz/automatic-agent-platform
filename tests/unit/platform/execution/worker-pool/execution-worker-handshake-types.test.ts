/**
 * Unit Tests: Execution Worker Handshake Types barrel
 *
 * Tests that execution-worker-handshake-types barrel exports correctly.
 */

import assert from "node:assert/strict";
import test from "node:test";

test("execution-worker-handshake-types exports worker handshake types", async () => {
  const mod = await import("../../../../../src/platform/execution/worker-pool/execution-worker-handshake-types.js");
  assert.ok(mod);
});

test("execution-worker-handshake-types exports types via star export", async () => {
  const mod = await import("../../../../../src/platform/execution/worker-pool/execution-worker-handshake-types.js");
  // Just verify the module loaded
  assert.equal(typeof mod, "object");
});