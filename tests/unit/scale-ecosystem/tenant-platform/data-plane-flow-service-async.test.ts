import assert from "node:assert/strict";
import test from "node:test";
import { DataPlaneFlowServiceAsync } from "../../../../src/scale-ecosystem/tenant-platform/data-plane-flow-service-async.js";

test("DataPlaneFlowServiceAsync is exported and is a class [data-plane-flow-service-async]", () => {
  assert.equal(typeof DataPlaneFlowServiceAsync, "function");
});
