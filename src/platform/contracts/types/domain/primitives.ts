/**
 * @fileoverview Domain Primitives - Basic type aliases used across the domain.
 *
 * Contains simple enum-like type definitions that are used throughout
 * the system for status fields, kind identifiers, and basic primitives.
 *
 * Part of the domain.ts split (see src/core/types/domain/index.ts).
 */

export type Timestamp = string;

// ---------------------------------------------------------------------------
// Task-related primitives
// ---------------------------------------------------------------------------

export type TaskPriority = "low" | "normal" | "high" | "critical";
export type TaskSource = "user" | "perception" | "system";
export type BudgetScope =
  | "task_execution"
  | "compaction"
  | "skill_execution"
  | "recovery_retry"
  | "approval_review";

// ---------------------------------------------------------------------------
// Event and message primitives
// ---------------------------------------------------------------------------

export type EventTier = "tier_1" | "tier_2" | "tier_3";
export type EventConsumerAckStatus = "pending" | "acked" | "failed" | "dead_lettered";
export type MessageDirection = "inbound" | "outbound" | "system";
export type RemoteLogLevel = "debug" | "info" | "warn" | "error";
export type CompactionStage = "trim" | "summarize";
export type MessagePartType =
  | "text"
  | "reasoning"
  | "tool_use"
  | "tool_result"
  | "summary"
  | "artifact_ref"
  | "decision_prompt"
  | "agent_ref"
  | "subtask_ref"
  | "retry_record"
  | "step_boundary"
  | "compaction_marker"
  | "hook_event"
  | "command_execution"
  | "mcp_call";

// ---------------------------------------------------------------------------
// Worker and execution primitives
// ---------------------------------------------------------------------------

export type RunKind = "task_run" | "tool_call" | "approval_resume" | "replay";
export type WorkerStatus = "idle" | "busy" | "draining" | "degraded" | "unavailable" | "quarantined" | "offline";
export type WorkerSchedulingStatus = "healthy" | "degraded" | "draining" | "quarantined" | "offline" | "unavailable";
export type CoordinatorInstanceStatus = "active" | "draining" | "offline";
export type WorkerPlacement = "local" | "remote";
export type WorkerIsolationLevel = "standard" | "hardened" | "strict";
export type RemoteSessionStatus = "connecting" | "connected" | "reconnecting" | "degraded" | "failed" | "viewer_only";
export type SessionConsistencyCheckStatus = "unknown" | "passed" | "mismatch";
export type WorkspaceSyncStatus = "unknown" | "aligned" | "conflict";
export type LeaseStatus = "active" | "expired" | "released" | "reclaimed" | "handed_over";
export type ExecutionTicketStatus = "pending" | "claimed" | "consumed" | "cancelled" | "expired";
export type DispatchTarget = "any" | "local_only" | "prefer_remote" | "require_remote";
export type RemoteAvailability = "healthy" | "partial_available" | "degraded" | "unavailable";
export type DispatchWorkerRejectionReason =
  | "worker_unavailable"
  | "worker_quarantined"
  | "worker_offline"
  | "worker_draining"
  | "worker_degraded_filtered"
  | "worker_untrusted"
  | "worker_capacity_full"
  | "queue_affinity_mismatch"
  | "missing_capabilities"
  | "worker_placement_mismatch"
  | "worker_isolation_mismatch"
  | "worker_repo_version_mismatch"
  | "worker_remote_session_unready";
export type LeaseAuditEventType =
  | "lease_granted"
  | "lease_renewed"
  | "lease_expired"
  | "lease_reclaimed"
  | "stale_write_rejected"
  | "lease_released"
  | "lease_handover";

// ---------------------------------------------------------------------------
// Session and operator primitives
// ---------------------------------------------------------------------------

export type TakeoverSessionStatus = "open" | "closed";
export type OperatorActionType =
  | "take_over_task"
  | "modify_input"
  | "retry_execution"
  | "skip_step"
  | "set_current_step"
  | "switch_worker"
  | "write_step_output"
  | "complete_task";

// ---------------------------------------------------------------------------
// Evolution primitives
// ---------------------------------------------------------------------------

export type EvolutionProposalKind = "budget_adjustment" | "experience_promotion";
export type EvolutionProposalStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "applied"
  | "rolled_back";
export type EvolutionScopeType = "division" | "role" | "task_intent";
export type EvolutionPolicyStatus = "active" | "rolled_back";
export type EvolutionLogEventType =
  | "proposal_created"
  | "approval_synced"
  | "proposal_applied"
  | "proposal_rolled_back";

// ---------------------------------------------------------------------------
// Memory primitives
// ---------------------------------------------------------------------------

export type MemoryLayer = "layer_3" | "layer_5" | "layer_7";
export type MemorySourceTrustLevel = "trusted" | "external" | "untrusted";

// ---------------------------------------------------------------------------
// Gateway primitives
// ---------------------------------------------------------------------------

export type GatewayTargetKind = "session" | "user" | "group" | "room";
export type GatewayTargetSource = "directory" | "session_history";

// ---------------------------------------------------------------------------
// PMF and billing primitives
// ---------------------------------------------------------------------------

export type PmfValidationVerdict = "pass" | "warn" | "fail";
export type BillingAccountStatus = "active" | "suspended" | "cancelled";
export type BillingUsageSource = "runtime" | "api" | "gateway" | "admin";
export type BillingLimitType = "hard" | "soft" | "burst";
export type BillingResetPolicy = "calendar_month";
export type BillingInvoiceStatus = "draft" | "open" | "paid" | "void";
export type BillingPaymentGatewayKind = "manual" | "stripe" | "paddle";
export type BillingPaymentSessionStatus = "pending" | "paid" | "expired" | "cancelled" | "failed";
export type EntitlementDecisionType = "allow" | "deny" | "degrade" | "warn";

// ---------------------------------------------------------------------------
// Secret primitives
// ---------------------------------------------------------------------------

export type SecretCategory =
  | "provider_api_key"
  | "tenant_credential"
  | "oauth_client_secret"
  | "signing_key"
  | "db_connection_secret"
  | "break_glass_secret";
export type SecretScopeType = "system" | "tenant" | "workspace" | "worker";
export type SecretProviderKind = "environment" | "vault" | "kms" | "secret_manager";
export type SecretStatus = "active" | "rotating" | "disabled" | "revoked";
export type SecretRotationMode = "scheduled" | "emergency";
export type SecretRotationEventStatus = "requested" | "completed" | "failed";
export type SecretLeaseStatus = "active" | "expired" | "revoked";

// ---------------------------------------------------------------------------
// Multi-tenancy and environment primitives
// ---------------------------------------------------------------------------

export type TenantIsolationMode =
  | "shared_logical"
  | "shared_hard_scoped"
  | "dedicated_runtime"
  | "dedicated_environment"
  | "dedicated_pool"; // Per R15-57: dedicated_pool creates real infrastructure isolation
export type DataNamespacePlane = "transactional" | "artifact" | "analytics" | "memory_archive" | "replay";
export type EnvironmentName = "dev" | "test" | "staging" | "pre-prod" | "prod" | "development" | "production";
export type DeploymentMode = "cloud_shared" | "private_cloud" | "on_prem";
export type EnvironmentReadinessComponentType =
  | "provider"
  | "gateway"
  | "sandbox"
  | "worker_fleet"
  | "artifact_store"
  | "notification_channel"
  | "external_service";
export type EnterpriseCapabilityStatus = "available" | "degraded" | "blocked";

// ---------------------------------------------------------------------------
// Extension and marketplace primitives
// ---------------------------------------------------------------------------

export type ExtensionPackageType = "tool" | "skill" | "plugin" | "mcp" | "template";
export type ExtensionTrustLevel = "internal" | "verified" | "community" | "unknown";
export type ExtensionLifecycleState = "discovered" | "installed" | "enabled" | "disabled" | "reloaded" | "removed" | "deprecated" | "sunset" | "retired";
export type MarketplaceReviewStatus = "submitted" | "reviewing" | "approved" | "published" | "suspended" | "rejected" | "revoked";
export type MarketplacePublicationStatus = "published" | "deprecated" | "sunset" | "retired" | "revoked";
export type PerceptionSourceType = "rss" | "web" | "github" | "api" | "custom";
export type ActionProposalStatus = "proposed" | "approved" | "rejected" | "superseded";

// ---------------------------------------------------------------------------
// Transition primitives
// ---------------------------------------------------------------------------

export type TransitionEntityKind = "task" | "workflow" | "session" | "approval" | "execution";
export type TransitionActorType = "user" | "agent" | "system" | "scheduler" | "admin" | "webhook" | "recovery";
