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
