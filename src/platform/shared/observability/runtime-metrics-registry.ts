const DEFAULT_HISTOGRAM_BUCKETS = [10, 50, 100, 250, 500, 1_000, 5_000];
const METRIC_NAME_ALIASES = new Map<string, string>([
  ["http_requests_total", "platform_http_requests_total"],
  ["http_request_duration_ms", "platform_http_request_duration_ms"],
  ["redis_connection_errors", "platform_redis_connection_errors"],
  ["queue_enqueue_failures_total", "platform_queue_enqueue_failures_total"],
  ["alert_delivery_failures_total", "platform_alert_delivery_failures_total"],
  ["oapeflir_loop_duration_ms", "oapeflir_stage_duration_ms"],
  ["oapeflir_stage_duration_ms", "platform_oapeflir_stage_duration_ms"],
  ["oapeflir_stage_outcome_total", "platform_oapeflir_stage_outcome_total"],
  ["oapeflir_stage_entry_total", "platform_oapeflir_stage_entry_total"],
  ["llm_ttfb_seconds", "platform_llm_ttfb_seconds"],
  ["llm_total_seconds", "platform_llm_total_seconds"],
  ["knowledge_query_duration_ms", "platform_knowledge_query_duration_ms"],
  ["knowledge_query_total", "platform_knowledge_query_total"],
  ["harness_run_total", "platform_harness_run_total"],
  ["harness_run_duration_ms", "platform_harness_run_duration_ms"],
  ["harness_steps", "platform_harness_steps"],
  ["harness_budget_consumed_total_units", "platform_harness_budget_consumed_total_units"],
  ["harness_budget_total_units", "platform_harness_budget_total_units"],
  ["harness_budget_utilization_ratio", "platform_harness_budget_utilization_ratio"],
  ["harness_execution_latency_ms", "platform_harness_execution_latency_ms"],
  ["harness_task_started_total", "platform_harness_task_started_total"],
  ["harness_task_completed_total", "platform_harness_task_completed_total"],
  ["harness_plugin_invoked_total", "platform_harness_plugin_invoked_total"],
  ["harness_policy_decision_total", "platform_harness_policy_decision_total"],
  ["event_bus_backpressure_pending", "platform_event_bus_backpressure_pending"],
  ["event_bus_backpressure_high_water", "platform_event_bus_backpressure_high_water"],
  ["otel_runtime_available", "platform_otel_runtime_available"],
]);

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

function normalizeMetricStage(stage: string): string {
  return stage.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function normalizeMetricDimension(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function normalizeHttpPath(path: string): string {
  const sanitized = path.split("?", 1)[0] ?? "/";
  const normalized = sanitized
    .split("/")
    .map((segment) => {
      if (segment.length === 0) {
        return "";
      }
      if (/^\d+$/.test(segment) || /^[0-9a-f]{8,}$/i.test(segment) || /^[a-z]+_[A-Za-z0-9-]{6,}$/i.test(segment)) {
        return ":id";
      }
      return segment;
    })
    .join("/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function resolveMetricName(name: string): string {
  let resolved = name;
  const visited = new Set<string>();
  while (METRIC_NAME_ALIASES.has(resolved) && !visited.has(resolved)) {
    visited.add(resolved);
    resolved = METRIC_NAME_ALIASES.get(resolved) ?? resolved;
  }
  return resolved;
}

function assertValidHistogramBuckets(buckets: readonly number[]): void {
  let previous = Number.NEGATIVE_INFINITY;
  for (const bucket of buckets) {
    if (!Number.isFinite(bucket) || bucket <= previous) {
      throw new Error("runtime_metrics.histogram_buckets_invalid");
    }
    previous = bucket;
  }
}

function areHistogramBucketsEqual(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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
    const resolvedName = resolveMetricName(name);
    const normalizedLabels = toLabelRecord(labels);
    const key = buildSeriesKey(resolvedName, normalizedLabels);
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
    const resolvedName = resolveMetricName(name);
    const normalizedLabels = toLabelRecord(labels);
    const key = buildSeriesKey(resolvedName, normalizedLabels);
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
    const resolvedName = resolveMetricName(name);
    assertValidHistogramBuckets(buckets);
    const normalizedLabels = toLabelRecord(labels);
    const key = buildSeriesKey(resolvedName, normalizedLabels);
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
    } else if (!areHistogramBucketsEqual(series.buckets, buckets)) {
      throw new Error(`runtime_metrics.histogram_bucket_mismatch:${resolvedName}`);
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
    const normalizedPath = normalizeHttpPath(path);
    this.incrementCounter("http_requests_total", { method, path: normalizedPath, status }, 1);
    if (durationMs != null && Number.isFinite(durationMs) && durationMs >= 0) {
      this.observeHistogram("http_request_duration_ms", { method, path: normalizedPath, status }, durationMs);
    }
  }

  public recordOapeflirStage(stage: string, result: string, durationMs: number): void {
    this.observeHistogram("oapeflir_stage_duration_ms", { stage }, durationMs);
    this.incrementCounter("oapeflir_stage_outcome_total", { stage, result }, 1);
  }

  public recordOapeflirStageEntry(stage: string): void {
    this.incrementCounter("oapeflir_stage_entry_total", { stage }, 1);
  }

  public recordOapeflirStageExit(stage: string, result: string, durationSeconds: number): void {
    this.observeHistogram("oapeflir_stage_duration_ms", { stage, result }, durationSeconds * 1000);
  }

  public recordLlmLatency(
    ttfbSeconds: number | null | undefined,
    totalSeconds: number,
    model: string,
    provider: string,
  ): void {
    if (ttfbSeconds != null && Number.isFinite(ttfbSeconds) && ttfbSeconds >= 0) {
      this.observeHistogram("llm_ttfb_seconds", { model, provider }, ttfbSeconds);
    }
    this.observeHistogram("llm_total_seconds", { model, provider }, totalSeconds);
  }

  // §12.4 harness.* metrics - wire up missing canonical metrics

  public recordHarnessRunDuration(runId: string, durationMs: number, status: string): void {
    this.observeHistogram("harness_run_duration_ms", { status }, durationMs);
    this.incrementCounter("harness_run_total", { status }, 1);
  }

  public recordHarnessStepCount(stepCount: number): void {
    this.setGauge("harness_steps", {}, stepCount);
  }

  public recordHarnessBudgetConsumed(consumedUnits: number, totalUnits: number): void {
    this.observeHistogram("harness_budget_consumed_total_units", {}, consumedUnits);
    this.setGauge("harness_budget_total_units", {}, totalUnits);
    const utilizationRatio = totalUnits > 0 ? consumedUnits / totalUnits : 0;
    this.setGauge("harness_budget_utilization_ratio", {}, utilizationRatio);
  }

  public recordHarnessExecutionLatency(latencyMs: number): void {
    this.observeHistogram("harness_execution_latency_ms", {}, latencyMs);
  }

  public recordHarnessTaskStarted(runId: string, taskId: string): void {
    this.incrementCounter("harness_task_started_total", {}, 1);
  }

  public recordHarnessTaskCompleted(runId: string, taskId: string, status: string): void {
    this.incrementCounter("harness_task_completed_total", { status }, 1);
  }

  public recordHarnessPluginInvoked(runId: string, pluginId: string, success: boolean): void {
    this.incrementCounter("harness_plugin_invoked_total", { result: success ? "success" : "failure" }, 1);
  }

  public recordHarnessPolicyDecision(runId: string, policyType: string, outcome: string): void {
    this.incrementCounter("harness_policy_decision_total", { policyType: normalizeMetricDimension(policyType), outcome }, 1);
  }

  public recordKnowledgeQuery(operation: string, durationMs: number, result: string): void {
    this.observeHistogram("knowledge_query_duration_ms", { operation }, durationMs);
    this.incrementCounter("knowledge_query_total", { operation, result }, 1);
  }

  public recordEventBackpressure(consumerId: string, pendingCount: number, isHighWaterMark: boolean): void {
    this.setGauge("event_bus_backpressure_pending", { consumer: normalizeMetricDimension(consumerId.split(":", 1)[0] ?? "unknown") }, pendingCount);
    this.setGauge("event_bus_backpressure_high_water", { consumer: normalizeMetricDimension(consumerId.split(":", 1)[0] ?? "unknown") }, isHighWaterMark ? 1 : 0);
  }

  public getCounters(name: string): CounterSeries[] {
    const resolvedName = resolveMetricName(name);
    return [...this.counters.entries()]
      .filter(([key]) => getMetricNameFromSeriesKey(key) === resolvedName)
      .map(([, series]) => ({ labels: { ...series.labels }, value: series.value }));
  }

  public listCounterNames(): string[] {
    return [...new Set([...this.counters.keys()].map((key) => key.split("|", 1)[0] ?? ""))].filter(Boolean).sort();
  }

  public getGauges(name: string): GaugeSeries[] {
    const resolvedName = resolveMetricName(name);
    return [...this.gauges.entries()]
      .filter(([key]) => getMetricNameFromSeriesKey(key) === resolvedName)
      .map(([, series]) => ({ labels: { ...series.labels }, value: series.value }));
  }

  public listGaugeNames(): string[] {
    return [...new Set([...this.gauges.keys()].map((key) => key.split("|", 1)[0] ?? ""))].filter(Boolean).sort();
  }

  public getHistograms(name: string): HistogramSeries[] {
    const resolvedName = resolveMetricName(name);
    return [...this.histograms.entries()]
      .filter(([key]) => getMetricNameFromSeriesKey(key) === resolvedName)
      .map(([, series]) => ({
        labels: { ...series.labels },
        buckets: [...series.buckets],
        bucketCounts: [...series.bucketCounts],
        count: series.count,
        sum: series.sum,
      }));
  }

  public listHistogramNames(): string[] {
    return [...new Set([...this.histograms.keys()].map((key) => key.split("|", 1)[0] ?? ""))].filter(Boolean).sort();
  }

  public reset(metricNames?: readonly string[]): void {
    if (metricNames == null || metricNames.length === 0) {
      this.counters.clear();
      this.gauges.clear();
      this.histograms.clear();
      return;
    }
    const allowed = new Set(metricNames.map((name) => resolveMetricName(name)));
    for (const key of [...this.counters.keys()]) {
      if (allowed.has(key.split("|", 1)[0] ?? "")) {
        this.counters.delete(key);
      }
    }
    for (const key of [...this.gauges.keys()]) {
      if (allowed.has(key.split("|", 1)[0] ?? "")) {
        this.gauges.delete(key);
      }
    }
    for (const key of [...this.histograms.keys()]) {
      if (allowed.has(key.split("|", 1)[0] ?? "")) {
        this.histograms.delete(key);
      }
    }
  }
}

let globalRuntimeMetricsRegistry: RuntimeMetricsRegistry | null = null;

export function getRuntimeMetricsRegistry(): RuntimeMetricsRegistry {
  globalRuntimeMetricsRegistry ??= new RuntimeMetricsRegistry();
  return globalRuntimeMetricsRegistry;
}

export function isRuntimeMetricsRegistryInitialized(): boolean {
  return globalRuntimeMetricsRegistry != null;
}

export function resetGlobalRuntimeMetricsRegistry(): void {
  globalRuntimeMetricsRegistry = null;
}

export const runtimeMetricsRegistry: RuntimeMetricsRegistry = Object.assign(
  Object.create(RuntimeMetricsRegistry.prototype) as RuntimeMetricsRegistry,
  {
  incrementCounter(name: string, labels: Record<string, string | number | boolean | null | undefined>, delta?: number): void {
    getRuntimeMetricsRegistry().incrementCounter(name, labels, delta);
  },
  setGauge(name: string, labels: Record<string, string | number | boolean | null | undefined>, value: number): void {
    getRuntimeMetricsRegistry().setGauge(name, labels, value);
  },
  observeHistogram(
    name: string,
    labels: Record<string, string | number | boolean | null | undefined>,
    value: number,
    buckets?: readonly number[],
  ): void {
    getRuntimeMetricsRegistry().observeHistogram(name, labels, value, buckets);
  },
  recordHttpRequest(method: string, path: string, status: number, durationMs: number | null): void {
    getRuntimeMetricsRegistry().recordHttpRequest(method, path, status, durationMs);
  },
  recordOapeflirStage(stage: string, result: string, durationMs: number): void {
    getRuntimeMetricsRegistry().recordOapeflirStage(stage, result, durationMs);
  },
  recordOapeflirStageEntry(stage: string): void {
    getRuntimeMetricsRegistry().recordOapeflirStageEntry(stage);
  },
  recordOapeflirStageExit(stage: string, result: string, durationSeconds: number): void {
    getRuntimeMetricsRegistry().recordOapeflirStageExit(stage, result, durationSeconds);
  },
  recordLlmLatency(ttfbSeconds: number | null | undefined, totalSeconds: number, model: string, provider: string): void {
    getRuntimeMetricsRegistry().recordLlmLatency(ttfbSeconds, totalSeconds, model, provider);
  },
  recordHarnessRunDuration(runId: string, durationMs: number, status: string): void {
    getRuntimeMetricsRegistry().recordHarnessRunDuration(runId, durationMs, status);
  },
  recordHarnessStepCount(stepCount: number): void {
    getRuntimeMetricsRegistry().recordHarnessStepCount(stepCount);
  },
  recordHarnessBudgetConsumed(consumedUnits: number, totalUnits: number): void {
    getRuntimeMetricsRegistry().recordHarnessBudgetConsumed(consumedUnits, totalUnits);
  },
  recordHarnessExecutionLatency(latencyMs: number): void {
    getRuntimeMetricsRegistry().recordHarnessExecutionLatency(latencyMs);
  },
  recordHarnessTaskStarted(runId: string, taskId: string): void {
    getRuntimeMetricsRegistry().recordHarnessTaskStarted(runId, taskId);
  },
  recordHarnessTaskCompleted(runId: string, taskId: string, status: string): void {
    getRuntimeMetricsRegistry().recordHarnessTaskCompleted(runId, taskId, status);
  },
  recordHarnessPluginInvoked(runId: string, pluginId: string, success: boolean): void {
    getRuntimeMetricsRegistry().recordHarnessPluginInvoked(runId, pluginId, success);
  },
  recordHarnessPolicyDecision(runId: string, policyType: string, outcome: string): void {
    getRuntimeMetricsRegistry().recordHarnessPolicyDecision(runId, policyType, outcome);
  },
  recordKnowledgeQuery(operation: string, durationMs: number, result: string): void {
    getRuntimeMetricsRegistry().recordKnowledgeQuery(operation, durationMs, result);
  },
  recordEventBackpressure(consumerId: string, pendingCount: number, isHighWaterMark: boolean): void {
    getRuntimeMetricsRegistry().recordEventBackpressure(consumerId, pendingCount, isHighWaterMark);
  },
  getCounters(name: string): CounterSeries[] {
    return getRuntimeMetricsRegistry().getCounters(name);
  },
  listCounterNames(): string[] {
    return getRuntimeMetricsRegistry().listCounterNames();
  },
  getGauges(name: string): GaugeSeries[] {
    return getRuntimeMetricsRegistry().getGauges(name);
  },
  listGaugeNames(): string[] {
    return getRuntimeMetricsRegistry().listGaugeNames();
  },
  getHistograms(name: string): HistogramSeries[] {
    return getRuntimeMetricsRegistry().getHistograms(name);
  },
  listHistogramNames(): string[] {
    return getRuntimeMetricsRegistry().listHistogramNames();
  },
  reset(metricNames?: readonly string[]): void {
    getRuntimeMetricsRegistry().reset(metricNames);
  },
});

function getMetricNameFromSeriesKey(seriesKey: string): string {
  return seriesKey.split("|", 1)[0] ?? "";
}
