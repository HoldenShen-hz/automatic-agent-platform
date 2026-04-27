import assert from "node:assert/strict";
import test from "node:test";

import { validateGoalDecomposition } from "../../../../../src/interaction/goal-decomposer/validator/index.js";
import type { GoalDecomposition, PlannedTask, TaskDependency } from "../../../../../src/interaction/goal-decomposer/index.js";

function makeTask(overrides: Partial<PlannedTask> = {}): PlannedTask {
  return {
    taskId: "task-1",
    domainId: "domain-a",
    description: "Test task",
    inputs: {},
    expectedOutputs: ["output"],
    delegationMode: "auto",
    estimatedDuration: "1h",
    estimatedCost: { estimatedCostUsd: 0.1, confidence: "low", sampleCount: 1, divisionId: null, basedOn: "default" },
    ...overrides,
  };
}

function makeDependency(overrides: Partial<TaskDependency> = {}): TaskDependency {
  return {
    fromTask: "task-1",
    toTask: "task-2",
    type: "blocks",
    ...overrides,
  };
}

function makeDecomposition(overrides: Partial<GoalDecomposition> = {}): GoalDecomposition {
  return {
    goalId: "goal-1",
    tasks: [makeTask({ taskId: "task-1" }), makeTask({ taskId: "task-2" })],
    dependencyGraph: [makeDependency({ fromTask: "task-1", toTask: "task-2" })],
    estimatedDuration: "2h",
    estimatedCost: { estimatedCostUsd: 0.2, confidence: "low", sampleCount: 2, divisionId: null, basedOn: "default" },
    riskSummary: { overallRisk: "low", riskFactors: [], reversible: true, sideEffects: [], approvalNeeded: false },
    decompositionConfidence: 0.8,
    requiresHumanReview: false,
    depthUsed: 1,
    maxDepthReached: false,
    ...overrides,
  };
}

test("validateGoalDecomposition returns empty array for valid decomposition", () => {
  const decomposition = makeDecomposition();

  const findings = validateGoalDecomposition(decomposition);

  assert.equal(findings.length, 0);
});

test("validateGoalDecomposition detects empty tasks", () => {
  const decomposition = makeDecomposition({ tasks: [] });

  const findings = validateGoalDecomposition(decomposition);

  assert.ok(findings.some(f => f.includes("empty_tasks")));
});

test("validateGoalDecomposition detects invalid confidence below range", () => {
  const decomposition = makeDecomposition({ decompositionConfidence: -0.1 });

  const findings = validateGoalDecomposition(decomposition);

  assert.ok(findings.some(f => f.includes("invalid_confidence")));
});

test("validateGoalDecomposition detects invalid confidence above range", () => {
  const decomposition = makeDecomposition({ decompositionConfidence: 1.5 });

  const findings = validateGoalDecomposition(decomposition);

  assert.ok(findings.some(f => f.includes("invalid_confidence")));
});

test("validateGoalDecomposition detects non-existent dependsOn reference", () => {
  const decomposition = makeDecomposition({
    tasks: [makeTask({ taskId: "task-1", dependsOn: ["non-existent-task"] })],
  });

  const findings = validateGoalDecomposition(decomposition);

  assert.ok(findings.some(f => f.includes("invalid_depends_on")));
});

test("validateGoalDecomposition detects self dependency", () => {
  const decomposition = makeDecomposition({
    tasks: [makeTask({ taskId: "task-1", dependsOn: ["task-1"] })],
  });

  const findings = validateGoalDecomposition(decomposition);

  assert.ok(findings.some(f => f.includes("self_dependency")));
});

test("validateGoalDecomposition detects cycle in dependency graph", () => {
  const decomposition = makeDecomposition({
    tasks: [
      makeTask({ taskId: "task-1" }),
      makeTask({ taskId: "task-2" }),
      makeTask({ taskId: "task-3" }),
    ],
    dependencyGraph: [
      makeDependency({ fromTask: "task-1", toTask: "task-2" }),
      makeDependency({ fromTask: "task-2", toTask: "task-3" }),
      makeDependency({ fromTask: "task-3", toTask: "task-1" }), // creates cycle
    ],
  });

  const findings = validateGoalDecomposition(decomposition);

  assert.ok(findings.some(f => f.includes("cycle_detected")));
});

test("validateGoalDecomposition warns when maxDepthReached is true", () => {
  const decomposition = makeDecomposition({ maxDepthReached: true });

  const findings = validateGoalDecomposition(decomposition);

  assert.ok(findings.some(f => f.includes("max_depth_reached")));
});

test("validateGoalDecomposition returns no findings for valid confidence 0", () => {
  const decomposition = makeDecomposition({ decompositionConfidence: 0 });

  const findings = validateGoalDecomposition(decomposition);

  assert.ok(!findings.some(f => f.includes("invalid_confidence")));
});

test("validateGoalDecomposition returns no findings for valid confidence 1", () => {
  const decomposition = makeDecomposition({ decompositionConfidence: 1 });

  const findings = validateGoalDecomposition(decomposition);

  assert.ok(!findings.some(f => f.includes("invalid_confidence")));
});

test("validateGoalDecomposition handles task with no dependsOn", () => {
  const decomposition = makeDecomposition({
    tasks: [makeTask({ taskId: "t1", dependsOn: undefined })],
    dependencyGraph: [],
  });

  const findings = validateGoalDecomposition(decomposition);

  assert.equal(findings.length, 0);
});

test("validateGoalDecomposition handles task with empty dependsOn array", () => {
  const decomposition = makeDecomposition({
    tasks: [makeTask({ taskId: "t1", dependsOn: [] })],
    dependencyGraph: [],
  });

  const findings = validateGoalDecomposition(decomposition);

  assert.equal(findings.length, 0);
});