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

function detachTimer(timer: ReturnType<typeof setInterval>): void {
  if (typeof timer === "object" && timer !== null && "unref" in timer && typeof timer.unref === "function") {
    timer.unref();
  }
}

interface BufferedTelemetryEvent {
  readonly event: TelemetryEvent;
  readonly pendingExporters: Set<number>;
  attempts: number;
  lastError: string | null;
}

export class TelemetrySink {
  private readonly events: BufferedTelemetryEvent[] = [];
  private readonly deadLetters: DeadLetterTelemetryEvent[] = [];
  private readonly consentChecker: () => boolean;
  private readonly maxBufferSize: number;
  private readonly maxRetryAttempts: number;
  private readonly autoFlush: boolean;
  private autoFlushQueued = false;
  private readonly flushTimer: ReturnType<typeof setInterval> | null;
  private flushPromise: Promise<void> | null = null;
  private flushingEntries: BufferedTelemetryEvent[] = [];
  private disposed = false;

  public constructor(
    private readonly exporters: readonly TelemetryExporter[] = [],
    options: TelemetrySinkOptions = {},
  ) {
    this.consentChecker = options.consentChecker ?? (() => true);
    this.maxBufferSize = Math.max(1, options.maxBufferSize ?? 100);
    this.maxRetryAttempts = Math.max(0, options.maxRetryAttempts ?? 3);
    this.autoFlush = options.autoFlush ?? false;
    this.flushTimer = options.flushIntervalMs == null
      ? null
      : setInterval(() => {
        void this.flush().catch(() => undefined);
      }, options.flushIntervalMs);
    if (this.flushTimer != null) {
      detachTimer(this.flushTimer);
    }
  }

  public record(name: string, attributes: Readonly<Record<string, unknown>> = {}): void {
    if (this.disposed || !this.consentChecker()) {
      return;
    }

    this.events.push({
      event: {
        name,
        attributes,
        recordedAt: new Date().toISOString(),
      },
      pendingExporters: new Set(this.exporters.map((_exporter, index) => index)),
      attempts: 0,
      lastError: null,
    });

    if (this.exporters.length === 0 && this.events.length >= this.maxBufferSize) {
      const overflow = this.events.splice(0, this.events.length - this.maxBufferSize + 1);
      this.deadLetters.push(...overflow.map((entry) => ({
        event: entry.event,
        reason: "telemetry.buffer_overflow_no_exporter",
        failedAt: new Date().toISOString(),
      })));
      return;
    }

    if (this.events.length >= this.maxBufferSize) {
      void this.flush().catch(() => undefined);
      return;
    }

    if (this.autoFlush && this.exporters.length > 0) {
      this.queueAutoFlush();
    }
  }

  public list(): readonly TelemetryEvent[] {
    return this.events.map((entry) => entry.event);
  }

  public listDeadLetters(): readonly DeadLetterTelemetryEvent[] {
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

  public async flush(): Promise<void> {
    if (this.flushPromise != null) {
      return this.flushPromise;
    }
    this.flushPromise = this.flushInternal().finally(() => {
      this.flushPromise = null;
    });
    return this.flushPromise;
  }

  public async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    if (this.flushTimer != null) {
      clearInterval(this.flushTimer);
    }
    this.disposed = true;
    await this.flush().catch(() => undefined);
  }

  private async flushInternal(): Promise<void> {
    if ((this.events.length === 0 && this.flushingEntries.length === 0) || this.exporters.length === 0) {
      return;
    }

    while (this.events.length > 0 || this.flushingEntries.length > 0) {
      const batch = this.flushingEntries.length > 0
        ? this.flushingEntries
        : this.events.splice(0, this.events.length);
      this.flushingEntries = batch;
      const survivors = await this.deliverBatch(batch);
      this.flushingEntries = [];
      if (survivors.length > 0) {
        this.events.unshift(...survivors);
        break;
      }
    }
  }

  private async deliverBatch(batch: BufferedTelemetryEvent[]): Promise<BufferedTelemetryEvent[]> {
    const deliveries = this.exporters.map(async (exporter, exporterIndex) => {
      const pendingEntries = batch.filter((entry) => entry.pendingExporters.has(exporterIndex));
      if (pendingEntries.length === 0) {
        return;
      }
      try {
        await exporter.export(pendingEntries.map((entry) => entry.event));
        for (const entry of pendingEntries) {
          entry.pendingExporters.delete(exporterIndex);
          entry.lastError = null;
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        for (const entry of pendingEntries) {
          entry.attempts += 1;
          entry.lastError = reason;
        }
      }
    });

    await Promise.all(deliveries);

    const survivors: BufferedTelemetryEvent[] = [];
    for (const entry of batch) {
      if (entry.pendingExporters.size === 0) {
        continue;
      }
      if (entry.attempts > this.maxRetryAttempts) {
        this.deadLetters.push({
          event: entry.event,
          reason: entry.lastError ?? "telemetry.export_failed",
          failedAt: new Date().toISOString(),
        });
        continue;
      }
      survivors.push(entry);
    }
    return survivors;
  }

  private queueAutoFlush(): void {
    if (this.autoFlushQueued) {
      return;
    }
    this.autoFlushQueued = true;
    queueMicrotask(() => {
      this.autoFlushQueued = false;
      void this.flush().catch(() => undefined);
    });
  }
}

export class InMemoryTelemetryExporter implements TelemetryExporter {
  private readonly exported: TelemetryEvent[] = [];

  public async export(events: readonly TelemetryEvent[]): Promise<void> {
    this.exported.push(...events);
  }

  public list(): readonly TelemetryEvent[] {
    return [...this.exported];
  }
}

export class OtlpHttpTelemetryExporter implements TelemetryExporter {
  private readonly timeoutMs: number;

  public constructor(
    private readonly endpoint: string,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly headers: Readonly<Record<string, string>> = {},
    options: { readonly timeoutMs?: number } = {},
  ) {
    if (resolveAuthorizationHeader(this.headers).length === 0) {
      throw new Error("telemetry.authorization_required:OTLP exports requires authorization header or VITE_OTLP_AUTH_TOKEN");
    }
    this.timeoutMs = options.timeoutMs ?? 5_000;
  }

  public async export(events: readonly TelemetryEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    if (typeof timeout === "object" && "unref" in timeout && typeof timeout.unref === "function") {
      timeout.unref();
    }
    try {
      await this.fetchImplementation(this.endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          ...this.headers,
        },
        body: JSON.stringify({
          "service.name": "automatic-agent-platform-ui",
          resourceLogs: [
            {
              resource: {
                attributes: [
                  {
                    key: "service.name",
                    value: { stringValue: "automatic-agent-platform-ui" },
                  },
                ],
              },
              scopeLogs: [
                {
                  scope: { name: "ui-telemetry" },
                  logRecords: events.map((event) => ({
                    body: { stringValue: event.name },
                    timeUnixNano: String(Date.parse(event.recordedAt) * 1_000_000),
                    attributes: Object.entries(event.attributes).map(([key, value]) => ({
                      key,
                      value: serializeAttributeValue(value),
                    })),
                  })),
                },
              ],
            },
          ],
        }),
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createTelemetrySink(exporters: readonly TelemetryExporter[] = []): TelemetrySink {
  return new TelemetrySink(exporters, { autoFlush: exporters.length > 0 });
}

export function measureDuration(name: string, fn: () => void | Promise<void>): void | Promise<void> {
  performance.mark(`${name}:start`);
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(() => {
        performance.mark(`${name}:end`);
        performance.measure(name, `${name}:start`, `${name}:end`);
      });
    }
    performance.mark(`${name}:end`);
    performance.measure(name, `${name}:start`, `${name}:end`);
    return result;
  } catch (error) {
    performance.mark(`${name}:end`);
    performance.measure(name, `${name}:start`, `${name}:end`);
    throw error;
  }
}

export type VitalName = "LCP" | "FID" | "CLS" | "INP" | "TTFB" | "FCP";

export interface VitalRecord {
  name: VitalName;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  navigationEntry?: PerformanceEntry;
}

function vitalRating(name: VitalName, value: number): VitalRecord["rating"] {
  switch (name) {
    case "LCP":
      return value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor";
    case "FID":
      return value <= 100 ? "good" : value <= 300 ? "needs-improvement" : "poor";
    case "CLS":
      return value <= 0.1 ? "good" : value <= 0.25 ? "needs-improvement" : "poor";
    case "INP":
      return value <= 200 ? "good" : value <= 500 ? "needs-improvement" : "poor";
    case "TTFB":
      return value <= 800 ? "good" : value <= 1800 ? "needs-improvement" : "poor";
    case "FCP":
      return value <= 1800 ? "good" : value <= 3000 ? "needs-improvement" : "poor";
  }
}

export function startWebVitalsCollection(sink: TelemetrySink): () => void {
  const dispose: Array<() => void> = [];

  observePerformanceType("paint", dispose, (list) => {
    for (const entry of list.getEntries()) {
      if (entry.name === "first-contentful-paint") {
        sink.record("web_vitals.FCP", {
          value_ms: entry.startTime,
          rating: vitalRating("FCP", entry.startTime),
        });
      }
    }
  });

  observePerformanceType("largest-contentful-paint", dispose, (list) => {
    for (const entry of list.getEntries()) {
      sink.record("web_vitals.LCP", {
        value_ms: entry.startTime,
        rating: vitalRating("LCP", entry.startTime),
      });
    }
  });

  observePerformanceType("layout-shift", dispose, (list) => {
    for (const entry of list.getEntries()) {
      const layoutShift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
      if (layoutShift.hadRecentInput) {
        continue;
      }
      const value = layoutShift.value ?? 0;
      sink.record("web_vitals.CLS", {
        value,
        rating: vitalRating("CLS", value),
      });
    }
  });

  observePerformanceType("event", dispose, (list) => {
    for (const entry of list.getEntries()) {
      sink.record("web_vitals.INP", {
        value_ms: entry.duration,
        rating: vitalRating("INP", entry.duration),
      });
    }
  });

  return () => {
    for (const callback of dispose) {
      callback();
    }
  };
}

export const observeWebVitals = startWebVitalsCollection;

function observePerformanceType(
  type: string,
  dispose: Array<() => void>,
  callback: (list: PerformanceObserverEntryList) => void,
): void {
  if (typeof PerformanceObserver === "undefined") {
    return;
  }
  try {
    const observer = new PerformanceObserver(callback);
    observer.observe({ type, buffered: true } as PerformanceObserverInit);
    dispose.push(() => observer.disconnect());
  } catch (error) {
    const reporter = globalThis.console;
    reporter?.warn?.("telemetry.performance_observer_unsupported", {
      type,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }
}

function resolveAuthorizationHeader(headers: Readonly<Record<string, string>>): string {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "authorization") {
      return value;
    }
  }
  return "";
}

function serializeAttributeValue(value: unknown): Record<string, unknown> {
  if (typeof value === "number") {
    return Number.isInteger(value) ? { intValue: value } : { doubleValue: value };
  }
  if (typeof value === "boolean") {
    return { boolValue: value };
  }
  return { stringValue: String(value) };
}
