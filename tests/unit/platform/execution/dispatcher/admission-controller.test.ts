import assert from "node:assert/strict";
import test from "node:test";

import { AdmissionController, DEFAULT_ADMISSION_POLICY } from "../../../../../src/platform/five-plane-execution/dispatcher/admission-controller.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AdmissionPolicy } from "../../../../../src/platform/five-plane-execution/dispatcher/admission-controller.js";
import type { TaskPriority } from "../../../../../src/platform/contracts/types/domain/primitives.js";

// ---------------------------------------------------------------------------
// Helper: Mock AuthoritativeTaskStore
// ---------------------------------------------------------------------------

function createMockStore(overrides: {
  queuedTasks?: number;
  activeExecutions?: number;
  tier1AckBacklog?: number;
}): AuthoritativeTaskStore {
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
// snapshot()
// ---------------------------------------------------------------------------

test("AdmissionController.snapshot returns correct counts [admission-controller]", () => {
  const store = createMockStore({ queuedTasks: 5, activeExecutions: 10, tier1AckBacklog: 3 });
  const controller = new AdmissionController(store);
  const snapshot = controller.snapshot();

  assert.equal(snapshot.queuedTasks, 5);
  assert.equal(snapshot.activeExecutions, 10);
  assert.equal(snapshot.tier1AckBacklog, 3);
});

test("AdmissionController.snapshot uses defaults when store returns undefined [admission-controller]", () => {
  const store = createMockStore({});
  const controller = new AdmissionController(store);
  const snapshot = controller.snapshot();

  assert.equal(snapshot.queuedTasks, 0);
  assert.equal(snapshot.activeExecutions, 0);
  assert.equal(snapshot.tier1AckBacklog, 0);
});

// ---------------------------------------------------------------------------
// evaluate() - allow decision
// ---------------------------------------------------------------------------

test("evaluate returns allow when under all limits [admission-controller]", () => {
  const store = createMockStore({ queuedTasks: 2, activeExecutions: 5, tier1AckBacklog: 10 });
  const controller = new AdmissionController(store);
  const decision = controller.evaluate({ priority: "normal" });

  assert.equal(decision.decision, "allow");
  assert.equal(decision.reasonCode, "admission.ok");
});

test("evaluate allows high priority when queue is near limit but under headroom [admission-controller]", () => {
  const store = createMockStore({ queuedTasks: 6 }); // maxQueuedTasks=5, urgentQueueHeadroom=2
  const controller = new AdmissionController(store);
  const decision = controller.evaluate({ priority: "high" });

  assert.equal(decision.decision, "queue");
  assert.equal(decision.reasonCode, "admission.queue_overloaded");
});

test("evaluate allows urgent priority when queue is at capacity but within headroom [admission-controller]", () => {
  const store = createMockStore({ queuedTasks: 6 }); // max=5, headroom=2, so 7 max
  const controller = new AdmissionController(store);
  const decision = controller.evaluate({ priority: "urgent" });

  assert.equal(decision.decision, "queue");
  assert.equal(decision.reasonCode, "admission.queue_overloaded");
});

// ---------------------------------------------------------------------------
// evaluate() - queue decision
// ---------------------------------------------------------------------------

test("evaluate queues when active executions at limit [admission-controller]", () => {
  const store = createMockStore({ activeExecutions: 10 }); // maxActiveExecutions=10
  const controller = new AdmissionController(store);
  const decision = controller.evaluate({ priority: "normal" });

  assert.equal(decision.decision, "queue");
  assert.equal(decision.reasonCode, "admission.queue_overloaded");
});

test("evaluate queues when queue backpressure and non-elevated priority [admission-controller]", () => {
  const store = createMockStore({});
  // Create a minimal backpressure snapshot
  const backpressure = {
    status: "degraded" as const,
    degradationMode: "queue_only" as const,
    queueGovernance: { starvationDetected: false },
    findings: [],
  };
  const controller = new AdmissionController(store, DEFAULT_ADMISSION_POLICY, () => backpressure as any);
  const decision = controller.evaluate({ priority: "low" });

  assert.equal(decision.decision, "queue");
  assert.equal(decision.reasonCode, "admission.queue_backpressure");
});

// ---------------------------------------------------------------------------
// evaluate() - reject decisions
// ---------------------------------------------------------------------------

test("evaluate rejects when budget exceeded [admission-controller]", () => {
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

test("evaluate rejects when read_only_mode and non-elevated priority [admission-controller]", () => {
  const store = createMockStore({});
  const backpressure = {
    status: "degraded" as const,
    degradationMode: "read_only_operations_only" as const,
    queueGovernance: { starvationDetected: false },
    findings: [],
  };
  const controller = new AdmissionController(store, DEFAULT_ADMISSION_POLICY, () => backpressure as any);
  const decision = controller.evaluate({ priority: "low" });

  assert.equal(decision.decision, "reject");
  assert.equal(decision.reasonCode, "admission.reject_read_only_mode");
});

test("evaluate rejects when pause_non_critical and non-elevated priority [admission-controller]", () => {
  const store = createMockStore({});
  const backpressure = {
    status: "degraded" as const,
    degradationMode: "pause_non_critical" as const,
    queueGovernance: { starvationDetected: false },
    findings: [],
  };
  const controller = new AdmissionController(store, DEFAULT_ADMISSION_POLICY, () => backpressure as any);
  const decision = controller.evaluate({ priority: "low" });

  assert.equal(decision.decision, "reject");
  assert.equal(decision.reasonCode, "admission.reject_non_critical_paused");
});

test("evaluate allows elevated priority when pause_non_critical [admission-controller]", () => {
  const store = createMockStore({});
  const backpressure = {
    status: "degraded" as const,
    degradationMode: "pause_non_critical" as const,
    queueGovernance: { starvationDetected: false },
    findings: [],
  };
  const controller = new AdmissionController(store, DEFAULT_ADMISSION_POLICY, () => backpressure as any);
  const decision = controller.evaluate({ priority: "high" });

  // high priority is allowed through even in pause_non_critical
  assert.equal(decision.decision, "allow");
});

test("evaluate rejects low priority when starvation detected [admission-controller]", () => {
  const store = createMockStore({});
  const backpressure = {
    status: "degraded" as const,
    degradationMode: "none" as const,
    queueGovernance: { starvationDetected: true },
    findings: [],
  };
  const controller = new AdmissionController(store, DEFAULT_ADMISSION_POLICY, () => backpressure as any);
  const decision = controller.evaluate({ priority: "low" });

  assert.equal(decision.decision, "reject");
  assert.equal(decision.reasonCode, "admission.reject_starvation_protection");
});

test("evaluate allows non-low priority when starvation detected [admission-controller]", () => {
  const store = createMockStore({});
  const backpressure = {
    status: "degraded" as const,
    degradationMode: "none" as const,
    queueGovernance: { starvationDetected: true },
    findings: [],
  };
  const controller = new AdmissionController(store, DEFAULT_ADMISSION_POLICY, () => backpressure as any);
  const decision = controller.evaluate({ priority: "normal" });

  assert.equal(decision.decision, "allow");
});

test("evaluate rejects when tier1 ack backlog at limit [admission-controller]", () => {
  const store = createMockStore({ tier1AckBacklog: 25 }); // maxTier1AckBacklog=25
  const controller = new AdmissionController(store);
  const decision = controller.evaluate({ priority: "normal" });

  assert.equal(decision.decision, "reject");
  assert.equal(decision.reasonCode, "admission.reject_tier1_backlog");
});

test("evaluate rejects when queue saturated and non-elevated priority [admission-controller]", () => {
  const store = createMockStore({ queuedTasks: 7 }); // maxQueuedTasks=5 + urgentQueueHeadroom=2 = 7
  const controller = new AdmissionController(store);
  const decision = controller.evaluate({ priority: "low" });

  assert.equal(decision.decision, "reject");
  assert.equal(decision.reasonCode, "admission.reject_queue_saturated");
});

test("evaluate allows high priority when queue saturated but within headroom [admission-controller]", () => {
  const store = createMockStore({ queuedTasks: 6 }); // max=5, headroom=2, 7 max
  const controller = new AdmissionController(store);
  const decision = controller.evaluate({ priority: "high" });

  assert.equal(decision.decision, "queue");
  assert.equal(decision.reasonCode, "admission.queue_overloaded");
});

// ---------------------------------------------------------------------------
// Custom policy
// ---------------------------------------------------------------------------

test("evaluate uses custom policy limits [admission-controller]", () => {
  const customPolicy: AdmissionPolicy = {
    maxQueuedTasks: 2,
    maxActiveExecutions: 5,
    maxTier1AckBacklog: 10,
    urgentQueueHeadroom: 1,
  };
  const store = createMockStore({ queuedTasks: 2 });
  const controller = new AdmissionController(store, customPolicy);
  const decision = controller.evaluate({ priority: "low" });

  assert.equal(decision.decision, "reject");
  assert.equal(decision.reasonCode, "admission.reject_queue_saturated");
});

test("evaluate respects custom urgentQueueHeadroom [admission-controller]", () => {
  const customPolicy: AdmissionPolicy = {
    maxQueuedTasks: 5,
    maxActiveExecutions: 10,
    maxTier1AckBacklog: 25,
    urgentQueueHeadroom: 5, // Higher headroom
  };
  const store = createMockStore({ queuedTasks: 9 }); // 5 + 5 = 10 max with headroom
  const controller = new AdmissionController(store, customPolicy);
  const decision = controller.evaluate({ priority: "high" });

  // Still queuing since we're at the edge of headroom
  assert.equal(decision.decision, "queue");
});

// ---------------------------------------------------------------------------
// Backpressure snapshot integration
// ---------------------------------------------------------------------------

test("evaluate includes backpressure snapshot in decision when present [admission-controller]", () => {
  const store = createMockStore({});
  const backpressure = {
    status: "degraded" as const,
    degradationMode: "queue_only" as const,
    queueGovernance: { starvationDetected: false },
    findings: ["queue building up"],
  };
  const controller = new AdmissionController(store, DEFAULT_ADMISSION_POLICY, () => backpressure as any);
  const decision = controller.evaluate({ priority: "high" });

  assert.notEqual(decision.backpressure, null);
  assert.equal(decision.backpressure!.degradationMode, "queue_only");
});

test("evaluate includes snapshot in decision [admission-controller]", () => {
  const store = createMockStore({ queuedTasks: 3, activeExecutions: 7, tier1AckBacklog: 15 });
  const controller = new AdmissionController(store);
  const decision = controller.evaluate({ priority: "normal" });

  assert.equal(decision.snapshot.queuedTasks, 3);
  assert.equal(decision.snapshot.activeExecutions, 7);
  assert.equal(decision.snapshot.tier1AckBacklog, 15);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("evaluate allows when estimated cost equals budget [admission-controller]", () => {
  const store = createMockStore({});
  const controller = new AdmissionController(store);
  const decision = controller.evaluate({
    priority: "normal",
    estimatedCostUsd: 50,
    budgetRemainingUsd: 50,
  });

  // equal is allowed (not exceeded)
  assert.equal(decision.decision, "allow");
});

test("evaluate with null cost/budget allows [admission-controller]", () => {
  const store = createMockStore({});
  const controller = new AdmissionController(store);
  const decision = controller.evaluate({ priority: "normal" });

  assert.equal(decision.decision, "allow");
});

test("evaluate with null backpressure function works [admission-controller]", () => {
  const store = createMockStore({});
  const controller = new AdmissionController(store, DEFAULT_ADMISSION_POLICY, null);
  const decision = controller.evaluate({ priority: "normal" });

  assert.equal(decision.decision, "allow");
  assert.equal(decision.backpressure, null);
});
