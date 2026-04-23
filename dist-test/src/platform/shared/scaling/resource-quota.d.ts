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
export declare const DEFAULT_RESOURCE_ALLOCATION: ResourceAllocation;
/**
 * Creates a ResourceQuota with default values for an org node.
 */
export declare function createResourceQuota(orgNodeId: string, overrides?: Partial<{
    guaranteed: Partial<ResourceAllocation>;
    burstable: Partial<ResourceAllocation>;
    maxLimit: Partial<ResourceAllocation>;
}>): ResourceQuota;
/**
 * Checks if requested resources can be allocated within quota limits.
 */
export declare function canAllocate(quota: ResourceQuota, usage: QuotaUsage, requested: Partial<ResourceAllocation>): QuotaAllocationResult;
/**
 * Calculates available burstable resources (guaranteed minus used, plus idle burst capacity).
 */
export declare function calculateBurstCapacity(quota: ResourceQuota, usage: QuotaUsage): ResourceAllocation;
/**
 * Merges quotas from parent org node to child (child inherits portion of parent quota).
 */
export declare function inheritQuota(parentQuota: ResourceQuota, ratio?: number): ResourceQuota;
