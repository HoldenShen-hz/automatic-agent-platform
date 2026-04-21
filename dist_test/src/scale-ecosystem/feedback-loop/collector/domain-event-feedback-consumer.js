import { newId } from "../../../platform/contracts/types/ids.js";
import { FeedbackCollector } from "./feedback-collector.js";
const DOMAIN_EVENT_FEEDBACK_TYPES = [
    "domain:registered",
    "domain:activated",
    "plugin:spi_registered",
    "plugin:activated",
    "plugin:error_isolated",
    "knowledge:chunk_indexed",
];
function buildSyntheticTaskId(scopeId) {
    return `event_feedback:${scopeId}`;
}
function inferTimeout(payload) {
    const reasonCode = payload.reasonCode?.toLowerCase() ?? "";
    const errorMessage = payload.errorMessage?.toLowerCase() ?? "";
    return reasonCode.includes("timeout") || errorMessage.includes("timed out") || errorMessage.includes("timeout");
}
export class DomainEventFeedbackConsumer {
    collector = new FeedbackCollector();
    snapshots = new Map();
    maxSignalsPerScope;
    constructor(options = {}) {
        this.maxSignalsPerScope = Math.max(1, options.maxSignalsPerScope ?? 8);
    }
    subscribe(bus, consumerId = "feedback_projection") {
        bus.subscribe(consumerId, DOMAIN_EVENT_FEEDBACK_TYPES, async (envelope) => {
            this.consume(envelope);
        });
    }
    consume(envelope) {
        const translated = this.translate(envelope);
        if (translated.length === 0) {
            return null;
        }
        const scopeId = this.scopeFor(envelope);
        const existing = this.snapshots.get(scopeId);
        const recentSignals = [...(existing?.recentSignals ?? []), ...translated].slice(-this.maxSignalsPerScope);
        const feedback = this.collector.collect({
            taskId: buildSyntheticTaskId(scopeId),
            executionId: envelope.event.executionId,
            signals: recentSignals,
        });
        const learningSignals = this.collector.toLearningSignals(feedback);
        const snapshot = {
            scopeId,
            sourceEventId: envelope.event.id,
            sourceEventType: envelope.event.eventType,
            feedback,
            learningSignals,
            recentSignals,
        };
        this.snapshots.set(scopeId, snapshot);
        return snapshot;
    }
    getSnapshot(scopeId) {
        return this.snapshots.get(scopeId) ?? null;
    }
    listSnapshots() {
        return [...this.snapshots.values()];
    }
    static EVENT_TYPES = DOMAIN_EVENT_FEEDBACK_TYPES;
    translate(envelope) {
        switch (envelope.event.eventType) {
            case "domain:registered": {
                const payload = envelope.payload;
                return [this.buildSignal(envelope, `domain:${payload.domainId}`, "success", "info", {
                        summary: `Registered domain ${payload.domainId}`,
                        reasonCode: "domain.registered",
                        status: payload.status,
                        capabilityCount: payload.capabilityCount,
                        pluginCount: payload.pluginCount,
                    })];
            }
            case "domain:activated": {
                const payload = envelope.payload;
                return [this.buildSignal(envelope, `domain:${payload.domainId}`, "success", "info", {
                        summary: `Activated domain ${payload.domainId}`,
                        reasonCode: "domain.activated",
                        status: payload.status,
                        capabilityCount: payload.capabilityCount,
                        pluginCount: payload.pluginCount,
                    })];
            }
            case "plugin:spi_registered": {
                const payload = envelope.payload;
                return [this.buildSignal(envelope, `plugin:${payload.pluginId}`, "success", "info", {
                        summary: `Registered plugin ${payload.pluginId}`,
                        reasonCode: "plugin.spi_registered",
                        spiType: payload.spiType,
                        lifecycleState: payload.lifecycleState,
                    })];
            }
            case "plugin:activated": {
                const payload = envelope.payload;
                return [this.buildSignal(envelope, `plugin:${payload.pluginId}`, "success", "info", {
                        summary: `Activated plugin ${payload.pluginId}`,
                        reasonCode: "plugin.activated",
                        spiType: payload.spiType,
                        lifecycleState: payload.lifecycleState,
                        bindingId: payload.bindingId ?? null,
                    })];
            }
            case "plugin:error_isolated": {
                const payload = envelope.payload;
                return [this.buildSignal(envelope, `plugin:${payload.pluginId}`, inferTimeout(payload) ? "timeout" : "failure", payload.lifecycleState === "disabled" ? "critical" : "error", {
                        summary: payload.errorMessage ?? `Isolated plugin error for ${payload.pluginId}`,
                        reasonCode: payload.reasonCode ?? "plugin.error_isolated",
                        spiType: payload.spiType,
                        lifecycleState: payload.lifecycleState,
                        bindingId: payload.bindingId ?? null,
                        errorMessage: payload.errorMessage ?? null,
                    })];
            }
            case "knowledge:chunk_indexed": {
                const payload = envelope.payload;
                return [this.buildSignal(envelope, `knowledge:${payload.chunkId}`, "success", "info", {
                        summary: `Indexed knowledge chunk ${payload.chunkId}`,
                        reasonCode: "knowledge.chunk_indexed",
                        namespace: payload.namespace,
                        trustLevel: payload.trustLevel,
                        keywordCount: payload.keywordCount,
                        relationCount: payload.relationCount,
                        documentId: payload.documentId,
                    })];
            }
            default:
                return [];
        }
    }
    scopeFor(envelope) {
        switch (envelope.event.eventType) {
            case "domain:registered":
            case "domain:activated":
                return `domain:${envelope.payload.domainId}`;
            case "plugin:spi_registered":
            case "plugin:activated":
            case "plugin:error_isolated":
                return `plugin:${envelope.payload.pluginId}`;
            case "knowledge:chunk_indexed":
                return `knowledge:${envelope.payload.chunkId}`;
            default:
                return `event:${envelope.event.id}`;
        }
    }
    buildSignal(envelope, stepOutputRef, category, severity, payload) {
        return {
            signalId: newId("signal"),
            taskId: buildSyntheticTaskId(this.scopeFor(envelope)),
            source: "system",
            category,
            severity,
            payload,
            stepOutputRefs: [stepOutputRef],
            timestamp: Date.parse(envelope.event.createdAt),
        };
    }
}
//# sourceMappingURL=domain-event-feedback-consumer.js.map