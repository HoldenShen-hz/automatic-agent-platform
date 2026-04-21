/**
 * @fileoverview Tenant Execution Isolation Service
 *
 * Provides:
 * - Per-tenant resource quota tracking and enforcement
 * - Noisy neighbor detection and protection
 * - Execution plane tenant isolation
 *
 * @see docs_zh/contracts/multi_tenant_isolation_contract.md
 */
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
export type QuotaKind = "executions_per_minute" | "concurrent_executions" | "total_compute_minutes" | "storage_bytes";
export type EnforcementAction = "reject" | "throttle" | "log_only";
export type IsolationStatus = "active" | "quota_exceeded" | "noisy_neighbor_detected" | "disabled";
export interface TenantQuota {
    id: string;
    tenantId: string;
    quotaKind: QuotaKind;
    limitValue: number;
    windowSeconds: number;
    enforcementAction: EnforcementAction;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface QuotaUsage {
    tenantId: string;
    quotaKind: QuotaKind;
    currentValue: number;
    limitValue: number;
    windowSeconds: number;
    percentUsed: number;
    remaining: number;
    resetAt: string;
    status: "ok" | "warning" | "critical" | "exceeded";
}
export interface TenantIsolationStatus {
    tenantId: string;
    overallStatus: IsolationStatus;
    quotas: QuotaUsage[];
    activeExecutions: number;
    noisyNeighborScore: number;
    blockedSince: string | null;
    lastCheckedAt: string;
}
export interface ExecutionResourceUsage {
    executionId: string;
    tenantId: string;
    cpuMs: number;
    memoryBytes: number;
    networkBytes: number;
    durationMs: number;
    recordedAt: string;
}
export declare const TENANT_ISOLATION_DDL = "\nCREATE TABLE IF NOT EXISTS tenant_quotas (\n  id TEXT PRIMARY KEY,\n  tenant_id TEXT NOT NULL,\n  quota_kind TEXT NOT NULL,\n  limit_value REAL NOT NULL,\n  window_seconds INTEGER NOT NULL DEFAULT 60,\n  enforcement_action TEXT NOT NULL DEFAULT 'log_only',\n  enabled INTEGER NOT NULL DEFAULT 1,\n  created_at TEXT NOT NULL,\n  updated_at TEXT NOT NULL,\n  UNIQUE(tenant_id, quota_kind)\n);\nCREATE INDEX IF NOT EXISTS idx_tenant_quotas_tenant ON tenant_quotas(tenant_id);\n\nCREATE TABLE IF NOT EXISTS quota_usage_samples (\n  id TEXT PRIMARY KEY,\n  tenant_id TEXT NOT NULL,\n  quota_kind TEXT NOT NULL,\n  sample_value REAL NOT NULL,\n  window_start TEXT NOT NULL,\n  recorded_at TEXT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_quota_samples_tenant_kind ON quota_usage_samples(tenant_id, quota_kind, window_start);\n\nCREATE TABLE IF NOT EXISTS execution_resource_usage (\n  id TEXT PRIMARY KEY,\n  execution_id TEXT NOT NULL UNIQUE,\n  tenant_id TEXT NOT NULL,\n  cpu_ms REAL NOT NULL DEFAULT 0,\n  memory_bytes REAL NOT NULL DEFAULT 0,\n  network_bytes REAL NOT NULL DEFAULT 0,\n  duration_ms REAL NOT NULL DEFAULT 0,\n  recorded_at TEXT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_resource_usage_tenant ON execution_resource_usage(tenant_id, recorded_at);\n\nCREATE TABLE IF NOT EXISTS noisy_neighbor_signals (\n  id TEXT PRIMARY KEY,\n  tenant_id TEXT NOT NULL,\n  signal_type TEXT NOT NULL,\n  severity TEXT NOT NULL DEFAULT 'low',\n  detected_at TEXT NOT NULL,\n  resolved_at TEXT NULL,\n  metadata TEXT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_noisy_signals_tenant ON noisy_neighbor_signals(tenant_id, detected_at);\n";
type RawRow = Record<string, unknown>;
export interface TenantExecutionIsolationOptions {
    noisyNeighborThreshold?: number;
    quotaWarningPercent?: number;
    quotaCriticalPercent?: number;
}
/**
 * TenantExecutionIsolationService manages per-tenant resource quotas and
 * detects noisy neighbor scenarios. It tracks quota usage over configurable
 * time windows and can enforce quota limits via configurable actions.
 */
export declare class TenantExecutionIsolationService {
    private readonly db;
    private readonly noisyNeighborThreshold;
    private readonly quotaWarningPercent;
    private readonly quotaCriticalPercent;
    constructor(db: AuthoritativeSqlDatabase, options?: TenantExecutionIsolationOptions);
    /**
     * Defines or updates a quota for a tenant. Uses INSERT OR REPLACE to
     * support both creation and update operations.
     */
    defineQuota(input: Omit<TenantQuota, "id" | "createdAt" | "updatedAt">): TenantQuota;
    /**
     * Retrieves a specific quota for a tenant.
     */
    getQuota(tenantId: string, quotaKind: QuotaKind): TenantQuota | null;
    /**
     * Lists all quotas, optionally filtered by tenant.
     */
    listQuotas(tenantId?: string): TenantQuota[];
    /**
     * Deletes a specific quota for a tenant.
     * @returns true if a quota was actually deleted
     */
    deleteQuota(tenantId: string, quotaKind: QuotaKind): boolean;
    /**
     * Records resource usage for an execution. This updates the usage samples
     * used for quota calculations.
     */
    recordResourceUsage(usage: ExecutionResourceUsage): void;
    /**
     * Records a single quota usage sample for rate-based quota tracking.
     */
    private recordQuotaSample;
    /**
     * Calculates current quota usage for a tenant within the quota's time window.
     * Sums all samples within the window and computes percentage used.
     */
    getQuotaUsage(tenantId: string, quotaKind: QuotaKind): QuotaUsage | null;
    /**
     * Counts the number of active executions for a tenant (executions recorded
     * within the last 60 seconds).
     */
    getActiveExecutionCount(tenantId: string): number;
    /**
     * Returns comprehensive isolation status for a tenant, including all
     * quota usages, active execution count, and noisy neighbor score.
     */
    getIsolationStatus(tenantId: string): TenantIsolationStatus;
    /**
     * Checks if a quota increment would be allowed. Used for quota enforcement
     * at request time.
     *
     * @returns Object containing whether the increment is allowed, current usage,
     *          and the enforcement action to take if not allowed
     */
    checkQuota(tenantId: string, quotaKind: QuotaKind, incrementBy?: number): {
        allowed: boolean;
        currentUsage: QuotaUsage | null;
        enforcementAction: EnforcementAction | null;
    };
    /**
     * Records a noisy neighbor signal when a tenant's behavior indicates
     * potential impact on other tenants (e.g., excessive resource consumption,
     * repeated failures, etc.).
     */
    recordNoisyNeighborSignal(tenantId: string, signalType: string, severity: "low" | "medium" | "high" | "critical", metadata?: Record<string, unknown>): void;
    /**
     * Marks a noisy neighbor signal as resolved.
     * @returns true if a signal was actually resolved
     */
    resolveNoisyNeighborSignal(signalId: string): boolean;
    /**
     * Lists all active (unresolved) noisy neighbor signals, optionally filtered
     * by tenant. Only returns signals from the last 5 minutes.
     */
    listActiveNoisyNeighborSignals(tenantId?: string): Array<RawRow & {
        id: string;
        tenant_id: string;
        signal_type: string;
        severity: string;
        metadata: string | null;
    }>;
    /**
     * Removes old quota usage samples to prevent unbounded storage growth.
     * @param olderThanSeconds - Delete samples older than this (default: 24 hours)
     * @returns Number of samples deleted
     */
    purgeOldSamples(olderThanSeconds?: number): number;
    /**
     * Removes resolved noisy neighbor signals older than the specified threshold.
     * @param olderThanSeconds - Delete resolved signals older than this (default: 24 hours)
     * @returns Number of signals deleted
     */
    purgeResolvedSignals(olderThanSeconds?: number): number;
    /**
     * Maps a database row to a TenantQuota object, converting snake_case
     * column names to camelCase property names.
     */
    private mapQuota;
}
export {};
