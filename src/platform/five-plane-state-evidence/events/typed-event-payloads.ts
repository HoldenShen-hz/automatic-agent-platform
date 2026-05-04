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
  capabilityCount?: number;
  pluginCount?: number;
  occurredAt: string;
}

export interface PluginLifecycleEventPayload {
  pluginId: string;
  domainId: string | null;
  spiType: string;
  lifecycleState: string;
  bindingId?: string | null;
  occurredAt: string;
  reason?: string | null;
  reasonCode?: string | null;
  errorMessage?: string | null;
}

// R23-57 FIX: Add PluginIsolationEventPayload with required phase field per contract
export interface PluginIsolationEventPayload {
  pluginId: string;
  domainId: string | null;
  spiType: string;
  phase: string; // Required field per §5.4 contract - indicates isolation stage
  lifecycleState: string;
  bindingId?: string | null;
  occurredAt: string;
  reason?: string | null;
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

export interface LearningKnowledgePromotedPayload {
  learningObjectId: string;
  learningType: string;
  documentId: string;
  namespace: string;
  trustLevel: string;
  promotedCount: number;
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
