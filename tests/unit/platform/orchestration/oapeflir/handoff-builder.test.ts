import test from "node:test";
import assert from "node:assert/strict";

import { buildFromStepResults, type HandoffBuilderInput } from "../../../../../src/platform/five-plane-orchestration/oapeflir/handoff-builder.js";

function makeStepOutput(stepId: string, summary: string, durationMs: number, validationPassed = true) {
  return {
    stepId,
    planRef: "plan_test",
    userFacingResult: {
      summary,
      artifacts: [`artifact:${stepId}`],
    },
    systemTelemetry: {
      durationMs,
      tokensUsed: 100,
      modelId: "test-model",
      retryCount: 0,
      validationPassed,
    },
  };
}

function makeInput(overrides: Partial<HandoffBuilderInput> = {}): HandoffBuilderInput {
  return {
    taskId: "task_test",
    fromAgentId: "agent_primary",
    toAgentId: "agent_secondary",
    currentPhase: "execute",
    blockers: [],
    remainingBudgetUsd: 0.05,
    latestSummary: "Completed step 1",
    completedSteps: [
      {
        stepId: "step_1",
        action: "file_read",
        status: "done",
        inputs: {},
        dependencies: [],
        timeout: 1000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
    ],
    stepOutputs: [makeStepOutput("step_1", "Read file foo.ts", 50)],
    primaryRefs: ["artifact:step_1"],
    addedSteps: [],
    removedSteps: [],
    changedSteps: [],
    ...overrides,
  };
}

test("buildFromStepResults creates AgentHandoff with correct handoffId prefix", () => {
  const handoff = buildFromStepResults(makeInput());
  assert.ok(handoff.handoffId.startsWith("handoff_"), `Expected handoff_ prefix, got: ${handoff.handoffId}`);
  assert.ok(handoff.createdAt.length > 0);
});

test("buildFromStepResults maps factLayer.artifactRefs from primaryRefs", () => {
  const handoff = buildFromStepResults(makeInput({ primaryRefs: ["artifact:foo", "artifact:bar"] }));
  assert.deepEqual(handoff.fact.artifactRefs, ["artifact:foo", "artifact:bar"]);
});

test("buildFromStepResults extracts toolCallRecords for steps with durationMs > 0", () => {
  const handoff = buildFromStepResults(makeInput({
    stepOutputs: [
      makeStepOutput("step_read", "Read file foo.ts", 50),
      makeStepOutput("step_write", "Write file bar.ts", 30),
    ],
    primaryRefs: [],
  }));

  assert.equal(handoff.fact.toolCallRecords.length, 2);
  assert.equal(handoff.fact.toolCallRecords[0]!.toolName, "file_read");
  assert.equal(handoff.fact.toolCallRecords[0]!.success, true);
  assert.equal(handoff.fact.toolCallRecords[0]!.durationMs, 50);
});

test("buildFromStepResults infers toolName from summary keywords", () => {
  const testCases = [
    { summary: "Searched for pattern in codebase", expected: "code_search" },
    { summary: "Read file config.json", expected: "file_read" },
    { summary: "Write edits to module.ts", expected: "file_write" },
    { summary: "Bash command completed", expected: "bash" },
    { summary: "Git status shows clean working tree", expected: "git" },
    { summary: "Did something unspecified", expected: "unknown" },
  ];

  for (const { summary, expected } of testCases) {
    const handoff = buildFromStepResults(makeInput({
      stepOutputs: [makeStepOutput("step", summary, 10)],
      primaryRefs: [],
    }));
    assert.equal(handoff.fact.toolCallRecords[0]!.toolName, expected, `Summary: "${summary}"`);
  }
});

test("buildFromStepResults marks toolCallRecord as failed when validationPassed is false", () => {
  const handoff = buildFromStepResults(makeInput({
    stepOutputs: [makeStepOutput("step_fail", "Write file bar.ts", 20, false)],
    primaryRefs: [],
  }));
  assert.equal(handoff.fact.toolCallRecords[0]!.success, false);
});

test("buildFromStepResults skips toolCallRecords for steps with durationMs === 0", () => {
  const handoff = buildFromStepResults(makeInput({
    stepOutputs: [makeStepOutput("step_zero", "Instant step", 0)],
    primaryRefs: [],
  }));
  assert.equal(handoff.fact.toolCallRecords.length, 0);
});

test("buildFromStepResults builds stateLayer with currentPhase blockers budget summary", () => {
  const handoff = buildFromStepResults(makeInput({
    currentPhase: "plan",
    blockers: ["no_file_access", "rate_limit"],
    remainingBudgetUsd: 0.02,
    latestSummary: "Plan created successfully",
  }));

  assert.equal(handoff.state.currentPhase, "plan");
  assert.deepEqual(handoff.state.blockers, ["no_file_access", "rate_limit"]);
  assert.equal(handoff.state.remainingBudgetUsd, 0.02);
  assert.equal(handoff.state.latestSummary, "Plan created successfully");
});

test("buildFromStepResults builds planDelta with addedSteps removedSteps changedSteps", () => {
  const handoff = buildFromStepResults(makeInput({
    addedSteps: ["step_new_1", "step_new_2"],
    removedSteps: ["step_skipped"],
    changedSteps: [{ stepId: "step_altered", reason: "intent changed" }],
  }));

  assert.deepEqual(handoff.planDelta.addedSteps, ["step_new_1", "step_new_2"]);
  assert.deepEqual(handoff.planDelta.removedSteps, ["step_skipped"]);
  assert.deepEqual(handoff.planDelta.changedSteps, [{ stepId: "step_altered", reason: "intent changed" }]);
});

test("buildFromStepResults defaults addedSteps/removedSteps/changedSteps to empty arrays when omitted", () => {
  // Build an input without addedSteps/removedSteps/changedSteps fields
  const minimal: HandoffBuilderInput = {
    taskId: "task_test",
    fromAgentId: "agent_primary",
    toAgentId: "agent_secondary",
    currentPhase: "execute",
    blockers: [],
    remainingBudgetUsd: 0.05,
    latestSummary: "summary",
    completedSteps: [],
    stepOutputs: [],
    primaryRefs: [],
  };
  const handoff = buildFromStepResults(minimal);

  assert.deepEqual(handoff.planDelta.addedSteps, []);
  assert.deepEqual(handoff.planDelta.removedSteps, []);
  assert.deepEqual(handoff.planDelta.changedSteps, []);
});

test("buildFromStepResults copies taskId and agentIds to handoff", () => {
  const handoff = buildFromStepResults(makeInput({
    taskId: "task_custom",
    fromAgentId: "agent_a",
    toAgentId: "agent_b",
  }));

  assert.equal(handoff.taskId, "task_custom");
  assert.equal(handoff.fromAgentId, "agent_a");
  assert.equal(handoff.toAgentId, "agent_b");
});

test("buildFromStepResults handles empty primaryRefs", () => {
  const handoff = buildFromStepResults(makeInput({ primaryRefs: [] }));
  assert.deepEqual(handoff.fact.artifactRefs, []);
});

test("buildFromStepResults handles null remainingBudgetUsd", () => {
  const handoff = buildFromStepResults(makeInput({ remainingBudgetUsd: null }));
  assert.equal(handoff.state.remainingBudgetUsd, null);
});
