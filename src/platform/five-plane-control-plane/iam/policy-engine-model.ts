import type { BudgetPolicy, BudgetGuardResult } from "../../model-gateway/cost-tracker/budget-guard.js";
import type {
  DocumentedUnifiedRuntimeMode,
  UnifiedRuntimeMode,
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

  /** R33-09: Optional handler called when policy staleness is detected */
  cacheInvalidationHandler?: PolicyCacheInvalidationHandler;

  /** R33-09: TTL for cached policy decisions in milliseconds (default: 5000) */
  decisionCacheTtlMs?: number;

  /** Maximum number of cached decisions retained in memory (default: 500) */
  decisionCacheMaxEntries?: number;

  /** Version string for the currently authoritative policy bundle */
  policyVersion?: string;
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
 * R33-09: Handler called when policy staleness is detected or invalidate() is called.
 * Allows external systems (e.g., policy administration service) to be notified
 * when the policy engine detects a potential policy change.
 */
export interface PolicyCacheInvalidationHandler {
  (reason: string): void;
}

/**
 * R33-09: Computed fingerprint of the budget policy for change detection.
 * Captures all fields that affect evaluation decisions.
 */
export interface PolicyFingerprint {
  maxTaskCostUsd: number;
  maxDailyCostUsd: number;
  maxMonthlyCostUsd: number;
  warnAtRatio: number;
  mode: BudgetPolicy["mode"];
  maxPlatformCostUsd: number | undefined;
  maxPackCostUsd: number | undefined;
  maxStepCostUsd: number | undefined;
  stageBudgets: readonly { stage: string; maxCostUsd: number; warnAtRatio?: number; approvalThresholdUsd?: number }[] | undefined;
  costEstimationTemplates: readonly { templateId: string; description: string; confidence: string; multiplier: number }[] | undefined;
}

/**
 * R33-09: TTL-based cache entry with metadata for policy evaluation results.
 */
export interface PolicyCacheEntry<T> {
  readonly value: T;
  readonly cachedAt: number;
  readonly ttlMs: number;
  readonly policyFingerprint: string;
}

/**
 * Policy Engine
 *
 * Evaluates actions against security and budget policies.
 *
 * R33-09: Implements fingerprint-based policy change detection with TTL-based
 * decision caching. When policy changes are detected (via fingerprint mismatch),
 * the cache is invalidated and the new policy is used for evaluation.
 */
