import { type FluentdTransportConfig } from "./transports/fluentd-transport.js";
import { type DatadogTransportConfig } from "./transports/datadog-transport.js";
export interface StructuredLogTransportBootstrapConfig {
    stdout: boolean;
    fluentd: FluentdTransportConfig | null;
    datadog: DatadogTransportConfig | null;
}
export declare function configureStructuredLogTransports(config: StructuredLogTransportBootstrapConfig): string[];
