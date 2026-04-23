const DEFAULT_HISTOGRAM_BUCKETS = [10, 50, 100, 250, 500, 1_000, 5_000];
function toLabelRecord(labels) {
    const normalized = {};
    for (const [key, value] of Object.entries(labels)) {
        if (value == null) {
            continue;
        }
        normalized[key] = String(value);
    }
    return normalized;
}
function buildSeriesKey(name, labels) {
    const entries = Object.entries(labels).sort(([left], [right]) => left.localeCompare(right));
    return `${name}|${entries.map(([key, value]) => `${key}=${value}`).join("|")}`;
}
export class RuntimeMetricsRegistry {
    counters = new Map();
    gauges = new Map();
    histograms = new Map();
    incrementCounter(name, labels, delta = 1) {
        const normalizedLabels = toLabelRecord(labels);
        const key = buildSeriesKey(name, normalizedLabels);
        const series = this.counters.get(key);
        if (series) {
            series.value += delta;
            return;
        }
        this.counters.set(key, {
            labels: normalizedLabels,
            value: delta,
        });
    }
    setGauge(name, labels, value) {
        const normalizedLabels = toLabelRecord(labels);
        const key = buildSeriesKey(name, normalizedLabels);
        this.gauges.set(key, {
            labels: normalizedLabels,
            value,
        });
    }
    observeHistogram(name, labels, value, buckets = DEFAULT_HISTOGRAM_BUCKETS) {
        const normalizedLabels = toLabelRecord(labels);
        const key = buildSeriesKey(name, normalizedLabels);
        let series = this.histograms.get(key);
        if (!series) {
            series = {
                labels: normalizedLabels,
                buckets,
                bucketCounts: new Array(buckets.length).fill(0),
                count: 0,
                sum: 0,
            };
            this.histograms.set(key, series);
        }
        series.count += 1;
        series.sum += value;
        for (let index = 0; index < series.buckets.length; index += 1) {
            if (value <= series.buckets[index]) {
                series.bucketCounts[index] += 1;
            }
        }
    }
    recordHttpRequest(method, path, status, durationMs) {
        this.incrementCounter("http_requests_total", { method, path, status }, 1);
        if (durationMs != null && Number.isFinite(durationMs) && durationMs >= 0) {
            this.observeHistogram("http_request_duration_ms", { method, path, status }, durationMs);
        }
    }
    recordOapeflirStage(stage, result, durationMs) {
        this.observeHistogram("oapeflir_loop_duration_ms", { stage }, durationMs);
        this.incrementCounter("oapeflir_stage_outcome_total", { stage, result }, 1);
    }
    recordOapeflirStageEntry(stage) {
        this.incrementCounter("oapeflir_stage_entry_total", { stage }, 1);
    }
    recordOapeflirStageExit(stage, result, durationSeconds) {
        this.observeHistogram("stage_duration_seconds", { stage }, durationSeconds);
        this.incrementCounter("oapeflir_stage_outcome_total", { stage, result }, 1);
    }
    recordLlmLatency(ttfbSeconds, totalSeconds, model, provider) {
        this.observeHistogram("llm_ttfb_seconds", { model, provider }, ttfbSeconds);
        this.observeHistogram("llm_total_seconds", { model, provider }, totalSeconds);
    }
    recordKnowledgeQuery(operation, durationMs, result) {
        this.observeHistogram("knowledge_query_duration_ms", { operation }, durationMs);
        this.incrementCounter("knowledge_query_total", { operation, result }, 1);
    }
    getCounters(name) {
        return [...this.counters.entries()]
            .filter(([key]) => key.startsWith(`${name}|`) || key === `${name}|`)
            .map(([, series]) => ({ labels: { ...series.labels }, value: series.value }));
    }
    getGauges(name) {
        return [...this.gauges.entries()]
            .filter(([key]) => key.startsWith(`${name}|`) || key === `${name}|`)
            .map(([, series]) => ({ labels: { ...series.labels }, value: series.value }));
    }
    getHistograms(name) {
        return [...this.histograms.entries()]
            .filter(([key]) => key.startsWith(`${name}|`) || key === `${name}|`)
            .map(([, series]) => ({
            labels: { ...series.labels },
            buckets: [...series.buckets],
            bucketCounts: [...series.bucketCounts],
            count: series.count,
            sum: series.sum,
        }));
    }
    reset() {
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
    }
}
export const runtimeMetricsRegistry = new RuntimeMetricsRegistry();
//# sourceMappingURL=runtime-metrics-registry.js.map