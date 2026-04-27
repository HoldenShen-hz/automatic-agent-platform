import assert from "node:assert/strict";
import test from "node:test";

import { HarnessRuntimeService } from "../../../../../../src/platform/orchestration/harness/runtime/index.js";

test("HarnessRuntimeService is exported", () => {
  assert.ok(HarnessRuntimeService != null);
});

test("HarnessRuntimeService is a constructor or class", () => {
  assert.equal(typeof HarnessRuntimeService, "function");
});