/**
 * Unit tests for FairSchedulingService
 *
 * @see src/scale-ecosystem/resource-manager/fair-scheduling-service.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { FairSchedulingService, } from "../../../../src/scale-ecosystem/resource-manager/fair-scheduling-service.js";
import { orderFairQueue } from "../../../../src/scale-ecosystem/resource-manager/fair-queue/index.js";
import { choosePreemptionVictim } from "../../../../src/scale-ecosystem/resource-manager/preemption/index.js";
import { isQuotaExceeded, evaluateQuota } from "../../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";
import { QuotaPolicySchema } from "../../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";
function createSchedulingClass(overrides = {}) {
    return {
        tenantId: overrides.tenantId ?? "tenant-1",
        orgNodeId: overrides.orgNodeId ?? null,
        domainId: overrides.domainId ?? "domain-1",
        slaTierId: overrides.slaTierId ?? "gold",
        priority: overrides.priority ?? 5,
    };
}
function createResourceClaim(overrides = {}) {
    return {
        claimId: overrides.claimId ?? "claim-1",
        schedulingClass: overrides.schedulingClass ?? createSchedulingClass(),
        requestedUnits: overrides.requestedUnits ?? 10,
    };
}
function createQuotaPolicy(overrides = {}) {
    return {
        scopeId: overrides.scopeId ?? "tenant-1",
        resourceType: overrides.resourceType ?? "runtime_units",
        hardLimit: overrides.hardLimit ?? 100,
        softLimit: overrides.softLimit ?? 80,
        burstLimit: overrides.burstLimit ?? 120,
        resetWindow: overrides.resetWindow ?? "1h",
        currentUsage: overrides.currentUsage ?? 50,
    };
}
function createQueueItem(overrides = {}) {
    return {
        itemId: overrides.itemId ?? "item-1",
        tenantId: overrides.tenantId ?? "tenant-1",
        priority: overrides.priority ?? 5,
        ageMs: overrides.ageMs ?? 0,
    };
}
function createPreemptionCandidate(overrides = {}) {
    return {
        executionId: overrides.executionId ?? "exec-1",
        priority: overrides.priority ?? 3,
        progressPercent: overrides.progressPercent ?? 50,
    };
}
test("FairSchedulingService.schedule returns decision with queue ordering", () => {
    const service = new FairSchedulingService();
    const queueItems = [
        createQueueItem({ itemId: "low", priority: 1, ageMs: 0 }),
        createQueueItem({ itemId: "high", priority: 10, ageMs: 0 }),
    ];
    const request = {
        quotaPolicy: createQuotaPolicy(),
        claim: createResourceClaim(),
        queueItems,
        preemptionCandidates: [],
    };
    const decision = service.schedule(request);
    assert.equal(decision.queue.orderedItemIds.length, 2);
    assert.equal(decision.queue.orderedItemIds[0], "high");
    assert.equal(decision.queue.orderedItemIds[1], "low");
});
test("FairSchedulingService.schedule identifies starved items at 15 minutes", () => {
    const service = new FairSchedulingService();
    const queueItems = [
        createQueueItem({ itemId: "fresh", ageMs: 5 * 60_000 }),
        createQueueItem({ itemId: "starved", ageMs: 16 * 60_000 }),
    ];
    const request = {
        quotaPolicy: createQuotaPolicy(),
        claim: createResourceClaim(),
        queueItems,
        preemptionCandidates: [],
    };
    const decision = service.schedule(request);
    assert.deepEqual(decision.queue.starvedItemIds, ["starved"]);
});
test("FairSchedulingService.schedule does not preempt when quota not exceeded", () => {
    const service = new FairSchedulingService();
    const request = {
        quotaPolicy: createQuotaPolicy({ currentUsage: 50, hardLimit: 100 }),
        claim: createResourceClaim({ requestedUnits: 10 }),
        queueItems: [],
        preemptionCandidates: [createPreemptionCandidate()],
    };
    const decision = service.schedule(request);
    assert.equal(decision.queue.quotaExceeded, false);
    assert.equal(decision.preemption.shouldPreempt, false);
    assert.equal(decision.preemption.victimExecutionId, null);
    assert.equal(decision.preemption.reason, null);
});
test("FairSchedulingService.schedule preempts when quota exceeded with victim", () => {
    const service = new FairSchedulingService();
    const candidates = [
        createPreemptionCandidate({ executionId: "high-prio", priority: 10, progressPercent: 80 }),
        createPreemptionCandidate({ executionId: "low-prio", priority: 1, progressPercent: 30 }),
    ];
    const request = {
        quotaPolicy: createQuotaPolicy({ currentUsage: 100, hardLimit: 80, burstLimit: 100 }),
        claim: createResourceClaim({ requestedUnits: 10 }),
        queueItems: [],
        preemptionCandidates: candidates,
    };
    const decision = service.schedule(request);
    assert.equal(decision.queue.quotaExceeded, true);
    assert.equal(decision.preemption.shouldPreempt, true);
    assert.equal(decision.preemption.victimExecutionId, "low-prio");
    assert.equal(decision.preemption.reason, "resource_manager.quota_exceeded_preempt_low_priority");
});
test("FairSchedulingService.schedule handles quota exceeded without victim", () => {
    const service = new FairSchedulingService();
    const request = {
        quotaPolicy: createQuotaPolicy({ currentUsage: 100, hardLimit: 80, burstLimit: 100 }),
        claim: createResourceClaim({ requestedUnits: 10 }),
        queueItems: [],
        preemptionCandidates: [],
    };
    const decision = service.schedule(request);
    assert.equal(decision.queue.quotaExceeded, true);
    assert.equal(decision.preemption.shouldPreempt, false);
    assert.equal(decision.preemption.reason, "resource_manager.quota_exceeded_without_victim");
});
test("orderFairQueue orders by priority and age score", () => {
    const items = [
        createQueueItem({ itemId: "low-prio", priority: 1, ageMs: 0 }),
        createQueueItem({ itemId: "high-prio", priority: 10, ageMs: 0 }),
        createQueueItem({ itemId: "medium-prio", priority: 5, ageMs: 10 * 60_000 }),
    ];
    const ordered = orderFairQueue(items);
    assert.equal(ordered[0].itemId, "high-prio");
    assert.equal(ordered[1].itemId, "medium-prio");
    assert.equal(ordered[2].itemId, "low-prio");
});
test("choosePreemptionVictim selects lowest priority", () => {
    const candidates = [
        createPreemptionCandidate({ executionId: "high", priority: 10 }),
        createPreemptionCandidate({ executionId: "low", priority: 1 }),
        createPreemptionCandidate({ executionId: "medium", priority: 5 }),
    ];
    const victim = choosePreemptionVictim(candidates);
    assert.equal(victim?.executionId, "low");
});
test("choosePreemptionVictim returns null for empty array", () => {
    const victim = choosePreemptionVictim([]);
    assert.equal(victim, null);
});
test("isQuotaExceeded returns true when usage exceeds burst", () => {
    const policy = createQuotaPolicy({ currentUsage: 100, hardLimit: 80, burstLimit: 100 });
    const exceeded = isQuotaExceeded(policy, 10);
    assert.equal(exceeded, true);
});
test("isQuotaExceeded returns false when within limits", () => {
    const policy = createQuotaPolicy({ currentUsage: 50, hardLimit: 100 });
    const exceeded = isQuotaExceeded(policy, 10);
    assert.equal(exceeded, false);
});
test("evaluateQuota returns correct decision fields", () => {
    // currentUsage=70, requested=20, projected=90
    // hardLimit=80, softLimit=60, burstLimit=100
    // exceeded = 90 > 100 = false
    // warning = 90 > 60 = true
    // usesBurst = 90 > 80 && 90 <= 100 = true
    // remaining = 100 - 90 = 10
    const policy = createQuotaPolicy({ currentUsage: 70, softLimit: 60, hardLimit: 80, burstLimit: 100 });
    const decision = evaluateQuota(policy, 20);
    assert.equal(decision.exceeded, false);
    assert.equal(decision.warning, true);
    assert.equal(decision.usesBurst, true);
    assert.equal(decision.remainingUnits, 10);
});
test("QuotaPolicySchema parses valid policy", () => {
    const result = QuotaPolicySchema.safeParse({
        scopeId: "tenant-1",
        hardLimit: 100,
        currentUsage: 50,
    });
    assert.equal(result.success, true);
    if (result.success) {
        assert.equal(result.data.resourceType, "runtime_units");
        assert.equal(result.data.resetWindow, "1h");
    }
});
test("QuotaPolicySchema rejects empty scopeId", () => {
    const result = QuotaPolicySchema.safeParse({
        scopeId: "",
        hardLimit: 100,
        currentUsage: 50,
    });
    assert.equal(result.success, false);
});
//# sourceMappingURL=fair-scheduling-service.test.js.map