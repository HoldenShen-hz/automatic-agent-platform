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
