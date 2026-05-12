/**
 * Types Module Barrel
 *
 * Re-exports type utilities and constants:
 * - ID generation utilities
 * - Status constants
 * - Cross-layer contract types
 */

export * from "./ids.js";
export * from "./anomaly-event-classification.js";
export * from "./data-classification.js";
export * from "./platform-contracts.js";
export * from "./recovery-cadence.js";
export * from "./status.js";
export * from "./unified-runtime-mode.js";
export * from "./unified-severity.js";

// Re-export legacy factory functions for backward compatibility
// These factories throw ValidationError when called (deprecated per §4.3)
// NOTE: createExecutionPlan removed per ADR-109 (R16-77)
export * from "./feedback.js";
export * from "./governance.js";
export * from "./health.js";
export * from "./slo.js";
export * from "./cost.js";
export type {
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
  CompensationPlanEntry,
  CompensationPlan,
  CheckpointPlanEntry,
  CheckpointPlan,
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
  ExecutionRecord,
  ExecutionPrecheckRecord,
  DeadLetterRecord,
  AgentExecutionRecord,
  WorkerSnapshotRecord,
  CoordinatorInstanceRecord,
  WorkerRegistrationChallengeRecord,
  FileLockRecord,
  HeartbeatSnapshotRecord,
  ExecutionTicketRecord,
  DispatchWorkerEvaluation,
  DispatchDecisionTrace,
  ExecutionLeaseRecord,
  LeaseAuditRecord,
  SecretRegistryRecord,
  SecretUsageAuditRecord,
  SecretRotationEventRecord,
  SecretLeaseRecord,
  SecretVersionRecord,
  SecretVersionStatus,
  BillingAccountRecord,
  BillingInvoiceRecord,
  BillingPaymentSessionRecord,
  UsageEventRecord,
  QuotaCounterRecord,
  LedgerEntryRecord,
  EntitlementDecisionRecord,
  ReleaseBundleRecord,
  ReleaseExecutionReportRecord,
  DeploymentExecutionReportRecord,
  EnvironmentPromotionHistoryRecord,
  WorkspaceRecord,
  WorkspaceMembershipRecord,
  OrganizationRecord,
  OrganizationMembershipRecord,
  TenantRecord,
  DeploymentBindingRecord,
  DataNamespaceRecord,
  AnalyticsFactRecord,
  ArchiveBundleRecord,
  ReplayDatasetRecord,
  DataMovementJobRecord,
  IntelItemRecord,
  IntelBriefRecord,
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
  EvolutionProposalRecord,
  EvolutionPolicyRecord,
  EvolutionLogRecord,
  PmfValidationReportRecord,
  TraceContext,
  TransitionAuditContext,
  TransitionCommand,
  TaskStatusTransitionCommand,
  WorkflowStatusTransitionCommand,
  SessionStatusTransitionCommand,
  ExecutionStatusTransitionCommand,
  ApprovalStatusTransitionCommand,
  TaskSnapshot,
} from "./domain/index.js";
export type { HarnessRun, NodeRun, NodeAttempt, BudgetReservation } from "../executable-contracts/index.js";

// Re-export control-directive legacy factory for backward compatibility
export { createControlDirective } from "../control-directive/index.js";

// Re-export execution-plan legacy factory for backward compatibility
// NOTE: createExecutionPlan is forbidden and throws; retained for import compatibility
export { createExecutionPlan } from "../execution-plan/index.js";

// Re-export execution-receipt legacy factory for backward compatibility
export { createExecutionReceipt } from "../execution-receipt/index.js";

// Re-export state-command factory (was removed in R16-79, restored for backward compat)
export { createStateCommand } from "../state-command/index.js";
