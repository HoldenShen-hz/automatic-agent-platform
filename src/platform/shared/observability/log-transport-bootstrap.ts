import { StdoutTransport } from "./transports/stdout-transport.js";
import { FluentdTransport, type FluentdTransportConfig } from "./transports/fluentd-transport.js";
import { DatadogTransport, type DatadogTransportConfig } from "./transports/datadog-transport.js";
import { StructuredLogger } from "./structured-logger.js";

export interface StructuredLogTransportBootstrapConfig {
  stdout: boolean;
  fluentd: FluentdTransportConfig | null;
  datadog: DatadogTransportConfig | null;
}

export function configureStructuredLogTransports(
  config: StructuredLogTransportBootstrapConfig,
): string[] {
  const enabled: string[] = [];

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
