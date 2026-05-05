import test from "node:test";
import assert from "node:assert/strict";

import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import type { DomainDefinition } from "../../../../src/domains/registry/domain-model.js";

function createMinimalDomain(overrides: Partial<DomainDefinition> = {}): DomainDefinition {
  return {
    domainId: "test-domain",
    name: "Test Domain",
    description: "A domain for testing",
    version: 1,
    workflows: [
      {
        workflowId: "wf_test",
        name: "Test Workflow",
        triggerConditions: {},
        steps: [
          {
            stepName: "step_one",
            toolHints: ["tool_a"],
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
        bundleId: "bundle_test",
        tools: [
          { toolName: "tool_a", enabled: true, configOverrides: {} },
          { toolName: "tool_b", enabled: true, configOverrides: {} },
        ],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["task_type_1"],
      requiredTools: ["tool_a"],
      optionalTools: ["tool_b"],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 2000, maxCostPerTask: 2.0 },
      securityLevel: "standard",
    },
    status: "validated",
    externalAdapters: [],
    pluginBindings: [],
    ...overrides,
  };
}

test("RegisterDomain registers a new domain", () => {
  const service = new DomainRegistryService();
  const domain = createMinimalDomain({ domainId: "new-domain", name: "New Domain" });

  const registered = service.register(domain);

  assert.equal(registered.domainId, "new-domain");
  assert.equal(registered.name, "New Domain");
  assert.equal(registered.status, "registered");
});

test("getDomain retrieves domain by ID", () => {
  const service = new DomainRegistryService();
  const domain = createMinimalDomain({ domainId: "retrieve-domain", name: "Retrieve Domain" });
  service.register(domain);

  const retrieved = service.get("retrieve-domain");

  assert.notEqual(retrieved, null);
  assert.equal(retrieved?.domainId, "retrieve-domain");
  assert.equal(retrieved?.name, "Retrieve Domain");
});

test("getDomain returns null for unknown domain ID", () => {
  const service = new DomainRegistryService();

  const retrieved = service.get("unknown-domain");

  assert.equal(retrieved, null);
});

test("listDomains returns all registered domains", () => {
  const service = new DomainRegistryService();
  service.register(createMinimalDomain({ domainId: "domain_1", name: "Domain One" }));
  service.register(createMinimalDomain({ domainId: "domain_2", name: "Domain Two" }));
  service.register(createMinimalDomain({ domainId: "domain_3", name: "Domain Three" }));

  const domains = service.list();

  assert.equal(domains.length, 3);
  assert.ok(domains.some((d) => d.domainId === "domain_1"));
  assert.ok(domains.some((d) => d.domainId === "domain_2"));
  assert.ok(domains.some((d) => d.domainId === "domain_3"));
});

test("listDomains returns empty array when no domains registered", () => {
  const service = new DomainRegistryService();

  const domains = service.list();

  assert.equal(domains.length, 0);
});

test("Domain has correct workflow after registration", () => {
  const service = new DomainRegistryService();
  const domain = createMinimalDomain({
    domainId: "workflow-domain",
    workflows: [
      {
        workflowId: "wf_primary",
        name: "Primary Workflow",
        triggerConditions: {},
        steps: [
          {
            stepName: "execute",
            toolHints: ["tool_x"],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 3, backoffMs: 500 },
            requiresReview: true,
            timeoutMs: 5000,
            dependsOn: [],
          },
        ],
      },
    ],
  });
  service.register(domain);

  const retrieved = service.get("workflow-domain");
  assert.notEqual(retrieved, null);

  const workflow = service.getWorkflow("workflow-domain", "wf_primary");
  assert.notEqual(workflow, null);
  assert.equal(workflow?.workflowId, "wf_primary");
  assert.equal(workflow?.name, "Primary Workflow");
  assert.equal(workflow?.steps.length, 1);
  assert.equal(workflow?.steps[0].stepName, "execute");
  assert.equal(workflow?.steps[0].retryPolicy.maxRetries, 3);
  assert.equal(workflow?.steps[0].requiresReview, true);
});

test("Domain has correct tool bundle after registration", () => {
  const service = new DomainRegistryService();
  const domain = createMinimalDomain({
    domainId: "bundle-domain",
    status: "registered",
    toolBundles: [
      {
        bundleId: "bundle_primary",
        tools: [
          { toolName: "tool_alpha", enabled: true, configOverrides: {} },
          { toolName: "tool_beta", enabled: true, configOverrides: {} },
          { toolName: "tool_gamma", enabled: false, configOverrides: {} },
        ],
      },
    ],
  });
  service.register(domain);

  const retrieved = service.get("bundle-domain");
  assert.notEqual(retrieved, null);

  const bundle = service.getToolBundle("bundle-domain", "bundle_primary");
  assert.notEqual(bundle, null);
  assert.equal(bundle?.bundleId, "bundle_primary");
  assert.equal(bundle?.tools.length, 3);
  assert.ok(bundle?.tools.some((t) => t.toolName === "tool_alpha" && t.enabled));
  assert.ok(bundle?.tools.some((t) => t.toolName === "tool_beta" && t.enabled));
  assert.ok(bundle?.tools.some((t) => t.toolName === "tool_gamma" && !t.enabled));
});

test("getWorkflow returns null for unknown domain or workflow", () => {
  const service = new DomainRegistryService();

  assert.equal(service.getWorkflow("unknown", "wf"), null);

  const domain = createMinimalDomain({ domainId: "existing" });
  service.register(domain);

  assert.equal(service.getWorkflow("existing", "unknown_wf"), null);
});

test("getToolBundle returns null for unknown domain or bundle", () => {
  const service = new DomainRegistryService();

  assert.equal(service.getToolBundle("unknown", "bundle"), null);

  const domain = createMinimalDomain({ domainId: "existing" });
  service.register(domain);

  assert.equal(service.getToolBundle("existing", "unknown_bundle"), null);
});

test("register publishes domain:registered event", () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input);
      },
    },
  });

  service.register(createMinimalDomain({ domainId: "event-domain" }));

  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "domain:registered");
  assert.equal(events[0].payload.domainId, "event-domain");
});

test("domain registration with multiple workflows", () => {
  const service = new DomainRegistryService();
  const domain = createMinimalDomain({
    domainId: "multi-wf-domain",
    workflows: [
      {
        workflowId: "wf_1",
        name: "Workflow One",
        triggerConditions: {},
        steps: [{ stepName: "s1", toolHints: [], modelHints: {}, outputSchema: null, retryPolicy: { maxRetries: 0, backoffMs: 0 }, requiresReview: false, timeoutMs: 1000, dependsOn: [] }],
      },
      {
        workflowId: "wf_2",
        name: "Workflow Two",
        triggerConditions: {},
        steps: [{ stepName: "s2", toolHints: [], modelHints: {}, outputSchema: null, retryPolicy: { maxRetries: 0, backoffMs: 0 }, requiresReview: false, timeoutMs: 1000, dependsOn: [] }],
      },
    ],
  });
  service.register(domain);

  const retrieved = service.get("multi-wf-domain");
  assert.notEqual(retrieved, null);
  assert.equal(retrieved?.workflows.length, 2);

  assert.notEqual(service.getWorkflow("multi-wf-domain", "wf_1"), null);
  assert.notEqual(service.getWorkflow("multi-wf-domain", "wf_2"), null);
});

test("domain registration with multiple tool bundles", () => {
  const service = new DomainRegistryService();
  const domain = createMinimalDomain({
    domainId: "multi-bundle-domain",
    status: "registered",
    toolBundles: [
      {
        bundleId: "bundle_a",
        tools: [{ toolName: "tool_a1", enabled: true, configOverrides: {} }],
      },
      {
        bundleId: "bundle_b",
        tools: [{ toolName: "tool_b1", enabled: true, configOverrides: {} }],
      },
    ],
  });
  service.register(domain);

  const retrieved = service.get("multi-bundle-domain");
  assert.notEqual(retrieved, null);
  assert.equal(retrieved?.toolBundles.length, 2);

  assert.notEqual(service.getToolBundle("multi-bundle-domain", "bundle_a"), null);
  assert.notEqual(service.getToolBundle("multi-bundle-domain", "bundle_b"), null);
});
