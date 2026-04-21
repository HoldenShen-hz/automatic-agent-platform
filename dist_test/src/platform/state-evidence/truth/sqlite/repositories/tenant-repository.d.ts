/**
 * Tenant Repository
 *
 * Data access layer for multi-tenancy tables.
 * Part of §26 storage layer implementation.
 */
import type { SlaTier, TenantRecord } from "../../../../contracts/types/domain/workspace-types.js";
import type { DeploymentMode, TenantIsolationMode } from "../../../../contracts/types/domain/primitives.js";
type TenantStatus = NonNullable<TenantRecord["status"]>;
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
    status: "pending" | "paid" | "overdue" | "cancelled";
    invoiceUrl: string | null;
    paidAt: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface TenantRepository {
    create(input: CreateTenantInput): Promise<TenantRecord>;
    findById(tenantId: string): Promise<TenantRecord | null>;
    findByStatus(status: TenantStatus): Promise<TenantRecord[]>;
    update(tenantId: string, input: UpdateTenantInput): Promise<TenantRecord>;
    delete(tenantId: string): Promise<void>;
    listAll(limit: number, offset: number): Promise<TenantRecord[]>;
}
export interface CreateTenantInput {
    tenantId?: string;
    organizationId?: string;
    displayName: string;
    status?: TenantStatus;
    storageScope?: string;
    identityScope?: string;
    policyScope?: string;
    artifactScope?: string;
    isolationMode?: TenantIsolationMode;
    deploymentMode?: DeploymentMode;
    billingPlan?: string;
    slaLevel?: SlaTier;
    allowedRegions?: readonly string[];
    quotas?: TenantQuotaInput[];
    metadata?: Record<string, unknown>;
}
export interface UpdateTenantInput {
    displayName?: string;
    status?: TenantStatus;
    organizationId?: string;
    storageScope?: string;
    identityScope?: string;
    policyScope?: string;
    artifactScope?: string;
    isolationMode?: TenantIsolationMode;
    deploymentMode?: DeploymentMode;
    billingPlan?: string;
    slaLevel?: SlaTier;
    allowedRegions?: readonly string[];
    quotas?: TenantQuotaInput[];
    metadata?: Record<string, unknown>;
}
export interface TenantQuotaInput {
    resourceType: string;
    monthlyLimit: number;
    alertThreshold?: number;
}
export interface QuotaRepository {
    create(input: CreateQuotaInput): Promise<TenantQuotaRecord>;
    findByTenantId(tenantId: string): Promise<TenantQuotaRecord[]>;
    updateUsage(tenantId: string, resourceType: string, usage: number): Promise<void>;
    deleteByTenantId(tenantId: string): Promise<void>;
}
export interface CreateQuotaInput {
    tenantId: string;
    resourceType: string;
    monthlyLimit: number;
    alertThreshold?: number;
    resetAt: string;
}
export interface BillingRepository {
    create(input: CreateBillingInput): Promise<TenantBillingRecord>;
    findByTenantId(tenantId: string, limit?: number): Promise<TenantBillingRecord[]>;
    findById(billingId: string): Promise<TenantBillingRecord | null>;
    updateStatus(billingId: string, status: TenantBillingRecord["status"]): Promise<void>;
}
/**
 * In-memory implementation of TenantRepository for development.
 * Production would use SQLite or PostgreSQL.
 */
export declare class InMemoryTenantRepository implements TenantRepository {
    private readonly tenants;
    create(input: CreateTenantInput): Promise<TenantRecord>;
    findById(tenantId: string): Promise<TenantRecord | null>;
    findByStatus(status: TenantStatus): Promise<TenantRecord[]>;
    update(tenantId: string, input: UpdateTenantInput): Promise<TenantRecord>;
    delete(tenantId: string): Promise<void>;
    listAll(limit: number, offset: number): Promise<TenantRecord[]>;
}
/**
 * In-memory implementation of QuotaRepository.
 */
export declare class InMemoryQuotaRepository implements QuotaRepository {
    private readonly quotas;
    create(input: CreateQuotaInput): Promise<TenantQuotaRecord>;
    findByTenantId(tenantId: string): Promise<TenantQuotaRecord[]>;
    updateUsage(tenantId: string, resourceType: string, usage: number): Promise<void>;
    deleteByTenantId(tenantId: string): Promise<void>;
}
/**
 * In-memory implementation of BillingRepository.
 */
export declare class InMemoryBillingRepository implements BillingRepository {
    private readonly billings;
    create(input: CreateBillingInput): Promise<TenantBillingRecord>;
    findByTenantId(tenantId: string, limit?: number): Promise<TenantBillingRecord[]>;
    findById(billingId: string): Promise<TenantBillingRecord | null>;
    updateStatus(billingId: string, status: TenantBillingRecord["status"]): Promise<void>;
}
export interface CreateBillingInput {
    tenantId: string;
    billingPlan: string;
    billingPeriodStart: string;
    billingPeriodEnd: string;
    totalCostUsd: number;
    currency?: string;
}
export {};
