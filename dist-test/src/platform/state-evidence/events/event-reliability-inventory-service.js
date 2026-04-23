import { EVENT_SCHEMA_REGISTRY } from "./event-registry.js";
const EXPECTED_CONSUMER_SURFACES = [
    { consumerId: "task_projection", role: "projection" },
    { consumerId: "workflow_projection", role: "projection" },
    { consumerId: "approval_projection", role: "projection" },
    { consumerId: "division_projection", role: "projection" },
    { consumerId: "budget_projection", role: "projection" },
    { consumerId: "inspect_projection", role: "projection" },
    { consumerId: "feedback_projection", role: "projection" },
    { consumerId: "gateway_projection", role: "ops_consumer" },
    { consumerId: "observability_sink", role: "ops_consumer" },
    { consumerId: "runtime_recovery_scanner", role: "ops_consumer" },
];
export class EventReliabilityInventoryService {
    deadLetterQueue;
    constructor(deadLetterQueue = null) {
        this.deadLetterQueue = deadLetterQueue;
    }
    listEventEntries() {
        return Object.values(EVENT_SCHEMA_REGISTRY).map((schema) => ({
            eventType: schema.type,
            namespace: schema.type.split(":")[0] ?? "unknown",
            tier: schema.tier,
            producer: schema.producer,
            consumers: [...schema.consumers],
            ackRequired: schema.tier === "tier_1",
            replayRequired: schema.tier === "tier_1",
            dlqEligible: schema.tier !== "tier_3",
            payloadSchemaRef: schema.payloadSchemaRef,
        }));
    }
    listNamespaceInventory() {
        const groups = new Map();
        for (const entry of this.listEventEntries()) {
            const bucket = groups.get(entry.namespace) ?? [];
            bucket.push(entry);
            groups.set(entry.namespace, bucket);
        }
        return [...groups.entries()]
            .map(([namespace, entries]) => ({
            namespace,
            totalEvents: entries.length,
            tierCounts: entries.reduce((counts, entry) => {
                counts[entry.tier] += 1;
                return counts;
            }, { tier_1: 0, tier_2: 0, tier_3: 0 }),
            producers: [...new Set(entries.map((entry) => entry.producer))].sort(),
            consumers: [...new Set(entries.flatMap((entry) => entry.consumers))].sort(),
            ackRequiredEvents: entries.filter((entry) => entry.ackRequired).map((entry) => entry.eventType).sort(),
            replayRequiredEvents: entries.filter((entry) => entry.replayRequired).map((entry) => entry.eventType).sort(),
            dlqEligibleEvents: entries.filter((entry) => entry.dlqEligible).map((entry) => entry.eventType).sort(),
        }))
            .sort((left, right) => left.namespace.localeCompare(right.namespace));
    }
    listConsumerSurfaces() {
        const entries = this.listEventEntries();
        const actualConsumerIds = new Set(entries.flatMap((entry) => entry.consumers));
        const expected = new Map(EXPECTED_CONSUMER_SURFACES.map((item) => [item.consumerId, item]));
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
    buildReport() {
        const entries = this.listEventEntries();
        return {
            totalEvents: entries.length,
            tierCounts: entries.reduce((counts, entry) => {
                counts[entry.tier] += 1;
                return counts;
            }, { tier_1: 0, tier_2: 0, tier_3: 0 }),
            namespaces: this.listNamespaceInventory(),
            consumerSurfaces: this.listConsumerSurfaces(),
            tier1EventsMissingConsumers: entries.filter((entry) => entry.tier === "tier_1" && entry.consumers.length === 0).map((entry) => entry.eventType),
            dlqSummary: this.deadLetterQueue?.summarize() ?? null,
        };
    }
}
//# sourceMappingURL=event-reliability-inventory-service.js.map