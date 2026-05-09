import type { TraceContext } from "../../contracts/types/domain.js";
import type {
  AnomalyEventClass,
  UnifiedSeverity,
} from "../../contracts/types/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Shared Context Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Context passed with approval requests.
 * Contains session identifiers and classification information.
 */
export interface ApprovalContext {
  sessionId?: string | null;
  approvalSessionId?: string | null;
  permissionSessionId?: string | null;
  classification?: string | null;
  title?: string | null;
  stageRef?: string | null;
  loopIteration?: number | null;
  refId?: string | null;
  recommendedOptionId?: string | null;
  deadlineAt?: string | null;
  taskId?: string | null;
  executionId?: string | null;
  [key: string]: unknown;
}

/**
 * Runtime context for prompt injection events.
 */
export interface PromptRuntimeContext {
  tenantId?: string | null;
  userId?: string | null;
  taskId?: string | null;
  executionId?: string | null;
  [key: string]: unknown;
}

/**
 * Metadata for cost actualization events.
 */
export interface CostMetadata {
  provider?: string | null;
  model?: string | null;
  region?: string | null;
  usageType?: string | null;
  [key: string]: unknown;
}

export interface TaskStatusChangedPayload {
  fromStatus: string;
  toStatus: string;
  reasonCode?: string;
  occurredAt?: string;
  entityKind?: string;
  entityId?: string;
  reasonDetail?: string | null;
  actorType?: string;
  actorId?: string | null;
  idempotencyKey?: string | null;
  metadataJson?: string | null;
  manualOverride?: boolean;
  traceContext?: TraceContext;
}

export interface WorkflowStepCompletedPayload {
  stepId: string;
  roleId?: string;
  status?: string;
  workflowId?: string;
  outputKey?: string | null;
  occurredAt?: string;
  attempt?: number;
  manualOverride?: boolean;
  traceContext?: TraceContext;
}

export interface DecisionRequestedPayload {
  approvalId: string;
  executionId?: string | null;
  sourceAgentId?: string | null;
  reason?: string | null;
  reasonCode?: string | null;
  riskLevel?: "low" | "medium" | "high" | "critical" | null;
  options?: readonly string[] | null;
  context?: ApprovalContext | null;
  timeoutPolicy?: "reject" | "approve" | "remain_pending" | null;
  createdAt?: string | null;
  taskId?: string | null;
  decisionType?: string | null;
  requestedAt?: string | null;
}

export interface DecisionRespondedPayload {
  approvalId: string;
  decisionType?: "option_selected" | "confirmed" | "text_input" | "rejected" | "expired" | null;
  respondedBy?: string | null;
  respondedAt?: string | null;
  selectedOptionId?: string | null;
  confirmed?: true;
  inputText?: string | null;
  responseStatus?: string | null;
  decision?: string | null;
  reasonCode?: string | null;
  cascadeDeny?: true;
  cascadeSourceApprovalId?: string | null;
  cascadeSessionId?: string | null;
}

export interface DivisionOutcomePayload {
  divisionId: string;
  workflowId: string | null;
  executionId?: string | null;
  occurredAt: string;
  reasonCode?: string | null;
}

export interface SubtaskOutcomePayload {
  subtaskId?: string;
  stepId?: string;
  roleId?: string;
  status?: string;
  attempt?: number;
  parentTaskId?: string;
  occurredAt?: string;
  reasonCode?: string | null;
}

export interface CostLimitReachedPayload {
  budgetId: string;
  currentCostUsd: number;
  limitUsd: number;
  occurredAt: string;
}

export interface StreamChunkEmittedPayload {
  streamId: string;
  chunkIndex: number;
  chunkType: string;
  emittedAt: string;
}

export interface DispatchTicketPayload {
  ticketId: string;
  executionId: string;
  occurredAt: string;
  workerId?: string | null;
  reasonCode?: string | null;
}

export interface WorkerLifecyclePayload {
  workerId: string;
  executionId: string | null;
  occurredAt: string;
  leaseId?: string | null;
  reasonCode?: string | null;
}

// R13-18: Auto-scaling signal payload for worker pool management
export interface WorkerScaleSignalPayload {
  workerId: string;
  reason: string;
  currentLoad: number;
  targetLoad: number;
  saturation: number | null;
  cpuPct: number | null;
  memoryMb: number | null;
  activeLeaseCount: number;
  maxConcurrency: number;
  occurredAt: string;
}

export interface TakeoverPayload {
  takeoverId: string;
  executionId: string;
  occurredAt: string;
  actionType?: string | null;
}

export interface RecoveryPayload {
  executionId: string;
  decisionId?: string | null;
  occurredAt: string;
  reasonCode: string;
}

export interface DomainLifecyclePayload {
  domainId: string;
  status: string;
  capabilityCount: number;
  pluginCount: number;
  occurredAt: string;
}

export interface PluginLifecycleEventPayload {
  pluginId: string;
  domainId: string | null;
  spiType: string;
  lifecycleState: string;
  bindingId?: string | null;
  occurredAt: string;
  reasonCode?: string | null;
  errorMessage?: string | null;
}

/**
 * R23-57: PluginIsolationEventPayload - Plugin isolation event with phase field
 * Used for plugin error isolation events that require phase tracking.
 */
export interface PluginIsolationEventPayload {
  pluginId: string;
  domainId: string | null;
  spiType: string;
  phase: string;
  lifecycleState: string;
  bindingId?: string | null;
  occurredAt: string;
  reasonCode?: string | null;
  errorMessage?: string | null;
}

export interface PluginInvocationEventPayload {
  pluginId: string;
  domainId: string | null;
  spiType: string;
  phase: string;
  invocationId: string;
  lifecycleState: string;
  runtimeIsolation: string;
  activeInvocationCount: number;
  queuedInvocationCount: number;
  bindingId?: string | null;
  occurredAt: string;
  durationMs?: number;
  status?: "started" | "completed" | "failed";
  reasonCode?: string | null;
  errorMessage?: string | null;
}

export interface KnowledgeChunkIndexedPayload {
  namespace: string;
  documentId: string;
  chunkId: string;
  trustLevel: string;
  keywordCount: number;
  relationCount: number;
  occurredAt: string;
}

// R13-09: Extended to support batch promotion with all objects' metadata
export interface LearningKnowledgePromotedPayload {
  learningObjectId?: string;  // Single object ID (for backward compat)
  learningType?: string;       // Single object type (for backward compat)
  documentId?: string;          // Single document ID (for backward compat)
  namespace: string;
  trustLevel: string;
  promotedCount: number;
  promotedObjects?: Array<{
    learningObjectId: string;
    documentId: string;
    learningType: string;
    title: string;
    summary: string;
    confidence: number;
  }>;
  occurredAt: string;
}

export interface ClassifiedAnomalyEventPayload {
  eventId: string;
  metricName: string;
  anomalyEventClass: AnomalyEventClass;
  unifiedSeverity: UnifiedSeverity;
  legacySeverity: "info" | "warning" | "critical" | "emergency";
  statisticalCategory: string;
  occurredAt: string;
  context?: Record<string, unknown>;
}

// §28 Missing event namespaces

// delegation.* namespace - task/agent delegation events
export interface DelegationCreatedPayload {
  delegationId: string;
  sourceTaskId: string;
  targetAgentId: string;
  delegatedBy: string;
  scope: string[];
  occurredAt: string;
}

export interface DelegationCompletedPayload {
  delegationId: string;
  sourceTaskId: string;
  targetAgentId: string;
  completedAt: string;
  resultSummary?: string | null;
}

export interface DelegationFailedPayload {
  delegationId: string;
  sourceTaskId: string;
  targetAgentId: string;
  failedAt: string;
  reasonCode: string;
  errorMessage?: string | null;
}

// prompt.* namespace - prompt template and injection events
export interface PromptInjectedPayload {
  promptId: string;
  injectionType: string;
  templateVersion: string;
  occurredAt: string;
  runtimeContext?: PromptRuntimeContext | null;
}

export interface PromptRenderedPayload {
  promptId: string;
  renderId: string;
  templateId: string;
  renderDurationMs?: number;
  occurredAt: string;
}

export interface PromptValidationFailedPayload {
  promptId: string;
  validationErrors: string[];
  occurredAt: string;
}

// cost.* namespace - cost tracking and budget events
export interface CostBudgetCreatedPayload {
  budgetId: string;
  budgetName: string;
  limitUsd: number;
  period: "hourly" | "daily" | "monthly";
  createdAt: string;
}

export interface CostBudgetExceededPayload {
  budgetId: string;
  currentCostUsd: number;
  limitUsd: number;
  exceededAt: string;
  autoBlock?: boolean;
}

export interface CostActualizedPayload {
  costId: string;
  budgetId: string;
  amountUsd: number;
  costCategory: string;
  actualizedAt: string;
  metadata?: CostMetadata | null;
}

// tenant.* namespace - multi-tenant lifecycle events
export interface TenantProvisionedPayload {
  tenantId: string;
  plan: string;
  provisionedAt: string;
  region?: string | null;
}

export interface TenantSuspendedPayload {
  tenantId: string;
  reasonCode: string;
  suspendedAt: string;
}

export interface TenantDeletedPayload {
  tenantId: string;
  deletedAt: string;
  cascading?: boolean;
}

// pack.* namespace - plugin pack lifecycle events
export interface PackInstalledPayload {
  packId: string;
  packVersion: string;
  installedAt: string;
  installedBy: string;
}

export interface PackUninstalledPayload {
  packId: string;
  packVersion: string;
  uninstalledAt: string;
  reasonCode?: string | null;
}

// marketplace.* namespace - marketplace events
export interface MarketplaceListingPublishedPayload {
  listingId: string;
  packId: string;
  publishedAt: string;
  publisherId: string;
}

export interface MarketplaceListingPurchasedPayload {
  listingId: string;
  purchaseId: string;
  purchaserTenantId: string;
  purchasedAt: string;
  amountUsd?: number;
}

// slo.* namespace - service level objective events
export interface SloBreachedPayload {
  sloId: string;
  sloName: string;
  currentValue: number;
  targetValue: number;
  breachedAt: string;
  metricName: string;
}

export interface SloRecoveredPayload {
  sloId: string;
  sloName: string;
  recoveredAt: string;
  breachDurationMs?: number;
}

// compliance.* namespace - compliance and audit events
export interface ComplianceAuditRecordedPayload {
  auditId: string;
  actorId: string;
  action: string;
  resourceKind: string;
  resourceId: string;
  recordedAt: string;
  complianceFramework?: string | null;
}

export interface ComplianceViolationDetectedPayload {
  violationId: string;
  framework: string;
  severity: "low" | "medium" | "high" | "critical";
  detectedAt: string;
  resourceId: string;
  description: string;
}

// knowledge.* namespace - knowledge base events
export interface KnowledgeDocumentIndexedPayload {
  documentId: string;
  namespace: string;
  chunkCount: number;
  indexedAt: string;
  trustLevel: string;
}

export interface KnowledgeQueryProcessedPayload {
  queryId: string;
  namespace: string;
  resultCount: number;
  queryDurationMs?: number;
  processedAt: string;
}

// Circuit breaker state change events
export interface CircuitBreakerStateChangePayload {
  circuitName: string;
  oldState: "closed" | "open" | "half_open";
  newState: "closed" | "open" | "half_open";
  nextAttemptAt: number | null;
  occurredAt: string;
}

// R23-55/R23-56: OAPEFLIR stage event payloads (15 types required by contract)
// observe stage - signal collection and preprocessing
export interface ObserveSignalsCollectedPayload {
  runId: string;
  loopIteration: number;
  signalCount: number;
  signalTypes: readonly string[];
  observedAt: string;
  contextSnapshot?: Record<string, unknown>;
}

export interface ObserveContextAugmentedPayload {
  runId: string;
  loopIteration: number;
  contextSources: readonly string[];
  augmentationApplied: boolean;
  augmentedAt: string;
}

// assess stage - evaluation and anomaly detection
export interface AssessEvaluationCompletedPayload {
  runId: string;
  loopIteration: number;
  evaluationResult: string;
  anomaliesDetected: number;
  assessedAt: string;
  riskScore?: number;
}

export interface AssessAnomalyClassifiedPayload {
  runId: string;
  loopIteration: number;
  anomalyId: string;
  anomalyClass: string;
  severity: "low" | "medium" | "high" | "critical";
  classifiedAt: string;
}

// plan stage - proposal and decision making
export interface PlanProposalCreatedPayload {
  runId: string;
  loopIteration: number;
  proposalId: string;
  proposedActions: readonly string[];
  estimatedCost?: number;
  createdAt: string;
}

export interface PlanDecisionRecordedPayload {
  runId: string;
  loopIteration: number;
  decisionId: string;
  selectedAction: string;
  reasoning?: string;
  decidedAt: string;
}

// execute stage - action execution
export interface ExecuteActionStartedPayload {
  runId: string;
  loopIteration: number;
  actionId: string;
  actionType: string;
  targetResource?: string;
  startedAt: string;
}

export interface ExecuteActionCompletedPayload {
  runId: string;
  loopIteration: number;
  actionId: string;
  actionType: string;
  outcome: "success" | "failure" | "partial";
  completedAt: string;
  executionDurationMs?: number;
}

// feedback stage - outcome collection
export interface FeedbackSignalReceivedPayload {
  runId: string;
  loopIteration: number;
  signalId: string;
  signalType: string;
  sourceComponent: string;
  receivedAt: string;
  payload?: Record<string, unknown>;
}

export interface FeedbackOutcomeProcessedPayload {
  runId: string;
  loopIteration: number;
  outcomeId: string;
  outcomeType: string;
  processedAt: string;
  qualityScore?: number;
}

// learn stage - knowledge capture and promotion
export interface LearnObjectCreatedPayload {
  runId: string;
  loopIteration: number;
  objectId: string;
  objectType: string;
  namespace: string;
  createdAt: string;
  confidenceScore?: number;
}

export interface LearnObjectPromotedPayload {
  runId: string;
  loopIteration: number;
  objectId: string;
  objectType: string;
  promotionReason: string;
  promotedAt: string;
  trustLevel: string;
}

// improve stage - improvement candidate handling
export interface ImproveCandidateProposedPayload {
  runId: string;
  loopIteration: number;
  candidateId: string;
  candidateType: string;
  description: string;
  proposedBy: string;
  proposedAt: string;
  estimatedImpact?: string;
}

export interface ImproveCandidateAcceptedPayload {
  runId: string;
  loopIteration: number;
  candidateId: string;
  acceptedBy: string;
  acceptanceReason?: string;
  acceptedAt: string;
  rolloutStrategy?: string;
}

// release stage - rollout management
export interface ReleaseRolloutStartedPayload {
  runId: string;
  loopIteration: number;
  rolloutId: string;
  targetScope: string;
  startedAt: string;
  phasedRollout: boolean;
  targetVersion?: string;
}

export interface ReleaseRolloutCompletedPayload {
  runId: string;
  loopIteration: number;
  rolloutId: string;
  targetScope: string;
  completedAt: string;
  successRate?: number;
  affectedResources?: readonly string[];
}

// R23-60: AuthSession and AuthProviderBinding types for IAM
export interface AuthSession {
  sessionId: string;
  tenantId: string;
  userId: string | null;
  providerId: string;
  providerType: "oidc" | "saml" | "api_key" | "oauth" | "password";
  scope: readonly string[];
  createdAt: string;
  expiresAt: string | null;
  lastAccessedAt: string;
  metadataJson: string | null;
}

export interface AuthProviderBinding {
  bindingId: string;
  providerId: string;
  providerType: "oidc" | "saml" | "oauth";
  tenantId: string | null;
  clientId: string | null;
  clientSecretEncrypted: string | null;
  discoveryUrl: string | null;
  authorizationEndpoint: string | null;
  tokenEndpoint: string | null;
  userinfoEndpoint: string | null;
  jwksUri: string | null;
  scopes: readonly string[];
  pkceEnabled: boolean;
  pkceChallengeMethod: "S256" | "plain" | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// R23-63: CostEvent runtime type for cost tracking
export interface CostEvent {
  eventId: string;
  tenantId: string;
  harnessRunId: string | null;
  taskId: string | null;
  executionId: string | null;
  eventType: "cost_estimated" | "cost_actualized" | "cost_reserved" | "cost_released" | "budget_exceeded" | "budget_warning";
  amountUsd: number;
  currency: string;
  costCategory: "token" | "compute" | "storage" | "network" | "api_call" | "other";
  provider: string | null;
  model: string | null;
  usageType: string | null;
  quantity: number | null;
  unitPriceUsd: number | null;
  metadataJson: string | null;
  traceId: string | null;
  occurredAt: string;
}

// R23-64: StageBudgetPolicy for per-stage budget limits
export interface StageBudgetPolicy {
  policyId: string;
  tenantId: string | null;
  stage: "observe" | "assess" | "plan" | "execute" | "feedback" | "learn" | "improve" | "release";
  maxCostUsd: number;
  warnAtRatio: number;
  budgetScope: "per_run" | "per_task" | "daily" | "monthly";
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseRollbackTriggeredPayload {
  runId: string;
  loopIteration: number;
  rolloutId: string;
  reasonCode: string;
  triggeredBy: string;
  triggeredAt: string;
  rollbackScope?: string;
}
