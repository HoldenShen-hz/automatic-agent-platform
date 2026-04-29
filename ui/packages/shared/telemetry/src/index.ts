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

export class TelemetrySink {
  private readonly events: TelemetryEvent[] = [];

  public constructor(private readonly exporters: readonly TelemetryExporter[] = []) {}

  public record(name: string, attributes: Readonly<Record<string, unknown>> = {}): void {
    const event = {
      name,
      attributes,
      recordedAt: new Date().toISOString(),
    };
    this.events.push(event);
    void Promise.all(this.exporters.map(async (exporter) => {
      await exporter.export([event]);
    }));
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

export class OtlpHttpTelemetryExporter implements TelemetryExporter {
  public constructor(
    private readonly endpoint: string,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly headers: Readonly<Record<string, string>> = {},
  ) {}

  public async export(events: readonly TelemetryEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    await this.fetchImplementation(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify({
        resource: { "service.name": "automatic-agent-platform-ui" },
        scopeMetrics: [
          {
            scope: { name: "ui-telemetry" },
            metrics: [],
            logs: events.map((event) => ({
              body: event.name,
              timeUnixNano: Date.parse(event.recordedAt) * 1_000_000,
              attributes: event.attributes,
            })),
          },
        ],
      }),
    });
  }
}

export function createTelemetrySink(exporters: readonly TelemetryExporter[] = []): TelemetrySink {
  return new TelemetrySink(exporters);
}
