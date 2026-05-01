import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";

export * from "./schemas.js";

export const CONTRACT_SCHEMA_VERSION = "v4.3";

export const CANONICAL_CONTRACT_NAMES = [
  "TaskDraft",
  "ConfirmedTaskSpec",
  "RequestEnvelope",
  "HarnessRun",
  "PlanGraphBundle",
  "PlanGraph",
  "PlanNode",
  "PlanEdge",
  "GraphPatch",
  "GraphPatchOperation",
  "NodeRun",
  "NodeAttempt",
  "AttemptLineage",
  "NodeAttemptReceipt",
  "SideEffectRecord",
  "ReconciliationRecord",
  "CompensationRecord",
  "BudgetLedger",
  "BudgetReservation",
  "BudgetSettlement",
  "RunVersionLock",
  "ArtifactVersionLockSet",
  "DecisionInputBundle",
  "HarnessDecision",
  "HumanResponsibilityRecord",
  "EventEnvelope",
  "PlatformFactEvent",
  "OapeflirViewEvent",
] as const;

export type CanonicalContractName = (typeof CANONICAL_CONTRACT_NAMES)[number];

// NOTE: LEGACY_CONTRACT_NAMES documents deprecated contract names for migration tracking.
// Enforcement mechanisms (R4-11):
//   1. ESLint rule: no-restricted-imports in eslint.config.js blocks imports from legacy paths at build time
//   2. Runtime console.warn: each legacy module logs a deprecation warning on import
//   3. Factory throw: legacy factory functions throw ValidationError when called
//
// Legacy contract paths and their canonical replacements:
//   - control-directive/ ControlDirective -> use OperationalDirective or DecisionDirective (same module)
//   - execution-plan/ ExecutionPlan -> use PlanGraphBundle from executable-contracts
//   - execution-receipt/ ExecutionReceipt -> use NodeAttemptReceipt from executable-contracts
//   - request-envelope/ RequestEnvelope -> use RequestEnvelope from executable-contracts
//   - state-command/ StateCommand -> use inter-plane commands (EventAppendCommand, etc.) from executable-contracts

// Re-export canonical directives from control-directive/ for R6-14/R6-18 fix
// OperationalDirective and DecisionDirective are canonical P2→P3/P4 directives per §4.3
// These were defined in control-directive/ but tests expect them from executable-contracts
export {
  type OperationalDirectiveType,
  type OperationalDirectiveScope,
  type OperationalDirective,
  type DecisionDirectiveType,
  type DecisionDirectiveScope,
  type DecisionDirective,
  createOperationalDirective,
  createDecisionDirective,
} from "../control-directive/index.js";
export const LEGACY_CONTRACT_NAMES = [
  "ExecutionPlan",
  "ExecutionReceipt",
  "ControlDirective",
  "StateCommand",
  "StateMutationCommand",
  "WorkflowStep",
  "StepOutput",
  "workflow_run",
] as const;

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface PrincipalRef {
  readonly principalId: string;
  readonly tenantId: string;
  readonly roles: readonly string[];
  readonly displayName?: string;
  readonly authorizationLevel?: "viewer" | "operator" | "admin";
}

export interface ArtifactRef {
  readonly artifactId: string;
  readonly uri: string;
  readonly hash?: string;
  readonly version?: string;
  readonly kind?: string;
  readonly mimeType?: string;
  readonly sizeBytes?: number;
  readonly createdAt?: string;
  readonly checksum?: string;
}

// =============================================================================
// Inter-plane Contracts (canonical per §5.3)
// =============================================================================

export interface EventAppendCommand<TPayload = unknown> {
  readonly commandId: string;
  readonly traceId: string;
  readonly principal: PrincipalRef;
  readonly tenantId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateSeq: number;
  readonly eventType: string;
  readonly payload: TPayload;
  readonly idempotencyKey: string;
  readonly replayBehavior?: EventReplayBehavior;
  readonly createdAt: string;
}

export interface AuditAppendCommand<TPayload = unknown> {
  readonly commandId: string;
  readonly traceId: string;
  readonly principal: PrincipalRef;
  readonly tenantId: string;
  readonly category: "decision" | "execution" | "approval" | "compliance" | "audit";
  readonly targetRef: string;
  readonly content: TPayload;
  readonly evidenceRef?: string;
  readonly createdAt: string;
}

export interface ArtifactWriteCommand {
  readonly commandId: string;
  readonly traceId: string;
  readonly principal: PrincipalRef;
  readonly tenantId: string;
  readonly artifactId: string;
  readonly uri: string;
  readonly hash?: string;
  readonly version?: string;
  readonly retentionPolicyRef?: string;
  readonly createdAt: string;
}

export interface UserConfirmationReceipt {
  readonly receiptId: string;
  readonly confirmedBy: PrincipalRef;
  readonly riskClass: RiskClass;
  readonly confirmedAt: string;
  readonly expiresAt?: string;
}

export type RiskClass = "low" | "medium" | "high" | "critical";
export type TaskInputSource = "nl" | "webhook" | "ui" | "cli" | "scheduler" | "external_event";
export type AmbiguityPolicy = "safe_default" | "require_confirmation" | "reject";

export interface RiskPreview {
  readonly riskClass: RiskClass;
  readonly reasons: readonly string[];
}

export interface TaskDraft {
  readonly taskDraftId: string;
  readonly tenantId: string;
  readonly principal: PrincipalRef;
  readonly source: TaskInputSource;
  readonly rawInputRef?: ArtifactRef;
  readonly domainId: string;
  readonly normalizedIntent: JsonValue;
  readonly missingFields: readonly string[];
  readonly riskPreview: RiskPreview;
  readonly ambiguityPolicy: AmbiguityPolicy;
  readonly createdAt: string;
  readonly expiresAt?: string;
}

export interface ConfirmedTaskSpec {
  readonly confirmedTaskSpecId: string;
  readonly taskDraftId: string;
  readonly tenantId: string;
  readonly principal: PrincipalRef;
  readonly domainId: string;
  readonly goal: string;
  readonly inputs: JsonValue;
  readonly constraintPackRef: string;
  readonly riskClass: RiskClass;
  readonly confirmationReceipt?: UserConfirmationReceipt;
  readonly idempotencyKey: string;
  readonly traceId: string;
  readonly createdAt: string;
}

export interface BudgetIntent {
  readonly amount: number;
  readonly currency: string;
  readonly resourceKinds: readonly BudgetResourceKind[];
}

export interface RequestEnvelope {
  readonly requestId: string;
  readonly confirmedTaskSpecId: string;
  readonly tenantId: string;
  readonly principal: PrincipalRef;
  readonly domainId: string;
  readonly traceId: string;
  readonly idempotencyKey: string;
  readonly priority: number;
  readonly requestHash: string;
  readonly constraintPackRef: string;
  readonly budgetIntent: BudgetIntent;
  readonly policyContext: JsonValue;
  readonly artifactRefs: readonly ArtifactRef[];
  readonly submittedAt: string;
}

export type HarnessRunStatus =
  | "created"
  | "admitted"
  | "planning"
  | "ready"
  | "running"
  | "pausing"
  | "paused"
  | "resuming"
  | "replanning"
  | "compensating"
  | "completed"
  | "failed"
  | "aborted";

export const HARNESS_RUN_TERMINAL_STATUSES = ["completed", "failed", "aborted"] as const;

export interface HarnessRun {
  readonly harnessRunId: string;
  readonly tenantId: string;
  readonly domainId: string;
  readonly confirmedTaskSpecId: string;
  readonly requestEnvelopeId: string;
  readonly requestHash: string;
  readonly status: HarnessRunStatus;
  readonly constraintPackRef: string;
  readonly versionLockId: string;
  readonly planGraphBundleId?: string;
  readonly budgetLedgerId: string;
  readonly currentSeq: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly terminalAt?: string;
  readonly terminalReason?: string;
}

export type PlanNodeType =
  | "tool"
  | "llm"
  | "hitl_wait"
  | "subgraph"
  | "evaluator"
  | "router"
  | "compensation";

export type DependencyType = "hard" | "soft" | "compensation" | "retry" | "replan";

export interface PlanNode {
  readonly nodeId: string;
  readonly nodeType: PlanNodeType;
  readonly inputRefs: readonly string[];
  readonly outputSchemaRef: string;
  readonly riskClass: RiskClass;
  readonly budgetIntent: BudgetIntent;
  readonly sideEffectProfile: SideEffectProfile;
  readonly retryPolicyRef: string;
  readonly timeoutMs: number;
}

export interface PlanEdge {
  readonly edgeId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly condition: JsonValue;
  readonly dependencyType: DependencyType;
}

export interface PlanGraph {
  readonly graphId: string;
  readonly nodes: readonly PlanNode[];
  readonly edges: readonly PlanEdge[];
  readonly entryNodeIds: readonly string[];
  readonly terminalNodeIds: readonly string[];
  readonly joinStrategy: "all" | "any" | "first_success" | "policy";
  readonly graphHash: string;
}

export interface ReadyNodeSchedulingPolicy {
  readonly policyId: string;
  readonly strategy: "deterministic_fifo" | "priority_then_fifo" | "risk_isolated";
}

export interface PlanGraphBundle {
  readonly planGraphBundleId: string;
  readonly harnessRunId: string;
  readonly graphVersion: number;
  readonly graph: PlanGraph;
  readonly schedulerPolicy: ReadyNodeSchedulingPolicy;
  readonly budgetPlanRef: string;
  readonly riskProfile: RiskPreview;
  readonly validationReport: GraphValidationReport;
  readonly artifactRefs: readonly ArtifactRef[];
  readonly createdAt: string;
}

export interface GraphValidationReport {
  readonly valid: boolean;
  readonly findings: readonly string[];
  readonly normalizedNodeIds?: readonly string[];
  readonly riskPropagation?: readonly GraphRiskFinding[];
  readonly worstPath?: GraphWorstPathAnalysis;
}

export interface GraphRiskFinding {
  readonly nodeId: string;
  readonly inheritedRiskClass: RiskClass;
  readonly reasons: readonly string[];
}

export interface GraphWorstPathAnalysis {
  readonly pathNodeIds: readonly string[];
  readonly riskClass: RiskClass;
  readonly estimatedBudgetAmount: number;
  readonly timeoutMs: number;
}

export type GraphPatchOperationType =
  | "add_node"
  | "add_edge"
  | "disable_edge"
  | "add_compensation_node"
  | "add_failure_path"
  | "mark_skipped"
  | "append_subgraph";

export interface GraphPatchOperation {
  readonly operationId: string;
  readonly operationType: GraphPatchOperationType;
  readonly targetRef: string;
  readonly payload: JsonValue;
}

export interface GraphPatch {
  readonly graphPatchId: string;
  readonly harnessRunId: string;
  readonly baseGraphVersion: number;
  readonly newGraphVersion: number;
  readonly operations: readonly GraphPatchOperation[];
  readonly affectedExecutedNodes: readonly string[];
  readonly affectedSideEffects: readonly string[];
  readonly compatibilityClass:
    | "safe_append"
    | "requires_checkpoint_revalidation"
    | "requires_human_approval"
    | "incompatible_restart_required";
  readonly compensationPlanRef?: ArtifactRef;
  readonly policyProofRef: ArtifactRef;
  readonly auditRef: ArtifactRef;
}

export type NodeRunStatus =
  | "created"
  | "ready"
  | "leased"
  | "running"
  | "retry_wait"
  | "awaiting_hitl"
  | "reconciling"
  | "succeeded"
  | "failed"
  | "skipped"
  | "cancelled"
  | "dependency_failed"
  | "policy_blocked"
  | "aborted";

export const NODE_RUN_TERMINAL_STATUSES = [
  "succeeded",
  "failed",
  "skipped",
  "cancelled",
  "dependency_failed",
  "policy_blocked",
  "aborted",
] as const;

export interface NodeRun {
  readonly nodeRunId: string;
  readonly harnessRunId: string;
  readonly planGraphBundleId: string;
  readonly graphVersion: number;
  readonly nodeId: string;
  readonly status: NodeRunStatus;
  readonly attemptCount: number;
  readonly leaseId?: string;
  readonly fencingToken?: string;
  readonly currentSeq: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly terminalReason?: string;
}

export type NodeAttemptKind = "initial" | "retry" | "redrive" | "recovery";

export interface NodeAttempt {
  readonly nodeAttemptId: string;
  readonly nodeRunId: string;
  readonly attemptNo: number;
  readonly attemptKind: NodeAttemptKind;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly executorRef: string;
  readonly inputSnapshotRef: ArtifactRef;
  readonly receiptId?: string;
}

export interface AttemptLineage {
  readonly attemptLineageId: string;
  readonly nodeRunId: string;
  readonly previousAttemptId?: string;
  readonly nextAttemptId?: string;
  readonly reason: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface AppErrorRef {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

export interface NodeAttemptReceipt {
  readonly nodeAttemptReceiptId: string;
  readonly harnessRunId: string;
  readonly planGraphId: string;
  readonly graphVersion: number;
  readonly nodeAttemptId: string;
  readonly nodeRunId: string;
  readonly receiptKind: "tool" | "llm" | "hitl" | "subgraph" | "evaluator" | "router";
  readonly status: "succeeded" | "failed" | "partial" | "blocked";
  readonly duration: number;
  readonly outputRef?: ArtifactRef;
  readonly error?: AppErrorRef;
  readonly errorDetail: string;
  readonly sideEffectRefs: readonly string[];
  readonly budgetSettlementRefs: readonly string[];
  readonly evidenceRefs: readonly ArtifactRef[];
  readonly producedAt: string;
}

export type SideEffectKind =
  | "file_write"
  | "external_api"
  | "message_send"
  | "transaction"
  | "tool_commit"
  | "other";

export type SideEffectStatus =
  | "proposed"
  | "approved"
  | "reserved"
  | "committing"
  | "committed"
  | "confirming"
  | "confirmed"
  | "ambiguous"
  | "manual_review_required"
  | "reconciling"
  | "compensation_required"
  | "compensating"
  | "compensated"
  | "failed"
  | "revoked"
  | "expired";

export interface SideEffectProfile {
  readonly mayCommitExternalEffect: boolean;
  readonly reversible: boolean;
}

export interface SideEffectRecord {
  readonly sideEffectId: string;
  readonly harnessRunId: string;
  readonly nodeRunId: string;
  readonly nodeAttemptId: string;
  readonly effectKind: SideEffectKind;
  readonly idempotencyKey: string;
  readonly status: SideEffectStatus;
  readonly riskClass: RiskClass;
  readonly approvalRef?: string;
  readonly preCommitPolicyProofRef: ArtifactRef;
  readonly externalRef?: string;
  /** Per-effect deadline (ISO 8601 timestamp) - must commit before this time per §14.11 */
  readonly deadline: string;
  /** Inline rollback handler specification per §14.11 */
  readonly rollbackHandler?: string;
  /** Inline compensation plan reference per §14.11 */
  readonly compensationPlan?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ReconciliationRecord {
  readonly reconciliationId: string;
  readonly sideEffectId: string;
  readonly probeKind: string;
  readonly externalObservedState: JsonValue;
  readonly result: "confirmed" | "not_found" | "ambiguous" | "failed";
  readonly evidenceRefs: readonly ArtifactRef[];
  readonly nextAction: "mark_confirmed" | "retry_probe" | "compensate" | "escalate_hitl" | "mark_failed";
  readonly createdAt: string;
}

export interface CompensationRecord {
  readonly compensationId: string;
  readonly sideEffectId: string;
  readonly harnessRunId: string;
  readonly planRef: ArtifactRef;
  readonly status: "planned" | "running" | "succeeded" | "failed" | "requires_human";
  readonly evidenceRefs: readonly ArtifactRef[];
  readonly createdAt: string;
  readonly completedAt?: string;
}

export type BudgetResourceKind = "token" | "tool" | "api" | "compute" | "human" | "side_effect" | "other";

export interface BudgetLedger {
  readonly budgetLedgerId: string;
  readonly tenantId: string;
  readonly harnessRunId: string;
  readonly currency: string;
  readonly hardCap: number;
  readonly softCap?: number;
  readonly reservedAmount: number;
  readonly settledAmount: number;
  readonly releasedAmount: number;
  readonly status: "open" | "soft_cap_reached" | "hard_cap_reached" | "closed";
  readonly version: number;
}

export interface BudgetReservation {
  readonly budgetReservationId: string;
  readonly budgetLedgerId: string;
  readonly harnessRunId: string;
  readonly nodeRunId?: string;
  readonly amount: number;
  readonly resourceKind: BudgetResourceKind;
  readonly status: "reserved" | "settled" | "released" | "expired" | "rejected";
  readonly expiresAt: string;
  readonly createdAt: string;
}

export interface BudgetSettlement {
  readonly budgetSettlementId: string;
  readonly budgetReservationId: string;
  readonly actualAmount: number;
  readonly settlementKind: "final" | "partial" | "release_unused" | "correction";
  readonly evidenceRefs: readonly ArtifactRef[];
  readonly createdAt: string;
}

export interface BudgetReservationResult {
  readonly ledger: BudgetLedger;
  readonly reservation: BudgetReservation;
}

export interface RunVersionLock {
  readonly runVersionLockId: string;
  readonly harnessRunId: string;
  readonly schemaVersion: string;
  readonly runtimeProfileVersion: string;
  readonly promptVersions: Readonly<Record<string, string>>;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly toolVersions: Readonly<Record<string, string>>;
  readonly modelVersions: Readonly<Record<string, string>>;
  readonly evalVersions: Readonly<Record<string, string>>;
  readonly guardrailVersions: Readonly<Record<string, string>>;
  readonly domainVersions: Readonly<Record<string, string>>;
  readonly createdAt: string;
}

export interface ArtifactVersionLock {
  readonly artifactId: string;
  readonly version: string;
  readonly hash: string;
  readonly storageUri: string;
  readonly retentionPolicyRef: string;
}

export interface ArtifactVersionLockSet {
  readonly artifactVersionLockSetId: string;
  readonly harnessRunId: string;
  readonly artifactLocks: readonly ArtifactVersionLock[];
  readonly createdAt: string;
}

export interface PolicyFinding {
  readonly code: string;
  readonly severity: RiskClass;
  readonly message: string;
}

export interface DecisionInputBundle {
  readonly decisionInputBundleId: string;
  readonly harnessRunId: string;
  readonly nodeRunId?: string;
  readonly decisionKind: "approve" | "reject" | "patch" | "takeover" | "resume" | "abort" | "retry" | "replan";
  readonly riskClass: RiskClass;
  readonly contextRefs: readonly ArtifactRef[];
  readonly evidenceRefs: readonly ArtifactRef[];
  readonly policyFindings: readonly PolicyFinding[];
  readonly budgetSnapshotRef?: ArtifactRef;
  readonly sideEffectRefs: readonly string[];
  readonly createdAt: string;
}

export interface HarnessDecision {
  readonly harnessDecisionId: string;
  readonly decisionInputBundleId: string;
  readonly decisionKind: DecisionInputBundle["decisionKind"];
  readonly decision: "accept" | "reject" | "retry" | "replan" | "escalate" | "abort" | "takeover" | "patch";
  readonly deciderType: "system" | "policy" | "evaluator" | "human" | "operator";
  readonly deciderRef: string;
  readonly reasonCode: string;
  readonly expiresAt?: string;
  readonly createdAt: string;
}

export interface HumanResponsibilityRecord {
  readonly humanResponsibilityRecordId: string;
  readonly harnessDecisionId: string;
  readonly humanActorRef: PrincipalRef;
  readonly responsibilityScope: "approval" | "override" | "takeover" | "patch" | "resume" | "abort" | "compensation";
  readonly acknowledgedRiskClass: RiskClass;
  readonly acknowledgementReceiptRef: ArtifactRef;
  readonly effectiveFrom: string;
  readonly expiresAt?: string;
}

/**
 * EventEnvelope - canonical event structure per §28.1
 *
 * Compliance notes:
 * - runId: REQUIRED per §28.1 (not optional)
 * - replayBehavior: REQUIRED (explicitly declared, not optional) per §28.1
 * - schemaVersion: numeric type per §28.1 (not string)
 */
export interface EventEnvelope<TPayload extends JsonValue = JsonValue> {
  readonly eventId: string;
  readonly runId: string;
  readonly eventType: string;
  readonly schemaVersion: number;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateSeq: number;
  readonly tenantId: string;
  readonly traceId: string;
  readonly causationId?: string;
  readonly correlationId?: string;
  readonly payloadHash: string;
  readonly payload: TPayload;
  readonly replayBehavior: EventReplayBehavior;
  readonly sourceOfTruth?: EventSourceOfTruth;
  readonly schemaOwner?: string;
  readonly consumerContractTests?: readonly string[];
  readonly occurredAt: string;
}

export type EventReplayBehavior = "replay_as_fact" | "skip_side_effect" | "simulate" | "forbidden";
export type EventSourceOfTruth = "platform" | "projection";

export interface PlatformFactEvent<TPayload extends JsonValue = JsonValue> extends EventEnvelope<TPayload> {
  readonly eventType: `platform.${string}`;
}

export interface OapeflirViewEvent<TPayload extends JsonValue = JsonValue> extends EventEnvelope<TPayload> {
  readonly eventType: `oapeflir.view.${string}` | `oapeflir.rationale.${string}`;
  readonly derivedFromEventIds: readonly string[];
  readonly projectionOnly: true;
}

export function createPrincipalRef(input: {
  principalId: string;
  tenantId: string;
  roles?: readonly string[];
  displayName?: string;
  authorizationLevel?: "viewer" | "operator" | "admin";
}): PrincipalRef {
  requireNonEmpty(input.principalId, "principal.principal_id_required");
  requireNonEmpty(input.tenantId, "principal.tenant_id_required");
  return {
    principalId: input.principalId,
    tenantId: input.tenantId,
    roles: input.roles ?? [],
    ...(input.displayName != null ? { displayName: input.displayName } : {}),
    ...(input.authorizationLevel != null ? { authorizationLevel: input.authorizationLevel } : {}),
  };
}

const LEGACY_DOMAIN_BINDING_ALIASES = {
  general_ops: "project-management",
  platform_engineering: "coding",
  engineering: "coding",
  content_production: "creative-production",
  content: "creative-production",
  design: "creative-production",
  engineering_ops: "coding",
  operations: "it-operations",
  data_analysis: "data-engineering",
  data: "data-engineering",
  analytics: "data-engineering",
  quality_assurance: "quality-assurance",
  qa: "quality-assurance",
  security: "content-moderation",
  support: "customer-service",
  communications: "marketing",
  hr: "human-resources",
  finance: "finance-accounting",
  devops: "it-operations",
  "data-processing": "data-engineering",
  "data-analytics": "data-engineering",
  "enterprise-knowledge-base": "knowledge-base",
  "quantitative-trading": "quant-trading",
  "advertising-promotion": "advertising",
  sales: "ecommerce",
  "online-livestream": "live-streaming",
  "medical-health": "healthcare",
  "supply-chain-logistics": "supply-chain",
  "education-training": "education",
  "advertising-creative": "creative-production",
  "marketing-brand": "marketing",
} as const;

const DOMAIN_BINDING_FIELD_NAMES = [
  "domainId",
  "domain_id",
  "divisionId",
  "division_id",
  "domainHint",
  "domain_hint",
  "baselineDomainId",
  "baseline_domain_id",
] as const;

export function normalizeDomainBindingId(domainId: string): string {
  requireNonEmpty(domainId, "domain_binding.domain_id_required");
  const normalized = domainId.trim().toLowerCase().replace(/\s+/g, "-");
  return LEGACY_DOMAIN_BINDING_ALIASES[normalized as keyof typeof LEGACY_DOMAIN_BINDING_ALIASES] ?? normalized;
}

function extractDomainBindingId(source: unknown): string | null {
  if (source == null || typeof source !== "object") {
    return null;
  }
  if (Array.isArray(source)) {
    for (const item of source) {
      const candidate = extractDomainBindingId(item);
      if (candidate != null) {
        return candidate;
      }
    }
    return null;
  }
  const record = source as Record<string, unknown>;
  for (const field of DOMAIN_BINDING_FIELD_NAMES) {
    const candidate = record[field];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return normalizeDomainBindingId(candidate);
    }
  }
  for (const value of Object.values(record)) {
    const candidate = extractDomainBindingId(value);
    if (candidate != null) {
      return candidate;
    }
  }
  return null;
}

function extractDomainBindingIdFromRef(ref: string | undefined): string | null {
  if (ref == null || ref.trim().length === 0) {
    return null;
  }
  const trimmed = ref.trim();
  if (trimmed.startsWith("constraint_pack:")) {
    const segments = trimmed.split(":");
    if (segments[1] != null && segments[1].trim().length > 0) {
      return normalizeDomainBindingId(segments[1]);
    }
  }
  return normalizeDomainBindingId(trimmed);
}

function resolveDomainBindingId(input: {
  explicit?: string;
  sources?: readonly unknown[];
  refCandidate?: string;
  errorCode: string;
  errorMessage: string;
}): string {
  if (input.explicit != null && input.explicit.trim().length > 0) {
    return normalizeDomainBindingId(input.explicit);
  }
  for (const source of input.sources ?? []) {
    const candidate = extractDomainBindingId(source);
    if (candidate != null) {
      return candidate;
    }
  }
  const refCandidate = extractDomainBindingIdFromRef(input.refCandidate);
  if (refCandidate != null) {
    return refCandidate;
  }
  throw new ValidationError(input.errorCode, input.errorMessage);
}

export function createTaskDraft(input: {
  tenantId: string;
  principal: PrincipalRef;
  source: TaskInputSource;
  domainId?: string;
  normalizedIntent: JsonValue;
  riskPreview: RiskPreview;
  taskDraftId?: string;
  rawInputRef?: ArtifactRef;
  missingFields?: readonly string[];
  ambiguityPolicy?: AmbiguityPolicy;
  createdAt?: string;
  expiresAt?: string;
}): TaskDraft {
  requireNonEmpty(input.tenantId, "task_draft.tenant_id_required");
  const sources: readonly unknown[] = [input.normalizedIntent];
  const domainId = resolveDomainBindingId({
    ...(input.domainId != null && input.domainId.trim().length > 0 ? { explicit: input.domainId } : {}),
    sources,
    errorCode: "task_draft.domain_id_required",
    errorMessage: "TaskDraft requires a domainId or a legacy domain/division binding in normalizedIntent.",
  });
  return {
    taskDraftId: input.taskDraftId ?? newId("taskdraft"),
    tenantId: input.tenantId,
    principal: input.principal,
    source: input.source,
    ...(input.rawInputRef != null ? { rawInputRef: input.rawInputRef } : {}),
    domainId,
    normalizedIntent: input.normalizedIntent,
    missingFields: input.missingFields ?? [],
    riskPreview: input.riskPreview,
    ambiguityPolicy: input.ambiguityPolicy ?? "require_confirmation",
    createdAt: input.createdAt ?? nowIso(),
    ...(input.expiresAt != null ? { expiresAt: input.expiresAt } : {}),
  };
}

export function createConfirmedTaskSpec(input: {
  taskDraftId: string;
  tenantId: string;
  principal: PrincipalRef;
  domainId?: string;
  goal: string;
  inputs: JsonValue;
  constraintPackRef: string;
  riskClass: RiskClass;
  idempotencyKey: string;
  traceId: string;
  confirmedTaskSpecId?: string;
  confirmationReceipt?: UserConfirmationReceipt;
  createdAt?: string;
}): ConfirmedTaskSpec {
  requireNonEmpty(input.goal, "confirmed_task_spec.goal_required");
  requireNonEmpty(input.constraintPackRef, "confirmed_task_spec.constraint_pack_required");
  if (isHighRisk(input.riskClass) && input.confirmationReceipt == null) {
    throw new ValidationError(
      "confirmed_task_spec.confirmation_required",
      "High and critical task specs require a confirmation receipt.",
    );
  }
  const sources: readonly unknown[] = [input.inputs];
  const domainId = resolveDomainBindingId({
    ...(input.domainId != null && input.domainId.trim().length > 0 ? { explicit: input.domainId } : {}),
    sources,
    refCandidate: input.constraintPackRef,
    errorCode: "confirmed_task_spec.domain_id_required",
    errorMessage: "ConfirmedTaskSpec requires a domainId or a legacy domain/division binding in inputs.",
  });
  return {
    confirmedTaskSpecId: input.confirmedTaskSpecId ?? newId("ctspec"),
    taskDraftId: input.taskDraftId,
    tenantId: input.tenantId,
    principal: input.principal,
    domainId,
    goal: input.goal,
    inputs: input.inputs,
    constraintPackRef: input.constraintPackRef,
    riskClass: input.riskClass,
    ...(input.confirmationReceipt != null ? { confirmationReceipt: input.confirmationReceipt } : {}),
    idempotencyKey: input.idempotencyKey,
    traceId: input.traceId,
    createdAt: input.createdAt ?? nowIso(),
  };
}

export function createRequestEnvelopeFromConfirmedTask(input: {
  confirmedTaskSpec: ConfirmedTaskSpec;
  budgetIntent: BudgetIntent;
  policyContext?: JsonValue;
  artifactRefs?: readonly ArtifactRef[];
  requestId?: string;
  requestHash?: string;
  priority?: number;
  submittedAt?: string;
}): RequestEnvelope {
  return {
    requestId: input.requestId ?? newId("request"),
    confirmedTaskSpecId: input.confirmedTaskSpec.confirmedTaskSpecId,
    tenantId: input.confirmedTaskSpec.tenantId,
    principal: input.confirmedTaskSpec.principal,
    domainId: input.confirmedTaskSpec.domainId,
    traceId: input.confirmedTaskSpec.traceId,
    idempotencyKey: input.confirmedTaskSpec.idempotencyKey,
    priority: input.priority ?? 0,
    requestHash: input.requestHash ?? newId("reqhash"),
    constraintPackRef: input.confirmedTaskSpec.constraintPackRef,
    budgetIntent: input.budgetIntent,
    policyContext: input.policyContext ?? {},
    artifactRefs: input.artifactRefs ?? [],
    submittedAt: input.submittedAt ?? nowIso(),
  };
}

export function createHarnessRun(input: {
  tenantId: string;
  domainId?: string;
  confirmedTaskSpecId: string;
  requestEnvelopeId: string;
  requestHash: string;
  constraintPackRef: string;
  versionLockId: string;
  budgetLedgerId: string;
  harnessRunId?: string;
  status?: HarnessRunStatus;
  planGraphBundleId?: string;
  leaseId?: string;
  fencingToken?: string;
  currentSeq?: number;
  createdAt?: string;
  updatedAt?: string;
  terminalAt?: string;
  terminalReason?: string;
}): HarnessRun {
  const timestamp = input.createdAt ?? nowIso();
  const domainId = resolveDomainBindingId({
    ...(input.domainId != null && input.domainId.trim().length > 0 ? { explicit: input.domainId } : {}),
    refCandidate: input.constraintPackRef,
    errorCode: "harness_run.domain_id_required",
    errorMessage: "HarnessRun requires a domainId or a constraintPackRef that preserves the domain binding.",
  });
  return {
    harnessRunId: input.harnessRunId ?? newId("hrun"),
    tenantId: input.tenantId,
    domainId,
    confirmedTaskSpecId: input.confirmedTaskSpecId,
    requestEnvelopeId: input.requestEnvelopeId,
    requestHash: input.requestHash,
    status: input.status ?? "created",
    constraintPackRef: input.constraintPackRef,
    versionLockId: input.versionLockId,
    ...(input.planGraphBundleId != null ? { planGraphBundleId: input.planGraphBundleId } : {}),
    budgetLedgerId: input.budgetLedgerId,
    ...(input.leaseId != null ? { leaseId: input.leaseId } : {}),
    ...(input.fencingToken != null ? { fencingToken: input.fencingToken } : {}),
    currentSeq: input.currentSeq ?? 0,
    createdAt: timestamp,
    updatedAt: input.updatedAt ?? timestamp,
    ...(input.terminalAt != null ? { terminalAt: input.terminalAt } : {}),
    ...(input.terminalReason != null ? { terminalReason: input.terminalReason } : {}),
  };
}

export function createPlanGraphBundle(input: {
  harnessRunId: string;
  graph: PlanGraph;
  schedulerPolicy: ReadyNodeSchedulingPolicy;
  budgetPlanRef: string;
  riskProfile: RiskPreview;
  validationReport?: GraphValidationReport;
  planGraphBundleId?: string;
  graphVersion?: number;
  artifactRefs?: readonly ArtifactRef[];
  createdAt?: string;
}): PlanGraphBundle {
  if (input.graph.nodes.length === 0) {
    throw new ValidationError("plan_graph.nodes_required", "PlanGraphBundle requires at least one node.");
  }
  return {
    planGraphBundleId: input.planGraphBundleId ?? newId("pgb"),
    harnessRunId: input.harnessRunId,
    graphVersion: input.graphVersion ?? 1,
    graph: input.graph,
    schedulerPolicy: input.schedulerPolicy,
    budgetPlanRef: input.budgetPlanRef,
    riskProfile: input.riskProfile,
    validationReport: input.validationReport ?? { valid: true, findings: [] },
    artifactRefs: input.artifactRefs ?? [],
    createdAt: input.createdAt ?? nowIso(),
  };
}

export function createGraphPatch(input: {
  harnessRunId: string;
  baseGraphVersion: number;
  newGraphVersion: number;
  operations: readonly GraphPatchOperation[];
  affectedExecutedNodes?: readonly string[];
  affectedSideEffects?: readonly string[];
  compatibilityClass?: GraphPatch["compatibilityClass"];
  compensationPlanRef?: ArtifactRef;
  policyProofRef: ArtifactRef;
  auditRef: ArtifactRef;
  graphPatchId?: string;
}): GraphPatch {
  if (input.newGraphVersion <= input.baseGraphVersion) {
    throw new ValidationError("graph_patch.version_must_advance", "GraphPatch newGraphVersion must advance.");
  }
  if (input.operations.length === 0) {
    throw new ValidationError("graph_patch.operations_required", "GraphPatch requires at least one operation.");
  }
  const patch: GraphPatch = {
    graphPatchId: input.graphPatchId ?? newId("gpatch"),
    harnessRunId: input.harnessRunId,
    baseGraphVersion: input.baseGraphVersion,
    newGraphVersion: input.newGraphVersion,
    operations: input.operations,
    affectedExecutedNodes: input.affectedExecutedNodes ?? [],
    affectedSideEffects: input.affectedSideEffects ?? [],
    compatibilityClass: input.compatibilityClass ?? "safe_append",
    ...(input.compensationPlanRef != null ? { compensationPlanRef: input.compensationPlanRef } : {}),
    policyProofRef: input.policyProofRef,
    auditRef: input.auditRef,
  };
  assertGraphPatchSafety(patch);
  return patch;
}

export function assertGraphPatchSafety(patch: GraphPatch): void {
  const touchesExecutedFacts = patch.affectedExecutedNodes.length > 0 || patch.affectedSideEffects.length > 0;
  if (touchesExecutedFacts && patch.compatibilityClass === "safe_append") {
    throw new ValidationError(
      "graph_patch.safe_append_cannot_touch_executed_facts",
      "GraphPatch safe_append cannot affect executed nodes or side effects.",
    );
  }
  if (patch.affectedSideEffects.length > 0 && patch.compensationPlanRef == null) {
    throw new ValidationError(
      "graph_patch.compensation_required_for_side_effects",
      "GraphPatch affecting side effects requires a compensation plan.",
    );
  }
  const executedNodeIds = new Set(patch.affectedExecutedNodes);
  const rewritesExecutedNode = patch.operations.some((operation) => {
    return (
      executedNodeIds.has(operation.targetRef) &&
      operation.operationType === "mark_skipped"
    );
  });
  if (rewritesExecutedNode) {
    throw new ValidationError(
      "graph_patch.executed_node_rewrite_forbidden",
      "GraphPatch cannot disable or skip an already executed node.",
    );
  }
}

export function createNodeRun(input: {
  harnessRunId: string;
  planGraphBundleId: string;
  graphVersion: number;
  nodeId: string;
  nodeRunId?: string;
  status?: NodeRunStatus;
  attemptCount?: number;
  leaseId?: string;
  fencingToken?: string;
  currentSeq?: number;
  createdAt?: string;
  updatedAt?: string;
}): NodeRun {
  const timestamp = input.createdAt ?? nowIso();
  return {
    nodeRunId: input.nodeRunId ?? newId("nrun"),
    harnessRunId: input.harnessRunId,
    planGraphBundleId: input.planGraphBundleId,
    graphVersion: input.graphVersion,
    nodeId: input.nodeId,
    status: input.status ?? "created",
    attemptCount: input.attemptCount ?? 0,
    ...(input.leaseId != null ? { leaseId: input.leaseId } : {}),
    ...(input.fencingToken != null ? { fencingToken: input.fencingToken } : {}),
    currentSeq: input.currentSeq ?? 0,
    createdAt: timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  };
}

export function createNodeAttempt(input: {
  nodeRunId: string;
  attemptNo: number;
  attemptKind: NodeAttemptKind;
  executorRef: string;
  inputSnapshotRef: ArtifactRef;
  nodeAttemptId?: string;
  startedAt?: string;
  completedAt?: string;
  receiptId?: string;
}): NodeAttempt {
  if (input.attemptNo < 1) {
    throw new ValidationError("node_attempt.attempt_no_invalid", "NodeAttempt attemptNo starts at 1.");
  }
  return {
    nodeAttemptId: input.nodeAttemptId ?? newId("nattempt"),
    nodeRunId: input.nodeRunId,
    attemptNo: input.attemptNo,
    attemptKind: input.attemptKind,
    startedAt: input.startedAt ?? nowIso(),
    ...(input.completedAt != null ? { completedAt: input.completedAt } : {}),
    executorRef: input.executorRef,
    inputSnapshotRef: input.inputSnapshotRef,
    ...(input.receiptId != null ? { receiptId: input.receiptId } : {}),
  };
}

export function createAttemptLineage(input: {
  nodeRunId: string;
  reason: string;
  createdBy: string;
  attemptLineageId?: string;
  previousAttemptId?: string;
  nextAttemptId?: string;
  createdAt?: string;
}): AttemptLineage {
  requireNonEmpty(input.reason, "attempt_lineage.reason_required");
  return {
    attemptLineageId: input.attemptLineageId ?? newId("alineage"),
    nodeRunId: input.nodeRunId,
    ...(input.previousAttemptId != null ? { previousAttemptId: input.previousAttemptId } : {}),
    ...(input.nextAttemptId != null ? { nextAttemptId: input.nextAttemptId } : {}),
    reason: input.reason,
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? nowIso(),
  };
}

export function createNodeAttemptReceipt(input: {
  nodeAttemptId: string;
  nodeRunId: string;
  harnessRunId: string;
  planGraphId: string;
  graphVersion: number;
  receiptKind: NodeAttemptReceipt["receiptKind"];
  status: NodeAttemptReceipt["status"];
  duration: number;
  errorDetail: string;
  nodeAttemptReceiptId?: string;
  outputRef?: ArtifactRef;
  error?: AppErrorRef;
  sideEffectRefs?: readonly string[];
  budgetSettlementRefs?: readonly string[];
  evidenceRefs?: readonly ArtifactRef[];
  producedAt?: string;
}): NodeAttemptReceipt {
  return {
    nodeAttemptReceiptId: input.nodeAttemptReceiptId ?? newId("nreceipt"),
    nodeAttemptId: input.nodeAttemptId,
    nodeRunId: input.nodeRunId,
    harnessRunId: input.harnessRunId,
    planGraphId: input.planGraphId,
    graphVersion: input.graphVersion,
    receiptKind: input.receiptKind,
    status: input.status,
    duration: input.duration,
    ...(input.outputRef != null ? { outputRef: input.outputRef } : {}),
    ...(input.error != null ? { error: input.error } : {}),
    errorDetail: input.errorDetail,
    sideEffectRefs: input.sideEffectRefs ?? [],
    budgetSettlementRefs: input.budgetSettlementRefs ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    producedAt: input.producedAt ?? nowIso(),
  };
}

export function createSideEffectRecord(input: {
  harnessRunId: string;
  nodeRunId: string;
  nodeAttemptId: string;
  effectKind: SideEffectKind;
  idempotencyKey: string;
  riskClass: RiskClass;
  preCommitPolicyProofRef: ArtifactRef;
  sideEffectId?: string;
  status?: SideEffectStatus;
  approvalRef?: string;
  externalRef?: string;
  deadline: string;
  rollbackHandler?: string;
  compensationPlan?: string;
  createdAt?: string;
  updatedAt?: string;
}): SideEffectRecord {
  const timestamp = input.createdAt ?? nowIso();
  return {
    sideEffectId: input.sideEffectId ?? newId("seffect"),
    harnessRunId: input.harnessRunId,
    nodeRunId: input.nodeRunId,
    nodeAttemptId: input.nodeAttemptId,
    effectKind: input.effectKind,
    idempotencyKey: input.idempotencyKey,
    status: input.status ?? "proposed",
    riskClass: input.riskClass,
    ...(input.approvalRef != null ? { approvalRef: input.approvalRef } : {}),
    preCommitPolicyProofRef: input.preCommitPolicyProofRef,
    ...(input.externalRef != null ? { externalRef: input.externalRef } : {}),
    deadline: input.deadline,
    ...(input.rollbackHandler != null ? { rollbackHandler: input.rollbackHandler } : {}),
    ...(input.compensationPlan != null ? { compensationPlan: input.compensationPlan } : {}),
    createdAt: timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  };
}

export function createReconciliationRecord(input: {
  sideEffectId: string;
  probeKind: string;
  externalObservedState: JsonValue;
  result: ReconciliationRecord["result"];
  nextAction: ReconciliationRecord["nextAction"];
  reconciliationId?: string;
  evidenceRefs?: readonly ArtifactRef[];
  createdAt?: string;
}): ReconciliationRecord {
  return {
    reconciliationId: input.reconciliationId ?? newId("recon"),
    sideEffectId: input.sideEffectId,
    probeKind: input.probeKind,
    externalObservedState: input.externalObservedState,
    result: input.result,
    evidenceRefs: input.evidenceRefs ?? [],
    nextAction: input.nextAction,
    createdAt: input.createdAt ?? nowIso(),
  };
}

export function createCompensationRecord(input: {
  sideEffectId: string;
  harnessRunId: string;
  planRef: ArtifactRef;
  status?: CompensationRecord["status"];
  compensationId?: string;
  evidenceRefs?: readonly ArtifactRef[];
  createdAt?: string;
  completedAt?: string;
}): CompensationRecord {
  return {
    compensationId: input.compensationId ?? newId("comp"),
    sideEffectId: input.sideEffectId,
    harnessRunId: input.harnessRunId,
    planRef: input.planRef,
    status: input.status ?? "planned",
    evidenceRefs: input.evidenceRefs ?? [],
    createdAt: input.createdAt ?? nowIso(),
    ...(input.completedAt != null ? { completedAt: input.completedAt } : {}),
  };
}

export function createBudgetLedger(input: {
  tenantId: string;
  harnessRunId: string;
  currency: string;
  hardCap: number;
  budgetLedgerId?: string;
  softCap?: number;
  reservedAmount?: number;
  settledAmount?: number;
  releasedAmount?: number;
  status?: BudgetLedger["status"];
  version?: number;
}): BudgetLedger {
  requireNonNegative(input.hardCap, "budget_ledger.hard_cap_invalid");
  return {
    budgetLedgerId: input.budgetLedgerId ?? newId("bledger"),
    tenantId: input.tenantId,
    harnessRunId: input.harnessRunId,
    currency: input.currency,
    hardCap: input.hardCap,
    ...(input.softCap != null ? { softCap: input.softCap } : {}),
    reservedAmount: input.reservedAmount ?? 0,
    settledAmount: input.settledAmount ?? 0,
    releasedAmount: input.releasedAmount ?? 0,
    status: input.status ?? "open",
    version: input.version ?? 0,
  };
}

export function createBudgetReservation(input: {
  budgetLedgerId: string;
  harnessRunId: string;
  amount: number;
  resourceKind: BudgetResourceKind;
  expiresAt: string;
  budgetReservationId?: string;
  nodeRunId?: string;
  status?: BudgetReservation["status"];
  createdAt?: string;
}): BudgetReservation {
  requirePositive(input.amount, "budget_reservation.amount_invalid");
  return {
    budgetReservationId: input.budgetReservationId ?? newId("bresv"),
    budgetLedgerId: input.budgetLedgerId,
    harnessRunId: input.harnessRunId,
    ...(input.nodeRunId != null ? { nodeRunId: input.nodeRunId } : {}),
    amount: input.amount,
    resourceKind: input.resourceKind,
    status: input.status ?? "reserved",
    expiresAt: input.expiresAt,
    createdAt: input.createdAt ?? nowIso(),
  };
}

export function reserveBudgetHardCap(input: {
  ledger: BudgetLedger;
  amount: number;
  resourceKind: BudgetResourceKind;
  expiresAt: string;
  expectedVersion: number;
  nodeRunId?: string;
  createdAt?: string;
}): BudgetReservationResult {
  if (input.ledger.version !== input.expectedVersion) {
    throw new ValidationError(
      "budget_reservation.version_cas_failed",
      "Budget reservation requires the current ledger version.",
    );
  }
  requirePositive(input.amount, "budget_reservation.amount_invalid");
  const activeCommittedAmount = input.ledger.reservedAmount + input.ledger.settledAmount - input.ledger.releasedAmount;
  if (activeCommittedAmount + input.amount > input.ledger.hardCap) {
    throw new ValidationError("budget_reservation.hard_cap_exceeded", "Budget reservation exceeds hard cap.");
  }
  const ledger: BudgetLedger = {
    ...input.ledger,
    reservedAmount: input.ledger.reservedAmount + input.amount,
    status: activeCommittedAmount + input.amount === input.ledger.hardCap ? "hard_cap_reached" : input.ledger.status,
    version: input.ledger.version + 1,
  };
  const reservation = createBudgetReservation({
    budgetLedgerId: input.ledger.budgetLedgerId,
    harnessRunId: input.ledger.harnessRunId,
    ...(input.nodeRunId != null ? { nodeRunId: input.nodeRunId } : {}),
    amount: input.amount,
    resourceKind: input.resourceKind,
    expiresAt: input.expiresAt,
    ...(input.createdAt != null ? { createdAt: input.createdAt } : {}),
  });
  return { ledger, reservation };
}

export function createBudgetSettlement(input: {
  budgetReservationId: string;
  actualAmount: number;
  settlementKind: BudgetSettlement["settlementKind"];
  budgetSettlementId?: string;
  evidenceRefs?: readonly ArtifactRef[];
  createdAt?: string;
}): BudgetSettlement {
  requireNonNegative(input.actualAmount, "budget_settlement.actual_amount_invalid");
  return {
    budgetSettlementId: input.budgetSettlementId ?? newId("bsettle"),
    budgetReservationId: input.budgetReservationId,
    actualAmount: input.actualAmount,
    settlementKind: input.settlementKind,
    evidenceRefs: input.evidenceRefs ?? [],
    createdAt: input.createdAt ?? nowIso(),
  };
}

export function createRunVersionLock(input: {
  harnessRunId: string;
  runtimeProfileVersion: string;
  runVersionLockId?: string;
  schemaVersion?: string;
  promptVersions?: Readonly<Record<string, string>>;
  policyVersions?: Readonly<Record<string, string>>;
  toolVersions?: Readonly<Record<string, string>>;
  modelVersions?: Readonly<Record<string, string>>;
  evalVersions?: Readonly<Record<string, string>>;
  guardrailVersions?: Readonly<Record<string, string>>;
  domainVersions?: Readonly<Record<string, string>>;
  createdAt?: string;
}): RunVersionLock {
  return {
    runVersionLockId: input.runVersionLockId ?? newId("rvlock"),
    harnessRunId: input.harnessRunId,
    schemaVersion: input.schemaVersion ?? CONTRACT_SCHEMA_VERSION,
    runtimeProfileVersion: input.runtimeProfileVersion,
    promptVersions: input.promptVersions ?? {},
    policyVersions: input.policyVersions ?? {},
    toolVersions: input.toolVersions ?? {},
    modelVersions: input.modelVersions ?? {},
    evalVersions: input.evalVersions ?? {},
    guardrailVersions: input.guardrailVersions ?? {},
    domainVersions: input.domainVersions ?? {},
    createdAt: input.createdAt ?? nowIso(),
  };
}

export function createArtifactVersionLockSet(input: {
  harnessRunId: string;
  artifactLocks: readonly ArtifactVersionLock[];
  artifactVersionLockSetId?: string;
  createdAt?: string;
}): ArtifactVersionLockSet {
  if (input.artifactLocks.length === 0) {
    throw new ValidationError(
      "artifact_version_lock_set.artifact_locks_required",
      "ArtifactVersionLockSet requires at least one artifact lock.",
    );
  }
  return {
    artifactVersionLockSetId: input.artifactVersionLockSetId ?? newId("avlocks"),
    harnessRunId: input.harnessRunId,
    artifactLocks: input.artifactLocks,
    createdAt: input.createdAt ?? nowIso(),
  };
}

export function createDecisionInputBundle(input: {
  harnessRunId: string;
  decisionKind: DecisionInputBundle["decisionKind"];
  riskClass: RiskClass;
  decisionInputBundleId?: string;
  nodeRunId?: string;
  contextRefs?: readonly ArtifactRef[];
  evidenceRefs?: readonly ArtifactRef[];
  policyFindings?: readonly PolicyFinding[];
  budgetSnapshotRef?: ArtifactRef;
  sideEffectRefs?: readonly string[];
  createdAt?: string;
}): DecisionInputBundle {
  return {
    decisionInputBundleId: input.decisionInputBundleId ?? newId("dib"),
    harnessRunId: input.harnessRunId,
    ...(input.nodeRunId != null ? { nodeRunId: input.nodeRunId } : {}),
    decisionKind: input.decisionKind,
    riskClass: input.riskClass,
    contextRefs: input.contextRefs ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    policyFindings: input.policyFindings ?? [],
    ...(input.budgetSnapshotRef != null ? { budgetSnapshotRef: input.budgetSnapshotRef } : {}),
    sideEffectRefs: input.sideEffectRefs ?? [],
    createdAt: input.createdAt ?? nowIso(),
  };
}

export function createHarnessDecision(input: {
  decisionInputBundleId: string;
  decisionKind: HarnessDecision["decisionKind"];
  decision: HarnessDecision["decision"];
  deciderType: HarnessDecision["deciderType"];
  deciderRef: string;
  reasonCode: string;
  harnessDecisionId?: string;
  expiresAt?: string;
  createdAt?: string;
}): HarnessDecision {
  return {
    harnessDecisionId: input.harnessDecisionId ?? newId("hdecision"),
    decisionInputBundleId: input.decisionInputBundleId,
    decisionKind: input.decisionKind,
    decision: input.decision,
    deciderType: input.deciderType,
    deciderRef: input.deciderRef,
    reasonCode: input.reasonCode,
    ...(input.expiresAt != null ? { expiresAt: input.expiresAt } : {}),
    createdAt: input.createdAt ?? nowIso(),
  };
}

export function createHumanResponsibilityRecord(input: {
  harnessDecisionId: string;
  humanActorRef: PrincipalRef;
  responsibilityScope: HumanResponsibilityRecord["responsibilityScope"];
  acknowledgedRiskClass: RiskClass;
  acknowledgementReceiptRef: ArtifactRef;
  humanResponsibilityRecordId?: string;
  effectiveFrom?: string;
  expiresAt?: string;
}): HumanResponsibilityRecord {
  if (isHighRisk(input.acknowledgedRiskClass) && input.expiresAt == null) {
    throw new ValidationError(
      "human_responsibility_record.expires_at_required",
      "High and critical human responsibility records require expiresAt.",
    );
  }
  return {
    humanResponsibilityRecordId: input.humanResponsibilityRecordId ?? newId("hrrecord"),
    harnessDecisionId: input.harnessDecisionId,
    humanActorRef: input.humanActorRef,
    responsibilityScope: input.responsibilityScope,
    acknowledgedRiskClass: input.acknowledgedRiskClass,
    acknowledgementReceiptRef: input.acknowledgementReceiptRef,
    effectiveFrom: input.effectiveFrom ?? nowIso(),
    ...(input.expiresAt != null ? { expiresAt: input.expiresAt } : {}),
  };
}

export function createPlatformFactEvent<TPayload extends JsonValue>(input: {
  eventType: `platform.${string}`;
  aggregateType: string;
  aggregateId: string;
  aggregateSeq: number;
  tenantId: string;
  runId: string;
  traceId: string;
  payload: TPayload;
  eventId?: string;
  schemaVersion?: number;
  causationId?: string;
  correlationId?: string;
  payloadHash?: string;
  replayBehavior?: EventReplayBehavior;
  schemaOwner?: string;
  consumerContractTests?: readonly string[];
  occurredAt?: string;
}): PlatformFactEvent<TPayload> {
  assertPlatformEventType(input.eventType);
  return {
    eventId: input.eventId ?? newId("evt"),
    runId: input.runId,
    eventType: input.eventType,
    schemaVersion: input.schemaVersion ?? 1,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    aggregateSeq: input.aggregateSeq,
    tenantId: input.tenantId,
    traceId: input.traceId,
    ...(input.causationId != null ? { causationId: input.causationId } : {}),
    ...(input.correlationId != null ? { correlationId: input.correlationId } : {}),
    payloadHash: input.payloadHash ?? newId("payloadhash"),
    payload: input.payload,
    replayBehavior: input.replayBehavior ?? "replay_as_fact",
    sourceOfTruth: "platform",
    schemaOwner: input.schemaOwner ?? "platform-runtime",
    consumerContractTests: input.consumerContractTests ?? [],
    occurredAt: input.occurredAt ?? nowIso(),
  };
}

export function createOapeflirViewEvent<TPayload extends JsonValue>(input: {
  eventType: `oapeflir.view.${string}` | `oapeflir.rationale.${string}`;
  aggregateType: string;
  aggregateId: string;
  aggregateSeq: number;
  tenantId: string;
  runId: string;
  traceId: string;
  payload: TPayload;
  derivedFromEventIds: readonly string[];
  eventId?: string;
  schemaVersion?: number;
  causationId?: string;
  correlationId?: string;
  payloadHash?: string;
  replayBehavior?: EventReplayBehavior;
  schemaOwner?: string;
  consumerContractTests?: readonly string[];
  occurredAt?: string;
}): OapeflirViewEvent<TPayload> {
  assertOapeflirViewEventType(input.eventType);
  if (input.derivedFromEventIds.length === 0) {
    throw new ValidationError(
      "oapeflir_view_event.derived_from_required",
      "OAPEFLIR view events require at least one source event.",
    );
  }
  return {
    eventId: input.eventId ?? newId("evt"),
    runId: input.runId,
    eventType: input.eventType,
    schemaVersion: input.schemaVersion ?? 1,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    aggregateSeq: input.aggregateSeq,
    tenantId: input.tenantId,
    traceId: input.traceId,
    ...(input.causationId != null ? { causationId: input.causationId } : {}),
    ...(input.correlationId != null ? { correlationId: input.correlationId } : {}),
    payloadHash: input.payloadHash ?? newId("payloadhash"),
    payload: input.payload,
    replayBehavior: input.replayBehavior ?? "simulate",
    sourceOfTruth: "projection",
    schemaOwner: input.schemaOwner ?? "oapeflir-projection",
    consumerContractTests: input.consumerContractTests ?? [],
    occurredAt: input.occurredAt ?? nowIso(),
    derivedFromEventIds: input.derivedFromEventIds,
    projectionOnly: true,
  };
}

export function isPlatformFactEvent(event: EventEnvelope): event is PlatformFactEvent {
  return event.eventType.startsWith("platform.");
}

export function isOapeflirViewEvent(event: EventEnvelope): event is OapeflirViewEvent {
  return event.eventType.startsWith("oapeflir.view.") || event.eventType.startsWith("oapeflir.rationale.");
}

export function canTruthConsumerConsume(event: EventEnvelope): boolean {
  return isPlatformFactEvent(event);
}

function requireNonEmpty(value: string, code: string): void {
  if (value.trim().length === 0) {
    throw new ValidationError(code, "Required string cannot be empty.");
  }
}

function requireNonNegative(value: number, code: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new ValidationError(code, "Value must be a finite non-negative number.");
  }
}

function requirePositive(value: number, code: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ValidationError(code, "Value must be a finite positive number.");
  }
}

function isHighRisk(riskClass: RiskClass): boolean {
  return riskClass === "high" || riskClass === "critical";
}

function assertPlatformEventType(eventType: string): void {
  if (!eventType.startsWith("platform.")) {
    throw new ValidationError("platform_fact_event.namespace_required", "Platform fact events must use platform.*.");
  }
}

function assertOapeflirViewEventType(eventType: string): void {
  if (!eventType.startsWith("oapeflir.view.") && !eventType.startsWith("oapeflir.rationale.")) {
    throw new ValidationError(
      "oapeflir_view_event.namespace_required",
      "OAPEFLIR view events must use oapeflir.view.* or oapeflir.rationale.*.",
    );
  }
}
