/**
 * Tests for marketplace execution-worker-handshake-service re-export
 *
 * Verifies the re-export from runtime-services works correctly.
 */

import assert from "node:assert/strict";
import test from "node:test";

import * as ExecutionWorkerHandshakeService from "../../../../src/scale-ecosystem/marketplace/execution-worker-handshake-service.js";

test("execution-worker-handshake-service exports ExecutionWorkerHandshakeService", () => {
  assert.ok(ExecutionWorkerHandshakeService.ExecutionWorkerHandshakeService !== undefined);
});
