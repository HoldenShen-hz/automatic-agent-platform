/**
 * Rollout Manager
 *
 * Manages staged rollout of proposals through shadow, canary,
 * and partial stages to stable release.
 */

import type { ImprovementProposal } from './proposal-engine.js';

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
