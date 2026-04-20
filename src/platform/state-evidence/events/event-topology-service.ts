import { EVENT_SCHEMA_REGISTRY, type EventSchemaDefinition } from "./event-registry.js";

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

export class EventTopologyService {
  public listEntries(): EventTopologyEntry[] {
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

  public buildGraph(): {
    nodes: EventTopologyNode[];
    edges: EventTopologyEdge[];
  } {
    const entries = this.listEntries();
    const nodes = new Map<string, EventTopologyNode>();
    const edges: EventTopologyEdge[] = [];
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

  public buildSummary(): EventTopologySummary {
    const entries = this.listEntries();
    return {
      totalEvents: entries.length,
      namespaces: [...new Set(entries.map((entry) => entry.namespace))].sort(),
      tierCounts: entries.reduce<Record<EventSchemaDefinition["tier"], number>>(
        (counts, entry) => {
          counts[entry.tier] += 1;
          return counts;
        },
        { tier_1: 0, tier_2: 0, tier_3: 0 },
      ),
      producers: [...new Set(entries.map((entry) => entry.producer))].sort(),
      consumers: [...new Set(entries.flatMap((entry) => entry.consumers))].sort(),
    };
  }

  public listNamespaceEntries(namespace: string): EventTopologyEntry[] {
    return this.listEntries().filter((entry) => entry.namespace === namespace);
  }
}
