/**
 * Unit tests for goal-decomposer-types.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import type {
  Goal,
  PlannedTask,
  TaskDependency,
  GoalDecomposition,
  GoalConstraintEnvelope,
  GoalBudgetAllocation,
  GoalRiskPropagationRecord,
  CapabilityValidationResult,
} from "../../../src/interaction/goal-decomposer/goal-decomposer-types.js";

test("Goal interface accepts valid structure", () => {
  const goal: Goal = {
    goalId: "goal:test-123",
    description: "Deploy the new feature to production",
    owner: "user-1",
    priority: "high",
    successCriteria: [
      { metric: "uptime", target: "99.9%", operator: ">=", evaluationMethod: "metric_api" },
    ],
    constraints: ["budget:500", "timeline:2d"],
    deadline: "2026-05-30T00:00:00Z",
  };

  assert.equal(goal.goalId, "goal:test-123");
  assert.equal(goal.priority, "high");
  assert.equal(goal.successCriteria.length, 1);
  assert.equal(goal.constraints.length, 2);
});

test("Goal allows all priority levels", () => {
  const priorities: Goal["priority"][] = ["low", "normal", "high", "critical"];

  for (const priority of priorities) {
    const goal: Goal = {
      goalId: `goal:${priority}`,
      description: "test goal",
      owner: "user",
      priority,
    };
    assert.equal(goal.priority, priority);
  }
});

test("PlannedTask interface accepts valid structure", () => {
  const task: PlannedTask = {
    taskId: "goal:test-123:engineering:deploy-fe",
    domainId: "engineering_ops",
    description: "Deploy feature to production",
    inputs: {
      goalDescription: "Deploy the new feature",
      successCriteria: [],
      constraints: [],
    },
    expectedOutputs: ["deployed_service", "monitoring_dashboard"],
    delegationMode: "auto",
    estimatedDuration: "2h",
    estimatedCost: {
      estimatedCostUsd: 0.05,
      confidence: "low",
      sampleCount: 5,
      divisionId: "engineering_ops",
      basedOn: "historical_avg",
    },
    dependsOn: [],
  };

  assert.equal(task.taskId, "goal:test-123:engineering:deploy-fe");
  assert.equal(task.domainId, "engineering_ops");
  assert.equal(task.delegationMode, "auto");
  assert.equal(task.expectedOutputs.length, 2);
});

test("PlannedTask delegationMode accepts valid values", () => {
  const modes: PlannedTask["delegationMode"][] = ["auto", "supervised", "manual"];

  for (const mode of modes) {
    const task: PlannedTask = {
      taskId: `task:${mode}`,
      domainId: "general_ops",
      description: "test",
      inputs: {},
      expectedOutputs: ["output1"],
      delegationMode: mode,
      estimatedDuration: "1h",
      estimatedCost: { estimatedCostUsd: 0.01, confidence: "low", sampleCount: 0, divisionId: null, basedOn: "default" },
    };
    assert.equal(task.delegationMode, mode);
  }
});

test("TaskDependency interface accepts valid structure", () => {
  const dependency: TaskDependency = {
    fromTask: "task-1",
    toTask: "task-2",
    type: "blocks",
    dataContract: "output_from_task1",
  };

  assert.equal(dependency.fromTask, "task-1");
  assert.equal(dependency.toTask, "task-2");
  assert.equal(dependency.type, "blocks");
  assert.equal(dependency.dataContract, "output_from_task1");
});

test("TaskDependency types are valid", () => {
  const types: TaskDependency["type"][] = ["blocks", "provides_input", "soft_dependency"];

  for (const type of types) {
    const dep: TaskDependency = {
      fromTask: "task-a",
      toTask: "task-b",
      type,
    };
    assert.equal(dep.type, type);
  }
});

test("GoalConstraintEnvelope interface accepts valid structure", () => {
  const envelope: GoalConstraintEnvelope = {
    budgetLimitUsd: 500.00,
    riskTolerance: "medium",
    requiresApproval: true,
    requiredPermissions: ["deployment:write"],
    requiredCapabilities: ["analytics"],
    budgetAllocations: [
      { taskId: "task-1", budgetUsd: 250, riskMultiplier: 1.1 },
      { taskId: "task-2", budgetUsd: 250, riskMultiplier: 1.2 },
    ],
    riskPropagation: [
      { taskId: "task-1", riskLevel: "low" },
      { taskId: "task-2", riskLevel: "medium" },
    ],
  };

  assert.equal(envelope.budgetLimitUsd, 500);
  assert.equal(envelope.riskTolerance, "medium");
  assert.equal(envelope.requiresApproval, true);
  assert.equal(envelope.requiredPermissions.length, 1);
  assert.equal(envelope.budgetAllocations?.length, 2);
  assert.equal(envelope.riskPropagation?.length, 2);
});

test("GoalConstraintEnvelope allows null budget", () => {
  const envelope: GoalConstraintEnvelope = {
    budgetLimitUsd: null,
    riskTolerance: "high",
    requiresApproval: false,
    requiredPermissions: [],
    requiredCapabilities: [],
  };

  assert.equal(envelope.budgetLimitUsd, null);
});

test("GoalConstraintEnvelope riskTolerance accepts valid values", () => {
  const tolerances: GoalConstraintEnvelope["riskTolerance"][] = ["low", "medium", "high"];

  for (const tolerance of tolerances) {
    const envelope: GoalConstraintEnvelope = {
      budgetLimitUsd: null,
      riskTolerance: tolerance,
      requiresApproval: false,
      requiredPermissions: [],
      requiredCapabilities: [],
    };
    assert.equal(envelope.riskTolerance, tolerance);
  }
});

test("CapabilityValidationResult valid structure", () => {
  const result: CapabilityValidationResult = {
    valid: true,
    missingCapabilities: [],
    unauthorizedPermissions: [],
    reasonCodes: [],
    validationMessages: [],
  };

  assert.equal(result.valid, true);
  assert.equal(result.missingCapabilities.length, 0);
});

test("CapabilityValidationResult invalid structure with missing capabilities", () => {
  const result: CapabilityValidationResult = {
    valid: false,
    missingCapabilities: ["engineering_ops:analytics"],
    unauthorizedPermissions: ["finance:deployment:write"],
    reasonCodes: ["goal_decomposer.missing_capabilities:engineering_ops:analytics"],
    validationMessages: ["goal_decomposer.missing_capability:task-1:engineering_ops:analytics"],
  };

  assert.equal(result.valid, false);
  assert.equal(result.missingCapabilities.length, 1);
  assert.equal(result.unauthorizedPermissions.length, 1);
  assert.ok(result.reasonCodes.length > 0);
});

test("GoalRiskPropagationRecord riskLevel accepts valid values", () => {
  const levels: GoalRiskPropagationRecord["riskLevel"][] = ["low", "medium", "high", "critical"];

  for (const level of levels) {
    const record: GoalRiskPropagationRecord = {
      taskId: `task:${level}`,
      riskLevel: level,
    };
    assert.equal(record.riskLevel, level);
  }
});

test("GoalBudgetAllocation structure", () => {
  const allocation: GoalBudgetAllocation = {
    taskId: "task-1",
    budgetUsd: 150.50,
    riskMultiplier: 1.25,
  };

  assert.equal(allocation.taskId, "task-1");
  assert.equal(allocation.budgetUsd, 150.50);
  assert.equal(allocation.riskMultiplier, 1.25);
});

test("SuccessCriterion evaluationMethod accepts valid values", () => {
  const methods: Array<{ metric: string; target: string; evaluationMethod: "metric_api" | "human_review" | "automated_test" }> = [
    { metric: "uptime", target: "99.9%", evaluationMethod: "metric_api" },
    { metric: "quality", target: "passed", evaluationMethod: "human_review" },
    { metric: "tests", target: "100%", evaluationMethod: "automated_test" },
  ];

  for (const criterion of methods) {
    assert.ok(["metric_api", "human_review", "automated_test"].includes(criterion.evaluationMethod));
  }
});