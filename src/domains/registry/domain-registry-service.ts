import { ValidationError } from "../../platform/contracts/errors.js";
import type { TypedEventPublisher } from "../../platform/state-evidence/events/typed-event-publisher.js";
import { nowIso } from "../../platform/contracts/types/ids.js";
import type { DomainDefinition, OutputContractConfig, ToolBundleConfig, WorkflowConfig } from "./domain-model.js";
import type { PluginBinding } from "./domain-model.js";
import { DomainDefinitionSchema } from "./domain-model.js";
import { ContractRegistry } from "./contract-registry.js";
import { DomainSmokeTestRunner, type DomainSmokeTestResult } from "./domain-smoke-test.js";
import { PluginSpiRegistry } from "./plugin-spi-registry.js";
import { ToolBundleRegistry } from "./tool-bundle-registry.js";
import { WorkflowRegistry } from "./workflow-registry.js";

export interface DomainRegistryServiceOptions {
  installedPluginIds?: readonly string[];
  healthyPluginIds?: readonly string[];
  pluginRegistry?: PluginSpiRegistry;
  eventPublisher?: TypedEventPublisher;
}

export class DomainRegistryService {
  private readonly registry = new Map<string, DomainDefinition>();
  private readonly knowledgeNamespacesByDomain = new Map<string, Set<string>>();
  private readonly installedPluginIds: ReadonlySet<string>;
  private readonly healthyPluginIds: ReadonlySet<string>;
  private readonly pluginRegistry: PluginSpiRegistry | null;
  private readonly eventPublisher: TypedEventPublisher | null;
  private readonly workflowRegistry = new WorkflowRegistry();
  private readonly toolBundleRegistry = new ToolBundleRegistry();
  private readonly contractRegistry = new ContractRegistry();
  private readonly smokeTests = new DomainSmokeTestRunner();

  public constructor(options: DomainRegistryServiceOptions = {}) {
    this.pluginRegistry = options.pluginRegistry ?? null;
    this.installedPluginIds = new Set(options.installedPluginIds ?? []);
    this.healthyPluginIds = new Set(options.healthyPluginIds ?? options.installedPluginIds ?? []);
    this.eventPublisher = options.eventPublisher ?? null;
  }

  public register(input: DomainDefinition): DomainDefinition {
    const parsed = DomainDefinitionSchema.parse(input);
    this.validateDefinition(parsed);
    this.registry.set(parsed.domainId, parsed);
    this.workflowRegistry.registerAll(parsed.workflows);
    this.toolBundleRegistry.registerAll(parsed.toolBundles);
    this.contractRegistry.registerAll(parsed.outputContracts);
    this.eventPublisher?.publish({
      eventType: "domain:registered",
      payload: {
        domainId: parsed.domainId,
        status: parsed.status,
        capabilityCount: parsed.pluginBindings.length,
        pluginCount: parsed.pluginBindings.length,
        occurredAt: nowIso(),
      },
    });
    return parsed;
  }

  public validate(domainId: string): DomainSmokeTestResult {
    const definition = this.getOrThrow(domainId);
    return this.smokeTests.run(definition);
  }

  public activate(domainId: string): DomainDefinition {
    const current = this.getOrThrow(domainId);
    const smoke = this.smokeTests.run(current);
    if (!smoke.passed) {
      throw new ValidationError("domain_registry.smoke_test_failed", "Domain smoke test failed.", {
        category: "validation",
        source: "internal",
        details: { issues: smoke.issues },
      });
    }
    const updated: DomainDefinition = { ...current, status: "active" };
    this.registry.set(domainId, updated);
    this.eventPublisher?.publish({
      eventType: "domain:activated",
      payload: {
        domainId,
        status: "active",
        capabilityCount: updated.pluginBindings.length,
        pluginCount: updated.pluginBindings.length,
        occurredAt: nowIso(),
      },
    });
    return updated;
  }

  public deprecate(domainId: string): DomainDefinition {
    const current = this.getOrThrow(domainId);
    const updated: DomainDefinition = { ...current, status: "deprecated" };
    this.registry.set(domainId, updated);
    return updated;
  }

  public get(domainId: string): DomainDefinition | null {
    return this.registry.get(domainId) ?? null;
  }

  public list(): DomainDefinition[] {
    return [...this.registry.values()];
  }

  public listActive(): DomainDefinition[] {
    return [...this.registry.values()].filter((domain) => domain.status === "active");
  }

  public filterAllowedTools(domainId: string, toolNames: readonly string[]): string[] {
    const domain = this.get(domainId);
    if (!domain) {
      return [];
    }
    const enabledTools = new Set(
      domain.toolBundles
        .flatMap((bundle) => bundle.tools)
        .filter((entry) => entry.enabled)
        .map((entry) => entry.toolName),
    );
    return toolNames.filter((tool) => enabledTools.has(tool) || domain.capabilities.requiredTools.includes(tool) || domain.capabilities.optionalTools.includes(tool));
  }

  public getWorkflow(domainId: string, workflowId: string): WorkflowConfig | null {
    const domain = this.get(domainId);
    if (!domain) {
      return null;
    }
    return domain.workflows.find((workflow) => workflow.workflowId === workflowId) ?? null;
  }

  public getToolBundle(domainId: string, bundleId: string): ToolBundleConfig | null {
    const domain = this.get(domainId);
    if (!domain) {
      return null;
    }
    return domain.toolBundles.find((bundle) => bundle.bundleId === bundleId) ?? null;
  }

  public getOutputContract(domainId: string, contractId: string): OutputContractConfig | null {
    const domain = this.get(domainId);
    if (!domain) {
      return null;
    }
    return domain.outputContracts.find((contract) => contract.contractId === contractId) ?? null;
  }

  public getPluginBindings(domainId: string, pluginType?: PluginBinding["pluginType"]): PluginBinding[] {
    const domain = this.get(domainId);
    if (!domain) {
      return [];
    }
    return domain.pluginBindings
      .filter((binding) => binding.enabled)
      .filter((binding) => pluginType == null || binding.pluginType === pluginType)
      .sort((left, right) => right.priority - left.priority);
  }

  public resolvePlugins(domainId: string, pluginType: PluginBinding["pluginType"]) {
    if (!this.pluginRegistry) {
      return [];
    }
    return this.getPluginBindings(domainId, pluginType)
      .map((binding) => this.pluginRegistry?.resolve(binding.pluginId))
      .filter((plugin): plugin is NonNullable<typeof plugin> => plugin != null);
  }

  public buildCapabilityEntry(domainId: string) {
    const domain = this.getOrThrow(domainId);
    return {
      domainId: domain.domainId,
      bundleId: domain.toolBundles[0]?.bundleId ?? `${domain.domainId}.default`,
      capabilityIds: domain.pluginBindings.map((binding) => binding.pluginId),
      toolNames: domain.toolBundles.flatMap((bundle) => bundle.tools.map((tool) => tool.toolName)),
      skillIds: domain.workflows.map((workflow) => workflow.workflowId),
      pluginIds: domain.pluginBindings.map((binding) => binding.pluginId),
      knowledgeNamespaces: [...(this.knowledgeNamespacesByDomain.get(domainId) ?? new Set<string>())],
      defaultActivationPolicy: domain.status,
      trustTier: domain.capabilities.securityLevel,
    };
  }

  public registerKnowledgeNamespace(namespace: string, ownerDomainId: string): void {
    const existing = this.knowledgeNamespacesByDomain.get(ownerDomainId) ?? new Set<string>();
    existing.add(namespace);
    this.knowledgeNamespacesByDomain.set(ownerDomainId, existing);
  }

  private getOrThrow(domainId: string): DomainDefinition {
    const domain = this.get(domainId);
    if (!domain) {
      throw new ValidationError("domain_registry.domain_not_found", `Domain ${domainId} not found.`, {
        category: "validation",
        source: "internal",
      });
    }
    return domain;
  }

  private validateDefinition(parsed: DomainDefinition): void {
    const seenWorkflowIds = new Set<string>();
    for (const workflow of parsed.workflows) {
      if (seenWorkflowIds.has(workflow.workflowId)) {
        throw this.validationError("domain_registry.duplicate_workflow", "Domain workflow IDs must be unique.");
      }
      seenWorkflowIds.add(workflow.workflowId);
      const stepNames = new Set<string>();
      for (const step of workflow.steps) {
        if (stepNames.has(step.stepName)) {
          throw this.validationError("domain_registry.duplicate_step_name", "Workflow step names must be unique.");
        }
        stepNames.add(step.stepName);
      }
    }

    for (const bundle of parsed.toolBundles) {
      for (const tool of bundle.tools) {
        if (tool.toolName.includes("..") || tool.toolName.includes("/")) {
          throw this.validationError("domain_registry.invalid_tool_bundle", "Domain tool bundle must use registered tool names only.");
        }
      }
    }

    for (const binding of parsed.pluginBindings) {
      if (binding.domainId !== parsed.domainId) {
        throw this.validationError("domain_registry.plugin_domain_mismatch", "Plugin binding domain must match the registered domain.");
      }
      const registryRecord = this.pluginRegistry?.get(binding.pluginId) ?? null;
      if (registryRecord) {
        if (!registryRecord.manifest.spiTypes.includes(binding.pluginType)) {
          throw this.validationError("domain_registry.plugin_type_mismatch", "Plugin binding type does not match plugin manifest.");
        }
        if (registryRecord.manifest.domainIds.length > 0 && !registryRecord.manifest.domainIds.includes(parsed.domainId)) {
          throw this.validationError("domain_registry.plugin_domain_not_allowed", "Plugin manifest does not allow the registered domain.");
        }
        continue;
      }
      if (!this.installedPluginIds.has(binding.pluginId)) {
        throw this.validationError("domain_registry.plugin_missing", "Plugin binding references an unregistered plugin.");
      }
      if (!this.healthyPluginIds.has(binding.pluginId)) {
        throw this.validationError("domain_registry.plugin_unhealthy", "Plugin binding references an unhealthy plugin.");
      }
    }
  }

  private validationError(code: string, message: string): ValidationError {
    return new ValidationError(code, message, {
      category: "validation",
      source: "internal",
    });
  }
}
