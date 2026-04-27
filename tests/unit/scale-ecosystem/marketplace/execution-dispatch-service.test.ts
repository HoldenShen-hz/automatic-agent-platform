// @ts-nocheck
/**
 * Tests for marketplace execution-dispatch-service re-export
 *
 * Verifies the re-export from runtime-services works correctly.
 */

import assert from "node:assert/strict";
import test from "node:test";

import * as ExecutionDispatchService from "../../../../src/scale-ecosystem/marketplace/execution-dispatch-service.js";

test("execution-dispatch-service exports ExecutionDispatchService", () => {
  assert.ok(ExecutionDispatchService.ExecutionDispatchService !== undefined);
});
