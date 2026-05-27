import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for Budget Reservation Check per R6-09
 * Verifies that the admission controller correctly rejects tasks that exceed budget
 */

import { AdmissionController, DEFAULT_ADMISSION_POLICY } from "../../../../../src/platform/five-plane-execution/dispatcher/admission-controller.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

// ---------------------------------------------------------------------------
// Helper: Mock AuthoritativeTaskStore
// ---------------------------------------------------------------------------

function createMockStore(overrides: {
  queuedTasks?: number;
  activeExecutions?: number;
  tier1AckBacklog?: number;
} = {}): AuthoritativeTaskStore {
  return {
    task: {
      countQueuedTasks: () => overrides.queuedTasks ?? 0,
    },
    execution: {
      countActiveExecutions: () => overrides.activeExecutions ?? 0,
    },
    event: {
      countPendingTier1Acks: () => overrides.tier1AckBacklog ?? 0,
    },
  } as unknown as AuthoritativeTaskStore;
}

// ---------------------------------------------------------------------------
// R6-09: Budget Reservation Check Tests
// ---------------------------------------------------------------------------

test("evaluate rejects when estimated cost exceeds budget remaining [admission-controller-budget]", () => {
  const store = createMockStore({});
  const controller = new AdmissionController(store);

  const decision = controller.evaluate({
    priority: "normal",
    estimatedCostUsd: 100,
    budgetRemainingUsd: 50,
  });

  assert.equal(decision.decision, "reject");
  assert.equal(decision.reasonCode, "admission.reject_budget_exceeded");
});

test("evaluate allows when estimated cost equals budget remaining [admission-controller-budget]", () => {
  const store = createMockStore({});
  const controller = new AdmissionController(store);

  const decision = controller.evaluate({
    priority: "normal",
    estimatedCostUsd: 50,
    budgetRemainingUsd: 50,
  });

  assert.equal(decision.decision, "allow");
  assert.equal(decision.reasonCode, "admission.ok");
});

test("evaluate allows when estimated cost is less than budget remaining [admission-controller-budget]", () => {
  const store = createMockStore({});
  const controller = new AdmissionController(store);

  const decision = controller.evaluate({
    priority: "normal",
    estimatedCostUsd: 30,
    budgetRemainingUsd: 50,
  });

  assert.equal(decision.decision, "allow");
  assert.equal(decision.reasonCode, "admission.ok");
});

test("evaluate allows when estimated cost is null [admission-controller-budget]", () => {
  const store = createMockStore({});
  const controller = new AdmissionController(store);

  const decision = controller.evaluate({
    priority: "normal",
    estimatedCostUsd: null,
    budgetRemainingUsd: 0,
  });

  assert.equal(decision.decision, "allow");
});

test("evaluate allows when budget remaining is null [admission-controller-budget]", () => {
  const store = createMockStore({});
  const controller = new AdmissionController(store);

  const decision = controller.evaluate({
    priority: "normal",
    estimatedCostUsd: 100,
    budgetRemainingUsd: null,
  });

  assert.equal(decision.decision, "allow");
});

test("evaluate allows when both estimated cost and budget are null [admission-controller-budget]", () => {
  const store = createMockStore({});
  const controller = new AdmissionController(store);

  const decision = controller.evaluate({
    priority: "normal",
    estimatedCostUsd: null,
    budgetRemainingUsd: null,
  });

  assert.equal(decision.decision, "allow");
});

test("evaluate allows when neither cost nor budget are provided [admission-controller-budget]", () => {
  const store = createMockStore({});
  const controller = new AdmissionController(store);

  const decision = controller.evaluate({ priority: "normal" });

  assert.equal(decision.decision, "allow");
  assert.equal(decision.reasonCode, "admission.ok");
});

test("evaluate rejects high priority task when budget exceeded [admission-controller-budget]", () => {
  const store = createMockStore({});
  const controller = new AdmissionController(store);

  // Even high priority tasks should be rejected if budget is exceeded
  const decision = controller.evaluate({
    priority: "high",
    estimatedCostUsd: 1000,
    budgetRemainingUsd: 100,
  });

  assert.equal(decision.decision, "reject");
  assert.equal(decision.reasonCode, "admission.reject_budget_exceeded");
});

test("evaluate rejects critical priority task when budget exceeded [admission-controller-budget]", () => {
  const store = createMockStore({});
  const controller = new AdmissionController(store);

  const decision = controller.evaluate({
    priority: "critical",
    estimatedCostUsd: 500,
    budgetRemainingUsd: 100,
  });

  assert.equal(decision.decision, "reject");
  assert.equal(decision.reasonCode, "admission.reject_budget_exceeded");
});

test("evaluate budget check happens before other checks [admission-controller-budget]", () => {
  const store = createMockStore({ queuedTasks: 100, activeExecutions: 100 });
  const controller = new AdmissionController(store, DEFAULT_ADMISSION_POLICY);

  // Budget check should happen before queue/execution limits
  const decision = controller.evaluate({
    priority: "normal",
    estimatedCostUsd: 200,
    budgetRemainingUsd: 50,
  });

  // Should fail budget check first, not queue saturation
  assert.equal(decision.decision, "reject");
  assert.equal(decision.reasonCode, "admission.reject_budget_exceeded");
});

test("evaluate with zero budget remaining rejects any cost > 0 [admission-controller-budget]", () => {
  const store = createMockStore({});
  const controller = new AdmissionController(store);

  const decision = controller.evaluate({
    priority: "normal",
    estimatedCostUsd: 1,
    budgetRemainingUsd: 0,
  });

  assert.equal(decision.decision, "reject");
  assert.equal(decision.reasonCode, "admission.reject_budget_exceeded");
});

test("evaluate with zero budget allows zero estimated cost [admission-controller-budget]", () => {
  const store = createMockStore({});
  const controller = new AdmissionController(store);

  const decision = controller.evaluate({
    priority: "normal",
    estimatedCostUsd: 0,
    budgetRemainingUsd: 0,
  });

  assert.equal(decision.decision, "allow");
});

test("decision snapshot contains correct queue state even when budget exceeded [admission-controller-budget]", () => {
  const store = createMockStore({ queuedTasks: 3, activeExecutions: 5 });
  const controller = new AdmissionController(store);

  const decision = controller.evaluate({
    priority: "normal",
    estimatedCostUsd: 100,
    budgetRemainingUsd: 50,
  });

  // Snapshot should still reflect actual state
  assert.equal(decision.snapshot.queuedTasks, 3);
  assert.equal(decision.snapshot.activeExecutions, 5);
});

test("decision backpressure is null when budget check fails (no backpressure involved) [admission-controller-budget]", () => {
  const store = createMockStore({});
  const controller = new AdmissionController(store);

  const decision = controller.evaluate({
    priority: "normal",
    estimatedCostUsd: 100,
    budgetRemainingUsd: 50,
  });

  // Budget check doesn't involve backpressure
  assert.equal(decision.backpressure, null);
});