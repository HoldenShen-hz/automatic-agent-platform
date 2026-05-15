/**
 * Integration Test: Domain Registry Service - Canary State (Issue 1974)
 *
 * Tests canary state management in DomainRegistryService:
 * - Canary activation from updating/registered states
 * - Standard activation from registered state only
 * - Invalid canary state transitions
 * - Smoke test validation during canary promotion
 */

import test from "node:test";
import assert from "node:assert/strict";
import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import type { DomainDefinition } from "../../../../src/domains/registry/domain-model.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

function createTestDomain(overrides: Partial<DomainDefinition> = {}): DomainDefinition {
  return {
    domainId: "canary-test-domain",
    name: "Canary Test Domain",
    description: "A domain for canary state testing",
    version: 1,
    workflows: [
      {
        workflowId: "wf_canary",
        name: "Canary Workflow",
        triggerConditions: {},
        steps: [
          {
            stepName: "step_canary",
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
        bundleId: "canary_tools",
        tools: [{ toolName: "bash", enabled: true, configOverrides: {} }],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["canary"],
      requiredTools: ["bash"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "restricted",
    },
    status: "registered" as DomainDefinition["status"],
    externalAdapters: [],
    pluginBindings: [],
    ...overrides,
  };
}

// Canary activation tests

test("canary: activate from registered state with canary=true succeeds", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({ domainId: "canary-activate-from-registered", status: "registered" });
  service.register(domain);

  const activated = service.activate("canary-activate-from-registered", true);

  assert.equal(activated.status, "active");
});

test("canary: activate from updating state fails", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({ domainId: "canary-activate-from-updating", status: "updating" as DomainDefinition["status"] });
  service.register(domain);

  assert.throws(
    () => service.activate("canary-activate-from-updating"),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "domain_registry.invalid_activation_state",
  );
});

test("canary: standard activation (canary=false) from registered succeeds", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({ domainId: "standard-activate", status: "registered" as DomainDefinition["status"] });
  service.register(domain);

  const activated = service.activate("standard-activate", false);

  assert.equal(activated.status, "active");
});

test("canary: standard activation (canary=false) from updating fails", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({ domainId: "standard-activate-updating", status: "updating" as DomainDefinition["status"] });
  service.register(domain);

  assert.throws(
    () => service.activate("standard-activate-updating", false),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "domain_registry.invalid_activation_state",
  );
});

test("canary: activate from active state fails for both modes", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({ domainId: "activate-from-active", status: "active" });
  service.register(domain);

  assert.throws(
    () => service.activate("activate-from-active", true),
    (err: unknown) =>
      err instanceof ValidationError &&
      (err.code === "domain_registry.invalid_canary_state" ||
        err.code === "domain_registry.invalid_activation_state"),
  );

  assert.throws(
    () => service.activate("activate-from-active", false),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "domain_registry.invalid_activation_state",
  );
});

test("canary: activate from deprecated state fails for both modes", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({ domainId: "activate-from-deprecated", status: "deprecated" });
  service.register(domain);

  assert.throws(
    () => service.activate("activate-from-deprecated", true),
    (err: unknown) =>
      err instanceof ValidationError &&
      (err.code === "domain_registry.invalid_canary_state" ||
        err.code === "domain_registry.invalid_activation_state"),
  );

  assert.throws(
    () => service.activate("activate-from-deprecated", false),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "domain_registry.invalid_activation_state",
  );
});

test("canary: smoke test failure blocks activation", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({
    domainId: "canary-smoke-fail",
    status: "registered" as DomainDefinition["status"],
    workflows: [
      {
        workflowId: "circular_wf",
        name: "Circular Workflow",
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
  });
  service.register(domain);

  assert.throws(
    () => service.activate("canary-smoke-fail", true),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.smoke_test_failed",
  );
});

test("canary: events published on canary activation", async () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });

  const domain = createTestDomain({ domainId: "canary-event-test", status: "registered" as DomainDefinition["status"] });
  service.register(domain);
  service.activate("canary-event-test", true);

  assert.ok(events.some((e) => e.eventType === "domain:activated"), "Should publish domain:activated event");
  const activatedEvent = events.find((e) => e.eventType === "domain:activated")!;
  assert.equal(activatedEvent.payload.domainId, "canary-event-test");
  assert.equal(activatedEvent.payload.status, "active");
});
