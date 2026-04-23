/**
 * Integration Test: Plan Builder
 *
 * Tests the PlanBuilder service which constructs execution plans
 * from workflow definitions and assessments with DAG validation
 * and strategy selection.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext, createSeededIntegrationContext } from "../../../helpers/integration-context.js";
import { PlanBuilder, type PlanBuilderInput } from "../../../../src/platform/orchestration/planner/index.js";
import { WorkflowPlanner } from "../../../../src/platform/orchestration/routing/workflow-planner.js";
import { parseTaskSituation, parseUnifiedAssessment, createAssessmentRef } from "../../../../src/platform/orchestration/oapeflir/types/index.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";

function createTestTaskSituation(taskId: string): ReturnType<typeof parseTaskSituation> {
  return parseTaskSituation({
    taskId,
    timestamp: Date.now(),
    objective: "test objective",
    currentPhase: "planning",
    userIntent: {
      raw: "test request",
      normalized: "test request",
      confidence: 0.85,
    },
    blockers: [],
    codebaseSnapshot: {
      rootPath: "/test",
      fileCount: 5,
      relevantFiles: [],
      gitRef: "abc123",
    },
    environmentContext: {
      nodeVersion: "20.0.0",
      platform: "darwin",
      workingDirectory: "/test",
      availableTools: ["bash", "read", "write"],
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
    },
  });
}

function createTestAssessment(taskId: string, situationRef: string): ReturnType<typeof parseUnifiedAssessment> {
  return parseUnifiedAssessment({
    taskId,
    timestamp: Date.now(),
    situationRef,
    phase: "post-execution",
    complexity: "moderate",
    risk: "medium",
    riskAssessment: {
      level: "medium",
      factors: ["multi_step", "review_required"],
    },
    routingDecision: {
      division: "general_ops",
      workflow: "single_division_multi_step_orchestration",
      rationale: "test routing",
    },
    resourceAllocation: {
      modelClass: "claude-sonnet",
      maxTokens: 4000,
      timeoutMs: 60_000,
    },
    approvalPolicy: {
      required: false,
    },
    executionMode: "auto",
  });
}

test("PlanBuilder creates a plan from workflow and assessment", () => {
  const ctx = createIntegrationContext("aa-plan-builder-basic-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_division_multi_step_orchestration",
      request: "multi-step task",
    });

    const situation = createTestTaskSituation("task-plan-builder-001");
    const assessment = createTestAssessment("task-plan-builder-001", `assessment:task-plan-builder-001:${Date.now()}`);

    const builder = new PlanBuilder();
    const input: PlanBuilderInput = {
      observation: situation,
      assessment,
      workflow: planned,
    };

    const result = builder.build(input);

    assert.ok(result.planId, "Should have planId");
    assert.equal(result.taskId, "task-plan-builder-001");
    assert.equal(result.version, 1);
    assert.ok(result.steps.length > 0, "Should have steps");
    assert.ok(result.createdAt > 0, "Should have createdAt");
  } finally {
    ctx.cleanup();
  }
});

test("PlanBuilder validates DAG and orders steps correctly", () => {
  const ctx = createIntegrationContext("aa-plan-builder-dag-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_division_multi_step_orchestration",
      request: "test dag ordering",
    });

    const situation = createTestTaskSituation("task-plan-builder-dag-001");
    const assessment = createTestAssessment("task-plan-builder-dag-001", `assessment:task-plan-builder-dag-001:${Date.now()}`);

    const builder = new PlanBuilder();
    const result = builder.build({
      observation: situation,
      assessment,
      workflow: planned,
    });

    // Verify step order respects dependencies
    const stepIds = result.steps.map((s) => s.stepId);
    const intakeIndex = stepIds.indexOf("intake_triage");
    const draftIndex = stepIds.indexOf("draft_solution");
    const finalIndex = stepIds.indexOf("final_review");

    assert.ok(intakeIndex >= 0, "Should have intake_triage step");
    assert.ok(draftIndex >= 0, "Should have draft_solution step");
    assert.ok(finalIndex >= 0, "Should have final_review step");

    // intake_triage should come before draft_solution
    assert.ok(intakeIndex < draftIndex, "intake_triage should come before draft_solution");
    // draft_solution should come before final_review
    assert.ok(draftIndex < finalIndex, "draft_solution should come before final_review");

    // Verify all steps have correct dependency references
    for (const step of result.steps) {
      for (const dep of step.dependencies) {
        assert.ok(stepIds.includes(dep), `Dependency ${dep} should exist in step list`);
      }
    }
  } finally {
    ctx.cleanup();
  }
});

test("PlanBuilder assigns correct strategy based on complexity", () => {
  const ctx = createIntegrationContext("aa-plan-builder-strategy-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_agent_minimal",
      request: "simple task",
    });

    const situation = createTestTaskSituation("task-plan-builder-strategy-001");
    const assessment = parseUnifiedAssessment({
      taskId: "task-plan-builder-strategy-001",
      timestamp: Date.now(),
      situationRef: `assessment:task-plan-builder-strategy-001:${Date.now()}`,
      phase: "post-execution",
      complexity: "trivial",
      risk: "low",
      riskAssessment: { level: "low", factors: [] },
      routingDecision: { division: "general_ops", workflow: "single_agent_minimal", rationale: "simple" },
      resourceAllocation: { modelClass: "claude-haiku", maxTokens: 1000, timeoutMs: 30_000 },
      approvalPolicy: { required: false },
      executionMode: "auto",
    });

    const builder = new PlanBuilder();
    const result = builder.build({
      observation: situation,
      assessment,
      workflow: planned,
    });

    assert.equal(result.strategy, "linear");
  } finally {
    ctx.cleanup();
  }
});

test("PlanBuilder creates replan with incremented version", () => {
  const ctx = createIntegrationContext("aa-plan-builder-replan-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_agent_minimal",
      request: "test replan",
    });

    const situation = createTestTaskSituation("task-plan-builder-replan-001");
    const assessment = createTestAssessment("task-plan-builder-replan-001", `assessment:task-plan-builder-replan-001:${Date.now()}`);

    const builder = new PlanBuilder();
    const original = builder.build({
      observation: situation,
      assessment,
      workflow: planned,
    });

    const replanned = builder.replan(original, {
      observation: situation,
      assessment,
      workflow: planned,
    });

    assert.equal(replanned.version, original.version + 1);
    assert.equal(replanned.parentVersion, original.version);
    assert.equal(replanned.strategy, "replanned");
    assert.ok(replanned.planId !== original.planId, "Should have new planId");
  } finally {
    ctx.cleanup();
  }
});

test("PlanBuilder uses seeded integration context", () => {
  const ctx = createSeededIntegrationContext("aa-plan-builder-seeded-");

  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_agent_minimal",
      request: "seeded test",
    });

    const situation = createTestTaskSituation("task-seeded-001");
    const assessment = createTestAssessment("task-seeded-001", `assessment:task-seeded-001:${Date.now()}`);

    const builder = new PlanBuilder();
    const result = builder.build({
      observation: situation,
      assessment,
      workflow: planned,
    });

    assert.ok(result.taskId, "task-seeded-001");
    assert.equal(result.steps.length, 1);

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("PlanBuilder assigns retry policies based on workflow step configuration", () => {
  const ctx = createIntegrationContext("aa-plan-builder-retry-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_division_multi_step_orchestration",
      request: "test retry policies",
    });

    const situation = createTestTaskSituation("task-plan-builder-retry-001");
    const assessment = createTestAssessment("task-plan-builder-retry-001", `assessment:task-plan-builder-retry-001:${Date.now()}`);

    const builder = new PlanBuilder();
    const result = builder.build({
      observation: situation,
      assessment,
      workflow: planned,
    });

    // draft_solution has maxAttempts: 2, so retryPolicy.maxRetries should be 1 (maxAttempts - 1)
    const draftStep = result.steps.find((s) => s.stepId === "draft_solution");
    assert.ok(draftStep, "Should have draft_solution step");
    assert.equal(draftStep!.retryPolicy.maxRetries, 1);

    // intake_triage has maxAttempts: 1, so retryPolicy.maxRetries should be 0
    const intakeStep = result.steps.find((s) => s.stepId === "intake_triage");
    assert.ok(intakeStep, "Should have intake_triage step");
    assert.equal(intakeStep!.retryPolicy.maxRetries, 0);
  } finally {
    ctx.cleanup();
  }
});

test("PlanBuilder sets correct timeout values per step", () => {
  const ctx = createIntegrationContext("aa-plan-builder-timeout-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_division_multi_step_orchestration",
      request: "test timeouts",
    });

    const situation = createTestTaskSituation("task-plan-builder-timeout-001");
    const assessment = createTestAssessment("task-plan-builder-timeout-001", `assessment:task-plan-builder-timeout-001:${Date.now()}`);

    const builder = new PlanBuilder();
    const result = builder.build({
      observation: situation,
      assessment,
      workflow: planned,
    });

    const intakeStep = result.steps.find((s) => s.stepId === "intake_triage");
    assert.equal(intakeStep!.timeout, 60_000);

    const draftStep = result.steps.find((s) => s.stepId === "draft_solution");
    assert.equal(draftStep!.timeout, 180_000);

    const finalStep = result.steps.find((s) => s.stepId === "final_review");
    assert.equal(finalStep!.timeout, 90_000);
  } finally {
    ctx.cleanup();
  }
});