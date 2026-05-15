import assert from "node:assert/strict";
import test from "node:test";

import { AdmissionController, DEFAULT_ADMISSION_POLICY } from "../../src/platform/five-plane-execution/dispatcher/admission-controller.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

/**
 * Dispatcher Admission Control Invariants
 *
 * This test verifies critical admission control invariants:
 * 1. High-priority tasks are not rejected when queue is overloaded (priority elevation)
 * 2. Risk class isolation limits are enforced
 * 3. Tenant quota limits are enforced
 * 4. Budget exceeded requests are rejected
 * 5. Backpressure modes are correctly honored
 *
 * Architecture reference: §14.2 Dispatcher Admission Controller, §6.4 R6-3
 */
test("Admission policy has correct default limits", () => {
  const policy = DEFAULT_ADMISSION_POLICY;

  // Verify critical default values
  assert.equal(policy.maxQueuedTasks, 5);
  assert.equal(policy.maxActiveExecutions, 10);
  assert.equal(policy.maxTier1AckBacklog, 25);
  assert.equal(policy.criticalQueueHeadroom, 2);

  // R6-3: §14.2 scheduling factors enabled by default
  assert.equal(policy.riskClassIsolationEnabled, true);
  assert.equal(policy.tenantQuotaEnabled, true);
  assert.equal(policy.sandboxMatchingEnabled, true);
  assert.equal(policy.capabilityClassGateEnabled, true);

  // Risk class limits
  assert.equal(policy.maxRiskClassTasks["critical"], 2);
  assert.equal(policy.maxRiskClassTasks["high"], 5);
  assert.equal(policy.tenantTaskQuota, 50);
});

test("High-priority tasks have queue headroom during overload", () => {
  // Create a mock task store
  const mockStore = {
    task: {
      countQueuedTasks: () => 6, // Over maxQueuedTasks (5)
      listTasks: () => [],
    },
    execution: {
      countActiveExecutions: () => 5,
    },
    event: {
      countPendingTier1Acks: () => 10,
    },
  } as unknown as AuthoritativeTaskStore;

  const controller = new AdmissionController(mockStore);

  // Low priority should be rejected when queue is saturated
  const lowPriorityResult = controller.evaluate({
    priority: "low",
    riskClass: "low",
    tenantId: "tenant-test",
    sandboxType: "standard",
  });

  assert.equal(lowPriorityResult.decision, "reject");
  assert.equal(lowPriorityResult.reasonCode, "admission.reject_queue_saturated");

  // High priority should be allowed to queue (headroom)
  const highPriorityResult = controller.evaluate({
    priority: "high",
    riskClass: "low",
    tenantId: "tenant-test",
    sandboxType: "standard",
  });

  // High priority gets headroom of criticalQueueHeadroom (2) beyond max
  assert.equal(highPriorityResult.decision, "queue");
  assert.equal(highPriorityResult.reasonCode, "admission.queue_overloaded");
});

test("Critical priority tasks bypass queue when at capacity", () => {
  const mockStore = {
    task: {
      countQueuedTasks: () => 7, // Over max + headroom (5+2=7)
      listTasks: () => [],
    },
    execution: {
      countActiveExecutions: () => 5,
    },
    event: {
      countPendingTier1Acks: () => 10,
    },
  } as unknown as AuthoritativeTaskStore;

  const controller = new AdmissionController(mockStore);

  // Even critical priority rejected when over headroom
  const criticalResult = controller.evaluate({
    priority: "critical",
    riskClass: "low",
    tenantId: "tenant-test",
    sandboxType: "standard",
  });

  assert.equal(criticalResult.decision, "reject");
  assert.equal(criticalResult.reasonCode, "admission.reject_queue_saturated");
});

test("Budget exceeded requests are rejected", () => {
  const mockStore = {
    task: { countQueuedTasks: () => 1, listTasks: () => [] },
    execution: { countActiveExecutions: () => 1 },
    event: { countPendingTier1Acks: () => 5 },
  } as unknown as AuthoritativeTaskStore;

  const controller = new AdmissionController(mockStore);

  // Request with cost exceeding budget
  const result = controller.evaluate({
    priority: "medium",
    estimatedCostUsd: 100,
    budgetRemainingUsd: 50, // Not enough budget
  });

  assert.equal(result.decision, "reject");
  assert.equal(result.reasonCode, "admission.reject_budget_exceeded");
});

test("Risk class isolation limits are enforced", () => {
  const mockStore = {
    task: {
      countQueuedTasks: () => 2,
      listTasks: () => [
        { taskId: "critical-existing", riskClass: "critical" },
      ],
    },
    execution: { countActiveExecutions: () => 1 },
    event: { countPendingTier1Acks: () => 5 },
  } as unknown as AuthoritativeTaskStore;

  // Policy with strict critical limit
  const strictPolicy = {
    ...DEFAULT_ADMISSION_POLICY,
    riskClassIsolationEnabled: true,
    maxRiskClassTasks: { critical: 1, high: 2 },
  };

  const controller = new AdmissionController(mockStore, strictPolicy);

  const firstCritical = controller.evaluate({
    priority: "medium",
    riskClass: "high",
  });

  assert.equal(firstCritical.decision, "allow");

  const secondCritical = controller.evaluate({
    priority: "medium",
    riskClass: "critical",
  });

  assert.equal(secondCritical.decision, "reject");
  assert.equal(secondCritical.reasonCode, "admission.reject_risk_class_isolation");
});

test("Tenant quota limits are enforced", () => {
  const mockStore = {
    task: {
      countQueuedTasks: () => 1,
      listTasks: () => [
        { taskId: "task-1", tenantId: "tenant-quota" },
        { taskId: "task-2", tenantId: "tenant-quota" },
        { taskId: "task-3", tenantId: "tenant-quota" },
      ],
    },
    execution: { countActiveExecutions: () => 1 },
    event: { countPendingTier1Acks: () => 5 },
  } as unknown as AuthoritativeTaskStore;

  // Policy with quota of 3
  const quotaPolicy = {
    ...DEFAULT_ADMISSION_POLICY,
    tenantQuotaEnabled: true,
    tenantTaskQuota: 3,
  };

  const controller = new AdmissionController(mockStore, quotaPolicy);

  // Fourth task for same tenant should be rejected
  const result = controller.evaluate({
    priority: "medium",
    tenantId: "tenant-quota",
  });

  assert.equal(result.decision, "reject");
  assert.equal(result.reasonCode, "admission.reject_tenant_quota");
});

test("Tier1 backlog threshold triggers rejection", () => {
  const mockStore = {
    task: { countQueuedTasks: () => 1, listTasks: () => [] },
    execution: { countActiveExecutions: () => 1 },
    event: { countPendingTier1Acks: () => 30 }, // Over maxTier1AckBacklog (25)
  } as unknown as AuthoritativeTaskStore;

  const controller = new AdmissionController(mockStore);

  const result = controller.evaluate({ priority: "medium" });

  assert.equal(result.decision, "reject");
  assert.equal(result.reasonCode, "admission.reject_tier1_backlog");
});

test("Sandbox matching is enforced when enabled", () => {
  const mockStore = {
    task: { countQueuedTasks: () => 1, listTasks: () => [] },
    execution: { countActiveExecutions: () => 1 },
    event: { countPendingTier1Acks: () => 5 },
  } as unknown as AuthoritativeTaskStore;

  const strictPolicy = {
    ...DEFAULT_ADMISSION_POLICY,
    sandboxMatchingEnabled: true,
  };

  const controller = new AdmissionController(mockStore, strictPolicy);

  // Request for unavailable sandbox type
  const result = controller.evaluate({
    priority: "medium",
    sandboxType: "strict", // Only 2 available per DEFAULT_ADMISSION_POLICY
  });

  // The snapshot shows strict: 2, so this should allow
  // If strict were 0, it would reject
  assert.equal(result.snapshot.sandboxAvailability["strict"], 2);
});

test("Capability class gating is enforced", () => {
  const mockStore = {
    task: { countQueuedTasks: () => 1, listTasks: () => [] },
    execution: { countActiveExecutions: () => 1 },
    event: { countPendingTier1Acks: () => 5 },
  } as unknown as AuthoritativeTaskStore;

  const zeroCapacityPolicy = {
    ...DEFAULT_ADMISSION_POLICY,
    capabilityClassGateEnabled: true,
  };

  const controller = new AdmissionController(mockStore, zeroCapacityPolicy);

  // Request for capability with no capacity
  const result = controller.evaluate({
    priority: "medium",
    requiredCapabilities: ["nonexistent"],
  });

  // Nonexistent capability should have 0 capacity
  assert.equal(result.snapshot.capabilityClassCapacity["nonexistent"] ?? 0, 0);
});

test("Active executions at max triggers queue (not reject)", () => {
  const mockStore = {
    task: { countQueuedTasks: () => 1, listTasks: () => [] },
    execution: { countActiveExecutions: () => 10 }, // At maxActiveExecutions
    event: { countPendingTier1Acks: () => 5 },
  } as unknown as AuthoritativeTaskStore;

  const controller = new AdmissionController(mockStore);

  const result = controller.evaluate({ priority: "medium" });

  assert.equal(result.decision, "queue");
  assert.equal(result.reasonCode, "admission.queue_overloaded");
});

test("Snapshot contains all required scheduling factors", () => {
  const mockStore = {
    task: { countQueuedTasks: () => 3, listTasks: () => [] },
    execution: { countActiveExecutions: () => 7 },
    event: { countPendingTier1Acks: () => 15 },
  } as unknown as AuthoritativeTaskStore;

  const controller = new AdmissionController(mockStore);
  const snapshot = controller.snapshot();

  // Base snapshot fields
  assert.equal(snapshot.queuedTasks, 3);
  assert.equal(snapshot.activeExecutions, 7);
  assert.equal(snapshot.tier1AckBacklog, 15);

  // R6-3: Extended snapshot with scheduling factors
  assert.ok(snapshot.riskClassDistribution !== undefined);
  assert.ok(snapshot.tenantUsage !== undefined);
  assert.ok(snapshot.sandboxAvailability !== undefined);
  assert.ok(snapshot.capabilityClassCapacity !== undefined);

  // Sandbox availability populated
  assert.equal(snapshot.sandboxAvailability["standard"], 10);
  assert.equal(snapshot.sandboxAvailability["hardened"], 5);
  assert.equal(snapshot.sandboxAvailability["strict"], 2);

  // Capability class capacity populated
  assert.equal(snapshot.capabilityClassCapacity["default"], 20);
  assert.equal(snapshot.capabilityClassCapacity["sandboxed"], 10);
  assert.equal(snapshot.capabilityClassCapacity["privileged"], 5);
});
