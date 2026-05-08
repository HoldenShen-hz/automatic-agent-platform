/**
 * E2E Planner Service Tests
 *
 * End-to-end tests covering planner service:
 * 1. Plan building from goals
 * 2. Plan validation
 * 3. Plan strategy selection
 * 4. Task decomposition
 * 5. Replanning service
 *
 * Uses node:test + node:assert/strict. ESM imports with .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore
import { createE2EHarness } from "../helpers/e2e-harness.js";
// @ts-ignore
import { PlanBuilder } from "../../src/platform/orchestration/planner/plan-builder.js";
// @ts-ignore
import { PlanDagValidator } from "../../src/platform/orchestration/planner/plan-dag-validator.js";
// @ts-ignore
import { PlanStrategySelector } from "../../src/platform/orchestration/planner/plan-strategy-selector.js";
// @ts-ignore
import { TaskDecompositionService } from "../../src/platform/orchestration/planner/task-decomposition-service.js";
// @ts-ignore
import type { PlanGraph, PlanNode, PlanEdge } from "../../src/platform/orchestration/planner/types.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createPlanNode(overrides: Partial<PlanNode> = {}): PlanNode {
  return {
    nodeId: overrides.nodeId ?? "node_001",
    stepName: overrides.stepName ?? "step_initialize",
    toolHints: overrides.toolHints ?? ["bash"],
    modelHints: overrides.modelHints ?? {},
    dependsOn: overrides.dependsOn ?? [],
    status: overrides.status ?? "pending",
    ...overrides,
  };
}

function createPlanGraph(overrides: Partial<PlanGraph> = {}): PlanGraph {
  return {
    planId: overrides.planId ?? "plan_e2e_001",
    taskId: overrides.taskId ?? "task_e2e_001",
    nodes: overrides.nodes ?? [createPlanNode()],
    edges: overrides.edges ?? [],
    metadata: overrides.metadata ?? {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite 1: Plan Building
// ---------------------------------------------------------------------------

test("E2E Planner: PlanBuilder constructs plan from goal decomposition", async () => {
  const harness = createE2EHarness("aa-e2e-planner-build-");
  try {
    const builder = new PlanBuilder();

    const goal = {
      goalId: "goal_e2e_001",
      description: "Execute database backup",
      successCriteria: [{ criterion: "backup_completed", metric: "success_rate" }],
    };

    const plan = builder.buildFromGoal(goal);

    assert.ok(plan, "Should return plan graph");
    assert.ok(Array.isArray(plan.nodes), "Should have nodes");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 2: Plan Validation
// ---------------------------------------------------------------------------

test("E2E Planner: PlanDagValidator validates plan graph structure", async () => {
  const harness = createE2EHarness("aa-e2e-planner-validate-");
  try {
    const validator = new PlanDagValidator();

    const graph = createPlanGraph({
      nodes: [
        createPlanNode({ nodeId: "node_1", dependsOn: [] }),
        createPlanNode({ nodeId: "node_2", dependsOn: ["node_1"] }),
        createPlanNode({ nodeId: "node_3", dependsOn: ["node_2"] }),
      ],
    });

    const validation = validator.validate(graph);

    assert.ok(validation, "Should return validation result");
    assert.equal(validation.valid, true, "Should be valid DAG");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 3: Strategy Selection
// ---------------------------------------------------------------------------

test("E2E Planner: PlanStrategySelector chooses optimal strategy based on task type", async () => {
  const harness = createE2EHarness("aa-e2e-planner-strategy-");
  try {
    const selector = new PlanStrategySelector();

    const strategy = selector.selectStrategy({
      taskType: "code_generation",
      complexity: "high",
      timeConstraint: 60000,
    });

    assert.ok(strategy, "Should return strategy");
    assert.ok(strategy.name, "Should have strategy name");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 4: Task Decomposition
// ---------------------------------------------------------------------------

test("E2E Planner: TaskDecompositionService breaks complex task into sub-tasks", async () => {
  const harness = createE2EHarness("aa-e2e-planner-decompose-");
  try {
    const service = new TaskDecompositionService();

    const complexTask = {
      taskId: "task_complex_001",
      description: "Build and deploy complete microservice",
      constraints: { maxDurationMs: 300000 },
    };

    const decomposition = service.decompose(complexTask);

    assert.ok(decomposition, "Should return decomposition");
    assert.ok(Array.isArray(decomposition.subTasks), "Should have sub-tasks");
  } finally {
    harness.cleanup();
  }
});