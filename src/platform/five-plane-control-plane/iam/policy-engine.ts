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
import { BudgetGuard, type BudgetPolicy, type BudgetGuardResult } from "../../model-gateway/cost-tracker/budget-guard.js";
import { PolicyDeniedError, ValidationError } from "../../contracts/errors.js";

/**
 * Validates PolicyDecisionRequest input fields.
 * V-01: Critical API endpoints must validate input to prevent malformed data.
 */
function validatePolicyRequest(input: PolicyDecisionRequest): void {
  if (!input.decisionId || typeof input.decisionId !== "string" || input.decisionId.trim().length === 0) {
    throw new ValidationError("policy.invalid_decision_id", "Policy decision request must have a non-empty decisionId", {
      details: { decisionId: input.decisionId },
    });
  }
  if (!input.taskId || typeof input.taskId !== "string" || input.taskId.trim().length === 0) {
    throw new ValidationError("policy.invalid_task_id", "Policy decision request must have a non-empty taskId", {
      details: { taskId: input.taskId },
    });
  }
  if (!input.subjectId || typeof input.subjectId !== "string" || input.subjectId.trim().length === 0) {
    throw new ValidationError("policy.invalid_subject_id", "Policy decision request must have a non-empty subjectId", {
      details: { subjectId: input.subjectId },
    });
  }
  if (!input.action || typeof input.action !== "string") {
    throw new ValidationError("policy.invalid_action", "Policy decision request must have a valid action", {
      details: { action: input.action },
    });
  }
  if (!input.riskCategory || typeof input.riskCategory !== "string") {
    throw new ValidationError("policy.invalid_risk_category", "Policy decision request must have a valid risk category", {
      details: { riskCategory: input.riskCategory },
    });
  }
  if (!input.mode || typeof input.mode !== "string") {
    throw new ValidationError("policy.invalid_mode", "Policy decision request must have a valid mode", {
      details: { mode: input.mode },
    });
  }
}

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
  action:
    | "invoke_model"
    | "invoke_tool"
    | "write_file"
    | "exec_command"
    | "network_access"
    | "install_extension"
    | "org_change";

  /** Optional reference to the resource being accessed */
  resourceRef?: string;

  /** Risk category of the action */
  riskCategory:
    | "destructive"
    | "irreversible"
    | "prod_affecting"
    | "cost_sensitive"
    | "org_changing"
    | "sensitive_data";

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

  /** R12-17: Optional audit service to emit policy evaluation events */
  auditService?: PolicyAuditService;
}

/**
 * R12-17: Policy audit event for tracking policy decisions.
 * Emitted whenever evaluate() makes a decision.
 */
export interface PolicyAuditEvent {
  id: string;
  timestamp: string;
  decisionId: string;
  taskId: string;
  subjectId: string;
  action: string;
  riskCategory: string;
  mode: string;
  decision: string;
  reasonCode: string;
  killSwitchApplied: boolean;
  estimatedCostUsd: number;
}

/**
 * R12-17: Service interface for policy audit events.
 * Implementations should persist these events for compliance auditing.
 */
export interface PolicyAuditService {
  recordPolicyDecision(event: PolicyAuditEvent): void;
}

/**
 * Policy Engine
 *
 * Evaluates actions against security and budget policies.
 */
export class PolicyEngine {
  private readonly budgetGuard = new BudgetGuard();

  public constructor(private readonly options: PolicyEngineOptions) {}

  /**
   * R12-17: Emits an audit event for a policy decision.
   * Calls the configured audit service if present.
   */
  private emitAuditEvent(result: PolicyDecisionResult, input: PolicyDecisionRequest): void {
    const auditService = this.options.auditService;
    if (!auditService) return;

    const event: PolicyAuditEvent = {
      id: `audit_policy_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      decisionId: input.decisionId,
      taskId: input.taskId,
      subjectId: input.subjectId,
      action: input.action,
      riskCategory: input.riskCategory,
      mode: input.mode,
      decision: result.decision,
      reasonCode: result.reasonCode,
      killSwitchApplied: result.killSwitchApplied,
      estimatedCostUsd: input.estimatedCostUsd ?? 0,
    };
    auditService.recordPolicyDecision(event);
  }

  /**
   * Evaluates a policy decision request.
   * This is the main entry point for policy evaluation.
   *
   * The evaluation order is:
   * 1. Input validation
   * 2. Deny-by-default for high-risk actions regardless of mode
   * 3. Kill switch check
   * 4. Budget check
   * 5. Risk-based escalation
   *
   * @param input - The policy decision request
   * @returns The policy decision result
   */
  public evaluate(input: PolicyDecisionRequest): PolicyDecisionResult {
    // V-01: Validate input before processing
    validatePolicyRequest(input);

    // R12-13: §10.1 requires deny-by-default - high-risk actions are always denied
    // regardless of execution mode. full-auto mode does not bypass this requirement.
    const isHighRisk =
      input.riskCategory === "destructive" ||
      input.riskCategory === "irreversible" ||
      input.riskCategory === "prod_affecting";

    if (isHighRisk) {
      const result: PolicyDecisionResult = {
        decision: "deny",
        reasonCode: "policy.high_risk_deny_by_default",
        requiresApproval: false,
        enforcedConstraints: {},
        killSwitchApplied: false,
        auditPayload: {
          action: input.action,
          riskCategory: input.riskCategory,
          estimatedCostUsd: input.estimatedCostUsd ?? 0,
          mode: input.mode,
        },
        evaluatedPolicyVersion: "authoritative.v1",
        explainSummary: "Action denied: high-risk actions are denied by default per §10.1 policy.",
      };
      this.emitAuditEvent(result, input);
      return result;
    }

    // Step 1: Kill switch check
    if (this.options.killSwitchEnabled) {
      const result: PolicyDecisionResult = {
        decision: "deny",
        reasonCode: "policy.kill_switch_active",
        requiresApproval: false,
        enforcedConstraints: {},
        killSwitchApplied: true,
        auditPayload: { action: input.action, subjectId: input.subjectId },
        evaluatedPolicyVersion: "authoritative.v1",
        explainSummary: "Action denied because kill switch is active.",
      };
      this.emitAuditEvent(result, input);
      return result;
    }

    // Step 2: Budget check
    const budget = this.evaluateBudget(input);
    if (!budget.allowed) {
      const result: PolicyDecisionResult = {
        decision: "deny",
        reasonCode: budget.reasonCode ?? "budget.denied",
        requiresApproval: false,
        enforcedConstraints: {
          remainingBudgetUsd: budget.remainingBudgetUsd,
        },
        killSwitchApplied: false,
        auditPayload: { action: input.action, estimatedCostUsd: input.estimatedCostUsd ?? 0 },
        evaluatedPolicyVersion: "authoritative.v1",
        explainSummary: "Action denied because task budget would be exceeded.",
      };
      this.emitAuditEvent(result, input);
      return result;
    }

    // Step 3: Risk-based escalation
    const requiresEscalation =
      input.riskCategory === "destructive" ||
      input.riskCategory === "irreversible" ||
      input.riskCategory === "prod_affecting" ||
      input.riskCategory === "org_changing";

    // In supervised mode, high-risk or budget-warning actions escalate
    if (input.mode === "supervised" && (requiresEscalation || budget.requiresApproval)) {
      return this.escalate(input, budget, "policy.supervised_escalation");
    }

    // In auto mode, high-risk actions require approval
    if (input.mode === "auto" && requiresEscalation) {
      return this.escalate(input, budget, "policy.high_risk_requires_approval");
    }

    // Default: allow with constraints
    const result: PolicyDecisionResult = {
      decision: "allow_with_constraints",
      reasonCode: budget.requiresApproval ? "policy.allow_under_budget_warning" : "policy.allow",
      requiresApproval: false,
      enforcedConstraints: {
        remainingBudgetUsd: budget.remainingBudgetUsd,
      },
      killSwitchApplied: false,
      auditPayload: {
        action: input.action,
        riskCategory: input.riskCategory,
        estimatedCostUsd: input.estimatedCostUsd ?? 0,
      },
      evaluatedPolicyVersion: "authoritative.v1",
      explainSummary: "Action allowed under current mode and budget constraints.",
    };
    this.emitAuditEvent(result, input);
    return result;
  }

  /**
   * Evaluates budget constraints for the action.
   */
  private evaluateBudget(input: PolicyDecisionRequest): BudgetGuardResult {
    return this.budgetGuard.evaluateTaskSpend({
      policy: this.options.budgetPolicy,
      currentTaskCostUsd: Number(input.metadata?.currentTaskCostUsd ?? 0),
      nextEstimatedCostUsd: input.estimatedCostUsd ?? 0,
    });
  }

  /**
   * R12-17: Creates an escalation decision for actions requiring approval.
   */
  private escalate(
    input: PolicyDecisionRequest,
    budget: BudgetGuardResult,
    reasonCode: string,
  ): PolicyDecisionResult {
    const result: PolicyDecisionResult = {
      decision: "escalate_for_approval",
      reasonCode,
      requiresApproval: true,
      enforcedConstraints: {
        remainingBudgetUsd: budget.remainingBudgetUsd,
      },
      killSwitchApplied: false,
      auditPayload: {
        action: input.action,
        riskCategory: input.riskCategory,
        estimatedCostUsd: input.estimatedCostUsd ?? 0,
      },
      evaluatedPolicyVersion: "authoritative.v1",
      explainSummary: "Action requires approval under current risk or budget policy.",
    };
    this.emitAuditEvent(result, input);
    return result;
  }
}

/**
 * Maps tool risk levels to policy risk categories.
 *
 * @param risk - The tool risk level
 * @returns The corresponding policy risk category
 */
export function mapToolRiskToPolicyCategory(risk: ToolRiskLevel): PolicyDecisionRequest["riskCategory"] {
  switch (risk) {
    case "critical":
      return "prod_affecting";
    case "high":
      return "destructive";
    case "medium":
      return "cost_sensitive";
    default:
      return "sensitive_data";
  }
}
