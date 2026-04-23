import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { 
// Resource Quota
createResourceQuota, canAllocate, calculateBurstCapacity, inheritQuota, 
// Priority Scheduler
PRIORITY_CLASSES, canPreempt, PriorityScheduler, parseTimeoutToMs, hasExceededTimeout, 
// Fair Scheduler
FairScheduler, } from "../../../../../src/platform/shared/scaling/index.js";
describe("ResourceQuota", () => {
    describe("createResourceQuota", () => {
        test("should create quota with default values", () => {
            const quota = createResourceQuota("org-1");
            assert.strictEqual(quota.orgNodeId, "org-1");
            assert.strictEqual(quota.guaranteed.maxConcurrentWorkflows, 10);
            assert.strictEqual(quota.burstable.maxConcurrentWorkflows, 10);
            assert.strictEqual(quota.maxLimit.maxConcurrentWorkflows, 10);
        });
        test("should apply overrides", () => {
            const quota = createResourceQuota("org-1", {
                guaranteed: { maxConcurrentWorkflows: 20 },
                maxLimit: { maxConcurrentWorkflows: 50 },
            });
            assert.strictEqual(quota.guaranteed.maxConcurrentWorkflows, 20);
            assert.strictEqual(quota.maxLimit.maxConcurrentWorkflows, 50);
        });
    });
    describe("canAllocate", () => {
        const quota = createResourceQuota("org-1", {
            guaranteed: { maxConcurrentWorkflows: 5, llmTokensPerMinute: 5000 },
            burstable: { maxConcurrentWorkflows: 10, llmTokensPerMinute: 10000 },
            maxLimit: { maxConcurrentWorkflows: 20, llmTokensPerMinute: 20000 },
        });
        test("should admit when within guaranteed", () => {
            const usage = {
                orgNodeId: "org-1",
                activeWorkflows: 3,
                activeWorkers: 0,
                llmTokensUsedLastMinute: 1000,
                llmRequestsUsedLastMinute: 0,
            };
            const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 1 });
            assert.strictEqual(result.admitted, true);
        });
        test("should admit when within burstable but not guaranteed", () => {
            const usage = {
                orgNodeId: "org-1",
                activeWorkflows: 7,
                activeWorkers: 0,
                llmTokensUsedLastMinute: 1000,
                llmRequestsUsedLastMinute: 0,
            };
            const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 1 });
            assert.strictEqual(result.admitted, true);
        });
        test("should reject when exceeding maxLimit", () => {
            const usage = {
                orgNodeId: "org-1",
                activeWorkflows: 19,
                activeWorkers: 0,
                llmTokensUsedLastMinute: 0,
                llmRequestsUsedLastMinute: 0,
            };
            const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 2 });
            assert.strictEqual(result.admitted, false);
            assert.strictEqual(result.rejectedDueTo, "maxConcurrentWorkflows");
        });
    });
    describe("calculateBurstCapacity", () => {
        test("should calculate available burst capacity", () => {
            const quota = createResourceQuota("org-1", {
                guaranteed: { maxConcurrentWorkflows: 5 },
                burstable: { maxConcurrentWorkflows: 10 },
            });
            const usage = {
                orgNodeId: "org-1",
                activeWorkflows: 3,
                activeWorkers: 0,
                llmTokensUsedLastMinute: 0,
                llmRequestsUsedLastMinute: 0,
            };
            const burst = calculateBurstCapacity(quota, usage);
            assert.strictEqual(burst.maxConcurrentWorkflows, 7); // burstable(10) - used at guaranteed level(3)
        });
    });
    describe("inheritQuota", () => {
        test("should scale down parent quota by ratio", () => {
            const parent = createResourceQuota("parent", {
                guaranteed: { maxConcurrentWorkflows: 20 },
                burstable: { maxConcurrentWorkflows: 40 },
                maxLimit: { maxConcurrentWorkflows: 100 },
            });
            const child = inheritQuota(parent, 0.5);
            assert.strictEqual(child.guaranteed.maxConcurrentWorkflows, 10);
            assert.strictEqual(child.burstable.maxConcurrentWorkflows, 20);
            assert.strictEqual(child.maxLimit.maxConcurrentWorkflows, 50);
        });
    });
});
describe("PriorityClasses", () => {
    test("critical should have highest priority value", () => {
        assert.strictEqual(PRIORITY_CLASSES.critical.priorityValue, 1000);
        assert.strictEqual(PRIORITY_CLASSES.critical.preemptionPolicy, "any_non_critical");
    });
    test("high should preempt lower priority", () => {
        assert.strictEqual(PRIORITY_CLASSES.high.preemptionPolicy, "lower_priority");
        assert.strictEqual(PRIORITY_CLASSES.high.priorityValue, 800);
    });
    test("standard should not preempt", () => {
        assert.strictEqual(PRIORITY_CLASSES.standard.preemptionPolicy, "never");
        assert.strictEqual(PRIORITY_CLASSES.standard.priorityValue, 500);
    });
    test("best_effort should have lowest priority", () => {
        assert.strictEqual(PRIORITY_CLASSES.best_effort.priorityValue, 0);
        assert.strictEqual(PRIORITY_CLASSES.best_effort.preemptionPolicy, "never");
    });
});
describe("canPreempt", () => {
    const criticalTask = {
        taskId: "critical-1",
        priorityClass: "critical",
        priorityValue: 1000,
        enqueuedAt: Date.now(),
        waitedMs: 0,
        canBePreempted: false,
        requestedResources: {},
    };
    const standardTask = {
        taskId: "standard-1",
        priorityClass: "standard",
        priorityValue: 500,
        enqueuedAt: Date.now(),
        waitedMs: 0,
        canBePreempted: true,
        requestedResources: {},
    };
    test("critical can preempt standard", () => {
        const result = canPreempt(criticalTask, standardTask);
        assert.strictEqual(result.shouldPreempt, true);
        assert.strictEqual(result.preemptedTaskId, "standard-1");
    });
    test("standard cannot preempt critical", () => {
        const result = canPreempt(standardTask, criticalTask);
        assert.strictEqual(result.shouldPreempt, false);
    });
});
describe("PriorityScheduler", () => {
    test("should dequeue higher priority first", () => {
        const scheduler = new PriorityScheduler();
        scheduler.enqueue({ taskId: "low", priorityClass: "standard", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
        scheduler.enqueue({ taskId: "high", priorityClass: "high", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
        scheduler.enqueue({ taskId: "critical", priorityClass: "critical", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
        const first = scheduler.dequeue(10);
        assert.strictEqual(first?.taskId, "critical");
    });
    test("should respect maxWorkers limit", () => {
        const scheduler = new PriorityScheduler();
        scheduler.enqueue({ taskId: "task-1", priorityClass: "standard", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
        scheduler.enqueue({ taskId: "task-2", priorityClass: "standard", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
        const first = scheduler.dequeue(1);
        assert.strictEqual(first?.taskId, "task-1");
        const second = scheduler.dequeue(1);
        assert.strictEqual(second, null); // No slots available, no preemption possible
    });
    test("should preempt lower priority when queue is full", () => {
        const scheduler = new PriorityScheduler();
        // Fill the queue with low priority
        scheduler.enqueue({ taskId: "low-1", priorityClass: "standard", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
        scheduler.dequeue(1); // Start low-1
        // Try to add high priority
        scheduler.enqueue({ taskId: "high-1", priorityClass: "high", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
        const preempted = scheduler.dequeue(1);
        assert.strictEqual(preempted?.taskId, "high-1");
    });
    test("should complete task and free slot", () => {
        const scheduler = new PriorityScheduler();
        scheduler.enqueue({ taskId: "task-1", priorityClass: "standard", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
        scheduler.dequeue(1);
        scheduler.complete("task-1");
        scheduler.enqueue({ taskId: "task-2", priorityClass: "standard", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
        const next = scheduler.dequeue(1);
        assert.strictEqual(next?.taskId, "task-2");
    });
    test("should get queue depth by priority", () => {
        const scheduler = new PriorityScheduler();
        scheduler.enqueue({ taskId: "c1", priorityClass: "critical", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
        scheduler.enqueue({ taskId: "h1", priorityClass: "high", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
        scheduler.enqueue({ taskId: "s1", priorityClass: "standard", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
        const depth = scheduler.getQueueDepthByPriority();
        assert.strictEqual(depth.critical, 1);
        assert.strictEqual(depth.high, 1);
        assert.strictEqual(depth.standard, 1);
    });
});
describe("parseTimeoutToMs", () => {
    test("should parse seconds", () => {
        assert.strictEqual(parseTimeoutToMs("30s"), 30000);
    });
    test("should parse minutes", () => {
        assert.strictEqual(parseTimeoutToMs("5m"), 300000);
    });
    test("should parse hours", () => {
        assert.strictEqual(parseTimeoutToMs("1h"), 3600000);
    });
    test("should return Infinity for invalid", () => {
        assert.strictEqual(parseTimeoutToMs("invalid"), Infinity);
    });
});
describe("hasExceededTimeout", () => {
    test("should detect timeout for waiting task", () => {
        const task = {
            taskId: "task-1",
            priorityClass: "standard",
            priorityValue: 500,
            enqueuedAt: Date.now() - 10 * 60 * 1000, // 10 min ago
            waitedMs: 10 * 60 * 1000,
            canBePreempted: true,
            requestedResources: {},
        };
        // Standard has 5m timeout, task waited 10m
        assert.strictEqual(hasExceededTimeout(task), true);
    });
});
describe("FairScheduler", () => {
    const totalCapacity = {
        maxConcurrentWorkflows: 100,
        maxConcurrentWorkers: 50,
        llmTokensPerMinute: 100000,
        llmRequestsPerMinute: 1000,
    };
    test("should register tenant with weight", () => {
        const scheduler = new FairScheduler(totalCapacity);
        scheduler.registerTenant("tenant-1", 1.0, {
            maxConcurrentWorkflows: 50,
            maxConcurrentWorkers: 25,
            llmTokensPerMinute: 50000,
            llmRequestsPerMinute: 500,
        });
        const stats = scheduler.getTenantStats("tenant-1");
        assert.ok(stats);
        assert.strictEqual(stats.guaranteed.maxConcurrentWorkflows, 50);
    });
    test("should admit task within quota", () => {
        const scheduler = new FairScheduler(totalCapacity);
        scheduler.registerTenant("tenant-1", 1.0, {
            maxConcurrentWorkflows: 50,
            maxConcurrentWorkers: 25,
            llmTokensPerMinute: 50000,
            llmRequestsPerMinute: 500,
        });
        const decision = scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 1 });
        assert.strictEqual(decision.admitted, true);
    });
    test("should reject task exceeding quota", () => {
        const scheduler = new FairScheduler(totalCapacity);
        scheduler.registerTenant("tenant-1", 1.0, {
            maxConcurrentWorkflows: 5,
            maxConcurrentWorkers: 5,
            llmTokensPerMinute: 5000,
            llmRequestsPerMinute: 50,
        });
        // Fill up to limit
        scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 5 });
        const decision = scheduler.admitTask("tenant-1", "task-6", { maxConcurrentWorkflows: 1 });
        assert.strictEqual(decision.admitted, false);
    });
    test("should release resources on completion", () => {
        const scheduler = new FairScheduler(totalCapacity);
        scheduler.registerTenant("tenant-1", 1.0, {
            maxConcurrentWorkflows: 50,
            maxConcurrentWorkers: 25,
            llmTokensPerMinute: 50000,
            llmRequestsPerMinute: 500,
        });
        scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 5 });
        scheduler.releaseResources("tenant-1", { maxConcurrentWorkflows: 5 });
        const decision = scheduler.admitTask("tenant-1", "task-2", { maxConcurrentWorkflows: 5 });
        assert.strictEqual(decision.admitted, true);
    });
    test("should track utilization", () => {
        const scheduler = new FairScheduler(totalCapacity);
        scheduler.registerTenant("tenant-1", 1.0, {
            maxConcurrentWorkflows: 10,
            maxConcurrentWorkers: 10,
            llmTokensPerMinute: 10000,
            llmRequestsPerMinute: 100,
        });
        scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 5, llmTokensPerMinute: 5000 });
        const stats = scheduler.getTenantStats("tenant-1");
        assert.ok(stats);
        assert.strictEqual(stats.utilizationPercent > 0, true);
    });
});
//# sourceMappingURL=resource-management.test.js.map