/**
 * Evolution MVP Service
 */
export * from "./evolution-mvp-support.js";
import type { EvolutionProposalRecord, EvolutionProposalStatus, EvolutionScopeType } from "../../platform/contracts/types/domain.js";
import type { BudgetPolicy } from "../../platform/model-gateway/cost-tracker/budget-guard.js";
import type { ApprovalService } from "../../platform/control-plane/approval-center/approval-service.js";
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { MemoryService } from "../../platform/state-evidence/memory/memory-service.js";
import { type ApplyEvolutionProposalInput, type EvolutionProposalView, type ProposeBudgetAdjustmentInput, type ProposeExperiencePromotionInput, type RollbackEvolutionProposalInput } from "./evolution-mvp-support.js";
export declare class EvolutionMvpService {
    private readonly db;
    private readonly store;
    private readonly approvalService;
    private readonly memoryService;
    private readonly experienceCacheService;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, approvalService: ApprovalService, memoryService: MemoryService);
    /**
     * Creates a budget adjustment proposal based on observed spending patterns.
     *
     * The proposal is created in pending_approval status and requires approval
     * before it can be applied to modify the budget policy.
     */
    proposeBudgetAdjustment(input: ProposeBudgetAdjustmentInput): EvolutionProposalView;
    /**
     * Creates an experience promotion proposal based on a successful task outcome.
     *
     * Finds similar past experiences and proposes promoting the best match
     * into structured memory for reuse in future tasks.
     */
    proposeExperiencePromotion(input: ProposeExperiencePromotionInput): EvolutionProposalView;
    /**
     * Synchronizes the proposal status with its associated approval record.
     * Updates proposal status based on whether approval was granted, rejected, or expired.
     */
    syncProposalApprovalStatus(proposalId: string, syncedAt?: string): EvolutionProposalRecord;
    /**
     * Applies an approved evolution proposal, activating its policy.
     * For budget adjustments, activates the new policy.
     * For experience promotions, promotes the experience into structured memory.
     */
    applyProposal(input: ApplyEvolutionProposalInput): EvolutionProposalView;
    /**
     * Rolls back an applied evolution proposal, deactivating its associated policy.
     * For experience promotions, also revokes the promoted memory entry.
     */
    rollbackProposal(input: RollbackEvolutionProposalInput): EvolutionProposalView;
    /**
     * Resolves the effective budget policy for a given scope.
     * Returns the active policy if one exists, otherwise returns the base policy.
     */
    resolveBudgetPolicy(basePolicy: BudgetPolicy, scopeType: EvolutionScopeType, scopeRef: string): {
        policy: BudgetPolicy;
        sourceProposalId: string | null;
    };
    /**
     * Lists all proposal views matching the optional status filter.
     */
    listProposalViews(status?: EvolutionProposalStatus): EvolutionProposalView[];
    /**
     * Retrieves a single proposal view by proposal ID.
     */
    getProposalView(proposalId: string): EvolutionProposalView;
    /**
     * Converts a proposal record to a full proposal view with approval, policy, and logs.
     */
    private toProposalView;
    /**
     * Retrieves a proposal by ID, throwing if not found.
     */
    private requireProposal;
}
