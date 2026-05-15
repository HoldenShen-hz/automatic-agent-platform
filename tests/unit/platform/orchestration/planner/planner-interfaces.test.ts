import test from "node:test";
import assert from "node:assert/strict";

import {
  PlanBuilder,
  type PlanBuilderInput,
} from "../../../../../src/platform/five-plane-orchestration/planner/plan-builder.js";
import { PlanEvaluator } from "../../../../../src/platform/five-plane-orchestration/planner/plan-evaluator.js";
import { PlanDagValidator } from "../../../../../src/platform/five-plane-orchestration/planner/plan-dag-validator.js";
import type { Plan, PlanStep } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/index.js";

function createMinimalObservation(taskId: string) {
  return {
    taskId,
    timestamp: Date.now(),
    objective: "test task",
    currentPhase: "planning" as const,
    userIntent: { raw: "test", normalized: "test", confidence: 0.9 },
    blockers: [],
    codebaseSnapshot: {
      rootPath: "/tmp/test",
      fileCount: 1,
      relevantFiles: [],
    },
    environmentContext: {
      nodeVersion: "18.0.0",
      platform: "darwin",
      workingDirectory: "/tmp",
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
  required?: boolean;
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
    approvalPolicy: { required: overrides.required ?? false, level: "none" },
    executionMode: "auto" as const,
    suggestedActions: [],
  };
}

function createWorkflow(steps: Array<{
  stepId: string;
  dependsOnStepIds: string[];
  roleId?: string;
  timeoutMs?: number;
  maxAttempts?: number;
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
      maxAttempts: s.maxAttempts ?? 1,
    })),
    planReason: "test.workflow",
    dependencyEdges: steps.flatMap(s =>
      s.dependsOnStepIds.map(dep => ({ fromStepId: dep, toStepId: s.stepId }))
    ),
  };
}

// --- PlanBuilder ---

test("PlanBuilder can be instantiated", () => {
  const builder = new PlanBuilder();
  assert.ok(builder instanceof PlanBuilder);
});

test("PlanBuilder.build creates Plan with correct taskId", () => {
  const builder = new PlanBuilder();
  const input: PlanBuilderInput = {
    observation: createMinimalObservation("task_build_test"),
    assessment: createMinimalAssessment("task_build_test"),
    workflow: createWorkflow([{ stepId: "step_a", dependsOnStepIds: [] }]),
  };

  const plan = builder.build(input);

  assert.equal(plan.taskId, "task_build_test");
  assert.ok(plan.planId.startsWith("plan:"));
});

test("PlanBuilder.build creates Plan with steps from workflow", () => {
  const builder = new PlanBuilder();
  const input: PlanBuilderInput = {
    observation: createMinimalObservation("task_steps"),
    assessment: createMinimalAssessment("task_steps"),
    workflow: createWorkflow([
      { stepId: "step_a", dependsOnStepIds: [] },
      { stepId: "step_b", dependsOnStepIds: ["step_a"] },
    ]),
  };

  const plan = builder.build(input);

  assert.ok(plan.steps.length >= 1);
});

test("PlanBuilder.build respects workflow step timeout", () => {
  const builder = new PlanBuilder();
  const input: PlanBuilderInput = {
    observation: createMinimalObservation("task_timeout"),
    assessment: createMinimalAssessment("task_timeout"),
    workflow: createWorkflow([{ stepId: "step_a", dependsOnStepIds: [], timeoutMs: 30000 }]),
  };

  const plan = builder.build(input);

  assert.equal(plan.steps[0]?.timeout, 30000);
});

test("PlanBuilder.build respects workflow step maxAttempts for retry policy", () => {
  const builder = new PlanBuilder();
  const input: PlanBuilderInput = {
    observation: createMinimalObservation("task_retry"),
    assessment: createMinimalAssessment("task_retry"),
    workflow: createWorkflow([{ stepId: "step_a", dependsOnStepIds: [], maxAttempts: 5 }]),
  };

  const plan = builder.build(input);

  assert.equal(plan.steps[0]?.retryPolicy.maxRetries, 4);
});

test("PlanBuilder.build uses replanned strategy for version > 1", () => {
  const builder = new PlanBuilder();
  const input: PlanBuilderInput = {
    observation: createMinimalObservation("task_replan"),
    assessment: createMinimalAssessment("task_replan"),
    workflow: createWorkflow([{ stepId: "step_a", dependsOnStepIds: [] }]),
    version: 2,
  };

  const plan = builder.build(input);

  assert.equal(plan.strategy, "replanned");
});

test("PlanBuilder.build sets parentVersion when version > 1", () => {
  const builder = new PlanBuilder();
  const input: PlanBuilderInput = {
    observation: createMinimalObservation("task_parent"),
    assessment: createMinimalAssessment("task_parent"),
    workflow: createWorkflow([{ stepId: "step_a", dependsOnStepIds: [] }]),
    version: 2,
    parentVersion: 1,
  };

  const plan = builder.build(input);

  assert.equal(plan.parentVersion, 1);
  assert.equal(plan.version, 2);
});

test("PlanBuilder.replan increments version and sets parentVersion", () => {
  const builder = new PlanBuilder();
  const previousPlan: Plan = {
    planId: "plan:test",
    taskId: "task_replan_test",
    version: 1,
    assessmentRef: "assessment:1",
    strategy: "linear",
    steps: [{
      stepId: "step_a",
      action: "read",
      title: "Step A",
      inputs: {},
      outputs: [],
      dependencies: [],
      status: "pending",
      timeout: 5000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    }],
    createdAt: Date.now(),
  };

  const result = builder.replan(previousPlan, {
    observation: createMinimalObservation("task_replan_test"),
    assessment: createMinimalAssessment("task_replan_test"),
    workflow: createWorkflow([{ stepId: "step_a", dependsOnStepIds: [] }]),
  });

  assert.equal(result.version, 2);
  assert.equal(result.parentVersion, 1);
  assert.equal(result.strategy, "replanned");
});

// --- PlanDagValidator ---

test("PlanDagValidator can be instantiated", () => {
  const validator = new PlanDagValidator();
  assert.ok(validator instanceof PlanDagValidator);
});

test("PlanDagValidator.validate returns valid for empty steps", () => {
  const validator = new PlanDagValidator();
  const result = validator.validate([]);

  assert.equal(result.valid, true);
});

test("PlanDagValidator.validate detects cycle", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    { stepId: "a", action: "act", title: "A", inputs: {}, dependencies: ["c"], status: "pending", timeout: 1000, retryPolicy: { maxRetries: 0, backoffMs: 0 } },
    { stepId: "b", action: "act", title: "B", inputs: {}, dependencies: ["a"], status: "pending", timeout: 1000, retryPolicy: { maxRetries: 0, backoffMs: 0 } },
    { stepId: "c", action: "act", title: "C", inputs: {}, dependencies: ["b"], status: "pending", timeout: 1000, retryPolicy: { maxRetries: 0, backoffMs: 0 } },
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some(i => i.includes("cycle")));
});

test("PlanDagValidator.validate detects self-dependency", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    { stepId: "a", action: "act", title: "A", inputs: {}, dependencies: ["a"], status: "pending", timeout: 1000, retryPolicy: { maxRetries: 0, backoffMs: 0 } },
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some(i => i.includes("self_dependency")));
});

test("PlanDagValidator.validate detects missing dependency", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    { stepId: "a", action: "act", title: "A", inputs: {}, dependencies: ["nonexistent"], status: "pending", timeout: 1000, retryPolicy: { maxRetries: 0, backoffMs: 0 } },
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some(i => i.includes("missing_dependency")));
});

test("PlanDagValidator.validate orders steps topologically", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    { stepId: "c", action: "act", title: "C", inputs: {}, dependencies: ["b"], status: "pending", timeout: 1000, retryPolicy: { maxRetries: 0, backoffMs: 0 } },
    { stepId: "b", action: "act", title: "B", inputs: {}, dependencies: ["a"], status: "pending", timeout: 1000, retryPolicy: { maxRetries: 0, backoffMs: 0 } },
    { stepId: "a", action: "act", title: "A", inputs: {}, dependencies: [], status: "pending", timeout: 1000, retryPolicy: { maxRetries: 0, backoffMs: 0 } },
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  assert.equal(result.orderedSteps[0]?.stepId, "a");
  assert.equal(result.orderedSteps[1]?.stepId, "b");
  assert.equal(result.orderedSteps[2]?.stepId, "c");
});

test("PlanDagValidator.analyzeWorstPath returns path for valid DAG", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    { stepId: "a", action: "act", title: "A", inputs: {}, dependencies: [], status: "pending", timeout: 1000, retryPolicy: { maxRetries: 0, backoffMs: 0 } },
    { stepId: "b", action: "act", title: "B", inputs: {}, dependencies: ["a"], status: "pending", timeout: 2000, retryPolicy: { maxRetries: 0, backoffMs: 0 } },
  ];

  const result = validator.analyzeWorstPath(steps);

  assert.ok(result);
  assert.ok(result.pathNodeIds.length > 0);
});

test("PlanDagValidator.analyzeWorstPath returns null for empty steps", () => {
  const validator = new PlanDagValidator();
  const result = validator.analyzeWorstPath([]);

  assert.equal(result, null);
});

// --- PlanEvaluator ---

test("PlanEvaluator can be instantiated", () => {
  const evaluator = new PlanEvaluator();
  assert.ok(evaluator instanceof PlanEvaluator);
});

test("PlanEvaluator.evaluate returns viable for valid plan", () => {
  const evaluator = new PlanEvaluator();
  const plan: Plan = {
    planId: "plan:eval",
    taskId: "task_eval",
    version: 1,
    assessmentRef: "assessment:1",
    strategy: "linear",
    steps: [{
      stepId: "a",
      action: "read",
      title: "A",
      inputs: {},
      outputs: [],
      dependencies: [],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    }],
    createdAt: Date.now(),
  };
  const assessment = createMinimalAssessment("task_eval");

  const result = evaluator.evaluate(plan, assessment);

  assert.equal(result.viable, true);
  assert.equal(result.riskLevel, "medium");
});

test("PlanEvaluator.evaluate flags empty plan as not viable", () => {
  const evaluator = new PlanEvaluator();
  const plan: Plan = {
    planId: "plan:empty",
    taskId: "task_empty",
    version: 1,
    assessmentRef: "assessment:1",
    strategy: "linear",
    steps: [],
    createdAt: Date.now(),
  };
  const assessment = createMinimalAssessment("task_empty");

  const result = evaluator.evaluate(plan, assessment);

  assert.equal(result.viable, false);
  assert.ok(result.issues.some(i => i.includes("empty_plan")));
});

test("PlanEvaluator.evaluate flags critical risk without approval policy", () => {
  const evaluator = new PlanEvaluator();
  const plan: Plan = {
    planId: "plan:critical",
    taskId: "task_critical",
    version: 1,
    assessmentRef: "assessment:1",
    strategy: "linear",
    steps: [{
      stepId: "a",
      action: "read",
      title: "A",
      inputs: {},
      outputs: [],
      dependencies: [],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    }],
    createdAt: Date.now(),
  };
  const assessment = createMinimalAssessment("task_critical", { risk: "critical", required: false });

  const result = evaluator.evaluate(plan, assessment);

  assert.ok(result.issues.some(i => i.includes("missing_critical_approval")));
});

test("PlanEvaluator.evaluate estimates token budget", () => {
  const evaluator = new PlanEvaluator();
  const plan: Plan = {
    planId: "plan:tokens",
    taskId: "task_tokens",
    version: 1,
    assessmentRef: "assessment:1",
    strategy: "linear",
    steps: [{
      stepId: "a",
      action: "read",
      title: "A",
      inputs: {},
      outputs: [],
      dependencies: [],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    }],
    createdAt: Date.now(),
  };
  const assessment = createMinimalAssessment("task_tokens", { maxTokens: 5000 });

  const result = evaluator.evaluate(plan, assessment);

  assert.ok(result.estimatedTokenBudget > 0);
  assert.ok(result.estimatedCostUsd >= 0);
});

test("PlanEvaluator.produceEvaluationReport returns EvaluationReport", () => {
  const evaluator = new PlanEvaluator();
  const plan: Plan = {
    planId: "plan:report",
    taskId: "task_report",
    version: 1,
    assessmentRef: "assessment:1",
    strategy: "linear",
    steps: [{
      stepId: "a",
      action: "read",
      title: "A",
      inputs: {},
      outputs: [],
      dependencies: [],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    }],
    createdAt: Date.now(),
  };
  const assessment = createMinimalAssessment("task_report");

  const report = evaluator.produceEvaluationReport(plan, assessment);

  assert.equal(typeof report.passed, "boolean");
  assert.equal(typeof report.score, "number");
  assert.ok(report.score >= 0 && report.score <= 1);
  assert.ok(report.evaluationId.startsWith("eval_report:"));
  assert.ok(report.evaluatedAt > 0);
});

test("PlanEvaluator.produceEvaluationReport recommends require_human_approval for critical risk", () => {
  const evaluator = new PlanEvaluator();
  const plan: Plan = {
    planId: "plan:rec",
    taskId: "task_rec",
    version: 1,
    assessmentRef: "assessment:1",
    strategy: "linear",
    steps: [{
      stepId: "a",
      action: "read",
      title: "A",
      inputs: {},
      outputs: [],
      dependencies: [],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    }],
    createdAt: Date.now(),
  };
  const assessment = createMinimalAssessment("task_rec", { risk: "critical" });

  const report = evaluator.produceEvaluationReport(plan, assessment);

  assert.equal(report.recommendation, "require_human_approval");
});

test("PlanEvaluator.produceEvaluationReport recommends proceed_to_execute for low risk viable plan", () => {
  const evaluator = new PlanEvaluator();
  const plan: Plan = {
    planId: "plan:proceed",
    taskId: "task_proceed",
    version: 1,
    assessmentRef: "assessment:1",
    strategy: "linear",
    steps: [{
      stepId: "a",
      action: "read",
      title: "A",
      inputs: {},
      outputs: [],
      dependencies: [],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    }],
    createdAt: Date.now(),
  };
  const assessment = createMinimalAssessment("task_proceed", { risk: "low" });

  const report = evaluator.produceEvaluationReport(plan, assessment);

  assert.equal(report.recommendation, "proceed_to_execute");
});

// --- Graph Bundle ---

test("PlanBuilder.buildGraphBundle produces valid graph bundle", () => {
  const builder = new PlanBuilder();
  const bundle = builder.buildGraphBundle({
    observation: createMinimalObservation("task_graph"),
    assessment: createMinimalAssessment("task_graph"),
    workflow: createWorkflow([
      { stepId: "step_a", dependsOnStepIds: [] },
      { stepId: "step_b", dependsOnStepIds: ["step_a"] },
    ]),
    harnessRunId: "harness_001",
  });

  assert.ok(bundle.harnessRunId, "harness_001");
  assert.ok(bundle.graph);
  assert.ok(bundle.graph.nodes);
  assert.ok(bundle.graph.edges);
});

test("PlanBuilder.buildGraphBundle includes entryNodeIds", () => {
  const builder = new PlanBuilder();
  const bundle = builder.buildGraphBundle({
    observation: createMinimalObservation("task_entry"),
    assessment: createMinimalAssessment("task_entry"),
    workflow: createWorkflow([
      { stepId: "start", dependsOnStepIds: [] },
      { stepId: "middle", dependsOnStepIds: ["start"] },
    ]),
    harnessRunId: "harness_entry",
  });

  assert.ok(bundle.graph.entryNodeIds.includes("step_a"));
  assert.equal(bundle.graph.entryNodeIds.length, 1);
});

test("PlanBuilder.buildGraphBundle includes terminalNodeIds", () => {
  const builder = new PlanBuilder();
  const bundle = builder.buildGraphBundle({
    observation: createMinimalObservation("task_terminal"),
    assessment: createMinimalAssessment("task_terminal"),
    workflow: createWorkflow([
      { stepId: "a", dependsOnStepIds: [] },
      { stepId: "b", dependsOnStepIds: ["a"] },
    ]),
    harnessRunId: "harness_terminal",
  });

  assert.ok(bundle.graph.terminalNodeIds.includes("step_b"));
});

test("PlanBuilder.buildGraphBundle includes schedulerPolicy", () => {
  const builder = new PlanBuilder();
  const bundle = builder.buildGraphBundle({
    observation: createMinimalObservation("task_scheduler"),
    assessment: createMinimalAssessment("task_scheduler"),
    workflow: createWorkflow([{ stepId: "step1", dependsOnStepIds: [] }]),
    harnessRunId: "harness_scheduler",
  });

  assert.ok(bundle.schedulerPolicy);
  assert.ok(bundle.schedulerPolicy.policyId.includes("scheduler"));
});

test("PlanBuilder.buildGraphBundle includes riskProfile", () => {
  const builder = new PlanBuilder();
  const bundle = builder.buildGraphBundle({
    observation: createMinimalObservation("task_risk"),
    assessment: createMinimalAssessment("task_risk"),
    workflow: createWorkflow([{ stepId: "step1", dependsOnStepIds: [] }]),
    harnessRunId: "harness_risk",
    riskProfile: { riskClass: "high", reasons: ["test"] },
  });

  assert.equal(bundle.riskProfile.riskClass, "high");
});

test("PlanBuilder.buildGraphBundle uses default riskProfile when not provided", () => {
  const builder = new PlanBuilder();
  const bundle = builder.buildGraphBundle({
    observation: createMinimalObservation("task_default"),
    assessment: createMinimalAssessment("task_default"),
    workflow: createWorkflow([{ stepId: "step1", dependsOnStepIds: [] }]),
    harnessRunId: "harness_default",
  });

  assert.equal(bundle.riskProfile.riskClass, "medium");
});

test("PlanBuilder.buildGraphBundle includes validationReport", () => {
  const builder = new PlanBuilder();
  const bundle = builder.buildGraphBundle({
    observation: createMinimalObservation("task_validation"),
    assessment: createMinimalAssessment("task_validation"),
    workflow: createWorkflow([{ stepId: "step1", dependsOnStepIds: [] }]),
    harnessRunId: "harness_validation",
  });

  assert.ok(bundle.validationReport);
  assert.equal(typeof bundle.validationReport.valid, "boolean");
});

test("PlanBuilder.buildGraphBundle includes budgetPlanRef", () => {
  const builder = new PlanBuilder();
  const bundle = builder.buildGraphBundle({
    observation: createMinimalObservation("task_budget"),
    assessment: createMinimalAssessment("task_budget"),
    workflow: createWorkflow([{ stepId: "step1", dependsOnStepIds: [] }]),
    harnessRunId: "harness_budget",
  });

  assert.ok(bundle.budgetPlanRef.startsWith("budget:plan."));
});

test("PlanBuilder.buildGraphBundle includes graphHash", () => {
  const builder = new PlanBuilder();
  const bundle = builder.buildGraphBundle({
    observation: createMinimalObservation("task_hash"),
    assessment: createMinimalAssessment("task_hash"),
    workflow: createWorkflow([{ stepId: "step1", dependsOnStepIds: [] }]),
    harnessRunId: "harness_hash",
  });

  assert.ok(bundle.graph.graphHash.includes("harness_hash"));
});

// --- Strategy types ---

test("Plan strategy can be linear", () => {
  const builder = new PlanBuilder();
  const input: PlanBuilderInput = {
    observation: createMinimalObservation("task_strategy"),
    assessment: createMinimalAssessment("task_strategy"),
    workflow: createWorkflow([{ stepId: "step_a", dependsOnStepIds: [] }]),
  };

  const plan = builder.build(input);

  assert.ok(["linear", "hierarchical", "tree_branch", "reflexive", "goal_driven", "resource_constrained", "online", "replanned"].includes(plan.strategy));
});