import assert from "node:assert/strict";
import test from "node:test";

import { HARNESS_PLANNER_ROLE } from "../../../../../src/platform/orchestration/harness/planner/index.js";
import { HARNESS_GENERATOR_ROLE } from "../../../../../src/platform/orchestration/harness/generator/index.js";
import { HARNESS_EVALUATOR_ROLE } from "../../../../../src/platform/orchestration/harness/evaluator/index.js";
import { HarnessRuntimeService } from "../../../../../src/platform/orchestration/harness/runtime/index.js";
import { ContextAssembler } from "../../../../../src/platform/orchestration/harness/context/index.js";
import { HarnessMemoryManager } from "../../../../../src/platform/orchestration/harness/memory-namespace/index.js";
import { ToolbeltAssembler } from "../../../../../src/platform/orchestration/harness/toolbelt/index.js";
import { HitlRuntime } from "../../../../../src/platform/orchestration/harness/hitl-runtime/index.js";
import { DurableHarnessService } from "../../../../../src/platform/orchestration/harness/durable/index.js";
import { EvalRunService } from "../../../../../src/platform/orchestration/harness/eval-harness/index.js";

test("harness canonical subdirectories expose runtime-aligned entrypoints", () => {
  assert.equal(HARNESS_PLANNER_ROLE, "planner");
  assert.equal(HARNESS_GENERATOR_ROLE, "generator");
  assert.equal(HARNESS_EVALUATOR_ROLE, "evaluator");

  assert.ok(new HarnessRuntimeService() instanceof HarnessRuntimeService);
  assert.ok(new ContextAssembler() instanceof ContextAssembler);
  assert.ok(new HarnessMemoryManager() instanceof HarnessMemoryManager);
  assert.ok(new ToolbeltAssembler() instanceof ToolbeltAssembler);
  assert.ok(new HitlRuntime() instanceof HitlRuntime);
  assert.ok(new DurableHarnessService() instanceof DurableHarnessService);
  assert.ok(new EvalRunService() instanceof EvalRunService);
});
