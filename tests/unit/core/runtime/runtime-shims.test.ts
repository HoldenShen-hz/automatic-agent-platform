import assert from "node:assert/strict";
import test from "node:test";

import * as canonicalOrchestrator from "../../../../src/platform/execution/execution-engine/multi-step-orchestration.js";
import * as canonicalPlanner from "../../../../src/platform/execution/execution-engine/multi-step-agent-round-loop.js";
import * as canonicalSupervisor from "../../../../src/platform/execution/execution-engine/multi-step-supervisor.js";
import * as canonicalUtils from "../../../../src/platform/execution/execution-engine/multi-step-utils.js";
import * as shimOrchestrator from "../../../../src/core/runtime/orchestrator/index.js";
import * as shimPlanner from "../../../../src/core/runtime/planner/index.js";
import * as shimSupervisor from "../../../../src/core/runtime/supervisor/index.js";

test("core/runtime orchestrator shim re-exports canonical platform implementation", () => {
  assert.equal(shimOrchestrator.runMultiStepOrchestration, canonicalOrchestrator.runMultiStepOrchestration);
  assert.equal(shimOrchestrator.executeMultiStepToolCallForTests, canonicalOrchestrator.executeMultiStepToolCallForTests);
});

test("core/runtime planner shim re-exports canonical platform helpers", () => {
  assert.equal(shimPlanner.executeAgentRoundLoop, canonicalPlanner.executeAgentRoundLoop);
  assert.equal(shimPlanner.buildStepOutput, canonicalPlanner.buildStepOutput);
  assert.equal(shimPlanner.resolveMultiStepToolPath, canonicalUtils.resolveMultiStepToolPath);
});

test("core/runtime supervisor shim re-exports canonical platform implementation", () => {
  assert.equal(shimSupervisor.executeStepLoop, canonicalSupervisor.executeStepLoop);
  assert.equal(shimSupervisor.buildStepFailureSummary, canonicalSupervisor.buildStepFailureSummary);
});
