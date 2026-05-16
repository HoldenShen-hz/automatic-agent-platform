/**
 * Tenant Repository
 *
 * Data access layer for multi-tenancy tables.
 * Part of §26 storage layer implementation.
 */

import { newId, nowIso } from "../sqlite-repository-contracts.js";
import type {
  DeploymentMode,
  SlaTier,
  TenantIsolationMode,
  TenantQuotas,
  TenantRecord,
} from "../sqlite-repository-contracts.js";

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
export class InMemoryTenantRepository implements TenantRepository {
  private readonly tenants = new Map<string, TenantRecord>();

  public async create(input: CreateTenantInput): Promise<TenantRecord> {
    const tenantId = input.tenantId ?? newId("tenant");
    const now = nowIso();
    const quotas = toTenantQuotas(input.quotas);

    const tenant: TenantRecord = {
      tenantId,
      organizationId: input.organizationId ?? `org_${tenantId}`,
      displayName: input.displayName,
      storageScope: input.storageScope ?? `${tenantId}:storage`,
      identityScope: input.identityScope ?? `${tenantId}:identity`,
      policyScope: input.policyScope ?? `${tenantId}:policy`,
      artifactScope: input.artifactScope ?? `${tenantId}:artifact`,
      isolationMode: input.isolationMode ?? "shared_logical",
      deploymentMode: input.deploymentMode ?? "cloud_shared",
      quotas: normalizeTenantQuotas(quotas),
      status: input.status ?? "active",
      ...(input.billingPlan ? { billingPlan: input.billingPlan } : {}),
      ...(input.slaLevel ? { slaLevel: input.slaLevel } : {}),
      ...(input.allowedRegions ? { allowedRegions: input.allowedRegions } : {}),
      createdAt: now,
      updatedAt: now,
    };

    this.tenants.set(tenantId, tenant);
    return tenant;
  }

  public async findById(tenantId: string): Promise<TenantRecord | null> {
    return this.tenants.get(tenantId) ?? null;
  }

  public async findByStatus(status: TenantStatus): Promise<TenantRecord[]> {
    return [...this.tenants.values()].filter((t) => t.status === status);
  }

  public async update(tenantId: string, input: UpdateTenantInput): Promise<TenantRecord> {
    const existing = this.tenants.get(tenantId);
    if (!existing) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const quotas = normalizeTenantQuotas(toTenantQuotas(input.quotas) ?? existing.quotas);
    const billingPlan = input.billingPlan ?? existing.billingPlan;
    const slaLevel = input.slaLevel ?? existing.slaLevel;
    const allowedRegions = input.allowedRegions ?? existing.allowedRegions;
    const status = input.status ?? existing.status;

    const record: TenantRecord = {
      tenantId: existing.tenantId,
      organizationId: input.organizationId ?? existing.organizationId,
      storageScope: input.storageScope ?? existing.storageScope,
      identityScope: input.identityScope ?? existing.identityScope,
      policyScope: input.policyScope ?? existing.policyScope,
      artifactScope: input.artifactScope ?? existing.artifactScope,
      isolationMode: input.isolationMode ?? existing.isolationMode,
      deploymentMode: input.deploymentMode ?? existing.deploymentMode,
      quotas,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    };
    if (billingPlan) record.billingPlan = billingPlan;
    if (slaLevel) record.slaLevel = slaLevel;
    if (allowedRegions) record.allowedRegions = allowedRegions;
    if (status !== undefined) record.status = status as "active" | "suspended" | "terminated";

    if (input.displayName !== undefined) {
      record.displayName = input.displayName;
    }

    this.tenants.set(tenantId, record);
    return record;
  }

  public async delete(tenantId: string): Promise<void> {
    this.tenants.delete(tenantId);
  }

  public async listAll(limit: number, offset: number): Promise<TenantRecord[]> {
    return [...this.tenants.values()].slice(offset, offset + limit);
  }
}

/**
 * In-memory implementation of QuotaRepository.
 */
export class InMemoryQuotaRepository implements QuotaRepository {
  private readonly quotas = new Map<string, TenantQuotaRecord>();

  public async create(input: CreateQuotaInput): Promise<TenantQuotaRecord> {
    const quotaId = newId("tenant_quota");
    const now = nowIso();

    const quota: TenantQuotaRecord = {
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

  public async findByTenantId(tenantId: string): Promise<TenantQuotaRecord[]> {
    return [...this.quotas.values()].filter((q) => q.tenantId === tenantId);
  }

  public async updateUsage(tenantId: string, resourceType: string, usage: number): Promise<void> {
    const key = `${tenantId}:${resourceType}`;
    const existing = this.quotas.get(key);
    if (existing) {
      existing.currentUsage = usage;
      existing.updatedAt = nowIso();
    }
  }

  public async deleteByTenantId(tenantId: string): Promise<void> {
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
export class InMemoryBillingRepository implements BillingRepository {
  private readonly billings = new Map<string, TenantBillingRecord>();

  public async create(input: CreateBillingInput): Promise<TenantBillingRecord> {
    const billingId = newId("tenant_billing");
    const now = nowIso();

    const billing: TenantBillingRecord = {
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

  public async findByTenantId(tenantId: string, limit = 10): Promise<TenantBillingRecord[]> {
    return [...this.billings.values()]
      .filter((b) => b.tenantId === tenantId)
      .slice(0, limit);
  }

  public async findById(billingId: string): Promise<TenantBillingRecord | null> {
    return this.billings.get(billingId) ?? null;
  }

  public async updateStatus(billingId: string, status: TenantBillingRecord["status"]): Promise<void> {
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

export interface CreateBillingInput {
  tenantId: string;
  billingPlan: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  totalCostUsd: number;
  currency?: string;
}

function toTenantQuotas(inputs?: readonly TenantQuotaInput[]): TenantQuotas | undefined {
  if (!inputs || inputs.length === 0) {
    return undefined;
  }

  const quotas: TenantQuotas = {};
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

function normalizeTenantQuotas(quotas?: TenantQuotas): TenantQuotas {
  return quotas == null ? {} : { ...quotas };
}
