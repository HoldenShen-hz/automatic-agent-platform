import type { DeadLetterQueueService, DeadLetterQueueSummary } from "../dlq/index.js";
import { EVENT_SCHEMA_REGISTRY, type EventSchemaDefinition } from "./event-registry.js";

function eventNamespace(eventType: string): string {
  const separatorIndex = eventType.search(/[:.]/);
  return separatorIndex >= 0 ? eventType.slice(0, separatorIndex) : "unknown";
}

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

const EXPECTED_CONSUMER_SURFACES = [
  { consumerId: "task_projection", role: "projection" as const },
  { consumerId: "workflow_projection", role: "projection" as const },
  { consumerId: "approval_projection", role: "projection" as const },
  { consumerId: "division_projection", role: "projection" as const },
  { consumerId: "budget_projection", role: "projection" as const },
  { consumerId: "inspect_projection", role: "projection" as const },
  { consumerId: "feedback_projection", role: "projection" as const },
  { consumerId: "gateway_projection", role: "ops_consumer" as const },
  { consumerId: "observability_sink", role: "ops_consumer" as const },
  { consumerId: "runtime_recovery_scanner", role: "ops_consumer" as const },
] as const;

export class EventReliabilityInventoryService {
  public constructor(
    private readonly deadLetterQueue: DeadLetterQueueService | null = null,
  ) {}

  public listEventEntries(): EventReliabilityInventoryEntry[] {
    return Object.values(EVENT_SCHEMA_REGISTRY).map((schema) => ({
      eventType: schema.type,
      namespace: eventNamespace(schema.type),
      tier: schema.tier,
      producer: schema.producer,
      consumers: [...schema.consumers],
      ackRequired: schema.tier === "tier_1",
      replayRequired: schema.tier === "tier_1",
      dlqEligible: schema.tier !== "tier_3",
      payloadSchemaRef: schema.payloadSchemaRef,
    }));
  }

  public listNamespaceInventory(): EventNamespaceInventory[] {
    const groups = new Map<string, EventReliabilityInventoryEntry[]>();
    for (const entry of this.listEventEntries()) {
      const bucket = groups.get(entry.namespace) ?? [];
      bucket.push(entry);
      groups.set(entry.namespace, bucket);
    }
    return [...groups.entries()]
      .map(([namespace, entries]) => ({
        namespace,
        totalEvents: entries.length,
        tierCounts: entries.reduce<Record<EventSchemaDefinition["tier"], number>>(
          (counts, entry) => {
            counts[entry.tier] += 1;
            return counts;
          },
          { tier_1: 0, tier_2: 0, tier_3: 0 },
        ),
        producers: [...new Set(entries.map((entry) => entry.producer))].sort(),
        consumers: [...new Set(entries.flatMap((entry) => entry.consumers))].sort(),
        ackRequiredEvents: entries.filter((entry) => entry.ackRequired).map((entry) => entry.eventType).sort(),
        replayRequiredEvents: entries.filter((entry) => entry.replayRequired).map((entry) => entry.eventType).sort(),
        dlqEligibleEvents: entries.filter((entry) => entry.dlqEligible).map((entry) => entry.eventType).sort(),
      }))
      .sort((left, right) => left.namespace < right.namespace ? -1 : left.namespace > right.namespace ? 1 : 0);
  }

  public listConsumerSurfaces(): EventConsumerSurfaceInventory[] {
    const entries = this.listEventEntries();
    const actualConsumerIds = new Set(entries.flatMap((entry) => entry.consumers));
    const expected = new Map<string, (typeof EXPECTED_CONSUMER_SURFACES)[number]>(
      EXPECTED_CONSUMER_SURFACES.map((item) => [item.consumerId, item]),
    );
    const allConsumerIds = [...new Set([...expected.keys(), ...actualConsumerIds])].sort();

    return allConsumerIds.map((consumerId) => {
      const consumedEvents = entries
        .filter((entry) => entry.consumers.includes(consumerId))
        .map((entry) => entry.eventType)
        .sort();
      const tier1Events = entries.filter((entry) => entry.tier === "tier_1" && entry.consumers.includes(consumerId)).map((entry) => entry.eventType).sort();
      const tier2Events = entries.filter((entry) => entry.tier === "tier_2" && entry.consumers.includes(consumerId)).map((entry) => entry.eventType).sort();
      const tier3Events = entries.filter((entry) => entry.tier === "tier_3" && entry.consumers.includes(consumerId)).map((entry) => entry.eventType).sort();
      const contractMeta = expected.get(consumerId);
      return {
        consumerId,
        role: contractMeta?.role ?? "projection",
        expectedByContract: contractMeta != null,
        consumedEvents,
        tier1Events,
        tier2Events,
        tier3Events,
        ackRequired: tier1Events.length > 0,
        replayRequired: tier1Events.length > 0,
        coverageStatus: contractMeta != null && consumedEvents.length === 0 ? "contract_gap" : "implemented",
      };
    });
  }

  public buildReport(): EventReliabilityInventoryReport {
    const entries = this.listEventEntries();
    return {
      totalEvents: entries.length,
      tierCounts: entries.reduce<Record<EventSchemaDefinition["tier"], number>>(
        (counts, entry) => {
          counts[entry.tier] += 1;
          return counts;
        },
        { tier_1: 0, tier_2: 0, tier_3: 0 },
      ),
      namespaces: this.listNamespaceInventory(),
      consumerSurfaces: this.listConsumerSurfaces(),
      tier1EventsMissingConsumers: entries.filter((entry) => entry.tier === "tier_1" && entry.consumers.length === 0).map((entry) => entry.eventType),
      dlqSummary: this.deadLetterQueue?.summarize() ?? null,
    };
  }
}
