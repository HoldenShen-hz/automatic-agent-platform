import { ValidationError } from "../../contracts/errors.js";
import { nowIso } from "../../contracts/types/ids.js";
import {
  normalizeUnifiedRuntimeMode,
  type DocumentedUnifiedRuntimeMode,
  type UnifiedRuntimeMode,
} from "../../contracts/types/unified-runtime-mode.js";

export type PolicySubjectType = "user" | "agent" | "system";

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
  | "auto"
  | "full-auto"
  | "read-only"
  | "incident-mode"
  | "maintenance"
  | "degraded"
  | "emergency";
export type OapeflirStage = "observe" | "assess" | "plan" | "execute" | "feedback" | "learn" | "improve" | "release";
export type PolicyDecision = "allow" | "deny" | "allow_with_constraints" | "escalate_for_approval";

export interface PolicyDecisionRequest {
  decisionId: string;
  taskId: string;
  executionId?: string | null;
  sessionId?: string | null;
  subjectType: PolicySubjectType;
  subjectId: string;
  action: PolicyAction;
  resourceRef?: string | null;
  riskCategory: PolicyRiskCategory;
  mode: PolicyMode;
  stage: OapeflirStage;
  estimatedCostUsd?: number;
  metadata?: Record<string, unknown>;
}

export interface PolicyDecisionResult {
  decision: PolicyDecision;
  reasonCode: string;
  requiresApproval: boolean;
  enforcedConstraints: Record<string, unknown>;
  killSwitchApplied: boolean;
  auditPayload: Record<string, unknown>;
  evaluatedPolicyVersion: string;
  decisionTtlMs: number | null;
  matchedRuleRefs: string[];
  explainSummary: string;
}

export interface PolicyCenterOptions {
  policyVersion?: string;
  killSwitchEnabled?: boolean;
  frozenActions?: PolicyAction[];
  allowedActionsByRole?: Record<string, PolicyAction[]>;
  subjectRoles?: Record<string, string[]>;
  maxEstimatedCostUsd?: number;
  budgetWarningCostUsd?: number;
  allowedPathPrefixes?: string[];
  allowedNetworkHosts?: string[];
  enabledGovernanceActions?: PolicyAction[];
  approvalRequiredRiskCategories?: PolicyRiskCategory[];
}

const MUTATING_ACTIONS: readonly PolicyAction[] = [
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

export class PolicyCenterService {
  private readonly options: Required<Omit<PolicyCenterOptions, "maxEstimatedCostUsd" | "budgetWarningCostUsd">> & {
    maxEstimatedCostUsd: number | null;
    budgetWarningCostUsd: number | null;
  };

  public constructor(options: PolicyCenterOptions = {}) {
    this.options = {
      policyVersion: options.policyVersion ?? "policy-center.authoritative.v1",
      killSwitchEnabled: options.killSwitchEnabled ?? false,
      frozenActions: options.frozenActions ?? [],
      allowedActionsByRole: options.allowedActionsByRole ?? {},
      subjectRoles: options.subjectRoles ?? {},
      maxEstimatedCostUsd: options.maxEstimatedCostUsd ?? null,
      budgetWarningCostUsd: options.budgetWarningCostUsd ?? null,
      allowedPathPrefixes: options.allowedPathPrefixes ?? [],
      allowedNetworkHosts: options.allowedNetworkHosts ?? [],
      enabledGovernanceActions: options.enabledGovernanceActions ?? [
        "dispatch_execution",
        "set_isolation_level",
        "promote_improvement",
        "advance_rollout",
      ],
      approvalRequiredRiskCategories: options.approvalRequiredRiskCategories ?? [
        "destructive",
        "irreversible",
        "prod_affecting",
        "org_changing",
        "strategy_affecting",
        "governance_sensitive",
      ],
    };
  }

  public evaluate(input: PolicyDecisionRequest): PolicyDecisionResult {
    validateRequest(input);
    const auditPayload = buildAuditPayload(input);

    if (this.options.killSwitchEnabled) {
      return this.result(input, "deny", "policy.kill_switch_active", false, {}, true, ["kill_switch"], "Kill switch is active.", auditPayload);
    }
    if (this.options.frozenActions.includes(input.action)) {
      return this.result(input, "deny", "policy.action_frozen", false, {}, false, ["freeze.action"], "Action is frozen by policy.", auditPayload);
    }
    if (!this.isActionAllowedByRole(input)) {
      return this.result(input, "deny", "policy.role_action_denied", false, {}, false, ["role_permission"], "Subject role does not allow this action.", auditPayload);
    }
    if (isGovernanceAction(input.action) && !this.options.enabledGovernanceActions.includes(input.action)) {
      return this.result(input, "deny", "policy.governance_plane_disabled", false, {}, false, ["governance_action"], "Governance action is not enabled.", auditPayload);
    }

    const constraints = this.evaluateConstraints(input);
    if (constraints.denyReason != null) {
      return this.result(input, "deny", constraints.denyReason, false, constraints.constraints, false, constraints.matchedRuleRefs, constraints.explainSummary, auditPayload);
    }
    if (this.mustEscalate(input, constraints.requiresApproval)) {
      return this.result(input, "escalate_for_approval", "policy.approval_required", true, constraints.constraints, false, constraints.matchedRuleRefs, "Action requires approval before execution.", auditPayload);
    }
    if (Object.keys(constraints.constraints).length > 0) {
      return this.result(input, "allow_with_constraints", "policy.allow_with_constraints", false, constraints.constraints, false, constraints.matchedRuleRefs, "Action allowed with authoritative constraints.", auditPayload);
    }
    return this.result(input, "allow", "policy.allow", false, {}, false, ["default_allow"], "Action allowed by policy center.", auditPayload);
  }

  public static toUnifiedRuntimeMode(mode: PolicyMode): UnifiedRuntimeMode {
    return normalizePolicyCenterMode(mode);
  }

  private isActionAllowedByRole(input: PolicyDecisionRequest): boolean {
    const roles = this.options.subjectRoles[input.subjectId] ?? [];
    const rolePolicyEntries = Object.entries(this.options.allowedActionsByRole);
    if (rolePolicyEntries.length === 0) {
      return true;
    }
    return roles.some((role) => this.options.allowedActionsByRole[role]?.includes(input.action) === true);
  }

  private evaluateConstraints(input: PolicyDecisionRequest): {
    constraints: Record<string, unknown>;
    denyReason: string | null;
    requiresApproval: boolean;
    matchedRuleRefs: string[];
    explainSummary: string;
  } {
    const constraints: Record<string, unknown> = {};
    const matchedRuleRefs: string[] = [];
    const modePolicy = this.evaluateModePolicy(input);
    if (modePolicy.denyReason != null) {
      return modePolicy;
    }
    Object.assign(constraints, modePolicy.constraints);
    matchedRuleRefs.push(...modePolicy.matchedRuleRefs);
    const estimatedCostUsd = input.estimatedCostUsd ?? 0;
    if (this.options.maxEstimatedCostUsd != null && estimatedCostUsd > this.options.maxEstimatedCostUsd) {
      return {
        constraints: { maxEstimatedCostUsd: this.options.maxEstimatedCostUsd, requestedCostUsd: estimatedCostUsd },
        denyReason: "policy.budget_exceeded",
        requiresApproval: false,
        matchedRuleRefs: ["budget.max_estimated_cost"],
        explainSummary: "Estimated cost exceeds the configured maximum.",
      };
    }
    let requiresApproval = false;
    if (this.options.budgetWarningCostUsd != null && estimatedCostUsd > this.options.budgetWarningCostUsd) {
      constraints.budgetWarningCostUsd = this.options.budgetWarningCostUsd;
      matchedRuleRefs.push("budget.warning_threshold");
      requiresApproval = true;
    }
    if (input.action === "write_file" && this.options.allowedPathPrefixes.length > 0) {
      const resourceRef = input.resourceRef ?? "";
      if (!this.options.allowedPathPrefixes.some((prefix) => resourceRef.startsWith(prefix))) {
        return {
          constraints: { allowedPathPrefixes: this.options.allowedPathPrefixes },
          denyReason: "policy.path_scope_denied",
          requiresApproval: false,
          matchedRuleRefs: ["sandbox.path_scope"],
          explainSummary: "Resource path is outside the allowed path scope.",
        };
      }
      constraints.allowedPathPrefixes = this.options.allowedPathPrefixes;
      matchedRuleRefs.push("sandbox.path_scope");
    }
    if (input.action === "network_access" && this.options.allowedNetworkHosts.length > 0) {
      const host = parseHost(input.resourceRef);
      if (host == null || !this.options.allowedNetworkHosts.includes(host)) {
        return {
          constraints: { allowedNetworkHosts: this.options.allowedNetworkHosts },
          denyReason: "policy.network_scope_denied",
          requiresApproval: false,
          matchedRuleRefs: ["sandbox.network_scope"],
          explainSummary: "Network host is outside the allowed network scope.",
        };
      }
      constraints.allowedNetworkHosts = this.options.allowedNetworkHosts;
      matchedRuleRefs.push("sandbox.network_scope");
    }
    return {
      constraints,
      denyReason: null,
      requiresApproval: requiresApproval || modePolicy.requiresApproval,
      matchedRuleRefs: matchedRuleRefs.length === 0 ? ["constraint.none"] : matchedRuleRefs,
      explainSummary: "Constraints evaluated successfully.",
    };
  }

  private evaluateModePolicy(input: PolicyDecisionRequest): {
    constraints: Record<string, unknown>;
    denyReason: string | null;
    requiresApproval: boolean;
    matchedRuleRefs: string[];
    explainSummary: string;
  } {
    if (input.mode === "supervised") {
      return {
        constraints: {},
        denyReason: null,
        requiresApproval: false,
        matchedRuleRefs: [],
        explainSummary: "Supervised mode allows policy-constrained execution without automatic approval escalation.",
      };
    }
    if (input.mode === "maintenance") {
      const blockedActions: readonly PolicyAction[] = ["advance_rollout", "org_change", "install_extension"];
      return {
        constraints: { mode: "no_rollout", maintenanceWindow: true, rolloutAllowed: false },
        denyReason: blockedActions.includes(input.action) ? "policy.maintenance_mode_denied" : null,
        requiresApproval: false,
        matchedRuleRefs: ["mode.maintenance"],
        explainSummary: "Maintenance mode blocks rollout, organization, and extension changes.",
      };
    }
    if (input.mode === "emergency") {
      return {
        constraints: { mode: "no_write", breakGlass: true, operatorAckRequired: true },
        denyReason: null,
        requiresApproval: input.subjectType !== "system",
        matchedRuleRefs: ["mode.emergency"],
        explainSummary: "Emergency mode enables break-glass procedures with operator acknowledgment.",
      };
    }
    if (input.mode === "degraded") {
      return {
        constraints: { mode: "no_external_call", fallbackOnly: true, maxParallelism: 1 },
        denyReason: null,
        requiresApproval: false,
        matchedRuleRefs: ["mode.degraded"],
        explainSummary: "Degraded mode restricts to fallback execution with limited parallelism.",
      };
    }
    const normalizedMode = normalizePolicyCenterMode(input.mode);
    switch (normalizedMode) {
      case "read_only":
        if (MUTATING_ACTIONS.includes(input.action)) {
          return {
            constraints: { mode: normalizedMode, sideEffectsAllowed: false },
            denyReason: "policy.read_only_mode_denied",
            requiresApproval: false,
            matchedRuleRefs: ["mode.read_only"],
            explainSummary: "Read-only mode blocks mutating actions.",
          };
        }
        return {
          constraints: { mode: normalizedMode, sideEffectsAllowed: false },
          denyReason: null,
          requiresApproval: false,
          matchedRuleRefs: ["mode.read_only"],
          explainSummary: "Read-only mode allows only non-mutating actions.",
        };
      case "no_write":
        if (input.action === "write_file" || input.action === "exec_command" || input.action === "install_extension") {
          return {
            constraints: { mode: normalizedMode, writesAllowed: false },
            denyReason: "policy.no_write_mode_denied",
            requiresApproval: false,
            matchedRuleRefs: ["mode.no_write"],
            explainSummary: "No-write mode blocks local mutations.",
          };
        }
        return {
          constraints: { mode: normalizedMode, writesAllowed: false },
          denyReason: null,
          requiresApproval: false,
          matchedRuleRefs: ["mode.no_write"],
          explainSummary: "No-write mode allows read-only and coordination actions.",
        };
      case "no_external_call":
        if (input.action === "network_access" || input.action === "invoke_model") {
          return {
            constraints: { mode: normalizedMode, externalCallsAllowed: false },
            denyReason: "policy.no_external_call_mode_denied",
            requiresApproval: false,
            matchedRuleRefs: ["mode.no_external_call"],
            explainSummary: "No-external-call mode blocks outbound dependencies.",
          };
        }
        return {
          constraints: { mode: normalizedMode, externalCallsAllowed: false },
          denyReason: null,
          requiresApproval: false,
          matchedRuleRefs: ["mode.no_external_call"],
          explainSummary: "No-external-call mode allows local execution only.",
        };
      case "no_rollout":
        if (input.action === "advance_rollout") {
          return {
            constraints: { mode: normalizedMode, rolloutAllowed: false },
            denyReason: "policy.no_rollout_mode_denied",
            requiresApproval: false,
            matchedRuleRefs: ["mode.no_rollout"],
            explainSummary: "No-rollout mode blocks rollout changes.",
          };
        }
        return {
          constraints: { mode: normalizedMode, rolloutAllowed: false },
          denyReason: null,
          requiresApproval: false,
          matchedRuleRefs: ["mode.no_rollout"],
          explainSummary: "No-rollout mode keeps release changes gated.",
        };
      case "maintenance":
        return {
          constraints: { mode: normalizedMode, maintenanceWindow: true, rollbackAllowed: false },
          denyReason: input.action === "advance_rollout" ? "policy.maintenance_mode_denied" : null,
          requiresApproval: false,
          matchedRuleRefs: ["mode.maintenance"],
          explainSummary: "Maintenance mode restricts rollout changes and sets maintenance window.",
        };
      case "degraded":
        return {
          constraints: { mode: normalizedMode, fallbackOnly: true, maxParallelism: 1 },
          denyReason: null,
          requiresApproval: false,
          matchedRuleRefs: ["mode.degraded"],
          explainSummary: "Degraded mode restricts to fallback execution with limited parallelism.",
        };
      case "emergency":
        return {
          constraints: { mode: normalizedMode, breakGlass: true, operatorAckRequired: input.subjectType !== "system" },
          denyReason: null,
          requiresApproval: input.subjectType !== "system",
          matchedRuleRefs: ["mode.emergency"],
          explainSummary: "Emergency mode enables break-glass procedures with operator acknowledgment.",
        };
      case "manual_only":
        return {
          constraints: { mode: normalizedMode, humanExecutionRequired: true },
          denyReason: null,
          requiresApproval: MUTATING_ACTIONS.includes(input.action),
          matchedRuleRefs: ["mode.manual_only"],
          explainSummary: "Manual-only mode routes mutating work through human approval.",
        };
      case "incident_mode":
        return {
          constraints: { mode: normalizedMode, changeFreeze: true, evidenceLevel: "full" },
          denyReason: null,
          requiresApproval: input.riskCategory !== "cost_sensitive",
          matchedRuleRefs: ["mode.incident"],
          explainSummary: "Incident mode freezes change velocity and raises evidence requirements.",
        };
      default:
        return {
          constraints: {},
          denyReason: null,
          requiresApproval: false,
          matchedRuleRefs: [],
          explainSummary: "Standard mode policy applied.",
        };
    }
  }

  private mustEscalate(input: PolicyDecisionRequest, constraintRequiresApproval: boolean): boolean {
    if (input.mode === "emergency") {
      return constraintRequiresApproval;
    }
    const normalizedMode = normalizePolicyCenterMode(input.mode);
    if (normalizedMode === "incident_mode") {
      return constraintRequiresApproval;
    }
    if (normalizedMode === "full_auto" && !["governance_sensitive", "prod_affecting", "org_changing"].includes(input.riskCategory)) {
      return constraintRequiresApproval;
    }
    return constraintRequiresApproval || this.options.approvalRequiredRiskCategories.includes(input.riskCategory);
  }

  private result(
    input: PolicyDecisionRequest,
    decision: PolicyDecision,
    reasonCode: string,
    requiresApproval: boolean,
    enforcedConstraints: Record<string, unknown>,
    killSwitchApplied: boolean,
    matchedRuleRefs: string[],
    explainSummary: string,
    auditPayload: Record<string, unknown>,
  ): PolicyDecisionResult {
    return {
      decision,
      reasonCode,
      requiresApproval,
      enforcedConstraints,
      killSwitchApplied,
      auditPayload,
      evaluatedPolicyVersion: this.options.policyVersion,
      decisionTtlMs: decision === "deny" ? 30_000 : 5_000,
      matchedRuleRefs,
      explainSummary,
    };
  }
}

export function toUnifiedRuntimeMode(mode: PolicyMode): UnifiedRuntimeMode {
  return PolicyCenterService.toUnifiedRuntimeMode(mode);
}

function validateRequest(input: PolicyDecisionRequest): void {
  for (const [field, value] of Object.entries({
    decisionId: input.decisionId,
    taskId: input.taskId,
    subjectId: input.subjectId,
    action: input.action,
    riskCategory: input.riskCategory,
    mode: input.mode,
    stage: input.stage,
  })) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new ValidationError(`policy.${field}_required`, "Policy decision request is missing a required field.", {
        details: { field },
      });
    }
  }
}

function buildAuditPayload(input: PolicyDecisionRequest): Record<string, unknown> {
  const normalizedMode = normalizePolicyCenterMode(input.mode);
  return {
    decisionId: input.decisionId,
    taskId: input.taskId,
    executionId: input.executionId ?? null,
    sessionId: input.sessionId ?? null,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    action: input.action,
    resourceRef: input.resourceRef ?? null,
    riskCategory: input.riskCategory,
    mode: input.mode,
    normalizedMode,
    requestedMode: input.mode,
    stage: input.stage,
    estimatedCostUsd: input.estimatedCostUsd ?? 0,
    evaluatedAt: nowIso(),
  };
}

function isGovernanceAction(action: PolicyAction): boolean {
  return action === "promote_improvement"
    || action === "advance_rollout"
    || action === "modify_knowledge_trust"
    || action === "promote_memory_layer";
}

function parseHost(resourceRef: string | null | undefined): string | null {
  if (resourceRef == null || resourceRef.trim().length === 0) {
    return null;
  }
  try {
    return new URL(resourceRef).host;
  } catch {
    return resourceRef;
  }
}

function normalizePolicyCenterMode(mode: PolicyMode): UnifiedRuntimeMode {
  switch (mode) {
    case "supervised":
      return "manual_only";
    case "auto":
      return "supervised_auto";
    case "full-auto":
      return "full_auto";
    case "read-only":
      return "read_only";
    case "incident-mode":
      return "incident_mode";
    case "maintenance":
      return "no_rollout";
    case "degraded":
      return "no_external_call";
    case "emergency":
      return "no_write";
    default:
      return normalizeUnifiedRuntimeMode(mode as UnifiedRuntimeMode | DocumentedUnifiedRuntimeMode);
  }
}
