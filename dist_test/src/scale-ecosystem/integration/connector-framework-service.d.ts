import { type ConnectorManifest, type NormalizedConnectorManifest } from "./connector-registry/index.js";
import { type ConnectorExecutionRequest, type ConnectorExecutionResult } from "./connector-runtime/index.js";
import { type ConnectorHealthReport } from "./health-monitor/index.js";
export interface ConnectorBinding {
    readonly bindingId: string;
    readonly connectorId: string;
    readonly tenantId: string;
    readonly environment: "dev" | "staging" | "prod";
    readonly boundAt: string;
}
export type RegisteredConnectorManifest = NormalizedConnectorManifest;
export declare class ConnectorFrameworkService {
    private readonly manifests;
    private readonly bindings;
    private readonly health;
    register(manifest: ConnectorManifest): RegisteredConnectorManifest;
    bind(connectorId: string, tenantId: string, environment: ConnectorBinding["environment"], boundAt?: string): ConnectorBinding;
    recordHealth(report: ConnectorHealthReport): ConnectorHealthReport;
    execute(request: ConnectorExecutionRequest, options: {
        readonly environment: "dev" | "staging" | "prod";
        readonly eventType?: string;
        readonly executedAt?: string;
    }): ConnectorExecutionResult & {
        readonly executionKey: string;
        readonly executedAt: string;
    };
    listEnabled(): RegisteredConnectorManifest[];
    getManifest(connectorId: string): RegisteredConnectorManifest | null;
    listBindings(options?: {
        connectorId?: string;
        tenantId?: string;
        environment?: ConnectorBinding["environment"];
    }): ConnectorBinding[];
    private requireManifest;
}
