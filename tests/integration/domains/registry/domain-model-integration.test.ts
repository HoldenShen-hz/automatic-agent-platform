/**
 * Integration Test: DomainModel Schemas
 *
 * Tests domain model schemas including DomainDefinition,
 * DomainLifecycleState, and related type validation.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainDefinitionSchema,
  type DomainDefinition,
} from "../../../../src/domains/registry/domain-model.js";
import { DomainLifecycleStateSchema } from "../../../../src/domains/domain-specs.js";

test("DomainDefinitionSchema integration: parses full domain definition", () => {
  const definition = {
    domainId: "finance-domain",
    name: "Finance Domain",
    description: "Domain for financial operations",
    version: 1,
    workflows: [
      {
        workflowId: "finance.primary",
        name: "Primary Finance Workflow",
        steps: [
          {
            stepName: "validate-input",
            toolHints: ["input-validator"],
            requiresReview: true,
          },
        ],
      },
    ],
    toolBundles: [
      {
        bundleId: "finance-tools",
        tools: [{ toolName: "calculator", enabled: true }],
      },
    ],
    outputContracts: [
      {
        contractId: "finance-result",
        name: "Finance Result",
        schema: { type: "object" },
        validationLevel: "strict",
      },
    ],
    promptOverrides: { system: "You are a finance assistant." },
    capabilities: {
      supportedTaskTypes: ["financial_analysis", "reporting"],
      requiredTools: ["calculator", "spreadsheet"],
      securityLevel: "restricted",
    },
    status: "active",
    externalAdapters: ["erp-adapter"],
    pluginBindings: [],
  };

  const result = DomainDefinitionSchema.parse(definition);
  assert.equal(result.domainId, "finance-domain");
  assert.equal(result.status, "active");
  assert.equal(result.workflows.length, 1);
  assert.equal(result.toolBundles.length, 1);
  assert.equal(result.capabilities.securityLevel, "restricted");
});

test("DomainDefinitionSchema integration: normalizes 'testing' status to 'validated'", () => {
  const definition = {
    domainId: "test-domain",
    name: "Test Domain",
    description: "A test domain",
    status: "testing",
  };

  const result = DomainDefinitionSchema.parse(definition);
  assert.equal(result.status, "validated");
});

test("DomainDefinitionSchema integration: aliases plugin types correctly", () => {
  const definition = {
    domainId: "plugin-domain",
    name: "Plugin Domain",
    description: "Domain with plugin type aliases",
    pluginBindings: [
      { bindingId: "b1", domainId: "plugin-domain", pluginType: "planner", pluginId: "planner-1" },
      { bindingId: "b2", domainId: "plugin-domain", pluginType: "presenter", pluginId: "presenter-1" },
      { bindingId: "b3", domainId: "plugin-domain", pluginType: "validator", pluginId: "validator-1" },
      { bindingId: "b4", domainId: "plugin-domain", pluginType: "tool", pluginId: "tool-1" },
    ],
  };

  const result = DomainDefinitionSchema.parse(definition);
  assert.equal(result.pluginBindings[0]!.pluginType, "tool");
  assert.equal(result.pluginBindings[1]!.pluginType, "tool");
  assert.equal(result.pluginBindings[2]!.pluginType, "evaluator");
  assert.equal(result.pluginBindings[3]!.pluginType, "tool");
});

test("DomainDefinitionSchema integration: applies defaults for optional fields", () => {
  const definition = {
    domainId: "basic-domain",
    name: "Basic Domain",
    description: "Basic domain with minimal config",
  };

  const result = DomainDefinitionSchema.parse(definition);
  assert.equal(result.version, 1);
  assert.deepEqual(result.workflows, []);
  assert.deepEqual(result.toolBundles, []);
  assert.deepEqual(result.outputContracts, []);
  assert.deepEqual(result.promptOverrides, {});
  assert.deepEqual(result.externalAdapters, []);
  assert.deepEqual(result.pluginBindings, []);
  assert.equal(result.status, "draft");
});

test("DomainDefinitionSchema integration: rejects empty domainId", () => {
  assert.throws(() => {
    DomainDefinitionSchema.parse({
      domainId: "",
      name: "Test",
      description: "desc",
    });
  });
});

test("DomainDefinitionSchema integration: rejects negative version", () => {
  assert.throws(() => {
    DomainDefinitionSchema.parse({
      domainId: "test",
      name: "Test",
      description: "desc",
      version: 0,
    });
  });
});

test("DomainDefinitionSchema integration: rejects invalid status", () => {
  assert.throws(() => {
    DomainDefinitionSchema.parse({
      domainId: "test",
      name: "Test",
      description: "desc",
      status: "inactive",
    });
  });
});

test("DomainLifecycleStateSchema integration: accepts all valid states", () => {
  const states = {
    draft: "validating",
    validated: "certified",
    registered: "canary",
    active: "active",
    updating: "canary",
    deprecated: "deprecated",
    archived: "retired",
  } as const;

  for (const [state, canonical] of Object.entries(states)) {
    const result = DomainLifecycleStateSchema.parse(state);
    assert.equal(result, canonical);
  }
});

test("DomainLifecycleStateSchema integration: rejects invalid states", () => {
  assert.throws(() => {
    DomainLifecycleStateSchema.parse("pending");
  });
});

test("DomainDefinition type integration: correctly infers type from parse", () => {
  const definition = DomainDefinitionSchema.parse({
    domainId: "typed-definition",
    name: "Typed Definition",
    description: "desc",
  });

  const _check: DomainDefinition = definition;
  assert.ok(_check);
});
