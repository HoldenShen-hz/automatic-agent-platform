export interface TelemetryEvent {
    readonly name: string;
    readonly attributes: Readonly<Record<string, unknown>>;
    readonly recordedAt: string;
}
export interface TelemetryScope {
    readonly name: string;
    readonly attributes?: Readonly<Record<string, unknown>>;
}
export interface TelemetryExporter {
    export(events: readonly TelemetryEvent[]): Promise<void>;
}
export interface TelemetrySinkOptions {
    readonly consentChecker?: () => boolean;
    readonly maxBufferSize?: number;
    readonly flushIntervalMs?: number;
    readonly maxRetryAttempts?: number;
    readonly autoFlush?: boolean;
}
export interface DeadLetterTelemetryEvent {
    readonly event: TelemetryEvent;
    readonly reason: string;
    readonly failedAt: string;
}
export declare class TelemetrySink {
    private readonly exporters;
    private readonly events;
    private readonly deadLetters;
    private readonly consentChecker;
    private readonly maxBufferSize;
    private readonly maxRetryAttempts;
    private readonly autoFlush;
    private autoFlushQueued;
    private readonly flushTimer;
    private flushPromise;
    private flushingEntries;
    private disposed;
    constructor(exporters?: readonly TelemetryExporter[], options?: TelemetrySinkOptions);
    record(name: string, attributes?: Readonly<Record<string, unknown>>): void;
    list(): readonly TelemetryEvent[];
    listDeadLetters(): readonly DeadLetterTelemetryEvent[];
    scoped(scope: TelemetryScope): {
        record: (name: string, attributes?: Readonly<Record<string, unknown>>) => void;
    };
    flush(): Promise<void>;
    dispose(): Promise<void>;
    private flushInternal;
    private deliverBatch;
    private queueAutoFlush;
}
export declare class InMemoryTelemetryExporter implements TelemetryExporter {
    private readonly exported;
    export(events: readonly TelemetryEvent[]): Promise<void>;
    list(): readonly TelemetryEvent[];
}
export declare class OtlpHttpTelemetryExporter implements TelemetryExporter {
    private readonly endpoint;
    private readonly fetchImplementation;
    private readonly headers;
    private readonly timeoutMs;
    constructor(endpoint: string, fetchImplementation?: typeof fetch, headers?: Readonly<Record<string, string>>, options?: {
        readonly timeoutMs?: number;
    });
    export(events: readonly TelemetryEvent[]): Promise<void>;
}
export declare function createTelemetrySink(exporters?: readonly TelemetryExporter[]): TelemetrySink;
export declare function measureDuration(name: string, fn: () => void | Promise<void>): void | Promise<void>;
export type VitalName = "LCP" | "FID" | "CLS" | "INP" | "TTFB" | "FCP";
export interface VitalRecord {
    name: VitalName;
    value: number;
    rating: "good" | "needs-improvement" | "poor";
    navigationEntry?: PerformanceEntry;
}
export declare function startWebVitalsCollection(sink: TelemetrySink): () => void;
export declare const observeWebVitals: typeof startWebVitalsCollection;
