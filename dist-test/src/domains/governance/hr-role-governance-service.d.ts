/**
 * HR Role Governance Service
 *
 * Manages the lifecycle of HR roles within divisions including gap analysis,
 * role proposal creation, validation, and registration. Provides governance
 * controls to ensure roles comply with division policies and security boundaries.
 *
 * Key concepts:
 * - Gap analysis identifies missing capabilities and suggests matching roles
 * - Role proposals must pass validation before being submitted for approval
 * - Commands require explicit scope boundaries to prevent unauthorized execution
 */
import type { ApprovalRequest, ApprovalService } from "../../platform/control-plane/approval-center/approval-service.js";
import type { DivisionRegistry } from "./division-loader.js";
/** Reason codes for gap analysis triggers */
export type HrGapTriggerReason = "no_role_match" | "scope_exceeded";
/** Status of an HR role proposal approval */
export type HrProposalApprovalStatus = "approved";
/**
 * Request for gap analysis when a task cannot be dispatched.
 */
export interface HrGapAnalysisRequest {
    taskId: string;
    taskDescription: string;
    targetDivisionId: string;
    triggerReason: HrGapTriggerReason;
    requestedCapabilities: readonly string[];
    failedDispatchLog?: {
        attemptedDivisionId?: string;
        attemptedRoleId?: string;
        failureDetails: string;
    } | null;
}
/**
 * Result of gap analysis containing matched roles and missing capabilities.
 */
export interface HrGapAnalysisResult {
    taskId: string;
    targetDivisionId: string;
    triggerReason: HrGapTriggerReason;
    matchedRoleIds: readonly string[];
    missingCapabilities: readonly string[];
    divisionToolUnion: readonly string[];
    suggestedToolNames: readonly string[];
    recommendedModel: "coding" | "balanced";
}
/**
 * Schema shape for role input/output specifications.
 */
export interface HrRoleSchemaShape {
    required: readonly string[];
    optional?: readonly string[];
}
/**
 * A precondition that must be satisfied before a role can execute.
 */
export interface HrRolePrecondition {
    check: string;
    description: string;
}
/**
 * A suggested workflow step to attach to a role proposal.
 */
export interface HrWorkflowStepSuggestion {
    stepId: string;
    roleId: string;
    inputKeys?: readonly string[];
    outputKey: string;
    timeoutMs: number;
    maxAttempts: number;
    autoApply?: boolean;
}
/**
 * A suggestion for inserting a workflow step.
 */
export interface HrWorkflowSuggestion {
    insertAfterStepId: string;
    step: HrWorkflowStepSuggestion;
}
/**
 * A proposal for creating a new HR role within a division.
 */
export interface HrRoleProposal {
    divisionId: string;
    roleId: string;
    name: string;
    promptText: string;
    model: "reasoning" | "coding" | "balanced" | "fast";
    tools: readonly string[];
    maxInstances?: number | null;
    scope: {
        responsibilities: readonly string[];
        boundaries: readonly string[];
    };
    inputSchema: HrRoleSchemaShape;
    outputSchema: HrRoleSchemaShape;
    preconditions: readonly HrRolePrecondition[];
    workflowSuggestion?: HrWorkflowSuggestion | null;
}
/**
 * Result of validating a role proposal.
 */
export interface HrRoleProposalValidationResult {
    valid: boolean;
    errors: readonly string[];
    warnings: readonly string[];
    normalizedTools: readonly string[];
    declaredDivisionToolUnion: readonly string[];
}
/**
 * Request to submit a role proposal for approval.
 */
export interface SubmitHrRoleProposalRequest {
    gapAnalysisRequest: HrGapAnalysisRequest;
    proposal: HrRoleProposal;
    executionId?: string | null;
    sessionId?: string | null;
    sourceAgentId?: string;
}
/**
 * Result of submitting a role proposal.
 */
export interface SubmitHrRoleProposalResult {
    gapAnalysis: HrGapAnalysisResult;
    validation: HrRoleProposalValidationResult;
    approvalRequest: ApprovalRequest | null;
}
/**
 * Request to register an approved HR role.
 */
export interface RegisterApprovedHrRoleRequest {
    proposal: HrRoleProposal;
    approvalStatus: HrProposalApprovalStatus;
}
/**
 * Service for governing HR role lifecycle including gap analysis,
 * proposal submission, validation, and registration.
 */
export declare class HrRoleGovernanceService {
    private readonly divisionRegistry;
    private readonly approvalService;
    constructor(divisionRegistry?: DivisionRegistry | null, approvalService?: ApprovalService | null);
    /**
     * Analyzes a task to identify capability gaps and suggest matching roles.
     *
     * Scores all roles in the division against requested capabilities to find
     * the best matches and identify any missing capabilities.
     */
    analyzeGap(request: HrGapAnalysisRequest): HrGapAnalysisResult;
    /**
     * Validates a role proposal for compliance with division policies.
     *
     * Checks include duplicate detection, required fields, tool permissions,
     * command boundary requirements, and workflow consistency.
     */
    validateProposal(proposal: HrRoleProposal): HrRoleProposalValidationResult;
    /**
     * Submits a role proposal for approval after validation.
     *
     * Creates an approval request if validation passes and an approval service is configured.
     */
    submitProposal(request: SubmitHrRoleProposalRequest): SubmitHrRoleProposalResult;
    /**
     * Registers an approved HR role into the division registry.
     *
     * Requires the proposal to have been approved through the approval workflow.
     */
    registerApprovedRole(request: RegisterApprovedHrRoleRequest): DivisionRegistry;
}
