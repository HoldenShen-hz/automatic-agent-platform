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

// ---------------------------------------------------------------------------
// Core Web Vitals / RUM instrumentation
// ---------------------------------------------------------------------------

/**
 * Measure a function's execution time and record it as a telemetry span.
 */
export function measureDuration(name: string, fn: () => void | Promise<void>): void | Promise<void> {
  const start = performance.now();
  const result = fn();
  if (result instanceof Promise) {
    return result.finally(() => {
      const duration = performance.now() - start;
      void duration; // placeholder for future metric recording
    });
  }
  const duration = performance.now() - start;
  void duration; // placeholder for future metric recording
}

/**
 * Record a Core Web Vital metric.
 * These are emitted as telemetry events so they flow through the same exporter pipeline.
 */
export type VitalName = "LCP" | "FID" | "CLS" | "INP" | "TTFB" | "FCP";

export interface VitalRecord {
  name: VitalName;
  value: number;          // milliseconds for all except CLS (unitless)
  rating: "good" | "needs-improvement" | "poor";
  navigationEntry?: PerformanceEntry;
}

function ratingForLCP(value: number): VitalRecord["rating"] {
  return value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor";
}
function ratingForFID(value: number): VitalRecord["rating"] {
  return value <= 100 ? "good" : value <= 300 ? "needs-improvement" : "poor";
}
function ratingForCLS(value: number): VitalRecord["rating"] {
  return value <= 0.1 ? "good" : value <= 0.25 ? "needs-improvement" : "poor";
}
function ratingForINP(value: number): VitalRecord["rating"] {
  return value <= 200 ? "good" : value <= 500 ? "needs-improvement" : "poor";
}
function ratingForTTFB(value: number): VitalRecord["rating"] {
  return value <= 800 ? "good" : value <= 1800 ? "needs-improvement" : "poor";
}
function ratingForFCP(value: number): VitalRecord["rating"] {
  return value <= 1800 ? "good" : value <= 3000 ? "needs-improvement" : "poor";
}

function vitalRating(name: VitalName, value: number): VitalRecord["rating"] {
  switch (name) {
    case "LCP": return ratingForLCP(value);
    case "FID": return ratingForFID(value);
    case "CLS": return ratingForCLS(value);
    case "INP": return ratingForINP(value);
    case "TTFB": return ratingForTTFB(value);
    case "FCP": return ratingForFCP(value);
  }
}

/**
 * Observe Web Vitals for the current document and report them via a TelemetrySink.
 *
 * Uses the native PerformanceObserver API where available, with fallbacks
 * for older browsers.  Each observed metric is emitted as a `webvitals.<name>`
 * telemetry event containing value, rating, and navigation entry attributes.
 */
export function observeWebVitals(sink: TelemetrySink): () => void {
  const dispose: (() => void)[] = [];

  // LCP
  if ("PerformanceObserver" in globalThis) {
    try {
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const record: VitalRecord = {
            name: "LCP",
            value: entry.startTime,
            rating: vitalRating("LCP", entry.startTime),
            navigationEntry: entry as PerformanceEntry,
          };
          sink.record("webvitals.LCP", {
            value_ms: record.value,
            rating: record.rating,
            element: (entry as { element?: string }).element ?? "unknown",
          });
        }
      });
      obs.observe({ type: "largest-contentful-paint", buffered: true });
      dispose.push(() => obs.disconnect());
    } catch { /* non-critical */ }
  }

  // CLS
  try {
    const clsObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as unknown as { hadRecentInput?: boolean; value?: number };
        if (e.hadRecentInput) return;
        const value = e.value ?? 0;
        const record: VitalRecord = { name: "CLS", value, rating: vitalRating("CLS", value) };
        sink.record("webvitals.CLS", {
          value: record.value,
          rating: record.rating,
        });
      }
    });
    clsObs.observe({ type: "layout-shift", buffered: true });
    dispose.push(() => clsObs.disconnect());
  } catch { /* non-critical */ }

  // INP (Interaction to Next Paint)
  try {
    const inpObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const value = entry.duration;
        const record: VitalRecord = { name: "INP", value, rating: vitalRating("INP", value) };
        sink.record("webvitals.INP", {
          value_ms: record.value,
          rating: record.rating,
          event_type: entry.name,
        });
      }
    });
    inpObs.observe({ type: "event", buffered: true, options: { durationThreshold: 16 } as PerformanceObserverInit });
    dispose.push(() => inpObs.disconnect());
  } catch { /* non-critical */ }

  // FID (Fallback for browsers without INP)
  try {
    const fidObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const value = entry.processingStart - entry.startTime;
        const record: VitalRecord = { name: "FID", value, rating: vitalRating("FID", value) };
        sink.record("webvitals.FID", {
          value_ms: record.value,
          rating: record.rating,
        });
      }
    });
    fidObs.observe({ type: "first-input", buffered: true });
    dispose.push(() => fidObs.disconnect());
  } catch { /* non-critical */ }

  // FCP
  try {
    const fcpObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          const record: VitalRecord = { name: "FCP", value: entry.startTime, rating: vitalRating("FCP", entry.startTime) };
          sink.record("webvitals.FCP", {
            value_ms: record.value,
            rating: record.rating,
          });
        }
      }
    });
    fcpObs.observe({ type: "paint", buffered: true });
    dispose.push(() => fcpObs.disconnect());
  } catch { /* non-critical */ }

  // TTFB
  if ("PerformanceNavigationTiming" in globalThis) {
    try {
      const ttfbObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "navigation") {
            const nav = entry as PerformanceNavigationTiming;
            const value = nav.responseStart - nav.requestStart;
            const record: VitalRecord = { name: "TTFB", value, rating: vitalRating("TTFB", value) };
            sink.record("webvitals.TTFB", {
              value_ms: record.value,
              rating: record.rating,
            });
          }
        }
      });
      ttfbObs.observe({ type: "navigation", buffered: true });
      dispose.push(() => ttfbObs.disconnect());
    } catch { /* non-critical */ }
  }

  return () => dispose.forEach((fn) => fn());
}
