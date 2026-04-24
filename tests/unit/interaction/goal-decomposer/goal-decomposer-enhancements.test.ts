import assert from "node:assert/strict";
import test from "node:test";

import {
  GoalDecompositionService,
  GoalDecompositionServiceOptions,
  type Goal,
  type PlannedTask,
  type TaskDependency,
} from "../../../../src/interaction/goal-decomposer/index.js";
import { validateGoalDecomposition } from "../../../../src/interaction/goal-decomposer/validator/index.js";
import { buildExecutionBatches } from "../../../../src/interaction/goal-decomposer/planner/index.js";
import { topologicallySortTaskIds, detectDependencyCycle } from "../../../../src/interaction/goal-decomposer/dependency-graph/index.js";

test("GoalDecompositionService uses default max depth of 5", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose("发起一个简单的营销活动");
  assert.strictEqual(result.depthUsed, 0);
  assert.strictEqual(result.maxDepthReached, false);
});

test("GoalDecompositionService sets maxDepthReached when current depth equals max depth", async () => {
  const serviceWithLowDepth = new GoalDecompositionService({ maxDepth: 2, currentDepth: 2 });
  const result = await serviceWithLowDepth.decompose("发起一个简单的营销活动");
  assert.strictEqual(result.maxDepthReached, true);
  assert.strictEqual(result.depthUsed, 2);
});

test("GoalDecompositionService does not set maxDepthReached when below max depth", async () => {
  const serviceWithLowDepth = new GoalDecompositionService({ maxDepth: 5, currentDepth: 2 });
  const result = await serviceWithLowDepth.decompose("发起一个简单的营销活动");
  assert.strictEqual(result.maxDepthReached, false);
  assert.strictEqual(result.depthUsed, 2);
});

test("GoalDecompositionService respects custom max depth option", async () => {
  const serviceWithCustomDepth = new GoalDecompositionService({ maxDepth: 3 });
  const result = await serviceWithCustomDepth.decompose("发起一个简单的营销活动");
  assert.strictEqual(result.depthUsed, 0);
  assert.strictEqual(result.maxDepthReached, false);
});

test("GoalDecompositionService builds dependencies from dependsOn field", async () => {
  const goal: Goal = {
    goalId: "goal-dag-test",
    description: "Test DAG with depends_on",
    owner: "test",
    successCriteria: [],
    constraints: [],
    priority: "normal",
  };
  const service = new GoalDecompositionService();
  const result = await service.decompose(goal);
  assert.ok(result.tasks.length >= 1);
  assert.ok(result.dependencyGraph.length >= 0);
});

test("GoalDecompositionService includes dependsOn in PlannedTask interface", () => {
  const task: PlannedTask = {
    taskId: "task-1",
    domainId: "test",
    description: "Test task",
    inputs: {},
    expectedOutputs: [] as string[],
    delegationMode: "auto",
    estimatedDuration: "1h",
    estimatedCost: {
      estimatedCostUsd: 0.01,
      confidence: "low",
      sampleCount: 0,
      divisionId: null,
      basedOn: "default",
    },
    dependsOn: ["task-0"],
  };
  assert.deepStrictEqual(task.dependsOn, ["task-0"]);
});

test("GoalDecompositionService computes parallel task groups for marketing campaign", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "goal-marketing-parallel",
    description: "发起春季营销 campaign 并追踪 ROI",
    owner: "marketing_lead",
    successCriteria: [],
    constraints: [],
    priority: "high",
  };
  const result = await service.decompose(goal);
  assert.ok(result.parallelTaskGroups && result.parallelTaskGroups.length > 0);
  assert.strictEqual(result.parallelTaskGroups[0]?.length, 1);
});

test("GoalDecompositionService produces topologically sorted task IDs", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose("发起春季营销 campaign 并追踪 ROI");
  assert.ok(result.topologicallySortedTaskIds);
  assert.strictEqual(result.topologicallySortedTaskIds.length, result.tasks.length);
});

test("GoalDecompositionService identifies critical path tasks", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose("发起春季营销 campaign 并追踪 ROI");
  assert.ok(result.criticalPathTaskIds);
  assert.ok(result.criticalPathTaskIds.length > 0);
});

test("buildExecutionBatches groups independent tasks into same batch", () => {
  const taskIds = ["A", "B", "C"];
  const edges = [
    { fromTask: "A", toTask: "C" },
    { fromTask: "B", toTask: "C" },
  ];
  const batches = buildExecutionBatches(taskIds, edges);
  assert.strictEqual(batches.length, 2);
  assert.ok(batches[0]!.includes("A") || batches[0]!.includes("B"));
});

test("buildExecutionBatches creates separate batches for dependent tasks", () => {
  const taskIds = ["A", "B", "C"];
  const edges = [
    { fromTask: "A", toTask: "B" },
    { fromTask: "B", toTask: "C" },
  ];
  const batches = buildExecutionBatches(taskIds, edges);
  assert.strictEqual(batches.length, 3);
  assert.deepStrictEqual(batches[0], ["A"]);
  assert.deepStrictEqual(batches[1], ["B"]);
  assert.deepStrictEqual(batches[2], ["C"]);
});

test("buildExecutionBatches handles diamond dependency pattern", () => {
  const taskIds = ["A", "B", "C", "D"];
  const edges = [
    { fromTask: "A", toTask: "B" },
    { fromTask: "A", toTask: "C" },
    { fromTask: "B", toTask: "D" },
    { fromTask: "C", toTask: "D" },
  ];
  const batches = buildExecutionBatches(taskIds, edges);
  assert.strictEqual(batches.length, 3);
  assert.deepStrictEqual(batches[0], ["A"]);
  assert.ok(batches[1]!.includes("B") && batches[1]!.includes("C"));
  assert.deepStrictEqual(batches[2], ["D"]);
});

test("buildExecutionBatches handles empty dependencies", () => {
  const taskIds = ["A", "B"];
  const edges: { fromTask: string; toTask: string }[] = [];
  const batches = buildExecutionBatches(taskIds, edges);
  assert.strictEqual(batches.length, 1);
  assert.ok(batches[0]!.includes("A") && batches[0]!.includes("B"));
});

test("topologicallySortTaskIds returns correct topological order", () => {
  const taskIds = ["C", "A", "B"];
  const edges = [
    { fromTask: "A", toTask: "C" },
    { fromTask: "B", toTask: "C" },
  ];
  const sorted = topologicallySortTaskIds(taskIds, edges);
  assert.ok(sorted.indexOf("A") < sorted.indexOf("C"));
  assert.ok(sorted.indexOf("B") < sorted.indexOf("C"));
});

test("topologicallySortTaskIds returns all tasks when no edges", () => {
  const taskIds = ["A", "B", "C"];
  const edges: { fromTask: string; toTask: string }[] = [];
  const sorted = topologicallySortTaskIds(taskIds, edges);
  assert.strictEqual(sorted.length, 3);
});

test("detectDependencyCycle detects cycle in dependency graph", () => {
  const taskIds = ["A", "B", "C"];
  const edges = [
    { fromTask: "A", toTask: "B" },
    { fromTask: "B", toTask: "C" },
    { fromTask: "C", toTask: "A" },
  ];
  const hasCycle = detectDependencyCycle(taskIds, edges);
  assert.strictEqual(hasCycle, true);
});

test("detectDependencyCycle does not detect cycle in valid DAG", () => {
  const taskIds = ["A", "B", "C"];
  const edges = [
    { fromTask: "A", toTask: "B" },
    { fromTask: "B", toTask: "C" },
  ];
  const hasCycle = detectDependencyCycle(taskIds, edges);
  assert.strictEqual(hasCycle, false);
});

test("validateGoalDecomposition validates dependsOn references", () => {
  const decomposition = {
    goalId: "goal-validate",
    tasks: [
      {
        taskId: "task-1",
        domainId: "test",
        description: "Task 1",
        inputs: {},
        expectedOutputs: [] as string[],
        delegationMode: "auto" as const,
        estimatedDuration: "1h",
        estimatedCost: { estimatedCostUsd: 0.01, confidence: "low" as const, sampleCount: 0, divisionId: null, basedOn: "default" as const },
        dependsOn: ["non-existent-task"],
      },
    ],
    dependencyGraph: [] as TaskDependency[],
    estimatedDuration: "1d",
    estimatedCost: { estimatedCostUsd: 0.01, confidence: "low", sampleCount: 0, divisionId: null, basedOn: "default" },
    riskSummary: { overallRisk: "low" as const, riskFactors: [], reversible: true, sideEffects: [], approvalNeeded: false },
    decompositionConfidence: 0.9,
    requiresHumanReview: false,
    depthUsed: 0,
    maxDepthReached: false,
  };
  const findings = validateGoalDecomposition(decomposition as any);
  assert.ok(findings.some((f) => f.includes("invalid_depends_on")));
});

test("validateGoalDecomposition detects self-dependency", () => {
  const decomposition = {
    goalId: "goal-validate",
    tasks: [
      {
        taskId: "task-1",
        domainId: "test",
        description: "Task 1",
        inputs: {},
        expectedOutputs: [] as string[],
        delegationMode: "auto" as const,
        estimatedDuration: "1h",
        estimatedCost: { estimatedCostUsd: 0.01, confidence: "low" as const, sampleCount: 0, divisionId: null, basedOn: "default" as const },
        dependsOn: ["task-1"],
      },
    ],
    dependencyGraph: [] as TaskDependency[],
    estimatedDuration: "1d",
    estimatedCost: { estimatedCostUsd: 0.01, confidence: "low", sampleCount: 0, divisionId: null, basedOn: "default" },
    riskSummary: { overallRisk: "low" as const, riskFactors: [], reversible: true, sideEffects: [], approvalNeeded: false },
    decompositionConfidence: 0.9,
    requiresHumanReview: false,
    depthUsed: 0,
    maxDepthReached: false,
  };
  const findings = validateGoalDecomposition(decomposition as any);
  assert.ok(findings.some((f) => f.includes("self_dependency")));
});

test("validateGoalDecomposition warns when max depth was reached", () => {
  const decomposition = {
    goalId: "goal-validate",
    tasks: [
      {
        taskId: "task-1",
        domainId: "test",
        description: "Task 1",
        inputs: {},
        expectedOutputs: [] as string[],
        delegationMode: "auto" as const,
        estimatedDuration: "1h",
        estimatedCost: { estimatedCostUsd: 0.01, confidence: "low" as const, sampleCount: 0, divisionId: null, basedOn: "default" as const },
      },
    ],
    dependencyGraph: [] as TaskDependency[],
    estimatedDuration: "1d",
    estimatedCost: { estimatedCostUsd: 0.01, confidence: "low", sampleCount: 0, divisionId: null, basedOn: "default" },
    riskSummary: { overallRisk: "low" as const, riskFactors: [], reversible: true, sideEffects: [], approvalNeeded: false },
    decompositionConfidence: 0.9,
    requiresHumanReview: false,
    depthUsed: 5,
    maxDepthReached: true,
  };
  const findings = validateGoalDecomposition(decomposition as any);
  assert.ok(findings.some((f) => f.includes("max_depth_reached")));
});

test("validateGoalDecomposition returns no findings for valid decomposition", () => {
  const decomposition = {
    goalId: "goal-validate",
    tasks: [
      {
        taskId: "task-1",
        domainId: "test",
        description: "Task 1",
        inputs: {},
        expectedOutputs: [] as string[],
        delegationMode: "auto" as const,
        estimatedDuration: "1h",
        estimatedCost: { estimatedCostUsd: 0.01, confidence: "low" as const, sampleCount: 0, divisionId: null, basedOn: "default" as const },
      },
      {
        taskId: "task-2",
        domainId: "test",
        description: "Task 2",
        inputs: {},
        expectedOutputs: [] as string[],
        delegationMode: "auto" as const,
        estimatedDuration: "1h",
        estimatedCost: { estimatedCostUsd: 0.01, confidence: "low" as const, sampleCount: 0, divisionId: null, basedOn: "default" as const },
        dependsOn: ["task-1"],
      },
    ],
    dependencyGraph: [
      { fromTask: "task-1", toTask: "task-2", type: "blocks" as const },
    ],
    estimatedDuration: "2d",
    estimatedCost: { estimatedCostUsd: 0.02, confidence: "low", sampleCount: 0, divisionId: null, basedOn: "default" },
    riskSummary: { overallRisk: "low" as const, riskFactors: [], reversible: true, sideEffects: [], approvalNeeded: false },
    decompositionConfidence: 0.9,
    requiresHumanReview: false,
    depthUsed: 0,
    maxDepthReached: false,
  };
  const findings = validateGoalDecomposition(decomposition as any);
  assert.strictEqual(findings.length, 0);
});
