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

export interface TelemetryDeadLetter {
  readonly event: TelemetryEvent;
  readonly exporterNames: readonly string[];
  readonly failedAt: string;
  readonly reason: string;
}

/**
 * Core Web Vitals metric names per §7.3.
 * - LCP: Largest Contentful Paint (target < 2.5s)
 * - FCP: First Contentful Paint (target < 1.8s)
 * - CLS: Cumulative Layout Shift (target < 0.1)
 * - INP: Interaction to Next Paint (target < 200ms)
 */
export interface CoreWebVitals {
  readonly lcp: number | null;
  readonly fcp: number | null;
  readonly cls: number | null;
  readonly inp: number | null;
}

interface WebVitalsMetric {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  id: string;
  entries: unknown[];
}

interface PerformanceObserverEntryLike {
  readonly name?: string;
  readonly startTime: number;
  readonly value?: number;
  readonly hadRecentInput?: boolean;
  readonly duration?: number;
  readonly interactionId?: number;
  readonly entryType?: string;
}

function inferRating(name: "FCP" | "LCP" | "CLS" | "INP", value: number): "good" | "needs-improvement" | "poor" {
  if (name === "CLS") {
    if (value <= 0.1) return "good";
    if (value <= 0.25) return "needs-improvement";
    return "poor";
  }
  if (name === "FCP") {
    if (value <= 1800) return "good";
    if (value <= 3000) return "needs-improvement";
    return "poor";
  }
  if (name === "LCP") {
    if (value <= 2500) return "good";
    if (value <= 4000) return "needs-improvement";
    return "poor";
  }
  if (value <= 200) return "good";
  if (value <= 500) return "needs-improvement";
  return "poor";
}

/**
 * Starts Web Vitals collection using the web-vitals library.
 * Reports LCP, FCP, CLS, and INP to the provided TelemetrySink.
 *
 * @param sink - TelemetrySink to record Core Web Vitals events to
 * @param reportAll - if true, reports every metric; if false, only reports on final value (default: true)
 * @returns stop function - call to remove event listeners
 */
export function startWebVitalsCollection(
  sink: TelemetrySink,
  reportAll = true,
): () => void {
  const onMetric = (metric: WebVitalsMetric) => {
    sink.record(`web_vitals.${metric.name}`, {
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entries: (metric.entries as any[]).map((e) => ({ type: e?.constructor?.name ?? "unknown" })),
    });
  };

  const observerCtor = globalThis.PerformanceObserver;
  const supportedTypes = observerCtor?.supportedEntryTypes ?? [];
  if (observerCtor == null || supportedTypes.length === 0) {
    return () => undefined;
  }

  const observers: PerformanceObserver[] = [];
  const latestValues = new Map<string, number>();
  let cumulativeCls = 0;

  const emitMetric = (
    name: "FCP" | "LCP" | "CLS" | "INP",
    value: number,
    entry: PerformanceObserverEntryLike,
  ): void => {
    const previousValue = latestValues.get(name) ?? 0;
    latestValues.set(name, value);
    onMetric({
      name,
      value,
      rating: inferRating(name, value),
      delta: value - previousValue,
      id: `${name.toLowerCase()}-${Math.round(value)}`,
      entries: [entry],
    });
  };

  const observe = (
    entryType: string,
    handleEntries: (entries: readonly PerformanceObserverEntryLike[]) => void,
  ): void => {
    if (!supportedTypes.includes(entryType)) {
      return;
    }
    const observer = new observerCtor((list) => {
      handleEntries(list.getEntries() as readonly PerformanceObserverEntryLike[]);
    });
    observer.observe({ type: entryType, buffered: true });
    observers.push(observer);
  };

  observe("paint", (entries) => {
    for (const entry of entries) {
      if (entry.name === "first-contentful-paint") {
        emitMetric("FCP", entry.startTime, entry);
      }
    }
  });

  observe("largest-contentful-paint", (entries) => {
    const latest = entries[entries.length - 1];
    if (latest != null) {
      emitMetric("LCP", latest.startTime, latest);
    }
  });

  observe("layout-shift", (entries) => {
    for (const entry of entries) {
      if (entry.hadRecentInput === true) {
        continue;
      }
      cumulativeCls += entry.value ?? 0;
      emitMetric("CLS", cumulativeCls, entry);
      if (!reportAll) {
        break;
      }
    }
  });

  observe("event", (entries) => {
    const interactionEntries = entries.filter((entry) => (entry.interactionId ?? 0) > 0);
    if (interactionEntries.length === 0) {
      return;
    }
    const slowestInteraction = interactionEntries.reduce((current, entry) => (
      (entry.duration ?? 0) > (current.duration ?? 0) ? entry : current
    ));
    emitMetric("INP", slowestInteraction.duration ?? 0, slowestInteraction);
  });

  return () => {
    for (const observer of observers) {
      observer.disconnect();
    }
  };
}

/** Flush interval in milliseconds per §7.3 */
const DEFAULT_FLUSH_INTERVAL_MS = 5000;
/** Maximum buffer size before forced flush */
const DEFAULT_MAX_BUFFER_SIZE = 100;
/** Maximum retry attempts per exporter before dead-lettering */
const DEFAULT_MAX_RETRY_ATTEMPTS = 3;
/** Maximum dead letters retained in memory */
const DEFAULT_MAX_DEAD_LETTERS = 500;

interface QueuedTelemetryEvent {
  readonly event: TelemetryEvent;
  readonly retryCounts: number[];
  pendingExporterIndexes: number[];
}

export class TelemetrySink {
  private readonly events: QueuedTelemetryEvent[] = [];
  private readonly deadLetters: TelemetryDeadLetter[] = [];
  private readonly flushIntervalMs: number;
  private readonly maxBufferSize: number;
  private readonly maxRetryAttempts: number;
  private readonly maxDeadLetters: number;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly exporters: readonly TelemetryExporter[];
  private readonly consentChecker: (() => boolean) | null;

  public constructor(
    exporters: readonly TelemetryExporter[] = [],
    options: {
      flushIntervalMs?: number;
      maxBufferSize?: number;
      maxRetryAttempts?: number;
      maxDeadLetters?: number;
      consentChecker?: () => boolean;
    } = {},
  ) {
    this.exporters = exporters;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxBufferSize = options.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;
    this.maxRetryAttempts = options.maxRetryAttempts ?? DEFAULT_MAX_RETRY_ATTEMPTS;
    this.maxDeadLetters = options.maxDeadLetters ?? DEFAULT_MAX_DEAD_LETTERS;
    this.consentChecker = options.consentChecker ?? null;
    this.startFlushTimer();
  }

  /**
   * Records a telemetry event with batching and analytics consent check per §7.3.
   * Events are buffered and flushed periodically or when buffer is full.
   * P1 FIX: Enforce upper bound on events array to prevent unbounded memory growth.
   * Events beyond maxBufferSize are dropped (oldest events already in queue for export).
   */
  public record(name: string, attributes: Readonly<Record<string, unknown>> = {}): void {
    // §6.5.5+GDPR: Check analytics consent before recording
    if (this.consentChecker !== null && !this.consentChecker()) {
      return;
    }

    // P1 FIX: Check buffer limit before adding - if full, drop oldest event
    // This prevents unbounded memory growth in long sessions
    if (this.events.length >= this.maxBufferSize) {
      // Remove oldest event (shift) to make room for new one
      this.events.shift();
      console.warn("[TelemetrySink] Buffer full, dropping oldest event to prevent memory leak");
    }

    const event = {
      name,
      attributes,
      recordedAt: new Date().toISOString(),
    };
    this.events.push({
      event,
      retryCounts: this.exporters.map(() => 0),
      pendingExporterIndexes: this.exporters.map((_, index) => index),
    });

    // Force flush if buffer is full
    if (this.events.length >= this.maxBufferSize) {
      void this.flush();
    }
  }

  public list(): readonly TelemetryEvent[] {
    return this.events.map((entry) => entry.event);
  }

  public listDeadLetters(): readonly TelemetryDeadLetter[] {
    return [...this.deadLetters];
  }

  public scoped(scope: TelemetryScope) {
    return {
      record: (name: string, attributes: Readonly<Record<string, unknown>> = {}) => {
        this.record(`${scope.name}.${name}`, {
          ...(scope.attributes ?? {}),
          ...attributes,
        });
      },
    };
  }

  /**
   * Flushes buffered events to all exporters per §7.3.
   */
  public async flush(): Promise<void> {
    if (this.events.length === 0) {
      return;
    }

    const toExport = [...this.events];
    this.events.length = 0;

    await Promise.all(this.exporters.map(async (exporter, exporterIndex) => {
      const exporterBatch = toExport.filter((entry) => entry.pendingExporterIndexes.includes(exporterIndex));
      if (exporterBatch.length === 0) {
        return;
      }

      try {
        await exporter.export(exporterBatch.map((entry) => entry.event));
        for (const entry of exporterBatch) {
          entry.pendingExporterIndexes = entry.pendingExporterIndexes.filter((index) => index !== exporterIndex);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        for (const entry of exporterBatch) {
          entry.retryCounts[exporterIndex] = (entry.retryCounts[exporterIndex] ?? 0) + 1;
          if (entry.retryCounts[exporterIndex] > this.maxRetryAttempts) {
            this.pushDeadLetter(entry.event, [this.getExporterName(exporterIndex)], message);
            entry.pendingExporterIndexes = entry.pendingExporterIndexes.filter((index) => index !== exporterIndex);
          }
        }
        console.error("[TelemetrySink] Export failed, events retained for retry:", error);
      }
    }));

    for (const entry of toExport) {
      if (entry.pendingExporterIndexes.length > 0) {
        this.events.push(entry);
      }
    }
  }

  private startFlushTimer(): void {
    if (typeof setInterval === "undefined") {
      return;
    }
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
  }

  public dispose(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    void this.flush();
  }

  private getExporterName(exporterIndex: number): string {
    const exporter = this.exporters[exporterIndex];
    return exporter?.constructor?.name || `exporter_${exporterIndex}`;
  }

  private pushDeadLetter(event: TelemetryEvent, exporterNames: readonly string[], reason: string): void {
    this.deadLetters.push({
      event,
      exporterNames,
      failedAt: new Date().toISOString(),
      reason,
    });
    if (this.deadLetters.length > this.maxDeadLetters) {
      this.deadLetters.splice(0, this.deadLetters.length - this.maxDeadLetters);
    }
  }
}

export class InMemoryTelemetryExporter implements TelemetryExporter {
  private readonly exported: TelemetryEvent[] = [];

  public async export(events: readonly TelemetryEvent[]): Promise<void> {
    this.exported.push(...events);
  }

  public list(): readonly TelemetryEvent[] {
    return this.exported;
  }
}

/**
 * OTLP HTTP exporter per §7.3 G-1.
 * Uses correct resourceLogs[].scopeLogs[] format (not scopeMetrics[].logs).
 *
 * P1 FIX: Auth headers are required for multi-tenant isolation. The exporter
 * requires either explicit headers or VITE_OTLP_AUTH_TOKEN env var.
 */
export class OtlpHttpTelemetryExporter implements TelemetryExporter {
  private readonly authToken: string;

  public constructor(
    private readonly endpoint: string,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch.bind(globalThis),
    headers: Readonly<Record<string, string>> = {},
  ) {
    // P1 FIX: Require auth headers for multi-tenant isolation
    const authHeader = headers["authorization"] ?? headers["Authorization"];
    const envToken = typeof process !== 'undefined' && process.env?.VITE_OTLP_AUTH_TOKEN;
    this.authToken = authHeader ?? envToken ?? "";
    if (this.authToken.length === 0) {
      throw new Error("OtlpHttpTelemetryExporter requires authorization header or VITE_OTLP_AUTH_TOKEN env var for multi-tenant isolation.");
    }
  }

  public async export(events: readonly TelemetryEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    // §7.3 G-1: Correct OTLP format is resourceLogs[].scopeLogs[] not scopeMetrics[].logs
    const payload = {
      resourceLogs: [
        {
          resource: {
            attributes: [
              { key: "service.name", value: { stringValue: "automatic-agent-platform-ui" } },
            ],
          },
          scopeLogs: [
            {
              scope: {
                name: "ui-telemetry",
                attributes: [],
              },
              logRecords: events.map((event) => ({
                timeUnixNano: Date.parse(event.recordedAt) * 1_000_000,
                body: { stringValue: event.name },
                attributes: Object.entries(event.attributes).map(([k, v]) => ({
                  key: k,
                  value: typeof v === "string" ? { stringValue: v } : { intValue: String(v) },
                })),
                flags: 0,
              })),
            },
          ],
        },
      ],
    };

    await this.fetchImplementation(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": this.authToken,
      },
      body: JSON.stringify(payload),
    });
  }
}

export function createTelemetrySink(
  exporters: readonly TelemetryExporter[] = [],
  options: {
    flushIntervalMs?: number;
    maxBufferSize?: number;
    maxRetryAttempts?: number;
    maxDeadLetters?: number;
    consentChecker?: () => boolean;
  } = {},
): TelemetrySink {
  return new TelemetrySink(exporters, options);
}
