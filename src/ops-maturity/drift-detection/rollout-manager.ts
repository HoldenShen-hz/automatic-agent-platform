/**
 * Rollout Manager
 *
 * Manages staged rollout of proposals through shadow, canary,
 * and partial stages to stable release.
 */

import { nowIso } from "../../platform/contracts/types/ids.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
import type { ImprovementProposal } from './proposal-engine.js';

const logger = new StructuredLogger({ retentionLimit: 100 });

export type RolloutStage = 'shadow' | 'canary' | 'partial' | 'stable';

export type RolloutStatus = 'running' | 'succeeded' | 'failed' | 'rollback_pending' | 'rolled_back';

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

export interface RolloutMetrics {
  successRate: number;
  errorRate: number;
  latencyMs: number;
  costUsd: number;
}

export interface MetricThresholds {
  minSuccessRate?: number;    // e.g., 0.95 for 95%
  maxErrorRate?: number;       // e.g., 0.05 for 5%
  maxLatencyMs?: number;       // e.g., 2000 for 2s
  maxCostUsd?: number;         // e.g., 0.10 per execution
}

export const DEFAULT_THRESHOLDS: MetricThresholds = {
  minSuccessRate: 0.95,
  maxErrorRate: 0.05,
  maxLatencyMs: 2000,
  maxCostUsd: 0.10,
};

export interface RolloutManager {
  start(proposal: ImprovementProposal, stage: RolloutStage, percentage: number): Promise<RolloutRecord>;
  updateMetrics(proposalId: string, metrics: RolloutMetrics, thresholds?: MetricThresholds): Promise<void>;
  complete(proposalId: string): Promise<void>;
  fail(proposalId: string, reason: string): Promise<void>;
  rollback(proposalId: string, reason: string): Promise<void>;
  getRollout(proposalId: string): Promise<RolloutRecord | null>;
  getActiveRollouts(): Promise<RolloutRecord[]>;
}

export class SimpleRolloutManager implements RolloutManager {
  private rollouts = new Map<string, RolloutRecord>();
  private readonly maxCompletedRollouts: number;
  private readonly maxActiveRollouts: number;

  constructor(maxCompletedRollouts = 100, maxActiveRollouts = 50) {
    this.maxCompletedRollouts = maxCompletedRollouts;
    this.maxActiveRollouts = maxActiveRollouts;
  }

  private evictCompletedRollouts(): void {
    const completedKeys = [...this.rollouts.entries()]
      .filter(([, r]) => r.status === "succeeded" || r.status === "failed" || r.status === "rolled_back")
      .map(([k]) => k);
    if (completedKeys.length > this.maxCompletedRollouts) {
      const toEvict = completedKeys.slice(0, completedKeys.length - this.maxCompletedRollouts);
      for (const key of toEvict) {
        this.rollouts.delete(key);
      }
    }
  }

  private evictActiveRolloutsIfNeeded(): void {
    const activeKeys = [...this.rollouts.entries()]
      .filter(([, r]) => r.status === "running" || r.status === "rollback_pending")
      .map(([k]) => k);
    if (activeKeys.length > this.maxActiveRollouts) {
      const toEvict = activeKeys.slice(0, activeKeys.length - this.maxActiveRollouts);
      for (const key of toEvict) {
        this.rollouts.delete(key);
      }
    }
  }

  async start(
    proposal: ImprovementProposal,
    stage: RolloutStage,
    percentage: number
  ): Promise<RolloutRecord> {
    // Enforce active rollout limit before starting a new one
    this.evictActiveRolloutsIfNeeded();

    const record: RolloutRecord = {
      proposalId: proposal.id,
      stage,
      percentage,
      startedAt: nowIso(),
      status: 'running',
    };

    this.rollouts.set(proposal.id, record);
    return record;
  }

  async updateMetrics(
    proposalId: string,
    metrics: RolloutMetrics,
    thresholds: MetricThresholds = DEFAULT_THRESHOLDS
  ): Promise<void> {
    const record = this.rollouts.get(proposalId);
    if (!record) return;

    record.metrics = metrics;

    // Check quality/cost/security thresholds per §56.4
    const violations: string[] = [];

    if (thresholds.minSuccessRate !== undefined && metrics.successRate < thresholds.minSuccessRate) {
      violations.push(`successRate ${metrics.successRate} below threshold ${thresholds.minSuccessRate}`);
    }
    if (thresholds.maxErrorRate !== undefined && metrics.errorRate > thresholds.maxErrorRate) {
      violations.push(`errorRate ${metrics.errorRate} above threshold ${thresholds.maxErrorRate}`);
    }
    if (thresholds.maxLatencyMs !== undefined && metrics.latencyMs > thresholds.maxLatencyMs) {
      violations.push(`latencyMs ${metrics.latencyMs} above threshold ${thresholds.maxLatencyMs}`);
    }
    if (thresholds.maxCostUsd !== undefined && metrics.costUsd > thresholds.maxCostUsd) {
      violations.push(`costUsd ${metrics.costUsd} above threshold ${thresholds.maxCostUsd}`);
    }

    if (violations.length > 0) {
      record.status = 'rollback_pending';
      record.failureReason = `Metric threshold breach: ${violations.join('; ')}`;
      // R13-10 FIX: emit rollback event and schedule rollback execution
      logger.log({
        level: "warn",
        message: "rollout_manager.auto_rollback_triggered",
        data: { proposalId, violations, metrics, thresholds },
      });
      // Schedule rollback execution - SimpleRolloutManager is in-memory so we log a warning
      // that external coordinator must handle the actual revert. In full implementation,
      // this would call a RollbackScheduler.scheduleRollback(proposalId) or similar.
      this.scheduleRollback(proposalId);
    }
  }

  private scheduleRollback(proposalId: string): void {
    // R13-10 FIX: scheduling hook for auto-rollback
    // In production, this would enqueue a rollback job via the task queue system.
    // For SimpleRolloutManager (in-memory), we emit the event and rely on external monitors.
    logger.log({
      level: "info",
      message: "rollout_manager.rollback_scheduled",
      data: { proposalId, scheduledAt: nowIso() },
    });
  }

  async complete(proposalId: string): Promise<void> {
    const record = this.rollouts.get(proposalId);
    if (record) {
      record.status = 'succeeded';
      record.completedAt = nowIso();
      this.evictCompletedRollouts();
    }
  }

  async fail(proposalId: string, reason: string): Promise<void> {
    const record = this.rollouts.get(proposalId);
    if (record) {
      record.status = 'failed';
      record.failureReason = reason;
      record.completedAt = nowIso();
      this.evictCompletedRollouts();
    }
  }

  async rollback(proposalId: string, reason: string): Promise<void> {
    const record = this.rollouts.get(proposalId);
    if (record) {
      record.status = 'rolled_back';
      record.failureReason = reason;
      record.completedAt = nowIso();
      // R16-36 FIX #2106: rollback() only changed status - no actual revert.
      // A rollback should revert the proposal to its previous stable version.
      // Since SimpleRolloutManager is in-memory only, we mark for manual revert.
      // Actual revert would call the ProposalEngine.revertToPrevious() method.
      logger.log({
        level: "warn",
        message: "rollout_manager.rollback_requires_manual_revert",
        data: { proposalId, reason },
      });
      this.evictCompletedRollouts();
    }
  }

  async getRollout(proposalId: string): Promise<RolloutRecord | null> {
    return this.rollouts.get(proposalId) ?? null;
  }

  async getActiveRollouts(): Promise<RolloutRecord[]> {
    return Array.from(this.rollouts.values()).filter(
      (r) => r.status === 'running' || r.status === 'rollback_pending'
    );
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
