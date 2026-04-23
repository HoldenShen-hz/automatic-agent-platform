import type { EventTier } from "../../contracts/types/domain.js";
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
 * @see {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/contracts/event_registry_and_ops_threshold_contract.md | Event Registry Contract}
 */
declare const RAW_EVENT_SCHEMA_REGISTRY: {
    readonly "task:status_changed": {
        readonly type: "task:status_changed";
        readonly tier: "tier_1";
        readonly producer: "transition_service";
        readonly consumers: readonly string[];
    };
    readonly "workflow:step_completed": {
        readonly type: "workflow:step_completed";
        readonly tier: "tier_1";
        readonly producer: "workflow_runtime";
        readonly consumers: readonly string[];
    };
    readonly "decision:requested": {
        readonly type: "decision:requested";
        readonly tier: "tier_1";
        readonly producer: "approval_service";
        readonly consumers: readonly ["approval_projection", "inspect_projection"];
    };
    readonly "decision:responded": {
        readonly type: "decision:responded";
        readonly tier: "tier_1";
        readonly producer: "approval_service";
        readonly consumers: readonly ["approval_projection", "inspect_projection"];
    };
    readonly "division:completed": {
        readonly type: "division:completed";
        readonly tier: "tier_1";
        readonly producer: "workflow_runtime";
        readonly consumers: readonly string[];
    };
    readonly "division:failed": {
        readonly type: "division:failed";
        readonly tier: "tier_1";
        readonly producer: "workflow_runtime";
        readonly consumers: readonly string[];
    };
    readonly "subtask:completed": {
        readonly type: "subtask:completed";
        readonly tier: "tier_1";
        readonly producer: "workflow_runtime";
        readonly consumers: readonly string[];
    };
    readonly "subtask:failed": {
        readonly type: "subtask:failed";
        readonly tier: "tier_1";
        readonly producer: "workflow_runtime";
        readonly consumers: readonly string[];
    };
    readonly "cost:limit_reached": {
        readonly type: "cost:limit_reached";
        readonly tier: "tier_1";
        readonly producer: "admission_controller";
        readonly consumers: readonly string[];
    };
    readonly "stream:chunk_emitted": {
        readonly type: "stream:chunk_emitted";
        readonly tier: "tier_3";
        readonly producer: "stream_bridge";
        readonly consumers: readonly [];
    };
    readonly "dispatch:ticket_created": {
        readonly type: "dispatch:ticket_created";
        readonly tier: "tier_2";
        readonly producer: "execution_dispatch_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "dispatch:ticket_claimed": {
        readonly type: "dispatch:ticket_claimed";
        readonly tier: "tier_2";
        readonly producer: "execution_dispatch_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "dispatch:decision_recorded": {
        readonly type: "dispatch:decision_recorded";
        readonly tier: "tier_2";
        readonly producer: "execution_dispatch_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "dispatch:execution_preempted": {
        readonly type: "dispatch:execution_preempted";
        readonly tier: "tier_2";
        readonly producer: "execution_priority_preemption_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "dispatch:ticket_reconciled": {
        readonly type: "dispatch:ticket_reconciled";
        readonly tier: "tier_2";
        readonly producer: "execution_dispatch_reconciliation_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "dispatch:ticket_requeued": {
        readonly type: "dispatch:ticket_requeued";
        readonly tier: "tier_2";
        readonly producer: "execution_dispatch_reconciliation_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "dispatch:ticket_rebuilt": {
        readonly type: "dispatch:ticket_rebuilt";
        readonly tier: "tier_2";
        readonly producer: "execution_db_queue_disconnect_repair_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "worker:claim_accepted": {
        readonly type: "worker:claim_accepted";
        readonly tier: "tier_2";
        readonly producer: "execution_worker_handshake_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "worker:claim_rejected": {
        readonly type: "worker:claim_rejected";
        readonly tier: "tier_2";
        readonly producer: "execution_worker_handshake_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "worker:heartbeat_recorded": {
        readonly type: "worker:heartbeat_recorded";
        readonly tier: "tier_2";
        readonly producer: "execution_worker_handshake_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "worker:writeback_recorded": {
        readonly type: "worker:writeback_recorded";
        readonly tier: "tier_2";
        readonly producer: "execution_worker_writeback_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "worker:writeback_rejected": {
        readonly type: "worker:writeback_rejected";
        readonly tier: "tier_2";
        readonly producer: "execution_worker_writeback_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "worker:lease_released_after_writeback": {
        readonly type: "worker:lease_released_after_writeback";
        readonly tier: "tier_2";
        readonly producer: "execution_worker_writeback_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "takeover:session_opened": {
        readonly type: "takeover:session_opened";
        readonly tier: "tier_2";
        readonly producer: "human_takeover_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "takeover:action_applied": {
        readonly type: "takeover:action_applied";
        readonly tier: "tier_2";
        readonly producer: "human_takeover_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "recovery:repair_applied": {
        readonly type: "recovery:repair_applied";
        readonly tier: "tier_2";
        readonly producer: "runtime_repair_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "recovery:decision_recorded": {
        readonly type: "recovery:decision_recorded";
        readonly tier: "tier_2";
        readonly producer: "runtime_recovery_decision_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "recovery:dead_lettered": {
        readonly type: "recovery:dead_lettered";
        readonly tier: "tier_2";
        readonly producer: "runtime_recovery_decision_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "recovery:cancelled": {
        readonly type: "recovery:cancelled";
        readonly tier: "tier_2";
        readonly producer: "runtime_recovery_decision_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "domain:registered": {
        readonly type: "domain:registered";
        readonly tier: "tier_2";
        readonly producer: "domain_registry_service";
        readonly consumers: readonly ["inspect_projection", "feedback_projection"];
    };
    readonly "domain:activated": {
        readonly type: "domain:activated";
        readonly tier: "tier_2";
        readonly producer: "domain_registry_service";
        readonly consumers: readonly ["inspect_projection", "feedback_projection"];
    };
    readonly "plugin:spi_registered": {
        readonly type: "plugin:spi_registered";
        readonly tier: "tier_2";
        readonly producer: "plugin_spi_registry";
        readonly consumers: readonly ["inspect_projection", "feedback_projection"];
    };
    readonly "plugin:activated": {
        readonly type: "plugin:activated";
        readonly tier: "tier_2";
        readonly producer: "plugin_spi_registry";
        readonly consumers: readonly ["inspect_projection", "feedback_projection"];
    };
    readonly "plugin:error_isolated": {
        readonly type: "plugin:error_isolated";
        readonly tier: "tier_2";
        readonly producer: "plugin_spi_registry";
        readonly consumers: readonly ["inspect_projection", "feedback_projection"];
    };
    readonly "plugin:invocation_started": {
        readonly type: "plugin:invocation_started";
        readonly tier: "tier_2";
        readonly producer: "plugin_spi_registry";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "plugin:invocation_completed": {
        readonly type: "plugin:invocation_completed";
        readonly tier: "tier_2";
        readonly producer: "plugin_spi_registry";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "knowledge:chunk_indexed": {
        readonly type: "knowledge:chunk_indexed";
        readonly tier: "tier_2";
        readonly producer: "knowledge_plane_service";
        readonly consumers: readonly ["inspect_projection", "feedback_projection"];
    };
    readonly "learning:knowledge_promoted": {
        readonly type: "learning:knowledge_promoted";
        readonly tier: "tier_2";
        readonly producer: "knowledge_promotion_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "skill:execution_started": {
        readonly type: "skill:execution_started";
        readonly tier: "tier_2";
        readonly producer: "skill_execution_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "skill:cache_miss": {
        readonly type: "skill:cache_miss";
        readonly tier: "tier_2";
        readonly producer: "skill_execution_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "skill:cache_hit": {
        readonly type: "skill:cache_hit";
        readonly tier: "tier_2";
        readonly producer: "skill_execution_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "skill:cache_stored": {
        readonly type: "skill:cache_stored";
        readonly tier: "tier_2";
        readonly producer: "skill_execution_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "skill:step_started": {
        readonly type: "skill:step_started";
        readonly tier: "tier_2";
        readonly producer: "skill_execution_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "skill:retry_scheduled": {
        readonly type: "skill:retry_scheduled";
        readonly tier: "tier_2";
        readonly producer: "skill_execution_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "skill:step_succeeded": {
        readonly type: "skill:step_succeeded";
        readonly tier: "tier_2";
        readonly producer: "skill_execution_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "skill:step_failed": {
        readonly type: "skill:step_failed";
        readonly tier: "tier_2";
        readonly producer: "skill_execution_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "skill:execution_completed": {
        readonly type: "skill:execution_completed";
        readonly tier: "tier_2";
        readonly producer: "skill_execution_service";
        readonly consumers: readonly ["inspect_projection"];
    };
    readonly "perf:test_event": {
        readonly type: "perf:test_event";
        readonly tier: "tier_3";
        readonly producer: "performance_test";
        readonly consumers: readonly [];
    };
    readonly "perf:burst_event": {
        readonly type: "perf:burst_event";
        readonly tier: "tier_3";
        readonly producer: "performance_test";
        readonly consumers: readonly [];
    };
    readonly "test:capacity": {
        readonly type: "test:capacity";
        readonly tier: "tier_3";
        readonly producer: "performance_test";
        readonly consumers: readonly [];
    };
    readonly "test:many_events": {
        readonly type: "test:many_events";
        readonly tier: "tier_3";
        readonly producer: "performance_test";
        readonly consumers: readonly [];
    };
};
/**
 * All known event types in the system.
 */
export type KnownEventType = keyof typeof RAW_EVENT_SCHEMA_REGISTRY;
/**
 * Processed event schema registry with defaults applied.
 * Adds payloadSchemaRef and compatibilityPolicy if not provided.
 */
export declare const EVENT_SCHEMA_REGISTRY: Record<KnownEventType, EventSchemaDefinition>;
/**
 * Checks if an event type has a registered schema.
 * @param type - The event type to check
 * @returns True if the event type is registered
 */
export declare function hasEventSchema(type: string): boolean;
/**
 * Gets the registered consumers for an event type.
 * Returns empty array if event type is not found.
 * @param type - The event type to get consumers for
 * @returns Array of consumer IDs
 */
export declare function getRegisteredConsumers(type: string): readonly string[];
/**
 * Gets the full event schema for an event type.
 * @param type - The event type to get the schema for
 * @returns The event schema definition
 * @throws Error if the schema is not found
 */
export declare function getEventSchema(type: string): EventSchemaDefinition;
/**
 * Validates a payload against the runtime schema for a registered event type.
 * Tier-1 events have stricter field validation; other registered events must
 * at least serialize to an object record.
 */
export declare function validateEventPayload(type: string, payload: unknown): Record<string, unknown>;
export {};
