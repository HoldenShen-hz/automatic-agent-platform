import assert from "node:assert/strict";
import test from "node:test";

import { DomainSmokeTestRunner, type DomainDefinition } from "../../../../src/domains/registry/index.js";
import {
  StepTemplateConfigSchema,
  ToolBundleEntrySchema,
} from "../../../../src/domains/registry/domain-model.js";

function createMinimalDefinition(): DomainDefinition {
  return {
    domainId: "coding",
    name: "Coding Domain",
    version: 1,
    description: "Code generation and review domain",
    workflows: [
      {
        workflowId: "wf_code",
        name: "Code Workflow",
        triggerConditions: {},
        steps: [
          StepTemplateConfigSchema.parse({ stepName: "plan", toolHints: ["planner"], dependsOn: [] }),
          StepTemplateConfigSchema.parse({ stepName: "execute", toolHints: ["bash"], dependsOn: ["plan"] }),
        ],
      },
    ],
    toolBundles: [
      {
        bundleId: "bundle_default",
        tools: [
          ToolBundleEntrySchema.parse({ toolName: "bash", enabled: true }),
          ToolBundleEntrySchema.parse({ toolName: "read", enabled: true }),
        ],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["code_generation"],
      requiredTools: ["bash", "read"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "restricted",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [],
  };
}

test("DomainSmokeTestRunner passes valid domain definition", () => {
  const runner = new DomainSmokeTestRunner();
  const result = runner.run(createMinimalDefinition());

  assert.equal(result.passed, true);
  assert.deepEqual(result.issues, []);
  assert.ok(result.runtimeChecks.length > 0);
});

test("DomainSmokeTestRunner detects missing workflows", () => {
  const runner = new DomainSmokeTestRunner();
  const definition: DomainDefinition = {
    ...createMinimalDefinition(),
    workflows: [],
  };

  const result = runner.run(definition);

  assert.equal(result.passed, false);
  assert.ok(result.issues.includes("domain_registry.no_workflows"));
});

test("DomainSmokeTestRunner detects missing tool bundles", () => {
  const runner = new DomainSmokeTestRunner();
  const definition: DomainDefinition = {
    ...createMinimalDefinition(),
    toolBundles: [],
  };

  const result = runner.run(definition);

  assert.equal(result.passed, false);
  assert.ok(result.issues.includes("domain_registry.no_tool_bundles"));
});

test("DomainSmokeTestRunner detects missing required tools", () => {
  const runner = new DomainSmokeTestRunner();
  const definition: DomainDefinition = {
    ...createMinimalDefinition(),
    toolBundles: [
      {
        bundleId: "bundle_limited",
        tools: [ToolBundleEntrySchema.parse({ toolName: "bash", enabled: true })],
      },
    ],
    capabilities: {
      ...createMinimalDefinition().capabilities,
      requiredTools: ["bash", "missing_tool"],
    },
  };

  const result = runner.run(definition);

  assert.equal(result.passed, false);
  assert.ok(result.issues.includes("domain_registry.missing_required_tools"));
});

test("DomainSmokeTestRunner detects circular workflow dependencies", () => {
  const runner = new DomainSmokeTestRunner();
  const definition: DomainDefinition = {
    ...createMinimalDefinition(),
    workflows: [
      {
        workflowId: "wf_cycle",
        name: "Cycle Workflow",
        triggerConditions: {},
        steps: [
          StepTemplateConfigSchema.parse({ stepName: "step_a", toolHints: [], dependsOn: ["step_b"] }),
          StepTemplateConfigSchema.parse({ stepName: "step_b", toolHints: [], dependsOn: ["step_a"] }),
        ],
      },
    ],
  };

  const result = runner.run(definition);

  assert.equal(result.passed, false);
  const depCheck = result.runtimeChecks.find((c) => c.checkId === "dependency_graph");
  assert.ok(depCheck);
  assert.equal(depCheck.passed, false);
});

test("DomainSmokeTestRunner validates sandbox compatibility with restricted tools", () => {
  const runner = new DomainSmokeTestRunner();
  const definition: DomainDefinition = {
    ...createMinimalDefinition(),
    capabilities: {
      ...createMinimalDefinition().capabilities,
      requiredTools: ["bash", "file_write"],
      securityLevel: "standard",
    },
  };

  const result = runner.run(definition);

  const sandboxCheck = result.runtimeChecks.find((c) => c.checkId === "sandbox_compatibility");
  assert.ok(sandboxCheck);
  assert.equal(sandboxCheck.passed, false);
});

test("DomainSmokeTestRunner passes sandbox check when security level is restricted", () => {
  const runner = new DomainSmokeTestRunner();
  const definition: DomainDefinition = {
    ...createMinimalDefinition(),
    capabilities: {
      ...createMinimalDefinition().capabilities,
      requiredTools: ["bash", "file_write"],
      securityLevel: "restricted",
    },
  };

  const result = runner.run(definition);

  const sandboxCheck = result.runtimeChecks.find((c) => c.checkId === "sandbox_compatibility");
  assert.ok(sandboxCheck);
  assert.equal(sandboxCheck.passed, true);
});

test("DomainSmokeTestRunner validates resource quota for maxTokensPerTask", () => {
  const runner = new DomainSmokeTestRunner();
  const definition: DomainDefinition = {
    ...createMinimalDefinition(),
    capabilities: {
      ...createMinimalDefinition().capabilities,
      budgetLimits: { maxTokensPerTask: 500, maxCostPerTask: 5 },
    },
  };

  const result = runner.run(definition);

  const quotaCheck = result.runtimeChecks.find((c) => c.checkId === "resource_quota");
  assert.ok(quotaCheck);
  assert.equal(quotaCheck.passed, false);
});

test("DomainSmokeTestRunner validates resource quota for maxCostPerTask", () => {
  const runner = new DomainSmokeTestRunner();
  const definition: DomainDefinition = {
    ...createMinimalDefinition(),
    capabilities: {
      ...createMinimalDefinition().capabilities,
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 0.001 },
    },
  };

  const result = runner.run(definition);

  const quotaCheck = result.runtimeChecks.find((c) => c.checkId === "resource_quota");
  assert.ok(quotaCheck);
  assert.equal(quotaCheck.passed, false);
});

test("DomainSmokeTestRunner returns rollback points for dependent steps", () => {
  const runner = new DomainSmokeTestRunner();
  const result = runner.run(createMinimalDefinition());

  assert.ok(result.rollbackPoints.length > 0);
  assert.ok(result.rollbackPoints.some((p) => p.includes("workflow:wf_code/step:execute")));
});

test("DomainSmokeTestRunner validates deterministic-only planning requires compiled artifact", () => {
  const runner = new DomainSmokeTestRunner();
  const definition: DomainDefinition = {
    ...createMinimalDefinition(),
    executionProfile: {
      executionMode: {
        planningMode: "deterministic_only",
        hotPathMode: "llm_allowed",
        llmInHotPathAllowed: true,
        maxHotPathLatencyMs: 1000,
      },
      latencyTier: "interactive",
      compiledArtifactRef: null,
    },
  };

  const result = runner.run(definition);
  const profileCheck = result.runtimeChecks.find((c) => c.checkId === "execution_profile");
  assert.ok(profileCheck);
  assert.equal(profileCheck.passed, false);
  assert.ok(result.issues.includes("domain_registry.runtime_checks_failed"));
});

test("DomainSmokeTestRunner validates deterministic hot path disables llm in hot path", () => {
  const runner = new DomainSmokeTestRunner();
  const definition: DomainDefinition = {
    ...createMinimalDefinition(),
    executionProfile: {
      executionMode: {
        planningMode: "llm_assisted",
        hotPathMode: "deterministic_only",
        llmInHotPathAllowed: true,
        maxHotPathLatencyMs: 500,
      },
      latencyTier: "interactive",
      compiledArtifactRef: "artifact://compiled/domain",
    },
  };

  const result = runner.run(definition);
  const profileCheck = result.runtimeChecks.find((c) => c.checkId === "execution_profile");
  assert.ok(profileCheck);
  assert.equal(profileCheck.passed, false);
});
