import assert from "node:assert/strict";
import test from "node:test";

import { ToolBundleRegistry } from "../../../src/domains/registry/tool-bundle-registry.js";
import { WorkflowRegistry } from "../../../src/domains/registry/workflow-registry.js";
import { ContractRegistry } from "../../../src/domains/registry/contract-registry.js";

test("ToolBundleRegistry stores and retrieves bundles", () => {
  const registry = new ToolBundleRegistry();
  const bundle = {
    bundleId: "coding_tools",
    tools: [
      { toolName: "repo_map", enabled: true, configOverrides: {} },
      { toolName: "code_search", enabled: true, configOverrides: { timeout: 5000 } },
    ],
  };
  registry.registerAll([bundle]);

  const retrieved = registry.get("coding_tools");
  assert.notEqual(retrieved, null);
  assert.equal(retrieved!.bundleId, "coding_tools");
  assert.equal(retrieved!.tools.length, 2);
});

test("ToolBundleRegistry.get returns null for unknown bundle", () => {
  const registry = new ToolBundleRegistry();
  assert.equal(registry.get("nonexistent"), null);
});

test("ToolBundleRegistry.list returns all registered bundles", () => {
  const registry = new ToolBundleRegistry();
  registry.registerAll([
    { bundleId: "bundle_a", tools: [] },
    { bundleId: "bundle_b", tools: [] },
  ]);

  const listed = registry.list();
  assert.equal(listed.length, 2);
  assert.ok(listed.some((b) => b.bundleId === "bundle_a"));
  assert.ok(listed.some((b) => b.bundleId === "bundle_b"));
});

test("WorkflowRegistry stores and retrieves workflows", () => {
  const registry = new WorkflowRegistry();
  const workflow = {
    workflowId: "wf_main",
    name: "Main Workflow",
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
    ],
  };
  registry.registerAll([workflow]);

  const retrieved = registry.get("wf_main");
  assert.notEqual(retrieved, null);
  assert.equal(retrieved!.workflowId, "wf_main");
  assert.equal(retrieved!.steps.length, 1);
});

test("WorkflowRegistry.get returns null for unknown workflow", () => {
  const registry = new WorkflowRegistry();
  assert.equal(registry.get("unknown_wf"), null);
});

test("WorkflowRegistry.list returns all registered workflows", () => {
  const registry = new WorkflowRegistry();
  registry.registerAll([
    { workflowId: "wf_one", name: "One", triggerConditions: {}, steps: [] },
    { workflowId: "wf_two", name: "Two", triggerConditions: {}, steps: [] },
  ]);

  const listed = registry.list();
  assert.equal(listed.length, 2);
});

test("ContractRegistry stores and retrieves output contracts", () => {
  const registry = new ContractRegistry();
  const contract = {
    contractId: "output_contract_a",
    name: "Contract A",
    schema: { type: "object", properties: { result: { type: "string" } } } as Record<string, unknown>,
    validationLevel: "strict" as const,
  };
  registry.registerAll([contract]);

  const retrieved = registry.get("output_contract_a");
  assert.notEqual(retrieved, null);
  assert.equal(retrieved!.contractId, "output_contract_a");
  assert.equal(retrieved!.validationLevel, "strict");
});

test("ContractRegistry.get returns null for unknown contract", () => {
  const registry = new ContractRegistry();
  assert.equal(registry.get("unknown_contract"), null);
});

test("ContractRegistry.list returns all registered contracts", () => {
  const registry = new ContractRegistry();
  registry.registerAll([
    { contractId: "contract_x", name: "X", schema: {} as Record<string, unknown>, validationLevel: "lenient" as const },
    { contractId: "contract_y", name: "Y", schema: {} as Record<string, unknown>, validationLevel: "strict" as const },
  ]);

  const listed = registry.list();
  assert.equal(listed.length, 2);
});

test("ToolBundleRegistry.registerAll handles multiple bundles", () => {
  const registry = new ToolBundleRegistry();
  registry.registerAll([
    { bundleId: "first", tools: [{ toolName: "t1", enabled: true, configOverrides: {} }] },
    { bundleId: "second", tools: [{ toolName: "t2", enabled: false, configOverrides: {} }] },
  ]);

  assert.notEqual(registry.get("first"), null);
  assert.notEqual(registry.get("second"), null);
  assert.equal(registry.list().length, 2);
});

test("WorkflowRegistry supports multiple steps with dependencies", () => {
  const registry = new WorkflowRegistry();
  const workflow = {
    workflowId: "wf_multi",
    name: "Multi-step Workflow",
    triggerConditions: {},
    steps: [
      {
        stepName: "step_a",
        toolHints: [],
        modelHints: {},
        outputSchema: null,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
        requiresReview: false,
        timeoutMs: 30000,
        dependsOn: [],
      },
      {
        stepName: "step_b",
        toolHints: ["analyzer"],
        modelHints: {},
        outputSchema: null,
        retryPolicy: { maxRetries: 2, backoffMs: 1000 },
        requiresReview: true,
        timeoutMs: 60000,
        dependsOn: ["step_a"],
      },
    ],
  };
  registry.registerAll([workflow]);

  const retrieved = registry.get("wf_multi");
  assert.notEqual(retrieved, null);
  assert.equal(retrieved!.steps.length, 2);
  assert.equal(retrieved!.steps[1].dependsOn[0], "step_a");
});

test("ContractRegistry handles empty schema", () => {
  const registry = new ContractRegistry();
  registry.registerAll([
    { contractId: "empty_schema", name: "Empty", schema: {} as Record<string, unknown>, validationLevel: "none" as const },
  ]);

  const retrieved = registry.get("empty_schema");
  assert.notEqual(retrieved, null);
  assert.deepEqual(retrieved!.schema, {});
});
