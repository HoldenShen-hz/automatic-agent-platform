import type { DeadLetterQueueService, DeadLetterQueueSummary } from "../dlq/index.js";
import { type EventSchemaDefinition } from "./event-registry.js";
export interface EventReliabilityInventoryEntry {
    eventType: string;
    namespace: string;
    tier: EventSchemaDefinition["tier"];
    producer: string;
    consumers: readonly string[];
    ackRequired: boolean;
    replayRequired: boolean;
    dlqEligible: boolean;
    payloadSchemaRef: string;
}
export interface EventNamespaceInventory {
    namespace: string;
    totalEvents: number;
    tierCounts: Record<EventSchemaDefinition["tier"], number>;
    producers: string[];
    consumers: string[];
    ackRequiredEvents: string[];
    replayRequiredEvents: string[];
    dlqEligibleEvents: string[];
}
export interface EventConsumerSurfaceInventory {
    consumerId: string;
    role: "projection" | "ops_consumer";
    expectedByContract: boolean;
    consumedEvents: string[];
    tier1Events: string[];
    tier2Events: string[];
    tier3Events: string[];
    ackRequired: boolean;
    replayRequired: boolean;
    coverageStatus: "implemented" | "contract_gap";
}
export interface EventReliabilityInventoryReport {
    totalEvents: number;
    tierCounts: Record<EventSchemaDefinition["tier"], number>;
    namespaces: EventNamespaceInventory[];
    consumerSurfaces: EventConsumerSurfaceInventory[];
    tier1EventsMissingConsumers: string[];
    dlqSummary: DeadLetterQueueSummary | null;
}
export declare class EventReliabilityInventoryService {
    private readonly deadLetterQueue;
    constructor(deadLetterQueue?: DeadLetterQueueService | null);
    listEventEntries(): EventReliabilityInventoryEntry[];
    listNamespaceInventory(): EventNamespaceInventory[];
    listConsumerSurfaces(): EventConsumerSurfaceInventory[];
    buildReport(): EventReliabilityInventoryReport;
}
