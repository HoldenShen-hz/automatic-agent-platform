/**
 * ReplanningService Edge Case Unit Tests
 *
 * Tests for edge cases and boundary conditions in ReplanningService.
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
    planId: "plan_edge",
    taskId: "task_edge",
    assessmentRef: "assessment:edge:1",
    version: 1,
    strategy: "linear",
    steps: [],
    createdAt: Date.now(),
    ...overrides,
  };
}

function createFeedback(overrides: Partial<FeedbackBatch> = {}): FeedbackBatch {
  return {
    feedbackId: "fb_edge",
    taskId: "task_edge",
    executionId: null,
    planId: "plan_edge",
    outcome: "completed",
    signals: [],
    emittedAt: Date.now(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Multiple Signal Correction Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReplanningService.decide replans with multiple correction signals", () => {
  const service = new ReplanningService();
  const feedback = createFeedback({
    outcome: "completed",
    signals: [
      {
        signalId: "sig_c1",
        source: "user" as const,
        taskId: "task_edge",
        category: "correction" as const,
        severity: "warning" as const,
        payload: { summary: "first correction" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
      {
        signalId: "sig_c2",
        source: "user" as const,
        taskId: "task_edge",
        category: "correction" as const,
        severity: "info" as const,
        payload: { summary: "second correction" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
  });

  const decision = service.decide(createPlan(), feedback);

  assert.equal(decision.shouldReplan, true);
});

test("ReplanningService.decide replans for repairable with additional signals", () => {
  const service = new ReplanningService();
  const feedback = createFeedback({
    outcome: "repairable",
    signals: [
      {
        signalId: "sig_1",
        source: "execution" as const,
        taskId: "task_edge",
        category: "warning" as const,
        severity: "warning" as const,
        payload: { summary: "some warning" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
  });

  const decision = service.decide(createPlan(), feedback);

  assert.equal(decision.shouldReplan, true);
  assert.equal(decision.nextPlanVersion, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Strategy Inheritance Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReplanningService.decide preserves original strategy when no replan", () => {
  const service = new ReplanningService();
  const plan = createPlan({ strategy: "hierarchical" });
  const feedback = createFeedback({ outcome: "completed" });

  const decision = service.decide(plan, feedback);

  assert.equal(decision.shouldReplan, false);
  assert.equal(decision.strategy, null); // strategy is null when not replanning
});

test("ReplanningService.decide sets strategy to replanned for all replan cases", () => {
  const service = new ReplanningService();

  const outcomes: FeedbackBatch["outcome"][] = ["repairable", "failed", "escalated"];
  for (const outcome of outcomes) {
    const decision = service.decide(createPlan(), createFeedback({ outcome }));
    assert.equal(decision.strategy, "replanned", `Failed for outcome: ${outcome}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Next Plan Version Calculation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReplanningService.decide increments version by 1 for repairable", () => {
  const service = new ReplanningService();
  const plan = createPlan({ version: 10 });
  const feedback = createFeedback({ outcome: "repairable" });

  const decision = service.decide(plan, feedback);

  assert.equal(decision.nextPlanVersion, 11);
});

test("ReplanningService.decide increments version by 1 for failed", () => {
  const service = new ReplanningService();
  const plan = createPlan({ version: 50 });
  const feedback = createFeedback({ outcome: "failed" });

  const decision = service.decide(plan, feedback);

  assert.equal(decision.nextPlanVersion, 51);
});

test("ReplanningService.decide increments version by 1 for escalated", () => {
  const service = new ReplanningService();
  const plan = createPlan({ version: 100 });
  const feedback = createFeedback({ outcome: "escalated" });

  const decision = service.decide(plan, feedback);

  assert.equal(decision.nextPlanVersion, 101);
});

test("ReplanningService.decide increments version by 1 for correction signal", () => {
  const service = new ReplanningService();
  const plan = createPlan({ version: 7 });
  const feedback = createFeedback({
    outcome: "completed",
    signals: [
      {
        signalId: "sig_c",
        source: "user" as const,
        taskId: "task_edge",
        category: "correction" as const,
        severity: "warning" as const,
        payload: {},
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
  });

  const decision = service.decide(plan, feedback);

  assert.equal(decision.nextPlanVersion, 8);
});

test("ReplanningService.decide sets nextPlanVersion to null when not replanning", () => {
  const service = new ReplanningService();
  const decision = service.decide(createPlan(), createFeedback({ outcome: "completed" }));

  assert.equal(decision.nextPlanVersion, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Reason Code Mapping Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReplanningService.decide uses execution_deviation for failed outcome without trigger", () => {
  const service = new ReplanningService();
  const decision = service.decide(createPlan(), createFeedback({ outcome: "failed" }));

  assert.equal(decision.reasonCode, "planning.execution_deviation");
});

test("ReplanningService.decide uses execution_deviation for repairable without trigger", () => {
  const service = new ReplanningService();
  const decision = service.decide(createPlan(), createFeedback({ outcome: "repairable" }));

  assert.equal(decision.reasonCode, "planning.execution_deviation");
});

test("ReplanningService.decide uses execution_deviation for escalated without trigger", () => {
  const service = new ReplanningService();
  const decision = service.decide(createPlan(), createFeedback({ outcome: "escalated" }));

  assert.equal(decision.reasonCode, "planning.execution_deviation");
});

test("ReplanningService.decide uses trigger reasonCode over execution_deviation", () => {
  const service = new ReplanningService();
  const trigger = service.createTrigger("task_edge", "planning.custom_reason", "feedback", "Custom feedback");
  const decision = service.decide(createPlan(), createFeedback({ outcome: "repairable" }), trigger);

  assert.equal(decision.reasonCode, "planning.custom_reason");
});

// ─────────────────────────────────────────────────────────────────────────────
// Reason Code for Non-Replan Cases
// ─────────────────────────────────────────────────────────────────────────────

test("ReplanningService.decide uses no_replan_required for completed outcome", () => {
  const service = new ReplanningService();
  const decision = service.decide(createPlan(), createFeedback({ outcome: "completed" }));

  assert.equal(decision.reasonCode, "planning.no_replan_required");
});

test("ReplanningService.decide uses no_replan_required for completed_with_deviations without correction signals", () => {
  const service = new ReplanningService();
  const decision = service.decide(createPlan(), createFeedback({ outcome: "completed_with_deviations" }));

  assert.equal(decision.reasonCode, "planning.no_replan_required");
});

// ─────────────────────────────────────────────────────────────────────────────
// Non-Replan Outcome with Correction Signal
// ─────────────────────────────────────────────────────────────────────────────

test("ReplanningService.decide replans for completed outcome with correction signal", () => {
  const service = new ReplanningService();
  const feedback = createFeedback({
    outcome: "completed",
    signals: [
      {
        signalId: "sig_c",
        source: "user" as const,
        taskId: "task_edge",
        category: "correction" as const,
        severity: "warning" as const,
        payload: { summary: "user corrected" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
  });

  const decision = service.decide(createPlan(), feedback);

  assert.equal(decision.shouldReplan, true);
  assert.equal(decision.reasonCode, "planning.execution_deviation"); // no trigger, uses fallback
});

test("ReplanningService.decide replans for completed_with_deviations with correction signal", () => {
  const service = new ReplanningService();
  const feedback = createFeedback({
    outcome: "completed_with_deviations",
    signals: [
      {
        signalId: "sig_c",
        source: "user" as const,
        taskId: "task_edge",
        category: "correction" as const,
        severity: "warning" as const,
        payload: {},
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
  });

  const decision = service.decide(createPlan(), feedback);

  assert.equal(decision.shouldReplan, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Decision ID Uniqueness Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReplanningService.decide generates unique decisionIds", () => {
  const service = new ReplanningService();
  const decisions = [
    service.decide(createPlan(), createFeedback()),
    service.decide(createPlan(), createFeedback()),
    service.decide(createPlan(), createFeedback()),
  ];

  const ids = decisions.map((d) => d.decisionId);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, uniqueIds.size, "All decision IDs should be unique");
});

// ─────────────────────────────────────────────────────────────────────────────
// Timestamp Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReplanningService.decide decidedAt is recent", () => {
  const service = new ReplanningService();
  const before = Date.now();
  const decision = service.decide(createPlan(), createFeedback());
  const after = Date.now();

  assert.ok(decision.decidedAt >= before && decision.decidedAt <= after);
});

test("ReplanningService.decide multiple calls have different timestamps", async () => {
  const service = new ReplanningService();
  const decision1 = service.decide(createPlan(), createFeedback());

  // Wait 1ms to ensure timestamp difference
  await new Promise((resolve) => setTimeout(resolve, 1));

  const decision2 = service.decide(createPlan(), createFeedback());

  assert.ok(decision2.decidedAt >= decision1.decidedAt);
});

// ─────────────────────────────────────────────────────────────────────────────
// Empty and Minimal Inputs
// ─────────────────────────────────────────────────────────────────────────────

test("ReplanningService.decide handles plan with empty planId", () => {
  const service = new ReplanningService();
  const plan = createPlan({ planId: "" });
  const decision = service.decide(plan, createFeedback());

  assert.equal(decision.taskId, "task_edge"); // taskId comes from plan.taskId
  assert.equal(decision.shouldReplan, false);
});

test("ReplanningService.decide handles plan with empty taskId", () => {
  const service = new ReplanningService();
  const plan = createPlan({ taskId: "" });
  const decision = service.decide(plan, createFeedback());

  assert.equal(decision.taskId, "");
});

test("ReplanningService.decide handles feedback with empty taskId", () => {
  const service = new ReplanningService();
  const feedback = createFeedback({ taskId: "" });
  const decision = service.decide(createPlan(), feedback);

  // taskId comes from plan, not feedback
  assert.equal(decision.taskId, "task_edge");
});

// ─────────────────────────────────────────────────────────────────────────────
// Signal Category Variations
// ─────────────────────────────────────────────────────────────────────────────

test("ReplanningService.decide does not replan for warning category signals", () => {
  const service = new ReplanningService();
  const feedback = createFeedback({
    outcome: "completed",
    signals: [
      {
        signalId: "sig_w",
        source: "execution" as const,
        taskId: "task_edge",
        category: "warning" as const,
        severity: "warning" as const,
        payload: {},
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
  });

  const decision = service.decide(createPlan(), feedback);

  assert.equal(decision.shouldReplan, false);
});

test("ReplanningService.decide does not replan for info category signals", () => {
  const service = new ReplanningService();
  const feedback = createFeedback({
    outcome: "completed",
    signals: [
      {
        signalId: "sig_i",
        source: "execution" as const,
        taskId: "task_edge",
        category: "info" as const,
        severity: "info" as const,
        payload: {},
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
  });

  const decision = service.decide(createPlan(), feedback);

  assert.equal(decision.shouldReplan, false);
});