export interface TelemetryEvent {
  readonly name: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly recordedAt: string;
}

export interface TelemetryScope {
  readonly name: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export class TelemetrySink {
  private readonly events: TelemetryEvent[] = [];

  public record(name: string, attributes: Readonly<Record<string, unknown>> = {}): void {
    this.events.push({
      name,
      attributes,
      recordedAt: new Date().toISOString(),
    });
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

export function createTelemetrySink(): TelemetrySink {
  return new TelemetrySink();
}
