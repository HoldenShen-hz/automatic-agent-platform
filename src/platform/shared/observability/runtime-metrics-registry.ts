const DEFAULT_HISTOGRAM_BUCKETS = [10, 50, 100, 250, 500, 1_000, 5_000];

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

function toLabelRecord(labels: Record<string, string | number | boolean | null | undefined>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(labels)) {
    if (value == null) {
      continue;
    }
    normalized[key] = String(value);
  }
  return normalized;
}

function buildSeriesKey(name: string, labels: Record<string, string>): string {
  const entries = Object.entries(labels).sort(([left], [right]) => left.localeCompare(right));
  return `${name}|${entries.map(([key, value]) => `${key}=${value}`).join("|")}`;
}

export class RuntimeMetricsRegistry {
  private readonly counters = new Map<string, CounterSeries>();
  private readonly gauges = new Map<string, GaugeSeries>();
  private readonly histograms = new Map<string, HistogramSeries>();

  public incrementCounter(
    name: string,
    labels: Record<string, string | number | boolean | null | undefined>,
    delta: number = 1,
  ): void {
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

  public setGauge(
    name: string,
    labels: Record<string, string | number | boolean | null | undefined>,
    value: number,
  ): void {
    const normalizedLabels = toLabelRecord(labels);
    const key = buildSeriesKey(name, normalizedLabels);
    this.gauges.set(key, {
      labels: normalizedLabels,
      value,
    });
  }

  public observeHistogram(
    name: string,
    labels: Record<string, string | number | boolean | null | undefined>,
    value: number,
    buckets: readonly number[] = DEFAULT_HISTOGRAM_BUCKETS,
  ): void {
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
      if (value <= series.buckets[index]!) {
        series.bucketCounts[index]! += 1;
      }
    }
  }

  public recordHttpRequest(method: string, path: string, status: number, durationMs: number | null): void {
    this.incrementCounter("http_requests_total", { method, path, status }, 1);
    if (durationMs != null && Number.isFinite(durationMs) && durationMs >= 0) {
      this.observeHistogram("http_request_duration_ms", { method, path, status }, durationMs);
    }
  }

  public recordOapeflirStage(stage: string, result: string, durationMs: number): void {
    this.observeHistogram("oapeflir_loop_duration_ms", { stage }, durationMs);
    this.incrementCounter("oapeflir_stage_outcome_total", { stage, result }, 1);
  }

  public recordOapeflirStageEntry(stage: string): void {
    this.incrementCounter("oapeflir_stage_entry_total", { stage }, 1);
  }

  public recordOapeflirStageExit(stage: string, result: string, durationSeconds: number): void {
    this.observeHistogram("stage_duration_seconds", { stage }, durationSeconds);
    this.incrementCounter("oapeflir_stage_outcome_total", { stage, result }, 1);
  }

  public recordLlmLatency(ttfbSeconds: number, totalSeconds: number, model: string, provider: string): void {
    this.observeHistogram("llm_ttfb_seconds", { model, provider }, ttfbSeconds);
    this.observeHistogram("llm_total_seconds", { model, provider }, totalSeconds);
  }

  public recordKnowledgeQuery(operation: string, durationMs: number, result: string): void {
    this.observeHistogram("knowledge_query_duration_ms", { operation }, durationMs);
    this.incrementCounter("knowledge_query_total", { operation, result }, 1);
  }

  public getCounters(name: string): CounterSeries[] {
    return [...this.counters.entries()]
      .filter(([key]) => key.startsWith(`${name}|`) || key === `${name}|`)
      .map(([, series]) => ({ labels: { ...series.labels }, value: series.value }));
  }

  public getGauges(name: string): GaugeSeries[] {
    return [...this.gauges.entries()]
      .filter(([key]) => key.startsWith(`${name}|`) || key === `${name}|`)
      .map(([, series]) => ({ labels: { ...series.labels }, value: series.value }));
  }

  public getHistograms(name: string): HistogramSeries[] {
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

  public reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

export const runtimeMetricsRegistry = new RuntimeMetricsRegistry();
