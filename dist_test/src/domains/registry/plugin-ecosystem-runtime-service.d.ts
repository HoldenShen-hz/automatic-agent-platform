import { ConnectorFrameworkService, type ConnectorBinding } from "../../scale-ecosystem/integration/connector-framework-service.js";
import { DomainRegistryService } from "./domain-registry-service.js";
import { PluginSpiRegistry } from "./plugin-spi-registry.js";
export interface EcosystemRuntimePluginTarget {
    pluginId: string;
    pluginType: string;
    lifecycleState: string;
    healthy: boolean;
    runtimeIsolation: string;
    domainId: string;
}
export interface EcosystemRuntimeConnectorTarget {
    connectorId: string;
    bound: boolean;
    environment: "dev" | "staging" | "prod";
    lifecycleState: string | null;
}
export interface EcosystemRuntimePlan {
    planId: string;
    domainId: string;
    tenantId: string;
    environment: "dev" | "staging" | "prod";
    pluginTargets: EcosystemRuntimePluginTarget[];
    connectorTargets: EcosystemRuntimeConnectorTarget[];
    ready: boolean;
    findings: string[];
}
export interface EcosystemRuntimeActivation {
    activationId: string;
    plan: EcosystemRuntimePlan;
    activatedPluginIds: string[];
    connectorBindings: ConnectorBinding[];
}
export declare class PluginEcosystemRuntimeService {
    private readonly domains;
    private readonly plugins;
    private readonly connectors;
    constructor(domains: DomainRegistryService, plugins: PluginSpiRegistry, connectors: ConnectorFrameworkService);
    buildPlan(input: {
        domainId: string;
        tenantId: string;
        environment: "dev" | "staging" | "prod";
        connectorIds?: readonly string[];
    }): EcosystemRuntimePlan;
    activateRuntime(input: {
        domainId: string;
        tenantId: string;
        environment: "dev" | "staging" | "prod";
        connectorIds?: readonly string[];
        autoBindConnectors?: boolean;
    }): Promise<EcosystemRuntimeActivation>;
}
