import assert from "node:assert/strict";
import test from "node:test";

// Import from the barrel file (index.ts) - tests re-exports
import type {
  // Primitives
  Timestamp,
  TaskPriority,
  TaskSource,
  EventTier,
  EventConsumerAckStatus,
  RunKind,
  MemoryLayer,
  MemorySourceTrustLevel,
  MessageDirection,
  RemoteLogLevel,
  GatewayTargetKind,
  GatewayTargetSource,
  MessagePartType,
  CompactionStage,
  WorkerStatus,
  WorkerSchedulingStatus,
  CoordinatorInstanceStatus,
  WorkerPlacement,
  WorkerIsolationLevel,
  RemoteSessionStatus,
  SessionConsistencyCheckStatus,
  WorkspaceSyncStatus,
  LeaseStatus,
  ExecutionTicketStatus,
  DispatchTarget,
  RemoteAvailability,
  DispatchWorkerRejectionReason,
  LeaseAuditEventType,
  TakeoverSessionStatus,
  OperatorActionType,
  EvolutionProposalKind,
  EvolutionProposalStatus,
  EvolutionScopeType,
  EvolutionPolicyStatus,
  EvolutionLogEventType,
  PmfValidationVerdict,
  BillingAccountStatus,
  BillingUsageSource,
  BillingLimitType,
  BillingResetPolicy,
  BillingInvoiceStatus,
  BillingPaymentGatewayKind,
  BillingPaymentSessionStatus,
  EntitlementDecisionType,
  SecretCategory,
  SecretScopeType,
  SecretProviderKind,
  SecretStatus,
  SecretRotationMode,
  SecretRotationEventStatus,
  SecretLeaseStatus,
  TenantIsolationMode,
  DataNamespacePlane,
  EnvironmentName,
  DeploymentMode,
  EnvironmentReadinessComponentType,
  EnterpriseCapabilityStatus,
  ExtensionPackageType,
  ExtensionTrustLevel,
  ExtensionLifecycleState,
  MarketplaceReviewStatus,
  MarketplacePublicationStatus,
  PerceptionSourceType,
  ActionProposalStatus,
  TransitionEntityKind,
  TransitionActorType,
  // Task types
  ArtifactRef,
  ArtifactRecord,
  TaskRecord,
  WorkflowStateRecord,
  StepOutputRecord,
  CostEventRecord,
  MemoryRecord,
  MemoryKind,
  MemoryStatus,
  SessionSummaryRecord,
  BudgetScope,
  // Workflow types
  CompensationPlanEntry,
  CompensationPlan,
  CheckpointPlanEntry,
  CheckpointPlan,
  // Session types
  SessionRecord,
  GatewayTargetRecord,
  MessageRecord,
  MessagePart,
  RemoteLogRecord,
  ApprovalRecord,
  TakeoverSessionRecord,
  OperatorActionRecord,
  CompactionRecord,
  EventRecord,
  EventConsumerAckRecord,
  EventDeadLetterRecord,
  SessionEventRecord,
  // Execution types
  ExecutionRecord,
  ExecutionPrecheckRecord,
  DeadLetterRecord,
  // Worker types
  AgentExecutionRecord,
  WorkerSnapshotRecord,
  CoordinatorInstanceRecord,
  WorkerRegistrationChallengeRecord,
  FileLockRecord,
  HeartbeatSnapshotRecord,
  // Dispatch types
  ExecutionTicketRecord,
  DispatchWorkerEvaluation,
  DispatchDecisionTrace,
  // Lease types
  ExecutionLeaseRecord,
  LeaseAuditRecord,
  // Secret types
  SecretRegistryRecord,
  SecretUsageAuditRecord,
  SecretRotationEventRecord,
  SecretLeaseRecord,
  // Billing types
  BillingAccountRecord,
  BillingInvoiceRecord,
  BillingPaymentSessionRecord,
  UsageEventRecord,
  QuotaCounterRecord,
  LedgerEntryRecord,
  EntitlementDecisionRecord,
  // Release types
  ReleaseBundleRecord,
  ReleaseExecutionReportRecord,
  DeploymentExecutionReportRecord,
  EnvironmentPromotionHistoryRecord,
  // Workspace types
  WorkspaceRecord,
  WorkspaceMembershipRecord,
  OrganizationRecord,
  OrganizationMembershipRecord,
  TenantRecord,
  DeploymentBindingRecord,
  DataNamespaceRecord,
  // Data types
  AnalyticsFactRecord,
  ArchiveBundleRecord,
  ReplayDatasetRecord,
  DataMovementJobRecord,
  IntelItemRecord,
  IntelBriefRecord,
  // Ops types
  EnvironmentReadinessRecord,
  EnterpriseCapabilityReportRecord,
  IncidentHandoffRecord,
  EnterpriseGovernanceReportRecord,
  ExtensionPackageRecord,
  MarketplaceReviewRecord,
  MarketplacePublicationRecord,
  MarketplaceGovernanceReportRecord,
  PerceptionSourceRecord,
  ActionProposalRecord,
  // Evolution types
  EvolutionProposalRecord,
  EvolutionPolicyRecord,
  EvolutionLogRecord,
  PmfValidationReportRecord,
  // Core types
  TraceContext,
  TransitionAuditContext,
  TransitionCommand,
  TaskStatusTransitionCommand,
  WorkflowStatusTransitionCommand,
  SessionStatusTransitionCommand,
  ExecutionStatusTransitionCommand,
  ApprovalStatusTransitionCommand,
  TaskSnapshot,
} from "../../../../../src/platform/contracts/types/domain/index.js";

// ---------------------------------------------------------------------------
// Primitives - Timestamp
// ---------------------------------------------------------------------------

test("Timestamp from barrel is a string type", () => {
  const ts: Timestamp = "2026-04-23T00:00:00.000Z";
  assert.equal(ts, "2026-04-23T00:00:00.000Z");
});

// ---------------------------------------------------------------------------
// Primitives - Task
// ---------------------------------------------------------------------------

test("TaskPriority from barrel accepts all valid values", () => {
  const priorities: TaskPriority[] = ["low", "normal", "high", "urgent"];
  assert.equal(priorities.length, 4);
});

test("TaskSource from barrel accepts all valid values", () => {
  const sources: TaskSource[] = ["user", "perception", "system"];
  assert.equal(sources.length, 3);
});

// ---------------------------------------------------------------------------
// Primitives - Event
// ---------------------------------------------------------------------------

test("EventTier from barrel accepts all valid values", () => {
  const tiers: EventTier[] = ["tier_1", "tier_2", "tier_3"];
  assert.equal(tiers.length, 3);
});

test("EventConsumerAckStatus from barrel accepts all valid values", () => {
  const statuses: EventConsumerAckStatus[] = ["pending", "acked", "failed", "dead_lettered"];
  assert.equal(statuses.length, 4);
});

test("MessageDirection from barrel accepts all valid values", () => {
  const directions: MessageDirection[] = ["inbound", "outbound", "system"];
  assert.equal(directions.length, 3);
});

test("RemoteLogLevel from barrel accepts all valid values", () => {
  const levels: RemoteLogLevel[] = ["debug", "info", "warn", "error"];
  assert.equal(levels.length, 4);
});

test("CompactionStage from barrel accepts all valid values", () => {
  const stages: CompactionStage[] = ["trim", "summarize"];
  assert.equal(stages.length, 2);
});

test("MessagePartType from barrel accepts all valid values", () => {
  const types: MessagePartType[] = [
    "text",
    "reasoning",
    "tool_use",
    "tool_result",
    "summary",
    "artifact_ref",
    "decision_prompt",
    "agent_ref",
    "subtask_ref",
    "retry_record",
    "step_boundary",
    "compaction_marker",
    "hook_event",
    "command_execution",
    "mcp_call",
  ];
  assert.equal(types.length, 15);
});

// ---------------------------------------------------------------------------
// Primitives - Worker
// ---------------------------------------------------------------------------

test("RunKind from barrel accepts all valid values", () => {
  const kinds: RunKind[] = ["task_run", "tool_call", "approval_resume", "replay"];
  assert.equal(kinds.length, 4);
});

test("WorkerStatus from barrel accepts all valid values", () => {
  const statuses: WorkerStatus[] = ["idle", "busy", "draining", "degraded", "unavailable", "quarantined", "offline"];
  assert.equal(statuses.length, 7);
});

test("WorkerSchedulingStatus from barrel accepts all valid values", () => {
  const statuses: WorkerSchedulingStatus[] = ["healthy", "degraded", "draining", "quarantined", "offline", "unavailable"];
  assert.equal(statuses.length, 6);
});

test("CoordinatorInstanceStatus from barrel accepts all valid values", () => {
  const statuses: CoordinatorInstanceStatus[] = ["active", "draining", "offline"];
  assert.equal(statuses.length, 3);
});

test("WorkerPlacement from barrel accepts all valid values", () => {
  const placements: WorkerPlacement[] = ["local", "remote"];
  assert.equal(placements.length, 2);
});

test("WorkerIsolationLevel from barrel accepts all valid values", () => {
  const levels: WorkerIsolationLevel[] = ["standard", "hardened", "strict"];
  assert.equal(levels.length, 3);
});

// ---------------------------------------------------------------------------
// Primitives - Session
// ---------------------------------------------------------------------------

test("RemoteSessionStatus from barrel accepts all valid values", () => {
  const statuses: RemoteSessionStatus[] = ["connecting", "connected", "reconnecting", "degraded", "failed", "viewer_only"];
  assert.equal(statuses.length, 6);
});

test("SessionConsistencyCheckStatus from barrel accepts all valid values", () => {
  const statuses: SessionConsistencyCheckStatus[] = ["unknown", "passed", "mismatch"];
  assert.equal(statuses.length, 3);
});

test("WorkspaceSyncStatus from barrel accepts all valid values", () => {
  const statuses: WorkspaceSyncStatus[] = ["unknown", "aligned", "conflict"];
  assert.equal(statuses.length, 3);
});

// ---------------------------------------------------------------------------
// Primitives - Lease
// ---------------------------------------------------------------------------

test("LeaseStatus from barrel accepts all valid values", () => {
  const statuses: LeaseStatus[] = ["active", "expired", "released", "reclaimed", "handed_over"];
  assert.equal(statuses.length, 5);
});

test("ExecutionTicketStatus from barrel accepts all valid values", () => {
  const statuses: ExecutionTicketStatus[] = ["pending", "claimed", "consumed", "cancelled", "expired"];
  assert.equal(statuses.length, 5);
});

test("DispatchTarget from barrel accepts all valid values", () => {
  const targets: DispatchTarget[] = ["any", "local_only", "prefer_remote", "require_remote"];
  assert.equal(targets.length, 4);
});

test("RemoteAvailability from barrel accepts all valid values", () => {
  const availabilities: RemoteAvailability[] = ["healthy", "partial_available", "degraded", "unavailable"];
  assert.equal(availabilities.length, 4);
});

test("DispatchWorkerRejectionReason from barrel accepts all valid values", () => {
  const reasons: DispatchWorkerRejectionReason[] = [
    "worker_unavailable",
    "worker_quarantined",
    "worker_offline",
    "worker_draining",
    "worker_degraded_filtered",
    "worker_untrusted",
    "worker_capacity_full",
    "queue_affinity_mismatch",
    "missing_capabilities",
    "worker_placement_mismatch",
    "worker_isolation_mismatch",
    "worker_repo_version_mismatch",
    "worker_remote_session_unready",
  ];
  assert.equal(reasons.length, 13);
});

test("LeaseAuditEventType from barrel accepts all valid values", () => {
  const types: LeaseAuditEventType[] = [
    "lease_granted",
    "lease_renewed",
    "lease_expired",
    "lease_reclaimed",
    "stale_write_rejected",
    "lease_released",
    "lease_handover",
  ];
  assert.equal(types.length, 7);
});

// ---------------------------------------------------------------------------
// Primitives - Operator
// ---------------------------------------------------------------------------

test("TakeoverSessionStatus from barrel accepts all valid values", () => {
  const statuses: TakeoverSessionStatus[] = ["open", "closed"];
  assert.equal(statuses.length, 2);
});

test("OperatorActionType from barrel accepts all valid values", () => {
  const actions: OperatorActionType[] = [
    "take_over_task",
    "modify_input",
    "retry_execution",
    "skip_step",
    "set_current_step",
    "switch_worker",
    "write_step_output",
    "complete_task",
  ];
  assert.equal(actions.length, 8);
});

// ---------------------------------------------------------------------------
// Primitives - Memory
// ---------------------------------------------------------------------------

test("MemoryLayer from barrel accepts all valid values", () => {
  const layers: MemoryLayer[] = ["layer_3", "layer_5", "layer_7"];
  assert.equal(layers.length, 3);
});

test("MemorySourceTrustLevel from barrel accepts all valid values", () => {
  const levels: MemorySourceTrustLevel[] = ["trusted", "external", "untrusted"];
  assert.equal(levels.length, 3);
});

// ---------------------------------------------------------------------------
// Primitives - Gateway
// ---------------------------------------------------------------------------

test("GatewayTargetKind from barrel accepts all valid values", () => {
  const kinds: GatewayTargetKind[] = ["session", "user", "group", "room"];
  assert.equal(kinds.length, 4);
});

test("GatewayTargetSource from barrel accepts all valid values", () => {
  const sources: GatewayTargetSource[] = ["directory", "session_history"];
  assert.equal(sources.length, 2);
});

// ---------------------------------------------------------------------------
// Primitives - Billing
// ---------------------------------------------------------------------------

test("PmfValidationVerdict from barrel accepts all valid values", () => {
  const verdicts: PmfValidationVerdict[] = ["pass", "warn", "fail"];
  assert.equal(verdicts.length, 3);
});

test("BillingAccountStatus from barrel accepts all valid values", () => {
  const statuses: BillingAccountStatus[] = ["active", "suspended", "cancelled"];
  assert.equal(statuses.length, 3);
});

test("BillingUsageSource from barrel accepts all valid values", () => {
  const sources: BillingUsageSource[] = ["runtime", "api", "gateway", "admin"];
  assert.equal(sources.length, 4);
});

test("BillingLimitType from barrel accepts all valid values", () => {
  const types: BillingLimitType[] = ["hard", "soft", "burst"];
  assert.equal(types.length, 3);
});

test("BillingResetPolicy from barrel accepts all valid values", () => {
  const policies: BillingResetPolicy[] = ["calendar_month"];
  assert.equal(policies.length, 1);
});

test("BillingInvoiceStatus from barrel accepts all valid values", () => {
  const statuses: BillingInvoiceStatus[] = ["draft", "open", "paid", "void"];
  assert.equal(statuses.length, 4);
});

test("BillingPaymentGatewayKind from barrel accepts all valid values", () => {
  const kinds: BillingPaymentGatewayKind[] = ["manual", "stripe", "paddle"];
  assert.equal(kinds.length, 3);
});

test("BillingPaymentSessionStatus from barrel accepts all valid values", () => {
  const statuses: BillingPaymentSessionStatus[] = ["pending", "paid", "expired", "cancelled", "failed"];
  assert.equal(statuses.length, 5);
});

test("EntitlementDecisionType from barrel accepts all valid values", () => {
  const types: EntitlementDecisionType[] = ["allow", "deny", "degrade", "warn"];
  assert.equal(types.length, 4);
});

// ---------------------------------------------------------------------------
// Primitives - Secret
// ---------------------------------------------------------------------------

test("SecretCategory from barrel accepts all valid values", () => {
  const categories: SecretCategory[] = [
    "provider_api_key",
    "tenant_credential",
    "oauth_client_secret",
    "signing_key",
    "db_connection_secret",
    "break_glass_secret",
  ];
  assert.equal(categories.length, 6);
});

test("SecretScopeType from barrel accepts all valid values", () => {
  const types: SecretScopeType[] = ["system", "tenant", "workspace", "worker"];
  assert.equal(types.length, 4);
});

test("SecretProviderKind from barrel accepts all valid values", () => {
  const kinds: SecretProviderKind[] = ["environment", "vault", "kms", "secret_manager"];
  assert.equal(kinds.length, 4);
});

test("SecretStatus from barrel accepts all valid values", () => {
  const statuses: SecretStatus[] = ["active", "rotating", "disabled", "revoked"];
  assert.equal(statuses.length, 4);
});

test("SecretRotationMode from barrel accepts all valid values", () => {
  const modes: SecretRotationMode[] = ["scheduled", "emergency"];
  assert.equal(modes.length, 2);
});

test("SecretRotationEventStatus from barrel accepts all valid values", () => {
  const statuses: SecretRotationEventStatus[] = ["requested", "completed", "failed"];
  assert.equal(statuses.length, 3);
});

test("SecretLeaseStatus from barrel accepts all valid values", () => {
  const statuses: SecretLeaseStatus[] = ["active", "expired", "revoked"];
  assert.equal(statuses.length, 3);
});

// ---------------------------------------------------------------------------
// Primitives - Multi-tenancy
// ---------------------------------------------------------------------------

test("TenantIsolationMode from barrel accepts all valid values", () => {
  const modes: TenantIsolationMode[] = [
    "shared_logical",
    "shared_hard_scoped",
    "dedicated_runtime",
    "dedicated_environment",
  ];
  assert.equal(modes.length, 4);
});

test("DataNamespacePlane from barrel accepts all valid values", () => {
  const planes: DataNamespacePlane[] = ["transactional", "artifact", "analytics", "memory_archive", "replay"];
  assert.equal(planes.length, 5);
});

test("EnvironmentName from barrel accepts all valid values", () => {
  const names: EnvironmentName[] = ["dev", "test", "staging", "pre-prod", "prod", "development", "production"];
  assert.equal(names.length, 7);
});

test("DeploymentMode from barrel accepts all valid values", () => {
  const modes: DeploymentMode[] = ["cloud_shared", "private_cloud", "on_prem"];
  assert.equal(modes.length, 3);
});

test("EnvironmentReadinessComponentType from barrel accepts all valid values", () => {
  const types: EnvironmentReadinessComponentType[] = [
    "provider",
    "gateway",
    "sandbox",
    "worker_fleet",
    "artifact_store",
    "notification_channel",
    "external_service",
  ];
  assert.equal(types.length, 7);
});

test("EnterpriseCapabilityStatus from barrel accepts all valid values", () => {
  const statuses: EnterpriseCapabilityStatus[] = ["available", "degraded", "blocked"];
  assert.equal(statuses.length, 3);
});

// ---------------------------------------------------------------------------
// Primitives - Extension
// ---------------------------------------------------------------------------

test("ExtensionPackageType from barrel accepts all valid values", () => {
  const types: ExtensionPackageType[] = ["tool", "skill", "plugin", "mcp", "template"];
  assert.equal(types.length, 5);
});

test("ExtensionTrustLevel from barrel accepts all valid values", () => {
  const levels: ExtensionTrustLevel[] = ["internal", "verified", "community", "unknown"];
  assert.equal(levels.length, 4);
});

test("ExtensionLifecycleState from barrel accepts all valid values", () => {
  const states: ExtensionLifecycleState[] = ["discovered", "installed", "enabled", "disabled", "reloaded", "removed", "deprecated", "retired"];
  assert.equal(states.length, 8);
});

test("MarketplaceReviewStatus from barrel accepts all valid values", () => {
  const statuses: MarketplaceReviewStatus[] = ["submitted", "approved", "rejected"];
  assert.equal(statuses.length, 3);
});

test("MarketplacePublicationStatus from barrel accepts all valid values", () => {
  const statuses: MarketplacePublicationStatus[] = ["published", "deprecated", "retired", "revoked"];
  assert.equal(statuses.length, 4);
});

test("PerceptionSourceType from barrel accepts all valid values", () => {
  const types: PerceptionSourceType[] = ["rss", "web", "github", "api", "custom"];
  assert.equal(types.length, 5);
});

test("ActionProposalStatus from barrel accepts all valid values", () => {
  const statuses: ActionProposalStatus[] = ["proposed", "approved", "rejected", "superseded"];
  assert.equal(statuses.length, 4);
});

// ---------------------------------------------------------------------------
// Primitives - Transition
// ---------------------------------------------------------------------------

test("TransitionEntityKind from barrel accepts all valid values", () => {
  const kinds: TransitionEntityKind[] = ["task", "workflow", "session", "approval", "execution"];
  assert.equal(kinds.length, 5);
});

test("TransitionActorType from barrel accepts all valid values", () => {
  const types: TransitionActorType[] = ["user", "agent", "system", "scheduler", "admin", "webhook", "recovery"];
  assert.equal(types.length, 7);
});

// ---------------------------------------------------------------------------
// Task Types
// ---------------------------------------------------------------------------

test("ArtifactRef from barrel structure is correct", () => {
  const ref: ArtifactRef = {
    artifactId: "artifact_123",
    kind: "file",
    uri: "file:///path/to/artifact",
    mimeType: "text/plain",
    sizeBytes: 1024,
    checksum: "abc123",
    createdAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(ref.artifactId, "artifact_123");
  assert.equal(ref.mimeType, "text/plain");
});

test("ArtifactRecord from barrel structure is correct", () => {
  const record: ArtifactRecord = {
    artifactId: "artifact_789",
    taskId: "task_123",
    executionId: "exec_456",
    stepId: "step_1",
    kind: "file",
    storagePath: "/artifacts/789.txt",
    fileName: "output.txt",
    mimeType: "text/plain",
    sizeBytes: 2048,
    checksum: "def456",
    lineageJson: '{"parent":"artifact_111"}',
    createdAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.taskId, "task_123");
  assert.equal(record.sizeBytes, 2048);
});

test("TaskRecord from barrel structure is correct", () => {
  const record: TaskRecord = {
    id: "task_123",
    parentId: null,
    rootId: "task_123",
    divisionId: "division_1",
    title: "Test Task",
    status: "done",
    source: "user",
    priority: "normal",
    inputJson: '{"query":"test"}',
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: 0.05,
    actualCostUsd: 0.04,
    errorCode: null,
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:01:00.000Z",
    completedAt: "2026-04-23T00:01:30.000Z",
  };
  assert.equal(record.status, "done");
  assert.equal(record.priority, "normal");
});

test("WorkflowStateRecord from barrel structure is correct", () => {
  const record: WorkflowStateRecord = {
    taskId: "task_123",
    divisionId: "division_1",
    workflowId: "workflow_1",
    currentStepIndex: 2,
    status: "running",
    outputsJson: '{"step1":"out1"}',
    lastErrorCode: null,
    retryCount: 0,
    resumableFromStep: null,
    startedAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:05:00.000Z",
  };
  assert.equal(record.currentStepIndex, 2);
  assert.equal(record.status, "running");
});

test("StepOutputRecord from barrel structure is correct", () => {
  const record: StepOutputRecord = {
    id: "stepout_123",
    taskId: "task_123",
    nodeRunId: "node_run_123",
    stepId: "step_1",
    roleId: "executor",
    status: "succeeded",
    dataJson: '{"result":"success"}',
    summary: "Step completed successfully",
    artifactsJson: null,
    tokenCost: 1500,
    durationMs: 5000,
    validationJson: null,
    producedAt: "2026-04-23T00:05:00.000Z",
  };
  assert.equal(record.status, "succeeded");
  assert.equal(record.tokenCost, 1500);
});

test("CostEventRecord from barrel structure is correct", () => {
  const record: CostEventRecord = {
    id: "cost_123",
    taskId: "task_456",
    sessionId: "sess_789",
    executionId: "exec_abc",
    agentId: "agent_def",
    provider: "anthropic",
    model: "claude-3-5-sonnet",
    inputTokens: 1000,
    outputTokens: 500,
    costUsd: 0.02,
    budgetScope: "task_execution",
    providerRequestId: "req_123",
    pricingVersion: "2024-01",
    createdAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.provider, "anthropic");
  assert.equal(record.costUsd, 0.02);
});

test("MemoryKind from barrel accepts all valid values", () => {
  const kinds: MemoryKind[] = ["general", "fact", "episode", "rule", "decision"];
  assert.equal(kinds.length, 5);
});

test("MemoryStatus from barrel accepts all valid values", () => {
  const statuses: MemoryStatus[] = ["active", "archived", "superseded"];
  assert.equal(statuses.length, 3);
});

test("MemoryRecord from barrel structure is correct", () => {
  const record: MemoryRecord = {
    id: "mem_123",
    taskId: "task_456",
    sessionId: "sess_789",
    agentId: "agent_abc",
    executionId: "exec_def",
    memoryLayer: "layer_3",
    scope: "session",
    contentJson: '{"text":"Important fact"}',
    classification: "fact",
    sourceTrustLevel: "trusted",
    qualityScore: 0.9,
    hitCount: 5,
    createdAt: "2026-04-23T00:00:00.000Z",
    lastAccessedAt: "2026-04-23T00:30:00.000Z",
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "fact",
    status: "active",
    importanceScore: 0.8,
    freshnessScore: 0.7,
    contentHash: "abc123def456",
  };
  assert.equal(record.memoryLayer, "layer_3");
  assert.equal(record.qualityScore, 0.9);
});

test("SessionSummaryRecord from barrel structure is correct", () => {
  const record: SessionSummaryRecord = {
    id: "summary_123",
    sessionId: "sess_456",
    taskId: "task_789",
    agentId: "agent_abc",
    summaryText: "Completed task successfully",
    keyDecisions: "Chose option A",
    keyOutcomes: "Task completed on time",
    memoryIdsReferenced: '["mem_1","mem_2"]',
    tokenCount: 5000,
    createdAt: "2026-04-23T00:30:00.000Z",
  };
  assert.equal(record.summaryText, "Completed task successfully");
  assert.equal(record.tokenCount, 5000);
});

test("BudgetScope from barrel accepts all valid values", () => {
  const scopes: BudgetScope[] = [
    "task_execution",
    "compaction",
    "skill_execution",
    "recovery_retry",
    "approval_review",
  ];
  assert.equal(scopes.length, 5);
});

// ---------------------------------------------------------------------------
// Workflow Types
// ---------------------------------------------------------------------------

test("CompensationPlanEntry from barrel structure is correct", () => {
  const entry: CompensationPlanEntry = {
    stepId: "step_1",
    compensationModel: "idempotent_replay",
    triggerCondition: "step_failed",
    compensationOwner: "agent_123",
    compensationTimeoutMs: 30000,
    compensationIdempotent: true,
    evidenceArtifactKind: "compensation_log",
  };
  assert.equal(entry.stepId, "step_1");
  assert.equal(entry.compensationModel, "idempotent_replay");
});

test("CompensationPlan from barrel structure is correct", () => {
  const plan: CompensationPlan = {
    workflowId: "wf_123",
    divisionId: "div_456",
    entries: [],
  };
  assert.equal(plan.workflowId, "wf_123");
  assert.equal(plan.entries.length, 0);
});

test("CheckpointPlanEntry from barrel structure is correct", () => {
  const entry: CheckpointPlanEntry = {
    afterStepId: "step_2",
    sideEffectBoundary: true,
    recoveryStrategy: "resume_from_checkpoint",
  };
  assert.equal(entry.afterStepId, "step_2");
  assert.equal(entry.sideEffectBoundary, true);
});

test("CheckpointPlan from barrel structure is correct", () => {
  const plan: CheckpointPlan = {
    workflowId: "wf_123",
    divisionId: "div_456",
    entries: [],
  };
  assert.equal(plan.workflowId, "wf_123");
  assert.equal(plan.entries.length, 0);
});

// ---------------------------------------------------------------------------
// Session Types
// ---------------------------------------------------------------------------

test("SessionRecord from barrel structure is correct", () => {
  const record: SessionRecord = {
    id: "sess_123",
    taskId: "task_456",
    channel: "cli",
    status: "open",
    externalSessionId: null,
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.status, "open");
  assert.equal(record.channel, "cli");
});

test("GatewayTargetRecord from barrel structure is correct", () => {
  const record: GatewayTargetRecord = {
    targetId: "target_123",
    channel: "web",
    targetKind: "user",
    externalTargetId: null,
    displayName: "Test User",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: null,
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.targetKind, "user");
  assert.equal(record.displayName, "Test User");
});

test("MessageRecord from barrel structure is correct", () => {
  const record: MessageRecord = {
    id: "msg_123",
    sessionId: "sess_456",
    direction: "inbound",
    messageType: "text",
    content: "Hello",
    partsJson: null,
    attachmentsJson: null,
    createdAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.direction, "inbound");
  assert.equal(record.content, "Hello");
});

test("MessagePart from barrel structure is correct", () => {
  const part: MessagePart = {
    partId: "part_123",
    messageId: "msg_456",
    partType: "text",
    sequence: 0,
    contentJson: '{"text":"Hello world"}',
    lineageJson: null,
    createdAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(part.partType, "text");
  assert.equal(part.sequence, 0);
});

test("RemoteLogRecord from barrel structure is correct", () => {
  const record: RemoteLogRecord = {
    id: "log_123",
    taskId: "task_456",
    executionId: "exec_789",
    workerId: "worker_abc",
    runtimeInstanceId: null,
    level: "info",
    message: "Test log message",
    contextJson: null,
    createdAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.level, "info");
  assert.equal(record.message, "Test log message");
});

test("ApprovalRecord from barrel structure is correct", () => {
  const record: ApprovalRecord = {
    id: "approval_123",
    taskId: "task_456",
    executionId: null,
    status: "requested",
    requestJson: '{"reason":"test"}',
    responseJson: null,
    timeoutPolicy: "24h",
    createdAt: "2026-04-23T00:00:00.000Z",
    respondedAt: null,
  };
  assert.equal(record.status, "requested");
  assert.equal(record.timeoutPolicy, "24h");
});

test("TakeoverSessionRecord from barrel structure is correct", () => {
  const record: TakeoverSessionRecord = {
    id: "takeover_123",
    taskId: "task_456",
    executionId: null,
    operatorId: "operator_789",
    status: "open",
    reasonCode: "debug",
    startedAt: "2026-04-23T00:00:00.000Z",
    closedAt: null,
  };
  assert.equal(record.status, "open");
  assert.equal(record.operatorId, "operator_789");
});

test("OperatorActionRecord from barrel structure is correct", () => {
  const record: OperatorActionRecord = {
    id: "action_123",
    takeoverSessionId: "takeover_456",
    taskId: "task_789",
    executionId: null,
    operatorId: "operator_abc",
    actionType: "retry_execution",
    reasonCode: "manual_retry",
    actionPayloadJson: "{}",
    beforeStateJson: "{}",
    afterStateJson: "{}",
    createdAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.actionType, "retry_execution");
  assert.equal(record.taskId, "task_789");
});

test("CompactionRecord from barrel structure is correct", () => {
  const record: CompactionRecord = {
    id: "compaction_123",
    sessionId: "sess_456",
    taskId: "task_789",
    harnessRunId: null,
    nodeRunId: null,
    stage: "trim",
    sourceMessageIdsJson: '["msg_1","msg_2"]',
    coveredMessageRange: null,
    summaryText: null,
    summaryRef: null,
    compactionReason: "context_limit",
    overflowTriggered: 1,
    autoTriggered: 1,
    tokenReductionEstimate: 500,
    createdAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.stage, "trim");
  assert.equal(record.overflowTriggered, 1);
});

test("EventRecord from barrel structure is correct", () => {
  const record: EventRecord = {
    id: "event_123",
    taskId: "task_456",
    sessionId: "sess_789",
    executionId: null,
    eventType: "task_started",
    eventTier: "tier_1",
    payloadJson: '{"data":"test"}',
    traceId: null,
    createdAt: "2026-04-23T00:00:00.000Z",
    schemaVersion: "v4.3",
    aggregateId: "task_456",
    runId: "run_123",
    sequence: 1,
    causationId: null,
    correlationId: "corr_123",
    payloadHash: "sha256:event_123",
    idempotencyKey: "idem_event_123",
    replayBehavior: "replay_as_fact",
    principal: "system:test",
    evidenceRefs: [],
  };
  assert.equal(record.eventTier, "tier_1");
  assert.equal(record.eventType, "task_started");
});

test("EventConsumerAckRecord from barrel structure is correct", () => {
  const record: EventConsumerAckRecord = {
    id: "ack_123",
    eventId: "event_456",
    consumerId: "consumer_789",
    status: "acked",
    lastAttemptAt: "2026-04-23T00:00:00.000Z",
    ackedAt: "2026-04-23T00:00:01.000Z",
    errorCode: null,
    attemptCount: 1,
  };
  assert.equal(record.status, "acked");
  assert.equal(record.attemptCount, 1);
});

test("EventDeadLetterRecord from barrel structure is correct", () => {
  const record: EventDeadLetterRecord = {
    id: "dlq_123",
    originalEventId: "event_456",
    eventType: "task_completed",
    payloadJson: '{"data":"test"}',
    consumerId: "consumer_789",
    failureCount: 3,
    lastError: "connection_timeout",
    deadLetteredAt: "2026-04-23T00:00:00.000Z",
    reprocessedAt: null,
    reprocessResult: null,
  };
  assert.equal(record.failureCount, 3);
  assert.equal(record.lastError, "connection_timeout");
});

test("SessionEventRecord from barrel structure is correct", () => {
  const record: SessionEventRecord = {
    id: "sess_event_123",
    sessionId: "sess_456",
    eventType: "session_started",
    payloadJson: '{"data":"test"}',
    createdAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.eventType, "session_started");
});

// ---------------------------------------------------------------------------
// Execution Types
// ---------------------------------------------------------------------------

test("ExecutionRecord from barrel structure is correct", () => {
  const record: ExecutionRecord = {
    id: "exec_123",
    taskId: "task_456",
    workflowId: "wf_789",
    parentExecutionId: null,
    harnessRunId: null,
    agentId: "agent_abc",
    roleId: null,
    runKind: "task_run",
    status: "created",
    inputRef: null,
    traceId: "trace_xyz",
    attempt: 1,
    timeoutMs: 300000,
    budgetUsdLimit: null,
    budgetReservationId: null,
    budgetLedgerId: null,
    requiresApproval: 0,
    sandboxMode: null,
    allowedToolsJson: null,
    allowedPathsJson: null,
    maxRetries: 3,
    retryBackoff: "exponential",
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.status, "created");
  assert.equal(record.runKind, "task_run");
});

test("ExecutionPrecheckRecord from barrel structure is correct", () => {
  const record: ExecutionPrecheckRecord = {
    id: "precheck_123",
    executionId: "exec_456",
    allowed: 1,
    reasonCode: null,
    resolvedBudgetUsd: 10.00,
    resolvedTimeoutMs: 300000,
    resolvedSandboxMode: "standard",
    resolvedToolsJson: null,
    resolvedPathsJson: null,
    checkedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.allowed, 1);
  assert.equal(record.resolvedTimeoutMs, 300000);
});

test("DeadLetterRecord from barrel structure is correct", () => {
  const record: DeadLetterRecord = {
    id: "dlq_123",
    executionId: "exec_456",
    taskId: "task_789",
    finalReasonCode: "execution_timeout",
    retryCount: 3,
    lastErrorMessage: "Task timed out after 300 seconds",
    movedAt: "2026-04-23T00:05:00.000Z",
  };
  assert.equal(record.finalReasonCode, "execution_timeout");
  assert.equal(record.retryCount, 3);
});

// ---------------------------------------------------------------------------
// Worker Types
// ---------------------------------------------------------------------------

test("AgentExecutionRecord from barrel structure is correct", () => {
  const record: AgentExecutionRecord = {
    executionId: "exec_123",
    taskId: "task_456",
    agentId: "agent_789",
    workflowId: null,
    roleId: null,
    runKind: "task_run",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "running",
    planJson: '{"steps":[]}',
    currentStepId: "step_1",
    lastToolName: null,
    toolCallCount: 0,
    lastDecisionJson: null,
    lastErrorCode: null,
    retryCount: 0,
    progressMessage: null,
    startedAt: "2026-04-23T00:00:00.000Z",
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:01:00.000Z",
    completedAt: null,
  };
  assert.equal(record.status, "running");
  assert.equal(record.runKind, "task_run");
});

test("WorkerSnapshotRecord from barrel structure is correct", () => {
  const record: WorkerSnapshotRecord = {
    workerId: "worker_123",
    status: "idle",
    capabilitiesJson: '{"tools":["code_execution"]}',
    runningExecutionsJson: "[]",
    maxConcurrency: 10,
    queueAffinity: null,
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: 25.5,
    memoryMb: 512,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
    version: 1,
  };
  assert.equal(record.status, "idle");
  assert.equal(record.maxConcurrency, 10);
});

test("CoordinatorInstanceRecord from barrel structure is correct", () => {
  const record: CoordinatorInstanceRecord = {
    coordinatorId: "coord_123",
    region: "us-east-1",
    role: "primary",
    queueAffinity: null,
    status: "active",
    maxConcurrentDispatches: 100,
    activeDispatchCount: 5,
    backlogCount: 10,
    cpuPct: 30.0,
    shardJson: "{}",
    lastHeartbeatAt: "2026-04-23T00:00:00.000Z",
    metadataJson: null,
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.status, "active");
  assert.equal(record.region, "us-east-1");
});

test("WorkerRegistrationChallengeRecord from barrel structure is correct", () => {
  const record: WorkerRegistrationChallengeRecord = {
    id: "challenge_123",
    workerId: "worker_456",
    challengeTokenHash: "abc123hash",
    allowedCapabilitiesJson: '{"capabilities":["code_execution"]}',
    expiresAt: "2026-04-23T00:05:00.000Z",
    usedAt: null,
    createdAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.workerId, "worker_456");
  assert.equal(record.challengeTokenHash, "abc123hash");
});

test("FileLockRecord from barrel structure is correct", () => {
  const record: FileLockRecord = {
    id: "lock_123",
    taskId: null,
    executionId: null,
    lockScope: "workspace",
    resourcePath: "/workspace/file.txt",
    lockMode: "exclusive",
    ownerId: "worker_456",
    expiresAt: "2026-04-23T00:10:00.000Z",
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.lockMode, "exclusive");
  assert.equal(record.resourcePath, "/workspace/file.txt");
});

test("HeartbeatSnapshotRecord from barrel structure is correct", () => {
  const record: HeartbeatSnapshotRecord = {
    id: "heartbeat_123",
    executionId: "exec_456",
    agentId: "agent_789",
    runtimeInstanceId: null,
    restartGeneration: 0,
    status: "running",
    progressMessage: "Processing step 2",
    cpuPct: 50.0,
    memoryMb: 1024,
    sampledAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.status, "running");
  assert.equal(record.progressMessage, "Processing step 2");
});

// ---------------------------------------------------------------------------
// Dispatch Types
// ---------------------------------------------------------------------------

test("ExecutionTicketRecord from barrel structure is correct", () => {
  const record: ExecutionTicketRecord = {
    id: "ticket_123",
    executionId: "exec_456",
    taskId: "task_789",
    tenantId: "tenant_123",
    priority: "normal",
    queueName: null,
    requiredCapabilitiesJson: '{"tools":["code_execution"]}',
    dispatchAfter: null,
    attempt: 1,
    status: "pending",
    assignedWorkerId: null,
    leaseId: null,
    claimedAt: null,
    consumedAt: null,
    invalidatedAt: null,
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.status, "pending");
  assert.equal(record.priority, "normal");
});

test("DispatchWorkerEvaluation from barrel structure is correct", () => {
  const evaluation: DispatchWorkerEvaluation = {
    workerId: "worker_123",
    status: "idle",
    schedulingStatus: "healthy",
    queueAffinity: null,
    availableSlots: 5,
    accepted: true,
    rejectionReason: null,
    missingCapabilities: [],
  };
  assert.equal(evaluation.accepted, true);
  assert.equal(evaluation.availableSlots, 5);
});

test("DispatchDecisionTrace from barrel structure is correct", () => {
  const trace: DispatchDecisionTrace = {
    ticketId: "ticket_123",
    executionId: "exec_456",
    taskId: "task_789",
    queueName: null,
    preferredWorkerId: null,
    requiredCapabilities: ["code_execution"],
    outcome: "dispatched",
    reasonCode: null,
    selectedWorkerId: "worker_abc",
    leaseId: "lease_def",
    evaluations: [],
  };
  assert.equal(trace.outcome, "dispatched");
  assert.equal(trace.selectedWorkerId, "worker_abc");
});

// ---------------------------------------------------------------------------
// Lease Types
// ---------------------------------------------------------------------------

test("ExecutionLeaseRecord from barrel structure is correct", () => {
  const record: ExecutionLeaseRecord = {
    id: "lease_123",
    executionId: "exec_456",
    workerId: "worker_789",
    attempt: 1,
    fencingToken: 1,
    queueName: null,
    status: "active",
    leasedAt: "2026-04-23T00:00:00.000Z",
    expiresAt: "2026-04-23T00:10:00.000Z",
    lastHeartbeatAt: "2026-04-23T00:00:00.000Z",
    releasedAt: null,
    reasonCode: null,
  };
  assert.equal(record.status, "active");
  assert.equal(record.fencingToken, 1);
});

test("LeaseAuditRecord from barrel structure is correct", () => {
  const record: LeaseAuditRecord = {
    id: "audit_123",
    executionId: "exec_456",
    leaseId: "lease_789",
    workerId: "worker_abc",
    fencingToken: 1,
    eventType: "lease_granted",
    reasonCode: null,
    recordedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.eventType, "lease_granted");
  assert.equal(record.fencingToken, 1);
});

// ---------------------------------------------------------------------------
// Secret Types
// ---------------------------------------------------------------------------

test("SecretRegistryRecord from barrel structure is correct", () => {
  const record: SecretRegistryRecord = {
    secretRef: "secret_123",
    displayName: "API Key",
    category: "provider_api_key",
    providerKind: "vault",
    scopeType: "tenant",
    scopeRef: "tenant_456",
    status: "active",
    rotationPolicyJson: "{}",
    metadataJson: null,
    currentVersion: "v1",
    lastRotatedAt: null,
    nextRotationDueAt: null,
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.status, "active");
  assert.equal(record.category, "provider_api_key");
});

test("SecretUsageAuditRecord from barrel structure is correct", () => {
  const record: SecretUsageAuditRecord = {
    auditId: "audit_123",
    secretRef: "secret_456",
    providerKind: "vault",
    taskId: null,
    executionId: null,
    requestedBy: "agent_789",
    grantedTo: "worker_abc",
    usagePurpose: "api_access",
    resolvedAt: "2026-04-23T00:00:00.000Z",
    expiresAt: null,
    maskedValue: "sk_****",
    metadataJson: null,
  };
  assert.equal(record.requestedBy, "agent_789");
  assert.equal(record.grantedTo, "worker_abc");
});

test("SecretRotationEventRecord from barrel structure is correct", () => {
  const record: SecretRotationEventRecord = {
    eventId: "rotation_123",
    secretRef: "secret_456",
    providerKind: "vault",
    rotationMode: "scheduled",
    status: "completed",
    reasonCode: "scheduled_rotation",
    requestedBy: "system",
    previousVersion: "v1",
    nextVersion: "v2",
    occurredAt: "2026-04-23T00:00:00.000Z",
    metadataJson: null,
  };
  assert.equal(record.status, "completed");
  assert.equal(record.rotationMode, "scheduled");
});

test("SecretLeaseRecord from barrel structure is correct", () => {
  const record: SecretLeaseRecord = {
    leaseId: "lease_123",
    secretRef: "secret_456",
    providerKind: "vault",
    taskId: null,
    executionId: null,
    requestedBy: "agent_789",
    grantedTo: "worker_abc",
    usagePurpose: "api_access",
    issuedAt: "2026-04-23T00:00:00.000Z",
    expiresAt: "2026-04-23T00:10:00.000Z",
    status: "active",
    revokedAt: null,
    revokedBy: null,
    revocationReasonCode: null,
    sourceVersion: "v2",
    maskedValue: "sk_****",
    metadataJson: null,
  };
  assert.equal(record.status, "active");
  assert.equal(record.grantedTo, "worker_abc");
});

// ---------------------------------------------------------------------------
// Billing Types
// ---------------------------------------------------------------------------

test("BillingAccountRecord from barrel structure is correct", () => {
  const record: BillingAccountRecord = {
    accountId: "account_123",
    ownerId: "user_456",
    workspaceId: null,
    planId: "pro",
    status: "active",
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.status, "active");
  assert.equal(record.planId, "pro");
});

test("BillingInvoiceRecord from barrel structure is correct", () => {
  const record: BillingInvoiceRecord = {
    invoiceId: "invoice_123",
    accountId: "account_456",
    workspaceId: null,
    tenantId: null,
    periodId: "2026-04",
    currency: "USD",
    subtotalUsd: 100.00,
    taxUsd: 10.00,
    totalUsd: 110.00,
    status: "open",
    summaryJson: "{}",
    externalInvoiceRef: null,
    dueAt: "2026-05-01T00:00:00.000Z",
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
    paidAt: null,
  };
  assert.equal(record.status, "open");
  assert.equal(record.totalUsd, 110.00);
});

test("BillingPaymentSessionRecord from barrel structure is correct", () => {
  const record: BillingPaymentSessionRecord = {
    sessionId: "payment_sess_123",
    invoiceId: "invoice_456",
    accountId: "account_789",
    gatewayKind: "stripe",
    gatewaySessionRef: "cs_test_abc",
    checkoutUrl: "https://checkout.stripe.com/test",
    status: "pending",
    amountUsd: 110.00,
    currency: "USD",
    expiresAt: "2026-04-23T01:00:00.000Z",
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
    settledAt: null,
    failureCode: null,
  };
  assert.equal(record.status, "pending");
  assert.equal(record.gatewayKind, "stripe");
});

test("UsageEventRecord from barrel structure is correct", () => {
  const record: UsageEventRecord = {
    usageId: "usage_123",
    accountId: "account_456",
    subjectId: "tenant_789",
    workspaceId: null,
    tenantId: null,
    taskId: null,
    executionId: null,
    stepId: null,
    metricType: "api_calls",
    quantity: 1000,
    source: "runtime",
    unitPriceUsd: 0.001,
    capturedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.source, "runtime");
  assert.equal(record.quantity, 1000);
});

test("QuotaCounterRecord from barrel structure is correct", () => {
  const record: QuotaCounterRecord = {
    counterId: "quota_123",
    accountId: "account_456",
    metricType: "api_calls",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    usedQuantity: 5000,
    limitQuantity: 10000,
    limitType: "soft",
    resetPolicy: "calendar_month",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.limitType, "soft");
  assert.equal(record.usedQuantity, 5000);
});

test("LedgerEntryRecord from barrel structure is correct", () => {
  const record: LedgerEntryRecord = {
    entryId: "ledger_123",
    accountId: "account_456",
    usageId: null,
    periodId: "2026-04",
    entryType: "usage_charge",
    amountUsd: 50.00,
    currency: "USD",
    sourceRef: null,
    recordedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.entryType, "usage_charge");
  assert.equal(record.amountUsd, 50.00);
});

test("EntitlementDecisionRecord from barrel structure is correct", () => {
  const record: EntitlementDecisionRecord = {
    decisionId: "decision_123",
    accountId: "account_456",
    featureKey: "advanced_analytics",
    metricType: null,
    requestedQuantity: null,
    allowed: 1,
    decisionType: "allow",
    reasonCode: "feature_enabled",
    policyVersion: "v1",
    evaluatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.decisionType, "allow");
  assert.equal(record.reasonCode, "feature_enabled");
});

// ---------------------------------------------------------------------------
// Release Types
// ---------------------------------------------------------------------------

test("ReleaseBundleRecord from barrel structure is correct", () => {
  const record: ReleaseBundleRecord = {
    bundleId: "bundle_123",
    environment: "staging",
    version: "1.2.3",
    commitSha: "abc123def",
    imageTag: "v1.2.3",
    imageRef: "registry.example.com/image:v1.2.3",
    rolloutStrategy: "rolling",
    deploymentNamespace: "default",
    clusterName: "prod-cluster",
    configPath: "/config/release.yaml",
    configBundleRef: "config_bundle_123",
    registryCredentialRef: "cred_456",
    deploymentCredentialRef: "cred_789",
    publishWorkflowPath: "/workflows/publish.yaml",
    deployWorkflowPath: "/workflows/deploy.yaml",
    requiredReadinessChecksJson: "[]",
    recommendedCommandsJson: "[]",
    taskId: null,
    jsonArtifactUri: null,
    markdownArtifactUri: null,
    generatedAt: "2026-04-23T00:00:00.000Z",
    exportedAt: "2026-04-23T00:01:00.000Z",
  };
  assert.equal(record.version, "1.2.3");
  assert.equal(record.rolloutStrategy, "rolling");
});

test("ReleaseExecutionReportRecord from barrel structure is correct", () => {
  const record: ReleaseExecutionReportRecord = {
    executionId: "exec_123",
    bundleId: "bundle_456",
    environment: "prod",
    version: "1.2.3",
    commitSha: "abc123def",
    rolloutStrategy: "canary",
    imageRef: "registry.example.com/image:v1.2.3",
    imageRepository: "registry.example.com/image",
    registrySecretRef: "secret_789",
    registrySecretProviderKind: "vault",
    registrySecretResolved: 1,
    registrySecretAccessMode: "describe",
    registryLeaseId: null,
    registryLeaseStatus: null,
    registryLeaseExpiresAt: null,
    registryLeaseRevokedAt: null,
    publishWorkflowRunId: null,
    publishWorkflowRunUrl: null,
    buildCommand: "npm run build",
    publishCommand: "docker push",
    commandResultsJson: "{}",
    taskId: null,
    jsonArtifactUri: null,
    markdownArtifactUri: null,
    generatedAt: "2026-04-23T00:00:00.000Z",
    exportedAt: "2026-04-23T00:01:00.000Z",
  };
  assert.equal(record.rolloutStrategy, "canary");
  assert.equal(record.registrySecretResolved, 1);
});

test("DeploymentExecutionReportRecord from barrel structure is correct", () => {
  const record: DeploymentExecutionReportRecord = {
    executionId: "exec_123",
    environment: "prod",
    version: "1.2.3",
    commitSha: "abc123def",
    rolloutStrategy: "blue_green",
    targetEligible: 1,
    configBundleRef: "config_456",
    configVersionId: null,
    registrySecretRef: "secret_789",
    registrySecretProviderKind: "vault",
    registrySecretResolved: 1,
    deploymentSecretRef: "secret_abc",
    deploymentSecretProviderKind: "kms",
    deploymentSecretResolved: 1,
    publishWorkflowRunId: null,
    publishWorkflowRunUrl: null,
    deployWorkflowRunId: null,
    deployWorkflowRunUrl: null,
    executionMode: "execute",
    publishCommand: "npm run build",
    deployCommand: "kubectl apply",
    commandResultsJson: "{}",
    releaseBundleId: "bundle_def",
    taskId: null,
    jsonArtifactUri: null,
    markdownArtifactUri: null,
    generatedAt: "2026-04-23T00:00:00.000Z",
    exportedAt: "2026-04-23T00:01:00.000Z",
  };
  assert.equal(record.executionMode, "execute");
  assert.equal(record.rolloutStrategy, "blue_green");
});

test("EnvironmentPromotionHistoryRecord from barrel structure is correct", () => {
  const record: EnvironmentPromotionHistoryRecord = {
    promotionId: "promo_123",
    sourceEnvironment: "staging",
    targetEnvironment: "prod",
    version: "1.2.3",
    commitSha: "abc123def",
    rolloutStrategy: "rolling",
    decisionType: "execute",
    decisionStatus: "executed",
    releaseBundleId: "bundle_456",
    deploymentExecutionId: "exec_789",
    reasonCode: "promote_stable",
    actor: "user_abc",
    metadataJson: null,
    recordedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.sourceEnvironment, "staging");
  assert.equal(record.targetEnvironment, "prod");
});

// ---------------------------------------------------------------------------
// Workspace Types
// ---------------------------------------------------------------------------

test("WorkspaceRecord from barrel structure is correct", () => {
  const record: WorkspaceRecord = {
    workspaceId: "ws_123",
    ownerId: "user_456",
    displayName: "Test Workspace",
    planId: "pro",
    defaultPolicySet: "default",
    organizationId: null,
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.displayName, "Test Workspace");
});

test("WorkspaceMembershipRecord from barrel structure is correct", () => {
  const record: WorkspaceMembershipRecord = {
    workspaceId: "ws_123",
    userId: "user_456",
    role: "admin",
    joinedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.role, "admin");
});

test("OrganizationRecord from barrel structure is correct", () => {
  const record: OrganizationRecord = {
    organizationId: "org_123",
    displayName: "Test Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.displayName, "Test Org");
});

test("OrganizationMembershipRecord from barrel structure is correct", () => {
  const record: OrganizationMembershipRecord = {
    organizationId: "org_123",
    userId: "user_456",
    role: "member",
    joinedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.role, "member");
});

test("TenantRecord from barrel structure is correct", () => {
  const record: TenantRecord = {
    tenantId: "tenant_123",
    organizationId: "org_456",
    storageScope: "standard",
    identityScope: "standard",
    policyScope: "standard",
    artifactScope: "standard",
    isolationMode: "shared_logical",
    deploymentMode: "cloud_shared",
    quotas: {
      monthlyCostLimitUsd: 1000,
      maxStorageBytes: 100 * 1024 * 1024 * 1024,
      maxConcurrentExecutions: 25,
    },
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.isolationMode, "shared_logical");
  assert.equal(record.deploymentMode, "cloud_shared");
});

test("DeploymentBindingRecord from barrel structure is correct", () => {
  const record: DeploymentBindingRecord = {
    bindingId: "binding_123",
    tenantId: "tenant_456",
    environmentId: "env_789",
    deploymentMode: "cloud_shared",
    region: "us-east-1",
    networkBoundary: "secure",
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.deploymentMode, "cloud_shared");
  assert.equal(record.region, "us-east-1");
});

test("DataNamespaceRecord from barrel structure is correct", () => {
  const record: DataNamespaceRecord = {
    namespaceId: "ns_123",
    plane: "analytics",
    tenantId: "tenant_456",
    organizationId: null,
    workspaceId: null,
    retentionPolicy: "standard",
    encryptionPolicy: "standard",
    residencyPolicy: null,
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.plane, "analytics");
  assert.equal(record.retentionPolicy, "standard");
});

// ---------------------------------------------------------------------------
// Data Types
// ---------------------------------------------------------------------------

test("AnalyticsFactRecord from barrel structure is correct", () => {
  const record: AnalyticsFactRecord = {
    factId: "fact_123",
    namespaceId: "ns_456",
    tenantId: "tenant_789",
    organizationId: null,
    workspaceId: null,
    metricName: "daily_active_users",
    dimensionJson: '{"region":"us-east"}',
    value: 1000,
    windowStart: "2026-04-23T00:00:00.000Z",
    windowEnd: "2026-04-23T23:59:59.999Z",
    sourceRef: "analytics_pipeline",
    capturedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.metricName, "daily_active_users");
  assert.equal(record.value, 1000);
});

test("ArchiveBundleRecord from barrel structure is correct", () => {
  const record: ArchiveBundleRecord = {
    bundleId: "archive_123",
    namespaceId: "ns_456",
    tenantId: null,
    organizationId: null,
    workspaceId: null,
    bundleType: "task_archive",
    sourceRefsJson: "[]",
    summaryRef: "summary_789",
    createdAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.bundleType, "task_archive");
});

test("ReplayDatasetRecord from barrel structure is correct", () => {
  const record: ReplayDatasetRecord = {
    datasetId: "replay_123",
    namespaceId: "ns_456",
    tenantId: null,
    organizationId: null,
    workspaceId: null,
    datasetType: "test_replay",
    sampleRefsJson: "[]",
    truthRefsJson: "[]",
    version: "v1",
    createdAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.datasetType, "test_replay");
  assert.equal(record.version, "v1");
});

test("DataMovementJobRecord from barrel structure is correct", () => {
  const record: DataMovementJobRecord = {
    jobId: "job_123",
    tenantId: null,
    organizationId: null,
    workspaceId: null,
    sourceNamespaceId: "ns_src",
    targetNamespaceId: "ns_tgt",
    sourcePlane: "transactional",
    targetPlane: "analytics",
    movementType: "analytics_etl",
    inputRefsJson: "[]",
    status: "completed",
    startedAt: "2026-04-23T00:00:00.000Z",
    finishedAt: "2026-04-23T00:10:00.000Z",
    reportJson: null,
  };
  assert.equal(record.movementType, "analytics_etl");
  assert.equal(record.status, "completed");
});

test("IntelItemRecord from barrel structure is correct", () => {
  const record: IntelItemRecord = {
    intelId: "intel_123",
    tenantId: "tenant_456",
    sourceId: "source_789",
    title: "Industry News",
    summary: "Latest industry updates",
    rawRef: "https://example.com/news",
    relevanceScore: 0.8,
    importance: 0.7,
    tagsJson: '["news","industry"]',
    dedupeKey: "news_123",
    capturedAt: "2026-04-23T00:00:00.000Z",
    expiresAt: null,
  };
  assert.equal(record.title, "Industry News");
  assert.equal(record.relevanceScore, 0.8);
});

test("IntelBriefRecord from barrel structure is correct", () => {
  const record: IntelBriefRecord = {
    briefId: "brief_123",
    tenantId: "tenant_456",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    sourceScopeJson: '{"sources":["rss","web"]}',
    itemIdsJson: '["intel_1","intel_2"]',
    overallSummary: "Monthly intelligence summary",
    recommendedActionsJson: '{"actions":["review_news"]}',
    generatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.overallSummary, "Monthly intelligence summary");
});

// ---------------------------------------------------------------------------
// Ops Types
// ---------------------------------------------------------------------------

test("EnvironmentReadinessRecord from barrel structure is correct", () => {
  const record: EnvironmentReadinessRecord = {
    readinessId: "ready_123",
    environment: "prod",
    componentType: "worker_fleet",
    componentId: "fleet_456",
    credentialReady: 1,
    secondaryGatesJson: "{}",
    owner: "platform-team",
    lastVerifiedAt: "2026-04-23T00:00:00.000Z",
    isActive: 1,
    notes: null,
  };
  assert.equal(record.componentType, "worker_fleet");
  assert.equal(record.credentialReady, 1);
});

test("EnterpriseCapabilityReportRecord from barrel structure is correct", () => {
  const record: EnterpriseCapabilityReportRecord = {
    reportId: "cap_report_123",
    accountId: "account_456",
    workspaceId: null,
    tenantId: null,
    environment: "prod",
    deploymentMode: "cloud_shared",
    summaryJson: "{}",
    reportJson: "{}",
    generatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.environment, "prod");
});

test("IncidentHandoffRecord from barrel structure is correct", () => {
  const record: IncidentHandoffRecord = {
    handoffId: "handoff_123",
    incidentId: "incident_456",
    environment: "prod",
    status: "ready",
    shiftOwner: "oncall_abc",
    primaryOncall: "engineer_1",
    secondaryOncall: "engineer_2",
    severity: "high",
    handoffJson: "{}",
    createdAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.status, "ready");
  assert.equal(record.severity, "high");
});

test("EnterpriseGovernanceReportRecord from barrel structure is correct", () => {
  const record: EnterpriseGovernanceReportRecord = {
    reportId: "gov_report_123",
    taskId: null,
    environment: "prod",
    status: "pass",
    shiftOwner: "oncall_abc",
    summaryJson: "{}",
    reportJson: "{}",
    generatedAt: "2026-04-23T00:00:00.000Z",
    handoffId: "handoff_456",
  };
  assert.equal(record.status, "pass");
  assert.equal(record.shiftOwner, "oncall_abc");
});

test("ExtensionPackageRecord from barrel structure is correct", () => {
  const record: ExtensionPackageRecord = {
    packageId: "pkg_123",
    tenantId: null,
    extensionId: "ext_456",
    packageType: "tool",
    displayName: "Custom Tool",
    version: "1.0.0",
    owner: "developer_abc",
    trustLevel: "verified",
    sourceUri: "https://store.example.com/pkg_123",
    capabilitiesJson: "{}",
    permissionsJson: "{}",
    compatibilityJson: "{}",
    signatureVerified: 1,
    manifestChecksum: "abc123",
    lifecycleState: "enabled",
    reviewRequired: 0,
    sbomVerified: 1,
    sandboxCertVerified: 1,
    egressPolicyCompliant: 1,
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.packageType, "tool");
  assert.equal(record.lifecycleState, "enabled");
});

test("MarketplaceReviewRecord from barrel structure is correct", () => {
  const record: MarketplaceReviewRecord = {
    reviewId: "review_123",
    tenantId: null,
    packageId: "pkg_456",
    status: "submitted",
    submitter: "developer_abc",
    reviewer: null,
    decisionReasonCode: null,
    findingsJson: "{}",
    permissionSurfaceHash: "hash_789",
    submittedAt: "2026-04-23T00:00:00.000Z",
    decidedAt: null,
  };
  assert.equal(record.status, "submitted");
});

test("MarketplacePublicationRecord from barrel structure is correct", () => {
  const record: MarketplacePublicationRecord = {
    publicationId: "pub_123",
    tenantId: null,
    packageId: "pkg_456",
    reviewId: "review_789",
    channel: "stable",
    status: "published",
    compatibilityMatrixJson: "{}",
    revocationReasonCode: null,
    publishedAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.status, "published");
  assert.equal(record.channel, "stable");
});

test("MarketplaceGovernanceReportRecord from barrel structure is correct", () => {
  const record: MarketplaceGovernanceReportRecord = {
    reportId: "mp_gov_123",
    tenantId: null,
    summaryJson: "{}",
    reportJson: "{}",
    generatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.reportId, "mp_gov_123");
});

test("PerceptionSourceRecord from barrel structure is correct", () => {
  const record: PerceptionSourceRecord = {
    sourceId: "source_123",
    tenantId: "tenant_456",
    type: "rss",
    name: "Tech News",
    enabled: 1,
    scheduleJson: null,
    filtersJson: null,
    priority: 10,
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.type, "rss");
  assert.equal(record.enabled, 1);
});

test("ActionProposalRecord from barrel structure is correct", () => {
  const record: ActionProposalRecord = {
    proposalId: "proposal_123",
    tenantId: "tenant_456",
    briefId: "brief_789",
    intelId: null,
    taskId: null,
    title: "Optimize Performance",
    summary: "Proposal to optimize system performance",
    actionType: "optimization",
    status: "proposed",
    requiresApproval: 0,
    proposalJson: "{}",
    createdAt: "2026-04-23T00:00:00.000Z",
    decidedAt: null,
  };
  assert.equal(record.status, "proposed");
  assert.equal(record.actionType, "optimization");
});

// ---------------------------------------------------------------------------
// Evolution Types
// ---------------------------------------------------------------------------

test("EvolutionProposalRecord from barrel structure is correct", () => {
  const record: EvolutionProposalRecord = {
    id: "proposal_123",
    taskId: "task_456",
    executionId: null,
    sourceAgentId: "agent_789",
    kind: "budget_adjustment",
    scopeType: "division",
    scopeRef: "div_abc",
    status: "pending_approval",
    approvalId: null,
    summary: "Increase budget",
    proposalJson: '{"budgetUsd":100}',
    evidenceJson: "{}",
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
    approvedAt: null,
    appliedAt: null,
    rolledBackAt: null,
  };
  assert.equal(record.kind, "budget_adjustment");
  assert.equal(record.status, "pending_approval");
});

test("EvolutionPolicyRecord from barrel structure is correct", () => {
  const record: EvolutionPolicyRecord = {
    id: "policy_123",
    proposalId: "proposal_456",
    kind: "budget_adjustment",
    scopeType: "division",
    scopeRef: "div_abc",
    status: "active",
    valueJson: '{"budgetUsd":100}',
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
    rolledBackAt: null,
  };
  assert.equal(record.status, "active");
  assert.equal(record.kind, "budget_adjustment");
});

test("EvolutionLogRecord from barrel structure is correct", () => {
  const record: EvolutionLogRecord = {
    id: "log_123",
    proposalId: "proposal_456",
    taskId: "task_789",
    executionId: null,
    eventType: "proposal_created",
    reasonCode: "agent_suggestion",
    beforeStateJson: null,
    afterStateJson: '{"status":"pending_approval"}',
    metadataJson: null,
    createdAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.eventType, "proposal_created");
  assert.equal(record.reasonCode, "agent_suggestion");
});

test("PmfValidationReportRecord from barrel structure is correct", () => {
  const record: PmfValidationReportRecord = {
    id: "pmf_123",
    profileName: "standard",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    divisionId: null,
    verdict: "pass",
    summaryJson: "{}",
    reportJson: "{}",
    generatedAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(record.verdict, "pass");
  assert.equal(record.profileName, "standard");
});

// ---------------------------------------------------------------------------
// Core Types
// ---------------------------------------------------------------------------

test("TraceContext from barrel structure is correct", () => {
  const ctx: TraceContext = {
    traceId: "trace_abc123",
    spanId: "span_456",
    parentSpanId: "span_789",
    correlationId: "corr_xyz",
  };
  assert.equal(ctx.traceId, "trace_abc123");
  assert.equal(ctx.spanId, "span_456");
});

test("TraceContext from barrel allows null optional fields", () => {
  const ctx: TraceContext = {
    traceId: "trace_abc",
    spanId: null,
    parentSpanId: null,
    correlationId: null,
  };
  assert.equal(ctx.spanId, null);
  assert.equal(ctx.parentSpanId, null);
});

test("TransitionAuditContext from barrel structure is correct", () => {
  const ctx: TransitionAuditContext = {
    reasonCode: "task.completed",
    reasonDetail: "Task finished successfully",
    traceId: "trace_abc",
    spanId: "span_123",
    parentSpanId: null,
    correlationId: "corr_xyz",
    actorType: "agent",
    actorId: "worker_456",
    idempotencyKey: "idempotent_789",
    occurredAt: "2026-04-23T00:00:00.000Z",
    metadataJson: '{"extra":"data"}',
  };
  assert.equal(ctx.reasonCode, "task.completed");
  assert.equal(ctx.actorType, "agent");
  assert.equal(ctx.actorId, "worker_456");
});

test("TransitionAuditContext from barrel allows minimal definition", () => {
  const ctx: TransitionAuditContext = {
    reasonCode: "system.scheduled",
    traceId: "trace_min",
    actorType: "system",
    occurredAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(ctx.reasonCode, "system.scheduled");
  assert.equal(ctx.actorType, "system");
  assert.equal(ctx.reasonDetail, undefined);
  assert.equal(ctx.actorId, undefined);
});

test("TransitionCommand from barrel structure is correct", () => {
  const cmd: TransitionCommand<"task", "pending" | "in_progress" | "done"> = {
    entityKind: "task",
    entityId: "task_123",
    fromStatus: "pending",
    toStatus: "in_progress",
    reasonCode: "task.started",
    traceId: "trace_abc",
    actorType: "scheduler",
    occurredAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(cmd.entityKind, "task");
  assert.equal(cmd.toStatus, "in_progress");
});

test("TaskStatusTransitionCommand from barrel structure is correct", () => {
  const cmd: TaskStatusTransitionCommand = {
    entityKind: "task",
    entityId: "task_456",
    fromStatus: "pending",
    toStatus: "in_progress",
    executionId: "exec_789",
    reasonCode: "task.started",
    traceId: "trace_def",
    actorType: "scheduler",
    occurredAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(cmd.entityKind, "task");
  assert.equal(cmd.fromStatus, "pending");
  assert.equal(cmd.toStatus, "in_progress");
  assert.equal(cmd.executionId, "exec_789");
});

test("TaskStatusTransitionCommand from barrel allows null executionId", () => {
  const cmd: TaskStatusTransitionCommand = {
    entityKind: "task",
    entityId: "task_abc",
    fromStatus: "queued",
    toStatus: "cancelled",
    executionId: null,
    reasonCode: "task.cancelled",
    traceId: "trace_ghi",
    actorType: "user",
    occurredAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(cmd.executionId, null);
});

test("WorkflowStatusTransitionCommand from barrel structure is correct", () => {
  const cmd: WorkflowStatusTransitionCommand = {
    entityKind: "workflow",
    entityId: "wf_123",
    fromStatus: "running",
    toStatus: "paused",
    currentStepIndex: 2,
    outputsJson: '{"step1":"output1"}',
    reasonCode: "workflow.paused",
    traceId: "trace_wf",
    actorType: "agent",
    occurredAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(cmd.entityKind, "workflow");
  assert.equal(cmd.fromStatus, "running");
  assert.equal(cmd.toStatus, "paused");
  assert.equal(cmd.currentStepIndex, 2);
});

test("SessionStatusTransitionCommand from barrel structure is correct", () => {
  const cmd: SessionStatusTransitionCommand = {
    entityKind: "session",
    entityId: "sess_123",
    fromStatus: "open",
    toStatus: "completed",
    reasonCode: "session.completed",
    traceId: "trace_sess",
    actorType: "agent",
    occurredAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(cmd.entityKind, "session");
  assert.equal(cmd.fromStatus, "open");
  assert.equal(cmd.toStatus, "completed");
});

test("ExecutionStatusTransitionCommand from barrel structure is correct", () => {
  const cmd: ExecutionStatusTransitionCommand = {
    entityKind: "execution",
    entityId: "exec_123",
    fromStatus: "prechecking",
    toStatus: "executing",
    reasonCode: "execution.started",
    traceId: "trace_exec",
    actorType: "scheduler",
    occurredAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(cmd.entityKind, "execution");
  assert.equal(cmd.fromStatus, "prechecking");
  assert.equal(cmd.toStatus, "executing");
});

test("ApprovalStatusTransitionCommand from barrel structure is correct", () => {
  const cmd: ApprovalStatusTransitionCommand = {
    entityKind: "approval",
    entityId: "approval_123",
    fromStatus: "requested",
    toStatus: "approved",
    responseJson: '{"decision":"approved","reason":"looks good"}',
    reasonCode: "approval.approved",
    traceId: "trace_appr",
    actorType: "user",
    occurredAt: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(cmd.entityKind, "approval");
  assert.equal(cmd.fromStatus, "requested");
  assert.equal(cmd.toStatus, "approved");
});

test("TaskSnapshot from barrel structure is correct", () => {
  const snapshot: TaskSnapshot = {
    task: {
      id: "task_123",
      parentId: null,
      rootId: "task_123",
      divisionId: "div_abc",
      tenantId: "tenant_abc",
      title: "Test task",
      status: "in_progress",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: null,
      outputJson: null,
      estimatedCostUsd: null,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:01:00.000Z",
      completedAt: null,
    },
    workflow: {
      taskId: "task_123",
      divisionId: "div_abc",
      workflowId: "wf_456",
      status: "running",
      currentStepIndex: 1,
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:01:00.000Z",
    },
    execution: {
      id: "exec_789",
      taskId: "task_123",
      workflowId: null,
      parentExecutionId: null,
      harnessRunId: null,
      agentId: "agent_abc",
      roleId: null,
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId: "trace_abc",
      attempt: 1,
      timeoutMs: 300000,
      budgetUsdLimit: null,
      budgetReservationId: null,
      budgetLedgerId: null,
      requiresApproval: 0,
      sandboxMode: null,
      allowedToolsJson: null,
      allowedPathsJson: null,
      maxRetries: 3,
      retryBackoff: "exponential",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:01:00.000Z",
    },
    session: {
      id: "sess_def",
      taskId: "task_123",
      channel: "cli",
      status: "open",
      externalSessionId: null,
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:01:00.000Z",
    },
    stepOutputs: [],
    events: [],
  };
  assert.equal(snapshot.task.id, "task_123");
  assert.equal(snapshot.workflow?.workflowId, "wf_456");
  assert.equal(snapshot.execution?.status, "executing");
  assert.equal(snapshot.session?.status, "open");
});

test("TaskSnapshot from barrel allows null workflow", () => {
  const snapshot: TaskSnapshot = {
    task: {
      id: "task_simple",
      parentId: null,
      rootId: "task_simple",
      divisionId: null,
      tenantId: "tenant_abc",
      title: "Simple task",
      status: "queued",
      source: "user",
      priority: "low",
      inputJson: "{}",
      normalizedInputJson: null,
      outputJson: null,
      estimatedCostUsd: null,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:00:00.000Z",
      completedAt: null,
    },
    workflow: null,
    execution: null,
    session: null,
    stepOutputs: [],
    events: [],
  };
  assert.equal(snapshot.workflow, null);
  assert.equal(snapshot.execution, null);
  assert.equal(snapshot.session, null);
});
