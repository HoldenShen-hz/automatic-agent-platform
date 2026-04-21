import type { TraceContext } from "../../contracts/types/domain.js";
import { TypedEventBus, type TypedEventPayloadMap, type TypedEventType } from "./typed-event-bus.js";
export interface TypedEventPublisher {
    publish<TType extends TypedEventType>(input: {
        eventType: TType;
        taskId?: string | null;
        sessionId?: string | null;
        executionId?: string | null;
        traceId?: string | null;
        traceContext?: TraceContext | null;
        payload: TypedEventPayloadMap[TType];
    }): void;
}
export declare class TypedEventBusPublisher implements TypedEventPublisher {
    private readonly bus;
    constructor(bus: TypedEventBus);
    publish<TType extends TypedEventType>(input: {
        eventType: TType;
        taskId?: string | null;
        sessionId?: string | null;
        executionId?: string | null;
        traceId?: string | null;
        traceContext?: TraceContext | null;
        payload: TypedEventPayloadMap[TType];
    }): void;
}
