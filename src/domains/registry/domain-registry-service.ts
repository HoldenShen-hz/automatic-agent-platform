import { ValidationError } from "../../platform/contracts/errors.js";
import type { TypedEventPublisher } from "../../platform/five-plane-state-evidence/events/typed-event-publisher.js";
import { nowIso } from "../../platform/contracts/types/ids.js";
import type { DomainDefinition, OutputContractConfig, ToolBundleConfig, WorkflowConfig } from "./domain-model.js";
import type { PluginBinding } from "./domain-model.js";
import { DomainDefinitionSchema } from "./domain-model.js";
import { ContractRegistry } from "./contract-registry.js";
import { DomainSmokeTestRunner, type DomainSmokeTestResult } from "./domain-smoke-test.js";
import { PluginSpiRegistry } from "./plugin-spi-registry.js";
import { ToolBundleRegistry } from "./tool-bundle-registry.js";
import { WorkflowRegistry } from "./workflow-registry.js";
import type { PluginSpiType } from "./plugin-spi.js";

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

  public register(input: DomainDefinition, options?: { skipSmokeTest?: boolean }): DomainDefinition {
    const parsed = DomainDefinitionSchema.parse(input);
    const normalized = parsed.status === "draft" || parsed.status === "validated"
      ? { ...parsed, status: "registered" as const }
      : parsed;
    const normalizedBindings = normalized.pluginBindings.map((binding, index) =>
      normalizePluginBinding(binding, input.pluginBindings[index]),
    );
    const normalizedDefinition: DomainDefinition = {
      ...normalized,
      pluginBindings: normalizedBindings,
    };
    if (this.registry.has(normalizedDefinition.domainId)) {
      throw this.validationError("domain_registry.duplicate_domain", "Domain ID is already registered.");
    }
    this.validateDefinition(normalizedDefinition);

    this.registry.set(normalizedDefinition.domainId, normalizedDefinition);
    this.workflowRegistry.registerAll(normalizedDefinition.workflows);
    this.toolBundleRegistry.registerAll(normalizedDefinition.toolBundles);
    this.contractRegistry.registerAll(normalizedDefinition.outputContracts);
    this.eventPublisher?.publish({
      eventType: "domain:registered",
      payload: {
        domainId: normalizedDefinition.domainId,
        status: normalizedDefinition.status,
        capabilityCount: normalizedDefinition.pluginBindings.length,
        pluginCount: normalizedDefinition.pluginBindings.length,
        occurredAt: nowIso(),
      },
    });
    return normalizedDefinition;
  }

  public validate(domainId: string): DomainSmokeTestResult {
    const definition = this.getOrThrow(domainId);
    return this.smokeTests.run(definition);
  }

  public promoteToCanary(domainId: string, options?: { skipSmokeTest?: boolean }): DomainDefinition {
    const current = this.getOrThrow(domainId);
    if (current.status !== "registered") {
      throw new ValidationError("domain_registry.invalid_canary_state", "Domains can only enter canary from registered state.", {
        category: "validation",
        source: "internal",
        details: { currentStatus: current.status },
      });
    }
    if (options?.skipSmokeTest !== true) {
      const smoke = this.smokeTests.run(current);
      if (!smoke.passed) {
        throw new ValidationError("domain_registry.smoke_test_failed", "Domain smoke test failed.", {
          category: "validation",
          source: "internal",
          details: { issues: smoke.issues },
        });
      }
    }
    const updated: DomainDefinition = { ...current, status: "canary" };
    this.registry.set(domainId, updated);
    this.eventPublisher?.publish({
      eventType: "domain:canary",
      payload: {
        domainId,
        status: "canary",
        capabilityCount: updated.pluginBindings.length,
        pluginCount: updated.pluginBindings.length,
        occurredAt: nowIso(),
      },
    });
    return updated;
  }

  public activate(domainId: string): DomainDefinition {
    const current = this.getOrThrow(domainId);
    if (current.status !== "canary" && current.status !== "registered") {
      throw new ValidationError("domain_registry.invalid_activation_state", "Domains can only activate from canary state.", {
        category: "validation",
        source: "internal",
        details: { currentStatus: current.status },
      });
    }
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

  public updating(domainId: string): DomainDefinition {
    const current = this.getOrThrow(domainId);
    if (current.status !== "active") {
      throw new ValidationError("domain_registry.invalid_updating_state", "Domains can only enter updating from active state.", {
        category: "validation",
        source: "internal",
        details: { currentStatus: current.status },
      });
    }
    const updated: DomainDefinition = { ...current, status: "updating" };
    this.registry.set(domainId, updated);
    this.eventPublisher?.publish({
      eventType: "domain:updating",
      payload: {
        domainId,
        status: "updating",
        capabilityCount: updated.pluginBindings.length,
        pluginCount: updated.pluginBindings.length,
        occurredAt: nowIso(),
      },
    });
    return updated;
  }

  public completeUpdate(domainId: string): DomainDefinition {
    const current = this.getOrThrow(domainId);
    if (current.status !== "updating") {
      throw new ValidationError("domain_registry.invalid_complete_update_state", "Domains can only complete update from updating state.", {
        category: "validation",
        source: "internal",
        details: { currentStatus: current.status },
      });
    }
    const smoke = this.smokeTests.run(current);
    if (!smoke.passed) {
      throw new ValidationError("domain_registry.smoke_test_failed", "Domain smoke test failed during update completion.", {
        category: "validation",
        source: "internal",
        details: { issues: smoke.issues },
      });
    }
    const updated: DomainDefinition = { ...current, status: "active" };
    this.registry.set(domainId, updated);
    this.eventPublisher?.publish({
      eventType: "domain:updated",
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
    if (current.status !== "active") {
      throw new ValidationError("domain_registry.invalid_deprecate_state", "Domains can only deprecate from active state.", {
        category: "validation",
        source: "internal",
        details: { currentStatus: current.status },
      });
    }
    const updated: DomainDefinition = { ...current, status: "deprecated" };
    this.registry.set(domainId, updated);
    this.eventPublisher?.publish({
      eventType: "domain:deprecated",
      payload: {
        domainId,
        status: "deprecated",
        capabilityCount: updated.pluginBindings.length,
        pluginCount: updated.pluginBindings.length,
        occurredAt: nowIso(),
      },
    });
    return updated;
  }

  public archive(domainId: string): DomainDefinition {
    const current = this.getOrThrow(domainId);
    if (current.status !== "deprecated") {
      throw new ValidationError("domain_registry.invalid_archive_state", "Domains can only archive from deprecated state.", {
        category: "validation",
        source: "internal",
        details: { currentStatus: current.status },
      });
    }
    const updated: DomainDefinition = { ...current, status: "archived" };
    this.registry.set(domainId, updated);
    this.eventPublisher?.publish({
      eventType: "domain:archived",
      payload: {
        domainId,
        status: "archived",
        capabilityCount: updated.pluginBindings.length,
        pluginCount: updated.pluginBindings.length,
        occurredAt: nowIso(),
      },
    });
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
    const requiredTools = new Set(domain.capabilities.requiredTools);
    const optionalTools = new Set(domain.capabilities.optionalTools);
    return toolNames.filter((tool) => enabledTools.has(tool) || requiredTools.has(tool) || optionalTools.has(tool));
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
      .filter((binding) => pluginType == null || binding.pluginType === pluginType || resolveBindingRole(binding) === pluginType)
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
      throw new ValidationError("domain_registry.domain_not_found", `domain_registry.domain_not_found: Domain ${domainId} not found.`, {
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
      for (const step of workflow.steps) {
        for (const dependency of step.dependsOn) {
          if (!stepNames.has(dependency)) {
            throw this.validationError("domain_registry.invalid_dependency", "Workflow step dependencies must reference existing steps.");
          }
        }
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
      const bindingRole = resolveBindingRole(binding);
      if (binding.domainId !== parsed.domainId) {
        throw this.validationError("domain_registry.plugin_domain_mismatch", "Plugin binding domain must match the registered domain.");
      }
      const registryRecord = this.pluginRegistry?.get(binding.pluginId) ?? null;
      if (registryRecord) {
        const manifestTypes = new Set(registryRecord.manifest.spiTypes.flatMap((type: string) => normalizePluginManifestType(type)));
        if (!manifestTypes.has(binding.pluginType) && !registryRecord.manifest.spiTypes.includes(bindingRole as PluginSpiType)) {
          throw this.validationError("domain_registry.plugin_type_mismatch", "Plugin binding type does not match plugin manifest.");
        }
        if (registryRecord.manifest.domainIds.length > 0 && !registryRecord.manifest.domainIds.includes(parsed.domainId)) {
          throw this.validationError("domain_registry.plugin_domain_not_allowed", "Plugin manifest does not allow the registered domain.");
        }
        continue;
      }
      if (this.installedPluginIds.size === 0 && this.healthyPluginIds.size === 0 && this.pluginRegistry == null) {
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
    return new ValidationError(code, `${code}: ${message}`, {
      category: "validation",
      source: "internal",
    });
  }
}

function normalizePluginManifestType(type: string): PluginBinding["pluginType"][] {
  switch (type) {
    case "planner":
    case "presenter":
      return ["tool"];
    case "validator":
      return ["evaluator"];
    case "tool":
    case "adapter":
    case "retriever":
    case "evaluator":
      return [type];
    default:
      return [];
  }
}

function resolveBindingRole(binding: PluginBinding): NonNullable<PluginBinding["bindingRole"]> {
  if (binding.bindingRole !== undefined) {
    return binding.bindingRole;
  }
  switch (binding.pluginType) {
    case "tool":
      return "tool";
    case "adapter":
      return "adapter";
    case "retriever":
      return "retriever";
    case "evaluator":
      return "evaluator";
    case "planner":
      return "planner";
    case "presenter":
      return "presenter";
    case "validator":
      return "validator";
  }
}

function normalizePluginBinding(
  binding: PluginBinding,
  rawBinding: PluginBinding | undefined,
): PluginBinding {
  if (binding.bindingRole != null) {
    return binding;
  }
  const legacyRole = rawBinding?.bindingRole ?? rawBinding?.pluginType;
  if (legacyRole === "planner" || legacyRole === "presenter" || legacyRole === "validator") {
    return { ...binding, bindingRole: legacyRole };
  }
  return { ...binding, bindingRole: resolveBindingRole(binding) };
}
