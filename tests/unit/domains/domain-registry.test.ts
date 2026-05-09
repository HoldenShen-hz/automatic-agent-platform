import assert from "node:assert/strict";
import test from "node:test";

import { DomainRegistryService } from "../../../src/domains/registry/domain-registry-service.js";
import type { DomainDefinition } from "../../../src/domains/registry/domain-model.js";
import type { TypedEventPublisher } from "../../../src/platform/state-evidence/events/typed-event-publisher.js";

// Manual mock event publisher
function mockEventPublisher() {
  type DomainRegistryEvent = {
    eventType: "domain:registered" | "domain:activated";
    payload: {
      domainId: string;
      status: string;
      capabilityCount: number;
      pluginCount: number;
      occurredAt: string;
    };
  };
  const events: DomainRegistryEvent[] = [];
  return {
    events,
    publisher: {
      publish(input: { eventType: string; payload: Record<string, unknown> }) {
        events.push(input as DomainRegistryEvent);
      },
    } as TypedEventPublisher,
  };
}

// Minimal domain definition for testing get/deprecate
function minimalDomain(id: string, status: DomainDefinition["status"] = "active"): DomainDefinition {
  return {
    domainId: id,
    name: `Domain ${id}`,
    description: `Test domain ${id}`,
    version: 1,
    workflows: [
      {
        workflowId: `${id}.main`,
        name: "Main",
        triggerConditions: {},
        steps: [
          {
            stepName: "step1",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: [],
          },
        ],
      },
    ],
    toolBundles: [
      {
        bundleId: `${id}.tools`,
        tools: [{ toolName: "read", enabled: true, configOverrides: {} }],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["task"],
      requiredTools: ["read"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status,
    externalAdapters: [],
    pluginBindings: [],
  };
}

// Domain with circular dependency for cycle detection testing
function domainWithCircularDeps(): DomainDefinition {
  return {
    domainId: "cycle_test",
    name: "Cycle Test",
    description: "Domain with circular step dependencies",
    version: 1,
    workflows: [
      {
        workflowId: "cycle_wf",
        name: "Cycle Workflow",
        triggerConditions: {},
        steps: [
          {
            stepName: "step_a",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: ["step_c"],
          },
          {
            stepName: "step_b",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: ["step_a"],
          },
          {
            stepName: "step_c",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: ["step_b"],
          },
        ],
      },
    ],
    toolBundles: [
      {
        bundleId: "cycle.tools",
        tools: [{ toolName: "bash", enabled: true, configOverrides: {} }],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["task"],
      requiredTools: ["bash"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "restricted",
    },
    status: "testing",
    externalAdapters: [],
    pluginBindings: [],
  };
}

// Domain missing required tool in bundle
function domainWithMissingRequiredTool(): DomainDefinition {
  return {
    domainId: "missing_tool",
    name: "Missing Tool",
    description: "Domain where required tool is not in bundle",
    version: 1,
    workflows: [
      {
        workflowId: "wf",
        name: "Workflow",
        triggerConditions: {},
        steps: [
          {
            stepName: "step1",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: [],
          },
        ],
      },
    ],
    toolBundles: [
      {
        bundleId: "tools",
        tools: [{ toolName: "read", enabled: true, configOverrides: {} }],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["task"],
      requiredTools: ["write"], // not in bundle
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "testing",
    externalAdapters: [],
    pluginBindings: [],
  };
}

test("register emits domain:registered event", () => {
  const { events, publisher } = mockEventPublisher();
  const service = new DomainRegistryService({ eventPublisher: publisher });
  service.register(minimalDomain("d1"));
  assert.equal(events.length, 1);
  const firstEvent = events.at(0);
  assert.ok(firstEvent);
  assert.equal(firstEvent.eventType, "domain:registered");
  assert.equal(firstEvent.payload.domainId, "d1");
});

test("register and get retrieves stored domain", () => {
  const service = new DomainRegistryService();
  const domain = minimalDomain("fetch_test");
  service.register(domain);
  const retrieved = service.get("fetch_test");
  assert.notEqual(retrieved, null);
  assert.equal(retrieved!.domainId, "fetch_test");
});

test("get returns null for unregistered domain", () => {
  const service = new DomainRegistryService();
  assert.equal(service.get("nonexistent"), null);
});

test("list returns all registered domains", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("list_a"));
  service.register(minimalDomain("list_b"));
  const all = service.list();
  assert.equal(all.length, 2);
});

test("listActive returns only active domains", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("active_domain", "active"));
  service.register(minimalDomain("draft_domain", "draft"));
  const active = service.listActive();
  assert.equal(active.length, 1);
  const firstActive = active.at(0);
  assert.ok(firstActive);
  assert.equal(firstActive.domainId, "active_domain");
});

test("deprecate changes domain status", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("deprecate_me", "active"));
  const result = service.deprecate("deprecate_me");
  assert.equal(result.status, "deprecated");
  assert.equal(service.listActive().length, 0);
});

test("activate emits domain:activated event on success", () => {
  const { events, publisher } = mockEventPublisher();
  const service = new DomainRegistryService({ eventPublisher: publisher });
  service.register(minimalDomain("activate_me", "testing"));
  const result = service.activate("activate_me");
  assert.equal(result.status, "active");
  assert.ok(events.some((e) => e.eventType === "domain:activated"));
});

test("activate throws when smoke test fails", () => {
  const service = new DomainRegistryService();
  service.register(domainWithCircularDeps(), { skipSmokeTest: true });
  assert.throws(() => {
    service.activate("cycle_test");
  }, /smoke_test_failed|Domain smoke test failed/);
});

test("validate returns passed for valid domain", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("valid_domain"));
  const result = service.validate("valid_domain");
  assert.equal(result.passed, true);
  assert.equal(result.issues.length, 0);
});

test("validate returns failed for domain with circular dependencies", () => {
  const service = new DomainRegistryService();
  service.register(domainWithCircularDeps(), { skipSmokeTest: true });
  const result = service.validate("cycle_test");
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((i) => i.includes("runtime_checks_failed") || i.includes("dependency")));
});

test("validate returns failed for missing required tool", () => {
  const service = new DomainRegistryService();
  service.register(domainWithMissingRequiredTool(), { skipSmokeTest: true });
  const result = service.validate("missing_tool");
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((i) => i.includes("missing_required_tools")));
});

test("filterAllowedTools returns all matching tools", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("filter_test"));
  const allowed = service.filterAllowedTools("filter_test", ["read", "write", "bash"]);
  assert.ok(allowed.includes("read"));
  assert.ok(!allowed.includes("write"));
  assert.ok(!allowed.includes("bash"));
});

test("filterAllowedTools returns empty for unknown domain", () => {
  const service = new DomainRegistryService();
  const result = service.filterAllowedTools("unknown", ["read"]);
  assert.deepEqual(result, []);
});

test("getWorkflow returns workflow config", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("workflow_test"));
  const wf = service.getWorkflow("workflow_test", "workflow_test.main");
  assert.notEqual(wf, null);
  assert.equal(wf!.name, "Main");
});

test("getWorkflow returns null for unknown domain or workflow", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("wf_test"));
  assert.equal(service.getWorkflow("wf_test", "unknown"), null);
  assert.equal(service.getWorkflow("unknown", "wf_test.main"), null);
});

test("getToolBundle returns tool bundle config", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("bundle_test"));
  const bundle = service.getToolBundle("bundle_test", "bundle_test.tools");
  assert.notEqual(bundle, null);
  assert.equal(bundle!.tools.length, 1);
});

test("getToolBundle returns null for unknown bundle", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("tb_test"));
  assert.equal(service.getToolBundle("tb_test", "unknown"), null);
});

test("getOutputContract returns output contract config", () => {
  const service = new DomainRegistryService();
  const domain: DomainDefinition = {
    ...minimalDomain("contract_test"),
    outputContracts: [
      {
        contractId: "test_contract",
        name: "Test Contract",
        schema: { type: "object" },
        validationLevel: "strict",
      },
    ],
  };
  service.register(domain);
  const contract = service.getOutputContract("contract_test", "test_contract");
  assert.notEqual(contract, null);
  assert.equal(contract!.validationLevel, "strict");
});

test("getOutputContract returns null for unknown contract", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("oc_test"));
  assert.equal(service.getOutputContract("oc_test", "unknown"), null);
});

test("getPluginBindings returns sorted enabled bindings", () => {
  const service = new DomainRegistryService({
    installedPluginIds: ["p1", "p2", "p3"],
    healthyPluginIds: ["p1", "p2", "p3"],
  });
  const domain: DomainDefinition = {
    ...minimalDomain("plugin_test"),
    pluginBindings: [
      { bindingId: "b1", domainId: "plugin_test", pluginType: "presenter", pluginId: "p1", priority: 1, enabled: true, config: {} },
      { bindingId: "b2", domainId: "plugin_test", pluginType: "presenter", pluginId: "p2", priority: 3, enabled: true, config: {} },
      { bindingId: "b3", domainId: "plugin_test", pluginType: "retriever", pluginId: "p3", priority: 2, enabled: true, config: {} },
    ],
  };
  service.register(domain);
  const all = service.getPluginBindings("plugin_test");
  assert.equal(all.length, 3);
  const firstBinding = all.at(0);
  assert.ok(firstBinding);
  assert.equal(firstBinding.pluginId, "p2"); // highest priority first
});

test("getPluginBindings filters by pluginType", () => {
  const service = new DomainRegistryService({
    installedPluginIds: ["p1", "p2"],
    healthyPluginIds: ["p1", "p2"],
  });
  const domain: DomainDefinition = {
    ...minimalDomain("pt_filter"),
    pluginBindings: [
      { bindingId: "b1", domainId: "pt_filter", pluginType: "presenter", pluginId: "p1", priority: 1, enabled: true, config: {} },
      { bindingId: "b2", domainId: "pt_filter", pluginType: "retriever", pluginId: "p2", priority: 1, enabled: true, config: {} },
    ],
  };
  service.register(domain);
  const presenters = service.getPluginBindings("pt_filter", "presenter");
  assert.equal(presenters.length, 1);
  const firstPresenter = presenters.at(0);
  assert.ok(firstPresenter);
  assert.equal(firstPresenter.pluginType, "tool");
  assert.equal(firstPresenter.bindingRole, "presenter");
});

test("buildCapabilityEntry returns domain capability summary", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("cap_test"));
  const entry = service.buildCapabilityEntry("cap_test");
  assert.equal(entry.domainId, "cap_test");
  assert.ok(Array.isArray(entry.skillIds));
  assert.ok(Array.isArray(entry.toolNames));
  assert.equal(entry.trustTier, "standard");
});

test("buildCapabilityEntry throws for unknown domain", () => {
  const service = new DomainRegistryService();
  assert.throws(() => {
    service.buildCapabilityEntry("nonexistent");
  }, /Domain.*not found|domain_not_found/);
});

test("registerKnowledgeNamespace stores namespace mapping", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("ns_test"));
  service.registerKnowledgeNamespace("ns/repo", "ns_test");
  const entry = service.buildCapabilityEntry("ns_test");
  assert.ok(entry.knowledgeNamespaces.includes("ns/repo"));
});
