/**
 * Domain Registry Service Unit Tests - Canary State & Archive Methods
 *
 * Tests for issue #2174 (missing canary state) and issue #2175 (no archived state transition methods).
 *
 * Coverage:
 * - DomainRegistryService.activate() canary flag behavior
 * - DomainRegistryService.updating() transitions
 * - DomainRegistryService.completeUpdate() transitions
 * - DomainRegistryService.archive() transitions
 * - DomainRegistryService.deprecate() transitions
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
      securityLevel: "restricted",
    },
    executionProfile: {
      executionMode: {
        planningMode: "llm_assisted",
        hotPathMode: "llm_allowed",
        llmInHotPathAllowed: true,
        maxHotPathLatencyMs: 1000,
      },
      latencyTier: "interactive",
      compiledArtifactRef: null,
    },
    status: "validated",
    externalAdapters: [],
    pluginBindings: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Canary State Tests (Issue #2174)
// ─────────────────────────────────────────────────────────────────────────────

test("activate with canary=true transitions registered domains into canary", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "canary_registered", status: "registered" }));

  const result = service.activate("canary_registered", true);

  assert.equal(result.status, "canary");
});

test("activate with canary=false requires prior canary promotion", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "standard_registered", status: "registered" }));

  assert.throws(
    () => service.activate("standard_registered", false),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.invalid_activation_state",
  );
});

test("activate with canary=true transitions updating domains into canary", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "canary_updating", status: "updating" }));

  const result = service.activate("canary_updating", true);

  assert.equal(result.status, "canary");
});

test("activate with canary=false throws for non-registered domains", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "not_registered", status: "active" }));

  assert.throws(
    () => service.activate("not_registered", false),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.invalid_activation_state",
  );
});

test("activate with canary=true throws for non-updating/non-registered domains", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "canary_invalid", status: "draft" }));

  assert.throws(
    () => service.activate("canary_invalid", true),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.invalid_canary_state",
  );
});

test("canary activation publishes domain:activated event", () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });
  service.register(createTestDomain({ domainId: "canary_event_test", status: "registered" }));

  service.activate("canary_event_test", true);
  service.activate("canary_event_test", false);

  assert.ok(events.some((e) => e.eventType === "domain:activated"));
});

test("canary activation sets correct status in event payload", () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });
  service.register(createTestDomain({ domainId: "canary_payload_test", status: "registered" }));

  service.activate("canary_payload_test", true);
  service.activate("canary_payload_test", false);

  const activatedEvent = events.find((e) => e.eventType === "domain:activated");
  assert.ok(activatedEvent);
  assert.equal(activatedEvent.payload.status, "active");
});

// ─────────────────────────────────────────────────────────────────────────────
// Updating State Tests
// ─────────────────────────────────────────────────────────────────────────────

test("updating transitions domain from active to updating", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "updating_test", status: "active" }));

  const result = service.updating("updating_test");

  assert.equal(result.status, "updating");
});

test("updating emits domain:updating event", () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });
  service.register(createTestDomain({ domainId: "updating_event_test", status: "active" }));

  service.updating("updating_event_test");

  assert.ok(events.some((e) => e.eventType === "domain:updating"));
});

test("updating throws when domain is not active", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "updating_invalid_state", status: "registered" }));

  assert.throws(
    () => service.updating("updating_invalid_state"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.invalid_updating_state",
  );
});

test("updating throws for unknown domain", () => {
  const service = new DomainRegistryService();

  assert.throws(
    () => service.updating("unknown_domain"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.domain_not_found",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Complete Update Tests
// ─────────────────────────────────────────────────────────────────────────────

test("completeUpdate transitions domain from updating to active", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "complete_update_test", status: "updating" }));

  const result = service.completeUpdate("complete_update_test");

  assert.equal(result.status, "active");
});

test("completeUpdate emits domain:updated event", () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });
  service.register(createTestDomain({ domainId: "complete_update_event_test", status: "updating" }));

  service.completeUpdate("complete_update_event_test");

  assert.ok(events.some((e) => e.eventType === "domain:updated"));
});

test("completeUpdate throws when domain is not in updating state", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "complete_update_invalid", status: "active" }));

  assert.throws(
    () => service.completeUpdate("complete_update_invalid"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.invalid_complete_update_state",
  );
});

test("completeUpdate throws for unknown domain", () => {
  const service = new DomainRegistryService();

  assert.throws(
    () => service.completeUpdate("unknown_domain"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.domain_not_found",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Archive State Tests (Issue #2175)
// ─────────────────────────────────────────────────────────────────────────────

test("archive transitions domain from deprecated to archived", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "archive_test", status: "deprecated" }));

  const result = service.archive("archive_test");

  assert.equal(result.status, "archived");
});

test("archive emits domain:archived event", () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });
  service.register(createTestDomain({ domainId: "archive_event_test", status: "deprecated" }));

  service.archive("archive_event_test");

  assert.ok(events.some((e) => e.eventType === "domain:archived"));
});

test("archive event contains correct domainId and status", () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });
  service.register(createTestDomain({ domainId: "archive_payload_test", status: "deprecated" }));

  service.archive("archive_payload_test");

  const archivedEvent = events.find((e) => e.eventType === "domain:archived");
  assert.ok(archivedEvent);
  assert.equal(archivedEvent.payload.domainId, "archive_payload_test");
  assert.equal(archivedEvent.payload.status, "archived");
});

test("archive throws when domain is not deprecated", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "archive_invalid_state", status: "active" }));

  assert.throws(
    () => service.archive("archive_invalid_state"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.invalid_archive_state",
  );
});

test("archive throws for unknown domain", () => {
  const service = new DomainRegistryService();

  assert.throws(
    () => service.archive("unknown_domain"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.domain_not_found",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Deprecate State Tests
// ─────────────────────────────────────────────────────────────────────────────

test("deprecate transitions domain from active to deprecated", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "deprecate_test", status: "active" }));

  const result = service.deprecate("deprecate_test");

  assert.equal(result.status, "deprecated");
});

test("deprecate throws when domain is not active", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "deprecate_invalid_state", status: "registered" }));

  assert.throws(
    () => service.deprecate("deprecate_invalid_state"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.invalid_deprecate_state",
  );
});

test("deprecate throws for unknown domain", () => {
  const service = new DomainRegistryService();

  assert.throws(
    () => service.deprecate("unknown_domain"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.domain_not_found",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Full Lifecycle Tests
// ─────────────────────────────────────────────────────────────────────────────

test("full lifecycle: registered -> active -> updating -> active -> deprecated -> archived", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "full_lifecycle_test", status: "registered" }));

  // registered -> canary -> active
  let domain = service.activate("full_lifecycle_test", true);
  assert.equal(domain.status, "canary");
  domain = service.activate("full_lifecycle_test", false);
  assert.equal(domain.status, "active");

  // active -> updating
  domain = service.updating("full_lifecycle_test");
  assert.equal(domain.status, "updating");

  // updating -> active (complete update)
  domain = service.completeUpdate("full_lifecycle_test");
  assert.equal(domain.status, "active");

  // active -> deprecated
  domain = service.deprecate("full_lifecycle_test");
  assert.equal(domain.status, "deprecated");

  // deprecated -> archived
  domain = service.archive("full_lifecycle_test");
  assert.equal(domain.status, "archived");
});

test("canary lifecycle: canary -> active -> deprecated -> archived", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "canary_lifecycle_test", status: "canary" }));

  // canary -> active (canary activation)
  let domain = service.activate("canary_lifecycle_test", true);
  assert.equal(domain.status, "active");

  // active -> deprecated
  domain = service.deprecate("canary_lifecycle_test");
  assert.equal(domain.status, "deprecated");

  // deprecated -> archived
  domain = service.archive("canary_lifecycle_test");
  assert.equal(domain.status, "archived");
});

test("archived domains cannot be activated", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "archived_no_activate", status: "archived" }));

  assert.throws(
    () => service.activate("archived_no_activate", false),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.invalid_activation_state",
  );
});

test("archived domains cannot be updated", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "archived_no_update", status: "archived" }));

  assert.throws(
    () => service.updating("archived_no_update"),
    /invalid_updating_state|active/,
  );
});

test("archived domains cannot be deprecated", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "archived_no_deprecate", status: "archived" }));

  assert.throws(
    () => service.deprecate("archived_no_deprecate"),
    /invalid_deprecate_state|active/,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Smoke Test Integration
// ─────────────────────────────────────────────────────────────────────────────

test("activate fails smoke test when domain has invalid configuration", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({
    domainId: "smoke_fail_activate",
    status: "registered",
    workflows: [],
  }));
  assert.throws(
    () => {
      service.activate("smoke_fail_activate", true);
      service.activate("smoke_fail_activate");
    },
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.smoke_test_failed",
  );
});

test("completeUpdate fails smoke test when domain configuration becomes invalid", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({
    domainId: "smoke_fail_complete",
    status: "updating",
    workflows: [
      {
        workflowId: "wf_fail",
        name: "Failing Workflow",
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
            dependsOn: ["step_b"],
          },
          {
            stepName: "step_b",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 60000,
            dependsOn: ["step_a"],
          },
        ],
      },
    ],
  }));
  assert.throws(
    () => service.completeUpdate("smoke_fail_complete"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.smoke_test_failed",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// List Operations After State Transitions
// ─────────────────────────────────────────────────────────────────────────────

test("listActive excludes deprecated and archived domains", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "active_1", status: "active" }));
  service.register(createTestDomain({ domainId: "active_2", status: "active" }));
  service.register(createTestDomain({ domainId: "deprecated_1", status: "deprecated" }));
  service.register(createTestDomain({ domainId: "archived_1", status: "archived" }));

  const activeDomains = service.listActive();

  assert.equal(activeDomains.length, 2);
  assert.ok(activeDomains.some((d) => d.domainId === "active_1"));
  assert.ok(activeDomains.some((d) => d.domainId === "active_2"));
  assert.ok(!activeDomains.some((d) => d.domainId === "deprecated_1"));
  assert.ok(!activeDomains.some((d) => d.domainId === "archived_1"));
});

test("list returns all domains regardless of status", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "list_all_1", status: "active" }));
  service.register(createTestDomain({ domainId: "list_all_2", status: "deprecated" }));
  service.register(createTestDomain({ domainId: "list_all_3", status: "archived" }));

  const allDomains = service.list();

  assert.equal(allDomains.length, 3);
});
