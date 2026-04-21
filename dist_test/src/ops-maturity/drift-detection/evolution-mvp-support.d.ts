/**
 * Evolution MVP Service
 *
 * Manages the lifecycle of evolution proposals including budget adjustments and experience promotion.
 * Proposals go through a workflow: create -> pending approval -> approved -> applied -> rolled back.
 * Budget adjustments modify cost policies based on observed spending patterns.
 * Experience promotion elevates successful task patterns into reusable structured memory.
 */
import type { EvolutionLogRecord, EvolutionPolicyRecord, EvolutionProposalRecord, EvolutionScopeType } from "../../platform/contracts/types/domain.js";
import type { BudgetPolicy } from "../../platform/model-gateway/cost-tracker/budget-guard.js";
import type { ApprovalRequest } from "../../platform/control-plane/approval-center/approval-service.js";
/**
 * Evidence supporting a budget adjustment proposal.
 * Contains both the current policy and the recommended policy along with observed metrics.
 */
export interface BudgetAdjustmentEvidence {
    currentPolicy: BudgetPolicy;
    recommendedPolicy: BudgetPolicy;
    observedAverageCostUsd: number;
    sampleSize: number;
    successRate: number;
    proposalReason: string;
}
/**
 * Evidence supporting an experience promotion proposal.
 * Contains the matched experience and similarity metrics used to justify promotion.
 */
export interface ExperiencePromotionEvidence {
    taskContext: string;
    taskIntent: string;
    queryTools: readonly string[];
    matchedExperienceId: string;
    similarityScore: number;
    matchedKeywords: readonly string[];
    proposedSummary: string;
}
/**
 * Payload for a budget adjustment evolution proposal.
 */
export interface BudgetAdjustmentProposalPayload {
    kind: "budget_adjustment";
    recommendedPolicy: BudgetPolicy;
    baselinePolicy: BudgetPolicy;
    observedAverageCostUsd: number;
    sampleSize: number;
    successRate: number;
    proposalReason: string;
}
/**
 * Payload for an experience promotion evolution proposal.
 */
export interface ExperiencePromotionProposalPayload {
    kind: "experience_promotion";
    sourceExperienceId: string;
    sourceTaskContext: string;
    sourceTaskIntent: string;
    targetScope: string;
    promotedSummary: string;
    qualityScore: number;
    matchedKeywords: readonly string[];
}
/**
 * Union type of all evolution proposal payloads.
 */
export type EvolutionProposalPayload = BudgetAdjustmentProposalPayload | ExperiencePromotionProposalPayload;
/**
 * Complete view of an evolution proposal including its approval status, active policy, and audit logs.
 */
export interface EvolutionProposalView {
    proposal: EvolutionProposalRecord;
    approval: ApprovalRequest | null;
    activePolicy: EvolutionPolicyRecord | null;
    logs: EvolutionLogRecord[];
}
/**
 * Input for proposing a budget adjustment evolution.
 */
export interface ProposeBudgetAdjustmentInput {
    taskId: string;
    executionId?: string | null;
    sourceAgentId: string;
    scopeType: EvolutionScopeType;
    scopeRef: string;
    currentPolicy: BudgetPolicy;
    observedAverageCostUsd: number;
    sampleSize: number;
    successRate: number;
    proposalReason: string;
}
/**
 * Input for proposing an experience promotion evolution.
 */
export interface ProposeExperiencePromotionInput {
    taskId: string;
    executionId?: string | null;
    sourceAgentId: string;
    scopeType: EvolutionScopeType;
    scopeRef: string;
    targetScope: string;
    taskContext: string;
    taskIntent: string;
    queryTools?: readonly string[];
    minQualityScore?: number;
}
/**
 * Input for applying an approved evolution proposal.
 */
export interface ApplyEvolutionProposalInput {
    proposalId: string;
    appliedBy: string;
    appliedAt?: string;
}
/**
 * Input for rolling back an applied evolution proposal.
 */
export interface RollbackEvolutionProposalInput {
    proposalId: string;
    rolledBackBy: string;
    reasonCode: string;
    rolledBackAt?: string;
}
/**
 * Validates that a scope reference conforms to the expected format.
 */
export declare function assertEvolutionScope(scopeType: EvolutionScopeType, scopeRef: string): void;
/**
 * Rounds a currency value to 4 decimal places to avoid floating point issues.
 */
export declare function roundCurrency(value: number): number;
/**
 * Rounds a ratio value to 3 decimal places.
 */
export declare function roundRatio(value: number): number;
/**
 * Clamps a value between minimum and maximum bounds.
 */
export declare function clamp(value: number, min: number, max: number): number;
/**
 * Generates a human-readable summary for a budget adjustment proposal.
 */
export declare function summarizeBudgetProposal(scopeType: EvolutionScopeType, scopeRef: string, evidence: BudgetAdjustmentEvidence): string;
/**
 * Computes a recommended budget policy based on observed spending patterns.
 * Increases limits when spending is near limits with good success rate.
 * Decreases limits when spending is well below limits consistently.
 */
export declare function buildRecommendedBudgetPolicy(input: ProposeBudgetAdjustmentInput): BudgetPolicy;
/**
 * Parses the JSON payload from an evolution proposal record.
 */
export declare function parseProposalPayload(record: EvolutionProposalRecord): EvolutionProposalPayload;
/**
 * Parses the JSON value from an evolution policy record.
 */
export declare function parsePolicyValue<T>(record: EvolutionPolicyRecord): T;
/**
 * Service managing the lifecycle of evolution proposals.
 *
 * Evolution proposals allow the system to adapt its behavior over time:
 * - Budget adjustments modify cost policies based on observed spending
 * - Experience promotion captures successful task patterns for reuse
 *
 * Proposals require approval before being applied and can be rolled back.
 */
