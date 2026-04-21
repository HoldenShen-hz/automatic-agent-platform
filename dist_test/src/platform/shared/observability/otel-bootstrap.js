import { createRequire } from "node:module";
import { StructuredLogger } from "./structured-logger.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
let sdk = null;
function loadOtelModules(requireFn = createRequire(import.meta.url)) {
    try {
        const sdkNode = requireFn("@opentelemetry/sdk-node");
        const exporter = requireFn("@opentelemetry/exporter-trace-otlp-http");
        const resources = requireFn("@opentelemetry/resources");
        const semantic = requireFn("@opentelemetry/semantic-conventions");
        const instrumentationHttp = requireFn("@opentelemetry/instrumentation-http");
        return {
            NodeSDK: sdkNode.NodeSDK,
            OTLPTraceExporter: exporter.OTLPTraceExporter,
            Resource: resources.Resource,
            HttpInstrumentation: instrumentationHttp.HttpInstrumentation,
            serviceNameKey: semantic["ATTR_SERVICE_NAME"] ?? "service.name",
            serviceVersionKey: semantic["ATTR_SERVICE_VERSION"] ?? "service.version",
        };
    }
    catch {
        return null;
    }
}
export function isOtelRuntimeAvailable(requireFn = createRequire(import.meta.url)) {
    return loadOtelModules(requireFn) != null;
}
export async function initOtel(config) {
    if (!config.enabled) {
        return false;
    }
    if (config.endpoint == null || config.endpoint.trim().length === 0) {
        logger.warn("otel bootstrap skipped: missing endpoint");
        return false;
    }
    const modules = loadOtelModules();
    if (modules == null) {
        logger.warn("otel bootstrap skipped: OpenTelemetry packages are not installed");
        return false;
    }
    if (sdk != null) {
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
    sdk = new modules.NodeSDK({
        resource,
        traceExporter: new modules.OTLPTraceExporter({ url: config.endpoint }),
        instrumentations,
    });
    await Promise.resolve(sdk.start());
    logger.info("otel bootstrap initialized", {
        endpoint: config.endpoint,
        serviceName: config.serviceName,
    });
    return true;
}
export async function shutdownOtel() {
    if (sdk == null) {
        return;
    }
    const activeSdk = sdk;
    sdk = null;
    await activeSdk.shutdown();
}
//# sourceMappingURL=otel-bootstrap.js.map