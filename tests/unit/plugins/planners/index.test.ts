import assert from "node:assert/strict";
import test from "node:test";

import * as PlannersIndex from "../../../../src/plugins/planners/index.js";

test("PlannersIndex exports basic-planner", () => {
  assert.ok(PlannersIndex.createBasicPlannerPlugin !== undefined);
});

test("PlannersIndex creates BasicPlannerPlugin successfully", () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();
  assert.ok(plugin !== undefined);
});

test("PlannersIndex BasicPlannerPlugin has correct metadata", () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();

  assert.equal(plugin.pluginId, "plugin.core.basic-planner");
  assert.equal(plugin.spiType, "planner");
});

test("PlannersIndex BasicPlannerPlugin has suggestWorkflow method", () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();
  assert.ok(typeof plugin.suggestWorkflow === "function");
  assert.ok(plugin.capabilityIds != null);
  assert.ok((plugin.capabilityIds as readonly string[]).includes("workflow.suggest"));
});

test("PlannersIndex BasicPlannerPlugin.initialize is no-op", async () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();
  if (plugin.initialize) {
    const result = await plugin.initialize();
    assert.equal(result, undefined);
  } else {
    assert.ok(true);
  }
});

test("PlannersIndex BasicPlannerPlugin.shutdown is no-op", async () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();
  if (plugin.shutdown) {
    const result = await plugin.shutdown();
    assert.equal(result, undefined);
  } else {
    assert.ok(true);
  }
});

test("PlannersIndex BasicPlannerPlugin.capabilityIds includes workflow.suggest", () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();
  assert.ok(plugin.capabilityIds != null);
  assert.ok((plugin.capabilityIds as readonly string[]).includes("workflow.suggest"));
});

test("PlannersIndex BasicPlannerPlugin.suggestWorkflow works for trivial complexity", async () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();
  const result = await plugin.suggestWorkflow({
    taskId: "task_trivial",
    intent: "simple task",
    assessment: {
      taskId: "task_trivial",
      timestamp: Date.now(),
      situationRef: "situation_1",
      phase: "pre-execution" as const,
      complexity: "trivial" as const,
      risk: "low" as const,
      riskAssessment: { level: "low" as const, factors: [] },
      routingDecision: { division: "core", workflow: "default", rationale: "test" },
      resourceAllocation: { modelClass: "standard", maxTokens: 1000, timeoutMs: 60000 },
      approvalPolicy: { required: false },
      executionMode: "auto" as const,
      suggestedActions: [],
    },
  });
  assert.ok(result !== null);
  assert.equal(result.overrides.length, 1);
  assert.equal(result.overrides[0]!.stepName, "direct-execute");
});

test("PlannersIndex BasicPlannerPlugin.suggestWorkflow works for simple complexity", async () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();
  const result = await plugin.suggestWorkflow({
    taskId: "task_simple",
    intent: "basic task",
    assessment: {
      taskId: "task_simple",
      timestamp: Date.now(),
      situationRef: "situation_2",
      phase: "pre-execution" as const,
      complexity: "simple" as const,
      risk: "low" as const,
      riskAssessment: { level: "low" as const, factors: [] },
      routingDecision: { division: "core", workflow: "default", rationale: "test" },
      resourceAllocation: { modelClass: "standard", maxTokens: 1000, timeoutMs: 60000 },
      approvalPolicy: { required: false },
      executionMode: "auto" as const,
      suggestedActions: [],
    },
  });
  assert.ok(result !== null);
  assert.equal(result.overrides.length, 1);
  assert.equal(result.overrides[0]!.stepName, "direct-execute");
});

test("PlannersIndex BasicPlannerPlugin.suggestWorkflow works for moderate complexity", async () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();
  const result = await plugin.suggestWorkflow({
    taskId: "task_moderate",
    intent: "moderate task",
    assessment: {
      taskId: "task_moderate",
      timestamp: Date.now(),
      situationRef: "situation_3",
      phase: "pre-execution" as const,
      complexity: "moderate" as const,
      risk: "low" as const,
      riskAssessment: { level: "low" as const, factors: [] },
      routingDecision: { division: "core", workflow: "default", rationale: "test" },
      resourceAllocation: { modelClass: "standard", maxTokens: 1000, timeoutMs: 60000 },
      approvalPolicy: { required: false },
      executionMode: "auto" as const,
      suggestedActions: [],
    },
  });
  assert.ok(result !== null);
  assert.equal(result.overrides.length, 3);
  assert.equal(result.overrides[0]!.stepName, "plan");
  assert.equal(result.overrides[1]!.stepName, "execute");
  assert.equal(result.overrides[2]!.stepName, "review");
});

test("PlannersIndex BasicPlannerPlugin.suggestWorkflow works for complex complexity", async () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();
  const result = await plugin.suggestWorkflow({
    taskId: "task_complex",
    intent: "complex task",
    assessment: {
      taskId: "task_complex",
      timestamp: Date.now(),
      situationRef: "situation_4",
      phase: "pre-execution" as const,
      complexity: "complex" as const,
      risk: "high" as const,
      riskAssessment: { level: "high" as const, factors: [] },
      routingDecision: { division: "core", workflow: "default", rationale: "test" },
      resourceAllocation: { modelClass: "standard", maxTokens: 1000, timeoutMs: 60000 },
      approvalPolicy: { required: false },
      executionMode: "auto" as const,
      suggestedActions: [],
    },
  });
  assert.ok(result !== null);
  assert.equal(result.overrides.length, 4);
  assert.equal(result.overrides[0]!.stepName, "plan");
  assert.equal(result.overrides[1]!.stepName, "approve");
  assert.equal(result.overrides[2]!.stepName, "execute");
  assert.equal(result.overrides[3]!.stepName, "validate");
});

test("PlannersIndex BasicPlannerPlugin.suggestWorkflow returns null for critical complexity", async () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();
  const result = await plugin.suggestWorkflow({
    taskId: "task_critical",
    intent: "critical task",
    assessment: {
      taskId: "task_critical",
      timestamp: Date.now(),
      situationRef: "situation_5",
      phase: "pre-execution" as const,
      complexity: "critical" as const,
      risk: "high" as const,
      riskAssessment: { level: "high" as const, factors: [] },
      routingDecision: { division: "core", workflow: "default", rationale: "test" },
      resourceAllocation: { modelClass: "standard", maxTokens: 1000, timeoutMs: 60000 },
      approvalPolicy: { required: false },
      executionMode: "auto" as const,
      suggestedActions: [],
    },
  });
  assert.equal(result, null);
});

test("PlannersIndex BasicPlannerPlugin.suggestWorkflow includes rationale in result", async () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();
  const result = await plugin.suggestWorkflow({
    taskId: "task_rationale",
    intent: "test",
    assessment: {
      taskId: "task_rationale",
      timestamp: Date.now(),
      situationRef: "situation_6",
      phase: "pre-execution" as const,
      complexity: "moderate" as const,
      risk: "medium" as const,
      riskAssessment: { level: "medium" as const, factors: [] },
      routingDecision: { division: "core", workflow: "default", rationale: "testing" },
      resourceAllocation: { modelClass: "standard", maxTokens: 1000, timeoutMs: 60000 },
      approvalPolicy: { required: false },
      executionMode: "auto" as const,
      suggestedActions: [],
    },
  });
  assert.ok(result !== null);
  assert.ok(result.rationale.includes("assessment=moderate"));
  assert.ok(result.rationale.includes("risk=medium"));
});

test("PlannersIndex BasicPlannerPlugin.suggestWorkflow sets requiresReview when approval required", async () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();
  const result = await plugin.suggestWorkflow({
    taskId: "task_approval",
    intent: "test",
    assessment: {
      taskId: "task_approval",
      timestamp: Date.now(),
      situationRef: "situation_7",
      phase: "pre-execution" as const,
      complexity: "moderate" as const,
      risk: "low" as const,
      riskAssessment: { level: "low" as const, factors: [] },
      routingDecision: { division: "core", workflow: "default", rationale: "test" },
      resourceAllocation: { modelClass: "standard", maxTokens: 1000, timeoutMs: 60000 },
      approvalPolicy: { required: true },
      executionMode: "auto" as const,
      suggestedActions: [],
    },
  });
  assert.ok(result !== null);
  assert.ok(result.overrides.some((step) => step.requiresReview === true));
});

test("PlannersIndex BasicPlannerPlugin.suggestWorkflow sets requiresReview when risk is high", async () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();
  const result = await plugin.suggestWorkflow({
    taskId: "task_risk",
    intent: "test",
    assessment: {
      taskId: "task_risk",
      timestamp: Date.now(),
      situationRef: "situation_8",
      phase: "pre-execution" as const,
      complexity: "moderate" as const,
      risk: "high" as const,
      riskAssessment: { level: "high" as const, factors: [] },
      routingDecision: { division: "core", workflow: "default", rationale: "test" },
      resourceAllocation: { modelClass: "standard", maxTokens: 1000, timeoutMs: 60000 },
      approvalPolicy: { required: false },
      executionMode: "auto" as const,
      suggestedActions: [],
    },
  });
  assert.ok(result !== null);
  assert.ok(result.overrides.some((step) => step.requiresReview === true));
});

test("PlannersIndex BasicPlannerPlugin.suggestWorkflow includes retryPolicy for execute steps", async () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();
  const result = await plugin.suggestWorkflow({
    taskId: "task_retry",
    intent: "test",
    assessment: {
      taskId: "task_retry",
      timestamp: Date.now(),
      situationRef: "situation_9",
      phase: "pre-execution" as const,
      complexity: "moderate" as const,
      risk: "low" as const,
      riskAssessment: { level: "low" as const, factors: [] },
      routingDecision: { division: "core", workflow: "default", rationale: "test" },
      resourceAllocation: { modelClass: "standard", maxTokens: 1000, timeoutMs: 60000 },
      approvalPolicy: { required: false },
      executionMode: "auto" as const,
      suggestedActions: [],
    },
  });
  assert.ok(result !== null);
  const executeStep = result.overrides.find((s) => s.stepName === "execute");
  assert.ok(executeStep);
  assert.ok(executeStep.retryPolicy);
  assert.equal(executeStep.retryPolicy.maxRetries, 1);
});
