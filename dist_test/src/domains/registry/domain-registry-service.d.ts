import type { TypedEventPublisher } from "../../platform/state-evidence/events/typed-event-publisher.js";
import type { DomainDefinition, OutputContractConfig, ToolBundleConfig, WorkflowConfig } from "./domain-model.js";
import type { PluginBinding } from "./domain-model.js";
import { type DomainSmokeTestResult } from "./domain-smoke-test.js";
import { PluginSpiRegistry } from "./plugin-spi-registry.js";
export interface DomainRegistryServiceOptions {
    installedPluginIds?: readonly string[];
    healthyPluginIds?: readonly string[];
    pluginRegistry?: PluginSpiRegistry;
    eventPublisher?: TypedEventPublisher;
}
export declare class DomainRegistryService {
    private readonly registry;
    private readonly knowledgeNamespacesByDomain;
    private readonly installedPluginIds;
    private readonly healthyPluginIds;
    private readonly pluginRegistry;
    private readonly eventPublisher;
    private readonly workflowRegistry;
    private readonly toolBundleRegistry;
    private readonly contractRegistry;
    private readonly smokeTests;
    constructor(options?: DomainRegistryServiceOptions);
    register(input: DomainDefinition): DomainDefinition;
    validate(domainId: string): DomainSmokeTestResult;
    activate(domainId: string): DomainDefinition;
    deprecate(domainId: string): DomainDefinition;
    get(domainId: string): DomainDefinition | null;
    list(): DomainDefinition[];
    listActive(): DomainDefinition[];
    filterAllowedTools(domainId: string, toolNames: readonly string[]): string[];
    getWorkflow(domainId: string, workflowId: string): WorkflowConfig | null;
    getToolBundle(domainId: string, bundleId: string): ToolBundleConfig | null;
    getOutputContract(domainId: string, contractId: string): OutputContractConfig | null;
    getPluginBindings(domainId: string, pluginType?: PluginBinding["pluginType"]): PluginBinding[];
    resolvePlugins(domainId: string, pluginType: PluginBinding["pluginType"]): NonNullable<import("./plugin-spi.js").RegisteredPlugin | null | undefined>[];
    buildCapabilityEntry(domainId: string): {
        domainId: string;
        bundleId: string;
        capabilityIds: string[];
        toolNames: string[];
        skillIds: string[];
        pluginIds: string[];
        knowledgeNamespaces: string[];
        defaultActivationPolicy: "active" | "draft" | "deprecated" | "testing";
        trustTier: "standard" | "restricted" | "elevated";
    };
    registerKnowledgeNamespace(namespace: string, ownerDomainId: string): void;
    private getOrThrow;
    private validateDefinition;
    private validationError;
}
