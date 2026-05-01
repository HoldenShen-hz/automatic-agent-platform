/**
 * Replanning Service Unit Tests
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ReplanningService } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/planner/replanning-service.js";

function makePlan(overrides: Partial<{ planId: string; taskId: string; version: number }> = {}): {
  planId: string;
  taskId: string;
  version: number;
  strategy: "linear" | "hierarchical" | "reflexive";
  createdAt: number;
} {
  return {
    planId: "plan-001",
    taskId: "task-001",
    version: 1,
    strategy: "linear",
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeFeedback(overrides: Partial<{
  outcome: string;
  signals: Array<{ category: string }>;
}> = {}): {
  outcome: "repairable" | "failed" | "escalated" | "succeeded";
  signals: Array<{ category: string }>;
} {
  return {
    outcome: "succeeded",
    signals: [],
    ...overrides,
  };
}

test("ReplanningService.createTrigger creates valid trigger", () => {
  const service = new ReplanningService();
  const trigger = service.createTrigger("task-001", "test.reason", "feedback", "Test summary");

  assert.equal(trigger.taskId, "task-001");
  assert.equal(trigger.reasonCode, "test.reason");
  assert.equal(trigger.source, "feedback");
  assert.equal(trigger.summary, "Test summary");
  assert.ok(trigger.triggerId.length > 0);
});

test("ReplanningService.decide returns shouldReplan=true for repairable outcome", () => {
  const service = new ReplanningService();
  const decision = service.decide(makePlan(), makeFeedback({ outcome: "repairable" }));

  assert.equal(decision.shouldReplan, true);
  assert.equal(decision.nextPlanVersion, 2);
});

test("ReplanningService.decide returns shouldReplan=true for failed outcome", () => {
  const service = new ReplanningService();
  const decision = service.decide(makePlan(), makeFeedback({ outcome: "failed" }));

  assert.equal(decision.shouldReplan, true);
});

test("ReplanningService.decide returns shouldReplan=true for escalated outcome", () => {
  const service = new ReplanningService();
  const decision = service.decide(makePlan(), makeFeedback({ outcome: "escalated" }));

  assert.equal(decision.shouldReplan, true);
});

test("ReplanningService.decide returns shouldReplan=true for correction signal", () => {
  const service = new ReplanningService();
  const decision = service.decide(makePlan(), makeFeedback({
    outcome: "succeeded",
    signals: [{ category: "correction" }],
  }));

  assert.equal(decision.shouldReplan, true);
});

test("ReplanningService.decide returns shouldReplan=false for successful outcome", () => {
  const service = new ReplanningService();
  const decision = service.decide(makePlan(), makeFeedback({ outcome: "succeeded" }));

  assert.equal(decision.shouldReplan, false);
  assert.equal(decision.nextPlanVersion, null);
  assert.equal(decision.strategy, null);
});

test("ReplanningService.decide sets strategy to replanned when shouldReplan", () => {
  const service = new ReplanningService();
  const decision = service.decide(makePlan(), makeFeedback({ outcome: "failed" }));

  assert.equal(decision.strategy, "replanned");
});

test("ReplanningService.decide passes through trigger reasonCode", () => {
  const service = new ReplanningService();
  const trigger = service.createTrigger("task-001", "custom.reason", "operator", "Manual trigger");
  const decision = service.decide(makePlan(), makeFeedback({ outcome: "failed" }), trigger);

  assert.equal(decision.reasonCode, "custom.reason");
});

test("ReplanningService.decide uses default reasonCode when no trigger", () => {
  const service = new ReplanningService();
  const decision = service.decide(makePlan(), makeFeedback({ outcome: "failed" }), null);

  assert.ok(decision.reasonCode.length > 0);
});

test("ReplanningService.decide includes decisionId", () => {
  const service = new ReplanningService();
  const decision = service.decide(makePlan(), makeFeedback({ outcome: "repairable" }));

  assert.ok(decision.decisionId.length > 0);
});

test("ReplanningService.decide includes taskId from plan", () => {
  const service = new ReplanningService();
  const plan = makePlan({ taskId: "task-custom-123" });
  const decision = service.decide(plan, makeFeedback());

  assert.equal(decision.taskId, "task-custom-123");
});

test("ReplanningService.decide increments version correctly", () => {
  const service = new ReplanningService();
  const plan = makePlan({ version: 5 });
  const decision = service.decide(plan, makeFeedback({ outcome: "repairable" }));

  assert.equal(decision.nextPlanVersion, 6);
});

test("ReplanningService.createTrigger uses feedback source", () => {
  const service = new ReplanningService();
  const trigger = service.createTrigger("task-001", "reason", "feedback", "summary");

  assert.equal(trigger.source, "feedback");
});

test("ReplanningService.createTrigger uses validation source", () => {
  const service = new ReplanningService();
  const trigger = service.createTrigger("task-001", "reason", "validation", "summary");

  assert.equal(trigger.source, "validation");
});

test("ReplanningService.createTrigger uses operator source", () => {
  const service = new ReplanningService();
  const trigger = service.createTrigger("task-001", "reason", "operator", "summary");

  assert.equal(trigger.source, "operator");
});