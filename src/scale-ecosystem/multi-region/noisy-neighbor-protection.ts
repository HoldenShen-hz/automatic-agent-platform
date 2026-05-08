/**
 * Noisy Neighbor Protection Service
 *
 * Implements resource quota enforcement and rate limiting to prevent
 * tenants from consuming excessive shared resources.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §52
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";

/**
 * Resource type for quota tracking
 */
export type ResourceType =
  | "cpu"
  | "memory"
  | "storage"
  | "network_bandwidth"
  | "api_requests"
  | "task_executions"
  | "concurrent_connections";

/**
 * Quota configuration for a tenant
 */
export interface TenantQuota {
  readonly quotaId: string;
  readonly tenantId: string;
  readonly resourceType: ResourceType;
  readonly limit: number;
  readonly windowSeconds: number;
  readonly burstLimit: number | null;
  readonly priority: number;
}

/**
 * Current usage measurement
 */
export interface ResourceUsage {
  readonly usageId: string;
  readonly tenantId: string;
  readonly resourceType: ResourceType;
  readonly used: number;
  readonly limit: number;
  readonly windowSeconds: number;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly percentUsed: number;
}

/**
 * Rate limit decision
 */
export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly tenantId: string;
  readonly resourceType: ResourceType;
  readonly currentUsage: number;
  readonly limit: number;
  readonly remaining: number;
  readonly retryAfterMs: number | null;
  readonly quotaId: string;
}

/**
 * Token bucket state for burst handling
 */
interface TokenBucket {
  readonly tokens: number;
  readonly lastRefillAt: number;
  readonly maxTokens: number;
  readonly refillRatePerSecond: number;
}

/**
 * Usage record for tracking
 */
interface UsageRecord {
  readonly tenantId: string;
  readonly resourceType: ResourceType;
  readonly used: number;
  readonly quotaId: string;
  readonly windowStart: string;
  readonly windowEnd: string;
}

/**
 * Noisy Neighbor Protection Service
 */
export class NoisyNeighborProtectionService {
  private readonly quotas = new Map<string, TenantQuota>();
  private readonly usageRecords = new Map<string, UsageRecord>();
  private readonly tokenBuckets = new Map<string, TokenBucket>();

  /**
   * Register a quota for a tenant
   */
  public registerQuota(quota: TenantQuota): void {
    this.quotas.set(quota.quotaId, quota);
  }

  /**
   * Register multiple quotas for a tenant
   */
  public registerQuotas(tenantId: string, quotas: readonly Omit<TenantQuota, "quotaId" | "tenantId">[]): void {
    for (const quota of quotas) {
      const fullQuota: TenantQuota = {
        ...quota,
        quotaId: newId("quota"),
        tenantId,
      };
      this.registerQuota(fullQuota);
    }
  }

  /**
   * Check if a request is allowed under current quotas
   */
  public checkRateLimit(
    tenantId: string,
    resourceType: ResourceType,
    cost: number = 1,
  ): RateLimitDecision {
    const quota = this.findQuota(tenantId, resourceType);
    if (!quota) {
      // No quota = unlimited
      return {
        allowed: true,
        tenantId,
        resourceType,
        currentUsage: 0,
        limit: Infinity,
        remaining: Infinity,
        retryAfterMs: null,
        quotaId: "",
      };
    }

    // Get current usage
    const usage = this.getCurrentUsage(tenantId, resourceType);
    const now = Date.now();

    // Check token bucket for burst
    if (quota.burstLimit !== null) {
      const bucketKey = `${tenantId}:${resourceType}`;
      const bucket = this.getOrCreateTokenBucket(bucketKey, quota);
      const currentTokens = this.calculateCurrentTokens(bucket, now);

      if (currentTokens < cost) {
        const retryAfterMs = Math.ceil((cost - currentTokens) / bucket.refillRatePerSecond) * 1000;
        return {
          allowed: false,
          tenantId,
          resourceType,
          currentUsage: usage?.used ?? 0,
          limit: quota.limit,
          remaining: Math.max(0, currentTokens),
          retryAfterMs,
          quotaId: quota.quotaId,
        };
      }

      // Consume tokens
      this.tokenBuckets.set(bucketKey, {
        ...bucket,
        tokens: currentTokens - cost,
        lastRefillAt: now,
      });
    }

    // Check window limit
    if (usage && usage.used + cost > quota.limit) {
      const windowEnd = usage.windowEnd;
      const retryAfterMs = new Date(windowEnd).getTime() - now;
      return {
        allowed: false,
        tenantId,
        resourceType,
        currentUsage: usage.used,
        limit: quota.limit,
        remaining: Math.max(0, quota.limit - usage.used),
        retryAfterMs: retryAfterMs > 0 ? retryAfterMs : null,
        quotaId: quota.quotaId,
      };
    }

    return {
      allowed: true,
      tenantId,
      resourceType,
      currentUsage: usage?.used ?? 0,
      limit: quota.limit,
      remaining: quota.limit - (usage?.used ?? 0) - cost,
      retryAfterMs: null,
      quotaId: quota.quotaId,
    };
  }

  /**
   * Record resource usage
   */
  public recordUsage(
    tenantId: string,
    resourceType: ResourceType,
    cost: number = 1,
  ): ResourceUsage {
    const quota = this.findQuota(tenantId, resourceType);
    const now = Date.now();
    const windowStart = now - (quota?.windowSeconds ?? 60) * 1000;
    const windowEnd = now + (quota?.windowSeconds ?? 60) * 1000;

    const key = `${tenantId}:${resourceType}`;
    const existing = this.usageRecords.get(key);

    let used = cost;
    let record: UsageRecord;

    if (existing && new Date(existing.windowStart).getTime() > windowStart) {
      // Within same window, accumulate
      used = existing.used + cost;
      record = {
        ...existing,
        used,
      };
    } else {
      // New window - @ts-ignore: type mismatch between number windowStart/End and string in record
      record = {
        tenantId,
        resourceType,
        used,
        quotaId: quota?.quotaId ?? "",
        windowStart: new Date(windowStart).toISOString(),
        windowEnd: new Date(windowEnd).toISOString(),
      };
    }

    this.usageRecords.set(key, record);

    return {
      usageId: newId("usage"),
      tenantId,
      resourceType,
      used: record.used,
      limit: quota?.limit ?? Infinity,
      windowSeconds: quota?.windowSeconds ?? 0,
      windowStart: record.windowStart as string,
      windowEnd: record.windowEnd as string,
      percentUsed: quota ? (record.used / quota.limit) * 100 : 0,
    };
  }

  /**
   * Get current usage for a tenant and resource type
   */
  public getCurrentUsage(
    tenantId: string,
    resourceType: ResourceType,
  ): ResourceUsage | null {
    const key = `${tenantId}:${resourceType}`;
    const record = this.usageRecords.get(key);
    const quota = this.findQuota(tenantId, resourceType);

    if (!record) {
      return null;
    }

    return {
      usageId: newId("usage"),
      tenantId,
      resourceType,
      used: record.used,
      limit: quota?.limit ?? Infinity,
      windowSeconds: quota?.windowSeconds ?? 0,
      windowStart: record.windowStart as string,
      windowEnd: record.windowEnd as string,
      percentUsed: quota ? (record.used / quota.limit) * 100 : 0,
    };
  }

  /**
   * Get all quotas for a tenant
   */
  public getTenantQuotas(tenantId: string): readonly TenantQuota[] {
    return [...this.quotas.values()].filter((q) => q.tenantId === tenantId);
  }

  /**
   * Get usage for all resources of a tenant
   */
  public getTenantUsage(tenantId: string): readonly ResourceUsage[] {
    const resources: ResourceType[] = [
      "cpu",
      "memory",
      "storage",
      "network_bandwidth",
      "api_requests",
      "task_executions",
      "concurrent_connections",
    ];

    const usages: ResourceUsage[] = [];
    for (const resourceType of resources) {
      const usage = this.getCurrentUsage(tenantId, resourceType);
      if (usage) {
        usages.push(usage);
      }
    }
    return usages;
  }

  /**
   * Check if a tenant is exceeding any quotas
   */
  public isExceedingQuotas(tenantId: string): boolean {
    const quotas = this.getTenantQuotas(tenantId);
    for (const quota of quotas) {
      const usage = this.getCurrentUsage(tenantId, quota.resourceType);
      if (usage && usage.used > quota.limit) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get quota utilization for a tenant
   */
  public getQuotaUtilization(
    tenantId: string,
  ): { resourceType: ResourceType; percentUsed: number; isNearLimit: boolean }[] {
    const quotas = this.getTenantQuotas(tenantId);
    const utilization: { resourceType: ResourceType; percentUsed: number; isNearLimit: boolean }[] = [];

    for (const quota of quotas) {
      const usage = this.getCurrentUsage(tenantId, quota.resourceType);
      const percentUsed = usage ? (usage.used / quota.limit) * 100 : 0;
      utilization.push({
        resourceType: quota.resourceType,
        percentUsed,
        isNearLimit: percentUsed >= 80,
      });
    }

    return utilization;
  }

  /**
   * Reset usage for a tenant (e.g., on billing cycle)
   */
  public resetUsage(tenantId: string, resourceType?: ResourceType): void {
    if (resourceType) {
      const key = `${tenantId}:${resourceType}`;
      this.usageRecords.delete(key);
    } else {
      // Reset all resources for tenant
      for (const key of this.usageRecords.keys()) {
        if (key.startsWith(`${tenantId}:`)) {
          this.usageRecords.delete(key);
        }
      }
    }
  }

  /**
   * Find quota for tenant and resource type
   */
  private findQuota(tenantId: string, resourceType: ResourceType): TenantQuota | null {
    const quotas = [...this.quotas.values()].filter(
      (q) => q.tenantId === tenantId && q.resourceType === resourceType,
    );

    if (quotas.length === 0) {
      return null;
    }

    // Return highest priority quota
    return quotas.reduce((highest, q) =>
      (q.priority ?? 0) > (highest?.priority ?? 0) ? q : highest,
    );
  }

  /**
   * Get or create token bucket for burst handling
   */
  private getOrCreateTokenBucket(key: string, quota: TenantQuota): TokenBucket {
    const existing = this.tokenBuckets.get(key);
    if (existing) {
      return existing;
    }

    const bucket: TokenBucket = {
      tokens: quota.burstLimit ?? quota.limit,
      lastRefillAt: Date.now(),
      maxTokens: quota.burstLimit ?? quota.limit,
      refillRatePerSecond: (quota.burstLimit ?? quota.limit) / (quota.windowSeconds ?? 60),
    };

    this.tokenBuckets.set(key, bucket);
    return bucket;
  }

  /**
   * Calculate current tokens after refill
   */
  private calculateCurrentTokens(bucket: TokenBucket, now: number): number {
    const elapsed = (now - bucket.lastRefillAt) / 1000;
    const refilled = elapsed * bucket.refillRatePerSecond;
    return Math.min(bucket.maxTokens, bucket.tokens + refilled);
  }
}

/**
 * Singleton instance
 */
let GLOBAL_NOISY_NEIGHBOR_SERVICE: NoisyNeighborProtectionService | null = null;

export function getNoisyNeighborProtectionService(): NoisyNeighborProtectionService {
  if (!GLOBAL_NOISY_NEIGHBOR_SERVICE) {
    GLOBAL_NOISY_NEIGHBOR_SERVICE = new NoisyNeighborProtectionService();
  }
  return GLOBAL_NOISY_NEIGHBOR_SERVICE;
}

export function resetNoisyNeighborProtectionService(): void {
  GLOBAL_NOISY_NEIGHBOR_SERVICE = null;
}
