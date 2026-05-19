import assert from "node:assert/strict";
import test from "node:test";
import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import { PluginSpiRegistry } from "../../../../src/domains/registry/plugin-spi-registry.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
function makeSandboxPolicy(overrides = {}) {
    return {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: false,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 1,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
        allowedExternalDomains: [],
        maxResponseSizeBytes: 5 * 1024 * 1024,
        rateLimitPerMinute: 60,
        ...overrides,
    };
}
function makeMinimalDefinition(overrides = {}) {
    return {
        domainId: "test_domain",
        name: "Test Domain",
        description: "A test domain",
        version: 1,
        workflows: [
            {
                workflowId: "wf_test",
                name: "Test Workflow",
                triggerConditions: {},
                steps: [
                    {
                        stepName: "step_one",
                        toolHints: [],
                        modelHints: {},
                        outputSchema: null,
                        retryPolicy: { maxRetries: 0, backoffMs: 0 },
                        requiresReview: false,
                        timeoutMs: 60000,
                        dependsOn: [],
                    },
                ],
            },
        ],
        toolBundles: [
            {
                bundleId: "default",
                tools: [{ toolName: "bash", enabled: true, configOverrides: {} }],
            },
        ],
        outputContracts: [],
        promptOverrides: {},
        capabilities: {
            supportedTaskTypes: ["test"],
            requiredTools: ["bash"],
            optionalTools: [],
            modelPreferences: {},
            budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
            securityLevel: "standard",
        },
        status: "draft",
        externalAdapters: [],
        pluginBindings: [],
        ...overrides,
    };
}
// --- domain:registered event ---
test("register emits domain:registered event", () => {
    const events = [];
    const service = new DomainRegistryService({
        eventPublisher: {
            publish(input) {
                events.push(input);
            },
        },
    });
    service.register(makeMinimalDefinition({ domainId: "evt_test", status: "validated" }));
    assert.equal(events.length, 1);
    assert.equal(events[0].eventType, "domain:registered");
    assert.equal(events[0].payload.domainId, "evt_test");
    assert.equal(events[0].payload.status, "registered");
});
// --- duplicate workflow IDs ---
test("register throws when workflow IDs are duplicated", () => {
    const service = new DomainRegistryService();
    const definition = makeMinimalDefinition({
        domainId: "dup_wf",
        workflows: [
            { workflowId: "wf_a", name: "A", triggerConditions: {}, steps: [] },
            { workflowId: "wf_a", name: "A again", triggerConditions: {}, steps: [] },
        ],
    });
    assert.throws(() => service.register(definition), (err) => {
        return err instanceof ValidationError && err.code === "domain_registry.duplicate_workflow";
    });
});
// --- duplicate step names ---
test("register throws when step names are duplicated within a workflow", () => {
    const service = new DomainRegistryService();
    const definition = makeMinimalDefinition({
        domainId: "dup_step",
        workflows: [
            {
                workflowId: "wf_dup",
                name: "Duplicate Steps",
                triggerConditions: {},
                steps: [
                    { stepName: "step_a", toolHints: [], modelHints: {}, outputSchema: null, retryPolicy: { maxRetries: 0, backoffMs: 0 }, requiresReview: false, timeoutMs: 60000, dependsOn: [] },
                    { stepName: "step_a", toolHints: [], modelHints: {}, outputSchema: null, retryPolicy: { maxRetries: 0, backoffMs: 0 }, requiresReview: false, timeoutMs: 60000, dependsOn: [] },
                ],
            },
        ],
    });
    assert.throws(() => service.register(definition), (err) => {
        return err instanceof ValidationError && err.code === "domain_registry.duplicate_step_name";
    });
});
// --- invalid tool names ---
test("register throws when tool name contains slash", () => {
    const service = new DomainRegistryService();
    const definition = makeMinimalDefinition({
        domainId: "bad_tool",
        toolBundles: [
            { bundleId: "default", tools: [{ toolName: "some/tool", enabled: true, configOverrides: {} }] },
        ],
    });
    assert.throws(() => service.register(definition), (err) => {
        return err instanceof ValidationError && err.code === "domain_registry.invalid_tool_bundle";
    });
});
test("register throws when tool name contains double-dot", () => {
    const service = new DomainRegistryService();
    const definition = makeMinimalDefinition({
        domainId: "bad_tool2",
        toolBundles: [
            { bundleId: "default", tools: [{ toolName: "some..tool", enabled: true, configOverrides: {} }] },
        ],
    });
    assert.throws(() => service.register(definition), (err) => {
        return err instanceof ValidationError && err.code === "domain_registry.invalid_tool_bundle";
    });
});
// --- plugin binding domain mismatch ---
test("register throws when plugin binding domainId does not match registered domain", () => {
    const service = new DomainRegistryService({
        installedPluginIds: ["p1"],
        healthyPluginIds: ["p1"],
    });
    const definition = makeMinimalDefinition({
        domainId: "mismatch_domain",
        pluginBindings: [
            { bindingId: "b1", domainId: "other_domain", pluginType: "retriever", pluginId: "p1", priority: 1, enabled: true, config: {} },
        ],
    });
    assert.throws(() => service.register(definition), (err) => {
        return err instanceof ValidationError && err.code === "domain_registry.plugin_domain_mismatch";
    });
});
// --- plugin type mismatch ---
test("register throws when plugin binding type does not match plugin manifest", () => {
    const pluginRegistry = new PluginSpiRegistry();
    pluginRegistry.register({
        pluginId: "plugin_retriever",
        domainId: "type_mismatch",
        spiType: "retriever",
        async retrieve() { return []; },
    }, {
        pluginId: "plugin_retriever",
        name: "Retriever Plugin",
        version: "1.0.0",
        owner: "test",
        domainIds: ["type_mismatch"],
        capabilityIds: [],
        spiTypes: ["retriever"],
        extensionKind: "domain_plugin",
        trustLevel: "trusted",
        publicSdkSurface: "test",
        settingsSchema: {},
        sandbox: makeSandboxPolicy(),
    });
    const service = new DomainRegistryService({ pluginRegistry });
    const definition = makeMinimalDefinition({
        domainId: "type_mismatch",
        pluginBindings: [
            { bindingId: "b1", domainId: "type_mismatch", pluginType: "tool", bindingRole: "presenter", pluginId: "plugin_retriever", priority: 1, enabled: true, config: {} },
        ],
    });
    assert.throws(() => service.register(definition), (err) => {
        return err instanceof ValidationError && err.code === "domain_registry.plugin_type_mismatch";
    });
});
// --- plugin domain not allowed in manifest ---
test("register throws when plugin manifest does not allow the registered domain", () => {
    const pluginRegistry = new PluginSpiRegistry();
    pluginRegistry.register({
        pluginId: "plugin_limited",
        domainId: "allowed_domain",
        spiType: "retriever",
        async retrieve() { return []; },
    }, {
        pluginId: "plugin_limited",
        name: "Limited Plugin",
        version: "1.0.0",
        owner: "test",
        domainIds: ["allowed_domain"],
        capabilityIds: [],
        spiTypes: ["retriever"],
        extensionKind: "domain_plugin",
        trustLevel: "trusted",
        publicSdkSurface: "test",
        settingsSchema: {},
        sandbox: makeSandboxPolicy(),
    });
    const service = new DomainRegistryService({ pluginRegistry });
    const definition = makeMinimalDefinition({
        domainId: "not_allowed",
        pluginBindings: [
            { bindingId: "b1", domainId: "not_allowed", pluginType: "retriever", pluginId: "plugin_limited", priority: 1, enabled: true, config: {} },
        ],
    });
    assert.throws(() => service.register(definition), (err) => {
        return err instanceof ValidationError && err.code === "domain_registry.plugin_domain_not_allowed";
    });
});
// --- missing plugin when no registry ---
test("register throws when plugin binding references an unregistered plugin and no registry", () => {
    const service = new DomainRegistryService({
        installedPluginIds: [],
        healthyPluginIds: [],
    });
    const definition = makeMinimalDefinition({
        domainId: "missing_plugin",
        pluginBindings: [
            { bindingId: "b1", domainId: "missing_plugin", pluginType: "retriever", pluginId: "unknown_plugin", priority: 1, enabled: true, config: {} },
        ],
    });
    assert.throws(() => service.register(definition), (err) => {
        return err instanceof ValidationError && err.code === "domain_registry.plugin_missing";
    });
});
// --- unhealthy plugin ---
test("register throws when plugin binding references an unhealthy plugin", () => {
    const service = new DomainRegistryService({
        installedPluginIds: ["unhealthy_plugin"],
        healthyPluginIds: [],
    });
    const definition = makeMinimalDefinition({
        domainId: "unhealthy_plugin_domain",
        pluginBindings: [
            { bindingId: "b1", domainId: "unhealthy_plugin_domain", pluginType: "retriever", pluginId: "unhealthy_plugin", priority: 1, enabled: true, config: {} },
        ],
    });
    assert.throws(() => service.register(definition), (err) => {
        return err instanceof ValidationError && err.code === "domain_registry.plugin_unhealthy";
    });
});
// --- getOrThrow ---
test("activate throws for unknown domain", () => {
    const service = new DomainRegistryService();
    assert.throws(() => service.activate("unknown"), (err) => {
        return err instanceof ValidationError && err.code === "domain_registry.domain_not_found";
    });
});
test("deprecate throws for unknown domain", () => {
    const service = new DomainRegistryService();
    assert.throws(() => service.deprecate("unknown"), (err) => {
        return err instanceof ValidationError && err.code === "domain_registry.domain_not_found";
    });
});
test("validate throws for unknown domain", () => {
    const service = new DomainRegistryService();
    assert.throws(() => service.validate("unknown"), (err) => {
        return err instanceof ValidationError && err.code === "domain_registry.domain_not_found";
    });
});
test("buildCapabilityEntry throws for unknown domain", () => {
    const service = new DomainRegistryService();
    assert.throws(() => service.buildCapabilityEntry("unknown"), (err) => {
        return err instanceof ValidationError && err.code === "domain_registry.domain_not_found";
    });
});
// --- activate smoke test failure ---
test("activate throws when smoke test fails", () => {
    const service = new DomainRegistryService();
    service.register(makeMinimalDefinition({
        domainId: "smoke_fail",
        status: "registered",
        // no workflows — smoke test will fail
        workflows: [],
    }));
    assert.throws(() => service.activate("smoke_fail"), (err) => {
        return err instanceof ValidationError && err.code === "domain_registry.smoke_test_failed";
    });
});
// --- successful activate emits domain:activated ---
test("activate emits domain:activated event on success", () => {
    const events = [];
    const service = new DomainRegistryService({
        eventPublisher: {
            publish(input) {
                events.push(input);
            },
        },
    });
    service.register(makeMinimalDefinition({
        domainId: "activate_event",
        status: "validated",
        capabilities: {
            supportedTaskTypes: ["test"],
            requiredTools: [],
            optionalTools: ["bash"],
            modelPreferences: {},
            budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
            securityLevel: "standard",
        },
        workflows: [
            {
                workflowId: "wf_activate",
                name: "Activate Workflow",
                triggerConditions: {},
                steps: [
                    {
                        stepName: "step_one",
                        toolHints: [],
                        modelHints: {},
                        outputSchema: null,
                        retryPolicy: { maxRetries: 0, backoffMs: 0 },
                        requiresReview: false,
                        timeoutMs: 60000,
                        dependsOn: [],
                    },
                ],
            },
        ],
    }));
    service.activate("activate_event");
    assert.equal(events.length, 2);
    assert.equal(events[1].eventType, "domain:activated");
    assert.equal(events[1].payload.domainId, "activate_event");
    assert.equal(events[1].payload.status, "active");
});
// --- invalid schema parsing ---
test("register throws on invalid domain definition schema", () => {
    const service = new DomainRegistryService();
    assert.throws(() => {
        // @ts-expect-error — deliberately malformed input
        service.register({ domainId: "", name: "", description: "" });
    }, /domainId|at least 1 character|too_small|invalid/i);
});
test("register throws on workflow with empty workflowId", () => {
    const service = new DomainRegistryService();
    const definition = makeMinimalDefinition({
        workflows: [{ workflowId: "", name: "Invalid", triggerConditions: {}, steps: [] }],
    });
    assert.throws(() => service.register(definition));
});
//# sourceMappingURL=domain-registration.test.js.map