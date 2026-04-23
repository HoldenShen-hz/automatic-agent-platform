/**
 * Policy Engine
 *
 * Unified policy evaluation for security decisions, approvals, and budget guards.
 * This is the central decision point for whether actions are permitted.
 *
 * ## Purpose
 *
 * Consolidates multiple policy concerns into a single evaluation chain:
 * - Role-based permissions
 * - Execution policies
 * - Approval escalation
 * - Budget guards
 * - Kill switch
 *
 * ## Decision Flow
 *
 * For each action, the engine evaluates:
 * 1. Kill switch - if active, all actions are denied
 * 2. Budget check - if action exceeds budget, it's denied
 * 3. Risk assessment - high-risk actions in supervised mode escalate
 * 4. Approval requirement - high-risk actions in auto mode require approval
 * 5. Default outcome - allow with constraints
 *
 * ## Modes
 *
 * - supervised: Human in the loop, high-risk needs explicit approval
 * - auto: Automated execution, high-risk still needs approval
 * - full-auto: Fully automated, no approval required (use with caution)
 *
 * @see docs_zh/contracts/policy_engine_contract.md
 */
import type { ToolRiskLevel } from "../../execution/tool-executor/tool-metadata.js";
import { type BudgetPolicy } from "../../model-gateway/cost-tracker/budget-guard.js";
/**
 * Request for a policy decision.
 * Contains all context needed to evaluate whether an action should be permitted.
 */
export interface PolicyDecisionRequest {
    /** Unique identifier for this decision request */
    decisionId: string;
    /** Task this decision is for */
    taskId: string;
    /** Optional execution context */
    executionId?: string;
    /** Optional session context */
    sessionId?: string;
    /** Type of subject making the request */
    subjectType: "user" | "agent" | "system";
    /** ID of the subject making the request */
    subjectId: string;
    /** Action being requested */
    action: "invoke_model" | "invoke_tool" | "write_file" | "exec_command" | "network_access" | "install_extension" | "org_change";
    /** Optional reference to the resource being accessed */
    resourceRef?: string;
    /** Risk category of the action */
    riskCategory: "destructive" | "irreversible" | "prod_affecting" | "cost_sensitive" | "org_changing" | "sensitive_data";
    /** Execution mode */
    mode: "supervised" | "auto" | "full-auto";
    /** Estimated cost in USD */
    estimatedCostUsd?: number;
    /** Additional context metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Result of a policy decision.
 * Contains the decision and reasoning.
 */
export interface PolicyDecisionResult {
    /** The decision made */
    decision: "allow" | "deny" | "allow_with_constraints" | "escalate_for_approval";
    /** Machine-readable reason code */
    reasonCode: string;
    /** Whether approval is required to proceed */
    requiresApproval: boolean;
    /** Constraints that must be met */
    enforcedConstraints: Record<string, unknown>;
    /** Whether a kill switch blocked the action */
    killSwitchApplied: boolean;
    /** Audit payload for logging */
    auditPayload: Record<string, unknown>;
    /** Version of the policy that was evaluated */
    evaluatedPolicyVersion: string;
    /** Human-readable summary */
    explainSummary: string;
}
/**
 * Configuration for the policy engine.
 */
export interface PolicyEngineOptions {
    /** Budget policy to use for cost evaluation */
    budgetPolicy: BudgetPolicy;
    /** Enable kill switch functionality */
    killSwitchEnabled?: boolean;
}
/**
 * Policy Engine
 *
 * Evaluates actions against security and budget policies.
 */
export declare class PolicyEngine {
    private readonly options;
    private readonly budgetGuard;
    constructor(options: PolicyEngineOptions);
    /**
     * Evaluates a policy decision request.
     * This is the main entry point for policy evaluation.
     *
     * The evaluation order is:
     * 1. Input validation
     * 2. Kill switch check
     * 3. Budget check
     * 4. Risk-based escalation
     *
     * @param input - The policy decision request
     * @returns The policy decision result
     */
    evaluate(input: PolicyDecisionRequest): PolicyDecisionResult;
    /**
     * Evaluates budget constraints for the action.
     */
    private evaluateBudget;
    /**
     * Creates an escalation decision for actions requiring approval.
     */
    private escalate;
}
/**
 * Maps tool risk levels to policy risk categories.
 *
 * @param risk - The tool risk level
 * @returns The corresponding policy risk category
 */
export declare function mapToolRiskToPolicyCategory(risk: ToolRiskLevel): PolicyDecisionRequest["riskCategory"];
