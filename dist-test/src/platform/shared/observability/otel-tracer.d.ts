import type { TraceContext } from "../../contracts/types/domain.js";
export interface ActiveTelemetryContext {
    traceId: string;
    spanId: string;
    parentSpanId: string | null;
}
export interface TelemetrySpanLike {
    end(): void;
    recordException(error: unknown): void;
    setAttribute(key: string, value: unknown): void;
    setAttributes?(attributes: Record<string, unknown>): void;
    setStatus(status: {
        code: number;
        message?: string;
    }): void;
    spanContext(): {
        traceId: string;
        spanId: string;
    };
}
export declare function generateTraceId(): string;
export declare function generateSpanId(): string;
export declare function isValidTraceId(value: string | null | undefined): value is string;
export declare function isValidSpanId(value: string | null | undefined): value is string;
export declare function getActiveTelemetryContext(): ActiveTelemetryContext | null;
export declare function startActiveSpan<T>(name: string, options: {
    attributes?: Record<string, unknown>;
    tracerName?: string;
    parentContext?: Pick<TraceContext, "traceId" | "spanId"> | ActiveTelemetryContext | null;
} | undefined, callback: (span: TelemetrySpanLike, context: ActiveTelemetryContext) => Promise<T> | T): Promise<T>;
