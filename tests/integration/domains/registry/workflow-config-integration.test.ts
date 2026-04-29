/**
 * Integration Test: WorkflowConfig
 *
 * Tests workflow configuration parsing, validation,
 * and non-linear step graph support.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  WorkflowConfigSchema,
  StepTemplateConfigSchema,
  type WorkflowConfig,
  type StepTemplateConfig,
} from "../../../../src/domains/registry/domain-model.js";

test("WorkflowConfig integration: parses workflow with multiple linear steps", () => {
  const workflow = {
    workflowId: "linear-workflow",
    name: "Linear Workflow",
    triggerConditions: { status: "active" },
    steps: [
      { stepName: "fetch-data", toolHints: ["curl"] },
      { stepName: "process-data", toolHints: ["jq"], dependsOn: ["fetch-data"] },
      { stepName: "save-data", toolHints: ["db-write"], dependsOn: ["process-data"] },
    ],
  };

  const result = WorkflowConfigSchema.parse(workflow);
  assert.equal(result.workflowId, "linear-workflow");
  assert.equal(result.steps.length, 3);
  assert.equal(result.steps[0]!.dependsOn.length, 0);
  assert.equal(result.steps[1]!.dependsOn[0], "fetch-data");
  assert.equal(result.steps[2]!.dependsOn[0], "process-data");
});

test("WorkflowConfig integration: parses DAG workflow with branching", () => {
  const workflow = {
    workflowId: "dag-workflow",
    name: "DAG Workflow",
    steps: [
      { stepName: "start" },
      { stepName: "branch-a", dependsOn: ["start"] },
      { stepName: "branch-b", dependsOn: ["start"] },
      { stepName: "merge", dependsOn: ["branch-a", "branch-b"] },
    ],
  };

  const result = WorkflowConfigSchema.parse(workflow);
  assert.equal(result.steps[3]!.dependsOn.length, 2);
  assert.ok(result.steps[3]!.dependsOn.includes("branch-a"));
  assert.ok(result.steps[3]!.dependsOn.includes("branch-b"));
});

test("WorkflowConfig integration: parses workflow with stepGraph edges", () => {
  const workflow = {
    workflowId: "graph-workflow",
    name: "Graph Workflow",
    steps: [
      { stepName: "init" },
      { stepName: "step-a" },
      { stepName: "step-b" },
      { stepName: "finish" },
    ],
    stepGraph: {
      edges: [
        { fromStep: "init", toStep: "step-a", condition: null },
        { fromStep: "init", toStep: "step-b", condition: { parallel: true } },
        { fromStep: "step-a", toStep: "finish", condition: null },
        { fromStep: "step-b", toStep: "finish", condition: null },
      ],
    },
  };

  const result = WorkflowConfigSchema.parse(workflow);
  assert.equal(result.stepGraph!.edges.length, 4);
  assert.equal(result.stepGraph!.edges[0]!.fromStep, "init");
  assert.equal(result.stepGraph!.edges[0]!.toStep, "step-a");
  assert.deepEqual(result.stepGraph!.edges[1]!.condition, { parallel: true });
});

test("WorkflowConfig integration: parses step with model hints", () => {
  const workflow = {
    workflowId: "model-workflow",
    name: "Model Hints Workflow",
    steps: [
      {
        stepName: "analyze",
        modelHints: {
          preferredModel: "claude-3-opus",
          temperature: 0.5,
        },
      },
    ],
  };

  const result = WorkflowConfigSchema.parse(workflow);
  assert.equal(result.steps[0]!.modelHints.preferredModel, "claude-3-opus");
  assert.equal(result.steps[0]!.modelHints.temperature, 0.5);
});

test("WorkflowConfig integration: parses step with retry policy", () => {
  const workflow = {
    workflowId: "retry-workflow",
    name: "Retry Workflow",
    steps: [
      {
        stepName: "unreliable-step",
        retryPolicy: { maxRetries: 5, backoffMs: 2000 },
      },
    ],
  };

  const result = WorkflowConfigSchema.parse(workflow);
  assert.equal(result.steps[0]!.retryPolicy.maxRetries, 5);
  assert.equal(result.steps[0]!.retryPolicy.backoffMs, 2000);
});

test("WorkflowConfig integration: applies defaults to workflow and steps", () => {
  const workflow = {
    workflowId: "minimal-workflow",
    name: "Minimal Workflow",
    steps: [{ stepName: "simple-step" }],
  };

  const result = WorkflowConfigSchema.parse(workflow);
  assert.deepEqual(result.triggerConditions, {});
  assert.equal(result.steps[0]!.timeoutMs, 60000);
  assert.equal(result.steps[0]!.requiresReview, false);
  assert.deepEqual(result.steps[0]!.retryPolicy, { maxRetries: 0, backoffMs: 0 });
});

test("WorkflowConfig integration: rejects invalid workflowId", () => {
  assert.throws(() => {
    WorkflowConfigSchema.parse({ workflowId: "", name: "Test" });
  });
});

test("WorkflowConfig integration: rejects invalid step name", () => {
  assert.throws(() => {
    WorkflowConfigSchema.parse({
      workflowId: "wf1",
      name: "Test",
      steps: [{ stepName: "" }],
    });
  });
});

test("WorkflowConfig integration: rejects negative timeout", () => {
  assert.throws(() => {
    WorkflowConfigSchema.parse({
      workflowId: "wf1",
      name: "Test",
      steps: [{ stepName: "step1", timeoutMs: -1 }],
    });
  });
});

test("WorkflowConfig integration: rejects invalid temperature", () => {
  assert.throws(() => {
    WorkflowConfigSchema.parse({
      workflowId: "wf1",
      name: "Test",
      steps: [{ stepName: "step1", modelHints: { temperature: 3.0 } }],
    });
  });
});

test("StepTemplateConfigSchema integration: parses step with outputSchema", () => {
  const step = {
    stepName: "format-output",
    outputSchema: {
      type: "object",
      properties: {
        result: { type: "string" },
        metadata: { type: "object" },
      },
    },
  };

  const result = StepTemplateConfigSchema.parse(step);
  assert.deepEqual(result.outputSchema, {
    type: "object",
    properties: {
      result: { type: "string" },
      metadata: { type: "object" },
    },
  });
});

test("StepTemplateConfigSchema integration: parses complex DAG step dependencies", () => {
  const step = {
    stepName: "final-merge",
    dependsOn: ["preparation-a", "preparation-b", "preparation-c", "validation"],
    toolHints: ["merger"],
    requiresReview: true,
    timeoutMs: 120000,
  };

  const result = StepTemplateConfigSchema.parse(step);
  assert.equal(result.dependsOn.length, 4);
  assert.equal(result.requiresReview, true);
  assert.equal(result.timeoutMs, 120000);
});

test("StepTemplateConfigSchema integration: validates maxRetries is non-negative", () => {
  assert.throws(() => {
    StepTemplateConfigSchema.parse({
      stepName: "step1",
      retryPolicy: { maxRetries: -1, backoffMs: 100 },
    });
  });
});

test("StepTemplateConfigSchema integration: validates backoffMs is non-negative", () => {
  assert.throws(() => {
    StepTemplateConfigSchema.parse({
      stepName: "step1",
      retryPolicy: { maxRetries: 1, backoffMs: -100 },
    });
  });
});

test("WorkflowConfig integration: parses multiple workflows with shared step names", () => {
  const workflows = [
    {
      workflowId: "workflow-a",
      name: "Workflow A",
      steps: [{ stepName: "shared-step", toolHints: ["tool1"] }],
    },
    {
      workflowId: "workflow-b",
      name: "Workflow B",
      steps: [{ stepName: "shared-step", toolHints: ["tool2"] }],
    },
  ];

  const resultA = WorkflowConfigSchema.parse(workflows[0]);
  const resultB = WorkflowConfigSchema.parse(workflows[1]);

  assert.equal(resultA.steps[0]!.toolHints[0], "tool1");
  assert.equal(resultB.steps[0]!.toolHints[0], "tool2");
});

test("WorkflowConfig integration: type infers correctly", () => {
  const workflow = WorkflowConfigSchema.parse({
    workflowId: "typed-workflow",
    name: "Typed Workflow",
    steps: [{ stepName: "step1", toolHints: ["bash"] }],
  });

  const _typeCheck: WorkflowConfig = workflow;
  assert.ok(_typeCheck);
});
