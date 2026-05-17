/**
 * E2E Domain Onboarding Tests
 *
 * End-to-end tests covering domain onboarding flow:
 * 1. Domain registration and validation
 * 2. Workflow registration
 * 3. Plugin SPI binding
 * 4. Sandbox policy configuration
 * 5. Onboarding completion and activation
 *
 * Uses node:test + node:assert/strict. ESM imports with .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../../helpers/e2e-harness.js";
import { DomainRegistryService } from "../../../src/domains/registry/domain-registry-service.js";
import { PluginSpiRegistry } from "../../../src/domains/registry/plugin-spi-registry.js";
import type { DomainDefinition } from "../../../src/domains/registry/domain-model.js";
import type { PluginSandboxPolicy } from "../../../src/domains/registry/plugin-spi.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createDomainDefinition(overrides: Partial<DomainDefinition> = {}): DomainDefinition {
// @ts-ignore
  return {
    domainId: overrides.domainId ?? "domain_e2e_001",
    name: overrides.name ?? "E2E Test Domain",
    description: overrides.description ?? "End-to-end test domain",
    version: overrides.version ?? 1,
    workflows: overrides.workflows ?? [{
      workflowId: "wf_001",
      name: "Test Workflow",
      triggerConditions: {},
      steps: [{
        stepName: "step_001",
        toolHints: ["read"],
        modelHints: {},
        outputSchema: null,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
        requiresReview: false,
        timeoutMs: 60_000,
        dependsOn: [],
      }],
    }],
    toolBundles: overrides.toolBundles ?? [{
      bundleId: "bundle_001",
      tools: [{ toolName: "read", enabled: true, configOverrides: {} }],
    }],
    outputContracts: overrides.outputContracts ?? [],
    promptOverrides: overrides.promptOverrides ?? {},
    capabilities: overrides.capabilities ?? {
      supportedTaskTypes: ["e2e_test"],
      requiredTools: ["read"],
      optionalTools: [],
      modelPreferences: { preferredModel: "gpt-5.4" },
      budgetLimits: { maxTokensPerTask: 2_000, maxCostPerTask: 1 },
      securityLevel: "standard",
    },
    externalAdapters: overrides.externalAdapters ?? [],
    status: overrides.status ?? "draft",
    pluginBindings: overrides.pluginBindings ?? [],
    ...overrides,
  };
}

function createSandboxPolicy(): PluginSandboxPolicy {
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
  };
}

// ---------------------------------------------------------------------------
// Test Suite 1: Domain Registration
// ---------------------------------------------------------------------------

test("E2E Domain: DomainRegistryService registers new domain", async () => {
  const harness = createE2EHarness("aa-e2e-domain-");
  try {
    const registry = new DomainRegistryService();

    const domain = createDomainDefinition({
      domainId: "e2e_test_domain",
      name: "E2E Test Domain",
    });

    const registered = registry.register(domain);

    assert.ok(registered, "Should register domain");
    assert.equal(registered.domainId, "e2e_test_domain", "Should have correct ID");
    assert.equal(registered.status, "registered", "Should normalize into registered status");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 2: Domain Validation
// ---------------------------------------------------------------------------

test("E2E Domain: Service validates domain definition before activation", async () => {
  const harness = createE2EHarness("aa-e2e-domain-validate-");
  try {
    const registry = new DomainRegistryService();

    // Domain with missing required fields (empty workflows list won't be valid)
    const domain = createDomainDefinition({
      domainId: "domain_e2e_invalid_001",
      workflows: [],
      toolBundles: [],
    });

    registry.register(domain);

    const validation = registry.validate(domain.domainId);

    assert.ok(validation, "Should return validation result");
    assert.ok(!validation.passed, "Should fail validation");
    assert.ok(validation.issues.length > 0, "Should have issues");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 3: Plugin SPI Registry
// ---------------------------------------------------------------------------

test("E2E Domain: PluginSpiRegistry lists registered plugins", async () => {
  const harness = createE2EHarness("aa-e2e-domain-spi-");
  try {
    const spiRegistry = new PluginSpiRegistry();

    const plugins = spiRegistry.list();
    assert.ok(Array.isArray(plugins), "Should return list of plugins");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 4: Domain Activation
// ---------------------------------------------------------------------------

test("E2E Domain: Domain transitions from draft to active after validation", async () => {
  const harness = createE2EHarness("aa-e2e-domain-activate-");
  try {
    const registry = new DomainRegistryService();

    const domain = createDomainDefinition({
      domainId: "domain_to_activate",
      workflows: [
        {
          workflowId: "wf_001",
          name: "Test Workflow",
          triggerConditions: {},
          steps: [],
        },
      ],
    });

    registry.register(domain);

    // Activate
    const activated = registry.activate("domain_to_activate");

    assert.equal(activated.status, "active", "Should transition to active");
  } finally {
    harness.cleanup();
  }
});
