/**
 * Domain Registration Full Coverage Integration Tests
 *
 * Additional integration tests to achieve maximum coverage of the domain
 * registration flow and edge cases.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { DomainRegistryService } from "../../../src/domains/registry/domain-registry-service.js";
import { ValidationError } from "../../../src/platform/contracts/errors.js";
import type { DomainDefinition } from "../../../src/domains/registry/domain-model.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createTestDomain(overrides: Partial<DomainDefinition> = {}): DomainDefinition {
  return {
    domainId: "integration-test-domain",
    name: "Integration Test Domain",
    description: "A domain for integration testing",
    version: 1,
    workflows: [
      {
        workflowId: "wf_integration",
        name: "Integration Workflow",
        triggerConditions: {},
        steps: [
          {
            stepName: "step_integration",
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
        bundleId: "integration_tools",
        tools: [{ toolName: "bash", enabled: true, configOverrides: {} }],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["integration"],
      requiredTools: ["bash"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "restricted",
    },
    status: "validated",
    externalAdapters: [],
    pluginBindings: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Multiple Domain Registration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("can register multiple domains with different IDs", async () => {
  const service = new DomainRegistryService();

  service.register(createTestDomain({ domainId: "domain-1" }));
  service.register(createTestDomain({ domainId: "domain-2" }));
  service.register(createTestDomain({ domainId: "domain-3" }));

  const domains = service.list();

  assert.equal(domains.length, 3);
});

test("can register multiple domains with different statuses", async () => {
  const service = new DomainRegistryService();

  service.register(createTestDomain({ domainId: "draft-domain", status: "draft" }));
  service.register(createTestDomain({ domainId: "registered-domain", status: "registered" }));
  service.register(createTestDomain({ domainId: "active-domain", status: "active" }));

  const domains = service.list();

  assert.equal(domains.length, 3);
});

test("registering duplicate domain ID throws error", async () => {
  const service = new DomainRegistryService();

  service.register(createTestDomain({ domainId: "duplicate-test" }));

  assert.throws(
    () => service.register(createTestDomain({ domainId: "duplicate-test" })),
    (err: unknown) => err instanceof ValidationError,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// State Transition Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("cannot activate domain from deprecated state", async () => {
  const service = new DomainRegistryService();

  service.register(createTestDomain({ domainId: "transition-test", status: "registered" }));
  service.activate("transition-test", false);
  service.deprecate("transition-test");

  assert.throws(
    () => service.activate("transition-test", false),
    (err: unknown) => err instanceof ValidationError,
  );
});

test("cannot deprecate domain from registered state", async () => {
  const service = new DomainRegistryService();

  service.register(createTestDomain({ domainId: "deprecate-invalid", status: "registered" }));

  assert.throws(
    () => service.deprecate("deprecate-invalid"),
    (err: unknown) => err instanceof ValidationError,
  );
});

test("cannot archive domain from active state", async () => {
  const service = new DomainRegistryService();

  service.register(createTestDomain({ domainId: "archive-invalid", status: "active" }));

  assert.throws(
    () => service.archive("archive-invalid"),
    (err: unknown) => err instanceof ValidationError,
  );
});

test("cannot completeUpdate from non-updating state", async () => {
  const service = new DomainRegistryService();

  service.register(createTestDomain({ domainId: "complete-invalid", status: "active" }));

  assert.throws(
    () => service.completeUpdate("complete-invalid"),
    (err: unknown) => err instanceof ValidationError,
  );
});

test("updating domain that is not active throws error", async () => {
  const service = new DomainRegistryService();

  service.register(createTestDomain({ domainId: "updating-invalid", status: "registered" }));

  assert.throws(
    () => service.updating("updating-invalid"),
    (err: unknown) => err instanceof ValidationError,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Smoke Test Failure Scenarios
// ─────────────────────────────────────────────────────────────────────────────

test("registration fails if workflow has step with invalid dependsOn", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({
    domainId: "invalid-dependency",
    workflows: [
      {
        workflowId: "wf_invalid",
        name: "Invalid Workflow",
        triggerConditions: {},
        steps: [
          {
            stepName: "step_a",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 60000,
            dependsOn: ["nonexistent_step"], // Invalid dependency
          },
        ],
      },
    ],
  });

  assert.throws(
    () => service.register(domain),
    (err: unknown) => err instanceof ValidationError,
  );
});

test("registration fails if step has duplicate name in workflow", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({
    domainId: "duplicate-step",
    workflows: [
      {
        workflowId: "wf_duplicate",
        name: "Duplicate Step Workflow",
        triggerConditions: {},
        steps: [
          {
            stepName: "same_name",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 60000,
            dependsOn: [],
          },
          {
            stepName: "same_name", // Duplicate!
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
  });

  assert.throws(
    () => service.register(domain),
    (err: unknown) => err instanceof ValidationError,
  );
});

test("registration fails if tool name contains path traversal", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({
    domainId: "path-traversal-tool",
    toolBundles: [
      {
        bundleId: "malicious_tools",
        tools: [{ toolName: "../etc/passwd", enabled: true, configOverrides: {} }],
      },
    ],
  });

  assert.throws(
    () => service.register(domain),
    (err: unknown) => err instanceof ValidationError,
  );
});

test("registration fails if tool name contains double dot", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({
    domainId: "double-dot-tool",
    toolBundles: [
      {
        bundleId: "bad_tools",
        tools: [{ toolName: "tool..name", enabled: true, configOverrides: {} }],
      },
    ],
  });

  assert.throws(
    () => service.register(domain),
    (err: unknown) => err instanceof ValidationError,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Plugin Binding Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("registration fails if plugin binding domain ID mismatch", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({
    domainId: "mismatch-domain",
    pluginBindings: [
      {
        bindingId: "binding-mismatch",
        domainId: "different-domain", // Mismatch!
        pluginType: "retriever",
        pluginId: "plugin-1",
        priority: 1,
        enabled: true,
        config: {},
      },
    ],
  });

  assert.throws(
    () => service.register(domain),
    (err: unknown) => err instanceof ValidationError,
  );
});

test("registration succeeds with valid plugin bindings", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({
    domainId: "valid-bindings",
    pluginBindings: [
      {
        bindingId: "binding-valid",
        domainId: "valid-bindings",
        pluginType: "retriever",
        pluginId: "installed-plugin",
        priority: 1,
        enabled: true,
        config: {},
      },
    ],
  });

  // This should succeed if the plugin is in installedPluginIds
  const registered = service.register(domain);
  assert.equal(registered.pluginBindings.length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Domain Status Transition Combinations
// ─────────────────────────────────────────────────────────────────────────────

test("valid transition: registered -> active (standard)", async () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "standard-active", status: "registered" }));

  const activated = service.activate("standard-active", false);

  assert.equal(activated.status, "active");
});

test("valid transition: canary -> active (canary)", async () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "canary-active", status: "canary" }));

  const activated = service.activate("canary-active", true);

  assert.equal(activated.status, "active");
});

test("valid transition: updating -> active (completeUpdate)", async () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "update-complete", status: "updating" }));

  const completed = service.completeUpdate("update-complete");

  assert.equal(completed.status, "active");
});

test("valid transition: active -> updating -> active (cycle)", async () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "update-cycle", status: "active" }));

  const updating = service.updating("update-cycle");
  assert.equal(updating.status, "updating");

  const completed = service.completeUpdate("update-cycle");
  assert.equal(completed.status, "active");
});

test("valid transition: active -> deprecated -> archived", async () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "deprecate-archive", status: "active" }));

  const deprecated = service.deprecate("deprecate-archive");
  assert.equal(deprecated.status, "deprecated");

  const archived = service.archive("deprecate-archive");
  assert.equal(archived.status, "archived");
});

test("valid transition: registered -> active -> deprecated -> archived", async () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "full-transition", status: "registered" }));

  service.activate("full-transition", false);
  service.deprecate("full-transition");
  const archived = service.archive("full-transition");

  assert.equal(archived.status, "archived");
});

// ─────────────────────────────────────────────────────────────────────────────
// Empty and Minimal Configuration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("can register domain with empty workflows array", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({ domainId: "no-workflows", workflows: [] });

  const registered = service.register(domain);

  assert.equal(registered.workflows.length, 0);
});

test("can register domain with empty toolBundles array", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({ domainId: "no-tools", toolBundles: [] });

  const registered = service.register(domain);

  assert.equal(registered.toolBundles.length, 0);
});

test("can register domain with empty pluginBindings array", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({ domainId: "no-plugins", pluginBindings: [] });

  const registered = service.register(domain);

  assert.equal(registered.pluginBindings.length, 0);
});

test("can register domain with empty outputContracts array", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({ domainId: "no-contracts", outputContracts: [] });

  const registered = service.register(domain);

  assert.equal(registered.outputContracts.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Default Capability Profile Tests
// ─────────────────────────────────────────────────────────────────────────────

test("domain has default capability profile when not specified", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({
    domainId: "default-capabilities",
    capabilities: undefined as unknown as DomainDefinition["capabilities"],
  });

  const registered = service.register(domain);

  assert.ok(registered.capabilities !== undefined);
  assert.deepEqual(registered.capabilities.supportedTaskTypes, []);
  assert.deepEqual(registered.capabilities.requiredTools, []);
  assert.deepEqual(registered.capabilities.optionalTools, []);
});

test("domain capability profile preserves specified values", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({
    domainId: "custom-capabilities",
    capabilities: {
      supportedTaskTypes: ["coding", "analysis", "writing"],
      requiredTools: ["bash", "git"],
      optionalTools: ["docker"],
      modelPreferences: { default: "claude-3", coding: "claude-3-5" },
      budgetLimits: { maxTokensPerTask: 8000, maxCostPerTask: 10 },
      securityLevel: "elevated",
    },
  });

  const registered = service.register(domain);

  assert.deepEqual(registered.capabilities.supportedTaskTypes, ["coding", "analysis", "writing"]);
  assert.deepEqual(registered.capabilities.requiredTools, ["bash", "git"]);
  assert.deepEqual(registered.capabilities.optionalTools, ["docker"]);
  assert.equal(registered.capabilities.securityLevel, "elevated");
});

// ─────────────────────────────────────────────────────────────────────────────
// Event Payload Content Tests
// ─────────────────────────────────────────────────────────────────────────────

test("domain:registered event has correct capabilityCount", async () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });

  service.register(createTestDomain({
    domainId: "event-capability-count",
    pluginBindings: [
      {
        bindingId: "b1",
        domainId: "event-capability-count",
        pluginType: "retriever",
        pluginId: "p1",
        priority: 1,
        enabled: true,
        config: {},
      },
      {
        bindingId: "b2",
        domainId: "event-capability-count",
        pluginType: "adapter",
        pluginId: "p2",
        priority: 1,
        enabled: true,
        config: {},
      },
    ],
  }));

  const event = events.find((e) => e.eventType === "domain:registered");
  assert.ok(event);
  // capabilityCount should equal pluginBindings.length
  assert.equal(event.payload.capabilityCount, 2);
});

test("domain:activated event has occurredAt timestamp", async () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });
  service.register(createTestDomain({ domainId: "event-timestamp", status: "registered" }));

  service.activate("event-timestamp", false);

  const event = events.find((e) => e.eventType === "domain:activated");
  assert.ok(event);
  assert.ok(typeof event.payload.occurredAt === "string");
  assert.ok(event.payload.occurredAt.length > 0);
});

test("domain:updating event has correct status payload", async () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });
  service.register(createTestDomain({ domainId: "event-updating", status: "active" }));

  service.updating("event-updating");

  const event = events.find((e) => e.eventType === "domain:updating");
  assert.ok(event);
  assert.equal(event.payload.domainId, "event-updating");
  assert.equal(event.payload.status, "updating");
});

test("domain:updated event has correct status payload", async () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });
  service.register(createTestDomain({ domainId: "event-updated", status: "updating" }));

  service.completeUpdate("event-updated");

  const event = events.find((e) => e.eventType === "domain:updated");
  assert.ok(event);
  assert.equal(event.payload.domainId, "event-updated");
  assert.equal(event.payload.status, "active");
});

test("domain:archived event has correct occurredAt timestamp", async () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });
  service.register(createTestDomain({ domainId: "event-archived", status: "deprecated" }));

  service.archive("event-archived");

  const event = events.find((e) => e.eventType === "domain:archived");
  assert.ok(event);
  assert.ok(typeof event.payload.occurredAt === "string");
});

// ─────────────────────────────────────────────────────────────────────────────
// Lookup After State Transition Tests
// ─────────────────────────────────────────────────────────────────────────────

test("get returns updated domain after state transition", async () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "lookup-transition", status: "registered" }));

  service.activate("lookup-transition", false);

  const domain = service.get("lookup-transition");
  assert.ok(domain !== null);
  assert.equal(domain!.status, "active");
});

test("listActive excludes domain after deprecation", async () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "active-before", status: "active" }));
  service.deprecate("active-before");

  const activeDomains = service.listActive();

  assert.ok(!activeDomains.some((d) => d.domainId === "active-before"));
});

test("listActive excludes domain after archiving", async () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "active-archive", status: "active" }));
  service.deprecate("active-archive");
  service.archive("active-archive");

  const activeDomains = service.listActive();

  assert.ok(!activeDomains.some((d) => d.domainId === "active-archive"));
});

test("getWorkflow returns workflow from updated domain", async () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "workflow-transition", status: "registered" }));
  service.activate("workflow-transition", false);

  const workflow = service.getWorkflow("workflow-transition", "wf_integration");

  assert.ok(workflow !== null);
  assert.equal(workflow!.workflowId, "wf_integration");
});

test("getToolBundle returns bundle from updated domain", async () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "bundle-transition", status: "registered" }));
  service.activate("bundle-transition", false);

  const bundle = service.getToolBundle("bundle-transition", "integration_tools");

  assert.ok(bundle !== null);
  assert.equal(bundle!.bundleId, "integration_tools");
});
