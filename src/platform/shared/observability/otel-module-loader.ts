import { createRequire } from "node:module";

export interface OtelApiLike {
  context: {
    active(): unknown;
  };
  trace: {
    getTracer(name: string): {
      startActiveSpan<T>(
        name: string,
        options: Record<string, unknown>,
        callback: (span: OtelTelemetrySpanLike) => T,
      ): T;
    };
    getSpan(context: unknown): OtelTelemetrySpanLike | undefined;
  };
  SpanStatusCode: {
    OK: number;
    ERROR: number;
  };
}

export interface OtelTelemetrySpanLike {
  end(): void;
  recordException(error: unknown): void;
  setAttribute(key: string, value: unknown): void;
  setAttributes?(attributes: Record<string, unknown>): void;
  setStatus(status: { code: number; message?: string }): void;
  spanContext(): { traceId: string; spanId: string };
}

export interface OTelModuleSet {
  NodeSDK: new (options: Record<string, unknown>) => {
    start(): void | Promise<void>;
    shutdown(): Promise<void>;
  };
  OTLPTraceExporter: new (options: Record<string, unknown>) => unknown;
  Resource: (new (attributes: Record<string, unknown>) => unknown) | undefined;
  HttpInstrumentation: (new () => unknown) | undefined;
  serviceNameKey: string;
  serviceVersionKey: string;
}

export function loadOtelApi(requireFn = createRequire(import.meta.url)): OtelApiLike | null {
  try {
    return requireFn("@opentelemetry/api") as OtelApiLike;
  } catch {
    return null;
  }
}

export function loadOtelModules(requireFn = createRequire(import.meta.url)): OTelModuleSet | null {
  try {
    const sdkNode = requireFn("@opentelemetry/sdk-node") as { NodeSDK: OTelModuleSet["NodeSDK"] };
    const exporter = requireFn("@opentelemetry/exporter-trace-otlp-http") as { OTLPTraceExporter: OTelModuleSet["OTLPTraceExporter"] };
    const resources = requireFn("@opentelemetry/resources") as { Resource?: OTelModuleSet["Resource"] };
    const semantic = requireFn("@opentelemetry/semantic-conventions") as Record<string, string | undefined>;
    const instrumentationHttp = requireFn("@opentelemetry/instrumentation-http") as { HttpInstrumentation?: OTelModuleSet["HttpInstrumentation"] };
    return {
      NodeSDK: sdkNode.NodeSDK,
      OTLPTraceExporter: exporter.OTLPTraceExporter,
      Resource: resources.Resource,
      HttpInstrumentation: instrumentationHttp.HttpInstrumentation,
      serviceNameKey: semantic["ATTR_SERVICE_NAME"] ?? "service.name",
      serviceVersionKey: semantic["ATTR_SERVICE_VERSION"] ?? "service.version",
    };
  } catch {
    return null;
  }
}
