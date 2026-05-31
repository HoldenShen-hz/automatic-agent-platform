/**
 * DomainRegistryService Additional Method Tests
 *
 * Tests for methods not covered in domain-registry-service.test.ts:
 * - filterAllowedTools()
 * - getWorkflow()
 * - getToolBundle()
 * - getOutputContract()
 * - getPluginBindings()
 * - resolvePlugins()
 * - buildCapabilityEntry()
 * - registerKnowledgeNamespace()
 * - validate()
 * - get() / list() / listActive()
 */

import test from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import type { DomainDefinition } from "../../../../src/domains/registry/domain-model.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createTestDomain(overrides: Partial<DomainDefinition> = {}): DomainDefinition {
  return {
    domainId: "test-domain",
    name: "Test Domain",
    description: "A test domain for registry service testing",
    version: 1,
    workflows: [
      {
        workflowId: "wf_main",
        name: "Main Workflow",
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
        bundleId: "default_tools",
        tools: [
          { toolName: "bash", enabled: true, configOverrides: {} },
          { toolName: "read", enabled: true, configOverrides: {} },
          { toolName: "write", enabled: false, configOverrides: {} },
          { toolName: "deploy", enabled: true, configOverrides: {} },
        ],
      },
      {
        bundleId: "optional_tools",
        tools: [
          { toolName: "file_glob", enabled: true, configOverrides: {} },
        ],
      },
    ],
    outputContracts: [
      {
        contractId: "contract-1",
        name: "Output Contract 1",
        schema: { type: "object" },
        validationLevel: "strict",
      },
      {
        contractId: "contract-2",
        name: "Output Contract 2",
        schema: { type: "string" },
        validationLevel: "lenient",
      },
    ],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["test", "coding"],
      requiredTools: ["bash"],
      optionalTools: ["read", "file_glob"],
      modelPreferences: { default: "claude-3" },
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "restricted",
    },
    executionProfile: {
      executionMode: {
        planningMode: "llm_assisted",
        hotPathMode: "llm_allowed",
        llmInHotPathAllowed: true,
        maxHotPathLatencyMs: 1000,
      },
      latencyTier: "near_realtime",
      compiledArtifactRef: null,
    },
    status: "validated",
    externalAdapters: [],
    pluginBindings: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Basic Get/List Tests
// ─────────────────────────────────────────────────────────────────────────────

test("get returns registered domain", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "get-test-domain" }));

  const domain = service.get("get-test-domain");

  assert.ok(domain);
  assert.equal(domain!.domainId, "get-test-domain");
});

test("get returns null for unknown domain", () => {
  const service = new DomainRegistryService();

  const domain = service.get("unknown-domain");

  assert.equal(domain, null);
});

test("list returns all registered domains", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "list-domain-1" }));
  service.register(createTestDomain({ domainId: "list-domain-2" }));

  const domains = service.list();

  assert.equal(domains.length, 2);
});

test("listActive returns only active domains", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "active-domain", status: "active" }));
  service.register(createTestDomain({ domainId: "registered-domain", status: "registered" }));
  service.register(createTestDomain({ domainId: "deprecated-domain", status: "deprecated" }));

  const activeDomains = service.listActive();

  assert.equal(activeDomains.length, 1);
  assert.equal(activeDomains[0]!.domainId, "active-domain");
});

// ─────────────────────────────────────────────────────────────────────────────
// filterAllowedTools Tests
// ─────────────────────────────────────────────────────────────────────────────

test("filterAllowedTools returns empty array for unknown domain", () => {
  const service = new DomainRegistryService();

  const tools = service.filterAllowedTools("unknown-domain", ["bash", "read"]);

  assert.equal(tools.length, 0);
});

test("filterAllowedTools returns enabled tools from toolBundles", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const tools = service.filterAllowedTools("test-domain", ["bash", "read", "write", "deploy"]);

  // bash, read, deploy are enabled; write is disabled
  assert.ok(tools.includes("bash"));
  assert.ok(tools.includes("read"));
  assert.ok(tools.includes("deploy"));
  assert.ok(!tools.includes("write"));
});

test("filterAllowedTools includes requiredTools regardless of bundle status", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({
    status: "registered",
    capabilities: {
      supportedTaskTypes: ["test"],
      requiredTools: ["critical_tool"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "restricted",
    },
  }));

  const tools = service.filterAllowedTools("test-domain", ["bash", "critical_tool"]);

  assert.ok(tools.includes("critical_tool"));
});

test("filterAllowedTools includes optionalTools from capabilities", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  // read and file_glob are optionalTools
  const tools = service.filterAllowedTools("test-domain", ["read", "file_glob"]);

  assert.ok(tools.includes("read"));
  assert.ok(tools.includes("file_glob"));
});

test("filterAllowedTools filters based on provided toolNames", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const tools = service.filterAllowedTools("test-domain", ["bash"]);

  assert.equal(tools.length, 1);
  assert.ok(tools.includes("bash"));
});

// ─────────────────────────────────────────────────────────────────────────────
// getWorkflow Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getWorkflow returns workflow for known domain and workflowId", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const workflow = service.getWorkflow("test-domain", "wf_main");

  assert.ok(workflow);
  assert.equal(workflow!.workflowId, "wf_main");
  assert.equal(workflow!.steps.length, 1);
});

test("getWorkflow returns null for unknown domain", () => {
  const service = new DomainRegistryService();

  const workflow = service.getWorkflow("unknown-domain", "wf_main");

  assert.equal(workflow, null);
});

test("getWorkflow returns null for unknown workflowId", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const workflow = service.getWorkflow("test-domain", "unknown_workflow");

  assert.equal(workflow, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// getToolBundle Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getToolBundle returns tool bundle for known domain and bundleId", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const bundle = service.getToolBundle("test-domain", "default_tools");

  assert.ok(bundle);
  assert.equal(bundle!.bundleId, "default_tools");
  assert.equal(bundle!.tools.length, 4);
});

test("getToolBundle returns null for unknown domain", () => {
  const service = new DomainRegistryService();

  const bundle = service.getToolBundle("unknown-domain", "default_tools");

  assert.equal(bundle, null);
});

test("getToolBundle returns null for unknown bundleId", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const bundle = service.getToolBundle("test-domain", "unknown_bundle");

  assert.equal(bundle, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// getOutputContract Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getOutputContract returns contract for known domain and contractId", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const contract = service.getOutputContract("test-domain", "contract-1");

  assert.ok(contract);
  assert.equal(contract!.contractId, "contract-1");
  assert.equal(contract!.validationLevel, "strict");
});

test("getOutputContract returns null for unknown domain", () => {
  const service = new DomainRegistryService();

  const contract = service.getOutputContract("unknown-domain", "contract-1");

  assert.equal(contract, null);
});

test("getOutputContract returns null for unknown contractId", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const contract = service.getOutputContract("test-domain", "unknown_contract");

  assert.equal(contract, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// getPluginBindings Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getPluginBindings returns empty array when no plugin bindings exist", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const bindings = service.getPluginBindings("test-domain");

  assert.equal(bindings.length, 0);
});

test("getPluginBindings returns empty array for unknown domain", () => {
  const service = new DomainRegistryService();

  const bindings = service.getPluginBindings("unknown-domain");

  assert.equal(bindings.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// buildCapabilityEntry Tests
// ─────────────────────────────────────────────────────────────────────────────

test("buildCapabilityEntry returns capability entry for registered domain", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const entry = service.buildCapabilityEntry("test-domain");

  assert.equal(entry.domainId, "test-domain");
  assert.ok(entry.bundleId);
  assert.ok(entry.capabilityIds.length >= 0);
  assert.ok(entry.toolNames.length > 0);
  assert.ok(entry.skillIds.length > 0);
  // pluginIds can be 0 if no plugin bindings
  assert.ok(Array.isArray(entry.pluginIds));
});

test("buildCapabilityEntry throws for unknown domain [domain-registry-methods]", () => {
  const service = new DomainRegistryService();

  assert.throws(
    () => service.buildCapabilityEntry("unknown-domain"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.domain_not_found",
  );
});

test("buildCapabilityEntry includes knowledge namespaces", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());
  service.registerKnowledgeNamespace("ns:test", "test-domain");

  const entry = service.buildCapabilityEntry("test-domain");

  assert.ok(entry.knowledgeNamespaces.includes("ns:test"));
});

// ─────────────────────────────────────────────────────────────────────────────
// registerKnowledgeNamespace Tests
// ─────────────────────────────────────────────────────────────────────────────

test("registerKnowledgeNamespace adds namespace to domain", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  service.registerKnowledgeNamespace("ns:production", "test-domain");
  const entry = service.buildCapabilityEntry("test-domain");

  assert.ok(entry.knowledgeNamespaces.includes("ns:production"));
});

test("registerKnowledgeNamespace allows multiple namespaces per domain", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  service.registerKnowledgeNamespace("ns:first", "test-domain");
  service.registerKnowledgeNamespace("ns:second", "test-domain");

  const entry = service.buildCapabilityEntry("test-domain");

  assert.ok(entry.knowledgeNamespaces.includes("ns:first"));
  assert.ok(entry.knowledgeNamespaces.includes("ns:second"));
});

test("registerKnowledgeNamespace allows same namespace for different domains", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "domain-a" }));
  service.register(createTestDomain({ domainId: "domain-b" }));

  service.registerKnowledgeNamespace("ns:shared", "domain-a");
  service.registerKnowledgeNamespace("ns:shared", "domain-b");

  const entryA = service.buildCapabilityEntry("domain-a");
  const entryB = service.buildCapabilityEntry("domain-b");

  assert.ok(entryA.knowledgeNamespaces.includes("ns:shared"));
  assert.ok(entryB.knowledgeNamespaces.includes("ns:shared"));
});

// ─────────────────────────────────────────────────────────────────────────────
// validate Tests
// ─────────────────────────────────────────────────────────────────────────────

test("validate returns passed result for valid domain", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const result = service.validate("test-domain");

  assert.equal(result.passed, true);
  assert.equal(result.issues.length, 0);
});

test("validate returns failed result for domain with no workflows", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "no-workflow-domain", status: "registered", workflows: [] }));

  const result = service.validate("no-workflow-domain");

  assert.equal(result.passed, false);
  assert.ok(result.issues.some((i) => i.includes("no_workflows")));
});

test("validate returns failed result for domain with no tool bundles", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "no-tools-domain", status: "registered", toolBundles: [] }));

  const result = service.validate("no-tools-domain");

  assert.equal(result.passed, false);
  assert.ok(result.issues.some((i) => i.includes("no_tool_bundles")));
});

test("validate throws for unknown domain", () => {
  const service = new DomainRegistryService();

  assert.throws(
    () => service.validate("unknown-domain"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.domain_not_found",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Smoke Test Integration
// ─────────────────────────────────────────────────────────────────────────────

test("validate fails for domain with missing required tools after registration", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({
    domainId: "missing-required-tool",
    status: "registered",
    toolBundles: [
      {
        bundleId: "empty_bundle",
        tools: [{ toolName: "bash", enabled: true, configOverrides: {} }],
      },
    ],
    capabilities: {
      supportedTaskTypes: ["test"],
      requiredTools: ["nonexistent_tool"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "restricted",
    },
  }));

  const result = service.validate("missing-required-tool");
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.includes("missing_required_tools")));
});

test("validate fails for domain with empty workflows after registration", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "empty-workflow-domain", status: "registered", workflows: [] }));

  const result = service.validate("empty-workflow-domain");
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.includes("no_workflows")));
});

test("register publishes domain:registered event on success", () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });

  service.register(createTestDomain({ domainId: "event-test-domain" }));

  const registeredEvent = events.find((e) => e.eventType === "domain:registered");
  assert.ok(registeredEvent);
  assert.equal(registeredEvent.payload.domainId, "event-test-domain");
});
