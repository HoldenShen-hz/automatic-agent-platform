import { StdoutTransport } from "./transports/stdout-transport.js";
import { FluentdTransport } from "./transports/fluentd-transport.js";
import { DatadogTransport } from "./transports/datadog-transport.js";
import { StructuredLogger } from "./structured-logger.js";
export function configureStructuredLogTransports(config) {
    const enabled = [];
    if (config.stdout) {
        StructuredLogger.addTransport(new StdoutTransport());
        enabled.push("stdout");
    }
    if (config.fluentd != null) {
        StructuredLogger.addTransport(new FluentdTransport(config.fluentd));
        enabled.push("fluentd");
    }
    if (config.datadog != null) {
        StructuredLogger.addTransport(new DatadogTransport(config.datadog));
        enabled.push("datadog");
    }
    return enabled;
}
//# sourceMappingURL=log-transport-bootstrap.js.map