import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainCapabilityProfileSchema,
  DomainDefinitionSchema,
  OutputContractConfigSchema,
  PluginBindingSchema,
  StepTemplateConfigSchema,
  ToolBundleConfigSchema,
  WorkflowConfigSchema,
  type DomainDefinition,
} from "../../../src/domains/registry/domain-model.js";

test("StepTemplateConfigSchema provides workflow step defaults", () => {
  const step = StepTemplateConfigSchema.parse({
    stepName: "collect_evidence",
  });

  assert.deepEqual(step.toolHints, []);
  assert.equal(step.timeoutMs, 60000);
  assert.deepEqual(step.dependsOn, []);
  assert.equal(step.retryPolicy.maxRetries, 0);
});

test("WorkflowConfigSchema accepts a workflow with normalized step definitions", () => {
  const workflow = WorkflowConfigSchema.parse({
    workflowId: "wf_test",
    name: "Test Workflow",
    steps: [{ stepName: "step_a" }, { stepName: "step_b", dependsOn: ["step_a"] }],
  });

  assert.equal(workflow.steps.length, 2);
  assert.deepEqual(workflow.steps[1]?.dependsOn, ["step_a"]);
});

test("ToolBundleConfigSchema accepts tool bundle entries with defaults", () => {
  const bundle = ToolBundleConfigSchema.parse({
    bundleId: "bundle_ops",
    tools: [{ toolName: "repo_map" }],
  });

  assert.equal(bundle.tools[0]?.enabled, true);
  assert.deepEqual(bundle.tools[0]?.configOverrides, {});
});

test("OutputContractConfigSchema accepts validation level and schema payload", () => {
  const contract = OutputContractConfigSchema.parse({
    contractId: "contract_1",
    name: "Contract",
    schema: { result: "string" },
    validationLevel: "lenient",
  });

  assert.equal(contract.validationLevel, "lenient");
  assert.deepEqual(contract.schema, { result: "string" });
});

test("DomainCapabilityProfileSchema provides budget and security defaults", () => {
  const profile = DomainCapabilityProfileSchema.parse({});

  assert.equal(profile.budgetLimits.maxTokensPerTask, 4000);
  assert.equal(profile.budgetLimits.maxCostPerTask, 5);
  assert.equal(profile.securityLevel, "standard");
});

test("PluginBindingSchema normalizes legacy planner and validator bindings", () => {
  const planner = PluginBindingSchema.parse({
    bindingId: "bind_planner",
    domainId: "test-domain",
    pluginType: "planner",
    pluginId: "planner_plugin",
  });
  const validator = PluginBindingSchema.parse({
    bindingId: "bind_validator",
    domainId: "test-domain",
    pluginType: "validator",
    pluginId: "validator_plugin",
  });

  assert.equal(planner.pluginType, "tool");
  assert.equal(planner.bindingRole, undefined);
  assert.equal(validator.pluginType, "evaluator");
  assert.equal(validator.bindingRole, undefined);
});

test("DomainDefinitionSchema provides default execution profile and status", () => {
  const definition = DomainDefinitionSchema.parse({
    domainId: "analytics",
    name: "Analytics",
    description: "Analytics domain",
  });

  assert.equal(definition.status, "draft");
  assert.equal(definition.executionProfile.executionMode.planningMode, "llm_assisted");
  assert.equal(definition.executionProfile.latencyTier, "interactive");
});

test("DomainDefinitionSchema accepts current domain definition shape", () => {
  const definition = DomainDefinitionSchema.parse({
    domainId: "ops-domain",
    name: "Operations",
    description: "Operations domain",
    workflows: [
      {
        workflowId: "ops_wf",
        name: "Ops Workflow",
        steps: [{ stepName: "triage" }],
      },
    ],
    toolBundles: [
      {
        bundleId: "ops_bundle",
        tools: [{ toolName: "repo_map" }],
      },
    ],
    capabilities: {
      supportedTaskTypes: ["incident"],
      requiredTools: ["repo_map"],
      optionalTools: ["question"],
    },
    pluginBindings: [
      {
        bindingId: "ops_presenter",
        domainId: "ops-domain",
        pluginType: "presenter",
        pluginId: "presenter_plugin",
      },
    ],
  }) as DomainDefinition;

  assert.equal(definition.pluginBindings[0]?.pluginType, "tool");
  assert.equal(definition.pluginBindings[0]?.bindingRole, undefined);
  assert.equal(definition.workflows[0]?.steps[0]?.stepName, "triage");
});
