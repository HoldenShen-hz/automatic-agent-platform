import test from "node:test";
import assert from "node:assert/strict";

import { PlanBuilder } from "../../../../../src/platform/orchestration/planner/plan-builder.js";

function createMinimalObservation(taskId: string) {
  return {
    taskId,
    timestamp: Date.now(),
    objective: "test task",
    currentPhase: "planning" as const,
    userIntent: { raw: "test", normalized: "test", confidence: 0.9 },
    blockers: [],
    codebaseSnapshot: {
      rootPath: process.cwd(),
      fileCount: 1,
      relevantFiles: [],
    },
    environmentContext: {
      nodeVersion: process.version,
      platform: process.platform,
      workingDirectory: process.cwd(),
      availableTools: ["read", "execute"],
    },
    historicalContext: { previousTaskIds: [], relatedMemoryRefs: [] },
    relevantMemory: [],
    fileRefs: [],
    metrics: {},
  };
}

function createMinimalAssessment(taskId: string, overrides: {
  risk?: "low" | "medium" | "high" | "critical";
  maxTokens?: number;
} = {}) {
  return {
    taskId,
    timestamp: Date.now(),
    situationRef: `task_situation:${taskId}:1`,
    phase: "pre-execution" as const,
    complexity: "simple" as const,
    risk: overrides.risk ?? "medium",
    riskAssessment: { level: overrides.risk ?? "medium", factors: [] },
    routingDecision: { division: "coding", workflow: "multi-step", rationale: "test" },
    resourceAllocation: { modelClass: "small", maxTokens: overrides.maxTokens ?? 5000, timeoutMs: 30000 },
    approvalPolicy: { required: false, level: "none" },
    executionMode: "auto" as const,
    suggestedActions: [],
  };
}

function createWorkflow(steps: Array<{
  stepId: string;
  dependsOnStepIds: string[];
  roleId?: string;
  timeoutMs?: number;
}>) {
  return {
    workflow: { workflowId: "wf_test", divisionId: "coding", steps: [] },
    executionSteps: steps.map((s) => ({
      stepId: s.stepId,
      divisionId: "coding",
      roleId: s.roleId ?? "builder",
      inputKeys: s.dependsOnStepIds,
      agentId: "agent_builder",
      outputKey: `output_${s.stepId}`,
      outputSchemaPath: null,
      dependsOnStepIds: s.dependsOnStepIds,
      dependencyTypes: Object.fromEntries(s.dependsOnStepIds.map(id => [id, "hard" as const])),
      timeoutMs: s.timeoutMs ?? 5000,
      maxAttempts: 1,
    })),
    planReason: "test.workflow",
    dependencyEdges: steps.flatMap(s =>
      s.dependsOnStepIds.map(dep => ({ fromStepId: dep, toStepId: s.stepId }))
    ),
  };
}

test("PlanBuilder.buildGraphBundle produces PlanGraphBundle with graph nodes and edges", () => {
  const builder = new PlanBuilder();

  const bundle = builder.buildGraphBundle({
    observation: createMinimalObservation("task_graph"),
    assessment: createMinimalAssessment("task_graph"),
    workflow: createWorkflow([
      { stepId: "step_a", dependsOnStepIds: [] },
      { stepId: "step_b", dependsOnStepIds: ["step_a"] },
      { stepId: "step_c", dependsOnStepIds: ["step_b"] },
    ]),
    harnessRunId: "harness_001",
  });

  // Verify PlanGraphBundle structure
  assert.ok(bundle.harnessRunId, "harness_001");
  assert.ok(bundle.graph, "graph exists");
  assert.ok(bundle.graph.nodes, "nodes array exists");
  assert.ok(bundle.graph.edges, "edges array exists");

  // Verify nodes count matches steps
  assert.equal(bundle.graph.nodes.length, 3, "should have 3 nodes");

  // Verify edges exist (step_b depends on step_a, step_c depends on step_b)
  assert.ok(bundle.graph.edges.length >= 2, "should have at least 2 edges");
});

test("PlanBuilder.buildGraphBundle sets entryNodeIds for steps with no dependencies", () => {
  const builder = new PlanBuilder();

  const bundle = builder.buildGraphBundle({
    observation: createMinimalObservation("task_entry"),
    assessment: createMinimalAssessment("task_entry"),
    workflow: createWorkflow([
      { stepId: "step_a", dependsOnStepIds: [] },
      { stepId: "step_b", dependsOnStepIds: ["step_a"] },
      { stepId: "step_c", dependsOnStepIds: ["step_b"] },
    ]),
    harnessRunId: "harness_entry",
  });

  // step_a has no dependencies, so it should be an entry node
  assert.ok(bundle.graph.entryNodeIds.includes("step_a"), "step_a should be entry node");
  assert.equal(bundle.graph.entryNodeIds.length, 1, "should have exactly 1 entry node");
});

test("PlanBuilder.buildGraphBundle sets terminalNodeIds for steps with no dependents", () => {
  const builder = new PlanBuilder();

  const bundle = builder.buildGraphBundle({
    observation: createMinimalObservation("task_terminal"),
    assessment: createMinimalAssessment("task_terminal"),
    workflow: createWorkflow([
      { stepId: "step_a", dependsOnStepIds: [] },
      { stepId: "step_b", dependsOnStepIds: ["step_a"] },
      { stepId: "step_c", dependsOnStepIds: ["step_b"] },
    ]),
    harnessRunId: "harness_terminal",
  });

  // step_c has no dependents, so it should be a terminal node
  assert.ok(bundle.graph.terminalNodeIds.includes("step_c"), "step_c should be terminal node");
  assert.equal(bundle.graph.terminalNodeIds.length, 1, "should have exactly 1 terminal node");
});

test("PlanBuilder.buildGraphBundle includes graphHash", () => {
  const builder = new PlanBuilder();

  const bundle = builder.buildGraphBundle({
    observation: createMinimalObservation("task_hash"),
    assessment: createMinimalAssessment("task_hash"),
    workflow: createWorkflow([{ stepId: "step1", dependsOnStepIds: [] }]),
    harnessRunId: "harness_hash",
  });

  assert.ok(bundle.graph.graphHash, "graphHash should exist");
  assert.ok(bundle.graph.graphHash.includes("harness_hash"), "graphHash should include harnessRunId");
});

test("PlanBuilder.buildGraphBundle includes validationReport", () => {
  const builder = new PlanBuilder();

  const bundle = builder.buildGraphBundle({
    observation: createMinimalObservation("task_validation"),
    assessment: createMinimalAssessment("task_validation"),
    workflow: createWorkflow([{ stepId: "step1", dependsOnStepIds: [] }]),
    harnessRunId: "harness_validation",
  });

  assert.ok(bundle.validationReport, "validationReport should exist");
  assert.ok(typeof bundle.validationReport.valid === "boolean", "valid should be boolean");
});

test("PlanBuilder.buildGraphBundle includes schedulerPolicy", () => {
  const builder = new PlanBuilder();

  const bundle = builder.buildGraphBundle({
    observation: createMinimalObservation("task_scheduler"),
    assessment: createMinimalAssessment("task_scheduler"),
    workflow: createWorkflow([{ stepId: "step1", dependsOnStepIds: [] }]),
    harnessRunId: "harness_scheduler",
  });

  assert.ok(bundle.schedulerPolicy, "schedulerPolicy should exist");
  assert.ok(bundle.schedulerPolicy.policyId, "policyId should exist");
  assert.ok(bundle.schedulerPolicy.strategy, "strategy should exist");
});

test("PlanBuilder.buildGraphBundle includes riskProfile", () => {
  const builder = new PlanBuilder();

  const bundle = builder.buildGraphBundle({
    observation: createMinimalObservation("task_risk"),
    assessment: createMinimalAssessment("task_risk"),
    workflow: createWorkflow([{ stepId: "step1", dependsOnStepIds: [] }]),
    harnessRunId: "harness_risk",
    riskProfile: { riskClass: "high", reasons: ["test.reason"] },
  });

  assert.ok(bundle.riskProfile, "riskProfile should exist");
  assert.equal(bundle.riskProfile.riskClass, "high");
  assert.ok(bundle.riskProfile.reasons.includes("test.reason"));
});

test("PlanBuilder.buildGraphBundle uses default riskProfile when not provided", () => {
  const builder = new PlanBuilder();

  const bundle = builder.buildGraphBundle({
    observation: createMinimalObservation("task_default_risk"),
    assessment: createMinimalAssessment("task_default_risk"),
    workflow: createWorkflow([{ stepId: "step1", dependsOnStepIds: [] }]),
    harnessRunId: "harness_default_risk",
  });

  assert.ok(bundle.riskProfile, "riskProfile should exist");
  assert.equal(bundle.riskProfile.riskClass, "medium");
  assert.ok(bundle.riskProfile.reasons.includes("plan_builder.default"));
});

test("PlanBuilder.buildGraphBundle includes budgetPlanRef", () => {
  const builder = new PlanBuilder();

  const bundle = builder.buildGraphBundle({
    observation: createMinimalObservation("task_budget"),
    assessment: createMinimalAssessment("task_budget"),
    workflow: createWorkflow([{ stepId: "step1", dependsOnStepIds: [] }]),
    harnessRunId: "harness_budget",
  });

  assert.ok(bundle.budgetPlanRef, "budgetPlanRef should exist");
  assert.ok(bundle.budgetPlanRef.startsWith("budget:plan."), "budgetPlanRef should start with budget:plan.");
});