import { createTelemetrySink } from "@aa/shared-telemetry";

const uiTelemetrySink = createTelemetrySink();

export function recordUiTelemetry(
  name: string,
  attributes: Readonly<Record<string, unknown>> = {},
): void {
  uiTelemetrySink.record(name, attributes);
}

export function reportUiError(
  name: string,
  error: Error | unknown,
  attributes: Readonly<Record<string, unknown>> = {},
): void {
  const message = error instanceof Error ? error.message : String(error);
  recordUiTelemetry(name, {
    ...attributes,
    message,
  });
}

export function getUiTelemetrySnapshot() {
  return uiTelemetrySink.list();
}
