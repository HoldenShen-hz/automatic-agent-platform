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
  "workflow:step_completed",
  "decision:requested",
  "decision:responded",
  "division:completed",
  "division:failed",
  "subtask:completed",
  "subtask:failed",
  "cost:limit_reached",
  // §28 Missing namespaces
  "delegation:created",
  "delegation:completed",
  "delegation:failed",
  "prompt:injected",
  "prompt:rendered",
  "prompt:validation_failed",
  "cost:budget_created",
  "cost:budget_exceeded",
  "cost:actualized",
  "tenant:provisioned",
  "tenant:suspended",
  "tenant:deleted",
  "pack:installed",
  "pack:uninstalled",
  "marketplace:listing_published",
  "marketplace:listing_purchased",
  "anomaly:classified",
  "slo:breached",
  "slo:recovered",
  "compliance:audit_recorded",
  "compliance:violation_detected",
  "knowledge:document_indexed",
  "knowledge:query_processed",
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
  "workflow:step_completed": ["workflow_projection", "inspect_projection"],
  "decision:requested": ["approval_projection", "inspect_projection"],
  "decision:responded": ["approval_projection", "inspect_projection"],
  "division:completed": ["division_projection", "inspect_projection"],
  "division:failed": ["division_projection", "inspect_projection"],
  "subtask:completed": ["task_projection", "inspect_projection"],
  "subtask:failed": ["task_projection", "inspect_projection"],
  "cost:limit_reached": ["budget_projection", "inspect_projection"],
  // §28 Missing namespace consumers
  "delegation:created": ["delegation_projection", "inspect_projection"],
  "delegation:completed": ["delegation_projection", "inspect_projection"],
  "delegation:failed": ["delegation_projection", "inspect_projection"],
  "prompt:injected": ["prompt_projection", "inspect_projection"],
  "prompt:rendered": ["prompt_projection", "inspect_projection"],
  "prompt:validation_failed": ["prompt_projection", "inspect_projection"],
  "cost:budget_created": ["cost_dashboard", "inspect_projection"],
  "cost:budget_exceeded": ["cost_dashboard", "inspect_projection"],
  "cost:actualized": ["cost_dashboard", "inspect_projection"],
  "tenant:provisioned": ["tenant_projection", "inspect_projection"],
  "tenant:suspended": ["tenant_projection", "inspect_projection"],
  "tenant:deleted": ["tenant_projection", "inspect_projection"],
  "pack:installed": ["pack_projection", "inspect_projection"],
  "pack:uninstalled": ["pack_projection", "inspect_projection"],
  "marketplace:listing_published": ["marketplace_projection", "inspect_projection"],
  "marketplace:listing_purchased": ["marketplace_projection", "inspect_projection"],
  "anomaly:classified": ["incident_projection", "inspect_projection"],
  "slo:breached": ["slo_projection", "inspect_projection"],
  "slo:recovered": ["slo_projection", "inspect_projection"],
  "compliance:audit_recorded": ["compliance_projection", "inspect_projection"],
  "compliance:violation_detected": ["compliance_projection", "inspect_projection"],
  "knowledge:document_indexed": ["knowledge_projection", "inspect_projection"],
  "knowledge:query_processed": ["knowledge_projection", "inspect_projection"],
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
