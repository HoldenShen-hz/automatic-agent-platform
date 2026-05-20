import type { DecisionDirective, OperationalDirective } from "../control-directive/index.js";
import type { MissionBinding, MissionRef } from "../mission/index.js";

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

export type PrincipalType = "human" | "agent" | "system" | "service" | "tool" | "organization";

interface PrincipalRefBase {
  readonly principalId: string;
  readonly type: PrincipalType;
  readonly tenantId: string;
  readonly roles: readonly string[];
  readonly displayName?: string;
  readonly authorizationLevel?: "viewer" | "operator" | "admin";
}

export interface HumanPrincipalRef extends PrincipalRefBase {
  readonly type: "human";
}

export interface AgentPrincipalRef extends PrincipalRefBase {
  readonly type: "agent";
}

export interface SystemPrincipalRef extends PrincipalRefBase {
  readonly type: "system";
}

export interface ServicePrincipalRef extends PrincipalRefBase {
  readonly type: "service";
}

export interface ToolPrincipalRef extends PrincipalRefBase {
  readonly type: "tool";
}

export interface OrganizationPrincipalRef extends PrincipalRefBase {
  readonly type: "organization";
}

export type PrincipalRef =
  | HumanPrincipalRef
  | AgentPrincipalRef
  | SystemPrincipalRef
  | ServicePrincipalRef
  | ToolPrincipalRef
  | OrganizationPrincipalRef;

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
  readonly state: "not_required" | "pending_user_confirmation" | "confirmed" | "expired" | "denied";
  readonly riskPreviewVersion?: string;
  readonly scope?: string;
  readonly actor?: string;
  readonly timestamp?: string;
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
  readonly missionRef?: MissionRef;
  readonly missionSnapshotRef?: string;
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
  readonly sourcePlane?: string;
  readonly targetPlane?: string;
  readonly directives?: readonly (OperationalDirective | DecisionDirective)[];
  readonly missionRef?: MissionRef;
  readonly missionSnapshotRef?: string;
}

export interface HarnessBudgetEnvelope {
  readonly budgetLedgerId: string;
  readonly currency: string;
  readonly maxSteps?: number;
  readonly maxCost?: number;
  readonly maxDurationMs?: number;
  readonly maxModelTokens?: number;
  readonly maxContextTokens?: number;
  readonly maxOutputTokens?: number;
}

export interface HarnessAuditTrail {
  readonly auditRefs: readonly string[];
  readonly evidenceRefs: readonly ArtifactRef[];
  readonly lastEventId?: string;
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
  | "cancelled"
  | "aborted";

export const HARNESS_RUN_TERMINAL_STATUSES = ["completed", "failed", "cancelled", "aborted"] as const;

export interface HarnessRun {
  readonly harnessRunId: string;
  readonly tenantId: string;
  readonly orgId: string;
  readonly traceId: string;
  readonly goal?: string;
  readonly mode?: string;
  readonly riskLevel: RiskClass;
  readonly riskProfile: RiskPreview;
  readonly ownership: Readonly<{ ownerId: string; ownerType: string }>;
  readonly auditRefs: readonly string[];
  readonly auditTrail: HarnessAuditTrail;
  readonly domainId: string;
  readonly confirmedTaskSpecId: string;
  readonly requestEnvelopeId: string;
  readonly requestHash: string;
  readonly status: HarnessRunStatus;
  readonly constraintPackRef: string;
  readonly versionLockId: string;
  readonly planGraphBundleId?: string;
  readonly budgetLedgerId: string;
  readonly budgetEnvelope: HarnessBudgetEnvelope;
  readonly currentSeq: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly terminalAt?: string;
  readonly terminalReason?: string;
  readonly leaseId?: string;
  readonly fencingToken: string;
  readonly missionBinding?: MissionBinding;
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
  readonly criticalPathRank?: ReadonlyMap<string, number>;
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
  readonly missionSnapshotRef?: string;
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
  readonly sideEffects: readonly string[];
  readonly compensation: readonly string[];
  readonly leaseId?: string;
  readonly fencingToken: string;
  readonly currentSeq: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly terminalReason?: string;
  readonly missionSnapshotRef?: string;
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
  readonly leaseId?: string;
  readonly fencingToken?: string;
  readonly approvalRef?: string;
  readonly preCommitPolicyProofRef: ArtifactRef;
  readonly externalRef?: string;
  readonly deadline: string;
  readonly rollbackHandler?: {
    readonly handler: string;
    readonly timeout: number;
  };
  readonly compensationPlan?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
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
  readonly tier?: "platform" | "tenant" | "pack" | "step";
  readonly scopeKey?: string;
  readonly parentBudgetLedgerId?: string;
  readonly currency: string;
  readonly hardCap: number;
  readonly softCap?: number;
  readonly reservedAmount: number;
  readonly settledAmount: number;
  readonly releasedAmount: number;
  readonly status: "open" | "soft_cap_reached" | "hard_cap_reached" | "closed" | "settling" | "reserving" | "releasing";
  readonly updatedAt?: string;
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
  readonly updatedAt?: string;
  readonly version: number;
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
  readonly hierarchyLedgers?: readonly BudgetLedger[];
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
  readonly bundleId?: string;
  readonly evaluator: Readonly<{
    readonly score: number;
    readonly reasoning: string;
  }>;
  readonly policy: Readonly<{
    readonly policyIds: readonly string[];
    readonly constraintPackRef: string;
  }>;
  readonly budget: Readonly<{
    readonly remainingSteps: number;
    readonly remainingCost: number;
    readonly remainingDurationMs: number;
  }>;
  readonly risk: Readonly<{
    readonly currentScore: number;
    readonly maxScore: number;
    readonly escalationThreshold: number;
  }>;
  readonly node: Readonly<{
    readonly nodeId: string;
    readonly nodeType: string;
    readonly status: string;
  }>;
  readonly sideEffect: Readonly<{
    readonly mayCommit: boolean;
    readonly reversible: boolean;
  }>;
  readonly hitl: Readonly<{
    readonly pending: boolean;
    readonly requestId: string | null;
  }>;
  readonly guardrail: Readonly<{
    readonly passed: boolean;
    readonly requiresHuman: boolean;
    readonly suggestedAction: string;
    readonly findings: readonly { readonly code: string; readonly message: string }[];
  }> | null;
  readonly capturedAt?: string;
  readonly createdAt: string;
}

export type HarnessDecisionType =
  | "accept"
  | "retry_same_plan"
  | "replan"
  | "escalate_to_human"
  | "downgrade_mode"
  | "abort";

export type HarnessDecisionExtensibleType =
  | HarnessDecisionType
  | "quarantine"
  | "revoke_approval"
  | "pause_for_external"
  | "require_revalidation"
  | "retry"
  | "escalate"
  | "reject"
  | "takeover"
  | "patch";

export interface HarnessDecision {
  readonly harnessDecisionId: string;
  readonly decisionInputBundleId: string;
  readonly decisionKind: DecisionInputBundle["decisionKind"];
  readonly decision: HarnessDecisionExtensibleType;
  readonly deciderType: "system" | "policy" | "evaluator" | "human" | "operator" | "llm";
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
  readonly source: string;
  readonly correlationId: string;
}

export interface OapeflirViewEvent<TPayload extends JsonValue = JsonValue> extends EventEnvelope<TPayload> {
  readonly eventType: `oapeflir.view.${string}` | `oapeflir.rationale.${string}`;
  readonly derivedFromEventIds: readonly string[];
  readonly projectionOnly: true;
}
