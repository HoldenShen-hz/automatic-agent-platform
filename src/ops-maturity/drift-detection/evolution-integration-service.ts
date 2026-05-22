/**
 * Evolution Integration Service
 *
 * Bridges the new Evolution Engine modules (EvidenceStore, ReflectionEngine,
 * ProposalEngine) with the existing system. This service is called when:
 * - Tasks complete (to record success/failure evidence)
 * - Failures accumulate (to trigger reflection)
 * - Proposals are created (to feed into the approval workflow)
 */

import { randomUUID } from "node:crypto";

import type { EvidenceRecord } from './learning/evidence-store.js';
import type { ReflectionRecord } from './learning/reflection-engine.js';
import type { ProposalKind } from './learning/proposal-engine.js';
import { InMemoryEvidenceStore } from './learning/evidence-store.js';
import { SimpleReflectionEngine } from './learning/reflection-engine.js';
import { SimpleProposalEngine } from './learning/proposal-engine.js';
import { SimpleBenchmarkRunner } from './learning/benchmark-runner.js';
import { PromotionGate, DEFAULT_PROMOTION_GATE_CONFIG } from './learning/promotion-gate.js';
import type { AuthoritativeTaskStore } from '../../platform/five-plane-state-evidence/truth/authoritative-task-store.js';
import type { ApprovalService } from '../../platform/five-plane-control-plane/approval-center/approval-service.js';
import type { LearningObject } from '../../platform/five-plane-orchestration/learn/learning-object-model.js';

/**
 * R13-06: Bridge interface to the main learning pipeline.
 * Allows EvolutionIntegrationService to produce LearningObjects
 * that feed into StrategyLearningService.
 */
export interface LearningBridge {
  /**
   * Called when evolution produces validated LearningObjects.
   * Implementations should forward these to the main learning pipeline.
   */
  onLearningObjects(objects: LearningObject[]): Promise<void>;
}

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

function createEvidenceId(): string {
  return `ev_${randomUUID()}`;
}

/**
 * Service that integrates evidence collection, reflection, and proposal
 * generation into the existing runtime flow.
 *
 * R13-06: This service now bridges with the main learning pipeline (StrategyLearningService)
 * via the LearningBridge interface to unify the two parallel learning pipelines.
 */
export class EvolutionIntegrationService {
  private readonly evidenceStore: InMemoryEvidenceStore;
  private readonly reflectionEngine: SimpleReflectionEngine;
  private readonly proposalEngine: SimpleProposalEngine;
  private readonly benchmarkRunner: SimpleBenchmarkRunner;
  private readonly promotionGate: PromotionGate;
  private readonly config: EvolutionIntegrationConfig;
  private learningBridge: LearningBridge | null = null;

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
   * R13-06: Sets the learning bridge to connect with the main learning pipeline.
   * When set, evolution-produced proposals will be converted to LearningObjects
   * and forwarded to StrategyLearningService via the bridge.
   */
  public setLearningBridge(bridge: LearningBridge): void {
    this.learningBridge = bridge;
  }

  /**
   * R13-06: Syncs approved proposals to the main learning pipeline.
   * Converts active proposals to LearningObjects and forwards them
   * to StrategyLearningService via the configured bridge.
   */
  public async syncWithLearningPipeline(): Promise<void> {
    if (!this.learningBridge) {
      return;
    }

    const activeProposals = await this.proposalEngine.listActive();
    if (activeProposals.length === 0) {
      return;
    }

    const learningObjects = activeProposals.map((proposal) =>
      this.proposalToLearningObject(proposal)
    );

    await this.learningBridge.onLearningObjects(learningObjects);
  }

  /**
   * R13-06: Converts an ImprovementProposal to a LearningObject
   * for integration with the main learning pipeline.
   */
  private proposalToLearningObject(proposal: import('./learning/proposal-engine.js').ImprovementProposal): LearningObject {
    const now = new Date().toISOString();
    // Map proposal kind to learning type
    const learningType = this.proposalKindToLearningType(proposal.kind);

    return {
      learningObjectId: `evo_${proposal.id}`,
      objectId: `evo_${proposal.id}`,
      learningType,
      kind: learningType,
      title: proposal.title,
      summary: proposal.description,
      content: {
        title: proposal.title,
        summary: proposal.description,
        evidenceRefs: proposal.evidenceIds,
        sourceSignalIds: [`proposal:${proposal.id}`],
        recommendation: proposal.rationale,
      },
      confidence: 0.7, // Proposals have baseline confidence
      evidenceRefs: proposal.evidenceIds,
      sourceSignalIds: [`proposal:${proposal.id}`],
      recommendation: proposal.rationale,
      validatedBy: 'shadow_execution',
      promotionStatus: 'validated',
      status: 'validated',
      createdAt: now,
    };
  }

  /**
   * R13-06: Maps proposal kind to learning type.
   */
  private proposalKindToLearningType(
    kind: import('./learning/proposal-engine.js').ProposalKind
  ): LearningObject['learningType'] {
    switch (kind) {
      case 'prompt_patch':
      case 'skill_doc':
        return 'user_correction';
      case 'workflow_template':
        return 'recovery_playbook';
      case 'tool_routing_rule':
      case 'threshold_tuning':
      default:
        return 'failure_pattern';
    }
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
      id: createEvidenceId(),
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
      id: createEvidenceId(),
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
    const kind = this.inferProposalKind(reflection.taskType);
    // R13-11: Use dynamic risk assessment instead of a fixed 'low' value.
    const risk = this.determineRisk(kind, reflection.taskType);

    const proposal = await this.proposalEngine.create({
      title: `Auto-generated: ${reflection.rootCause.slice(0, 50)}`,
      description: reflection.recommendation,
      kind,
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

  /**
   * R13-11: Dynamically determines risk level based on proposal characteristics.
   * Security-related proposals and significant changes get higher risk assessment.
   */
  private determineRisk(kind: ProposalKind, taskType: string): 'low' | 'medium' | 'high' {
    const securityKeywords = ['security', 'auth', 'permission', 'access', 'forbidden'];

    // High-risk categories always high
    if (kind === 'prompt_patch' || kind === 'threshold_tuning') {
      return 'high';
    }

    // Security-related task types always high
    if (securityKeywords.some(kw => taskType.toLowerCase().includes(kw))) {
      return 'high';
    }

    // Workflow template changes are medium risk
    if (kind === 'workflow_template') {
      return 'medium';
    }

    // Default to low for tool_routing_rule and skill_doc
    return 'low';
  }
}
