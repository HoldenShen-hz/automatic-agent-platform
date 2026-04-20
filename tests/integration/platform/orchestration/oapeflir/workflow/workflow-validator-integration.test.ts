import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowValidator, assertWorkflowValid } from "../../../../../../src/platform/orchestration/oapeflir/workflow/workflow-validator.js";
import type { MinimalWorkflowDefinition } from "../../../../../../src/platform/orchestration/oapeflir/workflow/minimal-workflow.js";
import { ValidationError } from "../../../../../../src/platform/contracts/errors.js";

function createValidWorkflow(overrides?: Partial<MinimalWorkflowDefinition>): MinimalWorkflowDefinition {
  return {
    workflowId: "test-workflow",
    divisionId: "general_ops",
    steps: [
      {
        stepId: "step-1",
        roleId: "agent",
        outputKey: "result-1",
        outputSchemaPath: "/schemas/result.json",
        timeoutMs: 30000,
        maxAttempts: 1,
      },
      {
        stepId: "step-2",
        roleId: "agent",
        outputKey: "result-2",
        outputSchemaPath: "/schemas/result.json",
        timeoutMs: 30000,
        maxAttempts: 1,
        dependsOnStepIds: ["step-1"],
      },
    ],
    ...overrides,
  };
}

test("WorkflowValidator integration: valid workflow passes validation", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow();

  const report = validator.validate(workflow);

  assert.equal(report.ok, true);
  assert.equal(report.errorCount, 0);
  assert.equal(report.warningCount, 0);
});

test("WorkflowValidator integration: empty workflow fails validation", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow({ steps: [] });

  const report = validator.validate(workflow);

  assert.equal(report.ok, false);
  assert.equal(report.errorCount, 1);
  assert.equal(report.issues[0]?.code, "workflow.empty");
});

test("WorkflowValidator integration: duplicate step IDs detected", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow({
    steps: [
      {
        stepId: "duplicate-id",
        roleId: "agent",
        outputKey: "out-1",
        outputSchemaPath: "/s.json",
        timeoutMs: 30000,
        maxAttempts: 1,
      },
      {
        stepId: "duplicate-id",
        roleId: "agent",
        outputKey: "out-2",
        outputSchemaPath: "/s.json",
        timeoutMs: 30000,
        maxAttempts: 1,
      },
    ],
  });

  const report = validator.validate(workflow);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some(i => i.code === "step.duplicate_id"));
});

test("WorkflowValidator integration: self-referencing dependency detected", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow({
    steps: [
      {
        stepId: "self-ref",
        roleId: "agent",
        outputKey: "out",
        outputSchemaPath: "/s.json",
        timeoutMs: 30000,
        maxAttempts: 1,
        dependsOnStepIds: ["self-ref"],
      },
    ],
  });

  const report = validator.validate(workflow);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some(i => i.code === "dependency.self_reference"));
});

test("WorkflowValidator integration: cycle detection in dependencies", () => {
  const validator = new WorkflowValidator();
  const workflow: MinimalWorkflowDefinition = {
    workflowId: "cycle-workflow",
    divisionId: "general_ops",
    steps: [
      {
        stepId: "step-a",
        roleId: "agent",
        outputKey: "out-a",
        outputSchemaPath: "/s.json",
        timeoutMs: 30000,
        maxAttempts: 1,
        dependsOnStepIds: ["step-c"],
      },
      {
        stepId: "step-b",
        roleId: "agent",
        outputKey: "out-b",
        outputSchemaPath: "/s.json",
        timeoutMs: 30000,
        maxAttempts: 1,
        dependsOnStepIds: ["step-a"],
      },
      {
        stepId: "step-c",
        roleId: "agent",
        outputKey: "out-c",
        outputSchemaPath: "/s.json",
        timeoutMs: 30000,
        maxAttempts: 1,
        dependsOnStepIds: ["step-b"],
      },
    ],
  };

  const report = validator.validate(workflow);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some(i => i.code === "dependency.cycle"));
});

test("WorkflowValidator integration: missing dependency target detected", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow({
    steps: [
      {
        stepId: "step-1",
        roleId: "agent",
        outputKey: "result-1",
        outputSchemaPath: "/schemas/result.json",
        timeoutMs: 30000,
        maxAttempts: 1,
      },
      {
        stepId: "step-2",
        roleId: "agent",
        outputKey: "result-2",
        outputSchemaPath: "/schemas/result.json",
        timeoutMs: 30000,
        maxAttempts: 1,
        dependsOnStepIds: ["nonexistent-step"],
      },
    ],
  });

  const report = validator.validate(workflow);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some(i => i.code === "dependency.missing_target"));
});

test("WorkflowValidator integration: no entrypoint workflow fails", () => {
  const validator = new WorkflowValidator();
  const workflow: MinimalWorkflowDefinition = {
    workflowId: "no-entry",
    divisionId: "general_ops",
    steps: [
      {
        stepId: "step-1",
        roleId: "agent",
        outputKey: "result-1",
        outputSchemaPath: "/schemas/result.json",
        timeoutMs: 30000,
        maxAttempts: 1,
        dependsOnStepIds: ["step-2"],
      },
      {
        stepId: "step-2",
        roleId: "agent",
        outputKey: "result-2",
        outputSchemaPath: "/schemas/result.json",
        timeoutMs: 30000,
        maxAttempts: 1,
        dependsOnStepIds: ["step-1"],
      },
    ],
  };

  const report = validator.validate(workflow);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some(i => i.code === "workflow.no_entrypoint"));
});

test("WorkflowValidator integration: missing role detected", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow({
    steps: [
      {
        stepId: "step-1",
        roleId: "",
        outputKey: "result-1",
        outputSchemaPath: "/schemas/result.json",
        timeoutMs: 30000,
        maxAttempts: 1,
      },
    ],
  });

  const report = validator.validate(workflow);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some(i => i.code === "step.missing_role"));
});

test("WorkflowValidator integration: invalid timeout detected", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow({
    steps: [
      {
        stepId: "step-1",
        roleId: "agent",
        outputKey: "result-1",
        outputSchemaPath: "/schemas/result.json",
        timeoutMs: -1000,
        maxAttempts: 1,
      },
    ],
  });

  const report = validator.validate(workflow);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some(i => i.code === "step.invalid_timeout"));
});

test("WorkflowValidator integration: invalid maxAttempts detected", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow({
    steps: [
      {
        stepId: "step-1",
        roleId: "agent",
        outputKey: "result-1",
        outputSchemaPath: "/schemas/result.json",
        timeoutMs: 30000,
        maxAttempts: 0,
      },
    ],
  });

  const report = validator.validate(workflow);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some(i => i.code === "step.invalid_max_attempts"));
});

test("assertWorkflowValid throws for invalid workflow", () => {
  const workflow = createValidWorkflow({ steps: [] });

  assert.throws(
    () => assertWorkflowValid(workflow),
    (err: unknown) => err instanceof ValidationError && err.code === "workflow.invalid:workflow.empty"
  );
});

test("assertWorkflowValid returns report for valid workflow", () => {
  const workflow = createValidWorkflow();
  const report = assertWorkflowValid(workflow);

  assert.equal(report.ok, true);
});

test("WorkflowValidator integration: multiple issues collected", () => {
  const validator = new WorkflowValidator();
  const workflow: MinimalWorkflowDefinition = {
    workflowId: "multi-error",
    divisionId: "general_ops",
    steps: [
      {
        stepId: "",
        roleId: "",
        outputKey: "",
        outputSchemaPath: "",
        timeoutMs: -1,
        maxAttempts: 0,
      },
    ],
  };

  const report = validator.validate(workflow);

  assert.equal(report.ok, false);
  assert.ok(report.errorCount >= 5); // missing_id, missing_role, missing_output_key, missing_output_schema, invalid_timeout, invalid_max_attempts
});

test("WorkflowValidator integration: duplicate output keys detected", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow({
    steps: [
      {
        stepId: "step-1",
        roleId: "agent",
        outputKey: "duplicate-key",
        outputSchemaPath: "/s.json",
        timeoutMs: 30000,
        maxAttempts: 1,
      },
      {
        stepId: "step-2",
        roleId: "agent",
        outputKey: "duplicate-key",
        outputSchemaPath: "/s.json",
        timeoutMs: 30000,
        maxAttempts: 1,
      },
    ],
  });

  const report = validator.validate(workflow);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some(i => i.code === "step.duplicate_output_key"));
});

test("WorkflowValidator integration: duplicate dependency warning", () => {
  const validator = new WorkflowValidator();
  const workflow = createValidWorkflow({
    steps: [
      {
        stepId: "step-1",
        roleId: "agent",
        outputKey: "result-1",
        outputSchemaPath: "/schemas/result.json",
        timeoutMs: 30000,
        maxAttempts: 1,
      },
      {
        stepId: "step-2",
        roleId: "agent",
        outputKey: "result-2",
        outputSchemaPath: "/schemas/result.json",
        timeoutMs: 30000,
        maxAttempts: 1,
        dependsOnStepIds: ["step-1", "step-1"], // duplicate
      },
    ],
  });

  const report = validator.validate(workflow);

  // Warnings don't make ok=false, only errors do
  assert.equal(report.ok, true);
  assert.ok(report.issues.some(i => i.code === "dependency.duplicate" && i.severity === "warning"));
});
