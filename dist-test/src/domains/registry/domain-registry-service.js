import { ValidationError } from "../../platform/contracts/errors.js";
import { nowIso } from "../../platform/contracts/types/ids.js";
import { DomainDefinitionSchema } from "./domain-model.js";
import { ContractRegistry } from "./contract-registry.js";
import { DomainSmokeTestRunner } from "./domain-smoke-test.js";
import { ToolBundleRegistry } from "./tool-bundle-registry.js";
import { WorkflowRegistry } from "./workflow-registry.js";
export class DomainRegistryService {
    registry = new Map();
    knowledgeNamespacesByDomain = new Map();
    installedPluginIds;
    healthyPluginIds;
    pluginRegistry;
    eventPublisher;
    workflowRegistry = new WorkflowRegistry();
    toolBundleRegistry = new ToolBundleRegistry();
    contractRegistry = new ContractRegistry();
    smokeTests = new DomainSmokeTestRunner();
    constructor(options = {}) {
        this.pluginRegistry = options.pluginRegistry ?? null;
        this.installedPluginIds = new Set(options.installedPluginIds ?? []);
        this.healthyPluginIds = new Set(options.healthyPluginIds ?? options.installedPluginIds ?? []);
        this.eventPublisher = options.eventPublisher ?? null;
    }
    register(input) {
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
    validate(domainId) {
        const definition = this.getOrThrow(domainId);
        return this.smokeTests.run(definition);
    }
    activate(domainId) {
        const current = this.getOrThrow(domainId);
        const smoke = this.smokeTests.run(current);
        if (!smoke.passed) {
            throw new ValidationError("domain_registry.smoke_test_failed", "Domain smoke test failed.", {
                category: "validation",
                source: "internal",
                details: { issues: smoke.issues },
            });
        }
        const updated = { ...current, status: "active" };
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
    deprecate(domainId) {
        const current = this.getOrThrow(domainId);
        const updated = { ...current, status: "deprecated" };
        this.registry.set(domainId, updated);
        return updated;
    }
    get(domainId) {
        return this.registry.get(domainId) ?? null;
    }
    list() {
        return [...this.registry.values()];
    }
    listActive() {
        return [...this.registry.values()].filter((domain) => domain.status === "active");
    }
    filterAllowedTools(domainId, toolNames) {
        const domain = this.get(domainId);
        if (!domain) {
            return [];
        }
        const enabledTools = new Set(domain.toolBundles
            .flatMap((bundle) => bundle.tools)
            .filter((entry) => entry.enabled)
            .map((entry) => entry.toolName));
        return toolNames.filter((tool) => enabledTools.has(tool) || domain.capabilities.requiredTools.includes(tool) || domain.capabilities.optionalTools.includes(tool));
    }
    getWorkflow(domainId, workflowId) {
        const domain = this.get(domainId);
        if (!domain) {
            return null;
        }
        return domain.workflows.find((workflow) => workflow.workflowId === workflowId) ?? null;
    }
    getToolBundle(domainId, bundleId) {
        const domain = this.get(domainId);
        if (!domain) {
            return null;
        }
        return domain.toolBundles.find((bundle) => bundle.bundleId === bundleId) ?? null;
    }
    getOutputContract(domainId, contractId) {
        const domain = this.get(domainId);
        if (!domain) {
            return null;
        }
        return domain.outputContracts.find((contract) => contract.contractId === contractId) ?? null;
    }
    getPluginBindings(domainId, pluginType) {
        const domain = this.get(domainId);
        if (!domain) {
            return [];
        }
        return domain.pluginBindings
            .filter((binding) => binding.enabled)
            .filter((binding) => pluginType == null || binding.pluginType === pluginType)
            .sort((left, right) => right.priority - left.priority);
    }
    resolvePlugins(domainId, pluginType) {
        if (!this.pluginRegistry) {
            return [];
        }
        return this.getPluginBindings(domainId, pluginType)
            .map((binding) => this.pluginRegistry?.resolve(binding.pluginId))
            .filter((plugin) => plugin != null);
    }
    buildCapabilityEntry(domainId) {
        const domain = this.getOrThrow(domainId);
        return {
            domainId: domain.domainId,
            bundleId: domain.toolBundles[0]?.bundleId ?? `${domain.domainId}.default`,
            capabilityIds: domain.pluginBindings.map((binding) => binding.pluginId),
            toolNames: domain.toolBundles.flatMap((bundle) => bundle.tools.map((tool) => tool.toolName)),
            skillIds: domain.workflows.map((workflow) => workflow.workflowId),
            pluginIds: domain.pluginBindings.map((binding) => binding.pluginId),
            knowledgeNamespaces: [...(this.knowledgeNamespacesByDomain.get(domainId) ?? new Set())],
            defaultActivationPolicy: domain.status,
            trustTier: domain.capabilities.securityLevel,
        };
    }
    registerKnowledgeNamespace(namespace, ownerDomainId) {
        const existing = this.knowledgeNamespacesByDomain.get(ownerDomainId) ?? new Set();
        existing.add(namespace);
        this.knowledgeNamespacesByDomain.set(ownerDomainId, existing);
    }
    getOrThrow(domainId) {
        const domain = this.get(domainId);
        if (!domain) {
            throw new ValidationError("domain_registry.domain_not_found", `Domain ${domainId} not found.`, {
                category: "validation",
                source: "internal",
            });
        }
        return domain;
    }
    validateDefinition(parsed) {
        const seenWorkflowIds = new Set();
        for (const workflow of parsed.workflows) {
            if (seenWorkflowIds.has(workflow.workflowId)) {
                throw this.validationError("domain_registry.duplicate_workflow", "Domain workflow IDs must be unique.");
            }
            seenWorkflowIds.add(workflow.workflowId);
            const stepNames = new Set();
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
    validationError(code, message) {
        return new ValidationError(code, message, {
            category: "validation",
            source: "internal",
        });
    }
}
//# sourceMappingURL=domain-registry-service.js.map