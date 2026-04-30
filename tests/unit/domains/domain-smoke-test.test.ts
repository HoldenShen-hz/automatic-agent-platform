import assert from "node:assert/strict";
import test from "node:test";

import { DomainSmokeTestRunner } from "../../../src/domains/registry/domain-smoke-test.js";
import type { DomainDefinition } from "../../../src/domains/registry/domain-model.js";

function minimalDomain(domainId: string): DomainDefinition {
  return {
    domainId,
    name: `Test Domain ${domainId}`,
    description: "Test domain for smoke testing",
    version: 1,
    workflows: [],
    toolBundles: [],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: [],
      requiredTools: [],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "draft",
    externalAdapters: [],
    pluginBindings: [],
  };
}

test("DomainSmokeTestRunner.run passes for valid domain", () => {
  const runner = new DomainSmokeTestRunner();
  const domain: DomainDefinition = {
    domainId: "valid_domain",
    name: "Valid Domain",
    description: "A valid test domain",
    version: 1,
    workflows: [
      {
        workflowId: "wf_test",
        name: "Test Workflow",
        triggerConditions: {},
        steps: [
          {
            stepName: "step1",
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
        bundleId: "bundle_test",
        tools: [{ toolName: "repo_map", enabled: true, configOverrides: {} }],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["bugfix"],
      requiredTools: ["repo_map"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "draft",
    executionProfile: {
      executionMode: {
        planningMode: "async",
        hotPathMode: "sync",
      },
      latencyTier: "normal",
    },
    externalAdapters: [],
    pluginBindings: [],
  };

  const result = runner.run(domain);
  assert.equal(result.passed, true);
  assert.equal(result.issues.length, 0);
});

test("DomainSmokeTestRunner.run fails when no workflows", () => {
  const runner = new DomainSmokeTestRunner();
  const domain = minimalDomain("no_workflows");
  domain.toolBundles = [
    { bundleId: "bundle", tools: [{ toolName: "t1", enabled: true, configOverrides: {} }] },
  ];

  const result = runner.run(domain);
  assert.equal(result.passed, false);
  assert.ok(result.issues.includes("domain_registry.no_workflows"));
});

test("DomainSmokeTestRunner.run fails when no tool bundles", () => {
  const runner = new DomainSmokeTestRunner();
  const domain = minimalDomain("no_bundles");
  domain.workflows = [
    {
      workflowId: "wf",
      name: "Test",
      triggerConditions: {},
      steps: [
        {
          stepName: "step1",
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
  ];

  const result = runner.run(domain);
  assert.equal(result.passed, false);
  assert.ok(result.issues.includes("domain_registry.no_tool_bundles"));
});

test("DomainSmokeTestRunner.run fails when required tools missing", () => {
  const runner = new DomainSmokeTestRunner();
  const domain: DomainDefinition = {
    ...minimalDomain("missing_tools"),
    workflows: [
      {
        workflowId: "wf",
        name: "Test",
        triggerConditions: {},
        steps: [
          {
            stepName: "step1",
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
        bundleId: "bundle",
        tools: [{ toolName: "unrelated_tool", enabled: true, configOverrides: {} }],
      },
    ],
    capabilities: {
      ...minimalDomain("missing_tools").capabilities,
      requiredTools: ["missing_required_tool"],
    },
  };

  const result = runner.run(domain);
  assert.equal(result.passed, false);
  assert.ok(result.issues.includes("domain_registry.missing_required_tools"));
});

test("DomainSmokeTestRunner.run validates executionProfile", () => {
  const runner = new DomainSmokeTestRunner();
  const domain: DomainDefinition = {
    ...minimalDomain("exec_profile_test"),
    workflows: [
      {
        workflowId: "wf",
        name: "Test",
        triggerConditions: {},
        steps: [
          {
            stepName: "step1",
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
      { bundleId: "bundle", tools: [{ toolName: "t1", enabled: true, configOverrides: {} }] },
    ],
    executionProfile: {
      executionMode: {
        planningMode: "async",
        hotPathMode: "sync",
      },
      latencyTier: "normal",
    },
  };

  const result = runner.run(domain);
  const execCheck = result.runtimeChecks.find((c) => c.checkId === "execution_profile");
  assert.notEqual(execCheck, undefined);
  assert.equal(execCheck!.passed, true);
});

test("DomainSmokeTestRunner.run validates dependency graph", () => {
  const runner = new DomainSmokeTestRunner();
  const domain: DomainDefinition = {
    ...minimalDomain("dep_graph_test"),
    workflows: [
      {
        workflowId: "wf",
        name: "Test",
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
    toolBundles: [
      { bundleId: "bundle", tools: [{ toolName: "t1", enabled: true, configOverrides: {} }] },
    ],
    executionProfile: {
      executionMode: {
        planningMode: "async",
        hotPathMode: "sync",
      },
      latencyTier: "normal",
    },
  };

  const result = runner.run(domain);
  const depCheck = result.runtimeChecks.find((c) => c.checkId === "dependency_graph");
  assert.notEqual(depCheck, undefined);
  assert.equal(depCheck!.passed, false);
});

test("DomainSmokeTestRunner.run validates resource quotas", () => {
  const runner = new DomainSmokeTestRunner();
  const domain: DomainDefinition = {
    ...minimalDomain("quota_test"),
    workflows: [
      {
        workflowId: "wf",
        name: "Test",
        triggerConditions: {},
        steps: [
          {
            stepName: "step1",
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
      { bundleId: "bundle", tools: [{ toolName: "t1", enabled: true, configOverrides: {} }] },
    ],
    capabilities: {
      ...minimalDomain("quota_test").capabilities,
      budgetLimits: { maxTokensPerTask: 500, maxCostPerTask: 0.001 },
    },
    executionProfile: {
      executionMode: {
        planningMode: "async",
        hotPathMode: "sync",
      },
      latencyTier: "normal",
    },
  };

  const result = runner.run(domain);
  const quotaCheck = result.runtimeChecks.find((c) => c.checkId === "resource_quota");
  assert.notEqual(quotaCheck, undefined);
  assert.equal(quotaCheck!.passed, false);
});

test("DomainSmokeTestRunner.run validates sandbox compatibility for restricted tools", () => {
  const runner = new DomainSmokeTestRunner();
  const domain: DomainDefinition = {
    ...minimalDomain("sandbox_test"),
    workflows: [
      {
        workflowId: "wf",
        name: "Test",
        triggerConditions: {},
        steps: [
          {
            stepName: "step1",
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
      { bundleId: "bundle", tools: [{ toolName: "bash", enabled: true, configOverrides: {} }] },
    ],
    capabilities: {
      ...minimalDomain("sandbox_test").capabilities,
      requiredTools: ["bash"],
      securityLevel: "standard",
    },
    executionProfile: {
      executionMode: {
        planningMode: "async",
        hotPathMode: "sync",
      },
      latencyTier: "normal",
    },
  };

  const result = runner.run(domain);
  const sandboxCheck = result.runtimeChecks.find((c) => c.checkId === "sandbox_compatibility");
  assert.notEqual(sandboxCheck, undefined);
  assert.equal(sandboxCheck!.passed, false);
});

test("DomainSmokeTestRunner.run passes sandbox compatibility for restricted tools with restricted security level", () => {
  const runner = new DomainSmokeTestRunner();
  const domain: DomainDefinition = {
    ...minimalDomain("sandbox_ok"),
    workflows: [
      {
        workflowId: "wf",
        name: "Test",
        triggerConditions: {},
        steps: [
          {
            stepName: "step1",
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
      { bundleId: "bundle", tools: [{ toolName: "bash", enabled: true, configOverrides: {} }] },
    ],
    capabilities: {
      ...minimalDomain("sandbox_ok").capabilities,
      requiredTools: ["bash"],
      securityLevel: "restricted",
    },
    executionProfile: {
      executionMode: {
        planningMode: "async",
        hotPathMode: "sync",
      },
      latencyTier: "normal",
    },
  };

  const result = runner.run(domain);
  const sandboxCheck = result.runtimeChecks.find((c) => c.checkId === "sandbox_compatibility");
  assert.notEqual(sandboxCheck, undefined);
  assert.equal(sandboxCheck!.passed, true);
});

test("DomainSmokeTestRunner.computeRollbackPoints identifies steps with dependencies", () => {
  const runner = new DomainSmokeTestRunner();
  const domain: DomainDefinition = {
    ...minimalDomain("rollback_test"),
    workflows: [
      {
        workflowId: "wf",
        name: "Test",
        triggerConditions: {},
        steps: [
          {
            stepName: "step1",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 60000,
            dependsOn: [],
          },
          {
            stepName: "step2",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 60000,
            dependsOn: ["step1"],
          },
        ],
      },
    ],
    toolBundles: [
      { bundleId: "bundle", tools: [{ toolName: "t1", enabled: true, configOverrides: {} }] },
    ],
  };

  const result = runner.run(domain);
  assert.ok(result.rollbackPoints.length > 0);
  assert.ok(result.rollbackPoints.some((p) => p.includes("step2")));
});

test("DomainSmokeTestRunner.run validates domain without executionProfile", () => {
  const runner = new DomainSmokeTestRunner();
  const domain: DomainDefinition = {
    ...minimalDomain("no_exec_profile"),
    workflows: [
      {
        workflowId: "wf",
        name: "Test",
        triggerConditions: {},
        steps: [
          {
            stepName: "step1",
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
      { bundleId: "bundle", tools: [{ toolName: "t1", enabled: true, configOverrides: {} }] },
    ],
  };

  const result = runner.run(domain);
  const execCheck = result.runtimeChecks.find((c) => c.checkId === "execution_profile");
  assert.notEqual(execCheck, undefined);
  assert.equal(execCheck!.passed, false);
});
