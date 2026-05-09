/**
 * Evolution Registry
 *
 * Central registry for tracking all proposals, their status,
 * evaluations, and rollout records.
 */

import type { ImprovementProposal, ProposalStatus } from './learning/proposal-engine.js';
import type { EvaluationReport } from './learning/benchmark-runner.js';
import type { RolloutRecord } from './learning/rollout-manager.js';
import type { ReflectionRecord } from './learning/reflection-engine.js';

export interface EvolutionRegistry {
  // Proposal operations
  saveProposal(proposal: ImprovementProposal): Promise<void>;
  updateProposalStatus(id: string, status: ProposalStatus): Promise<void>;
  getProposal(id: string): Promise<ImprovementProposal | null>;
  listProposals(status?: ProposalStatus): Promise<ImprovementProposal[]>;

  // Evaluation operations
  saveEvaluation(report: EvaluationReport): Promise<void>;
  getEvaluation(proposalId: string): Promise<EvaluationReport | null>;
  listEvaluations(): Promise<EvaluationReport[]>;

  // Rollout operations
  saveRollout(record: RolloutRecord): Promise<void>;
  getRollout(proposalId: string): Promise<RolloutRecord | null>;
  listActiveRollouts(): Promise<RolloutRecord[]>;

  // Reflection operations
  saveReflection(reflection: ReflectionRecord): Promise<void>;
  listReflections(taskType?: string): Promise<ReflectionRecord[]>;

  // Statistics
  getStatistics(): Promise<EvolutionStatistics>;
}

export interface EvolutionStatistics {
  totalProposals: number;
  byStatus: Record<ProposalStatus, number>;
  activeCount: number;
  rejectedCount: number;
  averageSuccessLift: number;
}

export class InMemoryEvolutionRegistry implements EvolutionRegistry {
  private proposals = new Map<string, ImprovementProposal>();
  private evaluations = new Map<string, EvaluationReport>();
  private rollouts = new Map<string, RolloutRecord>();
  private reflections: ReflectionRecord[] = [];
  private readonly maxEntries = 500;
  private cleanupAt = 0;

  private evictExpired(): void {
    const now = Date.now();
    if (now - this.cleanupAt < 60000) return;
    this.cleanupAt = now;
    if (this.proposals.size <= this.maxEntries) return;
    const keys = Array.from(this.proposals.keys());
    const toRemove = keys.slice(0, Math.floor(this.maxEntries * 0.2));
    for (const k of toRemove) this.proposals.delete(k);
  }

  async saveProposal(proposal: ImprovementProposal): Promise<void> {
    this.proposals.set(proposal.id, proposal);
  }

  async updateProposalStatus(id: string, status: ProposalStatus): Promise<void> {
    const proposal = this.proposals.get(id);
    if (proposal) {
      this.proposals.set(id, { ...proposal, status, updatedAt: new Date().toISOString() });
    }
  }

  async getProposal(id: string): Promise<ImprovementProposal | null> {
    return this.proposals.get(id) ?? null;
  }

  async listProposals(status?: ProposalStatus): Promise<ImprovementProposal[]> {
    const all = Array.from(this.proposals.values());
    return status ? all.filter((p) => p.status === status) : all;
  }

  async saveEvaluation(report: EvaluationReport): Promise<void> {
    this.evaluations.set(report.proposalId, report);
  }

  async getEvaluation(proposalId: string): Promise<EvaluationReport | null> {
    return this.evaluations.get(proposalId) ?? null;
  }

  async listEvaluations(): Promise<EvaluationReport[]> {
    return Array.from(this.evaluations.values());
  }

  async saveRollout(record: RolloutRecord): Promise<void> {
    this.rollouts.set(record.proposalId, record);
  }

  async getRollout(proposalId: string): Promise<RolloutRecord | null> {
    return this.rollouts.get(proposalId) ?? null;
  }

  async listActiveRollouts(): Promise<RolloutRecord[]> {
    return Array.from(this.rollouts.values()).filter((r) => r.status === 'running');
  }

  async saveReflection(reflection: ReflectionRecord): Promise<void> {
    this.reflections.push(reflection);
  }

  async listReflections(taskType?: string): Promise<ReflectionRecord[]> {
    return taskType
      ? this.reflections.filter((r) => r.taskType === taskType)
      : this.reflections;
  }

  async getStatistics(): Promise<EvolutionStatistics> {
    const proposals = Array.from(this.proposals.values());

    const byStatus: Record<ProposalStatus, number> = {
      draft: 0,
      reviewed: 0,
      staged: 0,
      stable: 0,
      retired: 0,
      rejected: 0,
    };

    for (const proposal of proposals) {
      byStatus[proposal.status] = (byStatus[proposal.status] ?? 0) + 1;
    }

    const activeCount = byStatus.reviewed + byStatus.staged + byStatus.stable;
    const rejectedCount = byStatus.rejected + byStatus.retired;

    const evaluations = Array.from(this.evaluations.values());
    const averageSuccessLift = evaluations.length > 0
      ? evaluations.reduce((sum, e) => sum + (e.successRateAfter - e.successRateBefore), 0) / evaluations.length
      : 0;

    return {
      totalProposals: proposals.length,
      byStatus,
      activeCount,
      rejectedCount,
      averageSuccessLift,
    };
  }
}
