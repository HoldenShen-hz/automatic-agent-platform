import { newId } from "../../../platform/contracts/types/ids.js";
import type { FeedbackBatch, LearningSignal } from "./feedback-model.js";
import { FeedbackCollector } from "./feedback-collector.js";
import type { FeedbackSignal } from "../../../platform/orchestration/oapeflir/types/feedback-signal.js";
import type { TypedEventBus, TypedEventEnvelope } from "../../../platform/state-evidence/events/typed-event-bus.js";
import type {
  DomainLifecyclePayload,
  KnowledgeChunkIndexedPayload,
  PluginLifecycleEventPayload,
} from "../../../platform/state-evidence/events/typed-event-payloads.js";

const DOMAIN_EVENT_FEEDBACK_TYPES = [
  "domain:registered",
  "domain:activated",
  "plugin:spi_registered",
  "plugin:activated",
  "plugin:error_isolated",
  "knowledge:chunk_indexed",
] as const;

export type DomainEventFeedbackType = (typeof DOMAIN_EVENT_FEEDBACK_TYPES)[number];

export interface DomainEventFeedbackSnapshot {
  scopeId: string;
  sourceEventId: string;
  sourceEventType: DomainEventFeedbackType;
  feedback: FeedbackBatch;
  learningSignals: LearningSignal[];
  recentSignals: FeedbackSignal[];
}

export interface DomainEventFeedbackConsumerOptions {
  maxSignalsPerScope?: number;
}

function buildSyntheticTaskId(scopeId: string): string {
  return `event_feedback:${scopeId}`;
}

function inferTimeout(payload: { reasonCode?: string | null; errorMessage?: string | null }): boolean {
  const reasonCode = payload.reasonCode?.toLowerCase() ?? "";
  const errorMessage = payload.errorMessage?.toLowerCase() ?? "";
  return reasonCode.includes("timeout") || errorMessage.includes("timed out") || errorMessage.includes("timeout");
}

export class DomainEventFeedbackConsumer {
  private readonly collector = new FeedbackCollector();
  private readonly snapshots = new Map<string, DomainEventFeedbackSnapshot>();
  private readonly maxSignalsPerScope: number;

  public constructor(options: DomainEventFeedbackConsumerOptions = {}) {
    this.maxSignalsPerScope = Math.max(1, options.maxSignalsPerScope ?? 8);
  }

  public subscribe(bus: TypedEventBus, consumerId = "feedback_projection"): void {
    bus.subscribe(consumerId, DOMAIN_EVENT_FEEDBACK_TYPES, async (envelope) => {
      this.consume(envelope as TypedEventEnvelope<DomainEventFeedbackType>);
    });
  }

  public consume(envelope: TypedEventEnvelope<DomainEventFeedbackType>): DomainEventFeedbackSnapshot | null {
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
    const snapshot: DomainEventFeedbackSnapshot = {
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

  public getSnapshot(scopeId: string): DomainEventFeedbackSnapshot | null {
    return this.snapshots.get(scopeId) ?? null;
  }

  public listSnapshots(): DomainEventFeedbackSnapshot[] {
    return [...this.snapshots.values()];
  }

  public static readonly EVENT_TYPES = DOMAIN_EVENT_FEEDBACK_TYPES;

  private translate(envelope: TypedEventEnvelope<DomainEventFeedbackType>): FeedbackSignal[] {
    switch (envelope.event.eventType) {
      case "domain:registered": {
        const payload = envelope.payload as DomainLifecyclePayload;
        return [this.buildSignal(envelope, `domain:${payload.domainId}`, "success", "info", {
          summary: `Registered domain ${payload.domainId}`,
          reasonCode: "domain.registered",
          status: payload.status,
          capabilityCount: payload.capabilityCount,
          pluginCount: payload.pluginCount,
        })];
      }
      case "domain:activated": {
        const payload = envelope.payload as DomainLifecyclePayload;
        return [this.buildSignal(envelope, `domain:${payload.domainId}`, "success", "info", {
          summary: `Activated domain ${payload.domainId}`,
          reasonCode: "domain.activated",
          status: payload.status,
          capabilityCount: payload.capabilityCount,
          pluginCount: payload.pluginCount,
        })];
      }
      case "plugin:spi_registered": {
        const payload = envelope.payload as PluginLifecycleEventPayload;
        return [this.buildSignal(envelope, `plugin:${payload.pluginId}`, "success", "info", {
          summary: `Registered plugin ${payload.pluginId}`,
          reasonCode: "plugin.spi_registered",
          spiType: payload.spiType,
          lifecycleState: payload.lifecycleState,
        })];
      }
      case "plugin:activated": {
        const payload = envelope.payload as PluginLifecycleEventPayload;
        return [this.buildSignal(envelope, `plugin:${payload.pluginId}`, "success", "info", {
          summary: `Activated plugin ${payload.pluginId}`,
          reasonCode: "plugin.activated",
          spiType: payload.spiType,
          lifecycleState: payload.lifecycleState,
          bindingId: payload.bindingId ?? null,
        })];
      }
      case "plugin:error_isolated": {
        const payload = envelope.payload as PluginLifecycleEventPayload;
        return [this.buildSignal(
          envelope,
          `plugin:${payload.pluginId}`,
          inferTimeout(payload) ? "timeout" : "failure",
          payload.lifecycleState === "disabled" ? "critical" : "error",
          {
            summary: payload.errorMessage ?? `Isolated plugin error for ${payload.pluginId}`,
            reasonCode: payload.reasonCode ?? "plugin.error_isolated",
            spiType: payload.spiType,
            lifecycleState: payload.lifecycleState,
            bindingId: payload.bindingId ?? null,
            errorMessage: payload.errorMessage ?? null,
          },
        )];
      }
      case "knowledge:chunk_indexed": {
        const payload = envelope.payload as KnowledgeChunkIndexedPayload;
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

  private scopeFor(envelope: TypedEventEnvelope<DomainEventFeedbackType>): string {
    switch (envelope.event.eventType) {
      case "domain:registered":
      case "domain:activated":
        return `domain:${(envelope.payload as DomainLifecyclePayload).domainId}`;
      case "plugin:spi_registered":
      case "plugin:activated":
      case "plugin:error_isolated":
        return `plugin:${(envelope.payload as PluginLifecycleEventPayload).pluginId}`;
      case "knowledge:chunk_indexed":
        return `knowledge:${(envelope.payload as KnowledgeChunkIndexedPayload).chunkId}`;
      default:
        return `event:${envelope.event.id}`;
    }
  }

  private buildSignal(
    envelope: TypedEventEnvelope<DomainEventFeedbackType>,
    stepOutputRef: string,
    category: FeedbackSignal["category"],
    severity: FeedbackSignal["severity"],
    payload: Record<string, unknown>,
  ): FeedbackSignal {
    const signalId = newId("signal");
    return {
      signalId,
      taskId: buildSyntheticTaskId(this.scopeFor(envelope)),
      source: "system",
      category,
      severity,
      payload,
      stepOutputRefs: [stepOutputRef],
      timestamp: Date.parse(envelope.event.createdAt),
      trustScore: {
        overallScore: 0.5,
        sourceReliability: 0.7,
        historicalAccuracy: 0.5,
        adversarialRisk: "low",
        passedSanityCheck: true,
      },
      evidenceRefs: [signalId],
    };
  }
}
