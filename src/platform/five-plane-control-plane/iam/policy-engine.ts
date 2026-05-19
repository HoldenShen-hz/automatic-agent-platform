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

import type { ToolRiskLevel } from "../../five-plane-execution/tool-executor/tool-metadata.js";
import { createHash, randomUUID } from "node:crypto";
import { BudgetGuard, type BudgetGuardResult, type BudgetPolicy } from "../../model-gateway/cost-tracker/budget-guard.js";
import type { UnifiedRuntimeMode } from "../../contracts/types/unified-runtime-mode.js";

export type {
  PolicyAction,
  PolicyAuditEvent,
  PolicyAuditRecord,
  PolicyAuditService,
  PolicyCacheEntry,
  PolicyCacheInvalidationHandler,
  PolicyDecisionExplain,
  PolicyDecisionRequest,
  PolicyDecisionResult,
  PolicyEngineOptions,
  PolicyFingerprint,
  PolicyMode,
  PolicyRiskCategory,
  PolicyStageViewRef,
} from "./policy-engine-model.js";

import type {
  PolicyAction,
  PolicyAuditEvent,
  PolicyAuditService,
  PolicyCacheEntry,
  PolicyCacheInvalidationHandler,
  PolicyDecisionRequest,
  PolicyDecisionResult,
  PolicyEngineOptions,
  PolicyFingerprint,
  PolicyRiskCategory,
} from "./policy-engine-model.js";
import {
  MUTATING_POLICY_ACTIONS,
  normalizePolicyMode,
  validatePolicyRequest,
  validateSubjectPermissions,
} from "./policy-engine-support.js";
export class PolicyEngine {
  private readonly budgetGuard = new BudgetGuard();
  private readonly decisionCacheMaxEntries: number;

  /** R33-09: Cached fingerprint of the last known policy state */
  private _currentFingerprint: string = "";

  /** R33-09: Decision cache keyed by a composite of decisionId + action + fingerprint */
  private readonly decisionCache = new Map<string, PolicyCacheEntry<PolicyDecisionResult>>();

  /** R33-09: TTL for cached decisions (default 5000ms) */
  private readonly decisionCacheTtlMs: number;

  public constructor(private readonly options: PolicyEngineOptions) {
    this.decisionCacheTtlMs = options.decisionCacheTtlMs ?? 5_000;
    this.decisionCacheMaxEntries = options.decisionCacheMaxEntries ?? 500;
    // Initialize fingerprint on construction
    this._currentFingerprint = this.computeFingerprint(options.budgetPolicy);
  }

  /**
   * R33-09: Returns whether the policy is considered stale (policy has changed
   * since last evaluation). Compares current policy fingerprint against the
   * stored fingerprint to detect external mutations.
   */
  public isPolicyStale(): boolean {
    const currentFingerprint = this.computeFingerprint(this.options.budgetPolicy);
    return currentFingerprint !== this._currentFingerprint;
  }

  /**
   * R33-09: Invalidates the cached policy state and signals that the policy
   * has been updated. After calling this method, `isPolicyStale()` returns false
   * until the next external policy change is detected.
   *
   * @param reason - Human-readable reason for the invalidation (logged/emitted)
   */
  public invalidate(reason: string): void {
    // Sync fingerprint to current policy state
    this._currentFingerprint = this.computeFingerprint(this.options.budgetPolicy);
    // Clear decision cache since policy has changed
    this.decisionCache.clear();
    // Notify external handler if configured
    this.options.cacheInvalidationHandler?.(reason);
  }

  /**
   * R33-09: Computes a fingerprint hash of the budget policy for change detection.
   * All fields that affect evaluation decisions are included in the fingerprint.
   */
  private computeFingerprint(policy: BudgetPolicy): string {
    const stageBudgetsHash = policy.stageBudgets
      ? JSON.stringify(policy.stageBudgets.map((sb) => ({
          stage: sb.stage,
          maxCostUsd: sb.maxCostUsd,
          warnAtRatio: sb.warnAtRatio,
          approvalThresholdUsd: sb.approvalThresholdUsd,
        })))
      : "undefined";
    const costTemplatesHash = policy.costEstimationTemplates
      ? JSON.stringify(policy.costEstimationTemplates.map((ct) => ({
          templateId: ct.templateId,
          description: ct.description,
          confidence: ct.confidence,
          multiplier: ct.multiplier,
        })))
      : "undefined";

    const fingerprint: PolicyFingerprint = {
      maxTaskCostUsd: policy.maxTaskCostUsd,
      maxDailyCostUsd: policy.maxDailyCostUsd,
      maxMonthlyCostUsd: policy.maxMonthlyCostUsd,
      warnAtRatio: policy.warnAtRatio,
      mode: policy.mode,
      maxPlatformCostUsd: policy.maxPlatformCostUsd,
      maxPackCostUsd: policy.maxPackCostUsd,
      maxStepCostUsd: policy.maxStepCostUsd,
      stageBudgets: policy.stageBudgets,
      costEstimationTemplates: policy.costEstimationTemplates,
    };

    // Use a combination of stringified values for fingerprint
    const fpStr = [
      fingerprint.maxTaskCostUsd,
      fingerprint.maxDailyCostUsd,
      fingerprint.maxMonthlyCostUsd,
      fingerprint.warnAtRatio,
      fingerprint.mode,
      fingerprint.maxPlatformCostUsd ?? "undefined",
      fingerprint.maxPackCostUsd ?? "undefined",
      fingerprint.maxStepCostUsd ?? "undefined",
      stageBudgetsHash,
      costTemplatesHash,
    ].join("|");

    return createHash("sha256").update(fpStr).digest("base64url");
  }

  /**
   * R33-09: Gets a cached policy decision if available and not expired.
   * Returns null if no cached decision exists or if the cache entry is stale
   * (policy changed or TTL expired).
   */
  private getCachedDecision(request: PolicyDecisionRequest): PolicyDecisionResult | null {
    const cacheKey = this.buildCacheKey(request);
    const entry = this.decisionCache.get(cacheKey);

    if (!entry) return null;

    // Check TTL expiration
    const age = Date.now() - entry.cachedAt;
    if (age > entry.ttlMs) {
      this.decisionCache.delete(cacheKey);
      return null;
    }

    // Check if policy changed since this was cached
    const currentFingerprint = this.computeFingerprint(this.options.budgetPolicy);
    if (entry.policyFingerprint !== currentFingerprint) {
      this.decisionCache.delete(cacheKey);
      return null;
    }

    return entry.value;
  }

  /**
   * R33-09: Caches a policy decision result with TTL and policy fingerprint.
   */
  private cacheDecision(request: PolicyDecisionRequest, result: PolicyDecisionResult): void {
    const cacheKey = this.buildCacheKey(request);
    const fingerprint = this.computeFingerprint(this.options.budgetPolicy);

    if (this.decisionCache.has(cacheKey)) {
      this.decisionCache.delete(cacheKey);
    }

    this.decisionCache.set(cacheKey, {
      value: result,
      cachedAt: Date.now(),
      ttlMs: this.decisionCacheTtlMs,
      policyFingerprint: fingerprint,
    });

    while (this.decisionCache.size > this.decisionCacheMaxEntries) {
      const oldestKey = this.decisionCache.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.decisionCache.delete(oldestKey);
    }
  }

  /**
   * R33-09: Builds a cache key from request parameters.
   * Only includes policy-relevant fields, not temporal ones like decisionId.
   */
  private buildCacheKey(request: PolicyDecisionRequest): string {
    return [
      this.getPolicyVersion(),
      this.options.killSwitchEnabled === true ? "kill:1" : "kill:0",
      request.taskId,
      request.subjectId,
      request.metadata?.tenantId ?? "tenant:none",
      request.metadata?.organizationId ?? "org:none",
      request.action,
      request.riskCategory,
      request.mode,
      request.subjectRoles?.slice().sort().join(",") ?? "roles:none",
      request.subjectCapabilities?.slice().sort().join(",") ?? "caps:none",
      request.estimatedCostUsd ?? 0,
      request.metadata?.currentTaskCostUsd ?? 0,
    ].join("|");
  }

  /**
   * R12-17: Emits an audit event for a policy decision.
   * Calls the configured audit service if present.
   */
  private emitAuditEvent(result: PolicyDecisionResult, input: PolicyDecisionRequest): void {
    const auditService = this.options.auditService;
    if (!auditService) return;

    const event: PolicyAuditEvent = {
      id: result.auditRecord?.auditId ?? `audit_policy_${randomUUID()}`,
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
    // R33-09: Check if policy has changed since last evaluation
    if (this.isPolicyStale()) {
      // Update fingerprint to acknowledge the change (auto-sync on evaluate)
      this._currentFingerprint = this.computeFingerprint(this.options.budgetPolicy);
      // Clear any cached decisions since policy changed
      this.decisionCache.clear();
    }

    // V-01: Validate input before processing
    validatePolicyRequest(input);
    // V-02: Validate subject has required roles and capabilities for the action
    validateSubjectPermissions(input);
    const normalizedMode = normalizePolicyMode(input.mode);
    const cached = this.getCachedDecision(input);
    if (cached) {
      const result = this.cloneCachedDecision(cached, input.decisionId);
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
      this.cacheDecision(input, result);
      this.emitAuditEvent(result, input);
      return result;
    }

    const modeConstraints = this.evaluateModeConstraints(normalizedMode, input);
    if (modeConstraints != null) {
      this.emitAuditEvent(modeConstraints, input);
      return modeConstraints;
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
      this.cacheDecision(input, result);
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
      return this.escalate(
        input,
        budget,
        input.mode === "supervised" ? "policy.supervised_escalation" : "policy.high_risk_requires_approval",
      );
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
    this.cacheDecision(input, result);
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
    this.cacheDecision(input, result);
    this.emitAuditEvent(result, input);
    return result;
  }

  private cloneCachedDecision(
    cached: PolicyDecisionResult,
    decisionId: string,
  ): PolicyDecisionResult {
    return {
      ...cached,
      ...(cached.explain == null
        ? {}
        : {
            explain: {
              ...cached.explain,
              decisionId,
            },
          }),
      ...(cached.auditRecord == null
        ? {}
        : {
            auditRecord: {
              ...cached.auditRecord,
              auditId: `audit_policy_${randomUUID()}`,
              decisionId,
              evaluatedAt: new Date().toISOString(),
            },
          }),
    };
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
    const policyVersion = this.getPolicyVersion();
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
        ...(remediationHint !== undefined && { remediationHint }),
      },
      auditRecord: {
        auditId: `audit_policy_${randomUUID()}`,
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

  private getPolicyVersion(): string {
    return this.options.policyVersion?.trim() || "authoritative.v1";
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
