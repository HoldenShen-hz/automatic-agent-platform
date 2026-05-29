import { createTelemetrySink } from "@aa/shared-telemetry";
const uiTelemetrySink = createTelemetrySink();
export function recordUiTelemetry(name, attributes = {}) {
    uiTelemetrySink.record(name, attributes);
}
export function reportUiError(name, error, attributes = {}) {
    const message = error instanceof Error ? error.message : String(error);
    recordUiTelemetry(name, {
        ...attributes,
        message,
    });
}
export function getUiTelemetrySnapshot() {
    return uiTelemetrySink.list();
}
