/**
 * @fileoverview Event Types - Tier classification and consumer registry for events.
 *
 * ## Overview
 *
 * Defines Tier 1 event types that require reliable delivery and maps them
 * to their required consumers (projections).
 *
 * ## Event Tier Semantics
 *
 * - **Tier 1**: Must reliably deliver, must have ack, must be recoverable
 *   * Examples: task:status_changed, workflow:step_completed, decision:requested
 *
 * - **Tier 2**: At-least-once delivery recommended
 *   * Examples: dispatch:ticket_created, worker:heartbeat_recorded
 *
 * - **Tier 3**: Best-effort delivery
 *   * Examples: stream:chunk_emitted
 *
 * ## Key Concepts
 *
 * - **Tier 1 Event**: Event that must be reliably delivered and cannot be silently lost
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: tier 1 event}
 *
 * - **Ack**: Record that consumer has confirmed processing
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: ack}
 *
 * - **Consumer**: Projection maintaining materialized view of event data
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: consumer}
 *
 * @see Event Registry Contract: docs_zh/contracts/event_registry_and_ops_threshold_contract.md
 * @see Event Bus Contract: docs_zh/contracts/event_bus_contract.md
 * @see Glossary: docs_zh/governance/glossary_and_terminology.md
 */

import type { EventTier } from "../../contracts/types/domain.js";

/**
 * Tier 1 event types are critical events that require reliable delivery
 * and are used for core business logic tracking.
 */
export const TIER_1_EVENT_TYPES = [
  "task:status_changed",
  "session:status_changed",
  "execution:status_changed",
  "workflow:step_completed",
  "decision:requested",
  "decision:responded",
  "division:completed",
  "division:failed",
  "subtask:completed",
  "subtask:failed",
  "cost:limit_reached",
  // §28.1: Canonical platform events (unified from legacy namespaces)
  "platform.harness_run.status_changed",
  "platform.harness_run.created",
  "platform.harness_run.admitted",
  "platform.harness_run.planning",
  "platform.harness_run.ready",
  "platform.harness_run.pausing",
  "platform.harness_run.replanning",
  "platform.harness_run.compensating",
  "platform.harness_run.aborted",
  "platform.harness_run.completed",
  "platform.harness_run.failed",
  "platform.node_run.status_changed",
  "platform.node_run.created",
  "platform.node_run.admitted",
  "platform.node_run.planning",
  "platform.node_run.ready",
  "platform.node_run.pausing",
  "platform.node_run.replanning",
  "platform.node_run.started",
  "platform.node_run.completed",
  "platform.node_run.failed",
  "platform.node_run.compensating",
  "platform.node_run.skipped",
  "platform.budget_ledger.status_changed",
  "platform.budget_reservation.status_changed",
  "platform.budget.status_changed",
  "platform.budget.reserved",
  "platform.budget.actualized",
  "platform.budget.exceeded",
  "platform.budget_reconciliation.status_changed",
  // §28.1: Side effect events for replay safety classification
  "platform.side_effect.status_changed",
  "platform.side_effect.triggered",
  "platform.side_effect.completed",
  "platform.side_effect.failed",
  "oapeflir.view.run_lifecycle",
  "oapeflir.decision.recorded",
  "oapeflir.phase.transition",
] as const;

/**
 * Type representing any Tier 1 event type.
 */
export type Tier1EventType = (typeof TIER_1_EVENT_TYPES)[number];

/**
 * Maps each Tier 1 event type to the list of consumers that must receive it.
 * Consumers are projections that maintain materialized views of the event data.
 */
export const REQUIRED_CONSUMERS_BY_EVENT_TYPE: Record<Tier1EventType, readonly string[]> = {
  "task:status_changed": ["task_projection", "inspect_projection"],
  "session:status_changed": ["task_projection", "inspect_projection"],
  "execution:status_changed": ["task_projection", "inspect_projection"],
  "workflow:step_completed": ["workflow_projection", "inspect_projection"],
  "decision:requested": ["approval_projection", "inspect_projection"],
  "decision:responded": ["approval_projection", "inspect_projection"],
  "division:completed": ["division_projection", "inspect_projection"],
  "division:failed": ["division_projection", "inspect_projection"],
  "subtask:completed": ["task_projection", "inspect_projection"],
  "subtask:failed": ["task_projection", "inspect_projection"],
  "cost:limit_reached": ["budget_projection", "inspect_projection"],
  // §28.1: Canonical platform events
  "platform.harness_run.status_changed": ["truth_projector", "audit_projection"],
  "platform.harness_run.created": ["truth_projector", "audit_projection"],
  "platform.harness_run.admitted": ["truth_projector", "audit_projection"],
  "platform.harness_run.planning": ["truth_projector", "audit_projection"],
  "platform.harness_run.ready": ["truth_projector", "audit_projection"],
  "platform.harness_run.pausing": ["truth_projector", "audit_projection"],
  "platform.harness_run.replanning": ["truth_projector", "audit_projection"],
  "platform.harness_run.compensating": ["truth_projector", "audit_projection"],
  "platform.harness_run.aborted": ["truth_projector", "audit_projection"],
  "platform.harness_run.completed": ["truth_projector", "audit_projection"],
  "platform.harness_run.failed": ["truth_projector", "audit_projection"],
  "platform.node_run.status_changed": ["truth_projector", "audit_projection"],
  "platform.node_run.created": ["truth_projector", "audit_projection"],
  "platform.node_run.admitted": ["truth_projector", "audit_projection"],
  "platform.node_run.planning": ["truth_projector", "audit_projection"],
  "platform.node_run.ready": ["truth_projector", "audit_projection"],
  "platform.node_run.pausing": ["truth_projector", "audit_projection"],
  "platform.node_run.replanning": ["truth_projector", "audit_projection"],
  "platform.node_run.started": ["truth_projector", "audit_projection"],
  "platform.node_run.completed": ["truth_projector", "audit_projection"],
  "platform.node_run.failed": ["truth_projector", "audit_projection"],
  "platform.node_run.compensating": ["truth_projector", "audit_projection"],
  "platform.node_run.skipped": ["truth_projector", "audit_projection"],
  "platform.budget_ledger.status_changed": ["truth_projector", "audit_projection"],
  "platform.budget_reservation.status_changed": ["truth_projector", "audit_projection"],
  "platform.budget.status_changed": ["truth_projector", "audit_projection"],
  "platform.budget.reserved": ["truth_projector", "audit_projection"],
  "platform.budget.actualized": ["truth_projector", "audit_projection"],
  "platform.budget.exceeded": ["truth_projector", "audit_projection"],
  "platform.budget_reconciliation.status_changed": ["truth_projector", "audit_projection"],
  // §28.1: Side effect event for skip_side_effect replay behavior
  "platform.side_effect.status_changed": ["truth_projector", "audit_projection"],
  "platform.side_effect.triggered": ["truth_projector", "audit_projection"],
  "platform.side_effect.completed": ["truth_projector", "audit_projection"],
  "platform.side_effect.failed": ["truth_projector", "audit_projection"],
  "oapeflir.view.run_lifecycle": ["oapeflir_projection", "inspect_projection"],
  "oapeflir.decision.recorded": ["oapeflir_projection", "inspect_projection"],
  "oapeflir.phase.transition": ["oapeflir_projection", "inspect_projection"],
};

/**
 * Determines the event tier for a given event type.
 * Tier 1 events are those that must be reliably delivered.
 * @param eventType - The type of event to check
 * @returns The event tier (tier_1 or tier_2 by default)
 */
export function getEventTier(eventType: string): EventTier {
  if ((TIER_1_EVENT_TYPES as readonly string[]).includes(eventType)) {
    return "tier_1";
  }

  if (
    eventType === "stream:chunk_emitted"
    || eventType === "perf:test_event"
    || eventType === "perf:burst_event"
    || eventType === "test:capacity"
    || eventType === "test:many_events"
  ) {
    return "tier_3";
  }

  return "tier_2";
}

/**
 * Gets the list of required consumers for a given event type.
 * Only Tier 1 events have required consumers.
 * @param eventType - The type of event to get consumers for
 * @returns Array of consumer IDs that must receive the event
 */
export function getRequiredConsumers(eventType: string): readonly string[] {
  return REQUIRED_CONSUMERS_BY_EVENT_TYPE[eventType as Tier1EventType] ?? [];
}
