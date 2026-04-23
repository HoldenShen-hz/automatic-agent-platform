/**
 * Evolution Registry
 *
 * Central registry for tracking all proposals, their status,
 * evaluations, and rollout records.
 */
import type { ImprovementProposal, ProposalStatus } from './proposal-engine.js';
import type { EvaluationReport } from './benchmark-runner.js';
import type { RolloutRecord } from './rollout-manager.js';
import type { ReflectionRecord } from './reflection-engine.js';
export interface EvolutionRegistry {
    saveProposal(proposal: ImprovementProposal): Promise<void>;
    updateProposalStatus(id: string, status: ProposalStatus): Promise<void>;
    getProposal(id: string): Promise<ImprovementProposal | null>;
    listProposals(status?: ProposalStatus): Promise<ImprovementProposal[]>;
    saveEvaluation(report: EvaluationReport): Promise<void>;
    getEvaluation(proposalId: string): Promise<EvaluationReport | null>;
    listEvaluations(): Promise<EvaluationReport[]>;
    saveRollout(record: RolloutRecord): Promise<void>;
    getRollout(proposalId: string): Promise<RolloutRecord | null>;
    listActiveRollouts(): Promise<RolloutRecord[]>;
    saveReflection(reflection: ReflectionRecord): Promise<void>;
    listReflections(taskType?: string): Promise<ReflectionRecord[]>;
    getStatistics(): Promise<EvolutionStatistics>;
}
export interface EvolutionStatistics {
    totalProposals: number;
    byStatus: Record<ProposalStatus, number>;
    activeCount: number;
    rejectedCount: number;
    averageSuccessLift: number;
}
export declare class InMemoryEvolutionRegistry implements EvolutionRegistry {
    private proposals;
    private evaluations;
    private rollouts;
    private reflections;
    private readonly maxEntries;
    private cleanupAt;
    private evictExpired;
    saveProposal(proposal: ImprovementProposal): Promise<void>;
    updateProposalStatus(id: string, status: ProposalStatus): Promise<void>;
    getProposal(id: string): Promise<ImprovementProposal | null>;
    listProposals(status?: ProposalStatus): Promise<ImprovementProposal[]>;
    saveEvaluation(report: EvaluationReport): Promise<void>;
    getEvaluation(proposalId: string): Promise<EvaluationReport | null>;
    listEvaluations(): Promise<EvaluationReport[]>;
    saveRollout(record: RolloutRecord): Promise<void>;
    getRollout(proposalId: string): Promise<RolloutRecord | null>;
    listActiveRollouts(): Promise<RolloutRecord[]>;
    saveReflection(reflection: ReflectionRecord): Promise<void>;
    listReflections(taskType?: string): Promise<ReflectionRecord[]>;
    getStatistics(): Promise<EvolutionStatistics>;
}
