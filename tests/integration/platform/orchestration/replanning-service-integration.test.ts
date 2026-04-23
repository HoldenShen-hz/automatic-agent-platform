/**
 * Integration Test: Replanning Service
 *
 * Tests the ReplanningService which determines whether a workflow
 * needs replanning based on feedback signals and execution outcomes.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { ReplanningService, type ReplanningTrigger } from "../../../../src/platform/orchestration/planner/replanning-service.js";
import type { Plan } from "../../../../src/platform/orchestration/oapeflir/types/plan.js";
import { parsePlan } from "../../../../src/platform/orchestration/oapeflir/types/plan.js";
import type { FeedbackBatch } from "../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { parseFeedbackBatch } from "../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function createTestPlan(taskId: string, version: number = 1): Plan {
  return parsePlan({
    planId: `plan_test_${taskId}`,
    taskId,
    version,
    assessmentRef: `assessment:${taskId}:${Date.now()}`,
    strategy: "linear",
    steps: [
      {
        stepId: "step_1",
        action: "execute",
        inputs: {},
        dependencies: [],
        status: "done",
        timeout: 60000,
        retryPolicy: { maxRetries: 0, backoffMs: 250 },
      },
    ],
    createdAt: Date.now(),
  });
}

function createFeedbackBatch(taskId: string, outcome: "repairable" | "failed" | "escalated", signals: Array<{ category: string }> = []): FeedbackBatch {
  return parseFeedbackBatch({
    feedbackId: `feedback_${Math.random().toString(36).slice(2)}`,
    taskId,
    executionId: null,
    planId: null,
    outcome,
    signals: signals.map((s, idx) => ({
      signalId: `sig_${idx}_${Math.random().toString(36).slice(2)}`,
      source: "execution" as const,
      taskId,
      category: s.category as "correction" | "error" | "warning" | "success" | "timeout" | "partial",
      severity: "medium" as const,
      payload: { summary: "test", reasonCode: "test", durationMs: 100 },
      stepOutputRefs: [],
      timestamp: Date.now(),
    })),
    emittedAt: Date.now(),
  });
}

test("ReplanningService creates replanning trigger", () => {
  const ctx = createIntegrationContext("aa-replan-trigger-");
  try {
    const service = new ReplanningService();

    const trigger = service.createTrigger("task_123", "feedback.execution_deviation", "feedback", "Test summary");

    assert.ok(trigger.triggerId, "Should have triggerId");
    assert.equal(trigger.taskId, "task_123");
    assert.equal(trigger.reasonCode, "feedback.execution_deviation");
    assert.equal(trigger.source, "feedback");
    assert.equal(trigger.summary, "Test summary");
  } finally {
    ctx.cleanup();
  }
});

test("ReplanningService decides to replan for repairable outcome", () => {
  const ctx = createIntegrationContext("aa-replan-decision-repair-");
  try {
    const service = new ReplanningService();
    const plan = createTestPlan("task_repairable");

    const feedback = createFeedbackBatch("repairable");
    const decision = service.decide(plan, feedback);

    assert.equal(decision.shouldReplan, true);
    assert.equal(decision.nextPlanVersion, 2);
    assert.equal(decision.strategy, "replanned");
    assert.equal(decision.taskId, plan.taskId);
    assert.ok(decision.decisionId);
    assert.ok(decision.decidedAt > 0);
  } finally {
    ctx.cleanup();
  }
});

test("ReplanningService decides to replan when signals include correction", () => {
  const ctx = createIntegrationContext("aa-replan-decision-correction-");
  try {
    const service = new ReplanningService();
    const plan = createTestPlan("task_correction");

    const feedback = createFeedbackBatch("failed", [{ category: "correction" }]);
    const decision = service.decide(plan, feedback);

    assert.equal(decision.shouldReplan, true);
    assert.equal(decision.nextPlanVersion, 2);
  } finally {
    ctx.cleanup();
  }
});

test("ReplanningService decides to replan for failed outcome", () => {
  const ctx = createIntegrationContext("aa-replan-decision-failed-");
  try {
    const service = new ReplanningService();
    const plan = createTestPlan("task_failed");

    const feedback = createFeedbackBatch("failed");
    const decision = service.decide(plan, feedback);

    assert.equal(decision.shouldReplan, true);
    assert.equal(decision.nextPlanVersion, 2);
    assert.equal(decision.strategy, "replanned");
  } finally {
    ctx.cleanup();
  }
});

test("ReplanningService decides to replan for escalated outcome", () => {
  const ctx = createIntegrationContext("aa-replan-decision-escalated-");
  try {
    const service = new ReplanningService();
    const plan = createTestPlan("task_escalated");

    const feedback = createFeedbackBatch("escalated");
    const decision = service.decide(plan, feedback);

    assert.equal(decision.shouldReplan, true);
    assert.equal(decision.nextPlanVersion, 2);
  } finally {
    ctx.cleanup();
  }
});

test("ReplanningService decides NOT to replan for successful execution", () => {
  const ctx = createIntegrationContext("aa-replan-no-replan-");
  try {
    const service = new ReplanningService();
    const plan = createTestPlan("task_success");

    const feedback: FeedbackBatch = {
      taskId: "task_success",
      outcome: "succeeded",
      signals: [],
    };
    const decision = service.decide(plan, feedback);

    assert.equal(decision.shouldReplan, false);
    assert.equal(decision.nextPlanVersion, null);
    assert.equal(decision.strategy, null);
    assert.equal(decision.reasonCode, "planning.no_replan_required");
  } finally {
    ctx.cleanup();
  }
});

test("ReplanningService uses trigger reasonCode when provided", () => {
  const ctx = createIntegrationContext("aa-replan-trigger-reason-");
  try {
    const service = new ReplanningService();
    const plan = createTestPlan("task_trigger");

    const feedback = createFeedbackBatch("repairable");
    const trigger = service.createTrigger("task_trigger", "validation.repair_required", "validation", "Validation detected deviation");

    const decision = service.decide(plan, feedback, trigger);

    assert.equal(decision.shouldReplan, true);
    assert.equal(decision.reasonCode, "validation.repair_required");
  } finally {
    ctx.cleanup();
  }
});

test("ReplanningService increments version correctly on replan", () => {
  const ctx = createIntegrationContext("aa-replan-version-");
  try {
    const service = new ReplanningService();
    const plan = createTestPlan("task_version", 5);

    const feedback = createFeedbackBatch("repairable");
    const decision = service.decide(plan, feedback);

    assert.equal(decision.nextPlanVersion, 6);
  } finally {
    ctx.cleanup();
  }
});

test("ReplanningService integration with seeded context", () => {
  const ctx = createIntegrationContext("aa-replan-seeded-");

  try {
    const service = new ReplanningService();
    const plan = createTestPlan("task_seed");

    const feedback = createFeedbackBatch("repairable");
    const decision = service.decide(plan, feedback);

    assert.equal(decision.shouldReplan, true);
    assert.equal(decision.taskId, plan.taskId);

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});