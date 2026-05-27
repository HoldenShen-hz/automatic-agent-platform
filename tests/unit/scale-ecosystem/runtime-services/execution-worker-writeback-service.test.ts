import assert from "node:assert/strict";
import test from "node:test";
import { ExecutionWorkerWritebackService } from "../../../../src/scale-ecosystem/runtime-services/execution-worker-writeback-service.js";

test("ExecutionWorkerWritebackService is exported and is a class [execution-worker-writeback-service]", () => {
  assert.equal(typeof ExecutionWorkerWritebackService, "function");
});
