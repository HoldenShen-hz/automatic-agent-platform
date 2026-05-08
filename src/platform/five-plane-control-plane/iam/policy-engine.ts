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
 * ## Deny-by-Default Invariant (INV-POLICY-001)
 *
 * Tools that are not explicitly mapped in the risk level registry are treated as
 * unknown and denied by default. This ensures:
 * - New/unknown tools cannot silently pass through with "allow_with_constraints"
 * - Operators must explicitly register and approve new tools
 * - Security posture is conservative (fail closed)
 *
 * @see docs_zh/contracts/policy_engine_contract.md
 */

import type { ToolRiskLevel } from "../../execution/tool-executor/tool-metadata.js";
import { BudgetGuard, type BudgetPolicy, type BudgetGuardResult } from "../../model-gateway/cost-tracker/budget-guard.js";
import { PolicyDeniedError, ValidationError } from "../../contracts/errors.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import type { PlatformPrincipalType, PlatformRole } from "./access-model.js";
import { evaluateAuthorizationContext, inferCapabilitiesForAction, roleGrantsCapabilities } from "./access-model.js";

const policyEngineLogger = new StructuredLogger({ retentionLimit: 200 });

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
  subjectType: PlatformPrincipalType;

  /** ID of the subject making the request */
  subjectId: string;

  /** Roles of the subject making the request - used to validate capability grants */
  roles?: readonly PlatformRole[];

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

  /**
   * Name of the tool being invoked (for invoke_tool action).
   * INV-POLICY-001: Used to identify unknown tools for deny-by-default enforcement.
   * If toolName is provided but not in the known risk registry, the tool is denied.
   */
  toolName?: string;

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

  /** §167-1948: Policy version for cache invalidation - bump this when policies change.
   * Root cause: The policy cache had no TTL or version-based invalidation mechanism.
   * A cached policy decision would persist indefinitely even after policy changes.
   * Fix: Use policyVersion to bust the cache when policies are updated.
   */
  policyVersion?: string;
}

/**
 * Audit service interface for policy decision logging.
 * §11.5 requires all authorization decisions produce audit records.
 */
export interface PolicyAuditService {
  /**
   * Records a policy decision to the audit log.
   * @param decision - The policy decision result
   * @param request - The original request that was evaluated
   */
  recordDecision(decision: PolicyDecisionResult, request: PolicyDecisionRequest): void;
}

/**
 * Default no-op audit service for environments where auditing is not required.
 */
export class NoOpPolicyAuditService implements PolicyAuditService {
  public recordDecision(_decision: PolicyDecisionResult, _request: PolicyDecisionRequest): void {
    // No-op: audit recording disabled
  }
}

/**
 * Structured logger-based audit service.
 * Emits policy decisions to the structured logging system.
 */
export class StructuredLoggerPolicyAuditService implements PolicyAuditService {
  private readonly logger: StructuredLogger;

  public constructor(logger?: StructuredLogger) {
    this.logger = logger ?? new StructuredLogger({ retentionLimit: 200 });
  }

  public recordDecision(decision: PolicyDecisionResult, request: PolicyDecisionRequest): void {
    // §11.5: All authorization decisions must produce audit records
    this.logger.log({
      level: decision.decision === "deny" ? "warn" : "info",
      message: "policy_decision",
      data: {
        decisionId: request.decisionId,
        taskId: request.taskId,
        executionId: request.executionId,
        sessionId: request.sessionId,
        subjectType: request.subjectType,
        subjectId: request.subjectId,
        action: request.action,
        riskCategory: request.riskCategory,
        mode: request.mode,
        decision: decision.decision,
        reasonCode: decision.reasonCode,
        requiresApproval: decision.requiresApproval,
        killSwitchApplied: decision.killSwitchApplied,
        estimatedCostUsd: request.estimatedCostUsd,
        evaluatedPolicyVersion: decision.evaluatedPolicyVersion,
        auditPayload: decision.auditPayload,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Token bucket rate limiter for policy evaluation.
 * R12-21: Prevents flooding the PDP with requests.
 */
class PolicyEvaluationRateLimiter {
  private readonly buckets = new Map<string, { tokens: number; lastRefill: number }>();
  private readonly maxTokens: number;
  private readonly refillPeriodMs: number;

  public constructor(maxRequestsPerMinute: number = 1000) {
    this.maxTokens = maxRequestsPerMinute;
    this.refillPeriodMs = 60_000;
  }

  /**
   * Try to consume a token for the given subject.
   * @returns true if allowed, false if rate limited
   */
  public tryConsume(subjectId: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(subjectId);

    if (!bucket) {
      bucket = { tokens: this.maxTokens - 1, lastRefill: now };
      this.buckets.set(subjectId, bucket);
      return true;
    }

    const elapsed = now - bucket.lastRefill;
    if (elapsed >= this.refillPeriodMs) {
      bucket.tokens = this.maxTokens - 1;
      bucket.lastRefill = now;
      return true;
    }

    const tokensToAdd = Math.floor((elapsed / this.refillPeriodMs) * this.maxTokens);
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    if (bucket.tokens <= 0) {
      return false;
    }

    bucket.tokens--;
    return true;
  }
}

// Global rate limiter - 1000 policy evaluations per minute per subject
const POLICY_EVALUATION_RATE_LIMITER = new PolicyEvaluationRateLimiter(1000);

/**
 * Policy Engine
 *
 * Evaluates actions against security and budget policies.
 */
export class PolicyEngine {
  private readonly budgetGuard = new BudgetGuard();
  private readonly auditService: PolicyAuditService;
  // §167-1948: Add policy cache with version-based invalidation.
  // Root cause: Previously policy decisions were cached with no eviction mechanism,
  // so policy changes wouldn't take effect until process restart.
  private readonly policyCache = new Map<string, { result: PolicyDecisionResult; cachedAt: number }>();
  private readonly policyCacheMaxAgeMs = 60_000; // 1 minute TTL

  public constructor(
    private readonly options: PolicyEngineOptions,
    auditService?: PolicyAuditService,
  ) {
    this.auditService = auditService ?? new NoOpPolicyAuditService();
  }

  /**
   * Clears the policy cache, e.g., when policyVersion changes.
   * §167-1948: Call this when policies are updated to bust stale cache entries.
   */
  public clearPolicyCache(): void {
    this.policyCache.clear();
  }

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
  public evaluate(input: PolicyDecisionRequest): PolicyDecisionResult {
    // V-01: Validate input before processing
    validatePolicyRequest(input);

    // R12-21: Rate limit policy evaluation to prevent flooding the PDP
    if (!POLICY_EVALUATION_RATE_LIMITER.tryConsume(input.subjectId)) {
      // Return a denial result due to rate limiting
      const rateLimitResult: PolicyDecisionResult = {
        decision: "deny",
        reasonCode: "policy.rate_limited",
        requiresApproval: false,
        enforcedConstraints: {},
        killSwitchApplied: false,
        auditPayload: { action: input.action, subjectId: input.subjectId, rateLimited: true },
        evaluatedPolicyVersion: this.options.policyVersion ?? "authoritative.v1",
        explainSummary: "Policy evaluation rate limited. Too many requests.",
      };
      this.auditService.recordDecision(rateLimitResult, input);
      return rateLimitResult;
    }

    // §167-1948: Check cache with version-based invalidation
    const cacheKey = `${input.subjectId}:${input.action}:${input.riskCategory}:${input.mode}:${this.options.policyVersion ?? ""}`;
    const cached = this.policyCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.policyCacheMaxAgeMs) {
      return cached.result;
    }

    let result: PolicyDecisionResult;

    // Step 1: Kill switch check
    if (this.options.killSwitchEnabled) {
      result = {
        decision: "deny",
        reasonCode: "policy.kill_switch_active",
        requiresApproval: false,
        enforcedConstraints: {},
        killSwitchApplied: true,
        auditPayload: { action: input.action, subjectId: input.subjectId },
        evaluatedPolicyVersion: "authoritative.v1",
        explainSummary: "Action denied because kill switch is active.",
      };
    } else {
      // §167-1942 SECURITY FIX: Validate subject's roles/capabilities before any allow decision.
      // If roles are provided, verify the subject actually holds the required capabilities.
      // This prevents any subjectType from performing any action regardless of actual privileges.
      if (input.roles && input.roles.length > 0) {
        const requiredCapabilities = inferCapabilitiesForAction(input.action);
        if (!roleGrantsCapabilities(input.roles, requiredCapabilities)) {
          result = {
            decision: "deny",
            reasonCode: "policy.capability_not_granted",
            requiresApproval: false,
            enforcedConstraints: {},
            killSwitchApplied: false,
            auditPayload: { action: input.action, subjectId: input.subjectId, roles: input.roles },
            evaluatedPolicyVersion: "authoritative.v1",
            explainSummary: "Action denied: subject's roles do not grant required capabilities for this action.",
          };
          this.auditService.recordDecision(result, input);
          return result;
        }
      }
      // Step 2: Budget check
      const budget = this.evaluateBudget(input);
      if (!budget.allowed) {
        result = {
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
      } else {
        // Step 3: Risk-based escalation
        const isHighRisk =
          input.riskCategory === "destructive" ||
          input.riskCategory === "irreversible" ||
          input.riskCategory === "prod_affecting" ||
          input.riskCategory === "org_changing";

        // In supervised mode, high-risk or budget-warning actions escalate
        if (input.mode === "supervised" && (isHighRisk || budget.requiresApproval)) {
          result = this.escalate(input, budget, "policy.supervised_escalation");
        } else if (input.mode === "auto" && isHighRisk) {
          // In auto mode, high-risk actions require approval
          result = this.escalate(input, budget, "policy.high_risk_requires_approval");
        } else if (input.mode === "auto" && input.toolName !== undefined && this.getToolRiskLevel(input.toolName) === null) {
          // INV-POLICY-001: Deny-by-default for unknown tools in auto mode.
          // If a toolName is provided but not in our risk registry, it is denied.
          // This prevents unknown/misconfigured tools from silently passing through.
          result = {
            decision: "deny",
            reasonCode: "policy.unknown_tool_denied",
            requiresApproval: false,
            enforcedConstraints: {},
            killSwitchApplied: false,
            auditPayload: { action: input.action, toolName: input.toolName },
            evaluatedPolicyVersion: "authoritative.v1",
            explainSummary: `Tool '${input.toolName}' is not in the allowed tool registry and is denied by default.`,
          };
        } else if (input.mode === "full-auto" && (isHighRisk || budget.requiresApproval)) {
          // SECURITY FIX R12-13: full-auto must still escalate for high-risk categories.
          // Deny-by-default for destructive/irreversible/prod_affecting even in full-auto.
          // Always escalate if the action falls into these high-risk categories.
          const isDenyByDefaultHighRisk =
            input.riskCategory === "destructive" ||
            input.riskCategory === "irreversible" ||
            input.riskCategory === "prod_affecting";

          if (isDenyByDefaultHighRisk) {
            // Deny-by-default: high-risk categories require escalation even in full-auto
            result = this.escalate(input, budget, "policy.full_auto_high_risk_escalation");
          } else {
            result = this.escalate(input, budget, "policy.full_auto_escalation");
          }
        } else {
          // Default: allow with constraints
          result = {
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
        }
      }
    }

    // §167-1948: Cache the result with version key for invalidation
    this.policyCache.set(cacheKey, { result, cachedAt: Date.now() });
    // Evict oldest entries if cache grows too large
    if (this.policyCache.size > 1000) {
      const oldestKey = [...this.policyCache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt)[0]?.[0];
      if (oldestKey) this.policyCache.delete(oldestKey);
    }

    // §11.5: All authorization decisions must produce audit records
    // Emit audit event before returning
    this.auditService.recordDecision(result, input);

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
   * Creates an escalation decision for actions requiring approval.
   */
  private escalate(
    input: PolicyDecisionRequest,
    budget: BudgetGuardResult,
    reasonCode: string,
  ): PolicyDecisionResult {
    return {
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
  }

  /**
   * Maps a tool name to its risk level.
   *
   * INV-POLICY-001 (deny-by-default): Returns null for unknown tools that are not
   * explicitly mapped. This ensures unknown tools are denied rather than falling
   * through to "allow_with_constraints".
   *
   * @param toolName - Name of the tool to look up
   * @returns The risk level if known, null if the tool is not in the registry
   */
  private getToolRiskLevel(toolName: string): ToolRiskLevel | null {
    const riskLevels: Record<string, ToolRiskLevel> = {
      // Explicit high-risk tools
      git: "high",
      spawn_agent: "high",
      // Explicit medium-risk tools
      web_fetch: "medium",
      web_search: "medium",
      batch_tool: "medium",
      // Explicit low-risk tools
      todo_write: "low",
      repo_map: "low",
      question: "low",
      read: "low",
    };
    return riskLevels[toolName] ?? null;
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
