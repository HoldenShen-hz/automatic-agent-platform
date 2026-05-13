import { getRequiredConsumers } from "./event-types.js";
import type { EventTier } from "../../contracts/types/domain.js";
import { ValidationError } from "../../contracts/errors.js";
import { z } from "zod";

/**
 * Event Registry - Central registry of all event types in the system.
 *
 * Defines the schema for each event type including:
 * - Tier classification (tier_1 = reliable delivery required, tier_2 = at-least-once, tier_3 = best-effort)
 * - Producer service that emits the event
 * - Consumers that must receive and acknowledge the event
 *
 * @see {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/contracts/event_registry_and_ops_threshold_contract.md | Event Registry Contract}
 */
export interface EventSchemaDefinition {
  type: string;
  tier: EventTier;
  producer: string;
  consumers: readonly string[];
  payloadSchemaRef: string;
  compatibilityPolicy: "backward_compatible_additive" | "versioned_breaking_change";
}

export interface EventReplayMetadata {
  readonly eventType: string;
  readonly sourceOfTruth: "platform" | "projection";
  readonly replayable: boolean;
  readonly sideEffectSafeToReplay: boolean;
  readonly schemaOwner: string;
  readonly replayBehavior: "replay_as_fact" | "skip_side_effect" | "simulate" | "forbidden";
  readonly consumerContractTests: readonly string[];
}

/**
 * Raw event schema definition before normalization.
 * Allows optional fields that get defaults during processing.
 */
interface RawEventSchemaDefinition {
  type: string;
  tier: EventTier;
  producer: string;
  consumers: readonly string[];
  payloadSchemaRef?: string;
  compatibilityPolicy?: EventSchemaDefinition["compatibilityPolicy"];
}

/**
 * Registry of all event schemas in the system.
 *
 * Tier 1 events (must have reliable delivery and ack):
 * - task:status_changed, workflow:step_completed, decision:requested, decision:responded
 * - division:completed, division:failed, subtask:completed, subtask:failed, cost:limit_reached
 *
 * Tier 2 events (at-least-once delivery):
 * - dispatch:* events, worker:* events, takeover:* events, recovery:* events
 *
 * Tier 3 events (best-effort, no ack required):
 * - stream:chunk_emitted
 *
 * Compatibility note:
 * - Legacy namespaces such as `task:*`, `workflow:*`, `dispatch:*`, and `worker:*`
 *   intentionally keep their historical producer identifiers for backward-compatible
 *   consumers and migration tooling.
 * - Canonical truth facts live under `platform.*` and are described through
 *   `RUNTIME_EVENT_REPLAY_METADATA` / `getEventSchema()`.
 *
 * @see {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/contracts/event_registry_and_ops_threshold_contract.md | Event Registry Contract}
 */
const RAW_EVENT_SCHEMA_REGISTRY = {
  "task:status_changed": {
    type: "task:status_changed",
    tier: "tier_1",
    producer: "transition_service",
    consumers: getRequiredConsumers("task:status_changed"),
  },
  "workflow:step_completed": {
    type: "workflow:step_completed",
    tier: "tier_1",
    producer: "harness_runtime_legacy_projection",
    consumers: getRequiredConsumers("workflow:step_completed"),
  },
  "decision:requested": {
    type: "decision:requested",
    tier: "tier_1",
    producer: "approval_service",
    consumers: ["approval_projection", "inspect_projection"],
  },
  "decision:responded": {
    type: "decision:responded",
    tier: "tier_1",
    producer: "approval_service",
    consumers: ["approval_projection", "inspect_projection"],
  },
  "division:completed": {
    type: "division:completed",
    tier: "tier_1",
    producer: "harness_runtime_legacy_projection",
    consumers: getRequiredConsumers("division:completed"),
  },
  "division:failed": {
    type: "division:failed",
    tier: "tier_1",
    producer: "harness_runtime_legacy_projection",
    consumers: getRequiredConsumers("division:failed"),
  },
  "subtask:completed": {
    type: "subtask:completed",
    tier: "tier_1",
    producer: "harness_runtime_legacy_projection",
    consumers: getRequiredConsumers("subtask:completed"),
  },
  "subtask:failed": {
    type: "subtask:failed",
    tier: "tier_1",
    producer: "harness_runtime_legacy_projection",
    consumers: getRequiredConsumers("subtask:failed"),
  },
  "cost:limit_reached": {
    type: "cost:limit_reached",
    tier: "tier_1",
    producer: "admission_controller",
    consumers: getRequiredConsumers("cost:limit_reached"),
  },
  "stream:chunk_emitted": {
    type: "stream:chunk_emitted",
    tier: "tier_3",
    producer: "stream_bridge",
    consumers: [],
  },
  // R8-09 FIX: Add canonical platform.harness_run.* events alongside legacy task:status_changed
  "platform.harness_run.status_changed": {
    type: "platform.harness_run.status_changed",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.harness_run.created": {
    type: "platform.harness_run.created",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.harness_run.completed": {
    type: "platform.harness_run.completed",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.harness_run.failed": {
    type: "platform.harness_run.failed",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.node_run.status_changed": {
    type: "platform.node_run.status_changed",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.node_run.started": {
    type: "platform.node_run.started",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.node_run.completed": {
    type: "platform.node_run.completed",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.budget_ledger.status_changed": {
    type: "platform.budget_ledger.status_changed",
    tier: "tier_1",
    producer: "budget_allocator",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.budget_reservation.status_changed": {
    type: "platform.budget_reservation.status_changed",
    tier: "tier_1",
    producer: "budget_allocator",
    consumers: ["truth_projector", "audit_projection"],
  },
  "dispatch:ticket_created": {
    type: "dispatch:ticket_created",
    tier: "tier_2",
    producer: "execution_dispatch_service",
    consumers: ["inspect_projection"],
  },
  "dispatch:ticket_claimed": {
    type: "dispatch:ticket_claimed",
    tier: "tier_2",
    producer: "execution_dispatch_service",
    consumers: ["inspect_projection"],
  },
  "dispatch:decision_recorded": {
    type: "dispatch:decision_recorded",
    tier: "tier_2",
    producer: "execution_dispatch_service",
    consumers: ["inspect_projection"],
  },
  "dispatch:execution_preempted": {
    type: "dispatch:execution_preempted",
    tier: "tier_2",
    producer: "execution_priority_preemption_service",
    consumers: ["inspect_projection"],
  },
  "dispatch:ticket_reconciled": {
    type: "dispatch:ticket_reconciled",
    tier: "tier_2",
    producer: "execution_dispatch_reconciliation_service",
    consumers: ["inspect_projection"],
  },
  "dispatch:ticket_requeued": {
    type: "dispatch:ticket_requeued",
    tier: "tier_2",
    producer: "execution_dispatch_reconciliation_service",
    consumers: ["inspect_projection"],
  },
  "dispatch:ticket_rebuilt": {
    type: "dispatch:ticket_rebuilt",
    tier: "tier_2",
    producer: "execution_db_queue_disconnect_repair_service",
    consumers: ["inspect_projection"],
  },
  "worker:claim_accepted": {
    type: "worker:claim_accepted",
    tier: "tier_2",
    producer: "execution_worker_handshake_service",
    consumers: ["inspect_projection"],
  },
  "worker:claim_rejected": {
    type: "worker:claim_rejected",
    tier: "tier_2",
    producer: "execution_worker_handshake_service",
    consumers: ["inspect_projection"],
  },
  "worker:heartbeat_recorded": {
    type: "worker:heartbeat_recorded",
    tier: "tier_2",
    producer: "execution_worker_handshake_service",
    consumers: ["inspect_projection"],
  },
  "worker:writeback_recorded": {
    type: "worker:writeback_recorded",
    tier: "tier_2",
    producer: "execution_worker_writeback_service",
    consumers: ["inspect_projection"],
  },
  "worker:writeback_rejected": {
    type: "worker:writeback_rejected",
    tier: "tier_2",
    producer: "execution_worker_writeback_service",
    consumers: ["inspect_projection"],
  },
  "worker:lease_released_after_writeback": {
    type: "worker:lease_released_after_writeback",
    tier: "tier_2",
    producer: "execution_worker_writeback_service",
    consumers: ["inspect_projection"],
  },
  "takeover:session_opened": {
    type: "takeover:session_opened",
    tier: "tier_2",
    producer: "human_takeover_service",
    consumers: ["inspect_projection"],
  },
  "takeover:action_applied": {
    type: "takeover:action_applied",
    tier: "tier_2",
    producer: "human_takeover_service",
    consumers: ["inspect_projection"],
  },
  "recovery:repair_applied": {
    type: "recovery:repair_applied",
    tier: "tier_2",
    producer: "runtime_repair_service",
    consumers: ["inspect_projection"],
  },
  "recovery:decision_recorded": {
    type: "recovery:decision_recorded",
    tier: "tier_2",
    producer: "runtime_recovery_decision_service",
    consumers: ["inspect_projection"],
  },
  "recovery:dead_lettered": {
    type: "recovery:dead_lettered",
    tier: "tier_2",
    producer: "runtime_recovery_decision_service",
    consumers: ["inspect_projection"],
  },
  "recovery:cancelled": {
    type: "recovery:cancelled",
    tier: "tier_2",
    producer: "runtime_recovery_decision_service",
    consumers: ["inspect_projection"],
  },
  "config.changed": {
    type: "config.changed",
    tier: "tier_2",
    producer: "hierarchical_config_loader",
    consumers: ["inspect_projection"],
  },
  "config.rollout.started": {
    type: "config.rollout.started",
    tier: "tier_2",
    producer: "config_rollout_service",
    consumers: ["inspect_projection"],
  },
  "config.rollout.promoted": {
    type: "config.rollout.promoted",
    tier: "tier_2",
    producer: "config_rollout_service",
    consumers: ["inspect_projection"],
  },
  "config.rollout.cancelled": {
    type: "config.rollout.cancelled",
    tier: "tier_2",
    producer: "config_rollout_service",
    consumers: ["inspect_projection"],
  },
  "config.rollout.auto_progressed": {
    type: "config.rollout.auto_progressed",
    tier: "tier_2",
    producer: "config_rollout_service",
    consumers: ["inspect_projection"],
  },
  "config.drift_detected": {
    type: "config.drift_detected",
    tier: "tier_2",
    producer: "config_drift_reconciler",
    consumers: ["inspect_projection"],
  },
  "domain:registered": {
    type: "domain:registered",
    tier: "tier_2",
    producer: "domain_registry_service",
    consumers: ["inspect_projection", "feedback_projection"],
  },
  "domain:activated": {
    type: "domain:activated",
    tier: "tier_2",
    producer: "domain_registry_service",
    consumers: ["inspect_projection", "feedback_projection"],
  },
  "domain:canary": {
    type: "domain:canary",
    tier: "tier_2",
    producer: "domain_registry_service",
    consumers: ["inspect_projection", "feedback_projection"],
  },
  "domain:updating": {
    type: "domain:updating",
    tier: "tier_2",
    producer: "domain_registry_service",
    consumers: ["inspect_projection", "feedback_projection"],
  },
  "domain:updated": {
    type: "domain:updated",
    tier: "tier_2",
    producer: "domain_registry_service",
    consumers: ["inspect_projection", "feedback_projection"],
  },
  "domain:deprecated": {
    type: "domain:deprecated",
    tier: "tier_2",
    producer: "domain_registry_service",
    consumers: ["inspect_projection", "feedback_projection"],
  },
  "domain:archived": {
    type: "domain:archived",
    tier: "tier_2",
    producer: "domain_registry_service",
    consumers: ["inspect_projection", "feedback_projection"],
  },
  "plugin:spi_registered": {
    type: "plugin:spi_registered",
    tier: "tier_2",
    producer: "plugin_spi_registry",
    consumers: ["inspect_projection", "feedback_projection"],
  },
  "plugin:activated": {
    type: "plugin:activated",
    tier: "tier_2",
    producer: "plugin_spi_registry",
    consumers: ["inspect_projection", "feedback_projection"],
  },
  "plugin:error_isolated": {
    type: "plugin:error_isolated",
    tier: "tier_2",
    producer: "plugin_spi_registry",
    consumers: ["inspect_projection", "feedback_projection"],
  },
  "plugin:suspended": {
    type: "plugin:suspended",
    tier: "tier_2",
    producer: "plugin_spi_registry",
    consumers: ["inspect_projection", "feedback_projection"],
  },
  "plugin:invocation_started": {
    type: "plugin:invocation_started",
    tier: "tier_2",
    producer: "plugin_spi_registry",
    consumers: ["inspect_projection"],
  },
  "plugin:invocation_completed": {
    type: "plugin:invocation_completed",
    tier: "tier_2",
    producer: "plugin_spi_registry",
    consumers: ["inspect_projection"],
  },
  "knowledge:chunk_indexed": {
    type: "knowledge:chunk_indexed",
    tier: "tier_2",
    producer: "knowledge_plane_service",
    consumers: ["inspect_projection", "feedback_projection"],
  },
  "learning:knowledge_promoted": {
    type: "learning:knowledge_promoted",
    tier: "tier_2",
    producer: "knowledge_promotion_service",
    consumers: ["inspect_projection"],
  },
  "skill:execution_started": {
    type: "skill:execution_started",
    tier: "tier_2",
    producer: "skill_execution_service",
    consumers: ["inspect_projection"],
  },
  "skill:cache_miss": {
    type: "skill:cache_miss",
    tier: "tier_2",
    producer: "skill_execution_service",
    consumers: ["inspect_projection"],
  },
  "skill:cache_hit": {
    type: "skill:cache_hit",
    tier: "tier_2",
    producer: "skill_execution_service",
    consumers: ["inspect_projection"],
  },
  "skill:cache_stored": {
    type: "skill:cache_stored",
    tier: "tier_2",
    producer: "skill_execution_service",
    consumers: ["inspect_projection"],
  },
  "skill:step_started": {
    type: "skill:step_started",
    tier: "tier_2",
    producer: "skill_execution_service",
    consumers: ["inspect_projection"],
  },
  "skill:retry_scheduled": {
    type: "skill:retry_scheduled",
    tier: "tier_2",
    producer: "skill_execution_service",
    consumers: ["inspect_projection"],
  },
  "skill:step_succeeded": {
    type: "skill:step_succeeded",
    tier: "tier_2",
    producer: "skill_execution_service",
    consumers: ["inspect_projection"],
  },
  "skill:step_failed": {
    type: "skill:step_failed",
    tier: "tier_2",
    producer: "skill_execution_service",
    consumers: ["inspect_projection"],
  },
  "skill:execution_completed": {
    type: "skill:execution_completed",
    tier: "tier_2",
    producer: "skill_execution_service",
    consumers: ["inspect_projection"],
  },
  // Performance test event types - used for benchmarks only
  "perf:test_event": {
    type: "perf:test_event",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:burst_event": {
    type: "perf:burst_event",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "test:capacity": {
    type: "test:capacity",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "test:many_events": {
    type: "test:many_events",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "ux:interaction_tracked": {
    type: "ux:interaction_tracked",
    tier: "tier_2",
    producer: "ux_event_tracking_service",
    consumers: ["analytics_projection"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  // R23-72: OAPEFLIR stage events with producer/consumers/compatibility_policy metadata
  // observe stage
  "observe:signals_collected": {
    type: "observe:signals_collected",
    tier: "tier_1",
    producer: "oapeflir_orchestrator",
    consumers: ["oapeflir_projection", "truth_projector"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  "observe:context_augmented": {
    type: "observe:context_augmented",
    tier: "tier_1",
    producer: "oapeflir_orchestrator",
    consumers: ["oapeflir_projection", "truth_projector"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  // assess stage
  "assess:evaluation_completed": {
    type: "assess:evaluation_completed",
    tier: "tier_1",
    producer: "oapeflir_orchestrator",
    consumers: ["oapeflir_projection", "truth_projector"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  "assess:anomaly_classified": {
    type: "assess:anomaly_classified",
    tier: "tier_1",
    producer: "oapeflir_orchestrator",
    consumers: ["oapeflir_projection", "truth_projector"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  // plan stage
  "plan:proposal_created": {
    type: "plan:proposal_created",
    tier: "tier_1",
    producer: "oapeflir_orchestrator",
    consumers: ["oapeflir_projection", "truth_projector"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  "plan:decision_recorded": {
    type: "plan:decision_recorded",
    tier: "tier_1",
    producer: "oapeflir_orchestrator",
    consumers: ["oapeflir_projection", "truth_projector"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  // execute stage
  "execute:action_started": {
    type: "execute:action_started",
    tier: "tier_1",
    producer: "oapeflir_orchestrator",
    consumers: ["oapeflir_projection", "truth_projector"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  "execute:action_completed": {
    type: "execute:action_completed",
    tier: "tier_1",
    producer: "oapeflir_orchestrator",
    consumers: ["oapeflir_projection", "truth_projector"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  // feedback stage
  "feedback:signal_received": {
    type: "feedback:signal_received",
    tier: "tier_1",
    producer: "oapeflir_orchestrator",
    consumers: ["oapeflir_projection", "truth_projector"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  "feedback:outcome_processed": {
    type: "feedback:outcome_processed",
    tier: "tier_1",
    producer: "oapeflir_orchestrator",
    consumers: ["oapeflir_projection", "truth_projector"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  // learn stage
  "learn:object_created": {
    type: "learn:object_created",
    tier: "tier_1",
    producer: "oapeflir_orchestrator",
    consumers: ["oapeflir_projection", "truth_projector"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  "learn:object_promoted": {
    type: "learn:object_promoted",
    tier: "tier_1",
    producer: "oapeflir_orchestrator",
    consumers: ["oapeflir_projection", "truth_projector"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  // improve stage
  "improve:candidate_proposed": {
    type: "improve:candidate_proposed",
    tier: "tier_1",
    producer: "oapeflir_orchestrator",
    consumers: ["oapeflir_projection", "truth_projector"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  "improve:candidate_accepted": {
    type: "improve:candidate_accepted",
    tier: "tier_1",
    producer: "oapeflir_orchestrator",
    consumers: ["oapeflir_projection", "truth_projector"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  // release stage
  "release:rollout_started": {
    type: "release:rollout_started",
    tier: "tier_1",
    producer: "oapeflir_orchestrator",
    consumers: ["oapeflir_projection", "truth_projector"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  "release:rollout_completed": {
    type: "release:rollout_completed",
    tier: "tier_1",
    producer: "oapeflir_orchestrator",
    consumers: ["oapeflir_projection", "truth_projector"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  "release:rollback_triggered": {
    type: "release:rollback_triggered",
    tier: "tier_1",
    producer: "oapeflir_orchestrator",
    consumers: ["oapeflir_projection", "truth_projector"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  // OAPEFLIR phase transition events
  "oapeflir.phase.transition": {
    type: "oapeflir.phase.transition",
    tier: "tier_1",
    producer: "oapeflir_orchestrator",
    consumers: ["oapeflir_projection", "truth_projector", "audit_projection"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  // R17-03: Run termination cleanup events
  "run.cleanup_completed": {
    type: "run.cleanup_completed",
    tier: "tier_1",
    producer: "run_termination_cleanup",
    consumers: ["truth_projector", "audit_system"],
    compatibilityPolicy: "backward_compatible_additive",
  },
  "run.cleanup_failed": {
    type: "run.cleanup_failed",
    tier: "tier_1",
    producer: "run_termination_cleanup",
    consumers: ["truth_projector", "audit_system", "alerting"],
    compatibilityPolicy: "backward_compatible_additive",
  },
} as const satisfies Record<string, RawEventSchemaDefinition>;

/**
 * All known event types in the system.
 */
export type KnownEventType = keyof typeof RAW_EVENT_SCHEMA_REGISTRY;

const optionalStringSchema = z.string().optional();
const optionalNullableStringSchema = z.string().nullable().optional();
const traceContextSchema = z.object({
  traceId: z.string(),
  spanId: z.string().nullable(),
  parentSpanId: z.string().nullable(),
  correlationId: z.string().nullable(),
}).passthrough();

const taskStatusChangedPayloadSchema = z.object({
  fromStatus: optionalStringSchema,
  toStatus: z.string(),
  reasonCode: optionalStringSchema,
  occurredAt: optionalStringSchema,
  entityKind: optionalStringSchema,
  entityId: optionalStringSchema,
  reasonDetail: optionalNullableStringSchema,
  actorType: optionalStringSchema,
  actorId: optionalNullableStringSchema,
  idempotencyKey: optionalNullableStringSchema,
  metadataJson: optionalNullableStringSchema,
  manualOverride: z.boolean().optional(),
  traceContext: traceContextSchema.optional(),
}).passthrough();

const workflowStepCompletedPayloadSchema = z.object({
  stepId: z.string(),
  roleId: optionalStringSchema,
  status: optionalStringSchema,
  outputKey: optionalNullableStringSchema,
  attempt: z.number().int().nonnegative().optional(),
  manualOverride: z.boolean().optional(),
  workflowId: optionalStringSchema,
  occurredAt: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const decisionRequestedPayloadSchema = z.object({
  approvalId: z.string(),
  taskId: optionalStringSchema,
  executionId: optionalNullableStringSchema,
  sourceAgentId: optionalStringSchema,
  reason: optionalStringSchema,
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  options: z.array(z.string()).optional(),
  context: z.record(z.unknown()).optional(),
  timeoutPolicy: z.enum(["reject", "approve", "remain_pending"]).optional(),
  createdAt: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const decisionRespondedPayloadSchema = z.object({
  approvalId: z.string(),
  decisionType: z.enum(["option_selected", "confirmed", "text_input", "rejected", "expired"]).optional(),
  selectedOptionId: optionalStringSchema,
  confirmed: z.literal(true).optional(),
  inputText: optionalStringSchema,
  respondedBy: optionalStringSchema,
  respondedAt: optionalStringSchema,
  cascadeDeny: z.literal(true).optional(),
  cascadeSourceApprovalId: optionalStringSchema,
  cascadeSessionId: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const divisionOutcomePayloadSchema = z.object({
  divisionId: z.string(),
  workflowId: optionalNullableStringSchema,
  executionId: optionalNullableStringSchema,
  reasonCode: optionalStringSchema,
  occurredAt: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const subtaskOutcomePayloadSchema = z.object({
  stepId: optionalStringSchema,
  subtaskId: optionalStringSchema,
  roleId: optionalStringSchema,
  status: optionalStringSchema,
  attempt: z.number().int().nonnegative().optional(),
  parentTaskId: optionalStringSchema,
  occurredAt: optionalStringSchema,
  reasonCode: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough().superRefine((value, ctx) => {
  if (value.stepId == null && value.subtaskId == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["stepId"],
      message: "Expected at least one of stepId or subtaskId.",
    });
  }
});

const costLimitReachedPayloadSchema = z.object({
  budgetId: z.string(),
  currentCostUsd: z.number(),
  limitUsd: z.number(),
  occurredAt: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const domainLifecyclePayloadSchema = z.object({
  domainId: z.string(),
  status: z.string(),
  capabilityCount: z.number().int().nonnegative(),
  pluginCount: z.number().int().nonnegative(),
  occurredAt: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const pluginLifecyclePayloadSchema = z.object({
  pluginId: z.string(),
  domainId: optionalNullableStringSchema,
  spiType: z.string(),
  lifecycleState: z.string(),
  bindingId: optionalNullableStringSchema,
  occurredAt: optionalStringSchema,
  reasonCode: optionalNullableStringSchema,
  errorMessage: optionalNullableStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const pluginInvocationPayloadSchema = z.object({
  pluginId: z.string(),
  domainId: optionalNullableStringSchema,
  spiType: z.string(),
  phase: z.string(),
  invocationId: z.string(),
  lifecycleState: z.string(),
  runtimeIsolation: z.string(),
  activeInvocationCount: z.number().int().nonnegative(),
  queuedInvocationCount: z.number().int().nonnegative(),
  bindingId: optionalNullableStringSchema,
  occurredAt: optionalStringSchema,
  durationMs: z.number().int().nonnegative().optional(),
  status: z.enum(["started", "completed", "failed"]).optional(),
  reasonCode: optionalNullableStringSchema,
  errorMessage: optionalNullableStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const knowledgeChunkIndexedPayloadSchema = z.object({
  namespace: z.string(),
  documentId: z.string(),
  chunkId: z.string(),
  trustLevel: z.string(),
  keywordCount: z.number().int().nonnegative(),
  relationCount: z.number().int().nonnegative(),
  occurredAt: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const learningKnowledgePromotedPayloadSchema = z.object({
  learningObjectId: z.string(),
  learningType: z.string(),
  documentId: z.string(),
  namespace: z.string(),
  trustLevel: z.string(),
  promotedCount: z.number().int().nonnegative(),
  occurredAt: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const genericEventPayloadSchema = z.record(z.unknown());

const EVENT_PAYLOAD_VALIDATORS: Partial<Record<KnownEventType, z.ZodType<Record<string, unknown>>>> = {
  "task:status_changed": taskStatusChangedPayloadSchema,
  "workflow:step_completed": workflowStepCompletedPayloadSchema,
  "decision:requested": decisionRequestedPayloadSchema,
  "decision:responded": decisionRespondedPayloadSchema,
  "division:completed": divisionOutcomePayloadSchema,
  "division:failed": divisionOutcomePayloadSchema,
  "subtask:completed": subtaskOutcomePayloadSchema,
  "subtask:failed": subtaskOutcomePayloadSchema,
  "cost:limit_reached": costLimitReachedPayloadSchema,
  "domain:registered": domainLifecyclePayloadSchema,
  "domain:activated": domainLifecyclePayloadSchema,
  "domain:canary": domainLifecyclePayloadSchema,
  "domain:updating": domainLifecyclePayloadSchema,
  "domain:updated": domainLifecyclePayloadSchema,
  "domain:deprecated": domainLifecyclePayloadSchema,
  "domain:archived": domainLifecyclePayloadSchema,
  "plugin:spi_registered": pluginLifecyclePayloadSchema,
  "plugin:activated": pluginLifecyclePayloadSchema,
  "plugin:error_isolated": pluginLifecyclePayloadSchema,
  "plugin:suspended": pluginLifecyclePayloadSchema,
  "plugin:invocation_started": pluginInvocationPayloadSchema,
  "plugin:invocation_completed": pluginInvocationPayloadSchema,
  "knowledge:chunk_indexed": knowledgeChunkIndexedPayloadSchema,
  "learning:knowledge_promoted": learningKnowledgePromotedPayloadSchema,
};

/**
 * Processed event schema registry with defaults applied.
 * Adds payloadSchemaRef and compatibilityPolicy if not provided.
 */
export const EVENT_SCHEMA_REGISTRY: Record<KnownEventType, EventSchemaDefinition> = Object.fromEntries(
  (Object.entries(RAW_EVENT_SCHEMA_REGISTRY) as Array<[KnownEventType, RawEventSchemaDefinition]>).map(([type, schema]) => [
    type,
    {
      ...schema,
      payloadSchemaRef: schema.payloadSchemaRef ?? buildPayloadSchemaRef(type),
      compatibilityPolicy: schema.compatibilityPolicy ?? "backward_compatible_additive",
    },
  ]),
) as Record<KnownEventType, EventSchemaDefinition>;

export const RUNTIME_EVENT_REPLAY_METADATA: Record<string, EventReplayMetadata> = {
  "platform.request_envelope.admitted": {
    eventType: "platform.request_envelope.admitted",
    sourceOfTruth: "platform",
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "intake-admission-service",
    replayBehavior: "replay_as_fact",
    consumerContractTests: ["intake-admission-service.test.ts"],
  },
  "platform.harness_run.status_changed": {
    eventType: "platform.harness_run.status_changed",
    sourceOfTruth: "platform",
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "runtime-state-machine",
    replayBehavior: "replay_as_fact",
    consumerContractTests: ["runtime-state-machine.test.ts", "runtime-truth-repository.test.ts"],
  },
  "platform.node_run.status_changed": {
    eventType: "platform.node_run.status_changed",
    sourceOfTruth: "platform",
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "runtime-state-machine",
    replayBehavior: "replay_as_fact",
    consumerContractTests: ["runtime-state-machine.test.ts", "plan-graph-harness-runtime.test.ts"],
  },
  "platform.side_effect.status_changed": {
    eventType: "platform.side_effect.status_changed",
    sourceOfTruth: "platform",
    replayable: true,
    sideEffectSafeToReplay: false,
    schemaOwner: "side-effect-manager",
    replayBehavior: "skip_side_effect",
    consumerContractTests: ["side-effect-manager.test.ts"],
  },
  "platform.budget_ledger.status_changed": {
    eventType: "platform.budget_ledger.status_changed",
    sourceOfTruth: "platform",
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "budget-allocator",
    replayBehavior: "replay_as_fact",
    consumerContractTests: ["budget-allocator.test.ts", "runtime-state-machine.test.ts"],
  },
  "platform.budget_reservation.status_changed": {
    eventType: "platform.budget_reservation.status_changed",
    sourceOfTruth: "platform",
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "budget-allocator",
    replayBehavior: "replay_as_fact",
    consumerContractTests: ["budget-allocator.test.ts", "runtime-state-machine.test.ts"],
  },
  "platform.graph_scheduler.decision_recorded": {
    eventType: "platform.graph_scheduler.decision_recorded",
    sourceOfTruth: "platform",
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "graph-scheduler",
    replayBehavior: "replay_as_fact",
    consumerContractTests: ["plan-graph-harness-runtime.test.ts"],
  },
  "oapeflir.view.run_lifecycle": {
    eventType: "oapeflir.view.run_lifecycle",
    sourceOfTruth: "projection",
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "oapeflir-projection",
    replayBehavior: "simulate",
    consumerContractTests: ["layered-event-inbox.test.ts"],
  },
  "oapeflir.graph.scheduled": {
    eventType: "oapeflir.graph.scheduled",
    sourceOfTruth: "platform",
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "graph-scheduler",
    replayBehavior: "replay_as_fact",
    consumerContractTests: ["plan-graph-harness-runtime.test.ts"],
  },
  "oapeflir.node.executed": {
    eventType: "oapeflir.node.executed",
    sourceOfTruth: "platform",
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "harness-runtime",
    replayBehavior: "replay_as_fact",
    consumerContractTests: ["plan-graph-harness-runtime.test.ts"],
  },
};

/**
 * Checks if an event type has a registered schema.
 * @param type - The event type to check
 * @returns True if the event type is registered
 */
export function hasEventSchema(type: string): boolean {
  return type in EVENT_SCHEMA_REGISTRY || type in RUNTIME_EVENT_REPLAY_METADATA;
}

/**
 * Gets the registered consumers for an event type.
 * Returns empty array if event type is not found.
 * R31-17 FIX: Now also returns consumers for RUNTIME_EVENT_REPLAY_METADATA events.
 * @param type - The event type to get consumers for
 * @returns Array of consumer IDs
 */
export function getRegisteredConsumers(type: string): readonly string[] {
  if (!hasEventSchema(type)) {
    return [];
  }
  // R31-17 FIX: Check EVENT_SCHEMA_REGISTRY first, then RUNTIME_EVENT_REPLAY_METADATA
  if (type in EVENT_SCHEMA_REGISTRY) {
    return EVENT_SCHEMA_REGISTRY[type as KnownEventType].consumers;
  }
  // R31-17 FIX: Handle RUNTIME_EVENT_REPLAY_METADATA events
  const metadata = RUNTIME_EVENT_REPLAY_METADATA[type];
  if (metadata != null) {
    return metadata.sourceOfTruth === "platform" ? ["truth_projector", "audit_projection"] : ["oapeflir_projection"];
  }
  return [];
}

/**
 * Gets the full event schema for an event type.
 * @param type - The event type to get the schema for
 * @returns The event schema definition
 * @throws Error if the schema is not found
 */
export function getEventSchema(type: string): EventSchemaDefinition {
  if (type in EVENT_SCHEMA_REGISTRY) {
    return EVENT_SCHEMA_REGISTRY[type as KnownEventType];
  }
  const metadata = RUNTIME_EVENT_REPLAY_METADATA[type];
  if (metadata != null) {
    return {
      type,
      tier: type.startsWith("platform.") ? "tier_1" : "tier_2",
      producer: metadata.schemaOwner,
      consumers: metadata.sourceOfTruth === "platform" ? ["truth_projector", "audit_projection"] : ["oapeflir_projection"],
      payloadSchemaRef: buildPayloadSchemaRef(type),
      compatibilityPolicy: "backward_compatible_additive",
    };
  }
  if (!hasEventSchema(type)) {
    throw new ValidationError("event.schema_missing", `event.schema_missing: Event schema not found for type: ${type}`, {
      details: { eventType: type },
    });
  }
  throw new ValidationError("event.schema_missing", `event.schema_missing: Event schema not found for type: ${type}`, {
    details: { eventType: type },
  });
}

export function getEventReplayMetadata(type: string): EventReplayMetadata {
  const metadata = RUNTIME_EVENT_REPLAY_METADATA[type];
  if (metadata == null) {
    throw new ValidationError("event.replay_metadata_missing", `Event replay metadata not found for type: ${type}`, {
      details: { eventType: type },
    });
  }
  return metadata;
}

/**
 * Validates a payload against the runtime schema for a registered event type.
 * Tier-1 events have stricter field validation; other registered events must
 * at least serialize to an object record.
 */
export function validateEventPayload(type: string, payload: unknown): Record<string, unknown> {
  getEventSchema(type);
  const validator = EVENT_PAYLOAD_VALIDATORS[type as KnownEventType] ?? genericEventPayloadSchema;
  const result = validator.safeParse(payload);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const issuePath = firstIssue?.path.join(".") ?? "payload";
    throw new ValidationError("event.payload_invalid", `Invalid payload for event type: ${type}`, {
      details: {
        eventType: type,
        issuePath,
        issueMessage: firstIssue?.message ?? "Payload validation failed.",
      },
    });
  }

  return result.data;
}

/**
 * Builds a payload schema reference URI for an event type.
 * Format: event://{type}:/v1
 * @param type - The event type
 * @returns The payload schema reference URI
 */
function buildPayloadSchemaRef(type: string): string {
  return `event://${type.replaceAll(":", "/")}/v1`;
}
