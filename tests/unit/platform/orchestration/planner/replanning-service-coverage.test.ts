/**
 * ReplanningService Extended Unit Tests
 *
 * Tests for ReplanningService business logic including edge cases,
 * trigger creation, and decision-making scenarios.
 *
 * Architecture: §20 OAPEFLIR Replanning
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ReplanningService } from "../../../../../src/platform/five-plane-orchestration/planner/replanning-service.js";
import type { Plan } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";
import type { FeedbackBatch } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function createPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    planId: "plan_test",
    taskId: "task_test",
    assessmentRef: "assessment:test:1",
    version: 1,
    strategy: "linear",
    steps: [],
    createdAt: Date.now(),
    ...overrides,
  };
}

function createFeedback(overrides: Partial<FeedbackBatch> = {}): FeedbackBatch {
  return {
    feedbackId: "fb_test",
    taskId: "task_test",
    executionId: null,
    planId: "plan_test",
    outcome: "completed",
    signals: [],
    emittedAt: Date.now(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// createTrigger Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReplanningService.createTrigger generates unique triggerId", () => {
  const service = new ReplanningService();
  const trigger1 = service.createTrigger("task_1", "reason_1", "feedback", "summary 1");
  const trigger2 = service.createTrigger("task_1", "reason_1", "feedback", "summary 1");

  assert.notEqual(trigger1.triggerId, trigger2.triggerId);
});

test("ReplanningService.createTrigger preserves all parameters", () => {
  const service = new ReplanningService();
  const trigger = service.createTrigger("task_x", "planning.test", "operator", "Test summary");

  assert.equal(trigger.taskId, "task_x");
  assert.equal(trigger.reasonCode, "planning.test");
  assert.equal(trigger.source, "operator");
  assert.equal(trigger.summary, "Test summary");
});

test("ReplanningService.createTrigger handles all source types", () => {
  const service = new ReplanningService();
  const sources = ["feedback", "validation", "operator"] as const;

  for (const source of sources) {
    const trigger = service.createTrigger("task", "reason", source, "summary");
    assert.equal(trigger.source, source);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// decide - Outcome-based Replanning Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReplanningService.decide replans for repairable outcome", () => {
  const service = new ReplanningService();
  const plan = createPlan({ version: 5 });
  const feedback = createFeedback({ outcome: "repairable" });

  const decision = service.decide(plan, feedback);

  assert.equal(decision.shouldReplan, true);
  assert.equal(decision.nextPlanVersion, 6);
  assert.equal(decision.strategy, "replanned");
});

test("ReplanningService.decide replans for failed outcome", () => {
  const service = new ReplanningService();
  const plan = createPlan({ version: 3 });
  const feedback = createFeedback({ outcome: "failed" });

  const decision = service.decide(plan, feedback);

  assert.equal(decision.shouldReplan, true);
  assert.equal(decision.nextPlanVersion, 4);
});

test("ReplanningService.decide replans for escalated outcome", () => {
  const service = new ReplanningService();
  const plan = createPlan({ version: 1 });
  const feedback = createFeedback({ outcome: "escalated" });

  const decision = service.decide(plan, feedback);

  assert.equal(decision.shouldReplan, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// decide - Signal-based Replanning Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReplanningService.decide replans when signals contain correction category", () => {
  const service = new ReplanningService();
  const plan = createPlan({ version: 2 });
  const feedback = createFeedback({
    outcome: "completed",
    signals: [
      {
        signalId: "sig_correction",
        source: "user" as const,
        taskId: "task_test",
        category: "correction" as const,
        severity: "warning" as const,
        payload: { summary: "user corrected approach" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
  });

  const decision = service.decide(plan, feedback);

  assert.equal(decision.shouldReplan, true);
});

test("ReplanningService.decide does not replan for success signals only", () => {
  const service = new ReplanningService();
  const plan = createPlan({ version: 1 });
  const feedback = createFeedback({
    outcome: "completed",
    signals: [
      {
        signalId: "sig_success",
        source: "execution" as const,
        taskId: "task_test",
        category: "success" as const,
        severity: "info" as const,
        payload: { summary: "task completed" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
  });

  const decision = service.decide(plan, feedback);

  assert.equal(decision.shouldReplan, false);
});

test("ReplanningService.decide does not replan when signals only have failure category (not correction)", () => {
  const service = new ReplanningService();
  const plan = createPlan({ version: 1 });
  const feedback = createFeedback({
    outcome: "completed",
    signals: [
      {
        signalId: "sig_failure",
        source: "execution" as const,
        taskId: "task_test",
        category: "failure" as const,
        severity: "error" as const,
        payload: { summary: "step failed" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
  });

  const decision = service.decide(plan, feedback);

  // failure outcome in signals doesn't trigger replan unless outcome is failed/escalated
  assert.equal(decision.shouldReplan, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// decide - No Replan Scenarios
// ─────────────────────────────────────────────────────────────────────────────

test("ReplanningService.decide does not replan for completed outcome with no correction signals", () => {
  const service = new ReplanningService();
  const plan = createPlan({ version: 1 });
  const feedback = createFeedback({ outcome: "completed" });

  const decision = service.decide(plan, feedback);

  assert.equal(decision.shouldReplan, false);
  assert.equal(decision.nextPlanVersion, null);
  assert.equal(decision.strategy, null);
});

test("ReplanningService.decide does not replan for partial outcome with success signals", () => {
  const service = new ReplanningService();
  const plan = createPlan();
  const feedback = createFeedback({
    outcome: "completed", // using completed as proxy for "good enough"
    signals: [
      {
        signalId: "sig_partial",
        source: "execution" as const,
        taskId: "task_test",
        category: "success" as const,
        severity: "info" as const,
        payload: { summary: "partial success" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
  });

  const decision = service.decide(plan, feedback);

  assert.equal(decision.shouldReplan, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// decide - Trigger Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReplanningService.decide uses trigger reasonCode when provided", () => {
  const service = new ReplanningService();
  const plan = createPlan({ version: 1 });
  const feedback = createFeedback({ outcome: "repairable" });
  const trigger = service.createTrigger("task_test", "planning.user_requested_replan", "operator", "User explicitly requested replan");

  const decision = service.decide(plan, feedback, trigger);

  assert.equal(decision.reasonCode, "planning.user_requested_replan");
});

test("ReplanningService.decide uses fallback reasonCode when trigger is undefined", () => {
  const service = new ReplanningService();
  const plan = createPlan({ version: 1 });
  const feedback = createFeedback({ outcome: "repairable" });

  const decision = service.decide(plan, feedback, undefined);

  assert.equal(decision.reasonCode, "planning.execution_deviation");
});

test("ReplanningService.decide uses fallback reasonCode when trigger is null", () => {
  const service = new ReplanningService();
  const plan = createPlan({ version: 1 });
  const feedback = createFeedback({ outcome: "repairable" });

  const decision = service.decide(plan, feedback, null);

  assert.equal(decision.reasonCode, "planning.execution_deviation");
});

test("ReplanningService.decide uses no_replan_required for successful no-replan case", () => {
  const service = new ReplanningService();
  const plan = createPlan();
  const feedback = createFeedback({ outcome: "completed" });

  const decision = service.decide(plan, feedback);

  assert.equal(decision.reasonCode, "planning.no_replan_required");
});

// ─────────────────────────────────────────────────────────────────────────────
// decide - Decision Properties Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReplanningService.decide includes decisionId", () => {
  const service = new ReplanningService();
  const decision = service.decide(createPlan(), createFeedback());

  assert.ok(decision.decisionId.startsWith("replan_decision_"));
});

test("ReplanningService.decide includes taskId from plan", () => {
  const service = new ReplanningService();
  const plan = createPlan({ taskId: "task_custom_id" });
  const decision = service.decide(plan, createFeedback());

  assert.equal(decision.taskId, "task_custom_id");
});

test("ReplanningService.decide includes decidedAt timestamp", () => {
  const service = new ReplanningService();
  const before = Date.now();
  const decision = service.decide(createPlan(), createFeedback());
  const after = Date.now();

  assert.ok(decision.decidedAt >= before && decision.decidedAt <= after);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("ReplanningService.decide handles plan with version 0", () => {
  const service = new ReplanningService();
  const plan = createPlan({ version: 0 });
  const feedback = createFeedback({ outcome: "failed" });

  const decision = service.decide(plan, feedback);

  assert.equal(decision.shouldReplan, true);
  assert.equal(decision.nextPlanVersion, 1);
});

test("ReplanningService.decide handles very high plan version", () => {
  const service = new ReplanningService();
  const plan = createPlan({ version: 9999 });
  const feedback = createFeedback({ outcome: "repairable" });

  const decision = service.decide(plan, feedback);

  assert.equal(decision.shouldReplan, true);
  assert.equal(decision.nextPlanVersion, 10000);
});

test("ReplanningService.decide handles empty signals array", () => {
  const service = new ReplanningService();
  const feedback = createFeedback({ signals: [] });

  const decision = service.decide(createPlan(), feedback);

  assert.equal(decision.shouldReplan, false);
});

test("ReplanningService.decide handles feedback with null executionId", () => {
  const service = new ReplanningService();
  const feedback = createFeedback({ executionId: null });

  const decision = service.decide(createPlan(), feedback);

  assert.equal(decision.taskId, "task_test");
});

test("ReplanningService.decide handles feedback with null planId", () => {
  const service = new ReplanningService();
  const feedback = createFeedback({ planId: null });

  const decision = service.decide(createPlan(), feedback);

  assert.equal(decision.shouldReplan, false); // outcome is completed by default
});

test("ReplanningService handles multiple sequential replan decisions", () => {
  const service = new ReplanningService();
  const plan1 = createPlan({ version: 1 });
  const feedback1 = createFeedback({ outcome: "repairable" });
  const decision1 = service.decide(plan1, feedback1);

  const plan2 = createPlan({ version: decision1.nextPlanVersion! });
  const feedback2 = createFeedback({ outcome: "failed" });
  const decision2 = service.decide(plan2, feedback2);

  assert.equal(decision1.nextPlanVersion, 2);
  assert.equal(decision2.nextPlanVersion, 3);
  assert.equal(decision2.strategy, "replanned");
});

// ─────────────────────────────────────────────────────────────────────────────
// Strategy Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReplanningService.decide strategy is null when shouldReplan is false", () => {
  const service = new ReplanningService();
  const decision = service.decide(createPlan(), createFeedback({ outcome: "completed" }));

  assert.equal(decision.strategy, null);
});

test("ReplanningService.decide strategy is replanned when shouldReplan is true", () => {
  const service = new ReplanningService();
  const decision = service.decide(createPlan(), createFeedback({ outcome: "failed" }));

  assert.equal(decision.strategy, "replanned");
});

test("ReplanningService.decide strategy is replanned for correction signal", () => {
  const service = new ReplanningService();
  const decision = service.decide(createPlan(), createFeedback({
    outcome: "completed",
    signals: [
      {
        signalId: "sig_c",
        source: "user" as const,
        taskId: "task_test",
        category: "correction" as const,
        severity: "warning" as const,
        payload: {},
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
  }));

  assert.equal(decision.strategy, "replanned");
});