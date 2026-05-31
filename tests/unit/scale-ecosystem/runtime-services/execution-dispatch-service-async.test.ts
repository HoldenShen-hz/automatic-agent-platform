import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionDispatchServiceAsync as ScaleExecutionDispatchServiceAsync } from "../../../../src/scale-ecosystem/runtime-services/execution-dispatch-service-async.js";
import { ExecutionDispatchServiceAsync as PlatformExecutionDispatchServiceAsync } from "../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-service-async.js";

test("scale execution-dispatch async mirrors the platform facade [execution-dispatch-service-async]", () => {
  assert.equal(ScaleExecutionDispatchServiceAsync, PlatformExecutionDispatchServiceAsync);
  assert.equal(typeof ScaleExecutionDispatchServiceAsync.prototype.createTicket, "function");
  assert.equal(typeof ScaleExecutionDispatchServiceAsync.prototype.dispatchNext, "function");
});
