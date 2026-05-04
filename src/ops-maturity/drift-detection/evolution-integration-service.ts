/**
 * Evolution Integration Service
 *
 * Bridges the new Evolution Engine modules (EvidenceStore, ReflectionEngine,
 * ProposalEngine) with the existing system. This service is called when:
 * - Tasks complete (to record success/failure evidence)
 * - Failures accumulate (to trigger reflection)
 * - Proposals are created (to feed into the approval workflow)
 */

import type { EvidenceRecord } from './evidence-store.js';
import type { ReflectionRecord } from './reflection-engine.js';
import type { ProposalKind } from './proposal-engine.js';
import { InMemoryEvidenceStore } from './evidence-store.js';
import { SimpleReflectionEngine } from './reflection-engine.js';
import { SimpleProposalEngine } from './proposal-engine.js';
import { SimpleBenchmarkRunner } from './benchmark-runner.js';
import { PromotionGate, DEFAULT_PROMOTION_GATE_CONFIG } from './promotion-gate.js';
import type { AuthoritativeTaskStore } from '../../platform/state-evidence/truth/authoritative-task-store.js';
import type { ApprovalService } from '../../platform/control-plane/approval-center/approval-service.js';

export interface EvolutionIntegrationConfig {
  reflectionThreshold: number;  // Min failures before triggering reflection
  proposalConfidenceThreshold: number;
  enableAutomaticProposal: boolean;
}

export const DEFAULT_CONFIG: EvolutionIntegrationConfig = {
  reflectionThreshold: 3,
  proposalConfidenceThreshold: 0.6,
  enableAutomaticProposal: true,
};

/**
 * Service that integrates evidence collection, reflection, and proposal
 * generation into the existing runtime flow.
 */
export class EvolutionIntegrationService {
  private readonly evidenceStore: InMemoryEvidenceStore;
  private readonly reflectionEngine: SimpleReflectionEngine;
  private readonly proposalEngine: SimpleProposalEngine;
  private readonly benchmarkRunner: SimpleBenchmarkRunner;
  private readonly promotionGate: PromotionGate;
  private readonly config: EvolutionIntegrationConfig;

  constructor(
    private readonly store: AuthoritativeTaskStore,
    private readonly approvalService: ApprovalService,
    config: Partial<EvolutionIntegrationConfig> = {}
  ) {
    this.evidenceStore = new InMemoryEvidenceStore();
    this.reflectionEngine = new SimpleReflectionEngine();
    this.proposalEngine = new SimpleProposalEngine();
    this.benchmarkRunner = new SimpleBenchmarkRunner();
    this.promotionGate = new PromotionGate(DEFAULT_PROMOTION_GATE_CONFIG);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Records a task failure as evidence for the evolution system.
   * Call this from RuntimeRecoveryDecisionService when a task fails.
   */
  async recordFailure(input: {
    taskId: string;
    executionId: string;
    agentId: string | null;
    sessionId: string;
    reasonCode: string;
    errorMessage: string | null;
    costUsd: number;
    latencyMs: number;
    toolCalls: number;
    repairRounds: number;
  }): Promise<void> {
    const reasonCode = input.reasonCode;
    const taskType = this.inferTaskType(reasonCode);
    const evidence: EvidenceRecord = {
      id: `ev_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
      taskType,
      sessionId: input.sessionId,
      traceId: input.executionId,
      success: false,
      failureMode: this.classifyFailureMode(reasonCode),
      failureCategory: this.inferFailureCategory(reasonCode) ?? 'complex_repair_failure',
      costUsd: input.costUsd,
      latencyMs: input.latencyMs,
      toolCalls: input.toolCalls,
      repairRounds: input.repairRounds,
      rollback: false,
      createdAt: new Date().toISOString(),
    };

    await this.evidenceStore.append(evidence);

    // Check if we should trigger reflection
    const recentFailures = await this.evidenceStore.listByTaskType(taskType, 10);
    if (recentFailures.length >= this.config.reflectionThreshold) {
      await this.triggerReflection(taskType);
    }
  }

  /**
   * Records a task success as evidence.
   * Call this when a task completes successfully.
   */
  async recordSuccess(input: {
    taskId: string;
    executionId: string;
    agentId: string | null;
    sessionId: string;
    costUsd: number;
    latencyMs: number;
    toolCalls: number;
  }): Promise<void> {
    const evidence: EvidenceRecord = {
      id: `ev_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
      taskType: 'general',
      sessionId: input.sessionId,
      traceId: input.executionId,
      success: true,
      costUsd: input.costUsd,
      latencyMs: input.latencyMs,
      toolCalls: input.toolCalls,
      repairRounds: 0,
      rollback: false,
      createdAt: new Date().toISOString(),
    };

    await this.evidenceStore.append(evidence);
  }

  /**
   * Triggers reflection on accumulated failures for a task type.
   * Creates improvement proposals if reflection confidence is high enough.
   */
  private async triggerReflection(taskType: string): Promise<void> {
    const failures = await this.evidenceStore.listByTaskType(taskType, 10);

    if (failures.length < this.config.reflectionThreshold) {
      return;
    }

    const reflections = await this.reflectionEngine.reflect(failures);

    for (const reflection of reflections) {
      if (reflection.confidence >= this.config.proposalConfidenceThreshold) {
        await this.createProposalFromReflection(reflection);
      }
    }
  }

  /**
   * Creates an improvement proposal based on a reflection.
   */
  private async createProposalFromReflection(reflection: ReflectionRecord): Promise<void> {
    // R13-11 FIX: Derive risk level from root cause analysis, not hardcoded 'low'.
    // Auto-generated proposals from reflection should assess actual risk.
    const risk = this.assessReflectionRisk(reflection);

    const proposal = await this.proposalEngine.create({
      title: `Auto-generated: ${reflection.rootCause.slice(0, 50)}`,
      description: reflection.recommendation,
      kind: this.inferProposalKind(reflection.taskType),
      target: reflection.taskType,
      risk,
      agentId: 'evolution-system',
      evidenceIds: reflection.evidenceIds,
    });

    // Run benchmark evaluation
    const report = await this.benchmarkRunner.evaluate(proposal);

    // Check promotion gate
    const decision = this.promotionGate.decide(proposal, report, false);

    if (decision.allowed) {
      // Submit for approval
      await this.proposalEngine.submitForApproval(proposal.id);
    }
  }

  /**
   * Gets evolution statistics for monitoring/debugging.
   */
  async getStatistics(): Promise<{
    totalEvidence: number;
    recentFailures: number;
    proposalsPending: number;
    proposalsActive: number;
  }> {
    const stats = await this.evidenceStore.getStatistics();
    const proposals = await this.proposalEngine.listPending();

    return {
      totalEvidence: stats.totalRecords,
      recentFailures: stats.failureCount,
      proposalsPending: proposals.length,
      proposalsActive: (await this.proposalEngine.listActive()).length,
    };
  }

  private inferTaskType(reasonCode: string): string {
    if (reasonCode.includes('timeout')) return 'timeout_task';
    if (reasonCode.includes('type') || reasonCode.includes('schema')) return 'type_error_task';
    if (reasonCode.includes('test')) return 'test_failure_task';
    if (reasonCode.includes('security') || reasonCode.includes('forbidden')) return 'security_task';
    return 'general_task';
  }

  private classifyFailureMode(reasonCode: string): string {
    if (reasonCode.includes('timeout')) return 'timeout';
    if (reasonCode.includes('type')) return 'type_error';
    if (reasonCode.includes('schema')) return 'schema_error';
    if (reasonCode.includes('test')) return 'unit_test_failure';
    if (reasonCode.includes('lint')) return 'lint_error';
    if (reasonCode.includes('security')) return 'security_policy_violation';
    if (reasonCode.includes('forbidden')) return 'forbidden_path';
    return 'complex_repair_failure';
  }

  private inferFailureCategory(reasonCode: string): EvidenceRecord['failureCategory'] {
    if (reasonCode.includes('type') || reasonCode.includes('schema')) return 'type_error';
    if (reasonCode.includes('test')) return 'unit_test_failure';
    if (reasonCode.includes('lint')) return 'lint_error';
    if (reasonCode.includes('security') || reasonCode.includes('forbidden')) return 'forbidden_path';
    if (reasonCode.includes('security_policy')) return 'security_policy_violation';
    return 'complex_repair_failure';
  }

  private inferProposalKind(taskType: string): ProposalKind {
    if (taskType.includes('type') || taskType.includes('schema')) return 'tool_routing_rule';
    if (taskType.includes('timeout')) return 'threshold_tuning';
    if (taskType.includes('test')) return 'prompt_patch';
    return 'skill_doc';
  }

  // R13-11 FIX: Assess risk level from reflection data, not hardcoded 'low'.
  // Security-related root causes should be high risk; costliers failures medium.
  private assessReflectionRisk(reflection: ReflectionRecord): 'low' | 'medium' | 'high' {
    const rootCause = reflection.rootCause.toLowerCase();
    const metadata = reflection.metadata as Record<string, unknown> | undefined;

    // Security-related failures are high risk
    if (rootCause.includes('security') || rootCause.includes('forbidden') || rootCause.includes('policy_violation')) {
      return 'high';
    }

    // High repair rounds indicate complex failures that could have high impact
    const avgRepairRounds = metadata?.avgRepairRounds as number | undefined;
    if (avgRepairRounds !== undefined && avgRepairRounds >= 3) {
      return 'high';
    }

    // High cost failures are medium-high risk
    const avgCostUsd = metadata?.avgCostUsd as number | undefined;
    if (avgCostUsd !== undefined && avgCostUsd > 1.0) {
      return 'medium';
    }

    // Inconclusive root cause should default to medium for safety
    if (rootCause.includes('inconclusive') || rootCause.includes('unknown')) {
      return 'medium';
    }

    // Most other failures are low risk
    return 'low';
  }
}
