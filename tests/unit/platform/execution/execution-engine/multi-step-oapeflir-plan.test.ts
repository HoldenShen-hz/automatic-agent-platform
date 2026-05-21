/**
 * Multi-Step OAPEFLIR Plan Tests
 *
 * Tests for OAPEFLIR plan deserialization and workflow building.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  OAPEFLIR_PLAN_PREFIX,
  isOapeflirPlanRequest,
  deserializeOapeflirPlan,
  buildOapeflirPlannedWorkflow,
} from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-oapeflir-plan.js";

test("OAPEFLIR_PLAN_PREFIX has correct format", () => {
  assert.equal(OAPEFLIR_PLAN_PREFIX, "oapeflir://plan ");
});

test("isOapeflirPlanRequest returns true for oapeflir plan request", () => {
  const request = "oapeflir://plan [{\"stepId\":\"step1\"}]";
  assert.equal(isOapeflirPlanRequest(request), true);
});

test("isOapeflirPlanRequest returns false for regular request", () => {
  const request = "regular task request";
  assert.equal(isOapeflirPlanRequest(request), false);
});

test("isOapeflirPlanRequest returns false for empty string", () => {
  assert.equal(isOapeflirPlanRequest(""), false);
});

test("isOapeflirPlanRequest returns false for non-matching prefix", () => {
  const request = "other://plan something";
  assert.equal(isOapeflirPlanRequest(request), false);
});

test("deserializeOapeflirPlan parses valid JSON", () => {
  const planJson = '[{"stepId":"step1","dependencies":[]}]';
  const request = OAPEFLIR_PLAN_PREFIX + planJson;

  const steps = deserializeOapeflirPlan(request);

  assert.equal(steps.length, 1);
  assert.equal(steps[0]!.stepId, "step1");
});

test("deserializeOapeflirPlan handles multiple steps", () => {
  const planJson = JSON.stringify([
    { stepId: "step1", dependencies: [] },
    { stepId: "step2", dependencies: ["step1"] },
    { stepId: "step3", dependencies: ["step1", "step2"] },
  ]);
  const request = OAPEFLIR_PLAN_PREFIX + planJson;

  const steps = deserializeOapeflirPlan(request);

  assert.equal(steps.length, 3);
  assert.equal(steps[0]!.stepId, "step1");
  assert.equal(steps[1]!.stepId, "step2");
  assert.equal(steps[2]!.stepId, "step3");
});

test("buildOapeflirPlannedWorkflow creates workflow from legacy PlanStep", () => {
  const steps = [
    { stepId: "step1", dependencies: [], outputs: ["out1"], timeout: 30000, retryPolicy: { maxRetries: 0 } },
    { stepId: "step2", dependencies: ["step1"], outputs: ["out2"], timeout: 60000, retryPolicy: { maxRetries: 1 } },
  ];

  const workflow = buildOapeflirPlannedWorkflow(steps, "plan_123");

  assert.ok(workflow.workflow);
  assert.equal(workflow.workflow.workflowId, "oapeflir_plan_123");
  assert.equal(workflow.workflow.divisionId, "general_ops");
  assert.equal(workflow.workflow.steps.length, 2);
  assert.equal(workflow.planReason, "oapeflir_bridge: plan_123");
});

test("buildOapeflirPlannedWorkflow creates workflow from PlanGraphNode", () => {
  const nodes = [
    {
      nodeId: "node1",
      inputRefs: [],
      timeoutMs: 30000,
    },
    {
      nodeId: "node2",
      inputRefs: ["node1"],
      timeoutMs: 60000,
    },
  ];

  const workflow = buildOapeflirPlannedWorkflow(nodes, "plan_456");

  assert.equal(workflow.workflow.workflowId, "oapeflir_plan_456");
  assert.equal(workflow.workflow.steps.length, 2);
});

test("buildOapeflirPlannedWorkflow sets correct roleId", () => {
  const steps = [{ stepId: "step1", dependencies: [], outputs: ["out1"], timeout: 30000, retryPolicy: { maxRetries: 0 } }];

  const workflow = buildOapeflirPlannedWorkflow(steps, "plan_789");

  // All steps get "general_executor" role
  assert.equal(workflow.executionSteps[0]!.roleId, "general_executor");
});

test("buildOapeflirPlannedWorkflow sets correct maxAttempts", () => {
  const steps = [
    { stepId: "step1", dependencies: [], outputs: ["out1"], timeout: 30000, retryPolicy: { maxRetries: 0 } },
    { stepId: "step2", dependencies: [], outputs: ["out2"], timeout: 30000, retryPolicy: { maxRetries: 2 } },
  ];

  const workflow = buildOapeflirPlannedWorkflow(steps, "plan_attempts");

  // maxAttempts = maxRetries + 1
  assert.equal(workflow.executionSteps[0]!.maxAttempts, 1);
  assert.equal(workflow.executionSteps[1]!.maxAttempts, 3);
});

test("buildOapeflirPlannedWorkflow handles node without explicit timeout", () => {
  const nodes = [{ nodeId: "node1", inputRefs: [] }];

  const workflow = buildOapeflirPlannedWorkflow(nodes, "plan_no_timeout");

  // Should use default 30_000
  assert.equal(workflow.executionSteps[0]!.timeoutMs, 30_000);
  assert.equal(workflow.executionSteps[0]!.maxAttempts, 1);
});

test("buildOapeflirPlannedWorkflow sets outputKey correctly", () => {
  const steps = [{ stepId: "step1", dependencies: [], outputs: ["my_output"], timeout: 30000, retryPolicy: { maxRetries: 0 } }];

  const workflow = buildOapeflirPlannedWorkflow(steps, "plan_output");

  assert.equal(workflow.executionSteps[0]!.outputKey, "my_output");
});

test("buildOapeflirPlannedWorkflow sets outputSchemaPath", () => {
  const steps = [{ stepId: "step1", dependencies: [], outputs: ["out1"], outputSchemaPath: "/path/to/schema", timeout: 30000, retryPolicy: { maxRetries: 0 } }];

  const workflow = buildOapeflirPlannedWorkflow(steps, "plan_schema");

  assert.equal(workflow.executionSteps[0]!.outputSchemaPath, "/path/to/schema");
});

test("buildOapeflirPlannedWorkflow includes dependencyEdges", () => {
  const steps = [
    { stepId: "step1", dependencies: [], outputs: ["out1"], timeout: 30000, retryPolicy: { maxRetries: 0 } },
    { stepId: "step2", dependencies: ["step1"], outputs: ["out2"], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const workflow = buildOapeflirPlannedWorkflow(steps, "plan_edges");

  assert.ok(Array.isArray(workflow.dependencyEdges));
});

test("buildOapeflirPlannedWorkflow generates agent IDs", () => {
  const steps = [{ stepId: "step1", dependencies: [], outputs: ["out1"], timeout: 30000, retryPolicy: { maxRetries: 0 } }];

  const workflow = buildOapeflirPlannedWorkflow(steps, "plan_agent");

  assert.equal(workflow.executionSteps[0]!.agentId, "agent_general_executor");
});

test("buildOapeflirPlannedWorkflow handles PlanGraphNode with outputSchemaRef", () => {
  const nodes = [
    {
      nodeId: "node1",
      inputRefs: [],
      outputSchemaRef: "my-schema.json",
      timeoutMs: 30000,
    },
  ];

  const workflow = buildOapeflirPlannedWorkflow(nodes, "plan_schema_ref");

  // Should resolve outputSchemaRef to schema path
  assert.ok(workflow.executionSteps[0]!.outputSchemaPath);
});

test("buildOapeflirPlannedWorkflow handles empty steps array", () => {
  const workflow = buildOapeflirPlannedWorkflow([], "plan_empty");

  assert.equal(workflow.workflow.steps.length, 0);
  assert.equal(workflow.executionSteps.length, 0);
});