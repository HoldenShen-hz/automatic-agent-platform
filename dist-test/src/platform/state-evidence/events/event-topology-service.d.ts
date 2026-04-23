import { type EventSchemaDefinition } from "./event-registry.js";
export interface EventTopologyNode {
    nodeId: string;
    kind: "producer" | "event" | "consumer";
}
export interface EventTopologyEdge {
    source: string;
    target: string;
    relation: "emits" | "consumes";
    tier: EventSchemaDefinition["tier"];
}
export interface EventTopologyEntry {
    eventType: string;
    namespace: string;
    tier: EventSchemaDefinition["tier"];
    producer: string;
    consumers: readonly string[];
    payloadSchemaRef: string;
    reliableAckRequired: boolean;
}
export interface EventTopologySummary {
    totalEvents: number;
    namespaces: string[];
    tierCounts: Record<EventSchemaDefinition["tier"], number>;
    producers: string[];
    consumers: string[];
}
export declare class EventTopologyService {
    listEntries(): EventTopologyEntry[];
    buildGraph(): {
        nodes: EventTopologyNode[];
        edges: EventTopologyEdge[];
    };
    buildSummary(): EventTopologySummary;
    listNamespaceEntries(namespace: string): EventTopologyEntry[];
}
