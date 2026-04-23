/**
 * @fileoverview Resource Quota Management
 *
 * Implements §53 "Scaling Resource Competition Management" - Resource Quota Model.
 * Provides org-level resource allocation with guaranteed, burstable, and max_limit tiers.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §53.2
 */

/**
 * Resource allocation specification for a quota tier.
 */
export interface ResourceAllocation {
  maxConcurrentWorkflows: number;
  maxConcurrentWorkers: number;
  llmTokensPerMinute: number;
  llmRequestsPerMinute: number;
}

/**
 * Resource quota for an organization node.
 * Defines guaranteed (always available), burstable (available when idle), and max_limit (hard cap).
 */
export interface ResourceQuota {
  orgNodeId: string;
  guaranteed: ResourceAllocation;
  burstable: ResourceAllocation;
  maxLimit: ResourceAllocation;
}

/**
 * Quota usage statistics for an organization.
 */
export interface QuotaUsage {
  orgNodeId: string;
  activeWorkflows: number;
  activeWorkers: number;
  llmTokensUsedLastMinute: number;
  llmRequestsUsedLastMinute: number;
}

/**
 * Quota allocation result indicating if a request can be admitted.
 */
export interface QuotaAllocationResult {
  admitted: boolean;
  reason: string;
  rejectedDueTo?: keyof ResourceAllocation;
  currentUsage: QuotaUsage;
  availableQuota: ResourceAllocation;
}

/**
 * Default resource allocation values.
 */
export const DEFAULT_RESOURCE_ALLOCATION: ResourceAllocation = {
  maxConcurrentWorkflows: 10,
  maxConcurrentWorkers: 5,
  llmTokensPerMinute: 10000,
  llmRequestsPerMinute: 60,
};

/**
 * Creates a ResourceQuota with default values for an org node.
 */
export function createResourceQuota(
  orgNodeId: string,
  overrides: Partial<{ guaranteed: Partial<ResourceAllocation>; burstable: Partial<ResourceAllocation>; maxLimit: Partial<ResourceAllocation> }> = {},
): ResourceQuota {
  return {
    orgNodeId,
    guaranteed: { ...DEFAULT_RESOURCE_ALLOCATION, ...overrides.guaranteed },
    burstable: { ...DEFAULT_RESOURCE_ALLOCATION, ...overrides.burstable },
    maxLimit: { ...DEFAULT_RESOURCE_ALLOCATION, ...overrides.maxLimit },
  };
}

/**
 * Checks if requested resources can be allocated within quota limits.
 */
export function canAllocate(
  quota: ResourceQuota,
  usage: QuotaUsage,
  requested: Partial<ResourceAllocation>,
): QuotaAllocationResult {
  // Check guaranteed tier first (always available if within guaranteed limits)
  if (requested.maxConcurrentWorkflows !== undefined) {
    if (usage.activeWorkflows + requested.maxConcurrentWorkflows > quota.guaranteed.maxConcurrentWorkflows) {
      if (usage.activeWorkflows + requested.maxConcurrentWorkflows > quota.maxLimit.maxConcurrentWorkflows) {
        return {
          admitted: false,
          reason: `Would exceed max limit: ${usage.activeWorkflows + requested.maxConcurrentWorkflows} > ${quota.maxLimit.maxConcurrentWorkflows}`,
          rejectedDueTo: "maxConcurrentWorkflows",
          currentUsage: usage,
          availableQuota: quota.maxLimit,
        };
      }
      // Within max but not guaranteed - check if burstable allows
      if (usage.activeWorkflows + requested.maxConcurrentWorkflows > quota.burstable.maxConcurrentWorkflows) {
        return {
          admitted: false,
          reason: `Would exceed burstable limit: ${usage.activeWorkflows + requested.maxConcurrentWorkflows} > ${quota.burstable.maxConcurrentWorkflows}`,
          rejectedDueTo: "maxConcurrentWorkflows",
          currentUsage: usage,
          availableQuota: quota.burstable,
        };
      }
    }
  }

  if (requested.llmTokensPerMinute !== undefined) {
    if (usage.llmTokensUsedLastMinute + requested.llmTokensPerMinute > quota.maxLimit.llmTokensPerMinute) {
      return {
        admitted: false,
        reason: `Would exceed LLM token limit: ${usage.llmTokensUsedLastMinute + requested.llmTokensPerMinute} > ${quota.maxLimit.llmTokensPerMinute}`,
        rejectedDueTo: "llmTokensPerMinute",
        currentUsage: usage,
        availableQuota: quota.maxLimit,
      };
    }
  }

  const availableQuota: ResourceAllocation = {
    maxConcurrentWorkflows: quota.maxLimit.maxConcurrentWorkflows - usage.activeWorkflows,
    maxConcurrentWorkers: quota.maxLimit.maxConcurrentWorkers - usage.activeWorkers,
    llmTokensPerMinute: quota.maxLimit.llmTokensPerMinute - usage.llmTokensUsedLastMinute,
    llmRequestsPerMinute: quota.maxLimit.llmRequestsPerMinute - usage.llmRequestsUsedLastMinute,
  };

  return {
    admitted: true,
    reason: "Within quota limits",
    currentUsage: usage,
    availableQuota,
  };
}

/**
 * Calculates available burstable resources (guaranteed minus used, plus idle burst capacity).
 */
export function calculateBurstCapacity(quota: ResourceQuota, usage: QuotaUsage): ResourceAllocation {
  const guaranteedUsed = {
    maxConcurrentWorkflows: Math.min(usage.activeWorkflows, quota.guaranteed.maxConcurrentWorkflows),
    maxConcurrentWorkers: Math.min(usage.activeWorkers, quota.guaranteed.maxConcurrentWorkers),
    llmTokensPerMinute: usage.llmTokensUsedLastMinute,
    llmRequestsPerMinute: usage.llmRequestsUsedLastMinute,
  };

  return {
    maxConcurrentWorkflows: quota.burstable.maxConcurrentWorkflows - guaranteedUsed.maxConcurrentWorkflows,
    maxConcurrentWorkers: quota.burstable.maxConcurrentWorkers - guaranteedUsed.maxConcurrentWorkers,
    llmTokensPerMinute: quota.burstable.llmTokensPerMinute - guaranteedUsed.llmTokensPerMinute,
    llmRequestsPerMinute: quota.burstable.llmRequestsPerMinute - guaranteedUsed.llmRequestsPerMinute,
  };
}

/**
 * Merges quotas from parent org node to child (child inherits portion of parent quota).
 */
export function inheritQuota(parentQuota: ResourceQuota, ratio: number = 0.5): ResourceQuota {
  const scale = (val: number) => Math.max(1, Math.floor(val * ratio));

  return {
    orgNodeId: "", // Child must set its own
    guaranteed: {
      maxConcurrentWorkflows: scale(parentQuota.guaranteed.maxConcurrentWorkflows),
      maxConcurrentWorkers: scale(parentQuota.guaranteed.maxConcurrentWorkers),
      llmTokensPerMinute: scale(parentQuota.guaranteed.llmTokensPerMinute),
      llmRequestsPerMinute: scale(parentQuota.guaranteed.llmRequestsPerMinute),
    },
    burstable: {
      maxConcurrentWorkflows: scale(parentQuota.burstable.maxConcurrentWorkflows),
      maxConcurrentWorkers: scale(parentQuota.burstable.maxConcurrentWorkers),
      llmTokensPerMinute: scale(parentQuota.burstable.llmTokensPerMinute),
      llmRequestsPerMinute: scale(parentQuota.burstable.llmRequestsPerMinute),
    },
    maxLimit: {
      maxConcurrentWorkflows: scale(parentQuota.maxLimit.maxConcurrentWorkflows),
      maxConcurrentWorkers: scale(parentQuota.maxLimit.maxConcurrentWorkers),
      llmTokensPerMinute: scale(parentQuota.maxLimit.llmTokensPerMinute),
      llmRequestsPerMinute: scale(parentQuota.maxLimit.llmRequestsPerMinute),
    },
  };
}
