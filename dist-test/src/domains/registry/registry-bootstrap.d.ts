import type { KnowledgeNamespace } from "../../platform/state-evidence/knowledge/knowledge-model.js";
import type { SandboxPolicy } from "../../platform/control-plane/iam/sandbox-policy.js";
import type { TypedEventPublisher } from "../../platform/state-evidence/events/typed-event-publisher.js";
import { DomainRegistryService } from "./domain-registry-service.js";
import { PluginSpiRegistry } from "./plugin-spi-registry.js";
export interface RegistryBootstrapOptions {
    configRoot?: string;
    environment?: string;
    sandboxPolicy?: SandboxPolicy;
    eventPublisher?: TypedEventPublisher;
}
export interface RegistryBootstrapResult {
    pluginRegistry: PluginSpiRegistry;
    domainRegistry: DomainRegistryService;
    knowledgeNamespaces: KnowledgeNamespace[];
    skippedPluginIds: string[];
}
export declare function bootstrapConfiguredRegistries(options?: RegistryBootstrapOptions): RegistryBootstrapResult;
