export interface TelemetryEvent {
  readonly name: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly recordedAt: string;
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
}

export function createTelemetrySink(): TelemetrySink {
  return new TelemetrySink();
}
