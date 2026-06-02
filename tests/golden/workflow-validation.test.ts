/**
 * Golden Test: Workflow Validation Output
 *
 * Verifies workflow validation produces expected structure and
 * correctly identifies valid and invalid workflow definitions.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { WorkflowValidator } from "../../src/platform/five-plane-orchestration/oapeflir/workflow/workflow-validator.js";
import { SINGLE_AGENT_MINIMAL_WORKFLOW, WORKFLOW_DEFINITIONS } from "../../src/platform/five-plane-orchestration/oapeflir/workflow/minimal-workflow.js";

test("golden: workflow validator accepts built-in single agent workflow", () => {
  const validator = new WorkflowValidator();

  const result = validator.validate(SINGLE_AGENT_MINIMAL_WORKFLOW);

  assert.equal(result.ok, true, "Single agent workflow should pass validation");
  assert.deepEqual(result.issues.filter(i => i.severity === "error"), [], "Single agent workflow should have no error issues");
});

test("golden: workflow validator rejects duplicate step IDs", () => {
  const validator = new WorkflowValidator();

  const invalidWorkflow = {
    workflowId: "test-invalid",
    divisionId: "general-ops",
    steps: [
      { stepId: "same-id", roleId: "general_executor", outputKey: "out1", outputSchemaPath: "test", timeoutMs: 60000, maxAttempts: 1, compensationModel: "idempotent_replay" as const },
      { stepId: "same-id", roleId: "general_executor", outputKey: "out2", outputSchemaPath: "test", timeoutMs: 60000, maxAttempts: 1, compensationModel: "idempotent_replay" as const },
    ],
  };

  const result = validator.validate(invalidWorkflow);

  assert.equal(result.ok, false, "Workflow with duplicate step IDs should be invalid");
  assert.ok(result.issues.length > 0, "Should have validation issues");
  assert.ok(result.issues.some(i => i.code === "step.duplicate_id"), "Should report duplicate step ID error");
});

test("golden: workflow validator rejects negative timeout values", () => {
  const validator = new WorkflowValidator();

  const invalidWorkflow = {
    workflowId: "test-invalid-timeout",
    divisionId: "general-ops",
    steps: [
      { stepId: "step-1", roleId: "general_executor", outputKey: "out", outputSchemaPath: "test", timeoutMs: -1, maxAttempts: 1, compensationModel: "idempotent_replay" as const },
    ],
  };

  const result = validator.validate(invalidWorkflow);

  assert.equal(result.ok, false, "Workflow with negative timeout should be invalid");
  assert.ok(result.issues.some(i => i.code === "step.invalid_timeout"), "Should report timeout error");
});

test("golden: workflow validator rejects zero maxAttempts", () => {
  const validator = new WorkflowValidator();

  const invalidWorkflow = {
    workflowId: "test-invalid-attempts",
    divisionId: "general-ops",
    steps: [
      { stepId: "step-1", roleId: "general_executor", outputKey: "out", outputSchemaPath: "test", timeoutMs: 60000, maxAttempts: 0, compensationModel: "idempotent_replay" as const },
    ],
  };

  const result = validator.validate(invalidWorkflow);

  assert.equal(result.ok, false, "Workflow with zero maxAttempts should be invalid");
  assert.ok(result.issues.some(i => i.code === "step.invalid_max_attempts"), "Should report invalid attempts error");
});

test("golden: workflow validator accepts complete workflow definition", () => {
  const validator = new WorkflowValidator();

  const completeWorkflow = {
    workflowId: "test-complete-workflow",
    divisionId: "general-ops",
    steps: [
      {
        stepId: "step-1",
        roleId: "general_executor",
        outputKey: "result",
        outputSchemaPath: "test",
        timeoutMs: 60000,
        maxAttempts: 3,
        compensationModel: "idempotent_replay" as const,
      },
    ],
  };

  const result = validator.validate(completeWorkflow);

  assert.equal(result.ok, true, "Complete workflow should be valid");
  assert.deepEqual(result.issues.filter(i => i.severity === "error"), [], "Complete workflow should have no error issues");
});

test("golden: workflow validator detects dependency cycles", () => {
  const validator = new WorkflowValidator();

  // Create a workflow with a cycle: step1 -> step2 -> step3 -> step1
  const cyclicWorkflow = {
    workflowId: "test-cyclic",
    divisionId: "general-ops",
    steps: [
      { stepId: "step-1", roleId: "general_executor", outputKey: "out1", outputSchemaPath: "test", timeoutMs: 60000, maxAttempts: 1, compensationModel: "idempotent_replay" as const, dependsOnStepIds: ["step-3"] },
      { stepId: "step-2", roleId: "general_executor", outputKey: "out2", outputSchemaPath: "test", timeoutMs: 60000, maxAttempts: 1, compensationModel: "idempotent_replay" as const, dependsOnStepIds: ["step-1"] },
      { stepId: "step-3", roleId: "general_executor", outputKey: "out3", outputSchemaPath: "test", timeoutMs: 60000, maxAttempts: 1, compensationModel: "idempotent_replay" as const, dependsOnStepIds: ["step-2"] },
    ],
  };

  const result = validator.validate(cyclicWorkflow);

  assert.equal(result.ok, false, "Workflow with cycle should be invalid");
  assert.ok(result.issues.some(i => i.code === "dependency.cycle"), "Should report cycle error");
});

test("golden: workflow validator reports missing output schema path", () => {
  const validator = new WorkflowValidator();

  const workflowWithoutSchema = {
    workflowId: "test-no-schema",
    divisionId: "general-ops",
    steps: [
      { stepId: "step-1", roleId: "general_executor", outputKey: "out", outputSchemaPath: "", timeoutMs: 60000, maxAttempts: 1, compensationModel: "idempotent_replay" as const },
    ],
  };

  const result = validator.validate(workflowWithoutSchema);

  assert.equal(result.ok, false, "Step without output schema should be invalid");
  assert.ok(result.issues.some(i => i.code === "step.missing_output_schema"), "Should report missing schema error");
});

test("golden: all built-in WORKFLOW_DEFINITIONS pass validation", () => {
  const validator = new WorkflowValidator();

  for (const workflow of WORKFLOW_DEFINITIONS.values()) {
    const result = validator.validate(workflow);
    assert.equal(result.ok, true, `Workflow ${workflow.workflowId} should be valid`);
  }
});
