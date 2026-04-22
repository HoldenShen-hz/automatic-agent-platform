/**
 * Unit tests for FairSchedulingService
 *
 * @see src/scale-ecosystem/resource-manager/fair-scheduling-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { FairSchedulingService } from "../../../src/scale-ecosystem/resource-manager/fair-scheduling-service.js";

test("FairSchedulingService emits preemption decision when quota is exceeded", () => {
  const service = new FairSchedulingService();
  const decision = service.schedule({
    quotaPolicy: {
      scopeId: "tenant_1",
      hardLimit: 5,
      currentUsage: 4,
    },
    claim: {
      claimId: "claim_1",
      schedulingClass: {
        tenantId: "tenant_1",
        orgNodeId: "org_a",
        domainId: "ops",
        slaTierId: "enterprise",
        priority: 5,
      },
      requestedUnits: 2,
    },
    queueItems: [
      { itemId: "job_old", tenantId: "tenant_2", priority: 1, ageMs: 20 * 60_000 },
      { itemId: "job_fast", tenantId: "tenant_1", priority: 5, ageMs: 30_000 },
    ],
    preemptionCandidates: [
      { executionId: "exec_low", priority: 1, progressPercent: 10 },
      { executionId: "exec_high", priority: 5, progressPercent: 90 },
    ],
  });

  assert.equal(decision.queue.quotaExceeded, true);
  assert.deepEqual(decision.queue.starvedItemIds, ["job_old"]);
  assert.equal(decision.preemption.shouldPreempt, true);
  assert.equal(decision.preemption.victimExecutionId, "exec_low");
});

test("FairSchedulingService does not preempt when quota is not exceeded", () => {
  const service = new FairSchedulingService();
  const decision = service.schedule({
    quotaPolicy: {
      scopeId: "tenant_1",
      hardLimit: 10,
      currentUsage: 4,
    },
    claim: {
      claimId: "claim_1",
      schedulingClass: {
        tenantId: "tenant_1",
        orgNodeId: "org_a",
        domainId: "ops",
        slaTierId: "standard",
        priority: 3,
      },
      requestedUnits: 2,
    },
    queueItems: [
      { itemId: "job_1", tenantId: "tenant_1", priority: 5, ageMs: 30_000 },
      { itemId: "job_2", tenantId: "tenant_2", priority: 3, ageMs: 60_000 },
    ],
    preemptionCandidates: [
      { executionId: "exec_low", priority: 1, progressPercent: 50 },
    ],
  });

  assert.equal(decision.queue.quotaExceeded, false);
  assert.deepEqual(decision.queue.starvedItemIds, []);
  assert.equal(decision.preemption.shouldPreempt, false);
  assert.equal(decision.preemption.victimExecutionId, null);
  assert.equal(decision.preemption.reason, null);
});

test("FairSchedulingService handles no preemption candidates when quota exceeded", () => {
  const service = new FairSchedulingService();
  const decision = service.schedule({
    quotaPolicy: {
      scopeId: "tenant_1",
      hardLimit: 5,
      currentUsage: 4,
    },
    claim: {
      claimId: "claim_1",
      schedulingClass: {
        tenantId: "tenant_1",
        orgNodeId: "org_a",
        domainId: "ops",
        slaTierId: "enterprise",
        priority: 5,
      },
      requestedUnits: 2,
    },
    queueItems: [
      { itemId: "job_1", tenantId: "tenant_1", priority: 5, ageMs: 30_000 },
    ],
    preemptionCandidates: [],
  });

  assert.equal(decision.queue.quotaExceeded, true);
  assert.equal(decision.preemption.shouldPreempt, false);
  assert.equal(decision.preemption.victimExecutionId, null);
  assert.equal(decision.preemption.reason, "resource_manager.quota_exceeded_without_victim");
});

test("FairSchedulingService identifies starved items older than 15 minutes", () => {
  const service = new FairSchedulingService();
  const decision = service.schedule({
    quotaPolicy: {
      scopeId: "tenant_1",
      hardLimit: 100,
      currentUsage: 10,
    },
    claim: {
      claimId: "claim_1",
      schedulingClass: {
        tenantId: "tenant_1",
        orgNodeId: null,
        domainId: "ops",
        slaTierId: "standard",
        priority: 1,
      },
      requestedUnits: 5,
    },
    queueItems: [
      { itemId: "job_recent", tenantId: "tenant_1", priority: 1, ageMs: 5 * 60_000 }, // 5 min - not starved
      { itemId: "job_starved_1", tenantId: "tenant_1", priority: 1, ageMs: 16 * 60_000 }, // 16 min - starved
      { itemId: "job_starved_2", tenantId: "tenant_2", priority: 2, ageMs: 20 * 60_000 }, // 20 min - starved
      { itemId: "job_exactly_15", tenantId: "tenant_3", priority: 1, ageMs: 15 * 60_000 }, // exactly 15 min - not starved
    ],
    preemptionCandidates: [],
  });

  assert.equal(decision.queue.quotaExceeded, false);
  assert.deepEqual(decision.queue.starvedItemIds.sort(), ["job_starved_1", "job_starved_2"].sort());
});

test("FairSchedulingService returns ordered queue items", () => {
  const service = new FairSchedulingService();
  const decision = service.schedule({
    quotaPolicy: {
      scopeId: "tenant_1",
      hardLimit: 100,
      currentUsage: 10,
    },
    claim: {
      claimId: "claim_1",
      schedulingClass: {
        tenantId: "tenant_1",
        orgNodeId: null,
        domainId: "ops",
        slaTierId: "standard",
        priority: 1,
      },
      requestedUnits: 1,
    },
    queueItems: [
      { itemId: "job_low_prio", tenantId: "tenant_1", priority: 1, ageMs: 30_000 },
      { itemId: "job_high_prio", tenantId: "tenant_1", priority: 10, ageMs: 30_000 },
      { itemId: "job_medium_prio", tenantId: "tenant_1", priority: 5, ageMs: 30_000 },
    ],
    preemptionCandidates: [],
  });

  assert.equal(decision.queue.orderedItemIds.length, 3);
  // High priority should be first
  assert.equal(decision.queue.orderedItemIds[0], "job_high_prio");
});

test("FairSchedulingService uses optional orgNodeId in scheduling class", () => {
  const service = new FairSchedulingService();
  // This tests that schedulingClass.orgNodeId can be null
  const decision = service.schedule({
    quotaPolicy: {
      scopeId: "tenant_1",
      hardLimit: 100,
      currentUsage: 10,
    },
    claim: {
      claimId: "claim_1",
      schedulingClass: {
        tenantId: "tenant_1",
        orgNodeId: null,
        domainId: "ops",
        slaTierId: "standard",
        priority: 1,
      },
      requestedUnits: 1,
    },
    queueItems: [],
    preemptionCandidates: [],
  });

  assert.equal(decision.queue.quotaExceeded, false);
});

test("FairSchedulingService includes quotaExceeded flag in queue snapshot", () => {
  const service = new FairSchedulingService();
  const decision = service.schedule({
    quotaPolicy: {
      scopeId: "tenant_1",
      hardLimit: 5,
      currentUsage: 10,
    },
    claim: {
      claimId: "claim_1",
      schedulingClass: {
        tenantId: "tenant_1",
        orgNodeId: null,
        domainId: "ops",
        slaTierId: "enterprise",
        priority: 5,
      },
      requestedUnits: 1,
    },
    queueItems: [],
    preemptionCandidates: [],
  });

  assert.equal(decision.queue.quotaExceeded, true);
});
