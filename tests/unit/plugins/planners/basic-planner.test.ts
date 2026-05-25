import assert from "node:assert/strict";
import test from "node:test";

import { createBasicPlannerPlugin } from "../../../../src/plugins/planners/basic-planner.js";
import type { UnifiedAssessment } from "../../../../src/platform/five-plane-orchestration/oapeflir/types/unified-assessment.js";

function createAssessment(overrides: Partial<UnifiedAssessment> = {}): UnifiedAssessment {
  return {
    taskId: "task-1",
    timestamp: Date.now(),
    situationRef: "assessment:task-1",
    phase: "pre-execution",
    complexity: "moderate",
    risk: "low",
    riskAssessment: { level: "low", factors: [] },
    routingDecision: {
      division: "coding",
      workflow: "default",
      rationale: "test",
    },
    resourceAllocation: {
      modelClass: "medium",
      maxTokens: 4000,
      timeoutMs: 60_000,
    },
    approvalPolicy: {
      required: false,
      level: "none",
    },
    executionMode: "auto",
    suggestedActions: [],
    ...overrides,
  };
}

function createPlugin() {
  const plugin = createBasicPlannerPlugin();
  assert.equal(plugin.spiType, "planner");
  return plugin;
}

test("basic planner exposes expected plugin metadata", () => {
  const plugin = createPlugin();

  assert.equal(plugin.pluginId, "plugin.core.basic-planner");
  assert.equal(plugin.domainId, "core");
  assert.deepEqual(plugin.capabilityIds, ["workflow.suggest"]);
});

test("basic planner lifecycle hooks update health", async () => {
  const plugin = createPlugin();

  assert.equal(await plugin.healthCheck?.(), false);
  await plugin.initialize?.();
  assert.equal(await plugin.healthCheck?.(), true);
  await plugin.shutdown?.();
  assert.equal(await plugin.healthCheck?.(), false);
});

test("basic planner returns null for critical assessments", async () => {
  const plugin = createPlugin();
  const suggestion = await plugin.suggestWorkflow({
    taskId: "task-critical",
    intent: "ship production migration",
    assessment: createAssessment({ complexity: "critical", risk: "high" }),
  });

  assert.equal(suggestion, null);
});

test("basic planner returns null when assessment is missing at runtime", async () => {
  const plugin = createPlugin();
  const suggestion = await plugin.suggestWorkflow({
    taskId: "task-missing-assessment",
    intent: "malformed input",
    assessment: null,
  } as unknown as Parameters<typeof plugin.suggestWorkflow>[0]);

  assert.equal(suggestion, null);
});

test("basic planner emits direct execution workflow for trivial tasks", async () => {
  const plugin = createPlugin();
  const suggestion = await plugin.suggestWorkflow({
    taskId: "task-trivial",
    intent: "rename variable",
    assessment: createAssessment({ complexity: "trivial" }),
  });

  assert.equal(suggestion?.workflowId, "workflow.core.trivial");
  assert.equal(suggestion?.overrides[0]?.stepName, "direct-execute");
  assert.deepEqual(suggestion?.overrides[0]?.toolHints, ["read", "write"]);
});

test("basic planner adds review and retries for moderate tasks", async () => {
  const plugin = createPlugin();
  const suggestion = await plugin.suggestWorkflow({
    taskId: "task-moderate",
    intent: "refactor module",
    assessment: createAssessment({ complexity: "moderate", risk: "high" }),
  });
  const executeStep = suggestion?.overrides.find((step) => step.stepName === "execute");
  const reviewStep = suggestion?.overrides.find((step) => step.stepName === "review");

  assert.equal(suggestion?.workflowId, "workflow.core.moderate");
  assert.deepEqual(executeStep?.retryPolicy, { maxRetries: 1, backoffMs: 500 });
  assert.equal(reviewStep?.requiresReview, true);
  assert.ok(suggestion?.rationale.includes("risk=high"));
});

test("basic planner adds approval stage for complex tasks", async () => {
  const plugin = createPlugin();
  const suggestion = await plugin.suggestWorkflow({
    taskId: "task-complex",
    intent: "coordinate rollout",
    assessment: createAssessment({ complexity: "complex" }),
  });
  const approveStep = suggestion?.overrides.find((step) => step.stepName === "approve");
  const executeStep = suggestion?.overrides.find((step) => step.stepName === "execute");

  assert.equal(suggestion?.workflowId, "workflow.core.complex");
  assert.equal(approveStep?.requiresReview, true);
  assert.deepEqual(executeStep?.retryPolicy, { maxRetries: 2, backoffMs: 1000 });
});
