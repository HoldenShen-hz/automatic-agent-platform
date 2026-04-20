import type {
  AgentExecutionRecord,
  ApprovalRecord,
  ArtifactRecord,
  ArchiveBundleRecord,
  AnalyticsFactRecord,
  BillingAccountRecord,
  BillingInvoiceRecord,
  BillingPaymentSessionRecord,
  CompactionRecord,
  CoordinatorInstanceRecord,
  CostEventRecord,
  DataNamespaceRecord,
  DataMovementJobRecord,
  DeadLetterRecord,
  DeploymentBindingRecord,
  DispatchDecisionTrace,
  EnterpriseCapabilityReportRecord,
  EnterpriseGovernanceReportRecord,
  EntitlementDecisionRecord,
  EnvironmentReadinessRecord,
  ExtensionPackageRecord,
  EventConsumerAckRecord,
  EventRecord,
  EvolutionLogRecord,
  EvolutionPolicyRecord,
  EvolutionProposalRecord,
  ExecutionRecord,
  ExecutionTicketRecord,
  ExecutionPrecheckRecord,
  ExecutionLeaseRecord,
  FileLockRecord,
  GatewayTargetRecord,
  HeartbeatSnapshotRecord,
  LeaseAuditRecord,
  MemoryRecord,
  MessageRecord,
  MarketplaceGovernanceReportRecord,
  MarketplacePublicationRecord,
  MarketplaceReviewRecord,
  OrganizationMembershipRecord,
  OrganizationRecord,
  PerceptionSourceRecord,
  IntelItemRecord,
  IntelBriefRecord,
  IncidentHandoffRecord,
  OperatorActionRecord,
  PmfValidationReportRecord,
  ReleaseBundleRecord,
  ReleaseExecutionReportRecord,
  QuotaCounterRecord,
  RemoteLogRecord,
  ReplayDatasetRecord,
  DeploymentExecutionReportRecord,
  SecretRegistryRecord,
  SecretLeaseRecord,
  SecretRotationEventRecord,
  SecretUsageAuditRecord,
  SessionRecord,
  StepOutputRecord,
  TaskRecord,
  TakeoverSessionRecord,
  TenantRecord,
  UsageEventRecord,
  WorkerRegistrationChallengeRecord,
  WorkerSnapshotRecord,
  WorkspaceMembershipRecord,
  WorkspaceRecord,
  WorkflowStateRecord,
  LedgerEntryRecord,
  ActionProposalRecord,
  EnvironmentPromotionHistoryRecord,
} from "../../../contracts/types/domain.js";

import {
  buildMemoryQualityReport,
  filterAndSortMemories,
  type MemoryQualityReport,
  type MemoryRecallQuery,
} from "../../memory/memory-quality.js";
import {
  computeTier1AuditChainHash,
  computeTier1AuditEventChecksum,
  verifyTier1AuditIntegrity,
  type Tier1AuditIntegrityRecord,
  type Tier1AuditIntegrityReport,
} from "../../../control-plane/iam/audit-event-integrity.js";
import { getEventTier, getRequiredConsumers } from "../../events/event-types.js";
import { ensureMessagePartsJson } from "../../../model-gateway/messages/message-parts.js";
import { getTenantIdOrNull, hasTenantContext } from "../../../execution/execution-engine/runtime-context.js";
import { newId, nowIso } from "../../../contracts/types/ids.js";
import type { AuthoritativeSqlDatabase } from "./sqlite-database.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
import { StorageError } from "../../../contracts/errors.js";

const authoritativeTaskStoreLogger = new StructuredLogger({ retentionLimit: 50 });

export type Phase1aStore = import("./authoritative-task-store-core.js").AuthoritativeTaskStore;

export function resolveTenantScope(tenantId?: string | null): string | undefined {
  if (tenantId !== undefined) {
    return tenantId ?? undefined;
  }
  if (!hasTenantContext()) {
    return undefined;
  }
  return getTenantIdOrNull() ?? undefined;
}

/**
 * Complete snapshot of a task including its workflow, execution, session, outputs, artifacts, and events.
 */
export interface TaskSnapshot {
  task: TaskRecord;
  workflow: WorkflowStateRecord | null;
  execution: ExecutionRecord | null;
  session: SessionRecord | null;
  stepOutputs: StepOutputRecord[];
  artifacts: ArtifactRecord[];
  events: EventRecord[];
  consistency: "authoritative";
  observedAt: string;
}

/**
 * An event with its corresponding consumer acknowledgment record.
 */
export interface PendingAckEvent {
  event: EventRecord;
  ack: EventConsumerAckRecord;
}

/**
 * A task that exists without an associated workflow state.
 */
export interface ActiveTaskWithoutWorkflow {
  taskId: string;
  taskStatus: TaskRecord["status"];
}

/**
 * Represents an invalid workflow state that needs to be recovered.
 */
export interface InvalidWorkflowState {
  taskId: string;
  workflowId: string;
  currentStepIndex: number;
}

/**
 * An execution that has gone stale (not updated recently).
 */
export interface StaleExecutionRecord {
  executionId: string;
  taskId: string;
  status: ExecutionRecord["status"];
  updatedAt: string;
}

/**
 * A session that exists without a corresponding active task.
 */
export interface OrphanSessionRecord {
  sessionId: string;
  taskId: string;
  sessionStatus: SessionRecord["status"];
  taskStatus: TaskRecord["status"];
}

export interface GatewaySessionTargetCandidate {
  sessionId: string;
  taskId: string;
  channel: string;
  sessionStatus: SessionRecord["status"];
  externalSessionId: string | null;
  taskTitle: string | null;
  latestMessage: string | null;
  latestMessageAt: string | null;
  lastSeenAt: string;
}

/**
 * A terminal workflow whose related task/session state did not close consistently.
 */
export interface WorkflowTerminalMismatchRecord {
  taskId: string;
  workflowStatus: Extract<WorkflowStateRecord["status"], "completed" | "failed" | "cancelled">;
  workflowUpdatedAt: string;
  taskStatus: TaskRecord["status"];
  sessionId: string | null;
  sessionStatus: SessionRecord["status"] | null;
}

export interface ActiveTaskTerminalSessionRecord {
  taskId: string;
  taskStatus: TaskRecord["status"];
  sessionId: string;
  sessionStatus: Extract<SessionRecord["status"], "completed" | "failed" | "cancelled">;
}

/**
 * A pending Tier 1 event acknowledgment record.
 */
export interface PendingTier1AckRecord {
  eventId: string;
  taskId: string | null;
  consumerId: string;
  eventType: string;
  eventCreatedAt: string;
}

/**
 * Record indicating a task has conflicting active executions.
 */
export interface ActiveExecutionConflictRecord {
  taskId: string;
  activeExecutionIds: string[];
}

/**
 * Parses a dispatch decision trace from JSON string.
 * Validates the structure before returning.
 * @param raw - Raw JSON string to parse
 * @returns Parsed DispatchDecisionTrace or null if invalid
 */
export function parseDispatchDecisionTrace(raw: string): DispatchDecisionTrace | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const candidate = parsed as Record<string, unknown>;
    if (
      typeof candidate.ticketId !== "string" ||
      typeof candidate.executionId !== "string" ||
      typeof candidate.taskId !== "string" ||
      (candidate.queueName !== null && typeof candidate.queueName !== "string") ||
      (candidate.preferredWorkerId !== null && typeof candidate.preferredWorkerId !== "string") ||
      !Array.isArray(candidate.requiredCapabilities) ||
      !Array.isArray(candidate.evaluations)
    ) {
      return null;
    }

    return parsed as DispatchDecisionTrace;
  } catch (err) {
    authoritativeTaskStoreLogger.log({ level: "debug", message: "Failed to parse dispatch decision trace", data: { error: err instanceof Error ? err.message : String(err) } });
    return null;
  }
}

/**
 * Record of an active execution's current activity state.
 */
export interface ActiveExecutionActivityRecord {
  executionId: string;
  taskId: string;
  agentId: string;
  status: ExecutionRecord["status"];
  updatedAt: string;
  latestEventAt: string | null;
  latestHeartbeatAt: string | null;
}

/**
 * Record for runtime recovery tracking of executions.
 */
export interface RuntimeRecoveryRecord {
  executionId: string;
  taskId: string;
  divisionId: string | null;
  taskStatus: TaskRecord["status"];
  status: ExecutionRecord["status"];
  attempt: number;
  traceId: string;
  workflowId: string | null;
  latestErrorCode: string | null;
  updatedAt: string;
  lastHeartbeatAt: string | null;
  pendingApprovalId: string | null;
  latestPrecheck: ExecutionPrecheckRecord | null;
}

/**
 * Record tracking Tier 1 event registry coverage.
 */
export interface Tier1EventRegistryCoverageRecord {
  eventId: string;
  eventType: string;
  ackConsumers: string[];
}

export interface Tier1AuditIntegrityVerificationRow extends Tier1AuditIntegrityRecord {
  currentEventType: string | null;
  taskId: string | null;
  sessionId: string | null;
  executionId: string | null;
  eventTier: EventRecord["eventTier"] | null;
  payloadJson: string | null;
  traceId: string | null;
  createdAt: string | null;
}

/**
 * Item displayed on the task board with aggregated information.
 */
export interface TaskBoardItem {
  taskId: string;
  title: string;
  priority: TaskRecord["priority"];
  taskStatus: TaskRecord["status"];
  workflowStatus: WorkflowStateRecord["status"] | null;
  divisionId: string | null;
  currentStepIndex: number | null;
  sessionStatus: SessionRecord["status"] | null;
  latestEventAt: string | null;
  updatedAt: string;
}

/**
 * Authoritative execution-scoped aggregate used by critical write paths.
 * Dashboard and health summary projections may remain eventually consistent.
 */
export interface ExecutionAuthoritativeView {
  execution: ExecutionRecord;
  task: TaskRecord | null;
  workflow: WorkflowStateRecord | null;
  session: SessionRecord | null;
  consistency: "authoritative";
  observedAt: string;
}

/**
 * Phase 1a store providing database access for all core entities.
 * This is the main data access layer for the SQLite database.
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/storage_schema_contract.md | Storage Schema Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/automatic_agent_patform_arthitecture_design.md | Architecture and Technical Design}
 */
export function mapRuntimeRecoveryRecord(row: Record<string, unknown>): RuntimeRecoveryRecord {
  const hasPrecheck = row.precheckId != null;

  return {
    executionId: String(row.executionId),
    taskId: String(row.taskId),
    divisionId: (row.divisionId as string | null) ?? null,
    taskStatus: row.taskStatus as TaskRecord["status"],
    status: row.status as ExecutionRecord["status"],
    attempt: Number(row.attempt),
    traceId: String(row.traceId),
    workflowId: (row.workflowId as string | null) ?? null,
    latestErrorCode: (row.latestErrorCode as string | null) ?? null,
    updatedAt: String(row.updatedAt),
    lastHeartbeatAt: (row.lastHeartbeatAt as string | null) ?? null,
    pendingApprovalId: (row.pendingApprovalId as string | null) ?? null,
    latestPrecheck: hasPrecheck
      ? {
          id: String(row.precheckId),
          executionId: String(row.precheckExecutionId),
          allowed: Number(row.precheckAllowed) === 1 ? 1 : 0,
          reasonCode: (row.precheckReasonCode as string | null) ?? null,
          resolvedBudgetUsd: row.precheckResolvedBudgetUsd == null ? null : Number(row.precheckResolvedBudgetUsd),
          resolvedTimeoutMs: Number(row.precheckResolvedTimeoutMs),
          resolvedSandboxMode: String(row.precheckResolvedSandboxMode),
          resolvedToolsJson: (row.precheckResolvedToolsJson as string | null) ?? null,
          resolvedPathsJson: (row.precheckResolvedPathsJson as string | null) ?? null,
          checkedAt: String(row.precheckCheckedAt),
        }
      : null,
  };
}
