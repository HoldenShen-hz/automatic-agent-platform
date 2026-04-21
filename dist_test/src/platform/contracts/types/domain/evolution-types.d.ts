/**
 * @fileoverview Evolution Types - Evolution proposal, policy, and log records.
 *
 * Contains records related to agent behavior evolution including
 * evolution proposals, approved policies, and audit logs.
 *
 * Part of the domain.ts split (see src/core/types/domain/index.ts).
 */
import type { EvolutionProposalKind, EvolutionProposalStatus, EvolutionScopeType, EvolutionPolicyStatus, EvolutionLogEventType, PmfValidationVerdict, Timestamp } from "./primitives.js";
/**
 * Evolution proposal record - tracks suggested improvements to agent behavior.
 *
 * Agents can propose changes to their own configuration (budget adjustments,
 * experience promotions) based on observed success patterns. Proposals require
 * approval before being applied and can be rolled back if they cause issues.
 */
export interface EvolutionProposalRecord {
    id: string;
    taskId: string;
    executionId: string | null;
    sourceAgentId: string;
    kind: EvolutionProposalKind;
    scopeType: EvolutionScopeType;
    scopeRef: string;
    status: EvolutionProposalStatus;
    approvalId: string | null;
    summary: string;
    proposalJson: string;
    evidenceJson: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    approvedAt: Timestamp | null;
    appliedAt: Timestamp | null;
    rolledBackAt: Timestamp | null;
}
/**
 * Evolution policy record - an approved and active evolution policy.
 *
 * When an evolution proposal is approved, a policy is created to enforce
 * the approved changes. Policies track their active/rolled_back status
 * and the scope they apply to (division, role, or task intent).
 */
export interface EvolutionPolicyRecord {
    id: string;
    proposalId: string;
    kind: EvolutionProposalKind;
    scopeType: EvolutionScopeType;
    scopeRef: string;
    status: EvolutionPolicyStatus;
    valueJson: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    rolledBackAt: Timestamp | null;
}
/**
 * Evolution log record - audit trail of evolution proposal lifecycle events.
 *
 * Tracks state transitions of proposals through the approval and application
 * pipeline. Logs include creation, approval, application, and rollback events
 * for compliance auditing and debugging approval flow issues.
 */
export interface EvolutionLogRecord {
    id: string;
    proposalId: string;
    taskId: string;
    executionId: string | null;
    eventType: EvolutionLogEventType;
    reasonCode: string;
    beforeStateJson: string | null;
    afterStateJson: string | null;
    metadataJson: string | null;
    createdAt: Timestamp;
}
/**
 * PMF validation report record - performance measurement framework validation results.
 *
 * Tracks whether agent configurations are performing within expected bounds.
 * Verdict indicates pass/warn/fail status, with detailed report in JSON format.
 */
export interface PmfValidationReportRecord {
    id: string;
    profileName: string;
    windowStart: Timestamp;
    windowEnd: Timestamp;
    divisionId: string | null;
    verdict: PmfValidationVerdict;
    summaryJson: string;
    reportJson: string;
    generatedAt: Timestamp;
}
export type { PmfValidationVerdict } from "./primitives.js";
