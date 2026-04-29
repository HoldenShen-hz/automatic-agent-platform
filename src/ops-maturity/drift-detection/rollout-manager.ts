/**
 * Rollout Manager
 *
 * Manages staged rollout of proposals through shadow, canary,
 * and partial stages to stable release.
 */

import type { ImprovementProposal } from './proposal-engine.js';

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
    }
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
