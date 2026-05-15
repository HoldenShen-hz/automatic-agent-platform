import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { HARNESS_PLANNER_ROLE } from "../../../../../src/platform/five-plane-orchestration/harness/planner/index.js";
import { HARNESS_GENERATOR_ROLE } from "../../../../../src/platform/five-plane-orchestration/harness/generator/index.js";
import { HARNESS_EVALUATOR_ROLE } from "../../../../../src/platform/five-plane-orchestration/harness/evaluator/index.js";
import { HarnessLoopController } from "../../../../../src/platform/five-plane-orchestration/harness/loop/index.js";
import { HarnessRuntimeService } from "../../../../../src/platform/five-plane-orchestration/harness/runtime/index.js";
import { ContextAssembler } from "../../../../../src/platform/five-plane-orchestration/harness/context/index.js";
import { HarnessMemoryManager } from "../../../../../src/platform/five-plane-orchestration/harness/memory-namespace/index.js";
import { ToolbeltAssembler } from "../../../../../src/platform/five-plane-orchestration/harness/toolbelt/index.js";
import { HitlRuntime } from "../../../../../src/platform/five-plane-orchestration/harness/hitl-runtime/index.js";
import { DurableHarnessService } from "../../../../../src/platform/five-plane-orchestration/harness/durable/index.js";
import { EvalRunService } from "../../../../../src/platform/five-plane-orchestration/harness/eval-harness/index.js";

test("harness canonical implementation path matches §35", () => {
  assert.equal(existsSync(join(process.cwd(), "src/platform/five-plane-orchestration/harness")), true);
  assert.equal(existsSync(join(process.cwd(), "src/platform/harness")), false);
});

test("harness canonical subdirectories expose runtime-aligned entrypoints", () => {
  assert.equal(HARNESS_PLANNER_ROLE, "planner");
  assert.equal(HARNESS_GENERATOR_ROLE, "generator");
  assert.equal(HARNESS_EVALUATOR_ROLE, "evaluator");

  assert.ok(new HarnessRuntimeService() instanceof HarnessRuntimeService);
  assert.ok(new ContextAssembler() instanceof ContextAssembler);
  assert.ok(new HarnessMemoryManager() instanceof HarnessMemoryManager);
  assert.ok(new ToolbeltAssembler() instanceof ToolbeltAssembler);
  assert.ok(new HarnessLoopController({
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "manual",
    toolPolicy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 9, maxCost: 1, maxDurationMs: 60_000 },
  }) instanceof HarnessLoopController);
  assert.ok(new HitlRuntime() instanceof HitlRuntime);
  assert.ok(new DurableHarnessService() instanceof DurableHarnessService);
  assert.ok(new EvalRunService() instanceof EvalRunService);
});
