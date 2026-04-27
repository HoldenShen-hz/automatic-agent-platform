// @ts-nocheck
/**
 * Tests for marketplace execution-worker-writeback-service re-export
 *
 * Verifies the re-export from runtime-services works correctly.
 */

import assert from "node:assert/strict";
import test from "node:test";

import * as ExecutionWorkerWritebackService from "../../../../src/scale-ecosystem/marketplace/execution-worker-writeback-service.js";

test("execution-worker-writeback-service exports ExecutionWorkerWritebackService", () => {
  assert.ok(ExecutionWorkerWritebackService.ExecutionWorkerWritebackService !== undefined);
});
