import type { FeedbackBatch, LearningSignal } from "./feedback-model.js";
import type { FeedbackSignal } from "../../../platform/orchestration/oapeflir/types/feedback-signal.js";
import type { TypedEventBus, TypedEventEnvelope } from "../../../platform/state-evidence/events/typed-event-bus.js";
declare const DOMAIN_EVENT_FEEDBACK_TYPES: readonly ["domain:registered", "domain:activated", "plugin:spi_registered", "plugin:activated", "plugin:error_isolated", "knowledge:chunk_indexed"];
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
export declare class DomainEventFeedbackConsumer {
    private readonly collector;
    private readonly snapshots;
    private readonly maxSignalsPerScope;
    constructor(options?: DomainEventFeedbackConsumerOptions);
    subscribe(bus: TypedEventBus, consumerId?: string): void;
    consume(envelope: TypedEventEnvelope<DomainEventFeedbackType>): DomainEventFeedbackSnapshot | null;
    getSnapshot(scopeId: string): DomainEventFeedbackSnapshot | null;
    listSnapshots(): DomainEventFeedbackSnapshot[];
    static readonly EVENT_TYPES: readonly ["domain:registered", "domain:activated", "plugin:spi_registered", "plugin:activated", "plugin:error_isolated", "knowledge:chunk_indexed"];
    private translate;
    private scopeFor;
    private buildSignal;
}
export {};
