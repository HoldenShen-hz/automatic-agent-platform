export declare function recordUiTelemetry(name: string, attributes?: Readonly<Record<string, unknown>>): void;
export declare function reportUiError(name: string, error: Error | unknown, attributes?: Readonly<Record<string, unknown>>): void;
export declare function getUiTelemetrySnapshot(): readonly import("@aa/shared-telemetry").TelemetryEvent[];
