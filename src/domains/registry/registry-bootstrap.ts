import { ConfigGovernanceService } from "../../platform/control-plane/config-center/config-governance-service.js";
import { resolveConfigEnvironment } from "../../platform/control-plane/config-center/runtime-env.js";
import type { KnowledgeNamespace } from "../../platform/state-evidence/knowledge/knowledge-model.js";
import { KnowledgeNamespaceSchema } from "../../platform/state-evidence/knowledge/knowledge-model.js";
import type { SandboxPolicy } from "../../platform/control-plane/iam/sandbox-policy.js";
import type { TypedEventPublisher } from "../../platform/state-evidence/events/typed-event-publisher.js";
import { createBuiltinPlugin } from "../../plugins/builtin-plugin-registry.js";
import { DomainDefinitionSchema, type DomainDefinition } from "./domain-model.js";
import { DomainRegistryService } from "./domain-registry-service.js";
import { PluginManifestSchema } from "./plugin-spi.js";
import { PluginSpiRegistry } from "./plugin-spi-registry.js";

interface DomainLayerShape {
  domains?: unknown;
}

interface PluginLayerShape {
  manifests?: unknown;
}

interface KnowledgeLayerShape {
  namespaces?: unknown;
}

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

function normalizeObject(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function bootstrapConfiguredRegistries(options: RegistryBootstrapOptions = {}): RegistryBootstrapResult {
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

  const pluginLayer = normalizeObject(config.layers.plugins) as PluginLayerShape;
  const pluginManifests = Array.isArray(pluginLayer.manifests) ? pluginLayer.manifests : [];
  const skippedPluginIds: string[] = [];
  for (const manifestInput of pluginManifests) {
    const manifest = PluginManifestSchema.parse(manifestInput);
    const plugin = createBuiltinPlugin(manifest.pluginId);
    if (!plugin) {
      skippedPluginIds.push(manifest.pluginId);
      continue;
    }
    pluginRegistry.register(plugin, manifest);
  }

  const domainLayer = normalizeObject(config.layers.domains) as DomainLayerShape;
  const domains = Array.isArray(domainLayer.domains) ? domainLayer.domains : [];
  for (const domainInput of domains) {
    domainRegistry.register(DomainDefinitionSchema.parse(domainInput) as DomainDefinition);
  }

  const knowledgeLayer = normalizeObject(config.layers.knowledge) as KnowledgeLayerShape;
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
