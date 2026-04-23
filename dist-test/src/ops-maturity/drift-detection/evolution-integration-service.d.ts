/**
 * Evolution Integration Service
 *
 * Bridges the new Evolution Engine modules (EvidenceStore, ReflectionEngine,
 * ProposalEngine) with the existing system. This service is called when:
 * - Tasks complete (to record success/failure evidence)
 * - Failures accumulate (to trigger reflection)
 * - Proposals are created (to feed into the approval workflow)
 */
import type { AuthoritativeTaskStore } from '../../platform/state-evidence/truth/authoritative-task-store.js';
import type { ApprovalService } from '../../platform/control-plane/approval-center/approval-service.js';
export interface EvolutionIntegrationConfig {
    reflectionThreshold: number;
    proposalConfidenceThreshold: number;
    enableAutomaticProposal: boolean;
}
export declare const DEFAULT_CONFIG: EvolutionIntegrationConfig;
/**
 * Service that integrates evidence collection, reflection, and proposal
 * generation into the existing runtime flow.
 */
export declare class EvolutionIntegrationService {
    private readonly store;
    private readonly approvalService;
    private readonly evidenceStore;
    private readonly reflectionEngine;
    private readonly proposalEngine;
    private readonly benchmarkRunner;
    private readonly promotionGate;
    private readonly config;
    constructor(store: AuthoritativeTaskStore, approvalService: ApprovalService, config?: Partial<EvolutionIntegrationConfig>);
    /**
     * Records a task failure as evidence for the evolution system.
     * Call this from RuntimeRecoveryDecisionService when a task fails.
     */
    recordFailure(input: {
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
    }): Promise<void>;
    /**
     * Records a task success as evidence.
     * Call this when a task completes successfully.
     */
    recordSuccess(input: {
        taskId: string;
        executionId: string;
        agentId: string | null;
        sessionId: string;
        costUsd: number;
        latencyMs: number;
        toolCalls: number;
    }): Promise<void>;
    /**
     * Triggers reflection on accumulated failures for a task type.
     * Creates improvement proposals if reflection confidence is high enough.
     */
    private triggerReflection;
    /**
     * Creates an improvement proposal based on a reflection.
     */
    private createProposalFromReflection;
    /**
     * Gets evolution statistics for monitoring/debugging.
     */
    getStatistics(): Promise<{
        totalEvidence: number;
        recentFailures: number;
        proposalsPending: number;
        proposalsActive: number;
    }>;
    private inferTaskType;
    private classifyFailureMode;
    private inferFailureCategory;
    private inferProposalKind;
}
