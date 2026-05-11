/**
 * Rollout Manager
 *
 * Manages staged rollout of proposals through shadow, canary,
 * and partial stages to stable release.
 *
 * Provides persistence via RolloutRepository so rollout state
 * survives process restarts.
 *
 * Supports actual rollback actions via RollbackHandler callback.
 */

import type { ImprovementProposal } from './proposal-engine.js';
import type { RolloutRepository } from './rollout-repository.js';

export type RolloutStage = 'shadow' | 'canary' | 'partial' | 'stable';

export type RolloutStatus = 'running' | 'succeeded' | 'failed' | 'rolled_back' | 'rollback_pending';

export interface RolloutRecord {
  proposalId: string;
  stage: RolloutStage;
  percentage: number;
  startedAt: string;
  completedAt?: string;
  status: RolloutStatus;
  metrics?: RolloutMetrics;
  failureReason?: string;
}

export interface RolloutMetricThresholds {
  successRateFloor: number;     // Minimum acceptable success rate (e.g., 0.85)
  errorRateCeiling: number;    // Maximum acceptable error rate (e.g., 0.15)
  latencyCeilingMs: number;     // Maximum acceptable latency in ms
  costCeilingUsd: number;       // Maximum acceptable cost per execution
  securityViolationCeiling: number;
}

// R13-10: Default thresholds for automatic rollback trigger
export const DEFAULT_ROLLOUT_THRESHOLDS: RolloutMetricThresholds = {
  successRateFloor: 0.85,
  errorRateCeiling: 0.15,
  latencyCeilingMs: 10000,
  costCeilingUsd: 1.00,
  securityViolationCeiling: 0,
};

export interface RolloutMetrics {
  successRate: number;
  errorRate: number;
  latencyMs: number;
  costUsd: number;
  securityViolations?: number;
}

/**
 * Handler for actual rollback actions.
 * Called during rollback() to perform the actual revert operation.
 */
export interface RollbackHandler {
  /**
   * Performs the actual rollback action for a proposal.
   * @param proposalId - The proposal being rolled back
   * @param reason - Reason for the rollback
   * @returns void on success, throws on failure
   */
  (proposalId: string, reason: string): Promise<void>;
}

/**
 * Factory for creating rollback handlers. Allows customization
 * of what "actual rollback" means in different contexts.
 */
export type RollbackHandlerFactory = () => RollbackHandler;

export interface RolloutManager {
  start(proposal: ImprovementProposal, stage: RolloutStage, percentage: number): Promise<RolloutRecord>;
  updateMetrics(proposalId: string, metrics: RolloutMetrics): Promise<void>;
  evaluateAndTriggerRollback(proposalId: string, thresholds?: Partial<RolloutMetricThresholds>): Promise<boolean>;
  complete(proposalId: string): Promise<void>;
  fail(proposalId: string, reason: string): Promise<void>;
  rollback(proposalId: string, reason: string): Promise<void>;
  getRollout(proposalId: string): Promise<RolloutRecord | null>;
  getActiveRollouts(): Promise<RolloutRecord[]>;
}

/**
 * Build the SQL for the rollout_records table.
 * Use this when initializing a new database.
 */
export function getRolloutSchemaSql(): string {
  return `CREATE TABLE IF NOT EXISTS rollout_records (
  proposal_id TEXT PRIMARY KEY,
  stage TEXT NOT NULL,
  percentage INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT NULL,
  status TEXT NOT NULL,
  metrics_json TEXT NULL,
  failure_reason TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_rollout_records_status
  ON rollout_records(status);
CREATE INDEX IF NOT EXISTS idx_rollout_records_started_at
  ON rollout_records(started_at);`;
}

/**
 * Applies the rollout schema to a database.
 */
export function applyRolloutSchema(db: { exec(sql: string): void }): void {
  db.exec(getRolloutSchemaSql());
}

/**
 * Default no-op rollback handler.
 * Override via setRollbackHandlerFactory for custom behavior.
 */
async function defaultRollbackHandler(_proposalId: string, _reason: string): Promise<void> {
  // Default handler performs no action - actual rollback is handled by caller
}

/**
 * Persistent RolloutManager with SQLite-backed storage.
 *
 * - Persists rollout state to survive restarts
 * - Supports actual rollback via configurable RollbackHandler
 */
export class PersistentRolloutManager implements RolloutManager {
  private rollouts = new Map<string, RolloutRecord>();
  private rollbackHandlerFactory: RollbackHandlerFactory = () => defaultRollbackHandler;

  public constructor(private readonly repository: RolloutRepository) {
    // Load existing rollouts from persistent storage on startup
    const persisted = this.repository.listAll();
    for (const record of persisted) {
      this.rollouts.set(record.proposalId, record);
    }
  }

  /**
   * Sets the factory for creating rollback handlers.
   * Must be called before rollback() to enable actual rollback actions.
   */
  setRollbackHandlerFactory(factory: RollbackHandlerFactory): void {
    this.rollbackHandlerFactory = factory;
  }

  async start(
    proposal: ImprovementProposal,
    stage: RolloutStage,
    percentage: number
  ): Promise<RolloutRecord> {
    const record: RolloutRecord = {
      proposalId: proposal.id,
      stage,
      percentage,
      startedAt: new Date().toISOString(),
      status: 'running',
    };

    this.rollouts.set(proposal.id, record);
    this.repository.insert(record);
    return record;
  }

  async updateMetrics(proposalId: string, metrics: RolloutMetrics): Promise<void> {
    const record = this.rollouts.get(proposalId);
    if (record) {
      record.metrics = metrics;
      this.repository.update(record);
    }
  }

  // R13-10: Evaluate metrics against thresholds and trigger rollback if needed
  async evaluateAndTriggerRollback(
    proposalId: string,
    thresholds?: Partial<RolloutMetricThresholds>
  ): Promise<boolean> {
    const record = this.rollouts.get(proposalId);
    if (!record || !record.metrics || record.status !== 'running') {
      return false;
    }

    const effectiveThresholds: RolloutMetricThresholds = {
      successRateFloor: thresholds?.successRateFloor ?? DEFAULT_ROLLOUT_THRESHOLDS.successRateFloor,
      errorRateCeiling: thresholds?.errorRateCeiling ?? DEFAULT_ROLLOUT_THRESHOLDS.errorRateCeiling,
      latencyCeilingMs: thresholds?.latencyCeilingMs ?? DEFAULT_ROLLOUT_THRESHOLDS.latencyCeilingMs,
      costCeilingUsd: thresholds?.costCeilingUsd ?? DEFAULT_ROLLOUT_THRESHOLDS.costCeilingUsd,
      securityViolationCeiling:
        thresholds?.securityViolationCeiling ?? DEFAULT_ROLLOUT_THRESHOLDS.securityViolationCeiling,
    };

    const { successRate, errorRate, latencyMs, costUsd, securityViolations = 0 } = record.metrics;
    const violations: string[] = [];

    if (successRate < effectiveThresholds.successRateFloor) {
      violations.push(`successRate(${successRate}) below floor(${effectiveThresholds.successRateFloor})`);
    }
    if (errorRate > effectiveThresholds.errorRateCeiling) {
      violations.push(`errorRate(${errorRate}) above ceiling(${effectiveThresholds.errorRateCeiling})`);
    }
    if (latencyMs > effectiveThresholds.latencyCeilingMs) {
      violations.push(`latencyMs(${latencyMs}) above ceiling(${effectiveThresholds.latencyCeilingMs})`);
    }
    if (costUsd > effectiveThresholds.costCeilingUsd) {
      violations.push(`costUsd(${costUsd}) above ceiling(${effectiveThresholds.costCeilingUsd})`);
    }
    if (securityViolations > effectiveThresholds.securityViolationCeiling) {
      violations.push(
        `securityViolations(${securityViolations}) above ceiling(${effectiveThresholds.securityViolationCeiling})`,
      );
    }

    if (violations.length > 0) {
      record.status = 'rollback_pending';
      record.failureReason = `Metric threshold violations: ${violations.join("; ")}`;
      this.repository.update(record);
      return true;
    }

    return false;
  }

  async complete(proposalId: string): Promise<void> {
    const record = this.rollouts.get(proposalId);
    if (record) {
      record.status = 'succeeded';
      record.completedAt = new Date().toISOString();
      this.repository.update(record);
    }
  }

  async fail(proposalId: string, reason: string): Promise<void> {
    const record = this.rollouts.get(proposalId);
    if (record) {
      record.status = 'failed';
      record.failureReason = reason;
      record.completedAt = new Date().toISOString();
      this.repository.update(record);
    }
  }

  /**
   * Performs rollback of a rollout.
   *
   * This method:
   * 1. Calls the configured RollbackHandler to perform actual rollback action
   * 2. Updates rollout status to 'rolled_back'
   * 3. Persists the updated state
   *
   * If no RollbackHandler is configured, only state is updated (legacy behavior).
   */
  async rollback(proposalId: string, reason: string): Promise<void> {
    const record = this.rollouts.get(proposalId);
    if (!record) return;

    // Perform actual rollback action via handler
    const handler = this.rollbackHandlerFactory();
    await handler(proposalId, reason);

    // Update state after successful rollback action
    record.status = 'rolled_back';
    record.failureReason = reason;
    record.completedAt = new Date().toISOString();
    this.repository.update(record);
  }

  async getRollout(proposalId: string): Promise<RolloutRecord | null> {
    return this.rollouts.get(proposalId) ?? null;
  }

  async getActiveRollouts(): Promise<RolloutRecord[]> {
    return Array.from(this.rollouts.values()).filter((r) => r.status === 'running');
  }

  getDefaultStageSequence(): RolloutStage[] {
    return ['shadow', 'canary', 'partial', 'stable'];
  }

  getStagePercentage(stage: RolloutStage): number {
    switch (stage) {
      case 'shadow': return 0;      // 0% - observe only
      case 'canary': return 5;      // 5% of traffic
      case 'partial': return 25;    // 25% of traffic
      case 'stable': return 100;    // 100% - full rollout
    }
  }
}

/**
 * Simple in-memory rollout manager (preserved for backward compatibility).
 * Does NOT persist - use PersistentRolloutManager for production.
 */
export class SimpleRolloutManager implements RolloutManager {
  private rollouts = new Map<string, RolloutRecord>();

  async start(
    proposal: ImprovementProposal,
    stage: RolloutStage,
    percentage: number
  ): Promise<RolloutRecord> {
    const record: RolloutRecord = {
      proposalId: proposal.id,
      stage,
      percentage,
      startedAt: new Date().toISOString(),
      status: 'running',
    };

    this.rollouts.set(proposal.id, record);
    return record;
  }

  async updateMetrics(proposalId: string, metrics: RolloutMetrics): Promise<void> {
    const record = this.rollouts.get(proposalId);
    if (record) {
      record.metrics = metrics;
    }
  }

  // R13-10: Evaluate metrics against thresholds and trigger rollback if needed
  async evaluateAndTriggerRollback(
    proposalId: string,
    thresholds?: Partial<RolloutMetricThresholds>
  ): Promise<boolean> {
    const record = this.rollouts.get(proposalId);
    if (!record || !record.metrics || record.status !== 'running') {
      return false;
    }

    const effectiveThresholds: RolloutMetricThresholds = {
      successRateFloor: thresholds?.successRateFloor ?? DEFAULT_ROLLOUT_THRESHOLDS.successRateFloor,
      errorRateCeiling: thresholds?.errorRateCeiling ?? DEFAULT_ROLLOUT_THRESHOLDS.errorRateCeiling,
      latencyCeilingMs: thresholds?.latencyCeilingMs ?? DEFAULT_ROLLOUT_THRESHOLDS.latencyCeilingMs,
      costCeilingUsd: thresholds?.costCeilingUsd ?? DEFAULT_ROLLOUT_THRESHOLDS.costCeilingUsd,
      securityViolationCeiling:
        thresholds?.securityViolationCeiling ?? DEFAULT_ROLLOUT_THRESHOLDS.securityViolationCeiling,
    };

    const { successRate, errorRate, latencyMs, costUsd, securityViolations = 0 } = record.metrics;
    const violations: string[] = [];

    if (successRate < effectiveThresholds.successRateFloor) {
      violations.push(`successRate(${successRate}) below floor(${effectiveThresholds.successRateFloor})`);
    }
    if (errorRate > effectiveThresholds.errorRateCeiling) {
      violations.push(`errorRate(${errorRate}) above ceiling(${effectiveThresholds.errorRateCeiling})`);
    }
    if (latencyMs > effectiveThresholds.latencyCeilingMs) {
      violations.push(`latencyMs(${latencyMs}) above ceiling(${effectiveThresholds.latencyCeilingMs})`);
    }
    if (costUsd > effectiveThresholds.costCeilingUsd) {
      violations.push(`costUsd(${costUsd}) above ceiling(${effectiveThresholds.costCeilingUsd})`);
    }
    if (securityViolations > effectiveThresholds.securityViolationCeiling) {
      violations.push(
        `securityViolations(${securityViolations}) above ceiling(${effectiveThresholds.securityViolationCeiling})`,
      );
    }

    if (violations.length > 0) {
      record.status = 'rollback_pending';
      record.failureReason = `Metric threshold violations: ${violations.join("; ")}`;
      return true;
    }

    return false;
  }

  async complete(proposalId: string): Promise<void> {
    const record = this.rollouts.get(proposalId);
    if (record) {
      record.status = 'succeeded';
      record.completedAt = new Date().toISOString();
    }
  }

  async fail(proposalId: string, reason: string): Promise<void> {
    const record = this.rollouts.get(proposalId);
    if (record) {
      record.status = 'failed';
      record.failureReason = reason;
      record.completedAt = new Date().toISOString();
    }
  }

  async rollback(proposalId: string, reason: string): Promise<void> {
    const record = this.rollouts.get(proposalId);
    if (record) {
      record.status = 'rolled_back';
      record.failureReason = reason;
      record.completedAt = new Date().toISOString();
    }
  }

  async getRollout(proposalId: string): Promise<RolloutRecord | null> {
    return this.rollouts.get(proposalId) ?? null;
  }

  async getActiveRollouts(): Promise<RolloutRecord[]> {
    return Array.from(this.rollouts.values()).filter((r) => r.status === 'running');
  }

  getDefaultStageSequence(): RolloutStage[] {
    return ['shadow', 'canary', 'partial', 'stable'];
  }

  getStagePercentage(stage: RolloutStage): number {
    switch (stage) {
      case 'shadow': return 0;      // 0% - observe only
      case 'canary': return 5;      // 5% of traffic
      case 'partial': return 25;    // 25% of traffic
      case 'stable': return 100;    // 100% - full rollout
    }
  }
}