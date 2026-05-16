import { z } from "zod";

import { ValidationError } from "../errors.js";
import type { CanonicalContractName } from "./contract-models.js";
import { MissionBindingSchema, MissionRefSchema } from "../mission/index.js";

export const EXECUTABLE_CONTRACT_NAMES = [
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
] as const satisfies readonly CanonicalContractName[];

export const RiskClassSchema = z.enum(["low", "medium", "high", "critical"]);
export const TaskInputSourceSchema = z.enum(["nl", "webhook", "ui", "cli", "scheduler", "external_event"]);
export const AmbiguityPolicySchema = z.enum(["safe_default", "require_confirmation", "reject"]);
export const BudgetResourceKindSchema = z.enum(["token", "tool", "api", "compute", "human", "side_effect", "other"]);

export const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]),
);

export const PrincipalRefSchema = z.object({
  principalId: z.string().min(1),
  tenantId: z.string().min(1),
  roles: z.array(z.string()),
  displayName: z.string().optional(),
});

export const ArtifactRefSchema = z.object({
  artifactId: z.string().min(1),
  uri: z.string().min(1),
  hash: z.string().optional(),
  version: z.string().optional(),
});

export const RiskPreviewSchema = z.object({
  riskClass: RiskClassSchema,
  reasons: z.array(z.string()),
});

// R9-40 fix: Add state and riskPreview fields to schema for full lifecycle tracking
export const UserConfirmationReceiptSchema = z.object({
  receiptId: z.string().min(1),
  confirmedBy: PrincipalRefSchema,
  riskClass: RiskClassSchema,
  confirmedAt: z.string().min(1),
  expiresAt: z.string().optional(),
  // R9-40 fix: State field for confirmation lifecycle
  state: z.enum(["not_required", "pending_user_confirmation", "confirmed", "expired", "denied"]),
  // R9-40 fix: Risk preview fields for confirmed state
  riskPreviewVersion: z.string().optional(),
  scope: z.string().optional(),
  actor: z.string().optional(),
  timestamp: z.string().optional(),
});

export const BudgetIntentSchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().min(1),
  resourceKinds: z.array(BudgetResourceKindSchema),
});

export const TaskDraftSchema = z.object({
  taskDraftId: z.string().min(1),
  tenantId: z.string().min(1),
  principal: PrincipalRefSchema,
  source: TaskInputSourceSchema,
  rawInputRef: ArtifactRefSchema.optional(),
  domainId: z.string().min(1),
  normalizedIntent: JsonValueSchema,
  missingFields: z.array(z.string()),
  riskPreview: RiskPreviewSchema,
  ambiguityPolicy: AmbiguityPolicySchema,
  createdAt: z.string().min(1),
  expiresAt: z.string().optional(),
});

export const ConfirmedTaskSpecSchema = z.object({
  confirmedTaskSpecId: z.string().min(1),
  taskDraftId: z.string().min(1),
  tenantId: z.string().min(1),
  principal: PrincipalRefSchema,
  domainId: z.string().min(1),
  goal: z.string().min(1),
  inputs: JsonValueSchema,
  constraintPackRef: z.string().min(1),
  riskClass: RiskClassSchema,
  confirmationReceipt: UserConfirmationReceiptSchema.optional(),
  idempotencyKey: z.string().min(1),
  traceId: z.string().min(1),
  createdAt: z.string().min(1),
  missionRef: MissionRefSchema.optional(),
  missionSnapshotRef: z.string().min(1).optional(),
});

export const RequestEnvelopeSchema = z.object({
  requestId: z.string().min(1),
  confirmedTaskSpecId: z.string().min(1),
  tenantId: z.string().min(1),
  principal: PrincipalRefSchema,
  domainId: z.string().min(1),
  traceId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  priority: z.number().int(),
  requestHash: z.string().min(1),
  constraintPackRef: z.string().min(1),
  budgetIntent: BudgetIntentSchema,
  policyContext: JsonValueSchema,
  artifactRefs: z.array(ArtifactRefSchema),
  submittedAt: z.string().min(1),
  sourcePlane: z.string().min(1).optional(),
  targetPlane: z.string().min(1).optional(),
  // R27-17 FIX: ADR-021 directives field for runtime control across planes.
  directives: z.any().optional(),
  missionRef: MissionRefSchema.optional(),
  missionSnapshotRef: z.string().min(1).optional(),
});

export const HarnessBudgetEnvelopeSchema = z.object({
  budgetLedgerId: z.string().min(1),
  currency: z.string().min(1),
  maxSteps: z.number().int().positive().optional(),
  maxCost: z.number().nonnegative().optional(),
  maxDurationMs: z.number().int().positive().optional(),
  maxModelTokens: z.number().int().positive().optional(),
  maxContextTokens: z.number().int().positive().optional(),
  maxOutputTokens: z.number().int().positive().optional(),
});

export const HarnessAuditTrailSchema = z.object({
  auditRefs: z.array(z.string()),
  evidenceRefs: z.array(ArtifactRefSchema),
  lastEventId: z.string().min(1).optional(),
});

export const HarnessRunStatusSchema = z.enum([
  "created",
  "admitted",
  "planning",
  "ready",
  "running",
  "pausing",
  "paused",
  "resuming",
  "replanning",
  "compensating",
  "completed",
  "failed",
  "cancelled",
  "aborted",
]);

export const HarnessRunSchema = z.object({
  harnessRunId: z.string().min(1),
  tenantId: z.string().min(1),
  orgId: z.string().min(1),
  traceId: z.string().min(1),
  riskLevel: RiskClassSchema,
  riskProfile: RiskPreviewSchema,
  ownership: z.object({
    ownerId: z.string().min(1),
    ownerType: z.string().min(1),
  }),
  auditRefs: z.array(z.string()),
  auditTrail: HarnessAuditTrailSchema,
  domainId: z.string().min(1),
  confirmedTaskSpecId: z.string().min(1),
  requestEnvelopeId: z.string().min(1),
  requestHash: z.string().min(1),
  status: HarnessRunStatusSchema,
  constraintPackRef: z.string().min(1),
  versionLockId: z.string().min(1),
  planGraphBundleId: z.string().optional(),
  budgetLedgerId: z.string().min(1),
  budgetEnvelope: HarnessBudgetEnvelopeSchema,
  currentSeq: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  terminalAt: z.string().optional(),
  terminalReason: z.string().optional(),
  leaseId: z.string().optional(),
  fencingToken: z.string().min(1),
  missionBinding: MissionBindingSchema.optional(),
});

export const PlanNodeTypeSchema = z.enum(["tool", "llm", "hitl_wait", "subgraph", "evaluator", "router", "compensation"]);
export const DependencyTypeSchema = z.enum(["hard", "soft", "compensation", "retry", "replan"]);

export const SideEffectProfileSchema = z.object({
  mayCommitExternalEffect: z.boolean(),
  reversible: z.boolean(),
});

export const PlanNodeSchema = z.object({
  nodeId: z.string().min(1),
  nodeType: PlanNodeTypeSchema,
  inputRefs: z.array(z.string()),
  outputSchemaRef: z.string().min(1),
  riskClass: RiskClassSchema,
  budgetIntent: BudgetIntentSchema,
  sideEffectProfile: SideEffectProfileSchema,
  retryPolicyRef: z.string().min(1),
  timeoutMs: z.number().int().positive(),
});

export const PlanEdgeSchema = z.object({
  edgeId: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  condition: JsonValueSchema,
  dependencyType: DependencyTypeSchema,
});

export const PlanGraphSchema = z.object({
  graphId: z.string().min(1),
  nodes: z.array(PlanNodeSchema).min(1),
  edges: z.array(PlanEdgeSchema),
  entryNodeIds: z.array(z.string()).min(1),
  terminalNodeIds: z.array(z.string()).min(1),
  joinStrategy: z.enum(["all", "any", "first_success", "policy"]),
  graphHash: z.string().min(1),
});

export const ReadyNodeSchedulingPolicySchema = z.object({
  policyId: z.string().min(1),
  strategy: z.enum(["deterministic_fifo", "priority_then_fifo", "risk_isolated"]),
});

export const GraphValidationReportSchema = z.object({
  valid: z.boolean(),
  findings: z.array(z.string()),
  normalizedNodeIds: z.array(z.string()).optional(),
  riskPropagation: z.array(z.object({
    nodeId: z.string().min(1),
    inheritedRiskClass: RiskClassSchema,
    reasons: z.array(z.string()),
  })).optional(),
  worstPath: z.object({
    pathNodeIds: z.array(z.string()),
    riskClass: RiskClassSchema,
    estimatedBudgetAmount: z.number().nonnegative(),
    timeoutMs: z.number().int().nonnegative(),
  }).optional(),
});

export const PlanGraphBundleSchema = z.object({
  planGraphBundleId: z.string().min(1),
  harnessRunId: z.string().min(1),
  graphVersion: z.number().int().positive(),
  graph: PlanGraphSchema,
  schedulerPolicy: ReadyNodeSchedulingPolicySchema,
  budgetPlanRef: z.string().min(1),
  riskProfile: RiskPreviewSchema,
  validationReport: GraphValidationReportSchema,
  artifactRefs: z.array(ArtifactRefSchema),
  createdAt: z.string().min(1),
  missionSnapshotRef: z.string().min(1).optional(),
});

export const GraphPatchOperationTypeSchema = z.enum([
  "add_node",
  "add_edge",
  "disable_edge",
  "add_compensation_node",
  "add_failure_path",
  "mark_skipped",
  "append_subgraph",
]);

export const GraphPatchOperationSchema = z.object({
  operationId: z.string().min(1),
  operationType: GraphPatchOperationTypeSchema,
  targetRef: z.string().min(1),
  payload: JsonValueSchema,
});

export const GraphPatchSchema = z.object({
  graphPatchId: z.string().min(1),
  harnessRunId: z.string().min(1),
  baseGraphVersion: z.number().int().nonnegative(),
  newGraphVersion: z.number().int().positive(),
  operations: z.array(GraphPatchOperationSchema).min(1),
  affectedExecutedNodes: z.array(z.string()),
  affectedSideEffects: z.array(z.string()),
  compatibilityClass: z.enum([
    "safe_append",
    "requires_checkpoint_revalidation",
    "requires_human_approval",
    "incompatible_restart_required",
  ]),
  compensationPlanRef: ArtifactRefSchema.optional(),
  policyProofRef: ArtifactRefSchema,
  auditRef: ArtifactRefSchema,
});

export const NodeRunStatusSchema = z.enum([
  "created",
  "ready",
  "leased",
  "running",
  "retry_wait",
  "awaiting_hitl",
  "reconciling",
  "succeeded",
  "failed",
  "skipped",
  "cancelled",
  "dependency_failed",
  "policy_blocked",
  "aborted",
]);

export const NodeRunSchema = z.object({
  nodeRunId: z.string().min(1),
  harnessRunId: z.string().min(1),
  planGraphBundleId: z.string().min(1),
  graphVersion: z.number().int().positive(),
  nodeId: z.string().min(1),
  status: NodeRunStatusSchema,
  attemptCount: z.number().int().nonnegative(),
  sideEffects: z.array(z.string()),
  compensation: z.array(z.string()),
  leaseId: z.string().optional(),
  fencingToken: z.string().min(1),
  currentSeq: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  terminalReason: z.string().optional(),
  missionSnapshotRef: z.string().min(1).optional(),
});

export const NodeAttemptSchema = z.object({
  nodeAttemptId: z.string().min(1),
  nodeRunId: z.string().min(1),
  attemptNo: z.number().int().positive(),
  attemptKind: z.enum(["initial", "retry", "redrive", "recovery"]),
  startedAt: z.string().min(1),
  completedAt: z.string().optional(),
  executorRef: z.string().min(1),
  inputSnapshotRef: ArtifactRefSchema,
  receiptId: z.string().optional(),
});

export const AttemptLineageSchema = z.object({
  attemptLineageId: z.string().min(1),
  nodeRunId: z.string().min(1),
  previousAttemptId: z.string().optional(),
  nextAttemptId: z.string().optional(),
  reason: z.string().min(1),
  createdBy: z.string().min(1),
  createdAt: z.string().min(1),
});

export const AppErrorRefSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean(),
});

export const NodeAttemptReceiptSchema = z.object({
  nodeAttemptReceiptId: z.string().min(1),
  nodeAttemptId: z.string().min(1),
  nodeRunId: z.string().min(1),
  harnessRunId: z.string().min(1),
  planGraphId: z.string().min(1),
  graphVersion: z.number().int().nonnegative(),
  receiptKind: z.enum(["tool", "llm", "hitl", "subgraph", "evaluator", "router"]),
  status: z.enum(["succeeded", "failed", "partial", "blocked"]),
  duration: z.number().nonnegative(),
  outputRef: ArtifactRefSchema.optional(),
  error: AppErrorRefSchema.optional(),
  errorDetail: z.string().min(1),
  sideEffectRefs: z.array(z.string()),
  budgetSettlementRefs: z.array(z.string()),
  evidenceRefs: z.array(ArtifactRefSchema),
  producedAt: z.string().min(1),
});

export const SideEffectStatusSchema = z.enum([
  "proposed",
  "approved",
  "reserved",
  "committing",
  "committed",
  "confirming",
  "confirmed",
  "ambiguous",
  "manual_review_required",
  "reconciling",
  "compensation_required",
  "compensating",
  "compensated",
  "failed",
  "revoked",
  "expired",
]);

export const SideEffectRecordSchema = z.object({
  sideEffectId: z.string().min(1),
  harnessRunId: z.string().min(1),
  nodeRunId: z.string().min(1),
  nodeAttemptId: z.string().min(1),
  effectKind: z.enum(["file_write", "external_api", "message_send", "transaction", "tool_commit", "other"]),
  idempotencyKey: z.string().min(1),
  status: SideEffectStatusSchema,
  riskClass: RiskClassSchema,
  approvalRef: z.string().optional(),
  preCommitPolicyProofRef: ArtifactRefSchema,
  externalRef: z.string().optional(),
  /** Per-effect deadline (ISO 8601 timestamp) - must commit before this time per §14.11 */
  deadline: z.string().min(1),
  /** R13-35: Inline rollback handler specification with timeout per §14.11 */
  rollbackHandler: z.object({
    handler: z.string(),
    timeout: z.number().int().positive(),
  }).optional(),
  /** Inline compensation plan reference per §14.11 */
  compensationPlan: z.string().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  /** Version for CAS optimistic locking */
  version: z.number().int().nonnegative(),
});

export const ReconciliationRecordSchema = z.object({
  reconciliationId: z.string().min(1),
  sideEffectId: z.string().min(1),
  probeKind: z.string().min(1),
  externalObservedState: JsonValueSchema,
  result: z.enum(["confirmed", "not_found", "ambiguous", "failed"]),
  evidenceRefs: z.array(ArtifactRefSchema),
  nextAction: z.enum(["mark_confirmed", "retry_probe", "compensate", "escalate_hitl", "mark_failed"]),
  createdAt: z.string().min(1),
});

export const CompensationRecordSchema = z.object({
  compensationId: z.string().min(1),
  sideEffectId: z.string().min(1),
  harnessRunId: z.string().min(1),
  planRef: ArtifactRefSchema,
  status: z.enum(["planned", "running", "succeeded", "failed", "requires_human"]),
  evidenceRefs: z.array(ArtifactRefSchema),
  createdAt: z.string().min(1),
  completedAt: z.string().optional(),
});

export const BudgetLedgerSchema = z.object({
  budgetLedgerId: z.string().min(1),
  tenantId: z.string().min(1),
  harnessRunId: z.string().min(1),
  tier: z.enum(["platform", "tenant", "pack", "step"]).optional(),
  scopeKey: z.string().min(1).optional(),
  parentBudgetLedgerId: z.string().min(1).optional(),
  currency: z.string().min(1),
  hardCap: z.number().nonnegative(),
  softCap: z.number().nonnegative().optional(),
  reservedAmount: z.number().nonnegative(),
  settledAmount: z.number().nonnegative(),
  releasedAmount: z.number().nonnegative(),
  status: z.enum(["open", "soft_cap_reached", "hard_cap_reached", "closed"]),
  version: z.number().int().nonnegative(),
});

export const BudgetReservationSchema = z.object({
  budgetReservationId: z.string().min(1),
  budgetLedgerId: z.string().min(1),
  harnessRunId: z.string().min(1),
  nodeRunId: z.string().optional(),
  amount: z.number().positive(),
  resourceKind: BudgetResourceKindSchema,
  status: z.enum(["reserved", "settled", "released", "expired", "rejected"]),
  expiresAt: z.string().min(1),
  createdAt: z.string().min(1),
  /** Version for CAS optimistic locking */
  version: z.number().int().nonnegative(),
});

export const BudgetSettlementSchema = z.object({
  budgetSettlementId: z.string().min(1),
  budgetReservationId: z.string().min(1),
  actualAmount: z.number().nonnegative(),
  settlementKind: z.enum(["final", "partial", "release_unused", "correction"]),
  evidenceRefs: z.array(ArtifactRefSchema),
  createdAt: z.string().min(1),
});

export const RunVersionLockSchema = z.object({
  runVersionLockId: z.string().min(1),
  harnessRunId: z.string().min(1),
  schemaVersion: z.string().min(1),
  runtimeProfileVersion: z.string().min(1),
  promptVersions: z.record(z.string()),
  policyVersions: z.record(z.string()),
  toolVersions: z.record(z.string()),
  modelVersions: z.record(z.string()),
  evalVersions: z.record(z.string()),
  guardrailVersions: z.record(z.string()),
  domainVersions: z.record(z.string()),
  createdAt: z.string().min(1),
});

export const ArtifactVersionLockSchema = z.object({
  artifactId: z.string().min(1),
  version: z.string().min(1),
  hash: z.string().min(1),
  storageUri: z.string().min(1),
  retentionPolicyRef: z.string().min(1),
});

export const ArtifactVersionLockSetSchema = z.object({
  artifactVersionLockSetId: z.string().min(1),
  harnessRunId: z.string().min(1),
  artifactLocks: z.array(ArtifactVersionLockSchema).min(1),
  createdAt: z.string().min(1),
});

export const PolicyFindingSchema = z.object({
  code: z.string().min(1),
  severity: RiskClassSchema,
  message: z.string().min(1),
});

export const DecisionInputBundleSchema = z.object({
  decisionInputBundleId: z.string().min(1),
  harnessRunId: z.string().min(1),
  nodeRunId: z.string().optional(),
  decisionKind: z.enum(["approve", "reject", "patch", "takeover", "resume", "abort", "retry", "replan"]),
  riskClass: RiskClassSchema,
  contextRefs: z.array(ArtifactRefSchema),
  evidenceRefs: z.array(ArtifactRefSchema),
  policyFindings: z.array(PolicyFindingSchema),
  budgetSnapshotRef: ArtifactRefSchema.optional(),
  sideEffectRefs: z.array(z.string()),
  createdAt: z.string().min(1),
});

export const HarnessDecisionSchema = z.object({
  harnessDecisionId: z.string().min(1),
  decisionInputBundleId: z.string().min(1),
  decisionKind: z.enum(["approve", "reject", "patch", "takeover", "resume", "abort", "retry", "replan"]),
  // R2-26/R2-27/R2-28 fix: Canonical 6 decisions per §58.6 + production extensions
  // Basic 6: accept, retry_same_plan, replan, escalate_to_human, downgrade_mode, abort
  // Production extensions: quarantine, revoke_approval, pause_for_external, require_revalidation
  decision: z.enum([
    "accept",
    "retry_same_plan",
    "replan",
    "escalate_to_human",
    "downgrade_mode",
    "abort",
    "quarantine",
    "revoke_approval",
    "pause_for_external",
    "require_revalidation",
  ]),
  deciderType: z.enum(["system", "policy", "evaluator", "human", "operator", "llm"]),
  deciderRef: z.string().min(1),
  reasonCode: z.string().min(1),
  expiresAt: z.string().optional(),
  createdAt: z.string().min(1),
});

export const HumanResponsibilityRecordSchema = z.object({
  humanResponsibilityRecordId: z.string().min(1),
  harnessDecisionId: z.string().min(1),
  humanActorRef: PrincipalRefSchema,
  responsibilityScope: z.enum(["approval", "override", "takeover", "patch", "resume", "abort", "compensation"]),
  acknowledgedRiskClass: RiskClassSchema,
  acknowledgementReceiptRef: ArtifactRefSchema,
  effectiveFrom: z.string().min(1),
  expiresAt: z.string().optional(),
});

export const EventEnvelopeSchema = z.object({
  eventId: z.string().min(1),
  runId: z.string().min(1),
  eventType: z.string().min(1),
  schemaVersion: z.number().int().nonnegative(),
  aggregateType: z.string().min(1),
  aggregateId: z.string().min(1),
  aggregateSeq: z.number().int().positive(),
  tenantId: z.string().min(1),
  traceId: z.string().min(1),
  causationId: z.string().optional(),
  correlationId: z.string().optional(),
  payloadHash: z.string().min(1),
  payload: JsonValueSchema,
  replayBehavior: z.enum(["replay_as_fact", "skip_side_effect", "simulate", "forbidden"]),
  sourceOfTruth: z.enum(["platform", "projection"]).optional(),
  schemaOwner: z.string().optional(),
  consumerContractTests: z.array(z.string()).optional(),
  occurredAt: z.string().min(1),
});

export const PlatformFactEventSchema = EventEnvelopeSchema.extend({
  eventType: z.string().regex(/^platform\./),
  source: z.string().min(1),
  correlationId: z.string().min(1),
});

export const OapeflirViewEventSchema = EventEnvelopeSchema.extend({
  eventType: z.string().regex(/^oapeflir\.(view|rationale)\./),
  derivedFromEventIds: z.array(z.string()).min(1),
  projectionOnly: z.literal(true),
});

export const CONTRACT_ZOD_SCHEMAS = {
  TaskDraft: TaskDraftSchema,
  ConfirmedTaskSpec: ConfirmedTaskSpecSchema,
  RequestEnvelope: RequestEnvelopeSchema,
  HarnessRun: HarnessRunSchema,
  PlanGraphBundle: PlanGraphBundleSchema,
  PlanGraph: PlanGraphSchema,
  PlanNode: PlanNodeSchema,
  PlanEdge: PlanEdgeSchema,
  GraphPatch: GraphPatchSchema,
  GraphPatchOperation: GraphPatchOperationSchema,
  NodeRun: NodeRunSchema,
  NodeAttempt: NodeAttemptSchema,
  AttemptLineage: AttemptLineageSchema,
  NodeAttemptReceipt: NodeAttemptReceiptSchema,
  SideEffectRecord: SideEffectRecordSchema,
  ReconciliationRecord: ReconciliationRecordSchema,
  CompensationRecord: CompensationRecordSchema,
  BudgetLedger: BudgetLedgerSchema,
  BudgetReservation: BudgetReservationSchema,
  BudgetSettlement: BudgetSettlementSchema,
  RunVersionLock: RunVersionLockSchema,
  ArtifactVersionLockSet: ArtifactVersionLockSetSchema,
  DecisionInputBundle: DecisionInputBundleSchema,
  HarnessDecision: HarnessDecisionSchema,
  HumanResponsibilityRecord: HumanResponsibilityRecordSchema,
  EventEnvelope: EventEnvelopeSchema,
  PlatformFactEvent: PlatformFactEventSchema,
  OapeflirViewEvent: OapeflirViewEventSchema,
} satisfies Record<CanonicalContractName, z.ZodTypeAny>;

export type ContractReplayBehavior = "replay_as_fact" | "skip_side_effect" | "simulate" | "forbidden";
export type ContractFailureBehavior = "reject" | "reject_and_emit_incident" | "quarantine" | "escalate_to_human";

export interface ContractJsonSchema {
  readonly $schema: "https://json-schema.org/draft/2020-12/schema";
  readonly title: CanonicalContractName;
  readonly type: "object";
  readonly required: readonly string[];
  readonly additionalProperties: boolean;
}

export interface ExecutableContractDescriptor {
  readonly name: CanonicalContractName;
  readonly schemaVersion: "v4.3";
  readonly zodSchema: z.ZodTypeAny;
  readonly jsonSchema: ContractJsonSchema;
  readonly replayBehavior: ContractReplayBehavior;
  readonly failureBehavior: ContractFailureBehavior;
  readonly sourceOfTruth: "platform" | "projection";
}

const REQUIRED_FIELDS = {
  TaskDraft: ["taskDraftId", "tenantId", "principal", "source", "domainId", "normalizedIntent", "missingFields", "riskPreview", "ambiguityPolicy", "createdAt"],
  ConfirmedTaskSpec: ["confirmedTaskSpecId", "taskDraftId", "tenantId", "principal", "domainId", "goal", "inputs", "constraintPackRef", "riskClass", "idempotencyKey", "traceId", "createdAt"],
  RequestEnvelope: ["requestId", "confirmedTaskSpecId", "tenantId", "principal", "domainId", "traceId", "idempotencyKey", "priority", "requestHash", "constraintPackRef", "budgetIntent", "policyContext", "artifactRefs", "submittedAt"],
  HarnessRun: ["harnessRunId", "tenantId", "domainId", "confirmedTaskSpecId", "requestEnvelopeId", "requestHash", "status", "constraintPackRef", "versionLockId", "budgetLedgerId", "currentSeq", "createdAt", "updatedAt"],
  PlanGraphBundle: ["planGraphBundleId", "harnessRunId", "graphVersion", "graph", "schedulerPolicy", "budgetPlanRef", "riskProfile", "validationReport", "artifactRefs", "createdAt"],
  PlanGraph: ["graphId", "nodes", "edges", "entryNodeIds", "terminalNodeIds", "joinStrategy", "graphHash"],
  PlanNode: ["nodeId", "nodeType", "inputRefs", "outputSchemaRef", "riskClass", "budgetIntent", "sideEffectProfile", "retryPolicyRef", "timeoutMs"],
  PlanEdge: ["edgeId", "fromNodeId", "toNodeId", "condition", "dependencyType"],
  GraphPatch: ["graphPatchId", "harnessRunId", "baseGraphVersion", "newGraphVersion", "operations", "affectedExecutedNodes", "affectedSideEffects", "compatibilityClass", "policyProofRef", "auditRef"],
  GraphPatchOperation: ["operationId", "operationType", "targetRef", "payload"],
  NodeRun: ["nodeRunId", "harnessRunId", "planGraphBundleId", "graphVersion", "nodeId", "status", "attemptCount", "currentSeq", "createdAt", "updatedAt"],
  NodeAttempt: ["nodeAttemptId", "nodeRunId", "attemptNo", "attemptKind", "startedAt", "executorRef", "inputSnapshotRef"],
  AttemptLineage: ["attemptLineageId", "nodeRunId", "reason", "createdBy", "createdAt"],
  NodeAttemptReceipt: ["nodeAttemptReceiptId", "nodeAttemptId", "nodeRunId", "harnessRunId", "planGraphId", "graphVersion", "receiptKind", "status", "duration", "errorDetail", "sideEffectRefs", "budgetSettlementRefs", "evidenceRefs", "producedAt"],
  SideEffectRecord: ["sideEffectId", "harnessRunId", "nodeRunId", "nodeAttemptId", "effectKind", "idempotencyKey", "status", "riskClass", "preCommitPolicyProofRef", "deadline", "createdAt", "updatedAt"],
  ReconciliationRecord: ["reconciliationId", "sideEffectId", "probeKind", "externalObservedState", "result", "evidenceRefs", "nextAction", "createdAt"],
  CompensationRecord: ["compensationId", "sideEffectId", "harnessRunId", "planRef", "status", "evidenceRefs", "createdAt"],
  BudgetLedger: ["budgetLedgerId", "tenantId", "harnessRunId", "currency", "hardCap", "reservedAmount", "settledAmount", "releasedAmount", "status", "version"],
  BudgetReservation: ["budgetReservationId", "budgetLedgerId", "harnessRunId", "amount", "resourceKind", "status", "expiresAt", "createdAt"],
  BudgetSettlement: ["budgetSettlementId", "budgetReservationId", "actualAmount", "settlementKind", "evidenceRefs", "createdAt"],
  RunVersionLock: ["runVersionLockId", "harnessRunId", "schemaVersion", "runtimeProfileVersion", "promptVersions", "policyVersions", "toolVersions", "modelVersions", "evalVersions", "guardrailVersions", "domainVersions", "createdAt"],
  ArtifactVersionLockSet: ["artifactVersionLockSetId", "harnessRunId", "artifactLocks", "createdAt"],
  DecisionInputBundle: ["decisionInputBundleId", "harnessRunId", "decisionKind", "riskClass", "contextRefs", "evidenceRefs", "policyFindings", "sideEffectRefs", "createdAt"],
  HarnessDecision: ["harnessDecisionId", "decisionInputBundleId", "decisionKind", "decision", "deciderType", "deciderRef", "reasonCode", "createdAt"],
  HumanResponsibilityRecord: ["humanResponsibilityRecordId", "harnessDecisionId", "humanActorRef", "responsibilityScope", "acknowledgedRiskClass", "acknowledgementReceiptRef", "effectiveFrom"],
  EventEnvelope: ["eventId", "runId", "eventType", "schemaVersion", "aggregateType", "aggregateId", "aggregateSeq", "tenantId", "traceId", "payloadHash", "payload", "replayBehavior", "occurredAt"],
  PlatformFactEvent: ["eventId", "eventType", "schemaVersion", "aggregateType", "aggregateId", "aggregateSeq", "tenantId", "traceId", "payloadHash", "payload", "occurredAt"],
  OapeflirViewEvent: ["eventId", "eventType", "schemaVersion", "aggregateType", "aggregateId", "aggregateSeq", "tenantId", "traceId", "payloadHash", "payload", "occurredAt", "derivedFromEventIds", "projectionOnly"],
} satisfies Record<CanonicalContractName, readonly string[]>;

export const CONTRACT_JSON_SCHEMAS: Record<CanonicalContractName, ContractJsonSchema> =
  buildContractRecord((name) => ({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: name,
    type: "object",
    required: REQUIRED_FIELDS[name],
    additionalProperties: false,
  }));

export const EXECUTABLE_CONTRACT_PACKAGE: Record<CanonicalContractName, ExecutableContractDescriptor> =
  buildContractRecord((name) => ({
    name,
    schemaVersion: "v4.3",
    zodSchema: CONTRACT_ZOD_SCHEMAS[name],
    jsonSchema: CONTRACT_JSON_SCHEMAS[name],
    replayBehavior: replayBehaviorFor(name),
    failureBehavior: failureBehaviorFor(name),
    sourceOfTruth: name === "OapeflirViewEvent" ? "projection" : "platform",
  }));

export function getExecutableContract(name: CanonicalContractName): ExecutableContractDescriptor {
  return EXECUTABLE_CONTRACT_PACKAGE[name];
}

/**
 * Validates an executable contract payload against its Zod schema.
 * Returns the typed result on success, enabling type narrowing after validation.
 *
 * @param name - The canonical contract name
 * @param value - The raw unknown value to validate
 * @returns The typed validated result (not unknown)
 * @throws ValidationError if validation fails
 */
export function validateExecutableContract<T extends CanonicalContractName>(
  name: T,
  value: unknown,
): z.infer<typeof CONTRACT_ZOD_SCHEMAS[T]> {
  const result = CONTRACT_ZOD_SCHEMAS[name].safeParse(value);
  if (!result.success) {
    throw new ValidationError("executable_contract.schema_invalid", `Invalid v4.3 contract payload: ${name}`, {
      details: { issues: result.error.issues },
    });
  }
  return result.data as z.infer<typeof CONTRACT_ZOD_SCHEMAS[T]>;
}

function replayBehaviorFor(name: CanonicalContractName): ContractReplayBehavior {
  if (name === "SideEffectRecord" || name === "CompensationRecord") {
    return "skip_side_effect";
  }
  if (name === "OapeflirViewEvent") {
    return "simulate";
  }
  return "replay_as_fact";
}

function failureBehaviorFor(name: CanonicalContractName): ContractFailureBehavior {
  if (name === "HumanResponsibilityRecord" || name === "DecisionInputBundle" || name === "HarnessDecision") {
    return "escalate_to_human";
  }
  if (name === "SideEffectRecord" || name === "ReconciliationRecord" || name === "CompensationRecord") {
    return "reject_and_emit_incident";
  }
  return "reject";
}

function buildContractRecord<TValue>(
  createValue: (name: CanonicalContractName) => TValue,
): Record<CanonicalContractName, TValue> {
  const record = {} as Record<CanonicalContractName, TValue>;
  for (const name of EXECUTABLE_CONTRACT_NAMES) {
    record[name] = createValue(name);
  }
  return record;
}
