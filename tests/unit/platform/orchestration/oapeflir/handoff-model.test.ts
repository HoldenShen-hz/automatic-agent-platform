import test from "node:test";
import assert from "node:assert/strict";

import { compactAgentHandoff, createAgentHandoff } from "../../../../../src/platform/five-plane-orchestration/oapeflir/handoff-model.js";

test("compactAgentHandoff trims lower-priority layers first", () => {
  const handoff = createAgentHandoff({
    taskId: "task_1",
    fromAgentId: "agent_a",
    toAgentId: "agent_b",
    fact: {
      artifactRefs: Array.from({ length: 10 }, (_, index) => `artifact:${index}`),
      toolCallRecords: Array.from({ length: 10 }, (_, index) => ({
        callId: `call_${index}`,
        toolName: `tool_${index}`,
        inputArgs: {},
        rawOutput: "",
        parsedOutput: null,
        success: true,
        errorCode: null,
        errorMessage: null,
        durationMs: 100,
        tokenUsage: { input: 0, output: 0 },
        sandboxViolation: false,
        retryAttempt: 0,
        outputRef: `artifact:${index}`,
      })),
    },
    state: {
      currentPhase: "planning",
      blockers: ["one", "two", "three", "four"],
      remainingBudgetUsd: 1.2,
      latestSummary: "x".repeat(1000),
    },
    planDelta: {
      addedSteps: ["s1", "s2"],
      removedSteps: ["s3"],
      changedSteps: [{ stepId: "s4", reason: "retry" }],
    },
    primaryRefs: Array.from({ length: 5 }, (_, index) => `artifact:${index}`),
  });

  const compacted = compactAgentHandoff(handoff, { totalMaxTokens: 80 });
  assert.equal(compacted.fact.toolCallRecords.length, 0);
  assert.ok(compacted.primaryRefs.length <= 3);
});

test("compactAgentHandoff preserves primary refs when budget allows", () => {
  const handoff = createAgentHandoff({
    taskId: "task_2",
    fromAgentId: "agent_a",
    toAgentId: "agent_b",
    fact: {
      artifactRefs: ["artifact:0", "artifact:1"],
      toolCallRecords: [],
    },
    state: {
      currentPhase: "execution",
      blockers: [],
      remainingBudgetUsd: 0.5,
      latestSummary: "short summary",
    },
    planDelta: { addedSteps: [], removedSteps: [], changedSteps: [] },
    primaryRefs: ["artifact:0", "artifact:1"],
  });

  const compacted = compactAgentHandoff(handoff, { totalMaxTokens: 1000 });
  assert.equal(compacted.primaryRefs.length, 2);
  assert.equal(compacted.state.blockers.length, 0);
});

test("compactAgentHandoff returns after clearing toolCallRecords when size fits", () => {
  const handoff = createAgentHandoff({
    taskId: "task_5",
    fromAgentId: "agent_a",
    toAgentId: "agent_b",
    fact: {
      // Large enough to exceed budget, but toolCallRecords can be cleared to fit
      artifactRefs: ["artifact:0"],
      toolCallRecords: [
        {
          callId: "call_1",
          toolName: "tool_with_very_long_name",
          inputArgs: { param1: "value1", param2: "value2", param3: "value3" },
          rawOutput: "This is a moderately long output string that takes up space",
          parsedOutput: null,
          success: true,
          errorCode: null,
          errorMessage: null,
          durationMs: 100,
          tokenUsage: { input: 50, output: 100 },
          sandboxViolation: false,
          retryAttempt: 0,
          outputRef: "artifact:0",
        },
      ],
    },
    state: {
      currentPhase: "planning",
      blockers: [],
      remainingBudgetUsd: 0.5,
      latestSummary: "short",
    },
    planDelta: { addedSteps: [], removedSteps: [], changedSteps: [] },
    primaryRefs: ["artifact:0"],
  });

  // Budget is large enough to fit after clearing toolCallRecords
  // This should exercise the second budget check and return early
  const compacted = compactAgentHandoff(handoff, { totalMaxTokens: 200 });

  // toolCallRecords should be cleared to fit in budget
  assert.equal(compacted.fact.toolCallRecords.length, 0);
  // other fields preserved
  assert.equal(compacted.state.currentPhase, "planning");
});

test("compactAgentHandoff returns after trimming planDelta when size fits", () => {
  const handoff = createAgentHandoff({
    taskId: "task_6",
    fromAgentId: "agent_a",
    toAgentId: "agent_b",
    fact: {
      artifactRefs: [],
      toolCallRecords: [],
    },
    state: {
      currentPhase: "planning",
      blockers: [],
      remainingBudgetUsd: 0.5,
      latestSummary: "",
    },
    planDelta: {
      addedSteps: [],
      // Very long removed step that makes handoff exceed budget
      removedSteps: ["step_removed_step_that_is_quite_long_and_needs_trimming"],
      changedSteps: [],
    },
    primaryRefs: [],
  });

  // Small budget - needs planDelta trimming to fit
  // Initial size exceeds budget, but trimming removedSteps brings it under
  const compacted = compactAgentHandoff(handoff, { totalMaxTokens: 50 });

  // After compacting, removedSteps should be cleared because trimming was needed
  // If this fails, it means the initial size was already under budget
  assert.deepEqual(compacted.planDelta.removedSteps, []);
});

test("compactAgentHandoff trims blockers when budget is very small", () => {
  const handoff = createAgentHandoff({
    taskId: "task_4",
    fromAgentId: "agent_a",
    toAgentId: "agent_b",
    fact: {
      artifactRefs: ["artifact:0"],
      toolCallRecords: [],
    },
    state: {
      currentPhase: "planning",
      blockers: ["blocker1", "blocker2", "blocker3", "blocker4", "blocker5", "blocker6"],
      remainingBudgetUsd: 0.1,
      latestSummary: "some summary",
    },
    planDelta: { addedSteps: [], removedSteps: [], changedSteps: [] },
    primaryRefs: ["artifact:0"],
  });

  const compacted = compactAgentHandoff(handoff, { totalMaxTokens: 20 });
  assert.ok(compacted.state.blockers.length < handoff.state.blockers.length);
});
