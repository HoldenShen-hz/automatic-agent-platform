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
export type RuleOperator =
  | "eq"      // equals
  | "neq"     // not equals
  | "in"      // value in array
  | "nin"     // value not in array
  | "gt"      // greater than
  | "gte"     // greater than or equal
  | "lt"      // less than
  | "lte"     // less than or equal
  | "contains"; // string contains

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
export const DEFAULT_APPROVAL_POLICY_BUNDLE: ApprovalPolicyBundle = {
  bundleId: "default-approval-policies",
  version: "1.0.0",
  name: "Default Approval Policies",
  description: "Default approval policies based on risk categories",
  enabled: true,
  rules: [
    {
      ruleId: "destructive-high-risk",
      description: "Destructive actions in supervised mode require approval",
      priority: 100,
      enabled: true,
      conditions: [
        { field: "riskCategory", operator: "eq", value: "destructive" },
        { field: "mode", operator: "eq", value: "supervised" },
      ],
      conditionLogic: "and",
      action: "require_approval",
      timeoutPolicy: "reject",
      tags: ["risk", "destructive"],
    },
    {
      ruleId: "prod-affecting-approval",
      description: "Production-affecting actions always require approval",
      priority: 90,
      enabled: true,
      conditions: [
        { field: "riskCategory", operator: "eq", value: "prod_affecting" },
      ],
      conditionLogic: "and",
      action: "require_approval",
      timeoutPolicy: "reject",
      tags: ["risk", "production"],
    },
    {
      ruleId: "org-change-approval",
      description: "Organization-changing actions require approval",
      priority: 95,
      enabled: true,
      conditions: [
        { field: "riskCategory", operator: "eq", value: "org_changing" },
      ],
      conditionLogic: "and",
      action: "require_approval",
      timeoutPolicy: "reject",
      tags: ["risk", "org"],
    },
    {
      ruleId: "high-cost-approval",
      description: "High-cost actions (>=$100) require approval",
      priority: 80,
      enabled: true,
      conditions: [
        { field: "estimatedCostUsd", operator: "gte", value: 100 },
      ],
      conditionLogic: "and",
      action: "require_approval",
      timeoutPolicy: "approve",
      tags: ["cost"],
    },
    {
      ruleId: "critical-action-deny",
      description: "Critical destructive actions are denied in auto mode",
      priority: 200,
      enabled: true,
      conditions: [
        { field: "riskCategory", operator: "eq", value: "destructive" },
        { field: "action", operator: "in", value: ["exec_command", "write_file"] },
        { field: "mode", operator: "eq", value: "auto" },
      ],
      conditionLogic: "and",
      action: "deny",
      tags: ["risk", "critical"],
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
