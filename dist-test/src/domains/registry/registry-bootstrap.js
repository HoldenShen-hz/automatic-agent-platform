import { ConfigGovernanceService } from "../../platform/control-plane/config-center/config-governance-service.js";
import { resolveConfigEnvironment } from "../../platform/control-plane/config-center/runtime-env.js";
import { KnowledgeNamespaceSchema } from "../../platform/state-evidence/knowledge/knowledge-model.js";
import { createBuiltinPlugin } from "../../plugins/builtin-plugin-registry.js";
import { DomainDefinitionSchema } from "./domain-model.js";
import { DomainRegistryService } from "./domain-registry-service.js";
import { PluginManifestSchema } from "./plugin-spi.js";
import { PluginSpiRegistry } from "./plugin-spi-registry.js";
function normalizeObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}
export function bootstrapConfiguredRegistries(options = {}) {
    const config = new ConfigGovernanceService({
        ...(options.configRoot ? { configRoot: options.configRoot } : {}),
        ...(options.sandboxPolicy ? { sandboxPolicy: options.sandboxPolicy } : {}),
    }).loadBundle(resolveConfigEnvironment({
        environment: options.environment,
    }));
    const pluginRegistry = new PluginSpiRegistry({
        ...(options.eventPublisher ? { eventPublisher: options.eventPublisher } : {}),
    });
    const domainRegistry = new DomainRegistryService({
        pluginRegistry,
        ...(options.eventPublisher ? { eventPublisher: options.eventPublisher } : {}),
    });
    const pluginLayer = normalizeObject(config.layers.plugins);
    const pluginManifests = Array.isArray(pluginLayer.manifests) ? pluginLayer.manifests : [];
    const skippedPluginIds = [];
    for (const manifestInput of pluginManifests) {
        const manifest = PluginManifestSchema.parse(manifestInput);
        const plugin = createBuiltinPlugin(manifest.pluginId);
        if (!plugin) {
            skippedPluginIds.push(manifest.pluginId);
            continue;
        }
        pluginRegistry.register(plugin, manifest);
    }
    const domainLayer = normalizeObject(config.layers.domains);
    const domains = Array.isArray(domainLayer.domains) ? domainLayer.domains : [];
    for (const domainInput of domains) {
        domainRegistry.register(DomainDefinitionSchema.parse(domainInput));
    }
    const knowledgeLayer = normalizeObject(config.layers.knowledge);
    const knowledgeNamespaces = (Array.isArray(knowledgeLayer.namespaces) ? knowledgeLayer.namespaces : [])
        .map((namespace) => KnowledgeNamespaceSchema.parse(namespace));
    for (const namespace of knowledgeNamespaces) {
        domainRegistry.registerKnowledgeNamespace(namespace.path, namespace.ownerDomainId);
    }
    return {
        pluginRegistry,
        domainRegistry,
        knowledgeNamespaces,
        skippedPluginIds,
    };
}
//# sourceMappingURL=registry-bootstrap.js.map