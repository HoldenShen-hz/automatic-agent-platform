import assert from "node:assert/strict";
import test from "node:test";

import * as runtimeIndex from "../../../../src/core/runtime/index.js";

test("core/runtime index re-exports platform execution engine types", () => {
  assert.ok(runtimeIndex);
  // Should re-export dispatcher, execution-engine, state-transition, lease, worker-registry, checkpoints
  assert.ok(typeof runtimeIndex.TransitionService !== "undefined" || runtimeIndex.runMultiStepOrchestration != null);
});