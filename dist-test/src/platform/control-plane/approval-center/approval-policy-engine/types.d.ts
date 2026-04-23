/**
 * Declarative Approval Policy Types
 *
 * Defines a JSON-based rule format for approval policies that can be
 * versioned and managed through an approval workflow.
 *
 * ## Rule Format
 *
 * Rules are declarative JSON objects that match conditions against
 * policy decision requests and specify approval requirements.
 *
 * ## Version Management
 *
 * Each policy bundle has a version identifier. Changes to policies
 * require going through an approval workflow before becoming active.
 */
import type { PolicyRiskCategory, PolicyMode, PolicyAction } from "../../policy-center/index.js";
/**
 * Condition operator for rule matching.
 */
export type RuleOperator = "eq" | "neq" | "in" | "nin" | "gt" | "gte" | "lt" | "lte" | "contains";
/**
 * A single condition in a rule.
 */
export interface RuleCondition {
    field: string;
    operator: RuleOperator;
    value: unknown;
}
/**
 * Logical operator for combining conditions.
 */
export type RuleConditionLogic = "and" | "or";
/**
 * A rule that matches against policy decision context.
 */
export interface ApprovalPolicyRule {
    /** Unique rule identifier */
    ruleId: string;
    /** Human-readable rule description */
    description: string;
    /** Priority for rule evaluation (higher = evaluated first) */
    priority: number;
    /** Whether this rule is active */
    enabled: boolean;
    /** Conditions that must match for this rule to apply */
    conditions: RuleCondition[];
    /** Logical operator for combining conditions */
    conditionLogic?: RuleConditionLogic;
    /** Action to take when rule matches */
    action: "require_approval" | "deny" | "allow" | "require_multi_party_approval";
    /** Number of required approvals for multi-party approval */
    requiredApprovals?: number;
    /** Groups from which approvers can be selected */
    approverGroups?: string[];
    /** Timeout policy for the approval request */
    timeoutPolicy?: "reject" | "approve" | "remain_pending";
    /** Tags for categorization */
    tags?: string[];
    /** Source of this rule (for audit) */
    source?: string;
}
/**
 * A bundle of approval policy rules with version information.
 */
export interface ApprovalPolicyBundle {
    /** Unique bundle identifier */
    bundleId: string;
    /** Semantic version of the policy bundle */
    version: string;
    /** Human-readable name */
    name: string;
    /** Description of what this policy bundle covers */
    description: string;
    /** Whether this bundle is active */
    enabled: boolean;
    /** The rules in this bundle */
    rules: ApprovalPolicyRule[];
    /** When this bundle was created */
    createdAt: string;
    /** When this bundle was last updated */
    updatedAt: string;
    /** Who approved this bundle */
    approvedBy?: string;
    /** Approval request ID that approved this bundle */
    approvalRequestId?: string;
    /** Tags for categorization */
    tags?: string[];
}
/**
 * A versioned policy bundle with metadata for change tracking.
 */
export interface VersionedPolicyBundle extends ApprovalPolicyBundle {
    /** Previous version that this was derived from */
    previousVersion?: string;
    /** Status of this version */
    status: "draft" | "pending_approval" | "approved" | "active" | "deprecated";
    /** Change summary for this version */
    changeSummary?: string;
}
/**
 * Context for evaluating approval policies.
 * Matches the fields from PolicyDecisionRequest.
 */
export interface ApprovalPolicyContext {
    decisionId: string;
    taskId: string;
    executionId?: string | null;
    sessionId?: string | null;
    subjectType: "user" | "agent" | "system";
    subjectId: string;
    action: PolicyAction;
    resourceRef?: string | null;
    riskCategory: PolicyRiskCategory;
    mode: PolicyMode;
    stage: string;
    estimatedCostUsd?: number;
    metadata?: Record<string, unknown>;
}
/**
 * Result of evaluating approval policies.
 */
export interface ApprovalPolicyResult {
    /** Whether approval is required */
    requiresApproval: boolean;
    /** Whether to deny the action */
    deny: boolean;
    /** Whether multi-party approval is required */
    requireMultiParty: boolean;
    /** Number of required approvals */
    requiredApprovals: number;
    /** Allowed approver groups */
    approverGroups: string[];
    /** Timeout policy for the approval request */
    timeoutPolicy: "reject" | "approve" | "remain_pending";
    /** The bundle version that was evaluated */
    evaluatedBundleVersion: string;
    /** IDs of rules that matched */
    matchedRuleIds: string[];
    /** Machine-readable reason code */
    reasonCode: string;
    /** Human-readable summary */
    explainSummary: string;
}
/**
 * Lint result for policy rules.
 */
export interface PolicyLintResult {
    valid: boolean;
    errors: PolicyLintError[];
    warnings: PolicyLintWarning[];
}
/**
 * Lint error preventing policy activation.
 */
export interface PolicyLintError {
    ruleId?: string;
    code: string;
    message: string;
    field?: string;
}
/**
 * Lint warning that doesn't block activation.
 */
export interface PolicyLintWarning {
    ruleId?: string;
    code: string;
    message: string;
    suggestion?: string;
}
/**
 * Default approval policy bundle.
 */
export declare const DEFAULT_APPROVAL_POLICY_BUNDLE: ApprovalPolicyBundle;
