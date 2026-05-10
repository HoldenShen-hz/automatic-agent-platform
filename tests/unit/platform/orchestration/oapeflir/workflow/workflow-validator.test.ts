import assert from "node:assert/strict";
import test from "node:test";

import {
  WorkflowValidator,
  assertWorkflowValid,
  validateIssues,
  validateWorkflowCompatibility,
  type StaticCompatibilityIssue,
  type WorkflowLintIssue,
  type WorkflowLintSeverity,
} from "../../../../../../src/platform/orchestration/oapeflir/workflow/workflow-validator.js";
import type {
  MinimalWorkflowDefinition,
  MinimalWorkflowStep,
  WorkflowTemplate,
} from "../../../../../../src/platform/orchestration/oapeflir/workflow/minimal-workflow.js";

function createValidStep(overrides: Partial<MinimalWorkflowStep> = {}): MinimalWorkflowStep {
  return {
    stepId: "step1",
    roleId: "general_executor",
    outputKey: "output1",
    outputSchemaPath: "/schemas/output.json",
    timeoutMs: 60000,
    maxAttempts: 1,
    ...overrides,
  };
}

function createValidWorkflow(steps: MinimalWorkflowStep[]): MinimalWorkflowDefinition {
  return {
    workflowId: "test_workflow",
    divisionId: "general_ops",
    steps,
  };
}

test("WorkflowValidator passes valid workflow", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow([createValidStep()]);
  
  const report = validator.validate(workflow);
  
  assert.equal(report.ok, true);
  assert.equal(report.errorCount, 0);
});

test("WorkflowValidator detects empty workflow", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow([]);
  
  const report = validator.validate(workflow);
  
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((i: WorkflowLintIssue) => i.code === "workflow.empty"));
});

test("WorkflowValidator detects missing step ID", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow([createValidStep({ stepId: "   " })]);
  
  const report = validator.validate(workflow);
  
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((i: WorkflowLintIssue) => i.code === "step.missing_id"));
});

test("WorkflowValidator detects duplicate step ID", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow([
    createValidStep({ stepId: "step1" }),
    createValidStep({ stepId: "step1" }),
  ]);
  
  const report = validator.validate(workflow);
  
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((i: WorkflowLintIssue) => i.code === "step.duplicate_id"));
});

test("WorkflowValidator detects missing role", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow([createValidStep({ roleId: "  " })]);
  
  const report = validator.validate(workflow);
  
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((i: WorkflowLintIssue) => i.code === "step.missing_role"));
});

test("WorkflowValidator detects missing output key", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow([createValidStep({ outputKey: "  " })]);
  
  const report = validator.validate(workflow);
  
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((i: WorkflowLintIssue) => i.code === "step.missing_output_key"));
});

test("WorkflowValidator detects missing output schema", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow([createValidStep({ outputSchemaPath: "" })]);
  
  const report = validator.validate(workflow);
  
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((i: WorkflowLintIssue) => i.code === "step.missing_output_schema"));
});

test("WorkflowValidator detects invalid timeout", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow([createValidStep({ timeoutMs: 0 })]);
  
  const report = validator.validate(workflow);
  
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((i: WorkflowLintIssue) => i.code === "step.invalid_timeout"));
});

test("WorkflowValidator detects invalid maxAttempts", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow([createValidStep({ maxAttempts: 0 })]);
  
  const report = validator.validate(workflow);
  
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((i: WorkflowLintIssue) => i.code === "step.invalid_max_attempts"));
});

test("WorkflowValidator detects missing dependency target", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow([
    createValidStep({ stepId: "step1", outputKey: "out1" }),
    createValidStep({
      stepId: "step2",
      outputKey: "out2",
      dependsOnStepIds: ["nonexistent"],
      inputKeys: ["nonexistent"],
    }),
  ]);
  
  const report = validator.validate(workflow);
  
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((i: WorkflowLintIssue) => i.code === "dependency.missing_target"));
});

test("WorkflowValidator detects self-reference dependency", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow([
    createValidStep({
      stepId: "step1",
      outputKey: "out1",
      dependsOnStepIds: ["step1"],
      inputKeys: ["out1"],
    }),
  ]);
  
  const report = validator.validate(workflow);
  
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((i: WorkflowLintIssue) => i.code === "dependency.self_reference"));
});

test("WorkflowValidator detects missing input key dependency", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow([
    createValidStep({ stepId: "step1", outputKey: "out1" }),
    createValidStep({
      stepId: "step2",
      outputKey: "out2",
      inputKeys: ["missing_key"],
    }),
  ]);
  
  const report = validator.validate(workflow);
  
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((i: WorkflowLintIssue) => i.code === "dependency.missing_input_key"));
});

test("WorkflowValidator detects duplicate dependency as warning", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow([
    createValidStep({ stepId: "step1", outputKey: "out1" }),
    createValidStep({
      stepId: "step2",
      outputKey: "out2",
      dependsOnStepIds: ["step1", "step1"],
    }),
  ]);

  const report = validator.validate(workflow);

  // Duplicate dependency is a warning, not an error - workflow is still valid
  assert.equal(report.ok, true);
  assert.ok(report.issues.some((i: WorkflowLintIssue) => i.code === "dependency.duplicate" && i.severity === "warning"));
});

test("WorkflowValidator detects no entrypoint", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow([
    createValidStep({
      stepId: "step1",
      outputKey: "out1",
      dependsOnStepIds: ["step2"],
    }),
    createValidStep({
      stepId: "step2",
      outputKey: "out2",
      dependsOnStepIds: ["step1"],
    }),
  ]);
  
  const report = validator.validate(workflow);
  
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((i: WorkflowLintIssue) => i.code === "workflow.no_entrypoint"));
});

test("WorkflowValidator detects dependency cycle", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow([
    createValidStep({
      stepId: "step1",
      outputKey: "out1",
      dependsOnStepIds: ["step3"],
      inputKeys: ["out3"],
    }),
    createValidStep({
      stepId: "step2",
      outputKey: "out2",
      dependsOnStepIds: ["step1"],
      inputKeys: ["out1"],
    }),
    createValidStep({
      stepId: "step3",
      outputKey: "out3",
      dependsOnStepIds: ["step2"],
      inputKeys: ["out2"],
    }),
  ]);
  
  const report = validator.validate(workflow);
  
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((i: WorkflowLintIssue) => i.code === "dependency.cycle"));
});

test("WorkflowValidator reports correct error and warning counts", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow([createValidStep({ stepId: "   " })]);
  
  const report = validator.validate(workflow);
  
  assert.equal(report.errorCount, 1);
  assert.equal(report.warningCount, 0);
});

test("validateIssues exports canonical StaticCompatibilityIssue array", () => {
  const workflow = createValidWorkflow([createValidStep({ outputSchemaPath: "" })]);

  const issues = validateIssues(workflow);
  const firstIssue: StaticCompatibilityIssue | undefined = issues[0];

  assert.ok(Array.isArray(issues));
  assert.equal(firstIssue?.code, "step.missing_output_schema");
});

test("validateWorkflowCompatibility preserves compatibility alias", () => {
  const workflow = createValidWorkflow([createValidStep({ timeoutMs: 0 })]);

  const issues = validateWorkflowCompatibility(workflow);

  assert.equal(issues[0]?.code, "step.invalid_timeout");
});

test("WorkflowTemplate aliases MinimalWorkflowDefinition", () => {
  const workflowTemplate: WorkflowTemplate = createValidWorkflow([createValidStep()]);

  assert.equal(workflowTemplate.workflowId, "test_workflow");
  assert.equal(workflowTemplate.steps.length, 1);
});

test("WorkflowValidator handles whitespace step ID normalization", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow([
    createValidStep({ stepId: "  step1  " }),
    createValidStep({ stepId: "step1" }),
  ]);
  
  const report = validator.validate(workflow);
  
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((i: WorkflowLintIssue) => i.code === "step.duplicate_id"));
});

test("assertWorkflowValid returns report for valid workflow", () => {
  const workflow = createValidWorkflow([createValidStep()]);
  
  const report = assertWorkflowValid(workflow);
  
  assert.equal(report.ok, true);
});

test("assertWorkflowValid throws for invalid workflow", () => {
  const workflow = createValidWorkflow([]);
  
  assert.throws(
    () => assertWorkflowValid(workflow),
    (error: any) => error.code === "workflow.invalid:workflow.empty"
  );
});

test("WorkflowLintSeverity type accepts error and warning", () => {
  const severities: WorkflowLintSeverity[] = ["error", "warning"];
  assert.equal(severities.length, 2);
});
