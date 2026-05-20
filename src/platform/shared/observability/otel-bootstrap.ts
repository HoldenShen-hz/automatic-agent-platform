import { createRequire } from "node:module";

import { StructuredLogger } from "./structured-logger.js";
import { ServiceRegistry } from "../lifecycle/service-registry.js";
import { runtimeMetricsRegistry } from "./runtime-metrics-registry.js";

export interface OtelBootstrapConfig {
  enabled: boolean;
  endpoint: string | null;
  serviceName: string;
  serviceVersion: string;
  instrumentHttp: boolean;
}

interface OTelSdkLike {
  start(): void | Promise<void>;
  shutdown(): Promise<void>;
}

interface OTelModuleSet {
  NodeSDK: new (options: Record<string, unknown>) => OTelSdkLike;
  OTLPTraceExporter: new (options: Record<string, unknown>) => unknown;
  Resource: (new (attributes: Record<string, unknown>) => unknown) | undefined;
  HttpInstrumentation: (new () => unknown) | undefined;
  serviceNameKey: string;
  serviceVersionKey: string;
}

const logger = new StructuredLogger({ retentionLimit: 100 });

class OtelBootstrapManager {
  private sdk: OTelSdkLike | null = null;

  public async init(config: OtelBootstrapConfig): Promise<boolean> {
    if (!config.enabled) {
      runtimeMetricsRegistry.setGauge("otel_runtime_available", {}, 0);
      return false;
    }
    if (config.endpoint == null || config.endpoint.trim().length === 0) {
      runtimeMetricsRegistry.setGauge("otel_runtime_available", {}, 0);
      logger.warn("otel bootstrap skipped: missing endpoint");
      return false;
    }
    const modules = loadOtelModules();
    if (modules == null) {
      runtimeMetricsRegistry.setGauge("otel_runtime_available", {}, 0);
      logger.warn("otel bootstrap skipped: OpenTelemetry packages are not installed");
      return false;
    }
    if (this.sdk != null) {
      return true;
    }
    const resourceAttributes = {
      [modules.serviceNameKey]: config.serviceName,
      [modules.serviceVersionKey]: config.serviceVersion,
    };
    const resource = modules.Resource != null ? new modules.Resource(resourceAttributes) : resourceAttributes;
    const instrumentations = config.instrumentHttp && modules.HttpInstrumentation != null
      ? [new modules.HttpInstrumentation()]
      : [];
    this.sdk = new modules.NodeSDK({
      resource,
      traceExporter: new modules.OTLPTraceExporter({ url: config.endpoint }),
      instrumentations,
    });
    await Promise.resolve(this.sdk.start());
    runtimeMetricsRegistry.setGauge("otel_runtime_available", {}, 1);
    logger.info("otel bootstrap initialized", {
      endpoint: redactOtelEndpoint(config.endpoint),
      serviceName: config.serviceName,
    });
    return true;
  }

  public async shutdown(): Promise<void> {
    if (this.sdk == null) {
      return;
    }
    const activeSdk = this.sdk;
    this.sdk = null;
    await activeSdk.shutdown();
  }
}

function redactOtelEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    url.username = "";
    url.password = "";
    url.search = "";
    return url.toString();
  } catch {
    return endpoint;
  }
}

const OTEL_BOOTSTRAP_SERVICE = "otel-bootstrap-manager";
function getOtelBootstrapManager(): OtelBootstrapManager {
  const registry = ServiceRegistry.getInstance();
  registry.register(OTEL_BOOTSTRAP_SERVICE, {
    init: () => new OtelBootstrapManager(),
  });
  return registry.get<OtelBootstrapManager>(OTEL_BOOTSTRAP_SERVICE);
}

function loadOtelModules(requireFn = createRequire(import.meta.url)): OTelModuleSet | null {
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

export function isOtelRuntimeAvailable(requireFn = createRequire(import.meta.url)): boolean {
  return loadOtelModules(requireFn) != null;
}

export async function initOtel(config: OtelBootstrapConfig): Promise<boolean> {
  return getOtelBootstrapManager().init(config);
}

export async function shutdownOtel(): Promise<void> {
  await getOtelBootstrapManager().shutdown();
}
