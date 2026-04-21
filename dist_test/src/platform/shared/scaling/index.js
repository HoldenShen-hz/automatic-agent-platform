/**
 * @fileoverview Shared scaling components.
 *
 * Implements §53 "规模化资源竞争管理" (Scaling Resource Competition Management):
 * - ResourceQuota: Org-level resource allocation with guaranteed/burstable/maxLimit
 * - PriorityScheduler: 5-level priority classes with preemption support
 * - FairScheduler: Weighted Fair Queuing with borrowing and reclaim
 */
export * from "./horizontal-scaling-controller.js";
export * from "./resource-quota.js";
export * from "./priority-scheduler.js";
export * from "./fair-scheduler.js";
//# sourceMappingURL=index.js.map