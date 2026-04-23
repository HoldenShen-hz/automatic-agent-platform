/**
 * @fileoverview Fair Scheduler with Weighted Fair Queuing
 *
 * Implements §53 "Scale-out resource competition management" - Fair Scheduling.
 * Provides Weighted Fair Queuing, borrowing, reclaim, and starvation prevention.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §53.4
 */
import type { ResourceAllocation } from "./resource-quota.js";
/**
 * Tenant/Division context for fair scheduling decisions.
 */
export interface SchedulingTenant {
    tenantId: string;
    weight: number;
    guaranteedAllocation: ResourceAllocation;
    currentlyUsed: ResourceAllocation;
    borrowedResources: BorrowedResources;
}
/**
 * Borrowed resources from other tenants.
 */
export interface BorrowedResources {
    workflows: number;
    workers: number;
    tokensPerMinute: number;
}
/**
 * Scheduling decision with allocation details.
 */
export interface SchedulingDecision {
    admitted: boolean;
    tenantId: string;
    taskId: string;
    allocatedResources: Partial<ResourceAllocation>;
    waitReason?: string | undefined;
    borrowedFrom?: string[] | undefined;
}
/**
 * Work-conserving fair scheduler that implements WFQ with borrowing/reclaim.
 */
export declare class FairScheduler {
    private tenants;
    private totalCapacity;
    constructor(totalCapacity: ResourceAllocation);
    /**
     * Register a tenant with its guaranteed allocation.
     */
    registerTenant(tenantId: string, weight: number, guaranteed: ResourceAllocation): void;
    /**
     * Unregister a tenant and reclaim its borrowed resources.
     */
    unregisterTenant(tenantId: string): void;
    /**
     * Attempt to admit a task for a tenant.
     */
    admitTask(tenantId: string, taskId: string, requested: Partial<ResourceAllocation>): SchedulingDecision;
    /**
     * Release resources when a task completes (triggers reclaim if borrowed).
     */
    releaseResources(tenantId: string, released: Partial<ResourceAllocation>): void;
    /**
     * Trigger reclaim of borrowed resources back to lenders.
     */
    private reclaimBorrowed;
    /**
     * Try to borrow resources from tenants with idle capacity.
     */
    private tryBorrow;
    /**
     * Check if requested resources fit within available capacity.
     */
    private checkResourceFit;
    /**
     * Get scheduler statistics for a tenant.
     */
    getTenantStats(tenantId: string): {
        used: ResourceAllocation;
        guaranteed: ResourceAllocation;
        borrowed: BorrowedResources;
        utilizationPercent: number;
    } | null;
    /**
     * Get all tenants utilization summary.
     */
    getAllUtilization(): Array<{
        tenantId: string;
        utilizationPercent: number;
        isBorrowing: boolean;
    }>;
}
