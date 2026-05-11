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
import { ValidationError } from "../../contracts/errors.js";
import {
  normalizeUnifiedRuntimeMode,
  type DocumentedUnifiedRuntimeMode,
  type UnifiedRuntimeMode,
} from "../../contracts/types/unified-runtime-mode.js";

export type PolicyAction =
  | "invoke_model"
  | "invoke_tool"
  | "write_file"
  | "exec_command"
  | "network_access"
  | "install_extension"
  | "org_change"
  | "dispatch_execution"
  | "set_isolation_level"
  | "promote_improvement"
  | "advance_rollout"
  | "modify_knowledge_trust"
  | "promote_memory_layer";

export type PolicyRiskCategory =
  | "destructive"
  | "irreversible"
  | "prod_affecting"
  | "cost_sensitive"
  | "org_changing"
  | "sensitive_data"
  | "strategy_affecting"
  | "governance_sensitive";

export type PolicyMode =
  | UnifiedRuntimeMode
  | DocumentedUnifiedRuntimeMode
  | "supervised"
  | "auto";

export type PolicyStageViewRef =
  | "observe"
  | "assess"
  | "plan"
  | "execute"
  | "feedback"
  | "learn"
  | "improve"
  | "release";

export interface PolicyDecisionExplain {
  decisionId: string;
  summary: string;
  factors: readonly string[];
  policyPaths: readonly string[];
  traceRefs?: readonly string[];
  ruleSources?: readonly string[];
  remediationHint?: string;
}

export interface PolicyAuditRecord {
  auditId: string;
  decisionId: string;
  policyBundleId: string;
  policyVersion: string;
  inputSnapshotRef: string;
  decisionSnapshotRef: string;
  evaluatedAt: string;
  latencyMs: number;
}

const MUTATING_POLICY_ACTIONS: readonly PolicyAction[] = [
  "invoke_tool",
  "write_file",
  "exec_command",
  "install_extension",
  "org_change",
  "dispatch_execution",
  "set_isolation_level",
  "promote_improvement",
  "advance_rollout",
  "modify_knowledge_trust",
  "promote_memory_layer",
];

function normalizePolicyMode(mode: PolicyMode): UnifiedRuntimeMode {
  switch (mode) {
    case "supervised":
      return "manual_only";
    case "auto":
      return "supervised_auto";
    default:
      return normalizeUnifiedRuntimeMode(mode as UnifiedRuntimeMode | DocumentedUnifiedRuntimeMode);
  }
}

/** Map of actions to required roles for execution */
const ACTION_REQUIRED_ROLES: Record<PolicyAction, readonly string[]> = {
  invoke_model: ["model_invoker", "agent"],
  invoke_tool: ["tool_executor", "agent"],
  write_file: ["file_writer", "agent"],
  exec_command: ["command_executor", "agent"],
  network_access: ["network_access", "agent"],
  install_extension: ["extension_manager", "admin"],
  org_change: ["org_admin", "admin"],
  dispatch_execution: ["execution_dispatcher", "agent"],
  set_isolation_level: ["isolation_manager", "admin"],
  promote_improvement: ["promotion_manager", "agent"],
  advance_rollout: ["rollout_manager", "admin"],
  modify_knowledge_trust: ["knowledge_manager", "agent"],
  promote_memory_layer: ["memory_manager", "agent"],
};

/** Map of actions to required capabilities */
const ACTION_REQUIRED_CAPABILITIES: Record<PolicyAction, readonly string[]> = {
  invoke_model: ["model.call"],
  invoke_tool: ["tool.execute"],
  write_file: ["file.write"],
  exec_command: ["command.execute", "command.execute.shell"],
  network_access: ["network.call"],
  install_extension: ["extension.install"],
  org_change: ["org.change"],
  dispatch_execution: ["execution.dispatch"],
  set_isolation_level: ["isolation.set"],
  promote_improvement: ["improvement.promote"],
  advance_rollout: ["rollout.advance"],
  modify_knowledge_trust: ["knowledge.trust.modify"],
  promote_memory_layer: ["memory.layer.promote"],
};

/**
 * Validates that the subject has required roles and capabilities for the action.
 * Throws ValidationError if the subject lacks required permissions.
 */
function validateSubjectPermissions(input: PolicyDecisionRequest): void {
  const requiredRoles = ACTION_REQUIRED_ROLES[input.action] ?? [];
  const requiredCapabilities = ACTION_REQUIRED_CAPABILITIES[input.action] ?? [];
  const subjectRoles = input.subjectRoles ?? [];
  const subjectCapabilities = input.subjectCapabilities ?? [];

  const missingRoles = requiredRoles.filter((role) => !subjectRoles.includes(role));
  if (missingRoles.length > 0 && requiredRoles.length > 0) {
    throw new ValidationError(
      "policy.subject_missing_roles",
      `Subject lacks required roles for action '${input.action}': [${missingRoles.join(", ")}]`,
      {
        details: {
          subjectId: input.subjectId,
          subjectType: input.subjectType,
          action: input.action,
          missingRoles,
          requiredRoles,
        },
      },
    );
  }

  const missingCapabilities = requiredCapabilities.filter((cap) => !subjectCapabilities.includes(cap));
  if (missingCapabilities.length > 0 && requiredCapabilities.length > 0) {
    throw new ValidationError(
      "policy.subject_missing_capabilities",
      `Subject lacks required capabilities for action '${input.action}': [${missingCapabilities.join(", ")}]`,
      {
        details: {
          subjectId: input.subjectId,
          subjectType: input.subjectType,
          action: input.action,
          missingCapabilities,
          requiredCapabilities,
        },
      },
    );
  }
}

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
  harnessRunId?: string;
  nodeRunId?: string;
  attemptId?: string;

  /** Optional session context */
  sessionId?: string;

  /** Type of subject making the request */
  subjectType: "user" | "agent" | "system";

  /** ID of the subject making the request */
  subjectId: string;

  /** Roles assigned to the subject */
  subjectRoles?: readonly string[];

  /** Capabilities the subject possesses */
  subjectCapabilities?: readonly string[];

  /** Action being requested */
  action: PolicyAction;

  /** Optional reference to the resource being accessed */
  resourceRef?: string;

  /** Risk category of the action */
  riskCategory: PolicyRiskCategory;

  /** Execution mode */
  mode: PolicyMode;

  /** Optional OAPEFLIR stage view context */
  stageViewRef?: PolicyStageViewRef;

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

  /** Recommended result cache lifetime */
  decisionTtlMs: number | null;

  /** Contract-facing rule references matched during evaluation */
  matchedRuleRefs: string[];

  /** Human-readable summary */
  explainSummary: string;

  /** Structured explanation for downstream UIs and audits */
  explain?: PolicyDecisionExplain;

  /** Canonical audit record snapshot for the evaluation */
  auditRecord?: PolicyAuditRecord;
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
  matchedRuleRefs: readonly string[];
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
      id: result.auditRecord?.auditId ?? `audit_policy_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: result.auditRecord?.evaluatedAt ?? new Date().toISOString(),
      decisionId: input.decisionId,
      taskId: input.taskId,
      subjectId: input.subjectId,
      action: input.action,
      riskCategory: input.riskCategory,
      mode: normalizePolicyMode(input.mode),
      decision: result.decision,
      reasonCode: result.reasonCode,
      killSwitchApplied: result.killSwitchApplied,
      estimatedCostUsd: input.estimatedCostUsd ?? 0,
      matchedRuleRefs: result.matchedRuleRefs,
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
    // V-02: Validate subject has required roles and capabilities for the action
    validateSubjectPermissions(input);
    const normalizedMode = normalizePolicyMode(input.mode);
    const modeConstraints = this.evaluateModeConstraints(normalizedMode, input);
    if (modeConstraints != null) {
      this.emitAuditEvent(modeConstraints, input);
      return modeConstraints;
    }

    // R12-13: §10.1 requires deny-by-default - high-risk actions are always denied
    // regardless of execution mode. full-auto mode does not bypass this requirement.
    const isHighRisk =
      input.riskCategory === "destructive" ||
      input.riskCategory === "irreversible" ||
      input.riskCategory === "prod_affecting";

    if (isHighRisk) {
      const result = this.buildDecisionResult(
        input,
        normalizedMode,
        "deny",
        "policy.high_risk_deny_by_default",
        false,
        {},
        false,
        ["risk.hard_deny"],
        "Action denied: high-risk actions are denied by default per §10.1 policy.",
        ["risk_category", "runtime_mode"],
      );
      this.emitAuditEvent(result, input);
      return result;
    }

    // Step 1: Kill switch check
    if (this.options.killSwitchEnabled) {
      const result = this.buildDecisionResult(
        input,
        normalizedMode,
        "deny",
        "policy.kill_switch_active",
        false,
        {},
        true,
        ["guard.kill_switch"],
        "Action denied because kill switch is active.",
        ["kill_switch"],
      );
      this.emitAuditEvent(result, input);
      return result;
    }

    // Step 2: Budget check
    const budget = this.evaluateBudget(input);
    if (!budget.allowed) {
      const result = this.buildDecisionResult(
        input,
        normalizedMode,
        "deny",
        budget.reasonCode ?? "budget.denied",
        false,
        {
          remainingBudgetUsd: budget.remainingBudgetUsd,
        },
        false,
        ["budget.denied"],
        "Action denied because task budget would be exceeded.",
        ["budget"],
      );
      this.emitAuditEvent(result, input);
      return result;
    }

    // Step 3: Risk-based escalation
    const requiresEscalation =
      input.riskCategory === "destructive" ||
      input.riskCategory === "irreversible" ||
      input.riskCategory === "prod_affecting" ||
      input.riskCategory === "org_changing" ||
      input.riskCategory === "strategy_affecting" ||
      input.riskCategory === "governance_sensitive";

    // Manual and degraded modes do not auto-execute mutating actions.
    if (
      (normalizedMode === "manual_only" || normalizedMode === "incident_mode")
      && (requiresEscalation || budget.requiresApproval || MUTATING_POLICY_ACTIONS.includes(input.action))
    ) {
      return this.escalate(input, budget, "policy.supervised_escalation");
    }

    // Canonical supervised_auto preserves the previous auto-mode escalation semantics.
    if (normalizedMode === "supervised_auto" && requiresEscalation) {
      return this.escalate(input, budget, "policy.high_risk_requires_approval");
    }

    // Default: allow with constraints
    const result = this.buildDecisionResult(
      input,
      normalizedMode,
      "allow_with_constraints",
      budget.requiresApproval ? "policy.allow_under_budget_warning" : "policy.allow",
      false,
      {
        remainingBudgetUsd: budget.remainingBudgetUsd,
      },
      false,
      budget.requiresApproval ? ["budget.warning"] : ["default_allow"],
      "Action allowed under current mode and budget constraints.",
      ["budget", "runtime_mode"],
    );
    this.emitAuditEvent(result, input);
    return result;
  }

  private evaluateModeConstraints(mode: UnifiedRuntimeMode, input: PolicyDecisionRequest): PolicyDecisionResult | null {
    if (mode === "read_only" && MUTATING_POLICY_ACTIONS.includes(input.action)) {
      return this.buildDecisionResult(
        input,
        mode,
        "deny",
        "policy.read_only_mode_denied",
        false,
        { mode, sideEffectsAllowed: false },
        false,
        ["mode.read_only"],
        "Action denied because read-only mode blocks mutating actions.",
        ["runtime_mode", "action"],
      );
    }
    if (mode === "no_write" && ["write_file", "exec_command", "install_extension"].includes(input.action)) {
      return this.buildDecisionResult(
        input,
        mode,
        "deny",
        "policy.no_write_mode_denied",
        false,
        { mode, writesAllowed: false },
        false,
        ["mode.no_write"],
        "Action denied because no-write mode blocks local mutations.",
        ["runtime_mode", "action"],
      );
    }
    if (mode === "no_external_call" && (input.action === "network_access" || input.action === "invoke_model")) {
      return this.buildDecisionResult(
        input,
        mode,
        "deny",
        "policy.no_external_call_mode_denied",
        false,
        { mode, externalCallsAllowed: false },
        false,
        ["mode.no_external_call"],
        "Action denied because no-external-call mode blocks outbound dependencies.",
        ["runtime_mode", "action"],
      );
    }
    if (mode === "no_rollout" && input.action === "advance_rollout") {
      return this.buildDecisionResult(
        input,
        mode,
        "deny",
        "policy.no_rollout_mode_denied",
        false,
        { mode, rolloutAllowed: false },
        false,
        ["mode.no_rollout"],
        "Action denied because no-rollout mode blocks rollout changes.",
        ["runtime_mode", "action"],
      );
    }
    return null;
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
    const result = this.buildDecisionResult(
      input,
      normalizePolicyMode(input.mode),
      "escalate_for_approval",
      reasonCode,
      true,
      {
        remainingBudgetUsd: budget.remainingBudgetUsd,
      },
      false,
      ["approval.required"],
      "Action requires approval under current risk or budget policy.",
      ["risk_category", "budget", "runtime_mode"],
      "Reduce risk or re-run under a stricter approved mode.",
    );
    this.emitAuditEvent(result, input);
    return result;
  }

  private buildDecisionResult(
    input: PolicyDecisionRequest,
    normalizedMode: UnifiedRuntimeMode,
    decision: PolicyDecisionResult["decision"],
    reasonCode: string,
    requiresApproval: boolean,
    enforcedConstraints: Record<string, unknown>,
    killSwitchApplied: boolean,
    matchedRuleRefs: string[],
    explainSummary: string,
    factors: readonly string[],
    remediationHint?: string,
  ): PolicyDecisionResult {
    const evaluatedAt = new Date().toISOString();
    const policyVersion = "authoritative.v1";
    return {
      decision,
      reasonCode,
      requiresApproval,
      enforcedConstraints,
      killSwitchApplied,
      auditPayload: {
        action: input.action,
        riskCategory: input.riskCategory,
        estimatedCostUsd: input.estimatedCostUsd ?? 0,
        mode: normalizedMode,
        harnessRunId: input.harnessRunId ?? null,
        nodeRunId: input.nodeRunId ?? null,
        attemptId: input.attemptId ?? null,
        stageViewRef: input.stageViewRef ?? null,
      },
      evaluatedPolicyVersion: policyVersion,
      decisionTtlMs: decision === "deny" ? 30_000 : decision === "escalate_for_approval" ? 15_000 : 5_000,
      matchedRuleRefs,
      explainSummary,
      explain: {
        decisionId: input.decisionId,
        summary: explainSummary,
        factors,
        policyPaths: matchedRuleRefs,
        ruleSources: matchedRuleRefs,
        remediationHint,
      },
      auditRecord: {
        auditId: `audit_policy_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        decisionId: input.decisionId,
        policyBundleId: "policy_engine",
        policyVersion,
        inputSnapshotRef: `policy-input:${input.decisionId}`,
        decisionSnapshotRef: `policy-decision:${input.decisionId}`,
        evaluatedAt,
        latencyMs: 0,
      },
    };
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
