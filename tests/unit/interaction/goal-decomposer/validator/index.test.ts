import assert from "node:assert/strict";
import test from "node:test";

import { validateGoalDecomposition } from "../../../../src/interaction/goal-decomposer/validator/index.js";
import type { GoalDecomposition } from "../../../../src/interaction/goal-decomposer/index.js";

const makeGoalDecomposition = (overrides: Partial<GoalDecomposition> = {}): GoalDecomposition => ({
  goalId: "goal:test",
  tasks: [],
  dependencyGraph: [],
  estimatedDuration: "1d",
  estimatedCost: { estimatedCostUsd: 0.05, confidence: "default", sampleCount: 0, divisionId: null, basedOn: "default" },
  riskSummary: { overallRisk: "low", riskFactors: [], reversible: true, sideEffects: [], approvalNeeded: false },
  decompositionConfidence: 0.8,
  requiresHumanReview: false,
  depthUsed: 1,
  maxDepthReached: false,
  ...overrides,
});

test("validateGoalDecomposition returns empty array for valid decomposition", () => {
  const decomposition = makeGoalDecomposition({
    tasks: [
      {
        taskId: "task1",
        domainId: "d1",
        description: "Task 1",
        inputs: {},
        expectedOutputs: ["out1"],
        delegationMode: "auto",
        estimatedDuration: "1h",
        estimatedCost: { estimatedCostUsd: 0.01, confidence: "default", sampleCount: 0, divisionId: null, basedOn: "default" },
      },
    ],
    dependencyGraph: [],
  });

  const findings = validateGoalDecomposition(decomposition);
  assert.deepEqual(findings, []);
});

test("validateGoalDecomposition reports empty_tasks when tasks array is empty", () => {
  const decomposition = makeGoalDecomposition({
    tasks: [],
  });

  const findings = validateGoalDecomposition(decomposition);
  assert.ok(findings.includes("goal_decomposition.empty_tasks"));
});

test("validateGoalDecomposition reports invalid_confidence when below 0", () => {
  const decomposition = makeGoalDecomposition({
    decompositionConfidence: -0.1,
  });

  const findings = validateGoalDecomposition(decomposition);
  assert.ok(findings.includes("goal_decomposition.invalid_confidence"));
});

test("validateGoalDecomposition reports invalid_confidence when above 1", () => {
  const decomposition = makeGoalDecomposition({
    decompositionConfidence: 1.5,
  });

  const findings = validateGoalDecomposition(decomposition);
  assert.ok(findings.includes("goal_decomposition.invalid_confidence"));
});

test("validateGoalDecomposition reports invalid_depends_on for non-existent task", () => {
  const decomposition = makeGoalDecomposition({
    tasks: [
      {
        taskId: "task1",
        domainId: "d1",
        description: "Task 1",
        inputs: {},
        expectedOutputs: ["out1"],
        delegationMode: "auto",
        estimatedDuration: "1h",
        estimatedCost: { estimatedCostUsd: 0.01, confidence: "default", sampleCount: 0, divisionId: null, basedOn: "default" },
        dependsOn: ["nonexistent"],
      },
    ],
  });

  const findings = validateGoalDecomposition(decomposition);
  assert.ok(findings.some((f) => f.includes("invalid_depends_on") && f.includes("nonexistent")));
});

test("validateGoalDecomposition reports self_dependency when task depends on itself", () => {
  const decomposition = makeGoalDecomposition({
    tasks: [
      {
        taskId: "task1",
        domainId: "d1",
        description: "Task 1",
        inputs: {},
        expectedOutputs: ["out1"],
        delegationMode: "auto",
        estimatedDuration: "1h",
        estimatedCost: { estimatedCostUsd: 0.01, confidence: "default", sampleCount: 0, divisionId: null, basedOn: "default" },
        dependsOn: ["task1"],
      },
    ],
  });

  const findings = validateGoalDecomposition(decomposition);
  assert.ok(findings.some((f) => f.includes("self_dependency")));
});

test("validateGoalDecomposition reports cycle_detected when cycle exists in graph", () => {
  const decomposition = makeGoalDecomposition({
    tasks: [
      {
        taskId: "task1",
        domainId: "d1",
        description: "Task 1",
        inputs: {},
        expectedOutputs: ["out1"],
        delegationMode: "auto",
        estimatedDuration: "1h",
        estimatedCost: { estimatedCostUsd: 0.01, confidence: "default", sampleCount: 0, divisionId: null, basedOn: "default" },
      },
      {
        taskId: "task2",
        domainId: "d1",
        description: "Task 2",
        inputs: {},
        expectedOutputs: ["out2"],
        delegationMode: "auto",
        estimatedDuration: "1h",
        estimatedCost: { estimatedCostUsd: 0.01, confidence: "default", sampleCount: 0, divisionId: null, basedOn: "default" },
      },
    ],
    dependencyGraph: [
      { fromTask: "task1", toTask: "task2", type: "blocks" },
      { fromTask: "task2", toTask: "task1", type: "blocks" },
    ],
  });

  const findings = validateGoalDecomposition(decomposition);
  assert.ok(findings.includes("goal_decomposition.cycle_detected"));
});

test("validateGoalDecomposition reports max_depth_reached when flag is set", () => {
  const decomposition = makeGoalDecomposition({
    maxDepthReached: true,
  });

  const findings = validateGoalDecomposition(decomposition);
  assert.ok(findings.includes("goal_decomposition.max_depth_reached"));
});

test("validateGoalDecomposition returns multiple findings", () => {
  const decomposition = makeGoalDecomposition({
    tasks: [],
    decompositionConfidence: 1.5,
    maxDepthReached: true,
  });

  const findings = validateGoalDecomposition(decomposition);
  assert.ok(findings.includes("goal_decomposition.empty_tasks"));
  assert.ok(findings.includes("goal_decomposition.invalid_confidence"));
  assert.ok(findings.includes("goal_decomposition.max_depth_reached"));
});

test("validateGoalDecomposition accepts valid confidence boundaries", () => {
  const decomposition0 = makeGoalDecomposition({ decompositionConfidence: 0 });
  const decomposition1 = makeGoalDecomposition({ decompositionConfidence: 1 });

  assert.deepEqual(validateGoalDecomposition(decomposition0), []);
  assert.deepEqual(validateGoalDecomposition(decomposition1), []);
});
