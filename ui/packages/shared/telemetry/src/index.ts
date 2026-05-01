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
  // Dynamically import web-vitals to avoid blocking the initial render
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onReady = (metric: WebVitalsMetric) => {
    if (!reportAll) {
      onMetric(metric);
    }
  };

  // We use dynamic import so the module can be loaded lazily
  // and does not block the main thread during initial render
  let cleanup: (() => void) | undefined;

  import("web-vitals").then((vl) => {
    const onLCP = (metric: WebVitalsMetric) => onMetric(metric);
    const onFCP = (metric: WebVitalsMetric) => onMetric(metric);
    const onCLS = (metric: WebVitalsMetric) => onMetric(metric);
    const onINP = (metric: WebVitalsMetric) => onMetric(metric);

    void vl.onLCP(onLCP, { reportAll });
    void vl.onFCP(onFCP, { reportAll });
    void vl.onCLS(onCLS, { reportAll });
    void vl.onINP(onINP, { reportAll });

    cleanup = () => {
      void vl.onLCP(() => {});
      void vl.onFCP(() => {});
      void vl.onCLS(() => {});
      void vl.onINP(() => {});
    };
  }).catch(() => {
    // web-vitals not available in non-browser environments
  });

  return () => {
    if (cleanup) {
      cleanup();
    }
  };
}

/** Flush interval in milliseconds per §7.3 */
const DEFAULT_FLUSH_INTERVAL_MS = 5000;
/** Maximum buffer size before forced flush */
const DEFAULT_MAX_BUFFER_SIZE = 100;

export class TelemetrySink {
  private readonly events: TelemetryEvent[] = [];
  private readonly flushIntervalMs: number;
  private readonly maxBufferSize: number;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly exporters: readonly TelemetryExporter[];
  private readonly consentChecker: (() => boolean) | null;

  public constructor(
    exporters: readonly TelemetryExporter[] = [],
    options: {
      flushIntervalMs?: number;
      maxBufferSize?: number;
      consentChecker?: () => boolean;
    } = {},
  ) {
    this.exporters = exporters;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxBufferSize = options.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;
    this.consentChecker = options.consentChecker ?? null;
    this.startFlushTimer();
  }

  /**
   * Records a telemetry event with batching and analytics consent check per §7.3.
   * Events are buffered and flushed periodically or when buffer is full.
   */
  public record(name: string, attributes: Readonly<Record<string, unknown>> = {}): void {
    // §6.5.5+GDPR: Check analytics consent before recording
    if (this.consentChecker !== null && !this.consentChecker()) {
      return;
    }

    const event = {
      name,
      attributes,
      recordedAt: new Date().toISOString(),
    };
    this.events.push(event);

    // Force flush if buffer is full
    if (this.events.length >= this.maxBufferSize) {
      void this.flush();
    }
  }

  public list(): readonly TelemetryEvent[] {
    return this.events;
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

    await Promise.all(this.exporters.map(async (exporter) => {
      try {
        await exporter.export(toExport);
      } catch (error) {
        // Re-queue events on export failure
        this.events.unshift(...toExport);
        console.error("[TelemetrySink] Export failed, events re-queued:", error);
      }
    }));
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
    consentChecker?: () => boolean;
  } = {},
): TelemetrySink {
  return new TelemetrySink(exporters, options);
}
