import assert from "node:assert/strict";
import test from "node:test";

import type {
  Timestamp,
  TaskPriority,
  TaskSource,
  BudgetScope,
  EventTier,
  EventConsumerAckStatus,
  MessageDirection,
  RemoteLogLevel,
  CompactionStage,
  MessagePartType,
  RunKind,
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
  MemoryLayer,
  MemorySourceTrustLevel,
  GatewayTargetKind,
  GatewayTargetSource,
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
} from "../../../../../../src/platform/contracts/types/domain/primitives.js";

// Timestamp
test("Timestamp is a string type", () => {
  const ts: Timestamp = "2026-04-14T00:00:00.000Z";
  assert.equal(ts, "2026-04-14T00:00:00.000Z");
});

// Task primitives
test("TaskPriority accepts all valid values", () => {
  const priorities: TaskPriority[] = ["low", "normal", "high", "urgent"];
  assert.equal(priorities.length, 4);
});

test("TaskSource accepts all valid values", () => {
  const sources: TaskSource[] = ["user", "perception", "system"];
  assert.equal(sources.length, 3);
});

test("BudgetScope accepts all valid values", () => {
  const scopes: BudgetScope[] = [
    "task_execution",
    "compaction",
    "skill_execution",
    "recovery_retry",
    "approval_review",
  ];
  assert.equal(scopes.length, 5);
});

// Event primitives
test("EventTier accepts all valid values", () => {
  const tiers: EventTier[] = ["tier_1", "tier_2", "tier_3"];
  assert.equal(tiers.length, 3);
});

test("EventConsumerAckStatus accepts all valid values", () => {
  const statuses: EventConsumerAckStatus[] = ["pending", "acked", "failed", "dead_lettered"];
  assert.equal(statuses.length, 4);
});

test("MessageDirection accepts all valid values", () => {
  const directions: MessageDirection[] = ["inbound", "outbound", "system"];
  assert.equal(directions.length, 3);
});

test("RemoteLogLevel accepts all valid values", () => {
  const levels: RemoteLogLevel[] = ["debug", "info", "warn", "error"];
  assert.equal(levels.length, 4);
});

test("CompactionStage accepts all valid values", () => {
  const stages: CompactionStage[] = ["trim", "summarize"];
  assert.equal(stages.length, 2);
});

test("MessagePartType accepts all valid values", () => {
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

// Worker primitives
test("RunKind accepts all valid values", () => {
  const kinds: RunKind[] = ["task_run", "node_run", "tool_call", "approval_resume", "replay"];
  assert.equal(kinds.length, 5);
});

test("WorkerStatus accepts all valid values", () => {
  const statuses: WorkerStatus[] = ["idle", "busy", "draining", "degraded", "unavailable", "quarantined", "offline"];
  assert.equal(statuses.length, 7);
});

test("WorkerSchedulingStatus accepts all valid values", () => {
  const statuses: WorkerSchedulingStatus[] = ["healthy", "degraded", "draining", "quarantined", "offline", "unavailable"];
  assert.equal(statuses.length, 6);
});

test("CoordinatorInstanceStatus accepts all valid values", () => {
  const statuses: CoordinatorInstanceStatus[] = ["active", "draining", "offline"];
  assert.equal(statuses.length, 3);
});

test("WorkerPlacement accepts all valid values", () => {
  const placements: WorkerPlacement[] = ["local", "remote"];
  assert.equal(placements.length, 2);
});

test("WorkerIsolationLevel accepts all valid values", () => {
  const levels: WorkerIsolationLevel[] = ["standard", "hardened", "strict"];
  assert.equal(levels.length, 3);
});

test("RemoteSessionStatus accepts all valid values", () => {
  const statuses: RemoteSessionStatus[] = ["connecting", "connected", "reconnecting", "degraded", "failed", "viewer_only"];
  assert.equal(statuses.length, 6);
});

test("SessionConsistencyCheckStatus accepts all valid values", () => {
  const statuses: SessionConsistencyCheckStatus[] = ["unknown", "passed", "mismatch"];
  assert.equal(statuses.length, 3);
});

test("WorkspaceSyncStatus accepts all valid values", () => {
  const statuses: WorkspaceSyncStatus[] = ["unknown", "aligned", "conflict"];
  assert.equal(statuses.length, 3);
});

test("LeaseStatus accepts all valid values", () => {
  const statuses: LeaseStatus[] = ["active", "expired", "released", "reclaimed"];
  assert.equal(statuses.length, 4);
});

test("ExecutionTicketStatus accepts all valid values", () => {
  const statuses: ExecutionTicketStatus[] = ["pending", "claimed", "consumed", "cancelled", "expired"];
  assert.equal(statuses.length, 5);
});

test("DispatchTarget accepts all valid values", () => {
  const targets: DispatchTarget[] = ["any", "local_only", "prefer_remote", "require_remote"];
  assert.equal(targets.length, 4);
});

test("RemoteAvailability accepts all valid values", () => {
  const availabilities: RemoteAvailability[] = ["healthy", "partial_available", "degraded", "unavailable"];
  assert.equal(availabilities.length, 4);
});

test("DispatchWorkerRejectionReason accepts all valid values", () => {
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

test("LeaseAuditEventType accepts all valid values", () => {
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

// Session primitives
test("TakeoverSessionStatus accepts all valid values", () => {
  const statuses: TakeoverSessionStatus[] = ["open", "closed"];
  assert.equal(statuses.length, 2);
});

test("OperatorActionType accepts all valid values", () => {
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

// Evolution primitives
test("EvolutionProposalKind accepts all valid values", () => {
  const kinds: EvolutionProposalKind[] = ["budget_adjustment", "experience_promotion"];
  assert.equal(kinds.length, 2);
});

test("EvolutionProposalStatus accepts all valid values", () => {
  const statuses: EvolutionProposalStatus[] = ["pending_approval", "approved", "rejected", "applied", "rolled_back"];
  assert.equal(statuses.length, 5);
});

test("EvolutionScopeType accepts all valid values", () => {
  const types: EvolutionScopeType[] = ["division", "role", "task_intent"];
  assert.equal(types.length, 3);
});

test("EvolutionPolicyStatus accepts all valid values", () => {
  const statuses: EvolutionPolicyStatus[] = ["active", "rolled_back"];
  assert.equal(statuses.length, 2);
});

test("EvolutionLogEventType accepts all valid values", () => {
  const types: EvolutionLogEventType[] = [
    "proposal_created",
    "approval_synced",
    "proposal_applied",
    "proposal_rolled_back",
  ];
  assert.equal(types.length, 4);
});

// Memory primitives
test("MemoryLayer accepts all valid values", () => {
  const layers: MemoryLayer[] = ["layer_3", "layer_5", "layer_7"];
  assert.equal(layers.length, 3);
});

test("MemorySourceTrustLevel accepts all valid values", () => {
  const levels: MemorySourceTrustLevel[] = ["trusted", "external", "untrusted"];
  assert.equal(levels.length, 3);
});

// Gateway primitives
test("GatewayTargetKind accepts all valid values", () => {
  const kinds: GatewayTargetKind[] = ["session", "user", "group", "room"];
  assert.equal(kinds.length, 4);
});

test("GatewayTargetSource accepts all valid values", () => {
  const sources: GatewayTargetSource[] = ["directory", "session_history"];
  assert.equal(sources.length, 2);
});

// Billing primitives
test("PmfValidationVerdict accepts all valid values", () => {
  const verdicts: PmfValidationVerdict[] = ["pass", "warn", "fail"];
  assert.equal(verdicts.length, 3);
});

test("BillingAccountStatus accepts all valid values", () => {
  const statuses: BillingAccountStatus[] = ["active", "suspended", "cancelled"];
  assert.equal(statuses.length, 3);
});

test("BillingUsageSource accepts all valid values", () => {
  const sources: BillingUsageSource[] = ["runtime", "api", "gateway", "admin"];
  assert.equal(sources.length, 4);
});

test("BillingLimitType accepts all valid values", () => {
  const types: BillingLimitType[] = ["hard", "soft", "burst"];
  assert.equal(types.length, 3);
});

test("BillingResetPolicy accepts all valid values", () => {
  const policies: BillingResetPolicy[] = ["calendar_month"];
  assert.equal(policies.length, 1);
});

test("BillingInvoiceStatus accepts all valid values", () => {
  const statuses: BillingInvoiceStatus[] = ["draft", "open", "paid", "void"];
  assert.equal(statuses.length, 4);
});

test("BillingPaymentGatewayKind accepts all valid values", () => {
  const kinds: BillingPaymentGatewayKind[] = ["manual", "stripe", "paddle"];
  assert.equal(kinds.length, 3);
});

test("BillingPaymentSessionStatus accepts all valid values", () => {
  const statuses: BillingPaymentSessionStatus[] = ["pending", "paid", "expired", "cancelled", "failed"];
  assert.equal(statuses.length, 5);
});

test("EntitlementDecisionType accepts all valid values", () => {
  const types: EntitlementDecisionType[] = ["allow", "deny", "degrade", "warn"];
  assert.equal(types.length, 4);
});

// Secret primitives
test("SecretCategory accepts all valid values", () => {
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

test("SecretScopeType accepts all valid values", () => {
  const types: SecretScopeType[] = ["system", "tenant", "workspace", "worker"];
  assert.equal(types.length, 4);
});

test("SecretProviderKind accepts all valid values", () => {
  const kinds: SecretProviderKind[] = ["environment", "vault", "kms", "secret_manager"];
  assert.equal(kinds.length, 4);
});

test("SecretStatus accepts all valid values", () => {
  const statuses: SecretStatus[] = ["active", "rotating", "disabled", "revoked"];
  assert.equal(statuses.length, 4);
});

test("SecretRotationMode accepts all valid values", () => {
  const modes: SecretRotationMode[] = ["scheduled", "emergency"];
  assert.equal(modes.length, 2);
});

test("SecretRotationEventStatus accepts all valid values", () => {
  const statuses: SecretRotationEventStatus[] = ["requested", "completed", "failed"];
  assert.equal(statuses.length, 3);
});

test("SecretLeaseStatus accepts all valid values", () => {
  const statuses: SecretLeaseStatus[] = ["active", "expired", "revoked"];
  assert.equal(statuses.length, 3);
});

// Multi-tenancy primitives
test("TenantIsolationMode accepts all valid values", () => {
  const modes: TenantIsolationMode[] = [
    "shared_logical",
    "shared_hard_scoped",
    "dedicated_runtime",
    "dedicated_environment",
  ];
  assert.equal(modes.length, 4);
});

test("DataNamespacePlane accepts all valid values", () => {
  const planes: DataNamespacePlane[] = ["transactional", "artifact", "analytics", "memory_archive", "replay"];
  assert.equal(planes.length, 5);
});

test("EnvironmentName accepts all valid values", () => {
  const names: EnvironmentName[] = ["dev", "test", "staging", "pre-prod", "prod"];
  assert.equal(names.length, 5);
});

test("DeploymentMode accepts all valid values", () => {
  const modes: DeploymentMode[] = ["cloud_shared", "private_cloud", "on_prem"];
  assert.equal(modes.length, 3);
});

test("EnvironmentReadinessComponentType accepts all valid values", () => {
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

test("EnterpriseCapabilityStatus accepts all valid values", () => {
  const statuses: EnterpriseCapabilityStatus[] = ["available", "degraded", "blocked"];
  assert.equal(statuses.length, 3);
});

// Extension primitives
test("ExtensionPackageType accepts all valid values", () => {
  const types: ExtensionPackageType[] = ["tool", "skill", "plugin", "mcp", "template"];
  assert.equal(types.length, 5);
});

test("ExtensionTrustLevel accepts all valid values", () => {
  const levels: ExtensionTrustLevel[] = ["internal", "verified", "community", "unknown"];
  assert.equal(levels.length, 4);
});

test("ExtensionLifecycleState accepts all valid values", () => {
  const states: ExtensionLifecycleState[] = ["discovered", "installed", "enabled", "disabled", "reloaded", "removed"];
  assert.equal(states.length, 6);
});

test("MarketplaceReviewStatus accepts all valid values", () => {
  const statuses: MarketplaceReviewStatus[] = ["submitted", "approved", "rejected"];
  assert.equal(statuses.length, 3);
});

test("MarketplacePublicationStatus accepts all valid values", () => {
  const statuses: MarketplacePublicationStatus[] = ["published", "revoked"];
  assert.equal(statuses.length, 2);
});

test("PerceptionSourceType accepts all valid values", () => {
  const types: PerceptionSourceType[] = ["rss", "web", "github", "api", "custom"];
  assert.equal(types.length, 5);
});

test("ActionProposalStatus accepts all valid values", () => {
  const statuses: ActionProposalStatus[] = ["proposed", "approved", "rejected", "superseded"];
  assert.equal(statuses.length, 4);
});

// Transition primitives
test("TransitionEntityKind accepts all valid values", () => {
  const kinds: TransitionEntityKind[] = ["task", "workflow", "session", "approval", "execution"];
  assert.equal(kinds.length, 5);
});

test("TransitionActorType accepts all valid values", () => {
  const types: TransitionActorType[] = ["user", "agent", "system", "scheduler", "admin", "webhook", "recovery"];
  assert.equal(types.length, 7);
});
