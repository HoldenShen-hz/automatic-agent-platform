interface HistogramSeries {
    labels: Record<string, string>;
    buckets: readonly number[];
    bucketCounts: number[];
    count: number;
    sum: number;
}
interface CounterSeries {
    labels: Record<string, string>;
    value: number;
}
interface GaugeSeries {
    labels: Record<string, string>;
    value: number;
}
export declare class RuntimeMetricsRegistry {
    private readonly counters;
    private readonly gauges;
    private readonly histograms;
    incrementCounter(name: string, labels: Record<string, string | number | boolean | null | undefined>, delta?: number): void;
    setGauge(name: string, labels: Record<string, string | number | boolean | null | undefined>, value: number): void;
    observeHistogram(name: string, labels: Record<string, string | number | boolean | null | undefined>, value: number, buckets?: readonly number[]): void;
    recordHttpRequest(method: string, path: string, status: number, durationMs: number | null): void;
    recordOapeflirStage(stage: string, result: string, durationMs: number): void;
    recordOapeflirStageEntry(stage: string): void;
    recordOapeflirStageExit(stage: string, result: string, durationSeconds: number): void;
    recordLlmLatency(ttfbSeconds: number, totalSeconds: number, model: string, provider: string): void;
    recordKnowledgeQuery(operation: string, durationMs: number, result: string): void;
    getCounters(name: string): CounterSeries[];
    getGauges(name: string): GaugeSeries[];
    getHistograms(name: string): HistogramSeries[];
    reset(): void;
}
export declare const runtimeMetricsRegistry: RuntimeMetricsRegistry;
export {};
