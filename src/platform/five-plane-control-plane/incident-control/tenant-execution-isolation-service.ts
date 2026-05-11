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
import { newId, nowIso } from "../../contracts/types/ids.js";

// ── Types ──────────────────────────────────────────────────────────────

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
  noisyNeighborScore: number; // 0-100, higher = more noisy
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

export interface ExecutionOutcomeSample {
  executionId: string;
  tenantId: string;
  succeeded: boolean;
  occurredAt: string;
  failureCode?: string | null;
}

export interface TenantAutoIsolationDecision {
  tenantId: string;
  triggered: boolean;
  failureRate: number;
  sampleCount: number;
  reasonCode: string;
}

// ── DDL ────────────────────────────────────────────────────────────────

export const TENANT_ISOLATION_DDL = `
CREATE TABLE IF NOT EXISTS tenant_quotas (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  quota_kind TEXT NOT NULL,
  limit_value REAL NOT NULL,
  window_seconds INTEGER NOT NULL DEFAULT 60,
  enforcement_action TEXT NOT NULL DEFAULT 'log_only',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, quota_kind)
);
CREATE INDEX IF NOT EXISTS idx_tenant_quotas_tenant ON tenant_quotas(tenant_id);

CREATE TABLE IF NOT EXISTS quota_usage_samples (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  quota_kind TEXT NOT NULL,
  sample_value REAL NOT NULL,
  window_start TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quota_samples_tenant_kind ON quota_usage_samples(tenant_id, quota_kind, window_start);

CREATE TABLE IF NOT EXISTS execution_resource_usage (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  cpu_ms REAL NOT NULL DEFAULT 0,
  memory_bytes REAL NOT NULL DEFAULT 0,
  network_bytes REAL NOT NULL DEFAULT 0,
  duration_ms REAL NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_resource_usage_tenant ON execution_resource_usage(tenant_id, recorded_at);

CREATE TABLE IF NOT EXISTS execution_outcome_samples (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  succeeded INTEGER NOT NULL,
  failure_code TEXT NULL,
  occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_execution_outcome_samples_tenant ON execution_outcome_samples(tenant_id, occurred_at);

CREATE TABLE IF NOT EXISTS noisy_neighbor_signals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low',
  detected_at TEXT NOT NULL,
  resolved_at TEXT NULL,
  metadata TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_noisy_signals_tenant ON noisy_neighbor_signals(tenant_id, detected_at);
`;

type RawRow = Record<string, unknown>;

// ── Service ────────────────────────────────────────────────────────────

export interface TenantExecutionIsolationOptions {
  noisyNeighborThreshold?: number; // Score 0-100
  quotaWarningPercent?: number;
  quotaCriticalPercent?: number;
  failureRateThreshold?: number;
  minSampleSize?: number;
  failureWindowSeconds?: number;
}

/**
 * TenantExecutionIsolationService manages per-tenant resource quotas and
 * detects noisy neighbor scenarios. It tracks quota usage over configurable
 * time windows and can enforce quota limits via configurable actions.
 */
export class TenantExecutionIsolationService {
  private readonly noisyNeighborThreshold: number;
  private readonly quotaWarningPercent: number;
  private readonly quotaCriticalPercent: number;
  private readonly failureRateThreshold: number;
  private readonly minSampleSize: number;
  private readonly failureWindowSeconds: number;

  constructor(
    private readonly db: AuthoritativeSqlDatabase,
    options?: TenantExecutionIsolationOptions,
  ) {
    this.noisyNeighborThreshold = options?.noisyNeighborThreshold ?? 80;
    this.quotaWarningPercent = options?.quotaWarningPercent ?? 70;
    this.quotaCriticalPercent = options?.quotaCriticalPercent ?? 90;
    this.failureRateThreshold = options?.failureRateThreshold ?? 0.30;
    this.minSampleSize = options?.minSampleSize ?? 20;
    this.failureWindowSeconds = options?.failureWindowSeconds ?? 300;
  }

  // ── Quota Management ────────────────────────────────────────────────

  /**
   * Defines or updates a quota for a tenant. Uses INSERT OR REPLACE to
   * support both creation and update operations.
   */
  defineQuota(input: Omit<TenantQuota, "id" | "createdAt" | "updatedAt">): TenantQuota {
    const now = nowIso();
    const quota: TenantQuota = {
      id: newId("tquota"),
      createdAt: now,
      updatedAt: now,
      ...input,
    };

    this.db.connection
      .prepare(
        `INSERT OR REPLACE INTO tenant_quotas (id, tenant_id, quota_kind, limit_value, window_seconds, enforcement_action, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(quota.id, quota.tenantId, quota.quotaKind, quota.limitValue, quota.windowSeconds, quota.enforcementAction, quota.enabled ? 1 : 0, quota.createdAt, quota.updatedAt);

    return quota;
  }

  /**
   * Retrieves a specific quota for a tenant.
   */
  getQuota(tenantId: string, quotaKind: QuotaKind): TenantQuota | null {
    try {
      const row = this.db.connection
        .prepare(`SELECT * FROM tenant_quotas WHERE tenant_id = ? AND quota_kind = ?`)
        .get(tenantId, quotaKind) as RawRow | undefined;
      return row ? this.mapQuota(row) : null;
    } catch {
      return null;
    }
  }

  /**
   * Lists all quotas, optionally filtered by tenant.
   */
  listQuotas(tenantId?: string): TenantQuota[] {
    try {
      if (tenantId) {
        return (this.db.connection
          .prepare(`SELECT * FROM tenant_quotas WHERE tenant_id = ? ORDER BY quota_kind`)
          .all(tenantId) as RawRow[]).map((r) => this.mapQuota(r));
      }
      return (this.db.connection
        .prepare(`SELECT * FROM tenant_quotas ORDER BY tenant_id, quota_kind`)
        .all() as RawRow[]).map((r) => this.mapQuota(r));
    } catch {
      return [];
    }
  }

  /**
   * Deletes a specific quota for a tenant.
   * @returns true if a quota was actually deleted
   */
  deleteQuota(tenantId: string, quotaKind: QuotaKind): boolean {
    this.db.connection
      .prepare(`DELETE FROM tenant_quotas WHERE tenant_id = ? AND quota_kind = ?`)
      .run(tenantId, quotaKind);
    const row = this.db.connection.prepare(`SELECT changes() as cnt`).get() as RawRow | undefined;
    return Number(row?.cnt ?? 0) > 0;
  }

  // ── Usage Recording ────────────────────────────────────────────────

  /**
   * Records resource usage for an execution. This updates the usage samples
   * used for quota calculations.
   */
  recordResourceUsage(usage: ExecutionResourceUsage): void {
    this.db.connection
      .prepare(
        `INSERT OR REPLACE INTO execution_resource_usage (id, execution_id, tenant_id, cpu_ms, memory_bytes, network_bytes, duration_ms, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId("rusage"), usage.executionId, usage.tenantId, usage.cpuMs, usage.memoryBytes, usage.networkBytes, usage.durationMs, usage.recordedAt);

    // Update quota usage samples using the quota's windowSeconds
    const quota = this.getQuota(usage.tenantId, "total_compute_minutes");
    if (quota) {
      this.recordQuotaSample(
        usage.tenantId,
        "total_compute_minutes",
        usage.durationMs / 1000 / 60,
        quota.windowSeconds,
        usage.recordedAt,
      );
    }
  }

  recordExecutionOutcome(sample: ExecutionOutcomeSample): void {
    this.db.connection
      .prepare(
        `INSERT INTO execution_outcome_samples (id, execution_id, tenant_id, succeeded, failure_code, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId("outcome"),
        sample.executionId,
        sample.tenantId,
        sample.succeeded ? 1 : 0,
        sample.failureCode ?? null,
        sample.occurredAt,
      );
  }

  /**
   * Records a single quota usage sample for rate-based quota tracking.
   */
  private recordQuotaSample(
    tenantId: string,
    quotaKind: QuotaKind,
    value: number,
    windowSeconds: number = 60,
    recordedAt: string = nowIso(),
  ): void {
    const recordedAtMs = new Date(recordedAt).getTime();
    const safeRecordedAtMs = Number.isFinite(recordedAtMs) ? recordedAtMs : Date.now();
    const effectiveRecordedAt = Number.isFinite(recordedAtMs) ? recordedAt : new Date(safeRecordedAtMs).toISOString();
    const windowStart = new Date(safeRecordedAtMs - windowSeconds * 1000).toISOString();

    this.db.connection
      .prepare(
        `INSERT INTO quota_usage_samples (id, tenant_id, quota_kind, sample_value, window_start, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(newId("qsample"), tenantId, quotaKind, value, windowStart, effectiveRecordedAt);
  }

  // ── Usage Query ─────────────────────────────────────────────────────

  /**
   * Calculates current quota usage for a tenant within the quota's time window.
   * Sums all samples within the window and computes percentage used.
   */
  getQuotaUsage(tenantId: string, quotaKind: QuotaKind): QuotaUsage | null {
    const quota = this.getQuota(tenantId, quotaKind);
    if (!quota) return null;

    const windowStart = new Date(Date.now() - quota.windowSeconds * 1000).toISOString();
    const samples = this.db.connection
      .prepare(`SELECT SUM(sample_value) as total FROM quota_usage_samples WHERE tenant_id = ? AND quota_kind = ? AND recorded_at >= ?`)
      .get(tenantId, quotaKind, windowStart) as RawRow | undefined;

    const currentValue = Number(samples?.total ?? 0);
    const percentUsed = quota.limitValue > 0 ? (currentValue / quota.limitValue) * 100 : 0;
    const resetAt = new Date(Date.now() + quota.windowSeconds * 1000).toISOString();

    let status: QuotaUsage["status"];
    if (percentUsed >= 100) status = "exceeded";
    else if (percentUsed >= this.quotaCriticalPercent) status = "critical";
    else if (percentUsed >= this.quotaWarningPercent) status = "warning";
    else status = "ok";

    return {
      tenantId,
      quotaKind,
      currentValue,
      limitValue: quota.limitValue,
      windowSeconds: quota.windowSeconds,
      percentUsed: Math.round(percentUsed * 100) / 100,
      remaining: Math.max(0, quota.limitValue - currentValue),
      resetAt,
      status,
    };
  }

  /**
   * Counts the number of active executions for a tenant (executions recorded
   * within the last 60 seconds).
   */
  getActiveExecutionCount(tenantId: string): number {
    const row = this.db.connection
      .prepare(`SELECT COUNT(DISTINCT execution_id) as cnt FROM execution_resource_usage WHERE tenant_id = ? AND recorded_at >= ?`)
      .get(tenantId, new Date(Date.now() - 60_000).toISOString()) as RawRow | undefined;
    return Number(row?.cnt ?? 0);
  }

  // ── Isolation Status ────────────────────────────────────────────────

  /**
   * Returns comprehensive isolation status for a tenant, including all
   * quota usages, active execution count, and noisy neighbor score.
   */
  getIsolationStatus(tenantId: string): TenantIsolationStatus {
    const quotas = this.listQuotas(tenantId);
    const quotaUsages: QuotaUsage[] = [];
    let overallStatus: IsolationStatus = "active";
    let noisyNeighborScore = 0;

    for (const quota of quotas) {
      if (!quota.enabled) continue;
      const usage = this.getQuotaUsage(tenantId, quota.quotaKind);
      if (usage) {
        quotaUsages.push(usage);
        if (usage.status === "exceeded") overallStatus = "quota_exceeded";
        else if (overallStatus !== "quota_exceeded" && usage.status === "critical") overallStatus = "active";
      }
    }

    const autoIsolationDecision = this.evaluateAutomaticIsolationTrigger(tenantId);
    if (autoIsolationDecision.triggered) {
      overallStatus = "noisy_neighbor_detected";
    }

    // Check noisy neighbor signals from the last 5 minutes
    const signals = this.db.connection
      .prepare(`SELECT severity, COUNT(*) as cnt FROM noisy_neighbor_signals WHERE tenant_id = ? AND resolved_at IS NULL AND detected_at >= ? GROUP BY severity`)
      .all(tenantId, new Date(Date.now() - 300_000).toISOString()) as RawRow[];

    for (const signal of signals) {
      const severity = String(signal.severity);
      const cnt = Number(signal.cnt);
      if (severity === "critical") noisyNeighborScore += cnt * 30;
      else if (severity === "high") noisyNeighborScore += cnt * 20;
      else if (severity === "medium") noisyNeighborScore += cnt * 10;
      else noisyNeighborScore += cnt * 5;
    }

    if (noisyNeighborScore >= this.noisyNeighborThreshold) {
      overallStatus = "noisy_neighbor_detected";
    }

    return {
      tenantId,
      overallStatus,
      quotas: quotaUsages,
      activeExecutions: this.getActiveExecutionCount(tenantId),
      noisyNeighborScore: Math.min(100, noisyNeighborScore),
      blockedSince: overallStatus === "quota_exceeded" || overallStatus === "noisy_neighbor_detected" ? nowIso() : null,
      lastCheckedAt: nowIso(),
    };
  }

  // ── Quota Check ────────────────────────────────────────────────────

  /**
   * Checks if a quota increment would be allowed. Used for quota enforcement
   * at request time.
   *
   * @returns Object containing whether the increment is allowed, current usage,
   *          and the enforcement action to take if not allowed
   */
  checkQuota(tenantId: string, quotaKind: QuotaKind, incrementBy: number = 1): {
    allowed: boolean;
    currentUsage: QuotaUsage | null;
    enforcementAction: EnforcementAction | null;
  } {
    const quota = this.getQuota(tenantId, quotaKind);
    if (!quota || !quota.enabled) {
      return { allowed: true, currentUsage: null, enforcementAction: null };
    }

    const usage = this.getQuotaUsage(tenantId, quotaKind);
    if (!usage) {
      return { allowed: true, currentUsage: null, enforcementAction: quota.enforcementAction };
    }

    const wouldExceed = usage.currentValue + incrementBy > usage.limitValue;

    if (wouldExceed) {
      return {
        allowed: quota.enforcementAction === "log_only",
        currentUsage: usage,
        enforcementAction: quota.enforcementAction,
      };
    }

    return { allowed: true, currentUsage: usage, enforcementAction: quota.enforcementAction };
  }

  // ── Noisy Neighbor Detection ───────────────────────────────────────

  /**
   * Records a noisy neighbor signal when a tenant's behavior indicates
   * potential impact on other tenants (e.g., excessive resource consumption,
   * repeated failures, etc.).
   */
  recordNoisyNeighborSignal(tenantId: string, signalType: string, severity: "low" | "medium" | "high" | "critical", metadata?: Record<string, unknown>): void {
    this.db.connection
      .prepare(
        `INSERT INTO noisy_neighbor_signals (id, tenant_id, signal_type, severity, detected_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(newId("nnsig"), tenantId, signalType, severity, nowIso(), metadata ? JSON.stringify(metadata) : null);
  }

  /**
   * Marks a noisy neighbor signal as resolved.
   * @returns true if a signal was actually resolved
   */
  resolveNoisyNeighborSignal(signalId: string): boolean {
    this.db.connection
      .prepare(`UPDATE noisy_neighbor_signals SET resolved_at = ? WHERE id = ? AND resolved_at IS NULL`)
      .run(nowIso(), signalId);
    const row = this.db.connection.prepare(`SELECT changes() as cnt`).get() as RawRow | undefined;
    return Number(row?.cnt ?? 0) > 0;
  }

  /**
   * Lists all active (unresolved) noisy neighbor signals, optionally filtered
   * by tenant. Only returns signals from the last 5 minutes.
   */
  listActiveNoisyNeighborSignals(tenantId?: string): Array<RawRow & { id: string; tenant_id: string; signal_type: string; severity: string; metadata: string | null }> {
    const cutoff = new Date(Date.now() - 300_000).toISOString();
    if (tenantId) {
      return (this.db.connection
        .prepare(`SELECT * FROM noisy_neighbor_signals WHERE tenant_id = ? AND resolved_at IS NULL AND detected_at >= ? ORDER BY detected_at DESC`)
        .all(tenantId, cutoff) as Array<RawRow & { id: string; tenant_id: string; signal_type: string; severity: string; metadata: string | null }>);
    }
    return (this.db.connection
      .prepare(`SELECT * FROM noisy_neighbor_signals WHERE resolved_at IS NULL AND detected_at >= ? ORDER BY detected_at DESC`)
      .all(cutoff) as Array<RawRow & { id: string; tenant_id: string; signal_type: string; severity: string; metadata: string | null }>);
  }

  evaluateAutomaticIsolationTrigger(tenantId: string): TenantAutoIsolationDecision {
    const cutoff = new Date(Date.now() - this.failureWindowSeconds * 1000).toISOString();
    const row = this.db.connection
      .prepare(
        `SELECT COUNT(*) as sample_count, SUM(CASE WHEN succeeded = 0 THEN 1 ELSE 0 END) as failure_count
         FROM execution_outcome_samples
         WHERE tenant_id = ? AND occurred_at >= ?`,
      )
      .get(tenantId, cutoff) as RawRow | undefined;

    const sampleCount = Number(row?.sample_count ?? 0);
    const failureCount = Number(row?.failure_count ?? 0);
    const failureRate = sampleCount === 0 ? 0 : failureCount / sampleCount;
    const triggered = sampleCount >= this.minSampleSize && failureRate > this.failureRateThreshold;

    if (triggered && !this.hasActiveIsolationSignal(tenantId, cutoff)) {
      this.recordNoisyNeighborSignal(
        tenantId,
        "automatic_isolation_trigger",
        "critical",
        {
          failureRate,
          sampleCount,
          threshold: this.failureRateThreshold,
          minSampleSize: this.minSampleSize,
        },
      );
    }

    return {
      tenantId,
      triggered,
      failureRate: Math.round(failureRate * 10_000) / 10_000,
      sampleCount,
      reasonCode: triggered
        ? "tenant_isolation.auto_triggered_failure_rate"
        : "tenant_isolation.within_failure_threshold",
    };
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  /**
   * Removes old quota usage samples to prevent unbounded storage growth.
   * @param olderThanSeconds - Delete samples older than this (default: 24 hours)
   * @returns Number of samples deleted
   */
  purgeOldSamples(olderThanSeconds: number = 86400): number {
    const cutoff = new Date(Date.now() - olderThanSeconds * 1000).toISOString();
    this.db.connection
      .prepare(`DELETE FROM quota_usage_samples WHERE recorded_at < ?`)
      .run(cutoff);
    const row = this.db.connection.prepare(`SELECT changes() as cnt`).get() as RawRow | undefined;
    return Number(row?.cnt ?? 0);
  }

  /**
   * Removes resolved noisy neighbor signals older than the specified threshold.
   * @param olderThanSeconds - Delete resolved signals older than this (default: 24 hours)
   * @returns Number of signals deleted
   */
  purgeResolvedSignals(olderThanSeconds: number = 86400): number {
    const cutoff = new Date(Date.now() - olderThanSeconds * 1000).toISOString();
    this.db.connection
      .prepare(`DELETE FROM noisy_neighbor_signals WHERE resolved_at IS NOT NULL AND resolved_at < ?`)
      .run(cutoff);
    const row = this.db.connection.prepare(`SELECT changes() as cnt`).get() as RawRow | undefined;
    return Number(row?.cnt ?? 0);
  }

  // ── Mappers ─────────────────────────────────────────────────────────

  /**
   * Maps a database row to a TenantQuota object, converting snake_case
   * column names to camelCase property names.
   */
  private mapQuota(row: RawRow): TenantQuota {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id ?? ""),
      quotaKind: String(row.quota_kind ?? "executions_per_minute") as QuotaKind,
      limitValue: Number(row.limit_value ?? 0),
      windowSeconds: Number(row.window_seconds ?? 60),
      enforcementAction: String(row.enforcement_action ?? "log_only") as EnforcementAction,
      enabled: Boolean(row.enabled),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
    };
  }

  private hasActiveIsolationSignal(tenantId: string, cutoff: string): boolean {
    const row = this.db.connection
      .prepare(
        `SELECT COUNT(*) as cnt
         FROM noisy_neighbor_signals
         WHERE tenant_id = ? AND signal_type = 'automatic_isolation_trigger' AND resolved_at IS NULL AND detected_at >= ?`,
      )
      .get(tenantId, cutoff) as RawRow | undefined;
    return Number(row?.cnt ?? 0) > 0;
  }
}
