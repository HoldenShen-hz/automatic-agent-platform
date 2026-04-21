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
export declare const TIER_1_EVENT_TYPES: readonly ["task:status_changed", "workflow:step_completed", "decision:requested", "decision:responded", "division:completed", "division:failed", "subtask:completed", "subtask:failed", "cost:limit_reached", "delegation:created", "delegation:completed", "delegation:failed", "prompt:injected", "prompt:rendered", "prompt:validation_failed", "cost:budget_created", "cost:budget_exceeded", "cost:actualized", "tenant:provisioned", "tenant:suspended", "tenant:deleted", "pack:installed", "pack:uninstalled", "marketplace:listing_published", "marketplace:listing_purchased", "slo:breached", "slo:recovered", "compliance:audit_recorded", "compliance:violation_detected", "knowledge:document_indexed", "knowledge:query_processed"];
/**
 * Type representing any Tier 1 event type.
 */
export type Tier1EventType = (typeof TIER_1_EVENT_TYPES)[number];
/**
 * Maps each Tier 1 event type to the list of consumers that must receive it.
 * Consumers are projections that maintain materialized views of the event data.
 */
export declare const REQUIRED_CONSUMERS_BY_EVENT_TYPE: Record<Tier1EventType, readonly string[]>;
/**
 * Determines the event tier for a given event type.
 * Tier 1 events are those that must be reliably delivered.
 * @param eventType - The type of event to check
 * @returns The event tier (tier_1 or tier_2 by default)
 */
export declare function getEventTier(eventType: string): EventTier;
/**
 * Gets the list of required consumers for a given event type.
 * Only Tier 1 events have required consumers.
 * @param eventType - The type of event to get consumers for
 * @returns Array of consumer IDs that must receive the event
 */
export declare function getRequiredConsumers(eventType: string): readonly string[];
