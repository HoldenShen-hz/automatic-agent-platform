import assert from "node:assert/strict";
import test from "node:test";
import { ExecutionDispatchService } from "../../../../src/scale-ecosystem/runtime-services/execution-dispatch-service.js";

test("ExecutionDispatchService is exported and is a class [execution-dispatch-service]", () => {
  assert.equal(typeof ExecutionDispatchService, "function");
});
