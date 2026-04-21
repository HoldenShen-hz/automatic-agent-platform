/**
 * @fileoverview Resource Quota Management
 *
 * Implements §53 "规模化资源竞争管理" - Resource Quota Model.
 * Provides org-level resource allocation with guaranteed, burstable, and max_limit tiers.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §53.2
 */
/**
 * Default resource allocation values.
 */
export const DEFAULT_RESOURCE_ALLOCATION = {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 60,
};
/**
 * Creates a ResourceQuota with default values for an org node.
 */
export function createResourceQuota(orgNodeId, overrides = {}) {
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
export function canAllocate(quota, usage, requested) {
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
    const availableQuota = {
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
export function calculateBurstCapacity(quota, usage) {
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
export function inheritQuota(parentQuota, ratio = 0.5) {
    const scale = (val) => Math.max(1, Math.floor(val * ratio));
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
//# sourceMappingURL=resource-quota.js.map