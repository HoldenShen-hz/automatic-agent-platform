import type { ArtifactRecord, DispatchDecisionTrace, EventConsumerAckRecord, EventRecord, ExecutionRecord, ExecutionPrecheckRecord, SessionRecord, StepOutputRecord, TaskRecord, WorkflowStateRecord } from "../../../contracts/types/domain.js";
import { type Tier1AuditIntegrityRecord } from "../../../control-plane/iam/audit-event-integrity.js";
export type Phase1aStore = import("./authoritative-task-store-core.js").AuthoritativeTaskStore;
export declare function resolveTenantScope(tenantId?: string | null): string | undefined;
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
export declare function parseDispatchDecisionTrace(raw: string): DispatchDecisionTrace | null;
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
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 */
export declare function mapRuntimeRecoveryRecord(row: Record<string, unknown>): RuntimeRecoveryRecord;
