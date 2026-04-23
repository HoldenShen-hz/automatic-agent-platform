/**
 * Rollout Manager
 *
 * Manages staged rollout of proposals through shadow, canary,
 * and partial stages to stable release.
 */
import type { ImprovementProposal } from './proposal-engine.js';
export type RolloutStage = 'shadow' | 'canary' | 'partial' | 'stable';
export type RolloutStatus = 'running' | 'succeeded' | 'failed' | 'rolled_back';
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
export interface RolloutManager {
    start(proposal: ImprovementProposal, stage: RolloutStage, percentage: number): Promise<RolloutRecord>;
    updateMetrics(proposalId: string, metrics: RolloutMetrics): Promise<void>;
    complete(proposalId: string): Promise<void>;
    fail(proposalId: string, reason: string): Promise<void>;
    rollback(proposalId: string, reason: string): Promise<void>;
    getRollout(proposalId: string): Promise<RolloutRecord | null>;
    getActiveRollouts(): Promise<RolloutRecord[]>;
}
export declare class SimpleRolloutManager implements RolloutManager {
    private rollouts;
    start(proposal: ImprovementProposal, stage: RolloutStage, percentage: number): Promise<RolloutRecord>;
    updateMetrics(proposalId: string, metrics: RolloutMetrics): Promise<void>;
    complete(proposalId: string): Promise<void>;
    fail(proposalId: string, reason: string): Promise<void>;
    rollback(proposalId: string, reason: string): Promise<void>;
    getRollout(proposalId: string): Promise<RolloutRecord | null>;
    getActiveRollouts(): Promise<RolloutRecord[]>;
    getDefaultStageSequence(): RolloutStage[];
    getStagePercentage(stage: RolloutStage): number;
}
