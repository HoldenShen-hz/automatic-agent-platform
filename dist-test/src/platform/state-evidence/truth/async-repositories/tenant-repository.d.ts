/**
 * AsyncTenantRepository - Async data access for multi-tenancy tables.
 *
 * Implements §26 storage layer - missing tables: tenants, tenant_quotas, tenant_billing
 */
import type { AsyncSqlConnection } from "../async-sql-database.js";
export interface TenantRecord {
    tenantId: string;
    displayName: string;
    status: string;
    billingPlan: string | null;
    slaLevel: string | null;
    allowedRegionsJson: string | null;
    quotasJson: string | null;
    metadataJson: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface TenantQuotaRecord {
    quotaId: string;
    tenantId: string;
    resourceType: string;
    monthlyLimit: number;
    currentUsage: number;
    alertThreshold: number;
    resetAt: string;
    createdAt: string;
    updatedAt: string;
}
export interface TenantBillingRecord {
    billingId: string;
    tenantId: string;
    billingPlan: string;
    billingPeriodStart: string;
    billingPeriodEnd: string;
    totalCostUsd: number;
    currency: string;
    status: string;
    invoiceUrl: string | null;
    paidAt: string | null;
    createdAt: string;
    updatedAt: string;
}
export declare class AsyncTenantRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    insertTenant(tenant: TenantRecord): Promise<void>;
    updateTenant(input: {
        tenantId: string;
        displayName?: string;
        status?: string;
        billingPlan?: string | null;
        slaLevel?: string | null;
        allowedRegionsJson?: string | null;
        quotasJson?: string | null;
        metadataJson?: string | null;
        updatedAt: string;
    }): Promise<number>;
    getTenant(tenantId: string): Promise<TenantRecord | null>;
    listTenantsByStatus(status: string): Promise<TenantRecord[]>;
    deleteTenant(tenantId: string): Promise<number>;
    upsertTenantQuota(quota: TenantQuotaRecord): Promise<void>;
    getTenantQuota(quotaId: string): Promise<TenantQuotaRecord | null>;
    listTenantQuotas(tenantId: string): Promise<TenantQuotaRecord[]>;
    updateQuotaUsage(quotaId: string, currentUsage: number, updatedAt: string): Promise<number>;
    insertTenantBilling(billing: TenantBillingRecord): Promise<void>;
    updateTenantBillingStatus(input: {
        billingId: string;
        status: string;
        totalCostUsd?: number;
        invoiceUrl?: string | null;
        paidAt?: string | null;
        updatedAt: string;
    }): Promise<number>;
    getTenantBilling(billingId: string): Promise<TenantBillingRecord | null>;
    listTenantBillingHistory(tenantId: string, limit?: number): Promise<TenantBillingRecord[]>;
}
