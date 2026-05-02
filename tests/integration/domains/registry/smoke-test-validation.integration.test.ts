/**
 * Integration Test: Domain Smoke Test Validation
 *
 * Tests DomainSmokeTestRunner with various domain configurations:
 * - Workflow validation (no workflows, circular dependencies)
 * - Tool bundle validation
 * - Required tools validation
 * - Execution profile validation
 * - Sandbox compatibility checks
 * - Dependency graph validation
 */

import test from "node:test";
import assert from "node:assert/strict";
import { DomainSmokeTestRunner } from "../../../../src/domains/registry/domain-smoke-test.js";
import { DomainDefinitionSchema, type DomainDefinition, type DomainCapabilityProfile } from "../../../../src/domains/registry/domain-model.js";
import { type DomainExecutionProfile } from "../../../../src/domains/domain-specs.js";

function createTestDomain(overrides: Partial<DomainDefinition> = {}): DomainDefinition {
  return {
    domainId: "smoke-test-domain",
    name: "Smoke Test Domain",
    description: "A domain for smoke test validation",
    version: 1,
    workflows: [
      {
        workflowId: "wf_smoke",
        name: "Smoke Workflow",
        triggerConditions: {},
        steps: [
          {
            stepName: "step_smoke",
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
        bundleId: "smoke_tools",
        tools: [{ toolName: "bash", enabled: true, configOverrides: {} }],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["smoke"],
      requiredTools: ["bash"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "registered",
    externalAdapters: [],
    pluginBindings: [],
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
    ...overrides,
  };
}

test("smoke test: valid domain passes all checks", async () => {
  const domain = createTestDomain();
  const runner = new DomainSmokeTestRunner();

  const result = runner.run(domain);

  assert.equal(result.passed, true, `Expected pass but got issues: ${result.issues.join(", ")}`);
  assert.equal(result.runtimeChecks.length > 0, true);
});

test("smoke test: domain with no workflows fails", async () => {
  const domain = createTestDomain({ domainId: "no-workflows", workflows: [] });
  const runner = new DomainSmokeTestRunner();

  const result = runner.run(domain);

  assert.equal(result.passed, false);
  assert.ok(result.issues.includes("domain_registry.no_workflows"));
});

test("smoke test: domain with no tool bundles fails", async () => {
  const domain = createTestDomain({ domainId: "no-tools", toolBundles: [] });
  const runner = new DomainSmokeTestRunner();

  const result = runner.run(domain);

  assert.equal(result.passed, false);
  assert.ok(result.issues.includes("domain_registry.no_tool_bundles"));
});

test("smoke test: missing required tool in bundles fails", async () => {
  const domain = createTestDomain({
    domainId: "missing-required-tool",
    capabilities: {
      requiredTools: ["nonexistent_tool"],
      optionalTools: [],
      supportedTaskTypes: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
  });
  const runner = new DomainSmokeTestRunner();

  const result = runner.run(domain);

  assert.equal(result.passed, false);
  assert.ok(result.issues.includes("domain_registry.missing_required_tools"));
});

test("smoke test: circular workflow dependency fails", async () => {
  const domain = createTestDomain({
    domainId: "circular-deps",
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
  const runner = new DomainSmokeTestRunner();

  const result = runner.run(domain);

  assert.equal(result.passed, false);
  const depCheck = result.runtimeChecks.find((c) => c.checkId === "dependency_graph");
  assert.ok(depCheck);
  assert.equal(depCheck!.passed, false);
});

test("smoke test: sandbox compatibility fails for restricted tools without restricted security level", async () => {
  const domain = createTestDomain({
    domainId: "sandbox-incompatible",
    capabilities: {
      requiredTools: ["bash", "file_write"],
      optionalTools: [],
      supportedTaskTypes: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
  });
  const runner = new DomainSmokeTestRunner();

  const result = runner.run(domain);

  assert.equal(result.passed, false);
  const sandboxCheck = result.runtimeChecks.find((c) => c.checkId === "sandbox_compatibility");
  assert.ok(sandboxCheck);
  assert.equal(sandboxCheck!.passed, false);
});

test("smoke test: sandbox compatibility passes with restricted security level", async () => {
  const domain = createTestDomain({
    domainId: "sandbox-compatible",
    capabilities: {
      requiredTools: ["bash", "file_write"],
      optionalTools: [],
      supportedTaskTypes: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "restricted",
    },
  });
  const runner = new DomainSmokeTestRunner();

  const result = runner.run(domain);

  const sandboxCheck = result.runtimeChecks.find((c) => c.checkId === "sandbox_compatibility");
  assert.ok(sandboxCheck);
  assert.equal(sandboxCheck!.passed, true);
});

test("smoke test: missing executionProfile fails", async () => {
  const domain = createTestDomain({
    domainId: "no-execution-profile",
    executionProfile: undefined,
  });
  const runner = new DomainSmokeTestRunner();

  const result = runner.run(domain);

  const execCheck = result.runtimeChecks.find((c) => c.checkId === "execution_profile");
  assert.ok(execCheck);
  assert.equal(execCheck!.passed, false);
});

test("smoke test: executionProfile without planningMode fails", async () => {
  const domain = createTestDomain({
    domainId: "no-planning-mode",
    executionProfile: {
      executionMode: {
        planningMode: undefined as unknown as "llm_assisted",
        hotPathMode: "llm_allowed",
        llmInHotPathAllowed: true,
        maxHotPathLatencyMs: 1000,
      },
      latencyTier: "interactive",
      compiledArtifactRef: null,
    } as DomainExecutionProfile,
  });
  const runner = new DomainSmokeTestRunner();

  const result = runner.run(domain);

  const execCheck = result.runtimeChecks.find((c) => c.checkId === "execution_profile");
  assert.ok(execCheck);
  assert.equal(execCheck!.passed, false);
  assert.ok(execCheck!.details.includes("planningMode"));
});

test("smoke test: executionProfile without hotPathMode fails", async () => {
  const domain = createTestDomain({
    domainId: "no-hotpath-mode",
    executionProfile: {
      executionMode: {
        planningMode: "llm_assisted",
        hotPathMode: undefined as unknown as "llm_allowed",
        llmInHotPathAllowed: true,
        maxHotPathLatencyMs: 1000,
      },
      latencyTier: "interactive",
      compiledArtifactRef: null,
    } as DomainExecutionProfile,
  });
  const runner = new DomainSmokeTestRunner();

  const result = runner.run(domain);

  const execCheck = result.runtimeChecks.find((c) => c.checkId === "execution_profile");
  assert.ok(execCheck);
  assert.equal(execCheck!.passed, false);
  assert.ok(execCheck!.details.includes("hotPathMode"));
});

test("smoke test: executionProfile without latencyTier fails", async () => {
  const domain = createTestDomain({
    domainId: "no-latency-tier",
    executionProfile: {
      executionMode: {
        planningMode: "llm_assisted",
        hotPathMode: "llm_allowed",
        llmInHotPathAllowed: true,
        maxHotPathLatencyMs: 1000,
      },
      latencyTier: undefined as unknown as "interactive",
      compiledArtifactRef: null,
    } as DomainExecutionProfile,
  });
  const runner = new DomainSmokeTestRunner();

  const result = runner.run(domain);

  const execCheck = result.runtimeChecks.find((c) => c.checkId === "execution_profile");
  assert.ok(execCheck);
  assert.equal(execCheck!.passed, false);
  assert.ok(execCheck!.details.includes("latencyTier"));
});

test("smoke test: rollback points computed for steps with dependencies", async () => {
  const domain = createTestDomain({
    domainId: "rollback-points",
    workflows: [
      {
        workflowId: "wf_with_deps",
        name: "Workflow with Dependencies",
        triggerConditions: {},
        steps: [
          {
            stepName: "step_1",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 60000,
            dependsOn: [],
          },
          {
            stepName: "step_2",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 60000,
            dependsOn: ["step_1"],
          },
        ],
      },
    ],
  });
  const runner = new DomainSmokeTestRunner();

  const result = runner.run(domain);

  assert.ok(result.rollbackPoints.length > 0, "Expected rollback points for steps with dependencies");
  assert.ok(result.rollbackPoints.some((p) => p.includes("step_2")));
});

test("smoke test: valid multi-step workflow passes dependency check", async () => {
  const domain = createTestDomain({
    domainId: "valid-multi-step",
    workflows: [
      {
        workflowId: "linear_wf",
        name: "Linear Workflow",
        triggerConditions: {},
        steps: [
          {
            stepName: "init",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 60000,
            dependsOn: [],
          },
          {
            stepName: "process",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 60000,
            dependsOn: ["init"],
          },
          {
            stepName: "finalize",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 60000,
            dependsOn: ["process"],
          },
        ],
      },
    ],
  });
  const runner = new DomainSmokeTestRunner();

  const result = runner.run(domain);

  assert.equal(result.passed, true, `Expected pass but got: ${result.issues.join(", ")}`);
  const depCheck = result.runtimeChecks.find((c) => c.checkId === "dependency_graph");
  assert.ok(depCheck);
  assert.equal(depCheck!.passed, true);
});