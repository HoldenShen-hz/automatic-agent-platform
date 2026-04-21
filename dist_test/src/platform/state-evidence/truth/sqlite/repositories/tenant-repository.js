/**
 * Tenant Repository
 *
 * Data access layer for multi-tenancy tables.
 * Part of §26 storage layer implementation.
 */
import { newId, nowIso } from "../../../../contracts/types/ids.js";
/**
 * In-memory implementation of TenantRepository for development.
 * Production would use SQLite or PostgreSQL.
 */
export class InMemoryTenantRepository {
    tenants = new Map();
    async create(input) {
        const tenantId = input.tenantId ?? newId("tenant");
        const now = nowIso();
        const quotas = toTenantQuotas(input.quotas);
        const tenant = {
            tenantId,
            organizationId: input.organizationId ?? `org_${tenantId}`,
            displayName: input.displayName,
            storageScope: input.storageScope ?? `${tenantId}:storage`,
            identityScope: input.identityScope ?? `${tenantId}:identity`,
            policyScope: input.policyScope ?? `${tenantId}:policy`,
            artifactScope: input.artifactScope ?? `${tenantId}:artifact`,
            isolationMode: input.isolationMode ?? "shared_logical",
            deploymentMode: input.deploymentMode ?? "cloud_shared",
            status: input.status ?? "active",
            ...(input.billingPlan ? { billingPlan: input.billingPlan } : {}),
            ...(input.slaLevel ? { slaLevel: input.slaLevel } : {}),
            ...(input.allowedRegions ? { allowedRegions: input.allowedRegions } : {}),
            ...(quotas ? { quotas } : {}),
            createdAt: now,
            updatedAt: now,
        };
        this.tenants.set(tenantId, tenant);
        return tenant;
    }
    async findById(tenantId) {
        return this.tenants.get(tenantId) ?? null;
    }
    async findByStatus(status) {
        return [...this.tenants.values()].filter((t) => t.status === status);
    }
    async update(tenantId, input) {
        const existing = this.tenants.get(tenantId);
        if (!existing) {
            throw new Error(`Tenant ${tenantId} not found`);
        }
        const quotas = toTenantQuotas(input.quotas) ?? existing.quotas;
        const billingPlan = input.billingPlan ?? existing.billingPlan;
        const slaLevel = input.slaLevel ?? existing.slaLevel;
        const allowedRegions = input.allowedRegions ?? existing.allowedRegions;
        const status = input.status ?? existing.status;
        const record = {
            tenantId: existing.tenantId,
            organizationId: input.organizationId ?? existing.organizationId,
            storageScope: input.storageScope ?? existing.storageScope,
            identityScope: input.identityScope ?? existing.identityScope,
            policyScope: input.policyScope ?? existing.policyScope,
            artifactScope: input.artifactScope ?? existing.artifactScope,
            isolationMode: input.isolationMode ?? existing.isolationMode,
            deploymentMode: input.deploymentMode ?? existing.deploymentMode,
            createdAt: existing.createdAt,
            updatedAt: nowIso(),
        };
        if (quotas)
            record.quotas = quotas;
        if (billingPlan)
            record.billingPlan = billingPlan;
        if (slaLevel)
            record.slaLevel = slaLevel;
        if (allowedRegions)
            record.allowedRegions = allowedRegions;
        if (status !== undefined)
            record.status = status;
        if (input.displayName !== undefined) {
            record.displayName = input.displayName;
        }
        this.tenants.set(tenantId, record);
        return record;
    }
    async delete(tenantId) {
        this.tenants.delete(tenantId);
    }
    async listAll(limit, offset) {
        return [...this.tenants.values()].slice(offset, offset + limit);
    }
}
/**
 * In-memory implementation of QuotaRepository.
 */
export class InMemoryQuotaRepository {
    quotas = new Map();
    async create(input) {
        const quotaId = newId("tenant_quota");
        const now = nowIso();
        const quota = {
            quotaId,
            tenantId: input.tenantId,
            resourceType: input.resourceType,
            monthlyLimit: input.monthlyLimit,
            currentUsage: 0,
            alertThreshold: input.alertThreshold ?? 0.8,
            resetAt: input.resetAt,
            createdAt: now,
            updatedAt: now,
        };
        this.quotas.set(`${input.tenantId}:${input.resourceType}`, quota);
        return quota;
    }
    async findByTenantId(tenantId) {
        return [...this.quotas.values()].filter((q) => q.tenantId === tenantId);
    }
    async updateUsage(tenantId, resourceType, usage) {
        const key = `${tenantId}:${resourceType}`;
        const existing = this.quotas.get(key);
        if (existing) {
            existing.currentUsage = usage;
            existing.updatedAt = nowIso();
        }
    }
    async deleteByTenantId(tenantId) {
        for (const key of this.quotas.keys()) {
            if (key.startsWith(`${tenantId}:`)) {
                this.quotas.delete(key);
            }
        }
    }
}
/**
 * In-memory implementation of BillingRepository.
 */
export class InMemoryBillingRepository {
    billings = new Map();
    async create(input) {
        const billingId = newId("tenant_billing");
        const now = nowIso();
        const billing = {
            billingId,
            tenantId: input.tenantId,
            billingPlan: input.billingPlan,
            billingPeriodStart: input.billingPeriodStart,
            billingPeriodEnd: input.billingPeriodEnd,
            totalCostUsd: input.totalCostUsd,
            currency: input.currency ?? "USD",
            status: "pending",
            invoiceUrl: null,
            paidAt: null,
            createdAt: now,
            updatedAt: now,
        };
        this.billings.set(billingId, billing);
        return billing;
    }
    async findByTenantId(tenantId, limit = 10) {
        return [...this.billings.values()]
            .filter((b) => b.tenantId === tenantId)
            .slice(0, limit);
    }
    async findById(billingId) {
        return this.billings.get(billingId) ?? null;
    }
    async updateStatus(billingId, status) {
        const existing = this.billings.get(billingId);
        if (existing) {
            existing.status = status;
            existing.updatedAt = nowIso();
            if (status === "paid") {
                existing.paidAt = nowIso();
            }
        }
    }
}
function toTenantQuotas(inputs) {
    if (!inputs || inputs.length === 0) {
        return undefined;
    }
    const quotas = {};
    for (const input of inputs) {
        switch (input.resourceType) {
            case "tokens":
            case "monthly_tokens":
                quotas.monthlyTokenLimit = input.monthlyLimit;
                break;
            case "cost_usd":
            case "monthly_cost_usd":
                quotas.monthlyCostLimitUsd = input.monthlyLimit;
                break;
            case "concurrent_executions":
                quotas.maxConcurrentExecutions = input.monthlyLimit;
                break;
            case "storage_bytes":
                quotas.maxStorageBytes = input.monthlyLimit;
                break;
            case "rate_limit_per_minute":
                quotas.rateLimitPerMinute = input.monthlyLimit;
                break;
            default:
                break;
        }
    }
    return Object.keys(quotas).length > 0 ? quotas : undefined;
}
//# sourceMappingURL=tenant-repository.js.map