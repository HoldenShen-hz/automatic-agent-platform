/**
 * @fileoverview Fair Scheduler with Weighted Fair Queuing
 *
 * Implements §53 "规模化资源竞争管理" - Fair Scheduling.
 * Provides Weighted Fair Queuing, borrowing, reclaim, and starvation prevention.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §53.4
 */

import type { ResourceAllocation } from "./resource-quota.js";
import type { PriorityClassName } from "./priority-scheduler.js";

/**
 * Tenant/Division context for fair scheduling decisions.
 */
export interface SchedulingTenant {
  tenantId: string;
  weight: number; // Relative weight for WFQ
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
  waitReason?: string;
  borrowedFrom?: string[];
}

/**
 * Work-conserving fair scheduler that implements WFQ with borrowing/reclaim.
 */
export class FairScheduler {
  private tenants: Map<string, SchedulingTenant> = new Map();
  private totalCapacity: ResourceAllocation;

  constructor(totalCapacity: ResourceAllocation) {
    this.totalCapacity = { ...totalCapacity };
  }

  /**
   * Register a tenant with its guaranteed allocation.
   */
  registerTenant(tenantId: string, weight: number, guaranteed: ResourceAllocation): void {
    this.tenants.set(tenantId, {
      tenantId,
      weight,
      guaranteedAllocation: guaranteed,
      currentlyUsed: {
        maxConcurrentWorkflows: 0,
        maxConcurrentWorkers: 0,
        llmTokensPerMinute: 0,
        llmRequestsPerMinute: 0,
      },
      borrowedResources: { workflows: 0, workers: 0, tokensPerMinute: 0 },
    });
  }

  /**
   * Unregister a tenant and reclaim its borrowed resources.
   */
  unregisterTenant(tenantId: string): void {
    this.tenants.delete(tenantId);
  }

  /**
   * Attempt to admit a task for a tenant.
   */
  admitTask(
    tenantId: string,
    taskId: string,
    requested: Partial<ResourceAllocation>,
  ): SchedulingDecision {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return {
        admitted: false,
        tenantId,
        taskId,
        allocatedResources: {},
        waitReason: `Tenant ${tenantId} not registered`,
      };
    }

    const used = tenant.currentlyUsed;
    const guaranteed = tenant.guaranteedAllocation;
    const borrowed = tenant.borrowedResources;

    // Calculate total available (guaranteed + borrowed)
    const totalAvailable: ResourceAllocation = {
      maxConcurrentWorkflows: guaranteed.maxConcurrentWorkflows + borrowed.workflows,
      maxConcurrentWorkers: guaranteed.maxConcurrentWorkers + borrowed.workers,
      llmTokensPerMinute: guaranteed.llmTokensPerMinute + borrowed.tokensPerMinute,
      llmRequestsPerMinute: guaranteed.llmRequestsPerMinute + borrowed.workflows, // workflows used as proxy
    };

    // Check if within total available
    const willFit = this.checkResourceFit(totalAvailable, used, requested);

    if (!willFit.admitted) {
      // Try to borrow from other tenants
      const borrowResult = this.tryBorrow(tenantId, requested);
      if (borrowResult.borrowed) {
        // Update tenant's borrowed resources
        tenant.borrowedResources.workflows += borrowResult.workflowsBorrowed ?? 0;
        tenant.borrowedResources.workers += borrowResult.workersBorrowed ?? 0;
        tenant.borrowedResources.tokensPerMinute += borrowResult.tokensBorrowed ?? 0;

        // Admit the task
        used.maxConcurrentWorkflows += requested.maxConcurrentWorkflows ?? 0;
        used.maxConcurrentWorkers += requested.maxConcurrentWorkers ?? 0;
        used.llmTokensPerMinute += requested.llmTokensPerMinute ?? 0;
        used.llmRequestsPerMinute += requested.llmRequestsPerMinute ?? 0;

        return {
          admitted: true,
          tenantId,
          taskId,
          allocatedResources: requested,
          borrowedFrom: borrowResult.lenders,
        };
      }

      return {
        admitted: false,
        tenantId,
        taskId,
        allocatedResources: {},
        waitReason: willFit.reason,
      };
    }

    // Admit the task
    used.maxConcurrentWorkflows += requested.maxConcurrentWorkflows ?? 0;
    used.maxConcurrentWorkers += requested.maxConcurrentWorkers ?? 0;
    used.llmTokensPerMinute += requested.llmTokensPerMinute ?? 0;
    used.llmRequestsPerMinute += requested.llmRequestsPerMinute ?? 0;

    return {
      admitted: true,
      tenantId,
      taskId,
      allocatedResources: requested,
    };
  }

  /**
   * Release resources when a task completes (triggers reclaim if borrowed).
   */
  releaseResources(
    tenantId: string,
    released: Partial<ResourceAllocation>,
  ): void {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return;

    // Return borrowed resources first
    if (tenant.borrowedResources.workflows > 0) {
      const workflowsToReturn = Math.min(released.maxConcurrentWorkflows ?? 0, tenant.borrowedResources.workflows);
      this.reclaimBorrowed(tenantId, workflowsToReturn, "workflows");
      released.maxConcurrentWorkflows = Math.max(0, (released.maxConcurrentWorkflows ?? 0) - workflowsToReturn);
    }

    if (tenant.borrowedResources.workers > 0) {
      const workersToReturn = Math.min(released.maxConcurrentWorkers ?? 0, tenant.borrowedResources.workers);
      this.reclaimBorrowed(tenantId, workersToReturn, "workers");
      released.maxConcurrentWorkers = Math.max(0, (released.maxConcurrentWorkers ?? 0) - workersToReturn);
    }

    // Decrement used resources
    tenant.currentlyUsed.maxConcurrentWorkflows = Math.max(
      0,
      tenant.currentlyUsed.maxConcurrentWorkflows - (released.maxConcurrentWorkflows ?? 0),
    );
    tenant.currentlyUsed.maxConcurrentWorkers = Math.max(
      0,
      tenant.currentlyUsed.maxConcurrentWorkers - (released.maxConcurrentWorkers ?? 0),
    );
    tenant.currentlyUsed.llmTokensPerMinute = Math.max(
      0,
      tenant.currentlyUsed.llmTokensPerMinute - (released.llmTokensPerMinute ?? 0),
    );
    tenant.currentlyUsed.llmRequestsPerMinute = Math.max(
      0,
      tenant.currentlyUsed.llmRequestsPerMinute - (released.llmRequestsPerMinute ?? 0),
    );
  }

  /**
   * Trigger reclaim of borrowed resources back to lenders.
   */
  private reclaimBorrowed(tenantId: string, amount: number, resourceType: "workflows" | "workers" | "tokensPerMinute"): void {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return;

    const borrowedKey = resourceType === "tokensPerMinute" ? "tokensPerMinute" : resourceType;
    const borrowedAmount = tenant.borrowedResources[borrowedKey];
    if (borrowedAmount <= 0) return;

    // Find lenders and return proportional amounts
    const lenders: Array<{ lenderId: string; proportion: number }> = [];
    let totalBorrowedFromOthers = 0;

    for (const [otherId, otherTenant] of this.tenants) {
      if (otherId === tenantId) continue;
      const lentAmount = otherTenant.borrowedResources[borrowedKey] < 0 ? Math.abs(otherTenant.borrowedResources[borrowedKey]) : 0;
      if (lentAmount > 0) {
        lenders.push({ lenderId: otherId, proportion: lentAmount });
        totalBorrowedFromOthers += lentAmount;
      }
    }

    if (totalBorrowedFromOthers === 0) return;

    const returnAmount = Math.min(amount, borrowedAmount);
    for (const lender of lenders) {
      const proportion = lender.proportion / totalBorrowedFromOthers;
      const amountToReturn = Math.floor(returnAmount * proportion);

      const lenderTenant = this.tenants.get(lender.lenderId);
      if (lenderTenant) {
        lenderTenant.currentlyUsed[borrowedKey] += amountToReturn;
      }
    }

    tenant.borrowedResources[borrowedKey] -= returnAmount;
  }

  /**
   * Try to borrow resources from tenants with idle capacity.
   */
  private tryBorrow(
    requesterId: string,
    requested: Partial<ResourceAllocation>,
  ): {
    borrowed: boolean;
    workflowsBorrowed?: number;
    workersBorrowed?: number;
    tokensBorrowed?: number;
    lenders?: string[];
  } {
    const requester = this.tenants.get(requesterId);
    if (!requester) return { borrowed: false };

    const lenders: string[] = [];
    let workflowsBorrowed = 0;
    let workersBorrowed = 0;
    let tokensBorrowed = 0;

    for (const [tenantId, tenant] of this.tenants) {
      if (tenantId === requesterId) continue;

      // Calculate idle capacity for this tenant
      const idleWorkflows = tenant.guaranteedAllocation.maxConcurrentWorkflows - tenant.currentlyUsed.maxConcurrentWorkflows;
      const idleWorkers = tenant.guaranteedAllocation.maxConcurrentWorkers - tenant.currentlyUsed.maxConcurrentWorkers;
      const idleTokens = tenant.guaranteedAllocation.llmTokensPerMinute - tenant.currentlyUsed.llmTokensPerMinute;

      if ((requested.maxConcurrentWorkflows ?? 0) > 0 && idleWorkflows > 0) {
        const borrow = Math.min(requested.maxConcurrentWorkflows!, idleWorkflows);
        workflowsBorrowed += borrow;
        lenders.push(tenantId);
      }

      if ((requested.maxConcurrentWorkers ?? 0) > 0 && idleWorkers > 0) {
        const borrow = Math.min(requested.maxConcurrentWorkers!, idleWorkers);
        workersBorrowed += borrow;
        if (!lenders.includes(tenantId)) lenders.push(tenantId);
      }

      if ((requested.llmTokensPerMinute ?? 0) > 0 && idleTokens > 0) {
        const borrow = Math.min(requested.llmTokensPerMinute!, idleTokens);
        tokensBorrowed += borrow;
        if (!lenders.includes(tenantId)) lenders.push(tenantId);
      }
    }

    if (lenders.length === 0) {
      return { borrowed: false };
    }

    return {
      borrowed: true,
      workflowsBorrowed,
      workersBorrowed,
      tokensBorrowed,
      lenders,
    };
  }

  /**
   * Check if requested resources fit within available capacity.
   */
  private checkResourceFit(
    available: ResourceAllocation,
    used: ResourceAllocation,
    requested: Partial<ResourceAllocation>,
  ): { admitted: boolean; reason?: string } {
    const remaining = {
      maxConcurrentWorkflows: available.maxConcurrentWorkflows - used.maxConcurrentWorkflows,
      maxConcurrentWorkers: available.maxConcurrentWorkers - used.maxConcurrentWorkers,
      llmTokensPerMinute: available.llmTokensPerMinute - used.llmTokensPerMinute,
      llmRequestsPerMinute: available.llmRequestsPerMinute - used.llmRequestsPerMinute,
    };

    if ((requested.maxConcurrentWorkflows ?? 0) > remaining.maxConcurrentWorkflows) {
      return { admitted: false, reason: `Workflow limit: requested ${requested.maxConcurrentWorkflows}, available ${remaining.maxConcurrentWorkflows}` };
    }
    if ((requested.maxConcurrentWorkers ?? 0) > remaining.maxConcurrentWorkers) {
      return { admitted: false, reason: `Worker limit: requested ${requested.maxConcurrentWorkers}, available ${remaining.maxConcurrentWorkers}` };
    }
    if ((requested.llmTokensPerMinute ?? 0) > remaining.llmTokensPerMinute) {
      return { admitted: false, reason: `Token limit: requested ${requested.llmTokensPerMinute}, available ${remaining.llmTokensPerMinute}` };
    }

    return { admitted: true };
  }

  /**
   * Get scheduler statistics for a tenant.
   */
  getTenantStats(tenantId: string): {
    used: ResourceAllocation;
    guaranteed: ResourceAllocation;
    borrowed: BorrowedResources;
    utilizationPercent: number;
  } | null {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return null;

    const guaranteed = tenant.guaranteedAllocation;
    const totalUsage =
      tenant.currentlyUsed.maxConcurrentWorkflows
      + tenant.currentlyUsed.maxConcurrentWorkers
      + tenant.currentlyUsed.llmTokensPerMinute;
    const totalGuaranteed =
      guaranteed.maxConcurrentWorkflows
      + guaranteed.maxConcurrentWorkers
      + guaranteed.llmTokensPerMinute;

    return {
      used: { ...tenant.currentlyUsed },
      guaranteed: { ...guaranteed },
      borrowed: { ...tenant.borrowedResources },
      utilizationPercent: totalGuaranteed > 0 ? (totalUsage / totalGuaranteed) * 100 : 0,
    };
  }

  /**
   * Get all tenants utilization summary.
   */
  getAllUtilization(): Array<{ tenantId: string; utilizationPercent: number; isBorrowing: boolean }> {
    const result: Array<{ tenantId: string; utilizationPercent: number; isBorrowing: boolean }> = [];

    for (const [tenantId, tenant] of this.tenants) {
      const totalUsage =
        tenant.currentlyUsed.maxConcurrentWorkflows
        + tenant.currentlyUsed.maxConcurrentWorkers
        + tenant.currentlyUsed.llmTokensPerMinute;
      const totalGuaranteed =
        tenant.guaranteedAllocation.maxConcurrentWorkflows
        + tenant.guaranteedAllocation.maxConcurrentWorkers
        + tenant.guaranteedAllocation.llmTokensPerMinute;

      result.push({
        tenantId,
        utilizationPercent: totalGuaranteed > 0 ? (totalUsage / totalGuaranteed) * 100 : 0,
        isBorrowing: tenant.borrowedResources.workflows > 0 || tenant.borrowedResources.workers > 0,
      });
    }

    return result;
  }
}
