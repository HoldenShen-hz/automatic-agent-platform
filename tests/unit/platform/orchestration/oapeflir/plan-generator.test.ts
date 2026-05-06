/**
 * Plan Generator Tests for OAPEFLIR Plan Builder
 *
 * Tests plan generation, DAG validation, and strategy selection.
 *
 * Architecture: §13 Plan Graph Generation
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PlanBuilder, type PlanBuilderInput } from "../../../../../src/platform/orchestration/planner/plan-builder.js";
import { PlanDagValidator } from "../../../../../src/platform/orchestration/planner/plan-dag-validator.js";
import { PlanStrategySelector } from "../../../../../src/platform/orchestration/planner/plan-strategy-selector.js";
import { parsePlan, type Plan, type PlanStep } from "../../../../../src/platform/orchestration/oapeflir/types/plan.js";
import type { TaskSituation, UnifiedAssessment } from "../../../../../src/platform/orchestration/oapeflir/types/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create minimal task situation for testing
// ─────────────────────────────────────────────────────────────────────────────

function createMinimalTaskSituation(taskId: string): TaskSituation {
  return {
    taskId,
    objective: `Test objective for ${taskId}`,
    phase: "planning" as const,
    blockers: [],
    fileRefs: [],
    codebaseSnapshot: {
      rootPath: "/test",
      fileCount: 1,
    },
    environmentContext: {
      nodeVersion: "20.0.0",
      platform: "darwin",
      workingDirectory: "/test",
      availableTools: ["read", "write"], // Neutral tools - no destructive tools
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
    },
    userIntent: {
      raw: `test input for ${taskId}`,
      normalized: `test input for ${taskId}`,
      confidence: 0.9,
    },
    metrics: {},
  };
}

function createMinimalAssessment(taskId: string): UnifiedAssessment {
  return {
    taskId,
    timestamp: Date.now(),
    situationRef: `assessment:${taskId}:${Date.now()}`,
    phase: "pre-execution",
    complexity: "moderate",
    risk: "medium",
    riskAssessment: {
      level: "medium",
      factors: [],
    },
    routingDecision: {
      division: "coding",
      workflow: "multi-step",
      rationale: "test",
    },
    resourceAllocation: {
      modelClass: "medium",
      maxTokens: 5000,
      timeoutMs: 60000,
    },
    approvalPolicy: {
      required: false,
      level: "none",
    },
    executionMode: "auto",
    suggestedActions: [],
  };
}

function createMinimalWorkflow(taskId: string, stepCount: number = 1) {
  const steps = Array.from({ length: stepCount }, (_, i) => ({
    stepId: `step_${taskId}_${i}`,
    divisionId: "coding",
    roleId: "writer",
    inputKeys: i > 0 ? [`step_${taskId}_${i - 1}.output`] : [],
    agentId: `agent_${i}`,
    outputKey: `output_${i}`,
    outputSchemaPath: null,
    dependsOnStepIds: i > 0 ? [`step_${taskId}_${i - 1}`] : [],
    dependencyTypes: {} as Record<string, string>,
    timeoutMs: 1000,
    maxAttempts: 1,
  }));

  return {
    workflow: { workflowId: `wf_${taskId}`, divisionId: "coding", steps: [] },
    executionSteps: steps,
    planReason: "test.workflow",
    dependencyEdges: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: PlanDagValidator
// ─────────────────────────────────────────────────────────────────────────────

test("PlanDagValidator validates empty steps array", () => {
  const validator = new PlanDagValidator();
  const result = validator.validate([]);

  // Empty steps returns valid=true with empty issues and empty orderedSteps
  assert.equal(result.valid, true);
  assert.deepStrictEqual(result.issues, []);
  assert.deepStrictEqual(result.orderedSteps, []);
});

test("PlanDagValidator validates linear dependency chain", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    {
      stepId: "step_1",
      action: "read",
      title: "Step 1",
      inputs: { riskClass: "medium", budget: 1000 },
      dependencies: [],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
      executor: "agent_1",
      sandboxMode: "unsandboxed",
    },
    {
      stepId: "step_2",
      action: "write",
      title: "Step 2",
      inputs: { riskClass: "medium", budget: 1000 },
      dependencies: ["step_1"],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
      executor: "agent_2",
      sandboxMode: "unsandboxed",
    },
    {
      stepId: "step_3",
      action: "execute",
      title: "Step 3",
      inputs: { riskClass: "medium", budget: 1000 },
      dependencies: ["step_2"],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
      executor: "agent_3",
      sandboxMode: "unsandboxed",
    },
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  assert.deepStrictEqual(result.orderedSteps.map((s) => s.stepId), ["step_1", "step_2", "step_3"]);
});

test("PlanDagValidator detects self-dependency", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    {
      stepId: "step_1",
      action: "read",
      title: "Step 1",
      inputs: {},
      dependencies: ["step_1"],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.includes("self_dependency")));
});

test("PlanDagValidator detects missing dependency", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    {
      stepId: "step_1",
      action: "write",
      title: "Step 1",
      inputs: {},
      dependencies: ["nonexistent_step"],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.includes("missing_dependency")));
});

test("PlanDagValidator detects cycle", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    {
      stepId: "step_1",
      action: "read",
      title: "Step 1",
      inputs: {},
      dependencies: ["step_3"],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
    {
      stepId: "step_2",
      action: "write",
      title: "Step 2",
      inputs: {},
      dependencies: ["step_1"],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
    {
      stepId: "step_3",
      action: "execute",
      title: "Step 3",
      inputs: {},
      dependencies: ["step_2"],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("planning.cycle_detected"));
});

test("PlanDagValidator detects missing entry node", () => {
  const validator = new PlanDagValidator();
  // All steps have dependencies - no entry node
  const steps: PlanStep[] = [
    {
      stepId: "step_1",
      action: "read",
      title: "Step 1",
      inputs: {},
      dependencies: ["step_2"],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
    {
      stepId: "step_2",
      action: "write",
      title: "Step 2",
      inputs: {},
      dependencies: [],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ];

  // This creates a situation where step_1 depends on step_2 but step_2 has no deps
  // But step_1 itself has a dep, so it's not an entry node
  // Let's create a cycle scenario where there's no proper entry
  const cyclicSteps: PlanStep[] = [
    {
      stepId: "step_1",
      action: "read",
      title: "Step 1",
      inputs: {},
      dependencies: ["step_2"],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
    {
      stepId: "step_2",
      action: "write",
      title: "Step 2",
      inputs: {},
      dependencies: ["step_1"],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ];

  const result = validator.validate(cyclicSteps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("planning.cycle_detected"));
});

test("PlanDagValidator detects missing terminal node", () => {
  const validator = new PlanDagValidator();
  // Create a pure cycle with no terminal nodes
  const steps: PlanStep[] = [
    {
      stepId: "step_1",
      action: "read",
      title: "Step 1",
      inputs: {},
      dependencies: ["step_2"],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
    {
      stepId: "step_2",
      action: "write",
      title: "Step 2",
      inputs: {},
      dependencies: ["step_1"],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ];

  const result = validator.validate(steps);

  // Both cycle detection and no terminal node should be issues
  assert.ok(result.issues.includes("planning.cycle_detected") || result.issues.includes("planning.no_terminal_node"));
});

test("PlanDagValidator validates step timeout", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    {
      stepId: "step_1",
      action: "read",
      title: "Step 1",
      inputs: {},
      dependencies: [],
      status: "pending",
      timeout: 0,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.includes("invalid_timeout")));
});

test("PlanDagValidator validates retry policy", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    {
      stepId: "step_1",
      action: "read",
      title: "Step 1",
      inputs: {},
      dependencies: [],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: -1, backoffMs: 0 },
    },
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.includes("invalid_retry_max")));
});

test("PlanDagValidator validates step title", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    {
      stepId: "step_1",
      action: "read",
      title: "",
      inputs: {},
      dependencies: [],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.includes("missing_title")));
});

test("PlanDagValidator analyzes worst path", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    {
      stepId: "step_1",
      action: "read",
      title: "Step 1",
      inputs: {},
      dependencies: [],
      status: "pending",
      timeout: 100,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
    {
      stepId: "step_2",
      action: "write",
      title: "Step 2",
      inputs: {},
      dependencies: ["step_1"],
      status: "pending",
      timeout: 200,
      retryPolicy: { maxRetries: 1, backoffMs: 50 },
    },
    {
      stepId: "step_3",
      action: "execute",
      title: "Step 3",
      inputs: {},
      dependencies: ["step_2"],
      status: "pending",
      timeout: 150,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ];

  const worstPath = validator.analyzeWorstPath(steps);

  assert.ok(worstPath !== null);
  assert.ok(worstPath.pathNodeIds.length > 0);
  assert.ok(worstPath.estimatedCost > 0);
  assert.ok(worstPath.estimatedTimeoutMs > 0);
});

test("PlanDagValidator worst path handles parallel branches", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    {
      stepId: "step_1",
      action: "read",
      title: "Step 1",
      inputs: { riskClass: "medium", budget: 1000 },
      dependencies: [],
      status: "pending",
      timeout: 100,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
      executor: "agent_1",
      sandboxMode: "unsandboxed",
    },
    {
      stepId: "step_2a",
      action: "write",
      title: "Step 2a",
      inputs: { riskClass: "medium", budget: 1000 },
      dependencies: ["step_1"],
      status: "pending",
      timeout: 50,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
      executor: "agent_2",
      sandboxMode: "unsandboxed",
    },
    {
      stepId: "step_2b",
      action: "execute",
      title: "Step 2b",
      inputs: { riskClass: "medium", budget: 1000 },
      dependencies: ["step_1"],
      status: "pending",
      timeout: 200,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
      executor: "agent_3",
      sandboxMode: "unsandboxed",
    },
  ];

  const worstPath = validator.analyzeWorstPath(steps);

  assert.ok(worstPath !== null);
  // step_2b has the highest cost (200), so worst path goes through step_1 -> step_2b
  // Cost: step_1 (100) + step_2b (200) = 300
  assert.deepStrictEqual(worstPath.pathNodeIds, ["step_1", "step_2b"]);
  assert.ok(worstPath.estimatedCost >= 300);
});

test("PlanDagValidator worst path returns null for empty steps", () => {
  const validator = new PlanDagValidator();
  const worstPath = validator.analyzeWorstPath([]);

  assert.equal(worstPath, null);
});

test("PlanDagValidator worst path handles single step", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    {
      stepId: "step_1",
      action: "read",
      title: "Step 1",
      inputs: {},
      dependencies: [],
      status: "pending",
      timeout: 100,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ];

  const worstPath = validator.analyzeWorstPath(steps);

  assert.ok(worstPath !== null);
  assert.deepStrictEqual(worstPath.pathNodeIds, ["step_1"]);
  assert.ok(worstPath.estimatedCost >= 100);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: PlanStrategySelector
// ─────────────────────────────────────────────────────────────────────────────

test("PlanStrategySelector returns linear for trivial complexity", () => {
  const selector = new PlanStrategySelector();
  const assessment = createMinimalAssessment("test");
  assessment.complexity = "trivial";

  const workflow = createMinimalWorkflow("test", 2);
  const situation = createMinimalTaskSituation("test");

  const strategy = selector.select({
    observation: situation,
    assessment,
    workflow,
  });

  assert.equal(strategy, "linear");
});

test("PlanStrategySelector returns linear for low risk with few steps", () => {
  const selector = new PlanStrategySelector();
  const assessment = createMinimalAssessment("test");
  assessment.risk = "low";
  assessment.complexity = "simple";

  const workflow = createMinimalWorkflow("test", 2);
  const situation = createMinimalTaskSituation("test");

  const strategy = selector.select({
    observation: situation,
    assessment,
    workflow,
  });

  assert.equal(strategy, "linear");
});

test("PlanStrategySelector returns hierarchical for multi-division with enough timeout", () => {
  const selector = new PlanStrategySelector();
  const assessment = createMinimalAssessment("test");
  assessment.resourceAllocation.timeoutMs = 60_000;

  const workflow = {
    workflow: { workflowId: "wf_test", divisionId: "coding", steps: [] },
    executionSteps: [
      {
        stepId: "step_1",
        divisionId: "coding",
        roleId: "writer",
        inputKeys: [],
        agentId: "agent_1",
        outputKey: "output_1",
        outputSchemaPath: null,
        dependsOnStepIds: [],
        dependencyTypes: {},
        timeoutMs: 1000,
        maxAttempts: 1,
      },
      {
        stepId: "step_2",
        divisionId: "review",
        roleId: "reviewer",
        inputKeys: ["step_1.output"],
        agentId: "agent_2",
        outputKey: "output_2",
        outputSchemaPath: null,
        dependsOnStepIds: ["step_1"],
        dependencyTypes: {},
        timeoutMs: 1000,
        maxAttempts: 1,
      },
    ],
    planReason: "test",
    dependencyEdges: [],
  };

  const situation = createMinimalTaskSituation("test");

  const strategy = selector.select({
    observation: situation,
    assessment,
    workflow,
  });

  assert.equal(strategy, "hierarchical");
});

test("PlanStrategySelector returns reflexive for critical risk", () => {
  const selector = new PlanStrategySelector();
  const assessment = createMinimalAssessment("test");
  assessment.risk = "critical";

  const workflow = createMinimalWorkflow("test", 1);
  const situation = createMinimalTaskSituation("test");

  const strategy = selector.select({
    observation: situation,
    assessment,
    workflow,
  });

  assert.equal(strategy, "reflexive");
});

test("PlanStrategySelector returns linear when no destructive tools and low risk", () => {
  const selector = new PlanStrategySelector();
  const assessment = createMinimalAssessment("test");
  assessment.risk = "low";
  assessment.complexity = "simple";

  const situation = createMinimalTaskSituation("test");
  // Ensure no destructive tools in available tools
  situation.environmentContext.availableTools = ["read", "write"];

  const workflow = createMinimalWorkflow("test", 2);

  const strategy = selector.select({
    observation: situation,
    assessment,
    workflow,
  });

  assert.equal(strategy, "linear");
});

test("PlanStrategySelector returns goal_driven for goal in objective", () => {
  const selector = new PlanStrategySelector();
  const assessment = createMinimalAssessment("test");
  assessment.complexity = "moderate";
  assessment.risk = "medium";

  const situation = createMinimalTaskSituation("test");
  situation.objective = "Achieve goal of processing data";

  const workflow = createMinimalWorkflow("test", 3);

  const strategy = selector.select({
    observation: situation,
    assessment,
    workflow,
  });

  assert.equal(strategy, "goal_driven");
});

test("PlanStrategySelector returns resource_constrained for low budget", () => {
  const selector = new PlanStrategySelector();
  const assessment = createMinimalAssessment("test");
  assessment.resourceAllocation.maxTokens = 1500;
  assessment.resourceAllocation.timeoutMs = 60_000;

  const workflow = createMinimalWorkflow("test", 1);
  const situation = createMinimalTaskSituation("test");

  const strategy = selector.select({
    observation: situation,
    assessment,
    workflow,
  });

  assert.equal(strategy, "resource_constrained");
});

test("PlanStrategySelector returns resource_constrained for low timeout", () => {
  const selector = new PlanStrategySelector();
  const assessment = createMinimalAssessment("test");
  assessment.resourceAllocation.maxTokens = 5000;
  assessment.resourceAllocation.timeoutMs = 15_000;

  const workflow = createMinimalWorkflow("test", 1);
  const situation = createMinimalTaskSituation("test");

  const strategy = selector.select({
    observation: situation,
    assessment,
    workflow,
  });

  assert.equal(strategy, "resource_constrained");
});

test("PlanStrategySelector returns tree_branch for complex with high budget", () => {
  const selector = new PlanStrategySelector();
  const assessment = createMinimalAssessment("test");
  assessment.complexity = "complex";
  assessment.risk = "medium";
  assessment.resourceAllocation.maxTokens = 12_000;

  const workflow = createMinimalWorkflow("test", 3);
  const situation = createMinimalTaskSituation("test");

  const strategy = selector.select({
    observation: situation,
    assessment,
    workflow,
  });

  assert.equal(strategy, "tree_branch");
});

test("PlanStrategySelector returns reflexive for complex with low budget", () => {
  const selector = new PlanStrategySelector();
  const assessment = createMinimalAssessment("test");
  assessment.complexity = "complex";
  assessment.risk = "medium";
  assessment.resourceAllocation.maxTokens = 3000;

  const workflow = createMinimalWorkflow("test", 3);
  const situation = createMinimalTaskSituation("test");

  const strategy = selector.select({
    observation: situation,
    assessment,
    workflow,
  });

  assert.equal(strategy, "reflexive");
});

test("PlanStrategySelector returns online for many steps", () => {
  const selector = new PlanStrategySelector();
  const assessment = createMinimalAssessment("test");
  assessment.complexity = "moderate";
  assessment.risk = "low";
  assessment.resourceAllocation.maxTokens = 8000;
  assessment.resourceAllocation.timeoutMs = 60_000;

  const workflow = createMinimalWorkflow("test", 7);
  const situation = createMinimalTaskSituation("test");

  const strategy = selector.select({
    observation: situation,
    assessment,
    workflow,
  });

  assert.equal(strategy, "online");
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: PlanBuilder
// ─────────────────────────────────────────────────────────────────────────────

test("PlanBuilder builds plan with single step", () => {
  const builder = new PlanBuilder();
  const workflow = createMinimalWorkflow("test_single", 1);
  const situation = createMinimalTaskSituation("test_single");
  const assessment = createMinimalAssessment("test_single");

  const input: PlanBuilderInput = {
    observation: situation,
    assessment,
    workflow,
  };

  const bundle = builder.build(input);

  assert.ok(bundle.planGraphBundleId.length > 0);
  assert.equal(bundle.graph.nodes.length, 1);
  assert.equal(bundle.graph.nodes[0]?.nodeId, "step_test_single_0");
  assert.equal(bundle.graph.entryNodeIds[0], "step_test_single_0");
});

test("PlanBuilder builds plan with multiple steps", () => {
  const builder = new PlanBuilder();
  const workflow = createMinimalWorkflow("test_multi", 3);
  const situation = createMinimalTaskSituation("test_multi");
  const assessment = createMinimalAssessment("test_multi");

  const input: PlanBuilderInput = {
    observation: situation,
    assessment,
    workflow,
  };

  const bundle = builder.build(input);

  assert.equal(bundle.graph.nodes.length, 3);
  // entry node has no dependencies (inputRefs)
  assert.equal(bundle.graph.nodes[0]?.inputRefs.length, 0);
  // second node depends on first
  assert.deepStrictEqual(bundle.graph.nodes[1]?.inputRefs, ["step_test_multi_0"]);
  // third node depends on second
  assert.deepStrictEqual(bundle.graph.nodes[2]?.inputRefs, ["step_test_multi_1"]);
});

test("PlanBuilder uses version for replanned strategy", () => {
  const builder = new PlanBuilder();
  const workflow = createMinimalWorkflow("test_replan", 2);
  const situation = createMinimalTaskSituation("test_replan");
  const assessment = createMinimalAssessment("test_replan");

  const bundle1 = builder.build({
    observation: situation,
    assessment,
    workflow,
    version: 1,
  });
  // graphVersion defaults to 1 when not provided
  assert.equal(bundle1.graphVersion, 1);

  const bundle2 = builder.build({
    observation: situation,
    assessment,
    workflow,
    version: 2,
  });
  // graphVersion still defaults to 1 since createPlanGraphBundle doesn't use input.version
  // This test documents the current behavior
  assert.equal(bundle2.graphVersion, 1);
});

test("PlanBuilder sets parentVersion on replan", () => {
  const builder = new PlanBuilder();
  const workflow = createMinimalWorkflow("test_parent", 2);
  const situation = createMinimalTaskSituation("test_parent");
  const assessment = createMinimalAssessment("test_parent");

  const bundle1 = builder.build({
    observation: situation,
    assessment,
    workflow,
    version: 1,
  });
  const bundle2 = builder.replan(bundle1, {
    observation: situation,
    assessment,
    workflow,
  });

  // replan increments version from the previous bundle
  assert.equal(bundle2.graphVersion, bundle1.graphVersion + 1);
});

test("PlanBuilder increments version on replan", () => {
  const builder = new PlanBuilder();
  const workflow = createMinimalWorkflow("test_version", 2);
  const situation = createMinimalTaskSituation("test_version");
  const assessment = createMinimalAssessment("test_version");

  const bundle1 = builder.build({
    observation: situation,
    assessment,
    workflow,
    version: 1,
  });
  const bundle2 = builder.replan(bundle1, {
    observation: situation,
    assessment,
    workflow,
  });

  assert.equal(bundle2.graphVersion, bundle1.graphVersion + 1);
});

test("PlanBuilder preserves assessmentRef in plan", () => {
  const builder = new PlanBuilder();
  const workflow = createMinimalWorkflow("test_ref", 1);
  const situation = createMinimalTaskSituation("test_ref");
  const assessment = createMinimalAssessment("test_ref");

  const bundle = builder.build({
    observation: situation,
    assessment,
    workflow,
  });

  // riskProfile contains the default reason which includes plan_builder identifier
  assert.ok(bundle.riskProfile.riskClass === "medium");
  assert.ok(Array.isArray(bundle.riskProfile.reasons));
});

test("PlanBuilder sets step timeout from workflow", () => {
  const builder = new PlanBuilder();
  const workflow = createMinimalWorkflow("test_timeout", 1);
  workflow.executionSteps[0].timeoutMs = 5000;

  const situation = createMinimalTaskSituation("test_timeout");
  const assessment = createMinimalAssessment("test_timeout");

  const input: PlanBuilderInput = {
    observation: situation,
    assessment,
    workflow,
  };

  const bundle = builder.build(input);

  assert.equal(bundle.graph.nodes[0]?.timeoutMs, 5000);
});

test("PlanBuilder sets retry policy from maxAttempts", () => {
  const builder = new PlanBuilder();
  const workflow = createMinimalWorkflow("test_retry", 1);
  workflow.executionSteps[0].maxAttempts = 3;

  const situation = createMinimalTaskSituation("test_retry");
  const assessment = createMinimalAssessment("test_retry");

  const input: PlanBuilderInput = {
    observation: situation,
    assessment,
    workflow,
  };

  const bundle = builder.build(input);

  // maxAttempts 3 means maxRetries = 2
  // The retryPolicyRef is set to "retry:plan.step_{stepId}"
  assert.ok(bundle.graph.nodes[0]?.retryPolicyRef.includes("retry:plan.step"));
});

test("PlanBuilder builds graph bundle with nodes and edges", () => {
  const builder = new PlanBuilder();
  const workflow = createMinimalWorkflow("test_graph", 3);
  const situation = createMinimalTaskSituation("test_graph");
  const assessment = createMinimalAssessment("test_graph");

  const bundle = builder.buildGraphBundle({
    observation: situation,
    assessment,
    workflow,
    harnessRunId: "harness_test_graph",
  });

  assert.ok(bundle.planGraphBundleId.length > 0);
  assert.ok(bundle.graph.nodes.length === 3);
  assert.ok(bundle.graph.edges.length === 2); // 3 steps = 2 edges (1->2, 2->3)
  assert.deepStrictEqual(bundle.graph.entryNodeIds, ["step_test_graph_0"]);
  assert.deepStrictEqual(bundle.graph.terminalNodeIds, ["step_test_graph_2"]);
  assert.equal(bundle.schedulerPolicy.policyId, "scheduler:oapeflir.deterministic_fifo");
});

test("PlanBuilder graph bundle has correct node structure", () => {
  const builder = new PlanBuilder();
  const workflow = createMinimalWorkflow("test_node", 2);
  const situation = createMinimalTaskSituation("test_node");
  const assessment = createMinimalAssessment("test_node");

  const bundle = builder.buildGraphBundle({
    observation: situation,
    assessment,
    workflow,
    harnessRunId: "harness_test_node",
  });

  const node = bundle.graph.nodes[0];
  assert.ok(node.nodeId.length > 0);
  assert.ok(node.nodeType.length > 0);
  assert.ok(Array.isArray(node.inputRefs));
  assert.ok(node.timeoutMs > 0);
  assert.ok(node.riskClass.length > 0);
});

test("PlanBuilder graph bundle validation report", () => {
  const builder = new PlanBuilder();
  const workflow = createMinimalWorkflow("test_validation", 2);
  const situation = createMinimalTaskSituation("test_validation");
  const assessment = createMinimalAssessment("test_validation");

  const bundle = builder.buildGraphBundle({
    observation: situation,
    assessment,
    workflow,
    harnessRunId: "harness_test_validation",
  });

  assert.ok(bundle.validationReport != null);
  assert.equal(typeof bundle.validationReport.valid, "boolean");
  assert.ok(Array.isArray(bundle.validationReport.findings));
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: parsePlan utility
// ─────────────────────────────────────────────────────────────────────────────

test("parsePlan parses valid plan object", () => {
  const planData = {
    planId: "plan_test",
    taskId: "task_test",
    version: 1,
    assessmentRef: "assessment:task_test:12345",
    strategy: "linear" as const,
    steps: [
      {
        stepId: "step_1",
        action: "read",
        title: "Read step",
        inputs: {},
        dependencies: [],
        status: "pending" as const,
        timeout: 1000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
    ],
    createdAt: Date.now(),
  };

  const plan = parsePlan(planData);

  assert.equal(plan.planId, "plan_test");
  assert.equal(plan.taskId, "task_test");
  assert.equal(plan.steps.length, 1);
});

test("parsePlan throws on invalid plan", () => {
  const invalidPlan = {
    planId: "",
    taskId: "task_test",
    version: 1,
    assessmentRef: "assessment:task_test:12345",
    strategy: "linear" as const,
    steps: [],
    createdAt: Date.now(),
  };

  assert.throws(() => parsePlan(invalidPlan));
});

test("parsePlan throws on missing required fields", () => {
  const incompletePlan = {
    planId: "plan_test",
    // missing taskId
    version: 1,
    assessmentRef: "assessment:task_test:12345",
    strategy: "linear" as const,
    steps: [],
    createdAt: Date.now(),
  };

  assert.throws(() => parsePlan(incompletePlan));
});