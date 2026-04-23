/**
 * DomainEventPayload — structured payload for domain lifecycle events.
 *
 * §B.9: Standardized event payload format for domain-registered,
 * domain-activated, domain-deactivated, and domain-error events.
 */
export interface DomainEventPayload {
    /** Event identifier */
    eventId: string;
    /** Type of domain event */
    eventType: DomainEventType;
    /** Domain this event applies to */
    domainId: string;
    /** Domain name at time of event */
    domainName: string;
    /** Timestamp of the event */
    occurredAt: number;
    /** Actor that triggered this event */
    actor: EventActor;
    /** Event-specific data */
    data: DomainEventData;
}
export type DomainEventType = "domain.registered" | "domain.activated" | "domain.deactivated" | "domain.degraded" | "domain.disabled" | "domain.error";
export interface EventActor {
    /** Actor type */
    type: "system" | "operator" | "plugin" | "user";
    /** Actor identifier */
    id: string;
}
export interface DomainEventData {
    /** Error message for error events */
    errorMessage?: string;
    /** Error code for error events */
    errorCode?: string;
    /** Previous status for status change events */
    previousStatus?: string;
    /** New status for status change events */
    newStatus?: string;
    /** Affected plugin IDs */
    affectedPlugins?: string[];
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}
