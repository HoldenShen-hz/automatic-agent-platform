import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopService } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.js";
import { createStageTransitionFSM } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/stage-transition-fsm.js";
import { MockExecuteBridge } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.js";
import type { ConstraintPack } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/harness/index.js";
import type { PlannedWorkflow } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/routing/workflow-planner.js";

function makeConstraintPack(): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "semi_auto",
    tool_policy: { allowedTools: ["read_file", "write_file"] },
    risk_policy: { maxRiskScore: 0.8, escalationThreshold: 0.7 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 3, maxCost: 0.25, maxDurationMs: 15000 },
  };
}

test("integration: OapeflirLoopService can be instantiated with MockExecuteBridge", () => {
  const bridge = new MockExecuteBridge();
  const service = new OapeflirLoopService({ executeBridge: bridge });

  assert.ok(service !== null);
});

test("integration: OapeflirLoopService can be instantiated without executeBridge", () => {
  const service = new OapeflirLoopService({});

  assert.ok(service !== null);
});

test("integration: OapeflirLoopService accepts dbPath option", () => {
  const service = new OapeflirLoopService({ dbPath: ":memory:" });

  assert.ok(service !== null);
});

test("integration: createStageTransitionFSM creates functional FSM", () => {
  const fsm = createStageTransitionFSM();

  assert.equal(fsm.getCurrentStage(), "observe");
  assert.equal(fsm.canTransitionTo("assess").allowed, false);

  fsm.recordStageEntry("observe");
  fsm.recordStageCompletion("observe");

  assert.equal(fsm.canTransitionTo("assess").allowed, true);
});

test("integration: StageTransitionFSM completes full observe→release cycle", () => {
  const fsm = createStageTransitionFSM();

  fsm.recordStageEntry("observe");
  fsm.recordStageCompletion("observe");

  fsm.recordStageEntry("assess");
  fsm.recordStageCompletion("assess");

  fsm.recordStageEntry("plan");
  fsm.recordStageCompletion("plan");

  fsm.recordStageEntry("execute");
  fsm.recordStageCompletion("execute");

  fsm.recordStageEntry("feedback");
  fsm.recordStageCompletion("feedback");

  fsm.recordStageEntry("learn");
  fsm.recordStageCompletion("learn");

  fsm.recordStageEntry("improve");
  fsm.recordStageCompletion("improve");

  fsm.recordStageEntry("release");
  fsm.recordStageCompletion("release");

  assert.equal(fsm.isComplete(), true);
  assert.equal(fsm.getNextStage(), null);
});

test("integration: StageTransitionFSM getExecutionSummary returns all stages", () => {
  const fsm = createStageTransitionFSM();
  const summary = fsm.getExecutionSummary();

  assert.equal(Object.keys(summary).length, 8);
  assert.equal(summary.observe.status, "pending");
  assert.equal(summary.release.status, "pending");
});

test("integration: StageTransitionFSM recordStageSkipped advances without completing", () => {
  const fsm = createStageTransitionFSM();

  fsm.recordStageEntry("observe");
  fsm.recordStageCompletion("observe");

  fsm.recordStageEntry("assess");
  fsm.recordStageSkipped("assess", "test.skip");

  assert.equal(fsm.getCurrentStage(), "plan");
  assert.equal(fsm.getStageStatus("assess"), "skipped");
});

test("integration: StageTransitionFSM recordStageError marks error", () => {
  const fsm = createStageTransitionFSM();

  fsm.recordStageEntry("observe");
  fsm.recordStageError("observe");

  assert.equal(fsm.getStageStatus("observe"), "error");
});

test("integration: StageTransitionFSM reset restores initial state", () => {
  const fsm = createStageTransitionFSM();

  fsm.recordStageEntry("observe");
  fsm.recordStageCompletion("observe");
  fsm.recordStageEntry("assess");
  fsm.recordStageCompletion("assess");

  fsm.reset();

  assert.equal(fsm.getCurrentStage(), "observe");
  assert.equal(fsm.getStageStatus("observe"), "pending");
  assert.equal(fsm.getStageStatus("assess"), "pending");
});

test("integration: StageTransitionFSM allows backward transition feedback->plan", () => {
  const fsm = createStageTransitionFSM();

  fsm.recordStageEntry("observe");
  fsm.recordStageCompletion("observe");

  fsm.recordStageEntry("assess");
  fsm.recordStageCompletion("assess");

  fsm.recordStageEntry("plan");
  fsm.recordStageCompletion("plan");

  fsm.recordStageEntry("execute");
  fsm.recordStageCompletion("execute");

  fsm.recordStageEntry("feedback");
  fsm.recordStageCompletion("feedback");

  const result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, true);
});

test("integration: ConstraintPack can be created with all required fields", () => {
  const pack = makeConstraintPack();

  assert.equal(pack.approvalMode, "none");
  assert.equal(pack.autonomyMode, "semi_auto");
  assert.ok(Array.isArray(pack.tool_policy.allowedTools));
  assert.equal(typeof pack.risk_policy?.maxRiskScore, "number");
  assert.equal(typeof pack.budget?.maxSteps, "number");
});

test("integration: MockExecuteBridge can be instantiated", () => {
  const bridge = new MockExecuteBridge();

  assert.ok(bridge !== null);
});
