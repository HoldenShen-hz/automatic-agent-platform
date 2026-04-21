import { EVENT_SCHEMA_REGISTRY } from "./event-registry.js";
export class EventTopologyService {
    listEntries() {
        return Object.values(EVENT_SCHEMA_REGISTRY).map((schema) => ({
            eventType: schema.type,
            namespace: schema.type.split(":")[0] ?? "unknown",
            tier: schema.tier,
            producer: schema.producer,
            consumers: [...schema.consumers],
            payloadSchemaRef: schema.payloadSchemaRef,
            reliableAckRequired: schema.tier === "tier_1",
        }));
    }
    buildGraph() {
        const entries = this.listEntries();
        const nodes = new Map();
        const edges = [];
        for (const entry of entries) {
            nodes.set(`producer:${entry.producer}`, { nodeId: `producer:${entry.producer}`, kind: "producer" });
            nodes.set(`event:${entry.eventType}`, { nodeId: `event:${entry.eventType}`, kind: "event" });
            edges.push({
                source: `producer:${entry.producer}`,
                target: `event:${entry.eventType}`,
                relation: "emits",
                tier: entry.tier,
            });
            for (const consumer of entry.consumers) {
                nodes.set(`consumer:${consumer}`, { nodeId: `consumer:${consumer}`, kind: "consumer" });
                edges.push({
                    source: `event:${entry.eventType}`,
                    target: `consumer:${consumer}`,
                    relation: "consumes",
                    tier: entry.tier,
                });
            }
        }
        return {
            nodes: [...nodes.values()],
            edges,
        };
    }
    buildSummary() {
        const entries = this.listEntries();
        return {
            totalEvents: entries.length,
            namespaces: [...new Set(entries.map((entry) => entry.namespace))].sort(),
            tierCounts: entries.reduce((counts, entry) => {
                counts[entry.tier] += 1;
                return counts;
            }, { tier_1: 0, tier_2: 0, tier_3: 0 }),
            producers: [...new Set(entries.map((entry) => entry.producer))].sort(),
            consumers: [...new Set(entries.flatMap((entry) => entry.consumers))].sort(),
        };
    }
    listNamespaceEntries(namespace) {
        return this.listEntries().filter((entry) => entry.namespace === namespace);
    }
}
//# sourceMappingURL=event-topology-service.js.map