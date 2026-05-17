import { getRequiredConsumers } from "./event-types.js";
import type { EventTier } from "../../contracts/types/domain.js";
import { ValidationError } from "../../contracts/errors.js";
import { EVENT_PAYLOAD_VALIDATORS, RUNTIME_EVENT_REPLAY_METADATA, genericEventPayloadSchema } from "./event-registry-payloads.js";
export { RUNTIME_EVENT_REPLAY_METADATA } from "./event-registry-payloads.js";
import { getEventTier } from "./event-types.js";

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
  "session:status_changed": {
    type: "session:status_changed",
    tier: "tier_1",
    producer: "transition_service",
    consumers: getRequiredConsumers("session:status_changed"),
  },
  "execution:status_changed": {
    type: "execution:status_changed",
    tier: "tier_1",
    producer: "transition_service",
    consumers: getRequiredConsumers("execution:status_changed"),
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
  "platform.harness_run.admitted": {
    type: "platform.harness_run.admitted",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.harness_run.planning": {
    type: "platform.harness_run.planning",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.harness_run.ready": {
    type: "platform.harness_run.ready",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.harness_run.pausing": {
    type: "platform.harness_run.pausing",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.harness_run.replanning": {
    type: "platform.harness_run.replanning",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.harness_run.compensating": {
    type: "platform.harness_run.compensating",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.harness_run.aborted": {
    type: "platform.harness_run.aborted",
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
  "platform.node_run.created": {
    type: "platform.node_run.created",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.node_run.admitted": {
    type: "platform.node_run.admitted",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.node_run.planning": {
    type: "platform.node_run.planning",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.node_run.ready": {
    type: "platform.node_run.ready",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.node_run.pausing": {
    type: "platform.node_run.pausing",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.node_run.replanning": {
    type: "platform.node_run.replanning",
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
  "platform.node_run.failed": {
    type: "platform.node_run.failed",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.node_run.compensating": {
    type: "platform.node_run.compensating",
    tier: "tier_1",
    producer: "runtime_state_machine",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.node_run.skipped": {
    type: "platform.node_run.skipped",
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
  "platform.budget.status_changed": {
    type: "platform.budget.status_changed",
    tier: "tier_1",
    producer: "budget_allocator",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.budget.reserved": {
    type: "platform.budget.reserved",
    tier: "tier_1",
    producer: "budget_allocator",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.budget.actualized": {
    type: "platform.budget.actualized",
    tier: "tier_1",
    producer: "budget_allocator",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.budget.exceeded": {
    type: "platform.budget.exceeded",
    tier: "tier_1",
    producer: "budget_allocator",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.budget_reconciliation.status_changed": {
    type: "platform.budget_reconciliation.status_changed",
    tier: "tier_1",
    producer: "budget_allocator",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.side_effect.status_changed": {
    type: "platform.side_effect.status_changed",
    tier: "tier_1",
    producer: "side_effect_manager",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.side_effect.triggered": {
    type: "platform.side_effect.triggered",
    tier: "tier_1",
    producer: "side_effect_manager",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.side_effect.completed": {
    type: "platform.side_effect.completed",
    tier: "tier_1",
    producer: "side_effect_manager",
    consumers: ["truth_projector", "audit_projection"],
  },
  "platform.side_effect.failed": {
    type: "platform.side_effect.failed",
    tier: "tier_1",
    producer: "side_effect_manager",
    consumers: ["truth_projector", "audit_projection"],
  },
  "oapeflir.view.run_lifecycle": {
    type: "oapeflir.view.run_lifecycle",
    tier: "tier_1",
    producer: "oapeflir_projection",
    consumers: ["oapeflir_projection", "inspect_projection"],
  },
  "oapeflir.decision.recorded": {
    type: "oapeflir.decision.recorded",
    tier: "tier_1",
    producer: "oapeflir_projection",
    consumers: ["oapeflir_projection", "inspect_projection"],
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
  "perf:fanout_event": {
    type: "perf:fanout_event",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:throughput_test": {
    type: "perf:throughput_test",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:latency_test": {
    type: "perf:latency_test",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:batch_test": {
    type: "perf:batch_test",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:batch_scale": {
    type: "perf:batch_scale",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:deliver_test": {
    type: "perf:deliver_test",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:deliver_latency": {
    type: "perf:deliver_latency",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:fanout": {
    type: "perf:fanout",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:multi_consumer": {
    type: "perf:multi_consumer",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:stress": {
    type: "perf:stress",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:bulk_deliver": {
    type: "perf:bulk_deliver",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:concurrent": {
    type: "perf:concurrent",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:memory": {
    type: "perf:memory",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:verify": {
    type: "perf:verify",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:mem_test": {
    type: "perf:mem_test",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:steady_test": {
    type: "perf:steady_test",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:efficiency_test": {
    type: "perf:efficiency_test",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:cleanup_test": {
    type: "perf:cleanup_test",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:filesize_test": {
    type: "perf:filesize_test",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:sustained_test": {
    type: "perf:sustained_test",
    tier: "tier_3",
    producer: "performance_test",
    consumers: [],
  },
  "perf:concurrent_test": {
    type: "perf:concurrent_test",
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
  const metadata = RUNTIME_EVENT_REPLAY_METADATA[type];
  if (metadata != null) {
    return {
      type,
      tier: getEventTier(type),
      producer: metadata.schemaOwner,
      consumers: metadata.sourceOfTruth === "platform" ? ["truth_projector", "audit_projection"] : ["oapeflir_projection"],
      payloadSchemaRef: buildPayloadSchemaRef(type),
      compatibilityPolicy: "backward_compatible_additive",
    };
  }
  if (type in EVENT_SCHEMA_REGISTRY) {
    return EVENT_SCHEMA_REGISTRY[type as KnownEventType];
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
  if (metadata != null) {
    return metadata;
  }
  if (type in EVENT_SCHEMA_REGISTRY) {
    const schema = EVENT_SCHEMA_REGISTRY[type as KnownEventType];
    if (type.startsWith("platform.") || type.startsWith("oapeflir.")) {
      return {
        eventType: type,
        sourceOfTruth: type.startsWith("oapeflir.view.") || type.startsWith("oapeflir.phase.")
          ? "projection"
          : "platform",
        replayable: true,
        sideEffectSafeToReplay: !type.startsWith("platform.side_effect."),
        schemaOwner: schema.producer,
        replayBehavior: type.startsWith("platform.side_effect.") ? "skip_side_effect" : "replay_as_fact",
        consumerContractTests: [],
      };
    }
  }
  {
    throw new ValidationError("event.replay_metadata_missing", `Event replay metadata not found for type: ${type}`, {
      details: { eventType: type },
    });
  }
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
